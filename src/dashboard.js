const express = require('express');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { formatUptime, formatNumber } = require('./helpers');
const { getBotConfig, getGuildConfig, updateGuildConfig, getWelcomeConfig, getGoodbyeConfig, updateWelcomeConfig } = require('./config');
const { getDb } = require('./db');
const { getGuildStats } = require('./stats');
const { getReactionRoles } = require('./reactionRoles');
const { getAllPermissions } = require('./permissions');
const { LOG_CATEGORIES, WS_STATUS } = require('./constants');
const { logError } = require('./logError');
const multer = require('multer');

// ──── Rate Limiter ────
const loginAttempts = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 10; // max attempts per window

function checkRateLimit(ip) {
    const now = Date.now();
    let entry = loginAttempts.get(ip);
    if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW) {
        entry = { count: 1, windowStart: now };
        loginAttempts.set(ip, entry);
        return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
    }
    entry.count++;
    if (entry.count > RATE_LIMIT_MAX) {
        return { allowed: false, remaining: 0 };
    }
    return { allowed: true, remaining: RATE_LIMIT_MAX - entry.count };
}

// Clean up old entries every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of loginAttempts.entries()) {
        if (now - entry.windowStart > RATE_LIMIT_WINDOW * 2) {
            loginAttempts.delete(ip);
        }
    }
}, 5 * 60 * 1000);

let client = null;
let dashboardPassword = '';

function setDashboardClient(c, password) {
    client = c;
    if (!password) {
        console.error('[Dashboard] DASHBOARD_PASSWORD is not set! Please set it in your .env file.');
    }
    dashboardPassword = password;
}

// ──── Dashboard Config (SQLite) ────
const DEFAULT_DASHBOARD_CONFIG = {
    accentColor: '#5865F2',
    title: 'Bot Dashboard',
    backgroundImage: null,
    backgroundType: 'none',
    backgroundBlur: 'md',
    showWidgets: {
        status: true, servers: true, reminders: true, quickActions: true,
        analytics: true, activity: true, system: true,
    },
    refreshInterval: 5,
    cardStyle: 'glass',
    backgroundStyle: 'dots',
    layoutDensity: 'normal',
    animationPreset: 'smooth',
    animationSpeed: 1,
    cardGlow: true,
    ambientLight: true,
    headerStyle: 'minimal',
    borderRadius: 'rounded',
    showDockLabels: true,
    botAvatarUrl: null,
};

function getDashboardConfig() {
    const db = getDb();
    const row = db.prepare('SELECT config FROM dash_config WHERE id = 1').get();
    if (!row) {
        // First load — use defaults
        db.prepare('INSERT OR REPLACE INTO dash_config (id, config) VALUES (1, ?)').run(JSON.stringify(DEFAULT_DASHBOARD_CONFIG));
        return { ...DEFAULT_DASHBOARD_CONFIG };
    }
    try {
        const saved = JSON.parse(row.config);
        return { ...DEFAULT_DASHBOARD_CONFIG, ...saved };
    } catch {
        return { ...DEFAULT_DASHBOARD_CONFIG };
    }
}

function updateDashboardConfig(partial) {
    const current = getDashboardConfig();
    const updated = { ...current, ...partial };
    const db = getDb();
    db.prepare('INSERT OR REPLACE INTO dash_config (id, config) VALUES (1, ?)').run(JSON.stringify(updated));
    return updated;
}

// ──── Dashboard Users (SQLite) ────
function getDashUsers() {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM dash_users WHERE active = 1').all();
    const result = {};
    for (const row of rows) {
        result[row.user_id] = {
            addedAt: row.added_at,
            addedBy: row.added_by,
            active: !!row.active,
            accessToken: row.access_token,
        };
    }
    return result;
}

function generateAccessToken() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let s = '';
    for (let i = 0; i < 24; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return 'dash_' + s;
}

function addDashUser(userId, addedBy) {
    const db = getDb();
    const token = generateAccessToken();
    db.prepare('INSERT OR REPLACE INTO dash_users (user_id, added_at, added_by, active, access_token) VALUES (?, ?, ?, 1, ?)')
        .run(userId, Date.now(), addedBy || 'unknown', token);
    return { users: getDashUsers(), accessToken: token };
}

