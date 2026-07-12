const express = require('express');
const path = require('path');
const os = require('os');
const { formatUptime, formatNumber } = require('./helpers');
const { loadConfig, saveConfig, getBotConfig } = require('./config');
const { getGuildStats } = require('./stats');
const { getReactionRoles } = require('./reactionRoles');
const { getAllPermissions } = require('./permissions');
const { LOG_CATEGORIES, WS_STATUS } = require('./constants');

let client = null;
let dashboardPassword = '';

function setDashboardClient(c, password) {
    client = c;
    dashboardPassword = password || 'admin';
}

// ──────────────────── Dashboard Config ────────────────────

const DASHBOARD_CFG_KEY = '_dash';

function getDashboardConfig() {
    const config = loadConfig();
    if (!config[DASHBOARD_CFG_KEY]) {
        config[DASHBOARD_CFG_KEY] = {
            accentColor: '#5865F2',
            title: 'Bot Dashboard',
            backgroundImage: null,
            backgroundBlur: 0,
            showWidgets: {
                status: true,
                servers: true,
                reminders: true,
                quickActions: true,
            },
            refreshInterval: 5,
            layout: 'default',
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

// ──────────────────── Session Helper ────────────────────

const sessions = new Map();

function generateSession() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let s = '';
    for (let i = 0; i < 32; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
}

// ──────────────────── Create Server ────────────────────

function createDashboard() {
    const app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // Session middleware
    app.use((req, res, next) => {
        const token = req.headers.cookie?.match(/session=([^;]+)/)?.[1];
        req.authenticated = !!(token && sessions.has(token));
        next();
    });

    // ── Auth Routes ──

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

    // ── Auth Middleware ──

    function requireAuth(req, res, next) {
        if (!req.authenticated) return res.status(401).json({ error: 'Not authenticated' });
        next();
    }

    // ── API: Dashboard Config ──

    app.get('/api/dash/config', requireAuth, (req, res) => {
        res.json(getDashboardConfig());
    });

    app.post('/api/dash/config', requireAuth, (req, res) => {
        const updated = updateDashboardConfig(req.body);
        res.json({ success: true, config: updated });
    });

    // ── API: Bot Status ──

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
            nodeVersion: process.version,
            platform: os.platform(),
            cpuCores: os.cpus().length,
        });
    });

    // ── API: Servers List ──

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

    // ── API: Server Detail ──

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
        });
    });

    // ── API: Reminders ──

    app.get('/api/reminders', requireAuth, (req, res) => {
        try {
            const reminders = require('./reminders');
            const all = reminders.getAllPending();
            res.json(all.slice(0, 50).map(r => ({
                id: r.id,
                text: r.text.slice(0, 100),
                remindAt: r.remindAt,
                createdAt: r.createdAt,
                userId: r.userId,
            })));
        } catch {
            res.json([]);
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

    return app;
}

module.exports = { createDashboard, setDashboardClient };
