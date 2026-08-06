const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const { getDataDir } = require('./data');
const { logError } = require('./logError');

// ──────────────────── Database Initialization ────────────────────

const DB_PATH = path.join(getDataDir(), 'bot.db');

let db;

function getDb() {
    if (!db) {
        db = new Database(DB_PATH);
        db.pragma('journal_mode = WAL');   // Better concurrent read performance
        db.pragma('foreign_keys = ON');
        initSchema();
    }
    return db;
}

// ──────────────────── Schema ────────────────────

function initSchema() {
    db.exec(`
        CREATE TABLE IF NOT EXISTS guild_config (
            guild_id TEXT PRIMARY KEY,
            default_channel TEXT,
            tracked_channels TEXT NOT NULL DEFAULT '[]',
            log_channels TEXT NOT NULL DEFAULT '{}',
            log_categories TEXT NOT NULL DEFAULT '{}'
        );

        CREATE TABLE IF NOT EXISTS bot_config (
            key TEXT PRIMARY KEY,
            value TEXT
        );

        CREATE TABLE IF NOT EXISTS permissions (
            guild_id TEXT NOT NULL,
            command TEXT NOT NULL,
            user_id TEXT NOT NULL,
            PRIMARY KEY (guild_id, command, user_id)
        );

        CREATE TABLE IF NOT EXISTS reaction_roles (
            guild_id TEXT NOT NULL,
            message_id TEXT NOT NULL,
            channel_id TEXT NOT NULL,
            emoji TEXT NOT NULL,
            role_id TEXT NOT NULL,
            label TEXT,
            PRIMARY KEY (guild_id, message_id, emoji)
        );

        CREATE TABLE IF NOT EXISTS warnings (
            id TEXT PRIMARY KEY,
            guild_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            moderator TEXT NOT NULL,
            reason TEXT NOT NULL,
            date TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_warnings_guild_user ON warnings(guild_id, user_id);

        CREATE TABLE IF NOT EXISTS reminders (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            channel_id TEXT,
            text TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            remind_at INTEGER NOT NULL,
            notified INTEGER NOT NULL DEFAULT 0
        );

        CREATE INDEX IF NOT EXISTS idx_reminders_pending ON reminders(notified, remind_at);

        CREATE TABLE IF NOT EXISTS guild_stats (
            guild_id TEXT PRIMARY KEY,
            total_joins INTEGER NOT NULL DEFAULT 0,
            total_leaves INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS stats_snapshots (
            guild_id TEXT NOT NULL,
            date TEXT NOT NULL,
            joins INTEGER NOT NULL DEFAULT 0,
            leaves INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (guild_id, date)
        );

        CREATE TABLE IF NOT EXISTS dash_config (
            id INTEGER PRIMARY KEY DEFAULT 1,
            config TEXT NOT NULL DEFAULT '{}'
        );

        CREATE TABLE IF NOT EXISTS dash_users (
            user_id TEXT PRIMARY KEY,
            added_at INTEGER NOT NULL,
            added_by TEXT NOT NULL DEFAULT 'unknown',
            active INTEGER NOT NULL DEFAULT 1,
            access_token TEXT
        );

        CREATE TABLE IF NOT EXISTS poll_votes (
            message_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            option_index INTEGER NOT NULL,
            voted_at INTEGER NOT NULL,
            poll_type TEXT NOT NULL DEFAULT 'single',
            PRIMARY KEY (message_id, user_id, option_index)
        );

        CREATE TABLE IF NOT EXISTS message_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            guild_id TEXT NOT NULL,
            channel_id TEXT NOT NULL,
            message_id TEXT NOT NULL,
            author_id TEXT NOT NULL,
            author_tag TEXT NOT NULL,
            content TEXT,
            action TEXT NOT NULL,
            attachments TEXT,
            logged_at INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_msg_log_guild ON message_log(guild_id, action);
        CREATE INDEX IF NOT EXISTS idx_msg_log_time ON message_log(guild_id, logged_at);

        CREATE TABLE IF NOT EXISTS activity_counts (
            guild_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            channel_id TEXT NOT NULL,
            message_count INTEGER NOT NULL DEFAULT 1,
            PRIMARY KEY (guild_id, user_id, channel_id)
        );

        CREATE TABLE IF NOT EXISTS mod_cases (
            id TEXT PRIMARY KEY,
            guild_id TEXT NOT NULL,
            case_number INTEGER NOT NULL,
            user_id TEXT NOT NULL,
            moderator_id TEXT NOT NULL,
            moderator_tag TEXT NOT NULL,
            action_type TEXT NOT NULL,
            reason TEXT NOT NULL DEFAULT '',
            created_at INTEGER NOT NULL,
            active INTEGER NOT NULL DEFAULT 1
        );

        CREATE INDEX IF NOT EXISTS idx_mod_cases_guild ON mod_cases(guild_id, case_number);
        CREATE INDEX IF NOT EXISTS idx_mod_cases_user ON mod_cases(guild_id, user_id);

        CREATE TABLE IF NOT EXISTS mod_case_counters (
            guild_id TEXT PRIMARY KEY,
            next_case INTEGER NOT NULL DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS role_menus (
            guild_id TEXT NOT NULL,
            message_id TEXT NOT NULL,
            channel_id TEXT NOT NULL,
            title TEXT,
            created_at INTEGER NOT NULL,
            PRIMARY KEY (guild_id, message_id)
        );

        CREATE TABLE IF NOT EXISTS role_menu_options (
            message_id TEXT NOT NULL,
            role_id TEXT NOT NULL,
            label TEXT NOT NULL,
            emoji TEXT,
            description TEXT,
            sort_order INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (message_id, role_id)
        );

        CREATE TABLE IF NOT EXISTS automod_rules (
            guild_id TEXT NOT NULL,
            rule_type TEXT NOT NULL,
            enabled INTEGER NOT NULL DEFAULT 1,
            threshold INTEGER NOT NULL DEFAULT 5,
            time_window INTEGER NOT NULL DEFAULT 10,
            action TEXT NOT NULL DEFAULT 'warn',
            duration INTEGER,
            PRIMARY KEY (guild_id, rule_type)
        );

        CREATE TABLE IF NOT EXISTS automod_filters (
            guild_id TEXT NOT NULL,
            filter_type TEXT NOT NULL,
            pattern TEXT NOT NULL,
            action TEXT NOT NULL DEFAULT 'delete',
            PRIMARY KEY (guild_id, filter_type, pattern)
        );

        CREATE TABLE IF NOT EXISTS automod_config (
            guild_id TEXT PRIMARY KEY,
            included_channels TEXT NOT NULL DEFAULT '[]',
            excluded_channels TEXT NOT NULL DEFAULT '[]',
            whitelisted_roles TEXT NOT NULL DEFAULT '[]'
        );

        CREATE TABLE IF NOT EXISTS command_usage (
            guild_id TEXT NOT NULL,
            command TEXT NOT NULL,
            user_id TEXT NOT NULL,
            used_at INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_cmd_usage_guild ON command_usage(guild_id, command);
        CREATE INDEX IF NOT EXISTS idx_cmd_usage_time ON command_usage(used_at);

        CREATE INDEX IF NOT EXISTS idx_activity_guild ON activity_counts(guild_id, message_count DESC);

        CREATE TABLE IF NOT EXISTS invite_tracking (
            guild_id TEXT NOT NULL,
            code TEXT NOT NULL,
            inviter_id TEXT NOT NULL,
            uses INTEGER NOT NULL DEFAULT 0,
            max_uses INTEGER,
            temporary INTEGER NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL,
            expires_at INTEGER,
            PRIMARY KEY (guild_id, code)
        );

        CREATE TABLE IF NOT EXISTS invite_uses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            guild_id TEXT NOT NULL,
            code TEXT NOT NULL,
            inviter_id TEXT NOT NULL,
            joiner_id TEXT NOT NULL,
            joined_at INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_invite_uses_guild ON invite_uses(guild_id, inviter_id);
        CREATE INDEX IF NOT EXISTS idx_invite_uses_joiner ON invite_uses(joiner_id);

        CREATE TABLE IF NOT EXISTS staff_notes (
            id TEXT PRIMARY KEY,
            guild_id TEXT NOT NULL,
            target_user_id TEXT NOT NULL,
            author_id TEXT NOT NULL,
            author_tag TEXT NOT NULL,
            note TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER
        );

        CREATE INDEX IF NOT EXISTS idx_staff_notes_guild ON staff_notes(guild_id, target_user_id);

        CREATE TABLE IF NOT EXISTS temp_bans (
            user_id TEXT NOT NULL,
            guild_id TEXT NOT NULL,
            reason TEXT NOT NULL DEFAULT '',
            banned_at INTEGER NOT NULL,
            unban_at INTEGER NOT NULL,
            PRIMARY KEY (user_id, guild_id)
        );

        CREATE TABLE IF NOT EXISTS warning_thresholds (
            guild_id TEXT PRIMARY KEY,
            thresholds TEXT NOT NULL DEFAULT '[]'
        );

        CREATE TABLE IF NOT EXISTS ban_appeals (
            id TEXT PRIMARY KEY,
            guild_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            user_tag TEXT NOT NULL,
            reason TEXT NOT NULL,
            message TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            created_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS ticket_config (
            guild_id TEXT PRIMARY KEY,
            enabled INTEGER NOT NULL DEFAULT 0,
            ticket_count INTEGER NOT NULL DEFAULT 0,
            close_on_leave INTEGER NOT NULL DEFAULT 0,
            log_channel_id TEXT
        );

        CREATE TABLE IF NOT EXISTS ticket_panels (
            id TEXT PRIMARY KEY,
            guild_id TEXT NOT NULL,
            name TEXT NOT NULL,
            channel_id TEXT,
            panel_message_id TEXT,
            color TEXT NOT NULL DEFAULT '#5865F2',
            image_url TEXT,
            description TEXT NOT NULL DEFAULT 'Click the button below to create a ticket and a staff member will assist you.',
            created_at INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_ticket_panels_guild ON ticket_panels(guild_id);

        CREATE TABLE IF NOT EXISTS ticket_panel_types (
            id TEXT PRIMARY KEY,
            panel_id TEXT NOT NULL,
            guild_id TEXT NOT NULL,
            name TEXT NOT NULL,
            emoji TEXT NOT NULL DEFAULT '🎫',
            category_id TEXT,
            support_roles TEXT NOT NULL DEFAULT '[]',
            welcome_message TEXT NOT NULL DEFAULT 'Thank you for creating a ticket. A staff member will be with you shortly.',
            ticket_name_format TEXT NOT NULL DEFAULT 'ticket-{username}-{number}',
            questions TEXT NOT NULL DEFAULT '[]',
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_ticket_panel_types_panel ON ticket_panel_types(panel_id);

        CREATE TABLE IF NOT EXISTS tickets (
            id TEXT PRIMARY KEY,
            guild_id TEXT NOT NULL,
            ticket_number INTEGER NOT NULL,
            channel_id TEXT NOT NULL,
            creator_id TEXT NOT NULL,
            creator_tag TEXT NOT NULL,
            panel_type_id TEXT,
            panel_type_name TEXT,
            status TEXT NOT NULL DEFAULT 'open',
            reason TEXT,
            answers TEXT,
            created_at INTEGER NOT NULL,
            closed_by_id TEXT,
            closed_by_tag TEXT,
            closed_at INTEGER,
            claimer_id TEXT,
            closed_reason TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_tickets_guild ON tickets(guild_id, status);
        CREATE INDEX IF NOT EXISTS idx_tickets_creator ON tickets(creator_id);

        CREATE TABLE IF NOT EXISTS ticket_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticket_id TEXT NOT NULL,
            author_id TEXT NOT NULL,
            author_tag TEXT NOT NULL,
            author_avatar TEXT,
            content TEXT,
            is_system INTEGER NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_ticket_msgs ON ticket_messages(ticket_id, created_at);

        CREATE TABLE IF NOT EXISTS ticket_ratings (
            ticket_id TEXT PRIMARY KEY,
            guild_id TEXT NOT NULL,
            rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
            feedback TEXT,
            submitted_at INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_ticket_ratings_guild ON ticket_ratings(guild_id);

        CREATE TABLE IF NOT EXISTS ticket_blacklist (
            guild_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            reason TEXT NOT NULL DEFAULT '',
            blacklisted_by TEXT NOT NULL,
            blacklisted_at INTEGER NOT NULL,
            PRIMARY KEY (guild_id, user_id)
        );

        CREATE INDEX IF NOT EXISTS idx_ticket_blacklist_guild ON ticket_blacklist(guild_id);
    `);

    // Add prefix column if not exists (safe on every boot)
    try {
        db.exec('ALTER TABLE guild_config ADD COLUMN prefix TEXT NOT NULL DEFAULT \';\'');
    } catch {}

    // Add welcome_config column if not exists
    try {
        db.exec('ALTER TABLE guild_config ADD COLUMN welcome_config TEXT NOT NULL DEFAULT \'{}\'');
    } catch {}

    // Add embed_color column if not exists
    try {
        db.exec('ALTER TABLE guild_config ADD COLUMN embed_color TEXT');
    } catch {}

    // Add transcript column to tickets if not exists
    try {
        db.exec('ALTER TABLE tickets ADD COLUMN transcript TEXT');
    } catch {}

    // Add last_activity_at column to tickets if not exists
    try {
        db.exec('ALTER TABLE tickets ADD COLUMN last_activity_at INTEGER');
    } catch {}

    // Add panel_type_id / panel_type_name columns to tickets if not exists.
    // CREATE TABLE IF NOT EXISTS won't add columns to an existing table, so
    // existing databases need these explicit migrations or ticket creation
    // fails with "table tickets has no column named panel_type_id".
    try {
        db.exec('ALTER TABLE tickets ADD COLUMN panel_type_id TEXT');
    } catch {}
    try {
        db.exec('ALTER TABLE tickets ADD COLUMN panel_type_name TEXT');
    } catch {}

    // Add close/claim columns to tickets if not exists (used by closeTicket,
    // claimTicket, transferTicket — same old-DB risk as panel_type_id).
    try {
        db.exec('ALTER TABLE tickets ADD COLUMN closed_by_id TEXT');
    } catch {}
    try {
        db.exec('ALTER TABLE tickets ADD COLUMN closed_by_tag TEXT');
    } catch {}
    try {
        db.exec('ALTER TABLE tickets ADD COLUMN closed_at INTEGER');
    } catch {}
    try {
        db.exec('ALTER TABLE tickets ADD COLUMN closed_reason TEXT');
    } catch {}
    try {
        db.exec('ALTER TABLE tickets ADD COLUMN claimer_id TEXT');
    } catch {}

    // Add display columns to ticket_panels if not exists (used by
    // updateTicketPanel / createTicketPanelWithTypes).
    try {
        db.exec('ALTER TABLE ticket_panels ADD COLUMN panel_message_id TEXT');
    } catch {}
    try {
        db.exec('ALTER TABLE ticket_panels ADD COLUMN color TEXT NOT NULL DEFAULT \'#5865F2\'');
    } catch {}
    try {
        db.exec('ALTER TABLE ticket_panels ADD COLUMN image_url TEXT');
    } catch {}
    try {
        db.exec('ALTER TABLE ticket_panels ADD COLUMN description TEXT NOT NULL DEFAULT \'Click the button below to create a ticket and a staff member will assist you.\'');
    } catch {}

    // Add inactivity columns to ticket_panel_types if not exists
    try {
        db.exec('ALTER TABLE ticket_panel_types ADD COLUMN inactivity_timeout INTEGER');
    } catch {}
    try {
        db.exec('ALTER TABLE ticket_panel_types ADD COLUMN inactivity_grace INTEGER DEFAULT 6');
    } catch {}

    // Add ticket_counter column to ticket_panels if not exists
    try {
        db.exec('ALTER TABLE ticket_panels ADD COLUMN ticket_counter INTEGER');
    } catch {}

    // Error log for the dashboard Errors section
    db.exec(`CREATE TABLE IF NOT EXISTS error_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tag TEXT NOT NULL DEFAULT 'general',
        message TEXT,
        extra TEXT,
        meta TEXT,
        stack TEXT,
        timestamp INTEGER NOT NULL
    )`);
    db.exec('CREATE INDEX IF NOT EXISTS idx_error_logs_time ON error_logs(timestamp DESC)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_error_logs_tag ON error_logs(tag)');
}

