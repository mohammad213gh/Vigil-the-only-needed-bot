// ──────────────────── Part 08: Auto-Mod ────────────────────
// Auto-moderation rules, word/link filters, channel whitelisting, and
// config import/export.

const {
    RULE_TYPES: AM_RULES,
    getAutoModRules,
    updateAutoModRule,
    getAutoModFilters,
    addAutoModFilter,
    removeAutoModFilter,
    getAutoModConfig,
    updateAutoModConfig,
    exportAutoModConfig,
    importAutoModConfig,
    bulkAddFilters,
} = require('../../automod');
const { getClient } = require('../core');

function register(app, ctx) {
    const { requireAuth } = ctx;

    // Get full auto-mod config for a server
    app.get('/api/server/:id/automod', requireAuth, (req, res) => {
        const client = getClient();
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'Server not found' });
        try {
            const rules = getAutoModRules(guild.id);
            const wordFilters = getAutoModFilters(guild.id, 'words');
            const linkFilters = getAutoModFilters(guild.id, 'links');
            const config = getAutoModConfig(guild.id);
            // Get all text channels for the channel picker
            const channels = guild.channels.cache
                .filter(c => c.type === 0 || c.type === 5)
                .sort((a, b) => a.position - b.position)
                .map(c => ({ id: c.id, name: c.name, parentName: c.parent?.name || null }));
            // Get all roles for the role whitelist
            const roles = guild.roles.cache
                .filter(r => r.name !== '@everyone' && !r.managed)
                .sort((a, b) => b.position - a.position)
                .map(r => ({ id: r.id, name: r.name, color: r.hexColor === '#000000' ? null : r.hexColor }));
            res.json({
                guildId: guild.id,
                guildName: guild.name,
                rules: AM_RULES.reduce((acc, rt) => {
                    acc[rt] = rules[rt] || { enabled: false, threshold: 5, time_window: 10, action: 'warn', duration: null };
                    return acc;
                }, {}),
                filters: {
                    words: wordFilters.map(f => ({ pattern: f.pattern, action: f.action })),
                    links: linkFilters.map(f => ({ pattern: f.pattern, action: f.action })),
                },
                channelSettings: {
                    includedChannels: config.includedChannels,
                    excludedChannels: config.excludedChannels,
                    whitelistedRoles: config.whitelistedRoles,
                },
                channels,
                roles,
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Save a single rule
    app.post('/api/server/:id/automod/rules', requireAuth, (req, res) => {
        const client = getClient();
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'Server not found' });
        const { ruleType, config } = req.body;
        if (!ruleType || !config) return res.status(400).json({ error: 'Missing ruleType or config' });
        try {
            updateAutoModRule(guild.id, ruleType, config);
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Add a filter (word or link)
    app.post('/api/server/:id/automod/filters', requireAuth, (req, res) => {
        const client = getClient();
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'Server not found' });
        const { filterType, pattern, action } = req.body;
        if (!filterType || !pattern) return res.status(400).json({ error: 'Missing filterType or pattern' });
        try {
            addAutoModFilter(guild.id, filterType, pattern, action || 'delete');
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Remove a filter
    app.delete('/api/server/:id/automod/filters', requireAuth, (req, res) => {
        const client = getClient();
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'Server not found' });
        const { filterType, pattern } = req.body;
        if (!filterType || !pattern) return res.status(400).json({ error: 'Missing filterType or pattern' });
        try {
            removeAutoModFilter(guild.id, filterType, pattern);
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Bulk import filters (from comma-separated or JSON)
    app.post('/api/server/:id/automod/filters/batch', requireAuth, (req, res) => {
        const client = getClient();
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'Server not found' });
        const { filterType, patterns } = req.body;
        if (!filterType || !patterns) return res.status(400).json({ error: 'Missing filterType or patterns' });
        try {
            const added = bulkAddFilters(guild.id, filterType, patterns);
            res.json({ success: true, added: added.length });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Update channel settings (included/excluded channels, whitelisted roles)
    app.post('/api/server/:id/automod/channels', requireAuth, (req, res) => {
        const client = getClient();
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'Server not found' });
        const { includedChannels, excludedChannels, whitelistedRoles } = req.body;
        try {
            const updates = {};
            if (includedChannels !== undefined) updates.includedChannels = includedChannels;
            if (excludedChannels !== undefined) updates.excludedChannels = excludedChannels;
            if (whitelistedRoles !== undefined) updates.whitelistedRoles = whitelistedRoles;
            const result = updateAutoModConfig(guild.id, updates);
            res.json({ success: true, channelSettings: result });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Export auto-mod config as JSON
    app.get('/api/server/:id/automod/export', requireAuth, (req, res) => {
        const client = getClient();
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'Server not found' });
        try {
            const data = exportAutoModConfig(guild.id);
            res.json(data);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Import auto-mod config from JSON
    app.post('/api/server/:id/automod/import', requireAuth, (req, res) => {
        const client = getClient();
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'Server not found' });
        const data = req.body;
        if (!data || !data.rules) return res.status(400).json({ error: 'Invalid import data — missing rules' });
        try {
            const result = importAutoModConfig(guild.id, data);
            res.json(result);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
}

module.exports = { register };
