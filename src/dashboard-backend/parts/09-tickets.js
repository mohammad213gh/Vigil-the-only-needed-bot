// ──────────────────── Part 09: Tickets ────────────────────
// Ticket system configuration, panels, and panel types.

const { getDb } = require('../../db');
const {
    getTicketConfig, updateTicketConfig,
    getPanels, createPanel, updatePanel, deletePanel,
    getPanelTypes, createPanelType, updatePanelType, deletePanelType,
    sendTicketPanel,
} = require('../../tickets');
const { getClient } = require('../core');

// Legacy rows may store questions/support_roles as a double-encoded JSON string
// (e.g. '"[]"' or '"[\"a\"]"'). Normalize to a plain array for the frontend.
function cleanJsonArray(v) {
    if (Array.isArray(v)) return v;
    if (v === null || v === undefined) return [];
    if (typeof v !== 'string') return [];
    try {
        let parsed = JSON.parse(v);
        // double-encoded: the string itself is a JSON-encoded value
        if (typeof parsed === 'string') {
            try { parsed = JSON.parse(parsed); } catch { return []; }
        }
        return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
}

function register(app, ctx) {
    const { requireAuth } = ctx;

    // Get all ticket data for a server (panels + types + recent tickets)
    app.get('/api/server/:id/tickets', requireAuth, (req, res) => {
        const client = getClient();
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'Server not found' });
        try {
            const db = getDb();
            const config = getTicketConfig(guild.id);
            const panels = getPanels(guild.id).map(p => ({
                id: p.id,
                name: p.name,
                color: p.color,
                image_url: p.image_url,
                description: p.description,
                channel_id: p.channel_id,
                panel_message_id: p.panel_message_id,
                ticket_counter: p.ticket_counter || 0,
                types: getPanelTypes(p.id).map(t => ({
                    id: t.id,
                    name: t.name,
                    emoji: t.emoji,
                    category_id: t.category_id,
                    support_roles: cleanJsonArray(t.support_roles),
                    welcome_message: t.welcome_message,
                    ticket_name_format: t.ticket_name_format,
                    questions: cleanJsonArray(t.questions),
                    sort_order: t.sort_order,
                })),
            }));
            const tickets = db.prepare('SELECT * FROM tickets WHERE guild_id = ? ORDER BY created_at DESC LIMIT 50').all(guild.id);

            // Get channels and roles for the frontend pickers
            const channels = guild.channels.cache
                .filter(c => c.type === 0 || c.type === 5 || c.type === 4 || c.type === 15)
                .sort((a, b) => a.position - b.position)
                .map(c => ({ id: c.id, name: c.name, type: c.type }));
            const roles = guild.roles.cache
                .filter(r => r.name !== '@everyone' && !r.managed)
                .sort((a, b) => b.position - a.position)
                .map(r => ({ id: r.id, name: r.name, color: r.hexColor === '#000000' ? null : r.hexColor }));

            res.json({
                config: {
                    enabled: !!config.enabled,
                    ticketCount: config.ticket_count || 0,
                    closeOnLeave: !!config.close_on_leave,
                    logChannelId: config.log_channel_id,
                },
                panels,
                tickets: tickets.map(t => ({
                    id: t.id,
                    ticketNumber: t.ticket_number,
                    channelId: t.channel_id,
                    creatorId: t.creator_id,
                    creatorTag: t.creator_tag,
                    panelTypeName: t.panel_type_name,
                    status: t.status,
                    createdAt: t.created_at,
                    closedById: t.closed_by_id,
                    closedByTag: t.closed_by_tag,
                    closedAt: t.closed_at,
                    claimerId: t.claimer_id,
                    closedReason: t.closed_reason,
                })),
                channels,
                roles,
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Update global ticket config
    app.post('/api/server/:id/tickets/config', requireAuth, (req, res) => {
        const client = getClient();
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'Server not found' });
        try {
            const { enabled, closeOnLeave, logChannelId } = req.body;
            const updates = {};
            if (enabled !== undefined) updates.enabled = enabled;
            if (closeOnLeave !== undefined) updates.close_on_leave = closeOnLeave;
            if (logChannelId !== undefined) updates.log_channel_id = logChannelId;
            const result = updateTicketConfig(guild.id, updates);
            res.json({ success: true, config: result });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Create a panel
    app.post('/api/server/:id/tickets/panels', requireAuth, (req, res) => {
        const client = getClient();
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'Server not found' });
        try {
            const { name, color, description, image_url } = req.body;
            const panel = createPanel(guild.id, name || 'New Panel');
            if (color) updatePanel(panel.id, { color });
            if (description) updatePanel(panel.id, { description });
            if (image_url) updatePanel(panel.id, { image_url });
            // Seed a default ticket type so the panel can open tickets right away
            const existingTypes = getPanelTypes(panel.id);
            if (!existingTypes.length) {
                createPanelType(panel.id, guild.id, 'General Support', '🎫');
            }
            res.json({ success: true, panel });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Update a panel
    app.put('/api/server/:id/tickets/panels/:panelId', requireAuth, (req, res) => {
        const client = getClient();
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'Server not found' });
        try {
            const { name, color, description, image_url } = req.body;
            const updates = {};
            if (name !== undefined) updates.name = name;
            if (color !== undefined) updates.color = color;
            if (description !== undefined) updates.description = description;
            if (image_url !== undefined) updates.image_url = image_url;
            const panel = updatePanel(req.params.panelId, updates);
            if (!panel) return res.status(404).json({ error: 'Panel not found' });
            res.json({ success: true, panel });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Delete a panel
    app.delete('/api/server/:id/tickets/panels/:panelId', requireAuth, (req, res) => {
        const client = getClient();
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'Server not found' });
        try {
            deletePanel(req.params.panelId);
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Send a panel to a channel
    app.post('/api/server/:id/tickets/panels/:panelId/send', requireAuth, async (req, res) => {
        const client = getClient();
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'Server not found' });
        try {
            const { channelId } = req.body;
            const channel = guild.channels.cache.get(channelId);
            if (!channel) return res.status(400).json({ error: 'Channel not found' });
            const result = await sendTicketPanel(req.params.panelId, channel);
            if (result.error) return res.status(400).json({ error: result.error });
            res.json({ success: true, messageId: result.messageId });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Create a panel type
    app.post('/api/server/:id/tickets/panels/:panelId/types', requireAuth, (req, res) => {
        const client = getClient();
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'Server not found' });
        try {
            const { name, emoji, category_id, support_roles, welcome_message, ticket_name_format, questions } = req.body;
            const type = createPanelType(req.params.panelId, guild.id, name || 'Support', emoji || '🎫');
            const updates = {};
            if (category_id !== undefined) updates.category_id = category_id;
            if (support_roles !== undefined) updates.support_roles = support_roles;
            if (welcome_message !== undefined) updates.welcome_message = welcome_message;
            if (ticket_name_format !== undefined) updates.ticket_name_format = ticket_name_format;
            if (questions !== undefined) updates.questions = questions;
            if (Object.keys(updates).length > 0) updatePanelType(type.id, updates);
            res.json({ success: true, type });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Reorder panel types (receives array of type IDs in new order)
    // NOTE: must be registered BEFORE the /types/:typeId route or Express
    // will match 'reorder' as a typeId and return 404.
    app.put('/api/server/:id/tickets/panels/:panelId/types/reorder', requireAuth, (req, res) => {
        const client = getClient();
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'Server not found' });
        try {
            const { typeIds } = req.body;
            if (!Array.isArray(typeIds)) return res.status(400).json({ error: 'typeIds must be an array' });
            const db = getDb();
            const update = db.prepare('UPDATE ticket_panel_types SET sort_order = ? WHERE id = ? AND panel_id = ?');
            const tx = db.transaction(() => {
                typeIds.forEach((typeId, index) => {
                    update.run(index, typeId, req.params.panelId);
                });
            });
            tx();
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Update a panel type
    app.put('/api/server/:id/tickets/panels/:panelId/types/:typeId', requireAuth, (req, res) => {
        const client = getClient();
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'Server not found' });
        try {
            const updates = req.body;
            const type = updatePanelType(req.params.typeId, updates);
            if (!type) return res.status(404).json({ error: 'Type not found' });
            res.json({ success: true, type });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Delete a panel type
    app.delete('/api/server/:id/tickets/panels/:panelId/types/:typeId', requireAuth, (req, res) => {
        const client = getClient();
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'Server not found' });
        try {
            deletePanelType(req.params.typeId);
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Clone a panel (with all its types)
    app.post('/api/server/:id/tickets/panels/:panelId/clone', requireAuth, (req, res) => {
        const client = getClient();
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'Server not found' });
        try {
            const { clonePanel, getPanelTypes } = require('../../tickets');
            const newPanel = clonePanel(req.params.panelId);
            if (!newPanel) return res.status(404).json({ error: 'Panel not found' });
            const types = getPanelTypes(newPanel.id);
            res.json({ success: true, panel: { ...newPanel, types } });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    app.put('/api/server/:id/tickets/panels/:panelId/count', requireAuth, (req, res) => {
        const client = getClient();
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'Server not found' });
        try {
            const { count } = req.body;
            if (count === undefined || count < 0 || !Number.isInteger(count)) {
                return res.status(400).json({ error: 'Count must be a positive integer' });
            }
            const { setPanelTicketCounter } = require('../../tickets');
            setPanelTicketCounter(req.params.panelId, count);
            res.json({ success: true, count });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    app.put('/api/server/:id/tickets/panels/:panelId/config', requireAuth, (req, res) => {
        const client = getClient();
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'Server not found' });
        try {
            const { updatePanel } = require('../../tickets');
            const allowed = ['name', 'color', 'description', 'image_url'];
            const updates = {};
            for (const key of allowed) {
                if (req.body[key] !== undefined) updates[key] = req.body[key];
            }
            const result = updatePanel(req.params.panelId, updates);
            res.json({ success: true, panel: result });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
}

module.exports = { register };
