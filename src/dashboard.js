const express = require('express');
const path = require('path');
const os = require('os');
const fs = require('fs');
const crypto = require('crypto');
const { formatUptime, formatNumber, sanitizeForEmbed, sanitizeForDB, sanitizeName } = require('./helpers');
const { getBotConfig, getGuildConfig, updateGuildConfig, getWelcomeConfig, getGoodbyeConfig, updateWelcomeConfig } = require('./config');
const { getDb, getErrorLogs, getErrorTagCounts, clearErrorLogs, backupDatabase, listBackups, deleteBackup, recordAuditTrail } = require('./db');
const { getDataDir } = require('./data');
const { getGuildStats } = require('./stats');
const { getWarnings } = require('./warnings');
const { getNotesForUser } = require('./staffNotes');
const { getCases } = require('./modCases');
const { getInviterStats } = require('./invites');
const { getReactionRoles } = require('./reactionRoles');
const { createRoleMenu, getRoleMenus, removeRoleMenu, addRoleMenuOption, getRoleMenuOptions, removeRoleMenuOption } = require('./roleMenus');
const { getPresence, savePresence, clearPresence, joinChannel, moveChannel, leaveChannel, setStatusText, restoreAllPresences } = require('./voicePresence');
const { getConfig: getTempVoiceConfig, setConfig: setTempVoiceConfig, getTriggers, getTriggerForChannel, setTrigger, removeTrigger, getSpawned, getSpawnedChannel, getSpawnedByOwner, addSpawned, removeSpawned, registerPanel, getPanels, unregisterPanel, updatePanels, spawnChannel, cancelDeletion, scheduleDeletionIfEmpty, getMemberChannelFor, setChannelLocked, createForMember, deleteOwnedChannel, buildPanelMessage, buildPanelComponents, cleanupOrphans } = require('./tempVoice');
const { getThresholds, setThresholds, addThreshold, removeThreshold } = require('./warningThresholds');
const { createBanAppeal, getBanAppeal, getBanAppeals, updateBanAppealStatus, deleteBanAppeal, getBanAppealCount } = require('./banAppeals');
const { getAllPermissions } = require('./permissions');
const { LOG_CATEGORIES, WS_STATUS } = require('./constants');
const { logError, logInfo, logWarn } = require('./logError');
const { discordApiBreaker } = require('./helpers');
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
const loginAttemptReaper = setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of loginAttempts.entries()) {
        if (now - entry.windowStart > RATE_LIMIT_WINDOW * 2) {
            loginAttempts.delete(ip);
        }
    }
}, 5 * 60 * 1000);
loginAttemptReaper.unref();

let client = null;
let dashboardPassword = '';

function setDashboardClient(c, password) {
    client = c;
    if (!password) {
        console.error('[Dashboard] DASHBOARD_PASSWORD is not set! Please set it in your .env file.');
    }
    dashboardPassword = password;
}

// Constant-time password check — hashes both sides so length/timing of the
// raw comparison can't leak information about DASHBOARD_PASSWORD.
function passwordMatches(candidate) {
    if (!candidate || !dashboardPassword) return false;
    const a = crypto.createHash('sha256').update(String(candidate)).digest();
    const b = crypto.createHash('sha256').update(String(dashboardPassword)).digest();
    return crypto.timingSafeEqual(a, b);
}

// Session cookies are HttpOnly (invisible to JS — kills XSS token theft),
// Secure when served over TLS, Strict SameSite (kills CSRF from other origins).
function sessionCookieOptions(req) {
    return {
        httpOnly: true,
        secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
        sameSite: 'strict',
        path: '/',
        maxAge: SESSION_TTL_MS,
    };
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
    backgroundStyle: 'none',
    layoutDensity: 'normal',
    animationPreset: 'smooth',
    animationSpeed: 1,
    cardGlow: true,
    ambientLight: true,
    headerStyle: 'minimal',
    borderRadius: 'rounded',
    borderStrength: 'normal',
    themePreset: 'discord',
    fontFamily: 'system',
    showDockLabels: true,
    botAvatarUrl: null,
    logoUrl: null,
    faviconUrl: null,
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
    return 'dash_' + crypto.randomBytes(24).toString('base64url');
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
    // Drop their guild scopes too
    db.prepare('DELETE FROM dash_user_guilds WHERE user_id = ?').run(userId);
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
    return crypto.randomBytes(32).toString('base64url');
}

