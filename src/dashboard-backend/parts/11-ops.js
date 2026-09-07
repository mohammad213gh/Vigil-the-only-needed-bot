// ──────────────────── Part 11: Ops & frontend shell ────────────────────
// API tokens, rate-limit configuration, error log viewer, health and
// metrics probes, backups, bulk export/import, the dashboard audit trail,
// the error alert channel — and finally the frontend serving plus the
// centralized error handler (always registered last).

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { getDb, getErrorLogs, getErrorTagCounts, clearErrorLogs, backupDatabase, listBackups, deleteBackup } = require('../../db');
const { getDataDir } = require('../../data');
const { logError } = require('../../logError');
const { discordApiBreaker } = require('../../helpers');
const { getClient } = require('../core');

function register(app, ctx) {
    const { requireAuth, requireOwner, checkOwner } = ctx;

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
        const client = getClient();
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
        const client = getClient();
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
        const client = getClient();
        if (!client) return res.status(503).json({ error: 'Bot not ready' });
        try {
            const db = getDb();
            const exportData = {
                exportedAt: new Date().toISOString(),
                botName: client.user?.tag || 'Unknown',
                version: require('../../../package.json').version || '1.0.0',
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
        const client = getClient();
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
        const client = getClient();
        if (!checkOwner(req)) return res.status(403).json({ error: 'Only the bot owner can configure alerts' });
        const row = getDb().prepare('SELECT value FROM bot_config WHERE key = ?').get('bot_error_alert_channel');
        const channelId = (row && row.value) || '';
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

    // ── Serve Frontend ──
    // The dashboard frontend is served as true ES modules from
    // src/dashboard/parts/ (index.html loads 00-entry.mjs); express.static
    // below serves them with a JavaScript MIME type.
    const frontendDir = path.join(__dirname, '..', '..', 'dashboard');
    app.get('/', (req, res) => {
        if (!req.authenticated) return res.redirect('/login');
        res.sendFile(path.join(frontendDir, 'index.html'));
    });
    app.get('/login', (req, res) => {
        if (req.authenticated) return res.redirect('/');
        res.sendFile(path.join(frontendDir, 'login.html'));
    });
    app.use('/static', require('express').static(frontendDir));

    // ── Centralized Error Middleware ──
    // Catches any error thrown by the routes above so the API always returns a
    // clean JSON envelope instead of a stack-trace HTML page or a hung request.
    app.use((err, req, res, _next) => {
        // Malformed JSON body (e.g. truncated fetch) — client error, not a 500.
        // body-parser sets type='entity.parse.failed' specifically for this case.
        if (err && err.type === 'entity.parse.failed') {
            return res.status(400).json({ error: 'Invalid JSON body' });
        }
        logError(err, 'dashboard', req.method + ' ' + (req.originalUrl || req.url));
        const status = (err && (err.statusCode || err.status)) || 500;
        res.status(status).json({ error: 'Internal server error' });
    });
}

module.exports = { register };
