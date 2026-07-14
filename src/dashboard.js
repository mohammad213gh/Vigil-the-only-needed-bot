const express = require('express');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { formatUptime, formatNumber } = require('./helpers');
const { loadConfig, saveConfig, getBotConfig } = require('./config');
const { getDataPath } = require('./data');
const { getGuildStats, loadStats } = require('./stats');
const { getReactionRoles } = require('./reactionRoles');
const { getAllPermissions } = require('./permissions');
const { LOG_CATEGORIES, WS_STATUS } = require('./constants');
const multer = require('multer');

let client = null;
let dashboardPassword = '';

function setDashboardClient(c, password) {
    client = c;
    if (!password) {
        console.error('[Dashboard] DASHBOARD_PASSWORD is not set! Please set it in your .env file.');
    }
    dashboardPassword = password;
}

const DASHBOARD_CFG_PATH = getDataPath('dashboardConfig.json');
const DASH_USERS_PATH = getDataPath('dashUsers.json');

// ─── Migration from old config.json ───
function migrateFromConfig() {
    try {
        const config = loadConfig();
        let changed = false;
        if (config._dash && Object.keys(config._dash).length > 0) {
            fs.writeFileSync(DASHBOARD_CFG_PATH, JSON.stringify(config._dash, null, 4));
            delete config._dash;
            changed = true;
            console.log('[Migration] Moved dashboard config to data/dashboardConfig.json');
        }
        if (config._dashUsers && Object.keys(config._dashUsers).length > 0) {
            fs.writeFileSync(DASH_USERS_PATH, JSON.stringify(config._dashUsers, null, 4));
            delete config._dashUsers;
            changed = true;
            console.log('[Migration] Moved dashboard users to data/dashUsers.json');
        }
        if (changed) {
            saveConfig(config);
        }
    } catch { /* no migration needed */ }
}

// ──── Dashboard Config ────
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
    dockEnabled: true,
    dockPosition: 'bottom',
    dockMagnification: 70,
    cardGlow: true,
    ambientLight: true,
    headerStyle: 'minimal',
    borderRadius: 'rounded',
    showDockLabels: true,
    botAvatarUrl: null,
};

function loadDashConfig() {
    try {
        return JSON.parse(fs.readFileSync(DASHBOARD_CFG_PATH, 'utf8'));
    } catch {
        migrateFromConfig();
        return {};
    }
}

function saveDashConfig(cfg) {
    try {
        fs.writeFileSync(DASHBOARD_CFG_PATH, JSON.stringify(cfg, null, 4));
    } catch (err) {
        console.error('[Dashboard] Failed to save config:', err.message);
    }
}

function loadDashUsers() {
    try {
        return JSON.parse(fs.readFileSync(DASH_USERS_PATH, 'utf8'));
    } catch {
        migrateFromConfig();
        return {};
    }
}

function saveDashUsers(users) {
    try {
        fs.writeFileSync(DASH_USERS_PATH, JSON.stringify(users, null, 4));
    } catch (err) {
        console.error('[Dashboard] Failed to save users:', err.message);
    }
}

function getDashboardConfig() {
    const cfg = loadDashConfig();
    if (!cfg.accentColor) {
        // First load — merge defaults
        const merged = { ...DEFAULT_DASHBOARD_CONFIG, ...cfg };
        saveDashConfig(merged);
        return merged;
    }
    return cfg;
}

function updateDashboardConfig(partial) {
    const cfg = loadDashConfig();
    const updated = { ...DEFAULT_DASHBOARD_CONFIG, ...cfg, ...partial };
    saveDashConfig(updated);
    return updated;
}

// ──── Dashboard Users (Discord ID auth) ────
function getDashUsers() {
    return loadDashUsers();
}

function generateAccessToken() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let s = '';
    for (let i = 0; i < 24; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return 'dash_' + s;
}

function addDashUser(userId, addedBy) {
    const users = loadDashUsers();
    const token = generateAccessToken();
    users[userId] = {
        addedAt: Date.now(),
        addedBy: addedBy || 'unknown',
        active: true,
        accessToken: token,
    };
    saveDashUsers(users);
    return { users, accessToken: token };
}

function removeDashUser(userId) {
    const users = loadDashUsers();
    if (users[userId]) {
        delete users[userId];
        saveDashUsers(users);
    }
}

function isDashUser(userId, accessToken) {
    const users = loadDashUsers();
    if (!userId || !users[userId] || !users[userId].active) return false;
    if (accessToken) {
        return users[userId].accessToken === accessToken;
    }
    return false;
}

// ──── Sessions ────
const sessions = new Map();
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
        req.authenticated = !!(token && sessions.has(token));
        next();
    });

    // ── Auth (password OR Discord ID + Access Token) ──
    app.post('/api/login', (req, res) => {
        const { password, discordId, accessToken } = req.body;
        if (password && password === dashboardPassword) {
            const token = generateSession();
            sessions.set(token, true);
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
                sessions.set(token, true);
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
        const config = loadConfig();
        if (!config[guild.id]) config[guild.id] = {};
        const { category, channelId, enabled, trackedChannel, trackedChannels } = req.body;
        if (!config[guild.id].logChannels) config[guild.id].logChannels = {};
        if (!config[guild.id].logCategories) config[guild.id].logCategories = {};
        if (!config[guild.id].trackedChannels) config[guild.id].trackedChannels = [];
        if (category) {
            if (channelId !== undefined) config[guild.id].logChannels[category] = channelId || null;
            if (enabled !== undefined) config[guild.id].logCategories[category] = enabled;
        }
        if (trackedChannel !== undefined) {
            const tc = config[guild.id].trackedChannels;
            if (trackedChannels === 'set') {
                config[guild.id].trackedChannels = Array.isArray(trackedChannel) ? trackedChannel : [trackedChannel];
            } else if (trackedChannels === 'add') {
                if (!tc.includes(trackedChannel)) tc.push(trackedChannel);
            } else if (trackedChannels === 'remove') {
                config[guild.id].trackedChannels = tc.filter(id => id !== trackedChannel);
            } else if (trackedChannels === 'clear') {
                config[guild.id].trackedChannels = [];
            }
        }
        saveConfig(config);
        res.json({ success: true });
    });

    // ── Server Management: Batch update logging config (save all at once) ──
    app.post('/api/server/:id/log/config/batch', requireAuth, (req, res) => {
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'Server not found' });
        const config = loadConfig();
        if (!config[guild.id]) config[guild.id] = {};
        if (!config[guild.id].logChannels) config[guild.id].logChannels = {};
        if (!config[guild.id].logCategories) config[guild.id].logCategories = {};
        if (!config[guild.id].trackedChannels) config[guild.id].trackedChannels = [];
        
        const { categories } = req.body;
        if (Array.isArray(categories)) {
            for (const cat of categories) {
                if (cat.category) {
                    if (cat.channelId !== undefined) {
                        config[guild.id].logChannels[cat.category] = cat.channelId || null;
                    }
                    if (cat.enabled !== undefined) {
                        config[guild.id].logCategories[cat.category] = cat.enabled;
                    }
                }
            }
        }
        
        saveConfig(config);
        res.json({ success: true });
    });

    // ── Server Detail ──
    app.get('/api/server/:id', requireAuth, (req, res) => {
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'Server not found' });
        const config = loadConfig();
        const guildConfig = config[guild.id] || {};
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