// Reap expired sessions every 10 minutes so the Map doesn't grow unbounded.
const sessionReaper = setInterval(() => {
    const now = Date.now();
    for (const [token, session] of sessions.entries()) {
        const pastMax = session.createdAt && now > session.createdAt + SESSION_MAX_MS;
        if (!session.expiresAt || now > session.expiresAt || pastMax) {
            sessions.delete(token);
        }
    }
}, 10 * 60 * 1000);
sessionReaper.unref();

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
    // Behind Railway/Discloud reverse proxies: makes req.ip and req.secure
    // reflect the real client (X-Forwarded-For / X-Forwarded-Proto).
    app.set('trust proxy', 1);
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Defense-in-depth CSP. script-src keeps 'unsafe-inline' because the UI
    // still uses inline onclick attributes; img-src/connect-src lockdown
    // blocks most exfiltration channels regardless.
    app.use((req, res, next) => {
        res.setHeader(
            'Content-Security-Policy',
            "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://cdn.discordapp.com; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'"
        );
        next();
    });

    // Request ID + timing for observability
    app.use((req, res, next) => {
        const requestId = req.headers['x-request-id'] || crypto.randomUUID();
        req.requestId = requestId;
        res.setHeader('X-Request-ID', requestId);
        const start = process.hrtime.bigint();
        res.on('finish', () => {
            const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
            logInfo(`${req.method} ${req.path} ${res.statusCode} ${durationMs.toFixed(2)}ms`, 'http', { requestId, ip: req.ip, userAgent: req.headers['user-agent'] });
        });
        next();
    });

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

    // ── Global API Rate Limiter (applies to all authenticated endpoints) ──
    const apiLimiter = new Map();
    const API_LIMIT_WINDOW = 60 * 1000; // 1 minute
    const API_LIMIT_MAX = 120; // 120 requests per minute per IP

    function checkApiRateLimit(ip) {
        const now = Date.now();
        let entry = apiLimiter.get(ip);
        if (!entry || now - entry.windowStart > API_LIMIT_WINDOW) {
            entry = { count: 1, windowStart: now };
            apiLimiter.set(ip, entry);
            return { allowed: true, remaining: API_LIMIT_MAX - 1 };
        }
        entry.count++;
        if (entry.count > API_LIMIT_MAX) {
            return { allowed: false, remaining: 0 };
        }
        return { allowed: true, remaining: API_LIMIT_MAX - entry.count };
    }

    // Clean up old entries every 5 minutes
    const apiLimiterReaper = setInterval(() => {
        const now = Date.now();
        for (const [ip, entry] of apiLimiter.entries()) {
            if (now - entry.windowStart > API_LIMIT_WINDOW * 2) {
                apiLimiter.delete(ip);
            }
        }
    }, 5 * 60 * 1000);
    apiLimiterReaper.unref();

    // Apply rate limiting to all /api/ routes except login, branding, health
    app.use('/api/', (req, res, next) => {
        const exempt = ['/api/login', '/api/branding', '/api/logout'];
        if (exempt.includes(req.path)) return next();

        const ip = req.ip || req.connection.remoteAddress || 'unknown';
        const rateCheck = checkApiRateLimit(ip);
        if (!rateCheck.allowed) {
            console.warn('[Dashboard] API rate limit hit for IP:', ip);
            return res.status(429).json({ success: false, error: 'Too many requests. Please slow down.' });
        }
        res.setHeader('X-RateLimit-Limit', API_LIMIT_MAX);
        res.setHeader('X-RateLimit-Remaining', rateCheck.remaining);
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
        if (password && passwordMatches(password)) {
            const token = generateSession();
            sessions.set(token, { method: 'password', expiresAt, createdAt: now });
            res.cookie('session', token, sessionCookieOptions(req));
            return res.json({ success: true });
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
                res.cookie('session', token, sessionCookieOptions(req));
                return res.json({ success: true, method: 'discord' });
            }
        }
        res.status(401).json({ success: false, error: 'Invalid credentials' });
    });

    app.post('/api/logout', (req, res) => {
        const token = req.headers.cookie?.match(/session=([^;]+)/)?.[1];
        if (token) sessions.delete(token);
        res.clearCookie('session', { path: '/' });
        res.json({ success: true });
    });

    // Public branding — safe subset, no auth needed (login page uses it).
    app.get('/api/branding', (req, res) => {
        const c = getDashboardConfig();
        res.json({
            title: c.title || 'Bot Dashboard',
            accentColor: c.accentColor || '#5865F2',
            logoUrl: c.logoUrl || null,
            faviconUrl: c.faviconUrl || null,
        });
    });

    function requireAuth(req, res, next) {
        if (!req.authenticated) return res.status(401).json({ error: 'Not authenticated' });
        next();
    }

    // Tenant guard — covers EVERY /api/server/:id/* route in one place so a
    // new route can never accidentally skip the scope check.
    app.use((req, res, next) => {
        const m = req.path.match(/^\/api\/server\/([^/]+)/);
        if (m && !canAccessGuild(req, m[1])) {
            return res.status(403).json({ error: 'You do not have access to this server' });
        }
        next();
    });

    function requireOwner(req, res, next) {
        if (!checkOwner(req)) return res.status(403).json({ error: 'Only the bot owner can do that' });
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
    app.use('/uploads', express.static(uploadsDir));

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
    app.post('/api/bot/name', requireAuth, requireOwner, (req, res) => {
        if (!client || !client.user) return res.status(503).json({ error: 'Bot not ready' });
        const { name } = req.body;
        if (!name || name.length > 32) return res.status(400).json({ error: 'Name must be 1-32 characters' });
        client.user.setUsername(name)
            .then(() => res.json({ success: true, username: client.user.tag }))
            .catch(err => res.status(400).json({ error: err.message }));
    });

    app.post('/api/bot/avatar', requireAuth, requireOwner, (req, res) => {
        if (!client || !client.user) return res.status(503).json({ error: 'Bot not ready' });
        const { url } = req.body;
        if (!url) return res.status(400).json({ error: 'Missing avatar URL' });
        client.user.setAvatar(url)
            .then(() => res.json({ success: true, avatar: client.user.displayAvatarURL({ size: 128 }) }))
            .catch(err => res.status(400).json({ error: err.message }));
    });

    app.post('/api/bot/presence', requireAuth, requireOwner, (req, res) => {
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
        res.json(filterByScope(req, servers, 'id'));
    });

    // ── Server Management: Roles ──
    app.post('/api/server/:id/settings', requireAuth, (req, res) => {
        if (!checkOwner(req)) return res.status(403).json({ error: 'Only the bot owner can change server settings' });
        const guild = client ? client.guilds.cache.get(req.params.id) : null;
        if (!guild) return res.status(404).json({ error: 'Server not found' });
        const { prefix, embedColor } = req.body || {};
        if (prefix !== undefined) {
            const p = String(prefix).trim();
            if (p && (p.length > 5 || /\s/.test(p))) return res.status(400).json({ error: 'Prefix must be 1-5 characters with no spaces' });
            updateGuildConfig(guild.id, cfg => { cfg.prefix = p || ';'; return cfg; });
        }
        if (embedColor !== undefined) {
            const c = String(embedColor).trim();
            if (c && !/^#[0-9a-fA-F]{6}$/.test(c)) return res.status(400).json({ error: 'Embed color must be a hex value like #5865F2' });
            updateGuildConfig(guild.id, cfg => { cfg.embed_color = c || null; return cfg; });
        }
        res.json({ success: true });
    });

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
                    // Sanitize text fields
                    const textFields = ['content', 'embedTitle', 'embedDescription', 'embedFooter', 'embedAuthor'];
                    if (textFields.includes(field)) {
                        cfg[field] = sanitizeForDB(req.body[field]).slice(0, field === 'content' ? 2000 : 1024);
                    } else {
                        cfg[field] = req.body[field];
                    }
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

    // ── Tenant scoping ──
    // Password sessions and the OWNER_ID discord session see every server.
    // Any other dash user only sees servers explicitly granted to them in
    // dash_user_guilds. Fail-closed: unknown sessions are treated as scoped
    // with zero grants.
    function getScopedGuildIds(req) {
        if (checkOwner(req)) return null;
        const token = req.headers.cookie?.match(/session=([^;]+)/)?.[1];
        const session = token ? sessions.get(token) : null;
        if (!session || session.method !== 'discord' || !session.userId) return new Set();
        const db = getDb();
        return new Set(db.prepare('SELECT guild_id FROM dash_user_guilds WHERE user_id = ?')
            .all(session.userId).map(r => r.guild_id));
    }

    function canAccessGuild(req, guildId) {
        if (!guildId) return false;
        const scoped = getScopedGuildIds(req);
        if (scoped === null) return true;
        return scoped.has(String(guildId));
    }

    function filterByScope(req, rows, key) {
        const scoped = getScopedGuildIds(req);
        if (scoped === null) return rows;
        return rows.filter(r => scoped.has(String(r[key])));
    }

    app.post('/api/server/:id/mod/warn', requireAuth, async (req, res) => {
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        if (!checkOwner(req)) return res.status(403).json({ error: 'Only the bot owner can perform mod actions' });
        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'Server not found' });
        const { userId, reason } = req.body;
        if (!userId || !reason) return res.status(400).json({ error: 'Missing userId or reason' });
        const safeReason = sanitizeForDB(reason).slice(0, 1000);

        try {
            const { addWarning } = require('./warnings');
            const { createCase } = require('./modCases');
            const sessionUser = getSessionUser(req);
            const warnings = addWarning(guild.id, userId, 'Dashboard (' + sessionUser + ')', safeReason);
            createCase(guild.id, userId, sessionUser, 'Dashboard', 'warn', safeReason);
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
        const safeReason = sanitizeForDB(reason).slice(0, 1000);

        try {
            const member = await guild.members.fetch(userId).catch(() => null);
            if (!member) return res.status(404).json({ error: 'Member not found in this server' });
            if (!member.kickable) return res.status(403).json({ error: 'Cannot kick this user - role hierarchy prevents it' });

            await member.kick('[Dashboard] ' + safeReason);
            const { createCase } = require('./modCases');
            createCase(guild.id, userId, getSessionUser(req), 'Dashboard', 'kick', safeReason);
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
        const safeReason = sanitizeForDB(reason).slice(0, 1000);

        try {
            const deleteSeconds = deleteMessages === '24hours' ? 86400 : (deleteMessages === '6hours' ? 21600 : (deleteMessages === 'hour' ? 3600 : 0));
            await guild.bans.create(userId, { reason: '[Dashboard] ' + safeReason, deleteMessageSeconds: deleteSeconds });
            const { createCase } = require('./modCases');
            createCase(guild.id, userId, getSessionUser(req), 'Dashboard', 'ban', safeReason);
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
        const safeReason = sanitizeForDB(reason).slice(0, 1000);

        try {
            const member = await guild.members.fetch(userId).catch(() => null);
            if (!member) return res.status(404).json({ error: 'Member not found in this server' });
            if (!member.moderatable) return res.status(403).json({ error: 'Cannot timeout this user' });

            const durationMap = { '60s': 60000, '5m': 300000, '10m': 600000, '1h': 3600000, '6h': 21600000, '24h': 86400000, '3d': 259200000, '7d': 604800000 };
            // Accept a named key ('10m', '1h', ...) or a raw number of minutes (the dashboard sends minutes)
            const minutes = typeof duration === 'number' ? duration : parseInt(duration, 10);
            const ms = durationMap[duration] || (Number.isInteger(minutes) && minutes > 0 ? minutes * 60000 : null);
            if (!ms) return res.status(400).json({ error: 'Invalid duration' });
            // Discord caps timeout length at 28 days
            if (ms > 28 * 24 * 60 * 60000) return res.status(400).json({ error: 'Timeout cannot exceed 28 days' });

            await member.timeout(ms, '[Dashboard] ' + safeReason);
            const { createCase } = require('./modCases');
            createCase(guild.id, userId, getSessionUser(req), 'Dashboard', 'timeout', safeReason);
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
        const { getNotesForUser, getGuildNotesForDashboard } = require('./staffNotes');
        // ?userId= filters to a specific user (dashboard search); otherwise return recent guild notes
        const userId = req.query.userId || null;
        const notes = userId ? getNotesForUser(guild.id, userId) : getGuildNotesForDashboard(guild.id);
        res.json({ notes: notes.map(n => ({
            id: n.id,
            targetUserId: n.target_user_id,
            targetTag: guild.members.cache.get(n.target_user_id)?.user?.tag || n.target_user_id,
            authorTag: n.author_tag,
            note: n.note,
            createdAt: n.created_at,
            updatedAt: n.updated_at,
        })) });
    });

    app.post('/api/server/:id/notes', requireAuth, (req, res) => {
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'Server not found' });
        const { targetUserId, note } = req.body;
        if (!targetUserId || !note) return res.status(400).json({ error: 'Missing targetUserId or note' });
        const safeNote = sanitizeForDB(note).slice(0, 2000);
        const { addNote } = require('./staffNotes');
        const created = addNote(guild.id, targetUserId, 'dashboard', 'Dashboard', safeNote);
        res.json({ success: true, note: created });
    });

    app.delete('/api/server/:id/notes/:noteId', requireAuth, (req, res) => {
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        const { removeNote } = require('./staffNotes');
        const removed = removeNote(req.params.noteId);
        if (!removed) return res.status(404).json({ error: 'Note not found' });
        res.json({ success: true });
    });

    // ── Webhook Management ──
    app.get('/api/server/:id/webhooks', requireAuth, async (req, res) => {
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        if (!checkOwner(req)) return res.status(403).json({ error: 'Only the bot owner can manage webhooks' });
        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'Server not found' });
        try {
            const webhooks = await guild.fetchWebhooks();
            res.json(webhooks.map(w => ({
                id: w.id,
                name: w.name,
                avatar: w.avatarURL({ size: 64 }) || null,
                channelId: w.channelId,
                channelName: guild.channels.cache.get(w.channelId)?.name || 'Unknown',
                type: w.type,
                owner: w.owner ? w.owner.tag : 'Unknown',
                createdAt: w.createdTimestamp,
                url: w.url,
            })));
        } catch (err) {
            logError(err, 'dashboard', 'webhooks_fetch');
            res.status(500).json({ error: err.message });
        }
    });

    app.post('/api/server/:id/webhooks', requireAuth, async (req, res) => {
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        if (!checkOwner(req)) return res.status(403).json({ error: 'Only the bot owner can create webhooks' });
        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'Server not found' });
        const { name, channelId, avatar } = req.body;
        if (!name || !channelId) return res.status(400).json({ error: 'Missing name or channelId' });
        const channel = guild.channels.cache.get(channelId);
        if (!channel || !channel.isTextBased()) return res.status(400).json({ error: 'Invalid channel' });
        try {
            const webhook = await channel.createWebhook({ name: sanitizeName(name), avatar });
            res.json({ success: true, webhook: { id: webhook.id, name: webhook.name, url: webhook.url } });
        } catch (err) {
            logError(err, 'dashboard', 'webhook_create');
            res.status(500).json({ error: err.message });
        }
    });

    app.delete('/api/server/:id/webhooks/:webhookId', requireAuth, async (req, res) => {
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        if (!checkOwner(req)) return res.status(403).json({ error: 'Only the bot owner can delete webhooks' });
        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'Server not found' });
        try {
            const webhook = await guild.fetchWebhook(req.params.webhookId);
            if (!webhook) return res.status(404).json({ error: 'Webhook not found' });
            await webhook.delete();
            res.json({ success: true });
        } catch (err) {
            logError(err, 'dashboard', 'webhook_delete');
            res.status(500).json({ error: err.message });
        }
    });

    // ── API Tokens (for external integrations) ──
    app.get('/api/tokens', requireAuth, requireOwner, (req, res) => {
        const db = getDb();
        const tokens = db.prepare('SELECT id, name, token_hash, scopes, created_at, last_used_at, expires_at FROM api_tokens ORDER BY created_at DESC').all();
        res.json(tokens.map(t => ({ ...t, token_hash: t.token_hash.slice(0, 8) + '...' })));
    });

    app.post('/api/tokens', requireAuth, requireOwner, (req, res) => {
        const { name, scopes, expiresInDays } = req.body;
        if (!name) return res.status(400).json({ error: 'Missing name' });
        const token = 'nlux_' + crypto.randomBytes(32).toString('base64url');
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        const expiresAt = expiresInDays ? Date.now() + expiresInDays * 24 * 60 * 60 * 1000 : null;
        const db = getDb();
        db.prepare('INSERT INTO api_tokens (name, token_hash, scopes, expires_at) VALUES (?, ?, ?, ?)')
            .run(name, tokenHash, JSON.stringify(scopes || []), expiresAt);
        res.json({ success: true, token }); // Only time the full token is returned
    });

    app.delete('/api/tokens/:id', requireAuth, requireOwner, (req, res) => {
        const db = getDb();
        const result = db.prepare('DELETE FROM api_tokens WHERE id = ?').run(req.params.id);
        res.json({ success: result.changes > 0 });
    });

    // ── Rate Limit Configuration ──
    app.get('/api/ratelimit/config', requireAuth, requireOwner, (req, res) => {
        const db = getDb();
        const row = db.prepare('SELECT value FROM bot_config WHERE key = ?').get('ratelimit_config');
        const config = row ? JSON.parse(row.value) : {
            global: { windowMs: 60000, max: 120 },
            login: { windowMs: 60000, max: 10 },
            api: { windowMs: 60000, max: 100 },
            modActions: { windowMs: 60000, max: 30 },
        };
        res.json(config);
    });

    app.post('/api/ratelimit/config', requireAuth, requireOwner, (req, res) => {
        const { global, login, api, modActions } = req.body;
        const db = getDb();
        const config = {};
        if (global) config.global = { windowMs: Math.max(1000, global.windowMs), max: Math.max(1, global.max) };
        if (login) config.login = { windowMs: Math.max(1000, login.windowMs), max: Math.max(1, login.max) };
        if (api) config.api = { windowMs: Math.max(1000, api.windowMs), max: Math.max(1, api.max) };
        if (modActions) config.modActions = { windowMs: Math.max(1000, modActions.windowMs), max: Math.max(1, modActions.max) };
        db.prepare('INSERT OR REPLACE INTO bot_config (key, value) VALUES (?, ?)').run('ratelimit_config', JSON.stringify(config));
        res.json({ success: true, config });
    });

    // ── Bot Activity Timeline ──
    app.get('/api/activity/timeline', requireAuth, (req, res) => {
        if (!client) return res.json([]);
        const days = Math.min(parseInt(req.query.days) || 7, 30);
        const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
        const db = getDb();
        const events = db.prepare('SELECT * FROM bot_activity WHERE timestamp > ? ORDER BY timestamp DESC LIMIT 1000').all(cutoff);
        res.json(events);
    });

    // Log bot activity events
    global.logBotActivity = function(type, data = {}) {
        try {
            const db = getDb();
            db.prepare('INSERT INTO bot_activity (type, data, timestamp) VALUES (?, ?, ?)')
                .run(type, JSON.stringify(data), Date.now());
            // Keep last 10000 events
            db.prepare('DELETE FROM bot_activity WHERE id NOT IN (SELECT id FROM bot_activity ORDER BY timestamp DESC LIMIT 10000)').run();
        } catch {}
    };

    // ── Server Comparison / Multi-server Analytics ──
    app.get('/api/analytics/servers/compare', requireAuth, (req, res) => {
        if (!client) return res.json([]);
        const metric = req.query.metric || 'members'; // members, joins, leaves, boosts, channels
        const limit = Math.min(parseInt(req.query.limit) || 10, 50);
        const servers = client.guilds.cache.map(g => {
            const stats = getGuildStats(g.id);
            let value = g.memberCount;
            if (metric === 'joins') value = stats.totalJoins || 0;
            else if (metric === 'leaves') value = stats.totalLeaves || 0;
            else if (metric === 'boosts') value = g.premiumSubscriptionCount || 0;
            else if (metric === 'channels') value = g.channels.cache.size;
            else if (metric === 'growth') value = (stats.totalJoins || 0) - (stats.totalLeaves || 0);
            return { id: g.id, name: g.name, icon: g.iconURL({ size: 32 }), value };
        }).sort((a, b) => b.value - a.value).slice(0, limit);
        res.json({ metric, servers });
    });

    // ── Command Usage Heatmap ──
    app.get('/api/stats/commands/heatmap', requireAuth, (req, res) => {
        if (!client) return res.json({});
        const days = Math.min(parseInt(req.query.days) || 7, 30);
        const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
        const db = getDb();
        const rows = db.prepare('SELECT command, guild_id, COUNT(*) as count FROM command_usage WHERE used_at > ? GROUP BY command, guild_id ORDER BY count DESC LIMIT 500').all(cutoff);
        const heatmap = {};
        for (const r of rows) {
            if (!heatmap[r.command]) heatmap[r.command] = {};
            heatmap[r.command][r.guild_id] = r.count;
        }
        res.json(heatmap);
    });

    // ── Reaction Roles API ──
    app.get('/api/server/:id/reaction-roles', requireAuth, (req, res) => {
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'Server not found' });
        try {
            const roles = getReactionRoles(guild.id);
            const channels = guild.channels.cache
                .filter(c => c.type === 0 || c.type === 5 || c.type === 15)
                .sort((a, b) => a.position - b.position)
                .map(c => ({ id: c.id, name: '#' + c.name }));
            const rolesList = guild.roles.cache
                .filter(r => r.name !== '@everyone' && !r.managed)
                .sort((a, b) => b.position - a.position)
                .map(r => ({ id: r.id, name: r.name, color: r.hexColor === '#000000' ? null : r.hexColor }));
            res.json({ roles, channels, rolesList });
        } catch { res.json({ roles: [], channels: [], rolesList: [] }); }
    });

    app.post('/api/server/:id/reaction-roles', requireAuth, async (req, res) => {
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'Server not found' });
        const { messageId, channelId, emoji, roleId, label } = req.body;
        if (!messageId || !channelId || !emoji || !roleId) return res.status(400).json({ error: 'Missing required fields' });
        try {
            const channel = guild.channels.cache.get(channelId);
            if (!channel) return res.status(400).json({ error: 'Channel not found' });
            const role = guild.roles.cache.get(roleId);
            if (!role) return res.status(400).json({ error: 'Role not found' });
            const result = addReactionRole(guild.id, messageId, channelId, emoji, roleId, label || null);
            res.json({ success: true, roles: result });
        } catch (err) {
            logError(err, 'dashboard', 'reactionrole_add');
            res.status(500).json({ error: err.message });
        }
    });

    app.delete('/api/server/:id/reaction-roles', requireAuth, async (req, res) => {
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'Server not found' });
        const { messageId, emoji } = req.body;
        if (!messageId || !emoji) return res.status(400).json({ error: 'Missing messageId or emoji' });
        try {
            const result = removeReactionRole(guild.id, messageId, emoji);
            if (!result) return res.status(404).json({ error: 'Reaction role not found' });
            res.json({ success: true });
        } catch (err) {
            logError(err, 'dashboard', 'reactionrole_remove');
            res.status(500).json({ error: err.message });
        }
    });

    app.post('/api/server/:id/reaction-roles/message', requireAuth, async (req, res) => {
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'Server not found' });
        const { channelId, content, roles } = req.body;
        if (!channelId || !roles?.length) return res.status(400).json({ error: 'Missing channelId or roles' });
        try {
            const channel = guild.channels.cache.get(channelId);
            if (!channel || !channel.isTextBased()) return res.status(400).json({ error: 'Invalid text channel' });
            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle('Reaction Roles')
                .setDescription(content || 'React to get roles!')
                .setFooter({ text: 'Click a reaction to get/remove the role' });
            const msg = await channel.send({ embeds: [embed] });
            for (const r of roles) {
                await addReactionRole(guild.id, msg.id, channelId, r.emoji, r.roleId, r.label || null);
                try { await msg.react(r.emoji); } catch {}
            }
            res.json({ success: true, messageId: msg.id });
        } catch (err) {
            logError(err, 'dashboard', 'reactionrole_message');
            res.status(500).json({ error: err.message });
        }
    });

    // ── Role Menus API ──
    app.get('/api/server/:id/role-menus', requireAuth, (req, res) => {
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'Server not found' });
        try {
            const menus = getRoleMenus(guild.id);
            const channels = guild.channels.cache
                .filter(c => c.type === 0 || c.type === 5 || c.type === 15)
                .sort((a, b) => a.position - b.position)
                .map(c => ({ id: c.id, name: '#' + c.name }));
            const rolesList = guild.roles.cache
                .filter(r => r.name !== '@everyone' && !r.managed)
                .sort((a, b) => b.position - a.position)
                .map(r => ({ id: r.id, name: r.name, color: r.hexColor === '#000000' ? null : r.hexColor }));
            res.json({ menus, channels, rolesList });
        } catch { res.json({ menus: [], channels: [], rolesList: [] }); }
    });

    app.post('/api/server/:id/role-menus', requireAuth, async (req, res) => {
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'Server not found' });
        const { channelId, title } = req.body;
        if (!channelId) return res.status(400).json({ error: 'Missing channelId' });
        try {
            const channel = guild.channels.cache.get(channelId);
            if (!channel || !channel.isTextBased()) return res.status(400).json({ error: 'Invalid text channel' });
            if (!guild.members.me.permissions.has('ManageRoles')) return res.status(403).json({ error: 'Bot needs Manage Roles permission' });
            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle('🌟 ' + (title || 'Self-Assignable Roles'))
                .setDescription('Select the roles you want from the dropdown below!\n*(You can select multiple)*')
                .setFooter({ text: guild.name, iconURL: guild.iconURL() })
                .setTimestamp();
            const msg = await channel.send({ embeds: [embed] });
            createRoleMenu(guild.id, msg.id, channelId, title || 'Self-Assignable Roles');
            res.json({ success: true, messageId: msg.id, menu: getRoleMenus(guild.id).find(m => m.message_id === msg.id) });
        } catch (err) {
            logError(err, 'dashboard', 'rolemenu_create');
            res.status(500).json({ error: err.message });
        }
    });

    app.post('/api/server/:id/role-menus/:messageId/options', requireAuth, async (req, res) => {
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'Server not found' });
        const { roleId, label, emoji, description } = req.body;
        if (!roleId) return res.status(400).json({ error: 'Missing roleId' });
        try {
            const role = guild.roles.cache.get(roleId);
            if (!role) return res.status(400).json({ error: 'Role not found' });
            if (role.managed) return res.status(400).json({ error: 'Cannot add managed/bot roles' });
            if (role.comparePositionTo(guild.members.me.roles.highest) >= 0) return res.status(400).json({ error: 'Role is higher than bot\'s highest role' });
            addRoleMenuOption(req.params.messageId, roleId, label || role.name, emoji || null, description || null);
            res.json({ success: true, options: getRoleMenuOptions(req.params.messageId) });
        } catch (err) {
            logError(err, 'dashboard', 'rolemenu_add_option');
            res.status(500).json({ error: err.message });
        }
    });

    app.delete('/api/server/:id/role-menus/:messageId/options', requireAuth, async (req, res) => {
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'Server not found' });
        const { roleId } = req.body;
        if (!roleId) return res.status(400).json({ error: 'Missing roleId' });
        try {
            const result = removeRoleMenuOption(req.params.messageId, roleId);
            if (!result) return res.status(404).json({ error: 'Option not found' });
            res.json({ success: true, options: getRoleMenuOptions(req.params.messageId) });
        } catch (err) {
            logError(err, 'dashboard', 'rolemenu_remove_option');
            res.status(500).json({ error: err.message });
        }
    });

    app.put('/api/server/:id/role-menus/:messageId/publish', requireAuth, async (req, res) => {
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'Server not found' });
        try {
            const channel = guild.channels.cache.get(req.query.channelId) || guild.channels.cache.get(req.body?.channelId);
            if (!channel) return res.status(400).json({ error: 'Channel not found' });
            const msg = await channel.messages.fetch(req.params.messageId).catch(() => null);
            if (!msg) return res.status(404).json({ error: 'Message not found' });
            const options = getRoleMenuOptions(req.params.messageId);
            if (!options.length) return res.status(400).json({ error: 'Menu has no roles! Add some first.' });
            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle('🌟 ' + (msg.embeds[0]?.title || 'Self-Assignable Roles'))
                .setDescription('Select the roles you want from the dropdown below!\n*(You can select multiple)*')
                .setFooter({ text: guild.name, iconURL: guild.iconURL() })
                .setTimestamp();
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('rm_' + req.params.messageId)
                .setPlaceholder('Select roles...')
                .setMinValues(0)
                .setMaxValues(options.length)
                .addOptions(options.map(o => new StringSelectMenuOptionBuilder()
                    .setLabel(o.label || guild.roles.cache.get(o.role_id)?.name || o.role_id)
                    .setValue(o.role_id)
                    .setDescription(o.description || null)
                    .setEmoji(o.emoji || null)
                ));
            const row = new ActionRowBuilder().addComponents(selectMenu);
            await msg.edit({ embeds: [embed], components: [row] });
            res.json({ success: true });
        } catch (err) {
            logError(err, 'dashboard', 'rolemenu_publish');
            res.status(500).json({ error: err.message });
        }
    });

    app.delete('/api/server/:id/role-menus/:messageId', requireAuth, async (req, res) => {
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'Server not found' });
        try {
            const channel = guild.channels.cache.get(req.query.channelId) || guild.channels.cache.get(req.body?.channelId);
            if (channel) {
                const msg = await channel.messages.fetch(req.params.messageId).catch(() => null);
                if (msg) await msg.delete().catch(() => {});
            }
            const result = removeRoleMenu(guild.id, req.params.messageId);
            if (!result) return res.status(404).json({ error: 'Menu not found' });
            res.json({ success: true });
        } catch (err) {
            logError(err, 'dashboard', 'rolemenu_delete');
            res.status(500).json({ error: err.message });
        }
    });

    // ── Voice Presence API ──
    app.get('/api/server/:id/voice-presence', requireAuth, (req, res) => {
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
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'Server not found' });
        const { channelId, status } = req.body;
        if (!channelId) return res.status(400).json({ error: 'Missing channelId' });
        try {
            const channel = guild.channels.cache.get(channelId);
            if (!channel || channel.type !== 2) return res.status(400).json({ error: 'Invalid voice channel' });
            if (!guild.members.me) return res.status(503).json({ error: 'Bot member not loaded' });
            const result = await joinChannel(guild, channel, status || null);
            res.json({ success: true, presence: getPresence(guild.id) });
        } catch (err) {
            logError(err, 'dashboard', 'voice_presence_join');
            res.status(500).json({ error: err.message });
        }
    });

    app.post('/api/server/:id/voice-presence/move', requireAuth, async (req, res) => {
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

    // ── Warning Thresholds API ──
    app.get('/api/server/:id/warning-thresholds', requireAuth, (req, res) => {
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'Server not found' });
        try {
            const thresholds = getThresholds(guild.id);
            res.json({ thresholds });
        } catch { res.json({ thresholds: [] }); }
    });

    app.post('/api/server/:id/warning-thresholds', requireAuth, async (req, res) => {
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'Server not found' });
        const { warnCount, action, duration } = req.body;
        if (!warnCount || !action) return res.status(400).json({ error: 'Missing warnCount or action' });
        if (!DEFAULT_ACTIONS.includes(action)) return res.status(400).json({ error: 'Invalid action' });
        if (warnCount <= 0) return res.status(400).json({ error: 'warnCount must be positive' });
        try {
            const result = addThreshold(guild.id, warnCount, action, duration || null);
            res.json({ success: true, thresholds: result });
        } catch (err) {
            logError(err, 'dashboard', 'warning_thresholds_add');
            res.status(500).json({ error: err.message });
        }
    });

    app.delete('/api/server/:id/warning-thresholds', requireAuth, async (req, res) => {
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'Server not found' });
        const { warnCount } = req.body;
        if (!warnCount) return res.status(400).json({ error: 'Missing warnCount' });
        try {
            const result = removeThreshold(guild.id, warnCount);
            res.json({ success: true, thresholds: result });
        } catch (err) {
            logError(err, 'dashboard', 'warning_thresholds_remove');
            res.status(500).json({ error: err.message });
        }
    });

    // ── Ban Appeals API ──
    app.get('/api/server/:id/ban-appeals', requireAuth, (req, res) => {
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'Server not found' });
        const status = req.query.status || null;
        try {
            const appeals = getBanAppeals(guild.id, status);
            res.json({ appeals });
        } catch { res.json({ appeals: [] }); }
    });

    app.get('/api/server/:id/ban-appeals/stats', requireAuth, (req, res) => {
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'Server not found' });
        try {
            const stats = {
                pending: getBanAppealCount(guild.id, 'pending'),
                approved: getBanAppealCount(guild.id, 'approved'),
                denied: getBanAppealCount(guild.id, 'denied'),
                total: getBanAppealCount(guild.id),
            };
            res.json(stats);
        } catch { res.json({ pending: 0, approved: 0, denied: 0, total: 0 }); }
    });

    app.post('/api/server/:id/ban-appeals', requireAuth, async (req, res) => {
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'Server not found' });
        const { userId, userTag, reason, message } = req.body;
        if (!userId || !userTag || !reason || !message) return res.status(400).json({ error: 'Missing required fields' });
        try {
            const appeal = createBanAppeal(guild.id, userId, userTag, reason, message);
            res.json({ success: true, appeal });
        } catch (err) {
            logError(err, 'dashboard', 'ban_appeal_create');
            res.status(500).json({ error: err.message });
        }
    });

    app.put('/api/server/:id/ban-appeals/:appealId', requireAuth, async (req, res) => {
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'Server not found' });
        const { status, reviewedBy, reviewNote } = req.body;
        if (!status) return res.status(400).json({ error: 'Missing status' });
        try {
            const result = updateBanAppealStatus(req.params.appealId, status, reviewedBy || 'Dashboard', reviewNote);
            if (!result) return res.status(404).json({ error: 'Appeal not found' });
            res.json({ success: true });
        } catch (err) {
            logError(err, 'dashboard', 'ban_appeal_update');
            res.status(500).json({ error: err.message });
        }
    });

    app.delete('/api/server/:id/ban-appeals/:appealId', requireAuth, async (req, res) => {
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'Server not found' });
        try {
            const result = deleteBanAppeal(req.params.appealId);
            if (!result) return res.status(404).json({ error: 'Appeal not found' });
            res.json({ success: true });
        } catch (err) {
            logError(err, 'dashboard', 'ban_appeal_delete');
            res.status(500).json({ error: err.message });
        }
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

    app.post('/api/reminders', requireAuth, async (req, res) => {
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        const { userId, channelId, text, durationMs } = req.body;
        if (!userId || !text || !durationMs) return res.status(400).json({ error: 'Missing required fields' });
        try {
            const reminders = require('./reminders');
            const reminder = reminders.addReminder(userId, channelId || null, text, durationMs);
            res.json({ success: true, reminder });
        } catch (err) {
            logError(err, 'dashboard', 'reminder_create');
            res.status(500).json({ error: err.message });
        }
    });

    app.delete('/api/reminders/:id', requireAuth, async (req, res) => {
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        const { userId } = req.body;
        if (!userId) return res.status(400).json({ error: 'Missing userId' });
        try {
            const reminders = require('./reminders');
            const result = reminders.removeReminder(req.params.id, userId);
            if (!result) return res.status(404).json({ error: 'Reminder not found' });
            res.json({ success: true });
        } catch (err) {
            logError(err, 'dashboard', 'reminder_delete');
            res.status(500).json({ error: err.message });
        }
    });

    // ── Giveaways Manager ──
    app.get('/api/giveaways', requireAuth, (req, res) => {
        try {
            const db = getDb();
            const rows = db.prepare('SELECT * FROM giveaways ORDER BY created_at DESC LIMIT 100').all();
            res.json(filterByScope(req, rows, 'guild_id').map(g => ({
                id: g.id,
                guildId: g.guild_id,
                guildName: (client && client.guilds.cache.get(g.guild_id)) ? client.guilds.cache.get(g.guild_id).name : g.guild_id,
                channelId: g.channel_id,
                prize: g.prize,
                winners: g.winners,
                hostTag: g.host_tag || null,
                endsAt: g.ends_at,
                status: g.status,
                winnerIds: g.winner_ids ? JSON.parse(g.winner_ids) : [],
                endedAt: g.ended_at,
                createdAt: g.created_at,
            })));
        } catch { res.json([]); }
    });

    app.post('/api/giveaways/create', requireAuth, async (req, res) => {
        try {
            if (!checkOwner(req)) return res.status(403).json({ error: 'Only the bot owner can create giveaways' });
            if (!client || !client.user) return res.status(503).json({ error: 'Bot is not online yet' });
            const { guildId, channelId, prize, durationHours, winners, description } = req.body || {};
            const guild = client.guilds.cache.get(guildId);
            if (!guild) return res.status(400).json({ error: 'Bot is not in that server' });
            if (!prize || typeof prize !== 'string' || !prize.trim()) return res.status(400).json({ error: 'Missing prize' });
            const hours = parseFloat(durationHours);
            if (!hours || hours <= 0 || hours > 24 * 30) return res.status(400).json({ error: 'Invalid duration in hours' });
            const winnerCount = Math.min(Math.max(parseInt(winners) || 1, 1), 20);
            let channel = channelId ? guild.channels.cache.get(channelId) : null;
            if (!channel || !channel.isTextBased()) {
                channel = guild.channels.cache.find(c => c.type === 0 && guild.members.me && c.permissionsFor(guild.members.me)?.has('SendMessages')) || null;
            }
            if (!channel) return res.status(400).json({ error: 'No text channel the bot can post in' });
            const gw = require('./giveaways');
            const g = gw.createGiveaway({
                guildId: guild.id,
                channelId: channel.id,
                prize: sanitizeForDB(prize).slice(0, 200),
                durationMs: Math.round(hours * 3600000),
                winners: winnerCount,
                hostId: 'dashboard',
                hostTag: 'Dashboard',
                description: description ? sanitizeForDB(description).slice(0, 500) : undefined,
            });
            await gw.postGiveaway(channel, g);
            res.json({ success: true, id: g.id });
        } catch (err) {
            logError(err, 'dashboard', 'giveaway_create');
            res.status(500).json({ error: err.message || 'Failed to create giveaway' });
        }
    });

    app.post('/api/giveaways/end', requireAuth, async (req, res) => {
        try {
            if (!checkOwner(req)) return res.status(403).json({ error: 'Only the bot owner can end giveaways' });
            await require('./giveaways').endGiveaway(String(req.body?.id || ''));
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: err.message || 'Failed to end giveaway' });
        }
    });

    app.post('/api/giveaways/cancel', requireAuth, (req, res) => {
        try {
            if (!checkOwner(req)) return res.status(403).json({ error: 'Only the bot owner can cancel giveaways' });
            const ok = require('./giveaways').cancelGiveaway(String(req.body?.id || ''));
            if (!ok) return res.status(400).json({ error: 'Giveaway not found or not active' });
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: err.message || 'Failed to cancel giveaway' });
        }
    });

    app.post('/api/giveaways/reroll', requireAuth, async (req, res) => {
        try {
            if (!checkOwner(req)) return res.status(403).json({ error: 'Only the bot owner can reroll giveaways' });
            const winners = await require('./giveaways').rerollGiveaway(String(req.body?.id || ''));
            res.json({ success: true, winners: winners || [] });
        } catch (err) {
            res.status(500).json({ error: err.message || 'Failed to reroll' });
        }
    });

    // ── Polls/Announcements ──
    app.post('/api/polls/create', requireAuth, async (req, res) => {
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        if (!checkOwner(req)) return res.status(403).json({ error: 'Only the bot owner can create polls' });
        const { guildId, channelId, question, options, multi, anonymous, durationHours } = req.body || {};
        if (!guildId || !channelId || !question || !options || options.length < 2) return res.status(400).json({ error: 'Missing required fields' });
        try {
            const guild = client.guilds.cache.get(guildId);
            if (!guild) return res.status(400).json({ error: 'Bot is not in that server' });
            const channel = guild.channels.cache.get(channelId);
            if (!channel || !channel.isTextBased()) return res.status(400).json({ error: 'Invalid text channel' });
            
            const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
            const { getDb } = require('./db');
            
            const pollId = 'poll_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
            const endsAt = Date.now() + (parseFloat(durationHours) || 24) * 3600000;
            
            const db = getDb();
            db.prepare('INSERT INTO poll_votes (message_id, user_id, option_index, voted_at, poll_type) VALUES (?, ?, ?, ?, ?)')
                .run(pollId, 'system', -1, Date.now(), multi ? 'multi' : anonymous ? 'anonymous' : 'single');
            
            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle('📊 ' + sanitizeForDB(question).slice(0, 256))
                .setDescription(options.map((opt, i) => `${i + 1}. ${sanitizeForDB(opt).slice(0, 100)}`).join('\n'))
                .setFooter({ text: 'Poll ends <t:' + Math.floor(endsAt / 1000) + ':R>' });
            
            const buttons = options.map((opt, i) => new ButtonBuilder()
                .setCustomId((multi ? 'pm' : anonymous ? 'pa' : 'pv') + '_vote_' + i + '_' + pollId)
                .setLabel(opt.slice(0, 80))
                .setStyle(ButtonStyle.Primary));
            
            const rows = [];
            for (let i = 0; i < buttons.length; i += 5) {
                rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
            }
            rows.push(new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('pvv_' + pollId).setLabel('Show Voters').setStyle(ButtonStyle.Secondary)
            ));
            
            const msg = await channel.send({ embeds: [embed], components: rows });
            
            db.prepare('UPDATE poll_votes SET message_id = ? WHERE message_id = ?').run(msg.id, pollId);
            
            res.json({ success: true, messageId: msg.id, pollId });
        } catch (err) {
            logError(err, 'dashboard', 'poll_create');
            res.status(500).json({ error: err.message });
        }
    });

    app.post('/api/polls/end', requireAuth, async (req, res) => {
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        if (!checkOwner(req)) return res.status(403).json({ error: 'Only the bot owner can end polls' });
        const { messageId } = req.body || {};
        if (!messageId) return res.status(400).json({ error: 'Missing messageId' });
        try {
            await require('./interactions').endPoll(messageId);
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    app.post('/api/announcements/create', requireAuth, async (req, res) => {
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        if (!checkOwner(req)) return res.status(403).json({ error: 'Only the bot owner can send announcements' });
        const { guildId, channelId, title, message, color } = req.body || {};
        if (!guildId || !channelId || !title || !message) return res.status(400).json({ error: 'Missing required fields' });
        try {
            const guild = client.guilds.cache.get(guildId);
            if (!guild) return res.status(400).json({ error: 'Bot is not in that server' });
            const channel = guild.channels.cache.get(channelId);
            if (!channel || !channel.isTextBased()) return res.status(400).json({ error: 'Invalid text channel' });
            
            const { EmbedBuilder } = require('discord.js');
            const embed = new EmbedBuilder()
                .setColor(color ? sanitizeForDB(color) : 0x5865F2)
                .setTitle(sanitizeForEmbed(title).slice(0, 256))
                .setDescription(sanitizeForDB(message).slice(0, 4096))
                .setTimestamp();
            
            await channel.send({ embeds: [embed] });
            res.json({ success: true });
        } catch (err) {
            logError(err, 'dashboard', 'announcement_create');
            res.status(500).json({ error: err.message });
        }
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
            const enriched = filterByScope(req, perServer, 'guild_id').map(r => ({
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
        const scoped = getScopedGuildIds(req);
        const exportData = {};
        client.guilds.cache.forEach(g => {
            if (scoped && !scoped.has(String(g.id))) return;
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
        res.json(filterByScope(req, recent.slice(-30), 'guildId'));
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
    const sseClients = new Map(); // res -> Set of allowed guildIds (null = unrestricted)
    app.get('/api/events', requireAuth, (req, res) => {
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        });
        res.write('data: {"type":"connected"}\n\n');
        sseClients.set(res, getScopedGuildIds(req));
        req.on('close', () => sseClients.delete(res));
    });

    // Helper to broadcast events. Scoped clients only receive events whose
    // data.guildId is in their granted set; events without a guildId are
    // withheld from scoped clients entirely (fail-closed).
    global.broadcastDashboard = function broadcastDashboard(type, data) {
        for (const [client, scoped] of sseClients) {
            if (scoped) {
                const gid = data && data.guildId !== undefined ? String(data.guildId) : null;
                if (!gid || !scoped.has(gid)) continue;
            }
            const msg = 'data: ' + JSON.stringify({ type: type, data: data, time: Date.now() }) + '\n\n';
            try { client.write(msg); } catch { sseClients.delete(client); }
        }
    };

    // ── Ticket helpers ──
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
        if (!canAccessGuild(req, req.params.id)) return res.status(403).json({ error: 'You do not have access to this server' });
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

    // ── Error Log Viewer ──
    // Bot-wide error feed persisted by logError() into error_logs.
    app.get('/api/errors', requireAuth, requireOwner, (req, res) => {
        try {
            const tag = req.query.tag || null;
            const limit = Math.min(parseInt(req.query.limit) || 100, 300);
            const errors = getErrorLogs(limit, tag).map(e => ({
                id: e.id,
                tag: e.tag,
                message: e.message,
                extra: e.extra,
                meta: e.meta,
                stack: e.stack,
                timestamp: e.timestamp,
            }));
            res.json({ errors, tags: getErrorTagCounts(limit) });
        } catch (err) {
            logError(err, 'dashboard', 'GET /api/errors');
            res.status(500).json({ error: err.message });
        }
    });

    app.delete('/api/errors', requireAuth, requireOwner, (req, res) => {
        try {
            clearErrorLogs(req.query.tag || null);
            res.json({ success: true });
        } catch (err) {
            logError(err, 'dashboard', 'DELETE /api/errors');
            res.status(500).json({ error: err.message });
        }
    });

    // ── Health Check (no auth — hosts probe this to restart hung containers) ──
    app.get('/health', (req, res) => {
        res.json({
            status: 'ok',
            botReady: !!(client && client.isReady && client.isReady()),
            uptime: Math.round(process.uptime()),
            db: 'ok',
            timestamp: Date.now(),
        });
    });

    // ── Prometheus Metrics (no auth — for scraping) ──
    app.get('/metrics', (req, res) => {
        const mem = process.memoryUsage();
        const cpu = process.cpuUsage();
        const guildCount = client?.guilds?.cache?.size || 0;
        const userCount = client?.guilds?.cache?.reduce((a, g) => a + g.memberCount, 0) || 0;
        const uptime = process.uptime();
        
        // Command usage from DB
        let cmdTotal = 0, cmdUnique = 0;
        try {
            const db = getDb();
            const total = db.prepare('SELECT COUNT(*) as total FROM command_usage').get();
            const unique = db.prepare('SELECT COUNT(DISTINCT user_id) as users FROM command_usage').get();
            cmdTotal = total?.total || 0;
            cmdUnique = unique?.users || 0;
        } catch {}

        const metrics = [
            '# HELP bot_uptime_seconds Bot uptime in seconds',
            '# TYPE bot_uptime_seconds gauge',
            `bot_uptime_seconds ${uptime.toFixed(1)}`,
            '',
            '# HELP bot_guilds_total Number of guilds the bot is in',
            '# TYPE bot_guilds_total gauge',
            `bot_guilds_total ${guildCount}`,
            '',
            '# HELP bot_users_total Total users across all guilds',
            '# TYPE bot_users_total gauge',
            `bot_users_total ${userCount}`,
            '',
            '# HELP bot_memory_rss_bytes Resident set size in bytes',
            '# TYPE bot_memory_rss_bytes gauge',
            `bot_memory_rss_bytes ${mem.rss}`,
            '',
            '# HELP bot_memory_heap_used_bytes Heap used in bytes',
            '# TYPE bot_memory_heap_used_bytes gauge',
            `bot_memory_heap_used_bytes ${mem.heapUsed}`,
            '',
            '# HELP bot_memory_heap_total_bytes Heap total in bytes',
            '# TYPE bot_memory_heap_total_bytes gauge',
            `bot_memory_heap_total_bytes ${mem.heapTotal}`,
            '',
            '# HELP bot_cpu_user_microseconds CPU user time in microseconds',
            '# TYPE bot_cpu_user_microseconds counter',
            `bot_cpu_user_microseconds ${cpu.user}`,
            '',
            '# HELP bot_cpu_system_microseconds CPU system time in microseconds',
            '# TYPE bot_cpu_system_microseconds counter',
            `bot_cpu_system_microseconds ${cpu.system}`,
            '',
            '# HELP bot_commands_total Total command executions',
            '# TYPE bot_commands_total counter',
            `bot_commands_total ${cmdTotal}`,
            '',
            '# HELP bot_commands_unique_users Unique command users',
            '# TYPE bot_commands_unique_users gauge',
            `bot_commands_unique_users ${cmdUnique}`,
            '',
            '# HELP bot_discord_ping_ms Discord websocket ping',
            '# TYPE bot_discord_ping_ms gauge',
            `bot_discord_ping_ms ${client?.ws?.ping || 0}`,
            '',
            '# HELP bot_circuit_breaker_state Discord API circuit breaker state (0=closed, 1=half-open, 2=open)',
            '# TYPE bot_circuit_breaker_state gauge',
            `bot_circuit_breaker_state ${({closed:0,'half-open':1,open:2}[discordApiBreaker?.getState?.() || 'closed'])}`,
        ].join('\n');

        res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
        res.send(metrics);
    });

    // ── Database Backups (owner-only) ──
    app.get('/api/backups', requireAuth, (req, res) => {
        if (!checkOwner(req)) return res.status(403).json({ error: 'Only the bot owner can manage backups' });
        res.json({ backups: listBackups() });
    });
    app.post('/api/backups', requireAuth, (req, res) => {
        if (!checkOwner(req)) return res.status(403).json({ error: 'Only the bot owner can manage backups' });
        const backup = backupDatabase();
        if (!backup) return res.status(500).json({ error: 'Backup failed' });
        res.json({ success: true, backup, backups: listBackups() });
    });
    app.get('/api/backups/download/:name', requireAuth, (req, res) => {
        if (!checkOwner(req)) return res.status(403).json({ error: 'Only the bot owner can manage backups' });
        const name = req.params.name;
        if (!/^bot-\d{14}\.db$/.test(name)) return res.status(400).json({ error: 'Invalid backup name' });
        const fp = path.join(getDataDir(), 'backups', name);
        if (!fs.existsSync(fp)) return res.status(404).json({ error: 'Backup not found' });
        res.download(fp, name);
    });
    app.delete('/api/backups/:name', requireAuth, (req, res) => {
        if (!checkOwner(req)) return res.status(403).json({ error: 'Only the bot owner can manage backups' });
        const name = req.params.name;
        if (!/^bot-\d{14}\.db$/.test(name)) return res.status(400).json({ error: 'Invalid backup name' });
        res.json({ success: deleteBackup(name), backups: listBackups() });
    });

    // ── Bulk Export/Import (owner-only) ──
    app.get('/api/export/all', requireAuth, requireOwner, (req, res) => {
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        try {
            const db = getDb();
            const exportData = {
                exportedAt: new Date().toISOString(),
                botName: client.user?.tag || 'Unknown',
                version: require('../package.json').version || '1.0.0',
                // Core config
                guildConfigs: db.prepare('SELECT * FROM guild_config').all(),
                botConfig: db.prepare('SELECT * FROM bot_config').all(),
                permissions: db.prepare('SELECT * FROM permissions').all(),
                reactionRoles: db.prepare('SELECT * FROM reaction_roles').all(),
                // Moderation
                warnings: db.prepare('SELECT * FROM warnings').all(),
                modCases: db.prepare('SELECT * FROM mod_cases').all(),
                modCaseCounters: db.prepare('SELECT * FROM mod_case_counters').all(),
                banAppeals: db.prepare('SELECT * FROM ban_appeals').all(),
                warningThresholds: db.prepare('SELECT * FROM warning_thresholds').all(),
                // Auto-mod
                automodRules: db.prepare('SELECT * FROM automod_rules').all(),
                automodFilters: db.prepare('SELECT * FROM automod_filters').all(),
                automodConfig: db.prepare('SELECT * FROM automod_config').all(),
                // Reminders & Giveaways
                reminders: db.prepare('SELECT * FROM reminders').all(),
                giveaways: db.prepare('SELECT * FROM giveaways').all(),
                // Voice & Temp VC
                voicePresence: db.prepare('SELECT * FROM voice_presence').all(),
                tempVcConfig: db.prepare('SELECT * FROM temp_vc_config').all(),
                tempVcTriggers: db.prepare('SELECT * FROM temp_vc_triggers').all(),
                tempVcChannels: db.prepare('SELECT * FROM temp_vc_channels').all(),
                tempVcPanels: db.prepare('SELECT * FROM temp_vc_panels').all(),
                // Tickets
                ticketConfig: db.prepare('SELECT * FROM ticket_config').all(),
                ticketPanels: db.prepare('SELECT * FROM ticket_panels').all(),
                ticketPanelTypes: db.prepare('SELECT * FROM ticket_panel_types').all(),
                tickets: db.prepare('SELECT * FROM tickets').all(),
                ticketMessages: db.prepare('SELECT * FROM ticket_messages').all(),
                ticketRatings: db.prepare('SELECT * FROM ticket_ratings').all(),
                ticketBlacklist: db.prepare('SELECT * FROM ticket_blacklist').all(),
                // Reaction roles & role menus
                roleMenus: db.prepare('SELECT * FROM role_menus').all(),
                roleMenuOptions: db.prepare('SELECT * FROM role_menu_options').all(),
                // Server stats & activity
                guildStats: db.prepare('SELECT * FROM guild_stats').all(),
                statsSnapshots: db.prepare('SELECT * FROM stats_snapshots').all(),
                activityCounts: db.prepare('SELECT * FROM activity_counts').all(),
                messageLog: db.prepare('SELECT * FROM message_log').all(),
                // Polls
                pollVotes: db.prepare('SELECT * FROM poll_votes').all(),
                // Invites
                inviteTracking: db.prepare('SELECT * FROM invite_tracking').all(),
                inviteUses: db.prepare('SELECT * FROM invite_uses').all(),
                // Staff notes
                staffNotes: db.prepare('SELECT * FROM staff_notes').all(),
                // Temp bans
                tempBans: db.prepare('SELECT * FROM temp_bans').all(),
                // Dashboard
                dashConfig: db.prepare('SELECT * FROM dash_config').all(),
                dashUsers: db.prepare('SELECT * FROM dash_users').all(),
                dashUserGuilds: db.prepare('SELECT * FROM dash_user_guilds').all(),
                // Dashboard config
                dashConfigSingle: db.prepare('SELECT * FROM dash_config WHERE id = 1').get(),
            };
            res.json({ success: true, data: exportData });
        } catch (err) {
            logError(err, 'dashboard', 'export_all');
            res.status(500).json({ error: err.message });
        }
    });

    app.post('/api/import/all', requireAuth, requireOwner, (req, res) => {
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        const data = req.body?.data;
        if (!data) return res.status(400).json({ error: 'Missing data' });
        try {
            const db = getDb();
            const tx = db.transaction(() => {
                // Import all tables with conflict resolution
                const tables = [
                    'guild_config', 'bot_config', 'permissions', 'reaction_roles', 'warnings',
                    'mod_cases', 'mod_case_counters', 'ban_appeals', 'warning_thresholds',
                    'automod_rules', 'automod_filters', 'automod_config', 'reminders', 'giveaways',
                    'voice_presence', 'temp_vc_config', 'temp_vc_triggers', 'temp_vc_channels', 'temp_vc_panels',
                    'ticket_config', 'ticket_panels', 'ticket_panel_types', 'tickets', 'ticket_messages',
                    'ticket_ratings', 'ticket_blacklist', 'role_menus', 'role_menu_options',
                    'guild_stats', 'stats_snapshots', 'activity_counts', 'message_log',
                    'poll_votes', 'invite_tracking', 'invite_uses', 'staff_notes', 'temp_bans',
                    'dash_config', 'dash_users', 'dash_user_guilds'
                ];
                for (const table of tables) {
                    if (data[table] && Array.isArray(data[table])) {
                        db.prepare(`DELETE FROM ${table}`).run();
                        if (data[table].length > 0) {
                            const cols = Object.keys(data[table][0]);
                            const placeholders = cols.map(() => '?').join(',');
                            const insert = db.prepare(`INSERT OR REPLACE INTO ${table} (${cols.join(',')}) VALUES (${placeholders})`);
                            const tx2 = db.transaction((rows) => {
                                for (const row of rows) {
                                    insert.run(...cols.map(c => row[c]));
                                }
                            });
                            tx2(data[table]);
                        }
                    }
                }
            });
            tx();
            res.json({ success: true });
        } catch (err) {
            logError(err, 'dashboard', 'import_all');
            res.status(500).json({ error: err.message });
        }
    });

    // ── Dashboard Audit Trail (owner-only) ──
    app.get('/api/audit-trail', requireAuth, requireOwner, (req, res) => {
        const limit = Math.min(parseInt(req.query.limit) || 100, 500);
        const offset = parseInt(req.query.offset) || 0;
        const type = req.query.type || null;
        try {
            const db = getDb();
            let query = 'SELECT * FROM audit_trail ORDER BY created_at DESC LIMIT ? OFFSET ?';
            let params = [limit, offset];
            if (type) {
                query = 'SELECT * FROM audit_trail WHERE type = ? ORDER BY created_at DESC LIMIT ? OFFSET ?';
                params = [type, limit, offset];
            }
            const trails = db.prepare(query).all(...params);
            res.json({ trails });
        } catch (err) {
            logError(err, 'dashboard', 'audit_trail_get');
            res.status(500).json({ error: err.message });
        }
    });

    // ── Error Alert Channel (owner-only) ──
    // Bot-wide setting: where critical errors (uncaughtException etc.) get pinged.
    app.get('/api/errors/alert', requireAuth, requireOwner, (req, res) => {
        if (!checkOwner(req)) return res.status(403).json({ error: 'Only the bot owner can configure alerts' });
        const row = getDb().prepare('SELECT value FROM bot_config WHERE key = ?').get('bot_error_alert_channel');
        let channelId = (row && row.value) || '';
        const guilds = client ? Array.from(client.guilds.cache.values()).slice(0, 40).map(g => ({
            id: g.id,
            name: g.name,
            channels: g.channels.cache.filter(c => c.type === 0 || c.type === 5).first(60).map(c => ({ id: c.id, name: c.name })),
        })).filter(g => g.channels.length) : [];
        // Make sure the guild owning the saved alert channel is always offered,
        // even if it falls outside the 40-guild cap above.
        if (channelId && client && !guilds.some(g => g.channels.some(c => c.id === channelId))) {
            const saved = client.channels.cache.get(channelId);
            if (saved && saved.guild) {
                const gc = {
                    id: saved.guild.id,
                    name: saved.guild.name,
                    channels: saved.guild.channels.cache.filter(c => c.type === 0 || c.type === 5).first(60).map(c => ({ id: c.id, name: c.name })),
                };
                if (gc.channels.some(c => c.id === channelId)) guilds.unshift(gc);
            }
        }
        res.json({ channelId, guilds });
    });
    app.post('/api/errors/alert', requireAuth, requireOwner, (req, res) => {
        if (!checkOwner(req)) return res.status(403).json({ error: 'Only the bot owner can configure alerts' });
        const channelId = (req.body && req.body.channelId || '').trim();
        getDb().prepare('INSERT OR REPLACE INTO bot_config (key, value) VALUES (?, ?)').run('bot_error_alert_channel', channelId);
        res.json({ success: true, channelId });
    });

    // ── Member Lookup (Moderation section) ──
    app.get('/api/server/:id/members/search', requireAuth, (req, res) => {
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'Server not found' });
        const q = (req.query.q || '').trim().toLowerCase();
        if (!q) return res.json({ members: [] });
        const members = [];
        for (const m of guild.members.cache.values()) {
            const tag = (m.user ? m.user.tag : '').toLowerCase();
            const name = (m.displayName || '').toLowerCase();
            if (m.id === q || tag.includes(q) || name.includes(q)) {
                members.push({
                    id: m.id,
                    tag: m.user ? m.user.tag : m.id,
                    displayName: m.displayName || (m.user ? m.user.username : ''),
                    avatar: m.user ? m.user.displayAvatarURL({ size: 64 }) : null,
                    isBot: !!(m.user && m.user.bot),
                    joinedAt: m.joinedTimestamp || null,
                });
                if (members.length >= 8) break;
            }
        }
        res.json({ members });
    });

    app.get('/api/server/:id/member/:userId/profile', requireAuth, (req, res) => {
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'Server not found' });
        try {
            const userId = req.params.userId;
            const m = guild.members.cache.get(userId);
            const member = m ? {
                id: m.id,
                tag: m.user ? m.user.tag : m.id,
                displayName: m.displayName || (m.user ? m.user.username : ''),
                avatar: m.user ? m.user.displayAvatarURL({ size: 128 }) : null,
                isBot: !!(m.user && m.user.bot),
                joinedAt: m.joinedTimestamp || null,
                roles: m.roles ? m.roles.cache.filter(r => r.id !== guild.id).map(r => ({ id: r.id, name: r.name, color: r.hexColor })).slice(0, 12) : [],
            } : null;
            const warnings = getWarnings(guild.id, userId);
            const notes = getNotesForUser(guild.id, userId).map(n => ({
                id: n.id,
                note: n.note,
                authorTag: n.author_tag,
                createdAt: n.created_at,
            }));
            const cases = getCases(guild.id, userId, 30).map(c => ({
                caseNumber: c.case_number,
                actionType: c.action_type,
                reason: c.reason,
                moderatorTag: c.moderator_tag,
                active: !!c.active,
                createdAt: c.created_at,
            }));
            const invites = getInviterStats(guild.id, userId);
            res.json({ member, warnings, notes, cases, invites });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
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

    // ── Centralized Error Middleware ──
    // Catches any error thrown by the routes above so the API always returns a
    // clean JSON envelope instead of a stack-trace HTML page or a hung request.
    app.use((err, req, res, next) => {
        // Malformed JSON body (e.g. truncated fetch) — client error, not a 500.
        // body-parser sets type='entity.parse.failed' specifically for this case.
        if (err && err.type === 'entity.parse.failed') {
            return res.status(400).json({ error: 'Invalid JSON body' });
        }
        logError(err, 'dashboard', req.method + ' ' + (req.originalUrl || req.url));
        const status = (err && (err.statusCode || err.status)) || 500;
        res.status(status).json({ error: 'Internal server error' });
    });

    return app;
}

module.exports = { createDashboard, setDashboardClient, addDashUser, removeDashUser, getDashUsers };
