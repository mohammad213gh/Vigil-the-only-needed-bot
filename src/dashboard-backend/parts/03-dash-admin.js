// ──────────────────── Part 03: Dashboard admin & bot customization ────────────────────
// Dash-user management, guild scopes, background uploads, the dashboard
// config store, bot status, and bot name/avatar/presence customization.

const os = require('os');
const { getDb } = require('../../db');
const {
    getClient, upload, uploadsDir,
    getDashUsers, addDashUser, removeDashUser,
    getDashboardConfig, updateDashboardConfig,
} = require('../core');
const { formatUptime, formatNumber } = require('../../helpers');
const { WS_STATUS } = require('../../constants');

function register(app, ctx) {
    const { requireAuth, requireOwner, checkOwner } = ctx;

    // ── Dashboard Users API ──
    // Managing dashboard users grants access to the bot admin panel, so these
    // routes are owner-only (password session or OWNER_ID).
    app.get('/api/dash/users', requireAuth, (req, res) => {
        if (!checkOwner(req)) return res.status(403).json({ error: 'Only the bot owner can manage dashboard users' });
        res.json(getDashUsers());
    });
    app.post('/api/dash/users/add', requireAuth, (req, res) => {
        if (!checkOwner(req)) return res.status(403).json({ error: 'Only the bot owner can manage dashboard users' });
        const { userId } = req.body;
        if (!userId || !/^\d{5,25}$/.test(String(userId))) return res.status(400).json({ error: 'A valid Discord user ID is required' });
        addDashUser(userId, req.discordUserId || 'dashboard');
        res.json({ success: true, users: getDashUsers() });
    });
    app.post('/api/dash/users/remove', requireAuth, (req, res) => {
        if (!checkOwner(req)) return res.status(403).json({ error: 'Only the bot owner can manage dashboard users' });
        const { userId } = req.body;
        removeDashUser(userId);
        res.json({ success: true, users: getDashUsers() });
    });

    // Guild scope management for a dash user. Owner-only. Empty list = the
    // user can see no servers.
    app.get('/api/dash/users/guilds', requireAuth, requireOwner, (req, res) => {
        const userId = String(req.query.userId || '');
        if (!/^\d{5,25}$/.test(userId)) return res.status(400).json({ error: 'Invalid userId' });
        const db = getDb();
        res.json(db.prepare('SELECT guild_id FROM dash_user_guilds WHERE user_id = ?').all(userId).map(r => r.guild_id));
    });

    app.post('/api/dash/users/guilds', requireAuth, requireOwner, (req, res) => {
        const { userId, guildIds } = req.body || {};
        if (!userId || !/^\d{5,25}$/.test(String(userId))) return res.status(400).json({ error: 'Invalid userId' });
        if (!Array.isArray(guildIds) || guildIds.some(g => !/^\d{5,25}$/.test(String(g)))) {
            return res.status(400).json({ error: 'guildIds must be an array of server IDs' });
        }
        const db = getDb();
        const tx = db.transaction(() => {
            db.prepare('DELETE FROM dash_user_guilds WHERE user_id = ?').run(String(userId));
            const ins = db.prepare('INSERT OR IGNORE INTO dash_user_guilds (user_id, guild_id, granted_at) VALUES (?, ?, ?)');
            for (const g of guildIds) ins.run(String(userId), String(g), Date.now());
        });
        tx();
        res.json({ success: true });
    });

    // ── File Upload ──
    app.post('/api/upload', requireAuth, requireOwner, upload.single('background'), (req, res) => {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded or invalid type.' });
        res.json({ success: true, url: '/uploads/' + req.file.filename });
    });
    app.use('/uploads', require('express').static(uploadsDir));

    // ── Dashboard Config ──
    app.get('/api/dash/config', requireAuth, requireOwner, (req, res) => {
        res.json(getDashboardConfig());
    });
    app.post('/api/dash/config', requireAuth, requireOwner, (req, res) => {
        const updated = updateDashboardConfig(req.body);
        res.json({ success: true, config: updated });
    });

    // ── Bot Status ──
    app.get('/api/status', requireAuth, (req, res) => {
        const client = getClient();
        if (!client || !client.user) return res.json({ online: false });
        const guildCount = client.guilds.cache.size;
        const userCount = client.guilds.cache.reduce((a, g) => a + g.memberCount, 0);
        const mem = process.memoryUsage();
        res.json({
            online: true,
            username: client.user.tag,
            userId: client.user.id,
            avatar: client.user.displayAvatarURL({ size: 128 }),
            ping: client.ws.ping,
            status: WS_STATUS[client.ws.status] || 'Unknown',
            uptime: formatUptime(client.uptime),
            uptimeRaw: client.uptime,
            servers: guildCount,
            users: formatNumber(userCount),
            memory: (mem.rss / 1024 / 1024).toFixed(1),
            heapUsed: (mem.heapUsed / 1024 / 1024).toFixed(1),
            heapTotal: (mem.heapTotal / 1024 / 1024).toFixed(1),
            nodeVersion: process.version,
            platform: os.platform(),
            cpuCores: os.cpus().length,
            cpuModel: os.cpus()[0]?.model || 'Unknown',
            hostname: os.hostname(),
            version: require('../../../package.json').version || '1.0.0',
            brandName: process.env.BRAND_NAME || null,
        });
    });

    // ── Bot Customization ──
    app.post('/api/bot/name', requireAuth, requireOwner, (req, res) => {
        const client = getClient();
        if (!client || !client.user) return res.status(503).json({ error: 'Bot not ready' });
        const { name } = req.body;
        if (!name || name.length > 32) return res.status(400).json({ error: 'Name must be 1-32 characters' });
        client.user.setUsername(name)
            .then(() => res.json({ success: true, username: client.user.tag }))
            .catch(err => res.status(400).json({ error: err.message }));
    });

    app.post('/api/bot/avatar', requireAuth, requireOwner, (req, res) => {
        const client = getClient();
        if (!client || !client.user) return res.status(503).json({ error: 'Bot not ready' });
        const { url } = req.body;
        if (!url) return res.status(400).json({ error: 'Missing avatar URL' });
        client.user.setAvatar(url)
            .then(() => res.json({ success: true, avatar: client.user.displayAvatarURL({ size: 128 }) }))
            .catch(err => res.status(400).json({ error: err.message }));
    });

    app.post('/api/bot/presence', requireAuth, requireOwner, (req, res) => {
        const client = getClient();
        if (!client || !client.user) return res.status(503).json({ error: 'Bot not ready' });
        const { type, text } = req.body;
        const activityTypes = { playing: 0, watching: 3, listening: 2, competing: 5 };
        if (!type || !text) return res.status(400).json({ error: 'Missing type or text' });
        try {
            client.user.setPresence({
                activities: [{ name: text, type: activityTypes[type] || 0 }],
                status: 'online',
            });
            res.json({ success: true });
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    });
}

module.exports = { register };
