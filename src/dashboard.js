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
const sessions = new Map(); // token → { method: 'password'|'discord', userId?: string, accessToken?: string, expiresAt: number }

// Session lifetime — default 24h of inactivity (sliding renewal on each request).
// Override with DASHBOARD_SESSION_HOURS env var.
const SESSION_TTL_MS = (parseFloat(process.env.DASHBOARD_SESSION_HOURS) || 24) * 60 * 60 * 1000;

// Absolute cap — a session can never live longer than this, even with constant
// activity, so a stolen token can't be kept alive indefinitely by any traffic.
// Default 7 days. Override with DASHBOARD_SESSION_MAX_DAYS env var.
const SESSION_MAX_MS = Math.max(1, parseFloat(process.env.DASHBOARD_SESSION_MAX_DAYS) || 7) * 24 * 60 * 60 * 1000;

function generateSession() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let s = '';
    for (let i = 0; i < 32; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
}

// Reap expired sessions every 10 minutes so the Map doesn't grow unbounded.
setInterval(() => {
    const now = Date.now();
    for (const [token, session] of sessions.entries()) {
        const pastMax = session.createdAt && now > session.createdAt + SESSION_MAX_MS;
        if (!session.expiresAt || now > session.expiresAt || pastMax) {
            sessions.delete(token);
        }
    }
}, 10 * 60 * 1000);

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
            // Expired session (idle TTL or absolute max) — drop and treat as unauthenticated
            const pastMax = session.createdAt && Date.now() > session.createdAt + SESSION_MAX_MS;
            if (!session.expiresAt || Date.now() > session.expiresAt || pastMax) {
                sessions.delete(token);
                req.authenticated = false;
                return next();
            }
            // Re-verify Discord-logged-in users against the dash_users table
            if (session.method === 'discord' && session.userId) {
                if (!isDashUser(session.userId, session.accessToken)) {
                    sessions.delete(token);
                    req.authenticated = false;
                    return next();
                }
            }
            // Sliding renewal — reset the expiry on every authenticated request
            session.expiresAt = Date.now() + SESSION_TTL_MS;
            req.discordUserId = session.userId || null;
            req.sessionMethod = session.method;
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
        const now = Date.now();
        const expiresAt = now + SESSION_TTL_MS;
        if (password && password === dashboardPassword) {
            const token = generateSession();
            sessions.set(token, { method: 'password', expiresAt, createdAt: now });
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
                sessions.set(token, { method: 'discord', userId: discordId, accessToken, expiresAt, createdAt: now });
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
    // Managing dashboard users grants access to the bot admin panel, so these
    // routes are owner-only (password session or OWNER_ID). checkOwner is a
    // hoisted function declaration defined further down in this scope.
    app.get('/api/dash/users', requireAuth, (req, res) => {
        if (!checkOwner(req)) return res.status(403).json({ error: 'Only the bot owner can manage dashboard users' });
        res.json(getDashUsers());
    });
    app.post('/api/dash/users/add', requireAuth, (req, res) => {
        if (!checkOwner(req)) return res.status(403).json({ error: 'Only the bot owner can manage dashboard users' });
        const { userId } = req.body;
        if (!userId) return res.status(400).json({ error: 'Missing userId' });
        addDashUser(userId, req.discordUserId || 'dashboard');
        res.json({ success: true, users: getDashUsers() });
    });
    app.post('/api/dash/users/remove', requireAuth, (req, res) => {
        if (!checkOwner(req)) return res.status(403).json({ error: 'Only the bot owner can manage dashboard users' });
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

    // ── Mod Actions: Member search ──
    app.get('/api/server/:id/members', requireAuth, (req, res) => {
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'Server not found' });
        const q = (req.query.q || '').toLowerCase();
        const members = guild.members.cache.filter(m => {
            return !m.user.bot && (
                m.user.username.toLowerCase().includes(q) ||
                m.displayName.toLowerCase().includes(q) ||
                m.user.id === q
            );
        }).sort((a, b) => a.displayName.localeCompare(b.displayName))
        .map(m => ({
            id: m.user.id,
            tag: m.user.tag,
            username: m.user.username,
            displayName: m.displayName,
            avatar: m.user.displayAvatarURL({ size: 32 }),
            joinedTimestamp: m.joinedTimestamp,
        })).slice(0, 25);
        res.json(members);
    });

    // ── Mod Actions API ──
    function checkOwner(req, res) {
        // For password-authenticated sessions, allow mod actions
        // For Discord-authenticated sessions, check if the user is the bot owner
        const token = req.headers.cookie?.match(/session=([^;]+)/)?.[1];
        if (!token || !sessions.has(token)) return false;
        const session = sessions.get(token);
        if (session.method === 'password') return true; // password = full access
        if (session.method === 'discord' && session.userId === process.env.OWNER_ID) return true;
        return false;
    }

    function getSessionUser(req) {
        const token = req.headers.cookie?.match(/session=([^;]+)/)?.[1];
        if (!token || !sessions.has(token)) return 'unknown';
        const session = sessions.get(token);
        return session.userId || process.env.OWNER_ID || 'dashboard';
    }

    app.post('/api/server/:id/mod/warn', requireAuth, async (req, res) => {
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        if (!checkOwner(req)) return res.status(403).json({ error: 'Only the bot owner can perform mod actions' });
        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'Server not found' });
        const { userId, reason } = req.body;
        if (!userId || !reason) return res.status(400).json({ error: 'Missing userId or reason' });

        try {
            const { addWarning } = require('./warnings');
            const { createCase } = require('./modCases');
            const sessionUser = getSessionUser(req);
            const warnings = addWarning(guild.id, userId, 'Dashboard (' + sessionUser + ')', reason);
            createCase(guild.id, userId, sessionUser, 'Dashboard', 'warn', reason);
            res.json({ success: true, warningCount: warnings.length });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    app.post('/api/server/:id/mod/kick', requireAuth, async (req, res) => {
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        if (!checkOwner(req)) return res.status(403).json({ error: 'Only the bot owner can perform mod actions' });
        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'Server not found' });
        const { userId, reason } = req.body;
        if (!userId || !reason) return res.status(400).json({ error: 'Missing userId or reason' });

        try {
            const member = await guild.members.fetch(userId).catch(() => null);
            if (!member) return res.status(404).json({ error: 'Member not found in this server' });
            if (!member.kickable) return res.status(403).json({ error: 'Cannot kick this user - role hierarchy prevents it' });

            await member.kick('[Dashboard] ' + reason);
            const { createCase } = require('./modCases');
            createCase(guild.id, userId, process.env.OWNER_ID || 'dashboard', 'Dashboard', 'kick', reason);
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    app.post('/api/server/:id/mod/ban', requireAuth, async (req, res) => {
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        if (!checkOwner(req)) return res.status(403).json({ error: 'Only the bot owner can perform mod actions' });
        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'Server not found' });
        const { userId, reason, deleteMessages } = req.body;
        if (!userId || !reason) return res.status(400).json({ error: 'Missing userId or reason' });

        try {
            const deleteSeconds = deleteMessages === '24hours' ? 86400 : (deleteMessages === '6hours' ? 21600 : (deleteMessages === 'hour' ? 3600 : 0));
            await guild.bans.create(userId, { reason: '[Dashboard] ' + reason, deleteMessageSeconds: deleteSeconds });
            const { createCase } = require('./modCases');
            createCase(guild.id, userId, process.env.OWNER_ID || 'dashboard', 'Dashboard', 'ban', reason);
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    app.post('/api/server/:id/mod/timeout', requireAuth, async (req, res) => {
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        if (!checkOwner(req)) return res.status(403).json({ error: 'Only the bot owner can perform mod actions' });
        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'Server not found' });
        const { userId, duration, reason } = req.body;
        if (!userId || !duration || !reason) return res.status(400).json({ error: 'Missing userId, duration, or reason' });

        try {
            const member = await guild.members.fetch(userId).catch(() => null);
            if (!member) return res.status(404).json({ error: 'Member not found in this server' });
            if (!member.moderatable) return res.status(403).json({ error: 'Cannot timeout this user' });

            const durationMap = { '60s': 60000, '5m': 300000, '10m': 600000, '1h': 3600000, '6h': 21600000, '24h': 86400000, '3d': 259200000, '7d': 604800000 };
            const ms = durationMap[duration];
            if (!ms) return res.status(400).json({ error: 'Invalid duration' });

            await member.timeout(ms, '[Dashboard] ' + reason);
            const { createCase } = require('./modCases');
            createCase(guild.id, userId, process.env.OWNER_ID || 'dashboard', 'Dashboard', 'timeout', reason);
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // ── Staff Notes API ──
    app.get('/api/server/:id/notes', requireAuth, (req, res) => {
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'Server not found' });
        const { getGuildNotesForDashboard } = require('./staffNotes');
        const notes = getGuildNotesForDashboard(guild.id);
        res.json(notes.map(n => ({
            id: n.id,
            targetUserId: n.target_user_id,
            targetTag: guild.members.cache.get(n.target_user_id)?.user?.tag || n.target_user_id,
            authorTag: n.author_tag,
            note: n.note,
            createdAt: n.created_at,
            updatedAt: n.updated_at,
        })));
    });

    app.post('/api/server/:id/notes', requireAuth, (req, res) => {
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'Server not found' });
        const { targetUserId, note } = req.body;
        if (!targetUserId || !note) return res.status(400).json({ error: 'Missing targetUserId or note' });
        const { addNote } = require('./staffNotes');
        const created = addNote(guild.id, targetUserId, 'dashboard', 'Dashboard', note);
        res.json({ success: true, note: created });
    });

    app.delete('/api/server/:id/notes/:noteId', requireAuth, (req, res) => {
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        const { removeNote } = require('./staffNotes');
        const removed = removeNote(req.params.noteId);
        if (!removed) return res.status(404).json({ error: 'Note not found' });
        res.json({ success: true });
    });

    // ── Invite Stats API ──
    app.get('/api/server/:id/invites', requireAuth, (req, res) => {
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'Server not found' });
        const { getGuildInviteStats, getTopInviters } = require('./invites');
        const top = getTopInviters(guild.id, 10);
        res.json(top.map(r => ({
            inviterId: r.inviter_id,
            count: r.count,
            tag: guild.members.cache.get(r.inviter_id)?.user?.tag || r.inviter_id,
        })));
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

    // ── Command Usage Stats ──
    app.get('/api/stats/commands', requireAuth, (req, res) => {
        if (!client) return res.json({ top: [], total: 0, users: 0 });
        const db = getDb();
        try {
            // Overall top commands across all servers
            const top = db.prepare('SELECT command, COUNT(*) as count, COUNT(DISTINCT guild_id) as servers FROM command_usage GROUP BY command ORDER BY count DESC LIMIT 20').all();
            const total = db.prepare('SELECT COUNT(*) as total FROM command_usage').get();
            const users = db.prepare('SELECT COUNT(DISTINCT user_id) as users FROM command_usage').get();
            // Per-server breakdown for top 5 servers by usage
            const perServer = db.prepare('SELECT guild_id, command, COUNT(*) as count FROM command_usage GROUP BY guild_id, command ORDER BY count DESC LIMIT 30').all();
            const enriched = perServer.map(r => ({
                guildName: client.guilds.cache.get(r.guild_id)?.name || r.guild_id,
                command: r.command, count: r.count,
            }));
            res.json({
                top: top.map(r => ({ command: r.command, count: r.count, servers: r.servers })),
                perServer: enriched,
                total: total ? total.total : 0,
                users: users ? users.users : 0,
            });
        } catch { res.json({ top: [], total: 0, users: 0 }); }
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
            { name:'stats', description:'View server, growth, or command usage statistics', usage:'/stats server|growth|commands' },
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
        { category:'Role Menus', owner:true, commands:[
            { name:'rolemenu', description:'Manage self-assignable role menus with dropdown select menus', usage:'/rolemenu create|add|remove|publish|list' },
        ]},
        { category:'Reaction Roles', owner:true, commands:[
            { name:'reactionrole', description:'Manage self-assignable reaction roles (add/remove/list)', usage:'/reactionrole add|remove|list' },
        ]},
        { category:'Auto-Mod', owner:true, commands:[
            { name:'automod', description:'Configure auto-moderation rules (spam/mentions/words/links/caps)', usage:'/automod config|list|filter|filters' },
        ]},
        { category:'Welcome / Goodbye', owner:true, commands:[
            { name:'welcome', description:'Configure welcome messages (channel/toggle/message/title/description/color/footer/thumbnail/image/author/show/test/reset)', usage:'/welcome <subcommand> [options]' },
            { name:'goodbye', description:'Configure goodbye messages (same subcommands as welcome)', usage:'/goodbye <subcommand> [options]' },
        ]},
        { category:'Invite Tracking', owner:true, commands:[
            { name:'invites', description:'Track invite codes and view who invited whom', usage:'/invites check [user] | top [limit] | stats' },
        ]},
        { category:'Staff Notes', owner:true, commands:[
            { name:'note', description:'Private staff notes on users (add/list/edit/remove)', usage:'/note add|list|edit|remove' },
        ]},
        { category:'Log Search', owner:true, commands:[
            { name:'logs', description:'Search through logged messages and events', usage:'/logs search [user] [keyword] [action] [limit]' },
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

    // ── Server Insights: Moderation Stats ──
    app.get('/api/server/:id/modstats', requireAuth, async (req, res) => {
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'Server not found' });
        try {
            const db = getDb();
            const totalCases = db.prepare('SELECT COUNT(*) as total FROM mod_cases WHERE guild_id = ?').get(guild.id);
            const activeCases = db.prepare('SELECT COUNT(*) as total FROM mod_cases WHERE guild_id = ? AND active = 1').get(guild.id);
            const byType = db.prepare('SELECT action_type, COUNT(*) as count FROM mod_cases WHERE guild_id = ? GROUP BY action_type ORDER BY count DESC').all(guild.id);
            const recent = db.prepare('SELECT * FROM mod_cases WHERE guild_id = ? ORDER BY created_at DESC LIMIT 15').all(guild.id);
            const topWarned = db.prepare('SELECT user_id, COUNT(*) as count FROM mod_cases WHERE guild_id = ? AND action_type = \'warn\' GROUP BY user_id ORDER BY count DESC LIMIT 5').all(guild.id);
            res.json({
                total: totalCases?.total || 0,
                active: activeCases?.total || 0,
                byType: byType.map(t => ({ action: t.action_type, count: t.count })),
                recent: recent.map(c => ({
                    id: c.id,
                    caseNumber: c.case_number,
                    userId: c.user_id,
                    moderatorTag: c.moderator_tag,
                    actionType: c.action_type,
                    reason: c.reason?.slice(0, 100) || '',
                    active: !!c.active,
                    createdAt: c.created_at,
                })),
                topWarned: topWarned.map(u => ({ userId: u.user_id, count: u.count, tag: guild.members.cache.get(u.user_id)?.user?.tag || u.user_id })),
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

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

    // ── Auto-Mod API ──
    const {
        RULE_TYPES: AM_RULES,
        ACTIONS: AM_ACTIONS,
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
    } = require('./automod');

    // Get full auto-mod config for a server
    app.get('/api/server/:id/automod', requireAuth, (req, res) => {
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'Server not found' });
        try {
            const rules = getAutoModRules(guild.id);
            const wordFilters = getAutoModFilters(guild.id, 'words');
            const linkFilters = getAutoModFilters(guild.id, 'links');
            const config = getAutoModConfig(guild.id);
            console.log('[AM-DEBUG] GET automod for', guild.id, ': channelSettings=', JSON.stringify({ includedChannels: config.includedChannels, excludedChannels: config.excludedChannels }));
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
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'Server not found' });
        const { includedChannels, excludedChannels, whitelistedRoles } = req.body;
        console.log('[AM-DEBUG] Save channels request for', guild.id, ':', { includedChannels, excludedChannels, whitelistedRoles });
        try {
            const updates = {};
            if (includedChannels !== undefined) updates.includedChannels = includedChannels;
            if (excludedChannels !== undefined) updates.excludedChannels = excludedChannels;
            if (whitelistedRoles !== undefined) updates.whitelistedRoles = whitelistedRoles;
            const result = updateAutoModConfig(guild.id, updates);
            console.log('[AM-DEBUG] Save channels result:', JSON.stringify(result));
            // Verify by re-reading
            const verify = getAutoModConfig(guild.id);
            console.log('[AM-DEBUG] Verify readback:', JSON.stringify(verify));
            res.json({ success: true, channelSettings: result });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Export auto-mod config as JSON
    app.get('/api/server/:id/automod/export', requireAuth, (req, res) => {
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

    // ── Ticket System API ──
    const {
        getTicketConfig, updateTicketConfig,
        getPanels, getPanel, createPanel, updatePanel, deletePanel,
        getPanelTypes, getPanelType, createPanelType, updatePanelType, deletePanelType,
        sendTicketPanel,
    } = require('./tickets');

    // Get all ticket data for a server (panels + types + recent tickets)
    app.get('/api/server/:id/tickets', requireAuth, (req, res) => {
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
                types: getPanelTypes(p.id).map(t => ({
                    id: t.id,
                    name: t.name,
                    emoji: t.emoji,
                    category_id: t.category_id,
                    support_roles: t.support_roles,
                    welcome_message: t.welcome_message,
                    ticket_name_format: t.ticket_name_format,
                    questions: t.questions,
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
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'Server not found' });
        try {
            const { clonePanel, getPanel, getPanelTypes } = require('./tickets');
            const newPanel = clonePanel(req.params.panelId);
            if (!newPanel) return res.status(404).json({ error: 'Panel not found' });
            const types = getPanelTypes(newPanel.id);
            res.json({ success: true, panel: { ...newPanel, types } });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    app.put('/api/server/:id/tickets/panels/:panelId/count', requireAuth, (req, res) => {
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'Server not found' });
        try {
            const { count } = req.body;
            if (count === undefined || count < 0 || !Number.isInteger(count)) {
                return res.status(400).json({ error: 'Count must be a positive integer' });
            }
            const { setPanelTicketCounter } = require('./tickets');
            setPanelTicketCounter(req.params.panelId, count);
            res.json({ success: true, count });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    app.put('/api/server/:id/tickets/panels/:panelId/config', requireAuth, (req, res) => {
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'Server not found' });
        try {
            const { updatePanel, getPanel } = require('./tickets');
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

    // ── Audit Log (Unified Feed) ──
    app.get('/api/server/:id/auditlog', requireAuth, async (req, res) => {
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'Server not found' });

        const db = getDb();
        const limit = Math.min(parseInt(req.query.limit) || 50, 100);
        const type = req.query.type || 'all';

        const entries = [];
        const now = Date.now();

        // 1. Discord's native audit log
        if (type === 'all' || type === 'discord') {
            try {
                const auditLog = await guild.fetchAuditLogs({ limit: 25 });
                for (const e of auditLog.entries) {
                    entries.push({
                        id: 'discord_' + e.id,
                        source: 'discord',
                        type: (function(ea){
                            if(ea == null) return 'Audit Event';
                            // Discord.js v14 uses numeric enum values (e.g. 22 for MemberKick)
                            if(typeof ea === 'number'){
                                try {
                                    const name = require('discord.js').AuditLogEvent[ea];
                                    if(name) return name.replace(/([A-Z])/g, ' $1').trim();
                                } catch {}
                                return 'Audit Action ' + ea;
                            }
                            return String(ea).replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                        })(e.action),
                        icon: (function(ea){
                            if(ea == null) return '\uD83D\uDD35';
                            if(typeof ea === 'number'){
                                try {
                                    const name = require('discord.js').AuditLogEvent[ea];
                                    if(name) {
                                        // Convert 'MemberKick' to 'MEMBER_KICK' for icon lookup
                                        const iconKey = name.replace(/([A-Z])/g, '_$1').toUpperCase().replace(/^_/, '');
                                        return getAuditIcon(iconKey);
                                    }
                                } catch {}
                            }
                            return getAuditIcon(ea);
                        })(e.action),
                        executorTag: e.executor?.tag || 'Unknown',
                        executorAvatar: e.executor?.displayAvatarURL({ size: 32 }) || null,
                        targetTag: e.target?.tag || e.target?.name || e.targetId || null,
                        reason: e.reason || null,
                        changes: e.changes?.slice(0, 3).map(c => ({ key: c.key, old: String(c.old ?? '').slice(0, 100), new: String(c.new ?? '').slice(0, 100) })) || [],
                        timestamp: e.createdTimestamp,
                    });
                }
            } catch {}
        }

        // 2. Bot's mod cases
        if (type === 'all' || type === 'moderation') {
            const cases = db.prepare('SELECT * FROM mod_cases WHERE guild_id = ? ORDER BY created_at DESC LIMIT ?').all(guild.id, Math.min(limit, 30));
            const actionIcons = { warn: '\u26A0\uFE0F', kick: '\uD83D\uDC22', ban: '\uD83D\uDD28', unban: '\uD83D\uDD13', timeout: '\u23F1\uFE0F', untimeout: '\u25B6\uFE0F', tempban: '\uD83D\uDD28', lock: '\uD83D\uDD12', unlock: '\uD83D\uDD13', purge: '\uD83E\uDDF9' };
            for (const c of cases) {
                entries.push({
                    id: 'case_' + c.id,
                    source: 'moderation',
                    type: c.action_type.charAt(0).toUpperCase() + c.action_type.slice(1),
                    icon: actionIcons[c.action_type] || '\uD83D\uDCCB',
                    executorTag: c.moderator_tag,
                    executorAvatar: null,
                    targetTag: '<@' + c.user_id + '>',
                    reason: c.reason || null,
                    changes: [{ key: 'Case #' + c.case_number, old: '', new: c.active ? 'Active' : 'Closed' }],
                    timestamp: c.created_at,
                });
            }
        }

        // 3. Message log (deleted/edited messages)
        if (type === 'all' || type === 'messages') {
            const msgs = db.prepare('SELECT * FROM message_log WHERE guild_id = ? ORDER BY logged_at DESC LIMIT ?').all(guild.id, Math.min(limit, 30));
            for (const m of msgs) {
                entries.push({
                    id: 'msg_' + m.id,
                    source: 'messages',
                    type: m.action === 'deleted' ? 'Message Deleted' : 'Message Edited',
                    icon: m.action === 'deleted' ? '\uD83D\uDDD1\uFE0F' : '\u270F\uFE0F',
                    executorTag: m.author_tag,
                    executorAvatar: null,
                    targetTag: guild.channels.cache.get(m.channel_id)?.name || m.channel_id,
                    reason: null,
                    changes: [{ key: 'Content', old: '', new: (m.content || '').slice(0, 200) }],
                    timestamp: m.logged_at,
                });
            }
        }

        // 4. Recent member activity from stats
        if (type === 'all' || type === 'members') {
            const { getGuildStats } = require('./stats');
            const stats = getGuildStats(guild.id);
            const snapshots = stats.dailySnapshots || [];
            const recent = snapshots.slice(-14);
            for (const snap of recent) {
                if (snap.joins > 0) {
                    entries.push({
                        id: 'join_' + snap.date,
                        source: 'members',
                        type: 'Members Joined',
                        icon: '\uD83D\uDC65',
                        executorTag: 'System',
                        executorAvatar: null,
                        targetTag: null,
                        reason: null,
                        changes: [{ key: 'Count', old: '', new: String(snap.joins) }],
                        timestamp: new Date(snap.date).getTime(),
                    });
                }
                if (snap.leaves > 0) {
                    entries.push({
                        id: 'leave_' + snap.date,
                        source: 'members',
                        type: 'Members Left',
                        icon: '\uD83D\uDEAA',
                        executorTag: 'System',
                        executorAvatar: null,
                        targetTag: null,
                        reason: null,
                        changes: [{ key: 'Count', old: '', new: String(snap.leaves) }],
                        timestamp: new Date(snap.date).getTime(),
                    });
                }
            }
        }

        // Sort by timestamp descending, limit results
        entries.sort((a, b) => b.timestamp - a.timestamp);
        res.json(entries.slice(0, limit));
    });

    // Helper for audit log icons
    function getAuditIcon(action) {
        const iconMap = {
            MEMBER_KICK: '\uD83D\uDC22',
            MEMBER_BAN: '\uD83D\uDD28',
            MEMBER_UNBAN: '\uD83D\uDD13',
            MEMBER_UPDATE: '\uD83D\uDC64',
            MEMBER_ROLE_UPDATE: '\uD83D\uDCCB',
            MEMBER_MOVE: '\uD83D\uDCE6',
            MEMBER_DISCONNECT: '\u274C',
            CHANNEL_CREATE: '\u2795',
            CHANNEL_DELETE: '\u2796',
            CHANNEL_UPDATE: '\u270F\uFE0F',
            ROLE_CREATE: '\uD83C\uDFF7\uFE0F',
            ROLE_DELETE: '\u274C',
            ROLE_UPDATE: '\u270F\uFE0F',
            MESSAGE_DELETE: '\uD83D\uDDD1\uFE0F',
            MESSAGE_BULK_DELETE: '\uD83E\uDDF9',
            OVERWRITE_UPDATE: '\uD83D\uDD12',
            GUILD_UPDATE: '\u270F\uFE0F',
            EMOJI_CREATE: '\uD83D\uDE0E',
            EMOJI_DELETE: '\u274C',
            EMOJI_UPDATE: '\u270F\uFE0F',
            STAGE_INSTANCE_CREATE: '\uD83C\uDFAD',
            THREAD_CREATE: '\uD83E\uDD9C',
            THREAD_DELETE: '\u274C',
            WEBHOOK_CREATE: '\uD83D\uDD17',
            BOT_ADD: '\uD83E\uDD16',
        };
        return iconMap[action] || '\uD83D\uDD35';
    }

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