// ──────────────────── Migration from JSON Files ────────────────────

function migrateFromJson() {
    const dataDir = getDataDir();
    let migrated = false;

    // Helper: check both DATA_DIR and project root for old JSON files
    function findJsonFile(filename) {
        const inDataDir = path.join(dataDir, filename);
        const inRoot = path.join(__dirname, '..', filename);
        if (fs.existsSync(inDataDir)) return inDataDir;
        if (fs.existsSync(inRoot)) return inRoot;
        return null;
    }

    function readJson(filename) {
        const fp = findJsonFile(filename);
        if (!fp) return null;
        try { return JSON.parse(fs.readFileSync(fp, 'utf8')); } catch { return null; }
    }

    function backupJson(filename) {
        const fp = findJsonFile(filename);
        if (!fp) return;
        const backup = fp + '.bak';
        if (!fs.existsSync(backup)) {
            try { fs.copyFileSync(fp, backup); console.log('[DB] Backed up ' + filename + ' -> ' + path.basename(backup)); } catch {}
        }
    }

    // ── Migrate guild config from config.json ──
    const config = readJson('config.json');
    if (config) {
        backupJson('config.json');
        const insertGuild = db.prepare(`
            INSERT OR IGNORE INTO guild_config (guild_id, default_channel, tracked_channels, log_channels, log_categories)
            VALUES (?, ?, ?, ?, ?)
        `);
        const insertBot = db.prepare(`INSERT OR REPLACE INTO bot_config (key, value) VALUES (?, ?)`);

        const tx = db.transaction(() => {
            for (const [guildId, gcfg] of Object.entries(config)) {
                if (guildId.startsWith('_')) {
                    // Bot config (_bot key)
                    if (guildId === '_bot' && typeof gcfg === 'object') {
                        for (const [k, v] of Object.entries(gcfg)) {
                            insertBot.run('bot_' + k, JSON.stringify(v));
                        }
                    }
                    continue;
                }
                insertGuild.run(
                    guildId,
                    gcfg.logChannelId || null,
                    JSON.stringify(gcfg.trackedChannels || []),
                    JSON.stringify(gcfg.logChannels || {}),
                    JSON.stringify(gcfg.logCategories || {})
                );
            }
        });
        tx();
        // Remove old config.json after successful migration
        const fp = findJsonFile('config.json');
        if (fp) {
            try { fs.renameSync(fp, fp + '.migrated'); console.log('[DB] config.json migrated to SQLite'); } catch {}
        }
        migrated = true;
    }

    // ── Migrate permissions ──
    const perms = readJson('permissions.json');
    if (perms) {
        backupJson('permissions.json');
        const insertPerm = db.prepare(`INSERT OR IGNORE INTO permissions (guild_id, command, user_id) VALUES (?, ?, ?)`);
        const tx = db.transaction(() => {
            for (const [guildId, commands] of Object.entries(perms)) {
                for (const [cmd, userIds] of Object.entries(commands)) {
                    for (const uid of userIds) {
                        insertPerm.run(guildId, cmd, uid);
                    }
                }
            }
        });
        tx();
        const fp = findJsonFile('permissions.json');
        if (fp) { try { fs.renameSync(fp, fp + '.migrated'); } catch {} }
        migrated = true;
    }

    // ── Migrate reaction roles ──
    const rr = readJson('reactionRoles.json');
    if (rr) {
        backupJson('reactionRoles.json');
        const insertRR = db.prepare(`INSERT OR IGNORE INTO reaction_roles (guild_id, message_id, channel_id, emoji, role_id, label) VALUES (?, ?, ?, ?, ?, ?)`);
        const tx = db.transaction(() => {
            for (const [guildId, roles] of Object.entries(rr)) {
                for (const r of roles) {
                    insertRR.run(guildId, r.messageId, r.channelId || '', r.emoji, r.roleId, r.label || null);
                }
            }
        });
        tx();
        const fp = findJsonFile('reactionRoles.json');
        if (fp) { try { fs.renameSync(fp, fp + '.migrated'); } catch {} }
        migrated = true;
    }

    // ── Migrate warnings ──
    const warns = readJson('warnings.json');
    if (warns) {
        backupJson('warnings.json');
        const insertWarn = db.prepare(`INSERT OR IGNORE INTO warnings (id, guild_id, user_id, moderator, reason, date) VALUES (?, ?, ?, ?, ?, ?)`);
        const tx = db.transaction(() => {
            for (const [guildId, users] of Object.entries(warns)) {
                for (const [userId, userWarns] of Object.entries(users)) {
                    for (const w of userWarns) {
                        insertWarn.run(w.id || (guildId + userId + Date.now()), guildId, userId, w.moderator, w.reason, w.date);
                    }
                }
            }
        });
        tx();
        const fp = findJsonFile('warnings.json');
        if (fp) { try { fs.renameSync(fp, fp + '.migrated'); } catch {} }
        migrated = true;
    }

    // ── Migrate reminders ──
    const rems = readJson('reminders.json');
    if (rems) {
        backupJson('reminders.json');
        const insertRem = db.prepare(`INSERT OR IGNORE INTO reminders (id, user_id, channel_id, text, created_at, remind_at, notified) VALUES (?, ?, ?, ?, ?, ?, ?)`);
        const tx = db.transaction(() => {
            for (const r of rems) {
                insertRem.run(
                    r.id,
                    r.userId,
                    r.channelId || null,
                    r.text,
                    r.createdAt || Date.now(),
                    r.remindAt,
                    r.notified ? 1 : 0
                );
            }
        });
        tx();
        const fp = findJsonFile('reminders.json');
        if (fp) { try { fs.renameSync(fp, fp + '.migrated'); } catch {} }
        migrated = true;
    }

    // ── Migrate stats ──
    const stats = readJson('stats.json');
    if (stats) {
        backupJson('stats.json');
        const insertStats = db.prepare(`INSERT OR REPLACE INTO guild_stats (guild_id, total_joins, total_leaves) VALUES (?, ?, ?)`);
        const insertSnap = db.prepare(`INSERT OR IGNORE INTO stats_snapshots (guild_id, date, joins, leaves) VALUES (?, ?, ?, ?)`);
        const tx = db.transaction(() => {
            for (const [guildId, s] of Object.entries(stats)) {
                insertStats.run(guildId, s.totalJoins || 0, s.totalLeaves || 0);
                if (s.dailySnapshots) {
                    for (const snap of s.dailySnapshots) {
                        insertSnap.run(guildId, snap.date, snap.joins || 0, snap.leaves || 0);
                    }
                }
            }
        });
        tx();
        const fp = findJsonFile('stats.json');
        if (fp) { try { fs.renameSync(fp, fp + '.migrated'); } catch {} }
        migrated = true;
    }

    // ── Migrate dashboard config ──
    const dashCfg = readJson('dashboardConfig.json');
    if (dashCfg && Object.keys(dashCfg).length > 0) {
        backupJson('dashboardConfig.json');
        db.prepare(`INSERT OR REPLACE INTO dash_config (id, config) VALUES (1, ?)`).run(JSON.stringify(dashCfg));
        const fp = findJsonFile('dashboardConfig.json');
        if (fp) { try { fs.renameSync(fp, fp + '.migrated'); } catch {} }
        migrated = true;
    } else {
        // Check if there's dashboard config inside config.json (_dash)
        const cfg2 = readJson('config.json');
        if (cfg2 && cfg2._dash) {
            db.prepare(`INSERT OR REPLACE INTO dash_config (id, config) VALUES (1, ?)`).run(JSON.stringify(cfg2._dash));
        }
    }

    // ── Migrate dashboard users ──
    const dashUsers = readJson('dashUsers.json');
    if (dashUsers && Object.keys(dashUsers).length > 0) {
        backupJson('dashUsers.json');
        const insertDU = db.prepare(`INSERT OR IGNORE INTO dash_users (user_id, added_at, added_by, active, access_token) VALUES (?, ?, ?, ?, ?)`);
        const tx = db.transaction(() => {
            for (const [userId, u] of Object.entries(dashUsers)) {
                insertDU.run(userId, u.addedAt || Date.now(), u.addedBy || 'unknown', u.active ? 1 : 0, u.accessToken || null);
            }
        });
        tx();
        const fp = findJsonFile('dashUsers.json');
        if (fp) { try { fs.renameSync(fp, fp + '.migrated'); } catch {} }
        migrated = true;
    } else {
        // Check inside config.json (_dashUsers)
        const cfg2 = readJson('config.json');
        if (cfg2 && cfg2._dashUsers) {
            const insertDU2 = db.prepare(`INSERT OR IGNORE INTO dash_users (user_id, added_at, added_by, active, access_token) VALUES (?, ?, ?, ?, ?)`);
            const tx = db.transaction(() => {
                for (const [userId, u] of Object.entries(cfg2._dashUsers)) {
                    insertDU2.run(userId, u.addedAt || Date.now(), u.addedBy || 'unknown', u.active ? 1 : 0, u.accessToken || null);
                }
            });
            tx();
        }
    }

    return migrated;
}

