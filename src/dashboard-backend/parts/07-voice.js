// ──────────────────── Part 07: Voice ────────────────────
// Voice presence control and temp (join-to-create) voice channels.

const { getPresence, joinChannel, moveChannel, leaveChannel, setStatusText, restoreAllPresences } = require('../../voicePresence');
const {
    getConfig: getTempVoiceConfig, setConfig: setTempVoiceConfig,
    getTriggers, setTrigger, removeTrigger, getSpawned,
    registerPanel, unregisterPanel, updatePanels, cleanupOrphans,
    DEFAULT_TEMPLATE,
} = require('../../tempVoice');
const { logError } = require('../../logError');
const { getClient } = require('../core');

function register(app, ctx) {
    const { requireAuth } = ctx;

    // ── Voice Presence API ──
    app.get('/api/server/:id/voice-presence', requireAuth, (req, res) => {
        const client = getClient();
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'Server not found' });
        try {
            const presence = getPresence(guild.id);
            const channels = guild.channels.cache
                .filter(c => c.type === 2)
                .sort((a, b) => a.position - b.position)
                .map(c => ({ id: c.id, name: c.name }));
            res.json({ presence, channels });
        } catch { res.json({ presence: null, channels: [] }); }
    });

    app.post('/api/server/:id/voice-presence/join', requireAuth, async (req, res) => {
        const client = getClient();
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'Server not found' });
        const { channelId, status } = req.body;
        if (!channelId) return res.status(400).json({ error: 'Missing channelId' });
        try {
            const channel = guild.channels.cache.get(channelId);
            if (!channel || channel.type !== 2) return res.status(400).json({ error: 'Invalid voice channel' });
            if (!guild.members.me) return res.status(503).json({ error: 'Bot member not loaded' });
            await joinChannel(guild, channel, status || null);
            res.json({ success: true, presence: getPresence(guild.id) });
        } catch (err) {
            logError(err, 'dashboard', 'voice_presence_join');
            res.status(500).json({ error: err.message });
        }
    });

    app.post('/api/server/:id/voice-presence/move', requireAuth, async (req, res) => {
        const client = getClient();
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'Server not found' });
        const { channelId, status } = req.body;
        if (!channelId) return res.status(400).json({ error: 'Missing channelId' });
        try {
            const channel = guild.channels.cache.get(channelId);
            if (!channel || channel.type !== 2) return res.status(400).json({ error: 'Invalid voice channel' });
            const presence = getPresence(guild.id);
            if (!presence) return res.status(400).json({ error: 'Bot is not in a voice channel. Use join first.' });
            await moveChannel(guild, channel, status || presence.status);
            res.json({ success: true, presence: getPresence(guild.id) });
        } catch (err) {
            logError(err, 'dashboard', 'voice_presence_move');
            res.status(500).json({ error: err.message });
        }
    });

    app.post('/api/server/:id/voice-presence/leave', requireAuth, async (req, res) => {
        const client = getClient();
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'Server not found' });
        try {
            await leaveChannel(guild);
            res.json({ success: true, presence: null });
        } catch (err) {
            logError(err, 'dashboard', 'voice_presence_leave');
            res.status(500).json({ error: err.message });
        }
    });

    app.post('/api/server/:id/voice-presence/status', requireAuth, async (req, res) => {
        const client = getClient();
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'Server not found' });
        const { status } = req.body;
        try {
            const clean = await setStatusText(guild, status || '');
            res.json({ success: true, status: clean, presence: getPresence(guild.id) });
        } catch (err) {
            logError(err, 'dashboard', 'voice_presence_status');
            res.status(500).json({ error: err.message });
        }
    });

    app.post('/api/server/:id/voice-presence/restore', requireAuth, async (req, res) => {
        const client = getClient();
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'Server not found' });
        try {
            await restoreAllPresences(client);
            res.json({ success: true });
        } catch (err) {
            logError(err, 'dashboard', 'voice_presence_restore');
            res.status(500).json({ error: err.message });
        }
    });

    // ── Temp Voice Channels API ──
    app.get('/api/server/:id/temp-voice', requireAuth, (req, res) => {
        const client = getClient();
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'Server not found' });
        try {
            const config = getTempVoiceConfig(guild.id);
            const triggers = getTriggers(guild.id);
            const spawned = getSpawned(guild.id);
            const channels = guild.channels.cache
                .filter(c => c.type === 2 || c.type === 4)
                .sort((a, b) => a.position - b.position)
                .map(c => ({ id: c.id, name: c.name, type: c.type }));
            res.json({ config, triggers, spawned, channels });
        } catch { res.json({ config: { name_template: DEFAULT_TEMPLATE }, triggers: [], spawned: [], channels: [] }); }
    });

    app.post('/api/server/:id/temp-voice/triggers', requireAuth, async (req, res) => {
        const client = getClient();
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'Server not found' });
        const { channelId, categoryId } = req.body;
        if (!channelId) return res.status(400).json({ error: 'Missing channelId' });
        try {
            const channel = guild.channels.cache.get(channelId);
            if (!channel || channel.type !== 2) return res.status(400).json({ error: 'Invalid voice channel' });
            setTrigger(guild.id, channelId, categoryId || null);
            res.json({ success: true, triggers: getTriggers(guild.id) });
        } catch (err) {
            logError(err, 'dashboard', 'tempvoice_add_trigger');
            res.status(500).json({ error: err.message });
        }
    });

    app.delete('/api/server/:id/temp-voice/triggers', requireAuth, async (req, res) => {
        const client = getClient();
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'Server not found' });
        const { channelId } = req.body;
        if (!channelId) return res.status(400).json({ error: 'Missing channelId' });
        try {
            removeTrigger(guild.id, channelId);
            res.json({ success: true, triggers: getTriggers(guild.id) });
        } catch (err) {
            logError(err, 'dashboard', 'tempvoice_remove_trigger');
            res.status(500).json({ error: err.message });
        }
    });

    app.post('/api/server/:id/temp-voice/config', requireAuth, async (req, res) => {
        const client = getClient();
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'Server not found' });
        const { nameTemplate } = req.body;
        if (!nameTemplate) return res.status(400).json({ error: 'Missing nameTemplate' });
        try {
            setTempVoiceConfig(guild.id, nameTemplate);
            res.json({ success: true, config: getTempVoiceConfig(guild.id) });
        } catch (err) {
            logError(err, 'dashboard', 'tempvoice_config');
            res.status(500).json({ error: err.message });
        }
    });

    app.post('/api/server/:id/temp-voice/panels', requireAuth, async (req, res) => {
        const client = getClient();
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'Server not found' });
        const { channelId } = req.body;
        if (!channelId) return res.status(400).json({ error: 'Missing channelId' });
        try {
            const channel = guild.channels.cache.get(channelId);
            if (!channel || !channel.isTextBased()) return res.status(400).json({ error: 'Invalid text channel' });
            const panel = registerPanel(guild.id, channelId);
            res.json({ success: true, panel });
        } catch (err) {
            logError(err, 'dashboard', 'tempvoice_panel_register');
            res.status(500).json({ error: err.message });
        }
    });

    app.delete('/api/server/:id/temp-voice/panels', requireAuth, async (req, res) => {
        const client = getClient();
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'Server not found' });
        const { channelId } = req.body;
        if (!channelId) return res.status(400).json({ error: 'Missing channelId' });
        try {
            unregisterPanel(guild.id, channelId);
            res.json({ success: true });
        } catch (err) {
            logError(err, 'dashboard', 'tempvoice_panel_unregister');
            res.status(500).json({ error: err.message });
        }
    });

    app.post('/api/server/:id/temp-voice/panels/refresh', requireAuth, async (req, res) => {
        const client = getClient();
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'Server not found' });
        try {
            await updatePanels(guild);
            res.json({ success: true });
        } catch (err) {
            logError(err, 'dashboard', 'tempvoice_panel_refresh');
            res.status(500).json({ error: err.message });
        }
    });

    app.post('/api/server/:id/temp-voice/cleanup', requireAuth, async (req, res) => {
        const client = getClient();
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'Server not found' });
        try {
            cleanupOrphans(guild);
            res.json({ success: true });
        } catch (err) {
            logError(err, 'dashboard', 'tempvoice_cleanup');
            res.status(500).json({ error: err.message });
        }
    });
}

module.exports = { register };
