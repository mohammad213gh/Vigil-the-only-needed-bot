const express = require('express');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { formatUptime, formatNumber } = require('./helpers');
const { loadConfig, saveConfig, getBotConfig } = require('./config');
const { getGuildStats } = require('./stats');
const { getReactionRoles } = require('./reactionRoles');
const { getAllPermissions } = require('./permissions');
const { LOG_CATEGORIES, WS_STATUS } = require('./constants');
const multer = require('multer');

let client = null;
let dashboardPassword = '';

function setDashboardClient(c, password) {
    client = c;
    dashboardPassword = password || 'admin';
}

const DASHBOARD_CFG_KEY = '_dash';

function getDashboardConfig() {
    const config = loadConfig();
    if (!config[DASHBOARD_CFG_KEY]) {
        config[DASHBOARD_CFG_KEY] = {
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
            layout: 'default',
            theme: 'dark',
            cardStyle: 'glass',
        };
        saveConfig(config);
    }
    return config[DASHBOARD_CFG_KEY];
}

function updateDashboardConfig(partial) {
    const config = loadConfig();
    if (!config[DASHBOARD_CFG_KEY]) config[DASHBOARD_CFG_KEY] = {};
    Object.assign(config[DASHBOARD_CFG_KEY], partial);
    saveConfig(config);
    return config[DASHBOARD_CFG_KEY];
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
const uploadsDir = path.join(__dirname, '..', 'uploads');
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

    // ── Auth ──
    app.post('/api/login', (req, res) => {
        const { password } = req.body;
        if (password === dashboardPassword) {
            const token = generateSession();
            sessions.set(token, true);
            res.json({ success: true, token });
        } else {
            res.status(401).json({ success: false, error: 'Invalid password' });
        }
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
        });
    });

    // ── Servers List ──
    app.get('/api/servers', requireAuth, (req, res) => {
        if (!client) return res.json([]);
        const servers = client.guilds.cache.map(g => ({
            id: g.id,
            name: g.name,
            icon: g.iconURL({ size: 64 }) || '',
            memberCount: g.memberCount,
            boostTier: g.premiumTier,
            boostCount: g.premiumSubscriptionCount || 0,
            channels: g.channels.cache.size,
        })).sort((a, b) => b.memberCount - a.memberCount);
        res.json(servers);
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
            id: guild.id,
            name: guild.name,
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

    // ── Aggregate Stats (for analytics) ──
    app.get('/api/stats/aggregate', requireAuth, (req, res) => {
        if (!client) return res.json({});
        const totalJoins = client.guilds.cache.reduce((a, g) => {
            const s = getGuildStats(g.id);
            return a + (s.totalJoins || 0);
        }, 0);
        const totalLeaves = client.guilds.cache.reduce((a, g) => {
            const s = getGuildStats(g.id);
            return a + (s.totalLeaves || 0);
        }, 0);
        // Collect all snapshots
        const allSnapshots = [];
        client.guilds.cache.forEach(g => {
            const s = getGuildStats(g.id);
            if (s.dailySnapshots) allSnapshots.push(...s.dailySnapshots);
        });
        // Aggregate by date
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

    // ── Activity Feed (recent server events) ──
    app.get('/api/activity', requireAuth, (req, res) => {
        if (!client) return res.json([]);
        const recent = [];
        client.guilds.cache.forEach(g => {
            const s = getGuildStats(g.id);
            if (s.recentActivity) {
                recent.push(...s.recentActivity.slice(-10).map(a => ({
                    ...a, guildName: g.name, guildId: g.id,
                })));
            }
            // Add guild joins
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
        const cpuUsage = os.loadavg();
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        res.json({
            platform: os.platform(),
            release: os.release(),
            hostname: os.hostname(),
            cpuModel: os.cpus()[0]?.model || 'Unknown',
            cpuCores: os.cpus().length,
            cpuLoad: cpuUsage,
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

    // ── Dashboard Logs (recent bot console logs) ──
    app.get('/api/logs', requireAuth, (req, res) => {
        res.json([]);
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

module.exports = { createDashboard, setDashboardClient };
