// ──────────────────── Part 10: Insights & real-time events ────────────────
// SSE event stream, activity timeline, multi-server analytics, aggregate
// stats, system info, the commands explorer, and per-server insights.

const os = require('os');
const { getDb } = require('../../db');
const { getGuildStats } = require('../../stats');
const { formatUptime } = require('../../helpers');
const { getClient } = require('../core');

function register(app, ctx) {
    const { requireAuth, getScopedGuildIds, filterByScope } = ctx;

    // ── Bot Activity Timeline ──
    app.get('/api/activity/timeline', requireAuth, (req, res) => {
        const client = getClient();
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
        const client = getClient();
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
        const client = getClient();
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

    // ── Aggregate Stats ──
    app.get('/api/stats/aggregate', requireAuth, (req, res) => {
        const client = getClient();
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
        const client = getClient();
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
        const client = getClient();
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
        const client = getClient();
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
        for (const [res, scoped] of sseClients) {
            if (scoped) {
                const gid = data && data.guildId !== undefined ? String(data.guildId) : null;
                if (!gid || !scoped.has(gid)) continue;
            }
            const msg = 'data: ' + JSON.stringify({ type: type, data: data, time: Date.now() }) + '\n\n';
            try { res.write(msg); } catch { sseClients.delete(res); }
        }
    };

    // ── Server Insights: Message activity ──
    app.get('/api/insights/:id', requireAuth, (req, res) => {
        const client = getClient();
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        const guild = client.guilds.cache.get(req.params.id);
        if (!guild) return res.status(404).json({ error: 'Server not found' });
        if (!ctx.canAccessGuild(req, req.params.id)) return res.status(403).json({ error: 'You do not have access to this server' });
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
}

module.exports = { register };