function removeDashUser(userId) {
    if (!userId) return false;
    const db = getDb();
    const result = db.prepare('DELETE FROM dash_users WHERE user_id = ?').run(userId);
    const removed = result.changes > 0;
    if (!removed) return false;
    // Invalidate all active sessions for this user — clear every session type
    for (const [token, session] of sessions.entries()) {
        if (session.userId === userId) {
            sessions.delete(token);
        }
    }
    return true;
}

function isDashUser(userId, accessToken) {
    const db = getDb();
    const row = db.prepare('SELECT * FROM dash_users WHERE user_id = ? AND active = 1').get(userId);
    if (!row) return false;
    if (accessToken) {
        return row.access_token === accessToken;
    }
    return true;
}

// ──── Sessions ────
const sessions = new Map(); // token → { method: 'password'|'discord', userId?: string }
function generateSession() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let s = '';
    for (let i = 0; i < 32; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
}

// ──── File Upload Setup ────
const uploadsDir = process.env.UPLOADS_DIR || path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname) || '.jpg';
        cb(null, 'bg-' + Date.now() + ext);
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, allowed.includes(ext));
    }
});

function createDashboard() {
    const app = express();
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    app.use((req, res, next) => {
        const token = req.headers.cookie?.match(/session=([^;]+)/)?.[1];
        if (token && sessions.has(token)) {
            const session = sessions.get(token);
            // Re-verify Discord-logged-in users against the dash_users table
            if (session.method === 'discord' && session.userId) {
                if (!isDashUser(session.userId, session.accessToken)) {
                    sessions.delete(token);
                    req.authenticated = false;
                    return next();
                }
            }
            req.authenticated = true;
        } else {
            req.authenticated = false;
        }
        next();
    });

    // ── Auth (password OR Discord ID + Access Token) ──
    app.post('/api/login', (req, res) => {
        // Rate limiting by IP
        const ip = req.ip || req.connection.remoteAddress || 'unknown';
        const rateCheck = checkRateLimit(ip);
        if (!rateCheck.allowed) {
            console.warn('[Dashboard] Rate limit hit for IP:', ip);
            return res.status(429).json({ success: false, error: 'Too many attempts. Please wait a minute.' });
        }
        const { password, discordId, accessToken } = req.body;
        if (password && password === dashboardPassword) {
            const token = generateSession();
            sessions.set(token, { method: 'password' });
            return res.json({ success: true, token });
        }
        if (discordId && accessToken) {
            // Check if user exists but has no access token (legacy user)
            const users = getDashUsers();
            const existing = users[discordId];
            if (existing && existing.active && !existing.accessToken) {
                return res.status(401).json({ success: false, error: 'This user needs a new access token. Run /dashaccess remove ' + discordId + ' then /dashaccess add @user again.' });
            }
            if (isDashUser(discordId, accessToken)) {
                const token = generateSession();
                sessions.set(token, { method: 'discord', userId: discordId, accessToken });
                return res.json({ success: true, token, method: 'discord' });
            }
        }
        res.status(401).json({ success: false, error: 'Invalid credentials' });
    });

    app.post('/api/logout', (req, res) => {
        const token = req.headers.cookie?.match(/session=([^;]+)/)?.[1];
        if (token) sessions.delete(token);
        res.json({ success: true });
    });

    function requireAuth(req, res, next) {
        if (!req.authenticated) return res.status(401).json({ error: 'Not authenticated' });
        next();
    }

    // ── Dashboard Users API ──
    app.get('/api/dash/users', requireAuth, (req, res) => {
        res.json(getDashUsers());
    });
    app.post('/api/dash/users/add', requireAuth, (req, res) => {
        const { userId } = req.body;
        if (!userId) return res.status(400).json({ error: 'Missing userId' });
        addDashUser(userId, req.discordUserId || 'dashboard');
        res.json({ success: true, users: getDashUsers() });
    });
    app.post('/api/dash/users/remove', requireAuth, (req, res) => {
        const { userId } = req.body;
        removeDashUser(userId);
        res.json({ success: true, users: getDashUsers() });
    });

    // ── File Upload ──
    app.post('/api/upload', requireAuth, upload.single('background'), (req, res) => {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded or invalid type.' });
        res.json({ success: true, url: '/uploads/' + req.file.filename });
    });
    app.use('/uploads', express.static(uploadsDir));

    // ── Dashboard Config ──
    app.get('/api/dash/config', requireAuth, (req, res) => {
        res.json(getDashboardConfig());
    });
    app.post('/api/dash/config', requireAuth, (req, res) => {
        const updated = updateDashboardConfig(req.body);
        res.json({ success: true, config: updated });
    });

    // ── Bot Status ──
    app.get('/api/status', requireAuth, (req, res) => {
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
            version: require('../package.json').version || '1.0.0',
            brandName: process.env.BRAND_NAME || null,
        });
    });

    // ── Bot Customization ──
    app.post('/api/bot/name', requireAuth, (req, res) => {
        if (!client || !client.user) return res.status(503).json({ error: 'Bot not ready' });
        const { name } = req.body;
        if (!name || name.length > 32) return res.status(400).json({ error: 'Name must be 1-32 characters' });
        client.user.setUsername(name)
            .then(() => res.json({ success: true, username: client.user.tag }))
            .catch(err => res.status(400).json({ error: err.message }));
    });

    app.post('/api/bot/avatar', requireAuth, (req, res) => {
        if (!client || !client.user) return res.status(503).json({ error: 'Bot not ready' });
        const { url } = req.body;
        if (!url) return res.status(400).json({ error: 'Missing avatar URL' });
        client.user.setAvatar(url)
            .then(() => res.json({ success: true, avatar: client.user.displayAvatarURL({ size: 128 }) }))
            .catch(err => res.status(400).json({ error: err.message }));
    });

    app.post('/api/bot/presence', requireAuth, (req, res) => {
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

    // ── Servers List ──
    app.get('/api/servers', requireAuth, (req, res) => {
        if (!client) return res.json([]);
        const servers = client.guilds.cache.map(g => ({
            id: g.id, name: g.name,
            icon: g.iconURL({ size: 64 }) || '',
            memberCount: g.memberCount,
            boostTier: g.premiumTier,
            boostCount: g.premiumSubscriptionCount || 0,
            channels: g.channels.cache.size,
        })).sort((a, b) => b.memberCount - a.memberCount);
        res.json(servers);
    });

    // ── Server Management: Roles ──
    app.get('/api/server/:id/roles', requireAuth, (req, res) => {
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'Server not found' });
        const roles = guild.roles.cache
            .filter(r => r.name !== '@everyone')
            .sort((a, b) => b.position - a.position)
            .map(r => ({
                id: r.id,
                name: r.name,
                color: r.hexColor === '#000000' ? null : r.hexColor,
                position: r.position,
                memberCount: r.members.size,
                managed: r.managed,
                permissions: r.permissions.toArray().slice(0, 10),
            }));
        res.json(roles);
    });

    // ── Server Management: Channels ──
    app.get('/api/server/:id/channels', requireAuth, (req, res) => {
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'Server not found' });
        const typeNames = { 0: 'Text', 2: 'Voice', 4: 'Category', 5: 'Announcement', 15: 'Forum' };
        const channels = guild.channels.cache
            .filter(c => c.type !== 4) // exclude categories from flat list
            .sort((a, b) => a.position - b.position)
            .map(c => ({
                id: c.id,
                name: c.name,
                type: typeNames[c.type] || 'Unknown',
                typeId: c.type,
                parentId: c.parentId,
                position: c.position,
                topic: c.topic ? c.topic.slice(0, 80) : null,
                nsfw: c.nsfw || false,
                memberCount: c.type === 2 ? (c.members?.size || 0) : null,
                bitrate: c.type === 2 ? c.bitrate : null,
            }));
        res.json(channels);
    });

    // ── Server Management: Audit Log ──
    app.get('/api/server/:id/audit', requireAuth, async (req, res) => {
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'Server not found' });
        try {
            const auditLog = await guild.fetchAuditLogs({ limit: 25 });
            const entries = auditLog.entries.map(e => ({
                id: e.id,
                action: e.action,
                actionType: e.actionType,
                targetType: e.target?.constructor?.name || 'Unknown',
                targetId: e.target?.id || e.targetId || null,
                executorId: e.executor?.id || null,
                executorTag: e.executor?.tag || 'Unknown',
                executorAvatar: e.executor?.displayAvatarURL({ size: 32 }) || null,
                reason: e.reason || null,
                changes: e.changes?.slice(0, 5).map(c => ({ key: c.key, old: String(c.old ?? '').slice(0, 100), new: String(c.new ?? '').slice(0, 100) })) || [],
                createdTimestamp: e.createdTimestamp,
            }));
            res.json(entries);
        } catch (err) {
            res.status(500).json({ error: 'Failed to fetch audit log: ' + err.message });
        }
    });

    // ── Server Management: Update logging config (single category) ──
    app.post('/api/server/:id/log/config', requireAuth, (req, res) => {
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'Server not found' });
        const { category, channelId, enabled, trackedChannel, trackedChannels } = req.body;
        updateGuildConfig(guild.id, (cfg) => {
            if (category) {
                if (channelId !== undefined) cfg.logChannels[category] = channelId || null;
                if (enabled !== undefined) cfg.logCategories[category] = enabled;
            }
            if (trackedChannel !== undefined) {
                if (trackedChannels === 'set') {
                    cfg.trackedChannels = Array.isArray(trackedChannel) ? trackedChannel : [trackedChannel];
                } else if (trackedChannels === 'add') {
                    if (!cfg.trackedChannels.includes(trackedChannel)) cfg.trackedChannels.push(trackedChannel);
                } else if (trackedChannels === 'remove') {
                    cfg.trackedChannels = cfg.trackedChannels.filter(id => id !== trackedChannel);
                } else if (trackedChannels === 'clear') {
                    cfg.trackedChannels = [];
                }
            }
            return cfg;
        });
        res.json({ success: true });
    });

    // ── Server Management: Batch update logging config (save all at once) ──
    app.post('/api/server/:id/log/config/batch', requireAuth, (req, res) => {
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'Server not found' });
        const { categories } = req.body;
        if (Array.isArray(categories)) {
            updateGuildConfig(guild.id, (cfg) => {
                for (const cat of categories) {
                    if (cat.category) {
                        if (cat.channelId !== undefined) cfg.logChannels[cat.category] = cat.channelId || null;
                        if (cat.enabled !== undefined) cfg.logCategories[cat.category] = cat.enabled;
                    }
                }
                return cfg;
            });
        }
        res.json({ success: true });
    });

    // ── Update prefix ──
    app.post('/api/server/:id/prefix', requireAuth, (req, res) => {
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'Server not found' });
        const { prefix } = req.body;
        if (!prefix || prefix.length > 5) return res.status(400).json({ error: 'Prefix must be 1-5 characters' });
        updateGuildConfig(guild.id, (cfg) => { cfg.prefix = prefix; return cfg; });
        res.json({ success: true, prefix });
    });

    // ── Welcome/Goodbye Config ──
    app.get('/api/server/:id/greetings', requireAuth, (req, res) => {
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'Server not found' });
        res.json({
            welcome: getWelcomeConfig(guild.id),
            goodbye: getGoodbyeConfig(guild.id),
        });
    });

    app.post('/api/server/:id/greetings/:type', requireAuth, (req, res) => {
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'Server not found' });
        const type = req.params.type;
        if (type !== 'welcome' && type !== 'goodbye') return res.status(400).json({ error: 'Type must be welcome or goodbye' });
        
        updateWelcomeConfig(guild.id, type, (cfg) => {
            // Update only the fields that were sent
            const allowedFields = ['enabled', 'channelId', 'content', 'embedTitle', 'embedDescription', 'embedColor', 'embedFooter', 'embedFooterIcon', 'embedThumbnail', 'embedImage', 'embedAuthor', 'embedAuthorIcon'];
            for (const field of allowedFields) {
                if (req.body[field] !== undefined) {
                    cfg[field] = req.body[field];
                }
            }
            return cfg;
        });
        
        const result = type === 'welcome' ? getWelcomeConfig(guild.id) : getGoodbyeConfig(guild.id);
        res.json({ success: true, config: result });
    });

    // ── Server Detail ──
    app.get('/api/server/:id', requireAuth, (req, res) => {
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'Server not found' });
        const guildConfig = getGuildConfig(guild.id) || {};
        const logConfig = guildConfig.logChannels || {};
        const logCats = guildConfig.logCategories || {};
        const tracked = guildConfig.trackedChannels || [];
        const gStats = getGuildStats(guild.id);
        res.json({
            id: guild.id, name: guild.name,
            icon: guild.iconURL({ size: 128 }) || '',
            memberCount: guild.memberCount,
            boostTier: guild.premiumTier,
            boostCount: guild.premiumSubscriptionCount || 0,
            created: guild.createdTimestamp,
            roles: guild.roles.cache.size,
            channels: {
                text: guild.channels.cache.filter(c => c.type === 0).size,
                voice: guild.channels.cache.filter(c => c.type === 2).size,
                categories: guild.channels.cache.filter(c => c.type === 4).size,
                forums: guild.channels.cache.filter(c => c.type === 15).size,
            },
            prefix: guildConfig.prefix || ';',
            logging: {
                defaultChannel: guildConfig.logChannelId || null,
                perCategory: Object.fromEntries(LOG_CATEGORIES.map(c => [c, {
                    channel: logConfig[c] || null,
                    enabled: logCats[c] !== false,
                }])),
                trackedChannels: tracked,
            },
            stats: {
                totalJoins: gStats.totalJoins || 0,
                totalLeaves: gStats.totalLeaves || 0,
                snapshots: (gStats.dailySnapshots || []).slice(-30),
            },
            reactionRoles: getReactionRoles(guild.id),
            permissions: getAllPermissions(guild.id),
            ownerId: guild.ownerId,
        });
    });

    // ── Reminders ──
    app.get('/api/reminders', requireAuth, (req, res) => {
        try {
            const reminders = require('./reminders');
            const all = reminders.getAllPending();
            res.json(all.slice(0, 50).map(r => ({
                id: r.id, text: r.text.slice(0, 100),
                remindAt: r.remindAt, createdAt: r.createdAt, userId: r.userId,
            })));
        } catch { res.json([]); }
    });

    // ── Aggregate Stats ──
    app.get('/api/stats/aggregate', requireAuth, (req, res) => {
        if (!client) return res.json({});
        const totalJoins = client.guilds.cache.reduce((a, g) => a + (getGuildStats(g.id).totalJoins || 0), 0);
        const totalLeaves = client.guilds.cache.reduce((a, g) => a + (getGuildStats(g.id).totalLeaves || 0), 0);
        const allSnapshots = [];
        client.guilds.cache.forEach(g => {
            const s = getGuildStats(g.id);
            if (s.dailySnapshots) allSnapshots.push(...s.dailySnapshots);
        });
        const byDate = {};
        allSnapshots.forEach(s => {
            if (!byDate[s.date]) byDate[s.date] = { joins: 0, leaves: 0 };
            byDate[s.date].joins += s.joins;
            byDate[s.date].leaves += s.leaves;
        });
        const timeline = Object.entries(byDate)
            .sort(([a], [b]) => a.localeCompare(b))
            .slice(-30)
            .map(([date, d]) => ({ date, joins: d.joins, leaves: d.leaves, net: d.joins - d.leaves }));
        res.json({
            totalJoins, totalLeaves,
            netGrowth: totalJoins - totalLeaves,
            timeline,
            serverCount: client.guilds.cache.size,
            totalMembers: client.guilds.cache.reduce((a, g) => a + g.memberCount, 0),
        });
    });

    // ── Export Stats ──
    app.get('/api/stats/export', requireAuth, (req, res) => {
        if (!client) return res.json({});
        const exportData = {};
        client.guilds.cache.forEach(g => {
            const s = getGuildStats(g.id);
            exportData[g.id] = {
                name: g.name, memberCount: g.memberCount,
                totalJoins: s.totalJoins || 0, totalLeaves: s.totalLeaves || 0,
                dailySnapshots: (s.dailySnapshots || []).slice(-90),
            };
        });
        res.json({
            exportedAt: new Date().toISOString(),
            botName: client.user?.tag || 'Unknown',
            data: exportData,
        });
    });

    // ── Activity Feed ──
    app.get('/api/activity', requireAuth, (req, res) => {
        if (!client) return res.json([]);
        const recent = [];
        client.guilds.cache.forEach(g => {
            const s = getGuildStats(g.id);
            if (s.totalJoins > 0) recent.push({
                type: 'join', guildName: g.name, guildId: g.id,
                count: s.totalJoins, time: Date.now(),
            });
        });
        res.json(recent.slice(-30));
    });

    // ── System Info ──
    app.get('/api/system', requireAuth, (req, res) => {
        const mem = process.memoryUsage();
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        res.json({
            platform: os.platform(), release: os.release(), hostname: os.hostname(),
            cpuModel: os.cpus()[0]?.model || 'Unknown', cpuCores: os.cpus().length,
            cpuLoad: os.loadavg(),
            memoryTotal: (totalMem / 1024 / 1024 / 1024).toFixed(2),
            memoryFree: (freeMem / 1024 / 1024 / 1024).toFixed(2),
            memoryUsed: ((totalMem - freeMem) / 1024 / 1024 / 1024).toFixed(2),
            memoryUsage: ((totalMem - freeMem) / totalMem * 100).toFixed(1),
            rss: (mem.rss / 1024 / 1024).toFixed(1),
            heapUsed: (mem.heapUsed / 1024 / 1024).toFixed(1),
            heapTotal: (mem.heapTotal / 1024 / 1024).toFixed(1),
            nodeVersion: process.version,
            uptime: formatUptime(process.uptime() * 1000),
        });
    });

    // ── Commands Explorer ──
    const COMMANDS_DATA = [
        { category:'Info', owner:false, commands:[
            { name:'help', description:'Show all available commands or get help with a specific one', usage:'/help [command] [category]' },
            { name:'ping', description:"Check the bot's latency", usage:'/ping' },
            { name:'status', description:"Show the bot's status, resources, and stats", usage:'/status' },
            { name:'botinfo', description:'Show information about this bot', usage:'/botinfo' },
            { name:'userinfo', description:"Get info about a user", usage:'/userinfo [user]' },
            { name:'avatar', description:"Get a user's avatar", usage:'/avatar [user]' },
            { name:'stats', description:'View server statistics (server/growth)', usage:'/stats server|growth' },
        ]},
        { category:'Fun', owner:false, commands:[
            { name:'worldcup', description:'Predict a World Cup match score between two countries', usage:'/worldcup <team1> <team2>' },
            { name:'8ball', description:'Ask the magic 8-ball a question', usage:'/8ball <question>' },
            { name:'coinflip', description:'Flip a coin', usage:'/coinflip' },
            { name:'dice', description:'Roll a dice', usage:'/dice [sides]' },
            { name:'rps', description:'Play rock-paper-scissors', usage:'/rps <rock|paper|scissors>' },
            { name:'joke', description:'Get a random joke', usage:'/joke' },
            { name:'fact', description:'Get a random interesting fact', usage:'/fact' },
            { name:'advice', description:'Get a random piece of advice', usage:'/advice' },
            { name:'quote', description:'Get a random inspirational quote', usage:'/quote' },
            { name:'reverse', description:'Reverse some text', usage:'/reverse <text>' },
            { name:'mock', description:'Mock some text (Spongebob case)', usage:'/mock <text>' },
            { name:'random', description:'Generate a random number', usage:'/random <min> <max>' },
        ]},
        { category:'Reminders', owner:false, commands:[
            { name:'remindme', description:'Set a reminder (you will be DMed)', usage:'/remindme <time> <text>' },
            { name:'reminders', description:'Manage your reminders (list/cancel)', usage:'/reminders list|cancel' },
        ]},
        { category:'Admin', owner:true, commands:[
            { name:'role', description:'Manage roles (add/remove/list)', usage:'/role add|remove|list <user> [role]' },
            { name:'purge', description:'Bulk delete messages (1-100)', usage:'/purge <amount>' },
            { name:'slowmode', description:'Set channel slowmode (0-21600s)', usage:'/slowmode <seconds> [channel]' },
            { name:'nickname', description:"Change a user's nickname", usage:'/nickname <user> <nickname>' },
            { name:'say', description:'Make the bot say something', usage:'/say <channel> <message>' },
            { name:'embed', description:'Send an embedded message', usage:'/embed <channel> <title> [description] [color]' },
            { name:'deploy', description:'Re-register all slash commands', usage:'/deploy' },
            { name:'track', description:'Manage tracked channels (add/remove/list)', usage:'/track add|remove|list [channel]' },
            { name:'poll', description:'Create a poll', usage:'/poll <question> <opt1> <opt2> [opt3] [opt4]' },
            { name:'announce', description:'Send an announcement to a channel', usage:'/announce <channel> <title> <message>' },
        ]},
        { category:'Moderation', owner:true, commands:[
            { name:'kick', description:'Kick a member from the server', usage:'/kick <user> [reason]' },
            { name:'ban', description:'Ban a member from the server', usage:'/ban <user> [reason]' },
            { name:'unban', description:'Unban a user by their ID', usage:'/unban <user_id>' },
            { name:'timeout', description:'Timeout a member (60s-7d)', usage:'/timeout <user> <duration> [reason]' },
            { name:'untimeout', description:'Remove a timeout from a member', usage:'/untimeout <user>' },
            { name:'warn', description:'Warn a member', usage:'/warn <user> [reason]' },
            { name:'warnings', description:'View warnings for a member', usage:'/warnings <user>' },
            { name:'clearwarnings', description:'Clear all warnings for a member', usage:'/clearwarnings <user>' },
            { name:'lock', description:'Lock a channel', usage:'/lock [channel]' },
            { name:'unlock', description:'Unlock a channel', usage:'/unlock [channel]' },
            { name:'history', description:'View moderation history for a user', usage:'/history <user>' },
            { name:'case', description:'View details of a specific moderation case', usage:'/case <id>' },
            { name:'reason', description:'Update the reason for a moderation case', usage:'/reason <id> <text>' },
        ]},
        { category:'Config', owner:true, commands:[
            { name:'log', description:'Configure logging (channel/toggle/list)', usage:'/log channel|toggle|list' },
            { name:'embedconfig', description:'Configure embed appearance (footer/color/show)', usage:'/embedconfig footer|color|show' },
            { name:'presence', description:"Set the bot's activity status", usage:'/presence <type> <text>' },
            { name:'botavatar', description:"Change the bot's avatar", usage:'/botavatar <url>' },
            { name:'botname', description:"Change the bot's username", usage:'/botname <name>' },
            { name:'prefix', description:'View or change the command prefix', usage:'/prefix [new_prefix]' },
        ]},
        { category:'Permissions', owner:true, commands:[
            { name:'perm', description:'Manage user permissions for commands (grant/revoke/list/user)', usage:'/perm grant|revoke|list|user' },
        ]},
        { category:'Reaction Roles', owner:true, commands:[
            { name:'reactionrole', description:'Manage self-assignable reaction roles (add/remove/list)', usage:'/reactionrole add|remove|list' },
        ]},
        { category:'Welcome / Goodbye', owner:true, commands:[
            { name:'welcome', description:'Configure welcome messages (channel/toggle/message/title/description/color/footer/thumbnail/image/author/show/test/reset)', usage:'/welcome <subcommand> [options]' },
            { name:'goodbye', description:'Configure goodbye messages (same subcommands as welcome)', usage:'/goodbye <subcommand> [options]' },
        ]},
        { category:'Owner', owner:true, commands:[
            { name:'dashboard', description:'Get the link to the web dashboard', usage:'/dashboard' },
            { name:'dashaccess', description:'Manage who can access the dashboard (add/remove/list)', usage:'/dashaccess add|remove|list <user>' },
            { name:'server_leave', description:'Force the bot to leave a server by ID', usage:'/server_leave <server_id>' },
            { name:'shutdown', description:'Turn off the bot gracefully', usage:'/shutdown' },
        ]},
    ];

    app.get('/api/commands', requireAuth, (req, res) => {
        res.json(COMMANDS_DATA);
    });

    // ── SSE: Real-time events ──
    const sseClients = new Set();
    app.get('/api/events', requireAuth, (req, res) => {
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        });
        res.write('data: {"type":"connected"}\n\n');
        sseClients.add(res);
        req.on('close', () => sseClients.delete(res));
    });

    // Helper to broadcast events
    global.broadcastDashboard = function broadcastDashboard(type, data) {
        const msg = 'data: ' + JSON.stringify({ type: type, data: data, time: Date.now() }) + '\n\n';
        for (const client of sseClients) {
            try { client.write(msg); } catch { sseClients.delete(client); }
        }
    };

    // ── Server Insights: Message activity ──
    app.get('/api/insights/:id', requireAuth, (req, res) => {
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'Server not found' });
        const db = getDb();
        // Top users by message count
        const topUsers = db.prepare('SELECT user_id, SUM(message_count) as total FROM activity_counts WHERE guild_id = ? GROUP BY user_id ORDER BY total DESC LIMIT 10').all(guild.id);
        // Top channels by message count
        const topChannels = db.prepare('SELECT channel_id, SUM(message_count) as total FROM activity_counts WHERE guild_id = ? GROUP BY channel_id ORDER BY total DESC LIMIT 10').all(guild.id);
        // Total tracked messages
        const totalTracked = db.prepare('SELECT SUM(message_count) as total FROM activity_counts WHERE guild_id = ?').get(guild.id);
        res.json({
            guildId: guild.id,
            guildName: guild.name,
            topUsers: topUsers.map(u => ({
                userId: u.user_id,
                total: u.total,
                tag: guild.members.cache.get(u.user_id)?.user?.tag || u.user_id,
                avatar: guild.members.cache.get(u.user_id)?.user?.displayAvatarURL({ size: 32 }) || null,
            })),
            topChannels: topChannels.map(c => ({
                channelId: c.channel_id,
                total: c.total,
                name: guild.channels.cache.get(c.channel_id)?.name || c.channel_id,
            })),
            totalTracked: totalTracked?.total || 0,
        });
    });

    // ── Message Search ──
    app.get('/api/server/:id/messages', requireAuth, (req, res) => {
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'Server not found' });
        const db = getDb();
        const limit = Math.min(parseInt(req.query.limit) || 50, 200);
        const action = req.query.action || null;
        const search = req.query.q || null;
        let rows;
        if (search) {
            rows = db.prepare('SELECT * FROM message_log WHERE guild_id = ? AND content LIKE ? ORDER BY logged_at DESC LIMIT ?').all(guild.id, '%' + search + '%', limit);
        } else if (action) {
            rows = db.prepare('SELECT * FROM message_log WHERE guild_id = ? AND action = ? ORDER BY logged_at DESC LIMIT ?').all(guild.id, action, limit);
        } else {
            rows = db.prepare('SELECT * FROM message_log WHERE guild_id = ? ORDER BY logged_at DESC LIMIT ?').all(guild.id, limit);
        }
        res.json(rows.map(r => ({
            id: r.id,
            messageId: r.message_id,
            channelId: r.channel_id,
            channelName: guild.channels.cache.get(r.channel_id)?.name || r.channel_id,
            authorId: r.author_id,
            authorTag: r.author_tag,
            content: r.content,
            action: r.action,
            attachments: r.attachments ? JSON.parse(r.attachments) : null,
            loggedAt: r.logged_at,
        })));
    });

    // ── Serve Frontend ──
    app.get('/', (req, res) => {
        if (!req.authenticated) return res.redirect('/login');
        res.sendFile(path.join(__dirname, 'dashboard', 'index.html'));
    });
    app.get('/login', (req, res) => {
        if (req.authenticated) return res.redirect('/');
        res.sendFile(path.join(__dirname, 'dashboard', 'login.html'));
    });
    app.use('/static', express.static(path.join(__dirname, 'dashboard')));

    return app;
}

module.exports = { createDashboard, setDashboardClient, addDashUser, removeDashUser, getDashUsers };