// ──────────────────── Close ────────────────────

function closeDb() {
    if (db) {
        try {
            db.close();
            console.log('[DB] Database closed.');
        } catch (err) {
            logError(err, 'db', 'close');
        }
        db = null;
    }
}

// ──────────────────── Initialize ────────────────────

function initDb() {
    const db2 = getDb();
    // Run migration once. Each sub-migration inside checks if its source
    // JSON file exists, so it's safe to call multiple times.
    // We track completion with a simple flag to avoid rebuilding the
    // nested config object from SQLite on every boot.
    const migrated = db2.prepare('SELECT value FROM bot_config WHERE key = ?').get('_migrated');
    if (!migrated) {
        migrateFromJson();
        db2.prepare('INSERT OR REPLACE INTO bot_config (key, value) VALUES (?, ?)').run('_migrated', 'true');
    }
    return db2;
}

// Call init on require — synchronously
initDb();

// ──────────────────── Error Log (Dashboard Errors section) ────────────────────

function recordErrorLog({ tag, message, extra, meta, stack, timestamp } = {}) {
    try {
        const d = getDb();
        d.prepare('INSERT INTO error_logs (tag, message, extra, meta, stack, timestamp) VALUES (?, ?, ?, ?, ?, ?)')
            .run(tag || 'general', String(message || ''), extra ? String(extra) : '', meta ? JSON.stringify(meta) : '', stack ? String(stack) : '', timestamp || Date.now());
        // Cap the table — keep the most recent 500 entries
        d.prepare('DELETE FROM error_logs WHERE id NOT IN (SELECT id FROM error_logs ORDER BY timestamp DESC LIMIT 500)').run();
    } catch (e) {
        // Never let logging break the app
    }
}

function getErrorLogs(limit = 100, tag = null) {
    const d = getDb();
    if (tag) {
        return d.prepare('SELECT * FROM error_logs WHERE tag = ? ORDER BY timestamp DESC LIMIT ?').all(tag, limit);
    }
    return d.prepare('SELECT * FROM error_logs ORDER BY timestamp DESC LIMIT ?').all(limit);
}

function getErrorTagCounts(limit = 500) {
    const d = getDb();
    return d.prepare('SELECT tag, COUNT(*) as count FROM (SELECT tag FROM error_logs ORDER BY timestamp DESC LIMIT ?) GROUP BY tag ORDER BY count DESC').all(limit);
}

function clearErrorLogs(tag = null) {
    const d = getDb();
    if (tag) return d.prepare('DELETE FROM error_logs WHERE tag = ?').run(tag);
    return d.prepare('DELETE FROM error_logs').run();
}

module.exports = { getDb, initDb, closeDb, migrateFromJson, recordErrorLog, getErrorLogs, getErrorTagCounts, clearErrorLogs };
