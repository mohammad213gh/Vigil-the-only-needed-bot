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

        CREATE TABLE IF NOT EXISTS giveaways (
            id TEXT PRIMARY KEY,
            guild_id TEXT NOT NULL,
            channel_id TEXT NOT NULL,
            message_id TEXT NOT NULL DEFAULT '',
            prize TEXT NOT NULL,
            winners INTEGER NOT NULL DEFAULT 1,
            host_id TEXT NOT NULL,
            host_tag TEXT,
            ends_at INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'active',
            winner_ids TEXT,
            ended_at INTEGER,
            created_at INTEGER NOT NULL,
            description TEXT,
            required_role_ids TEXT,
            banned_role_ids TEXT,
            color INTEGER,
            image_url TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_giveaways_active ON giveaways(status, ends_at);

        CREATE TABLE IF NOT EXISTS server_stats (
            guild_id TEXT NOT NULL,
            channel_id TEXT NOT NULL,
            stat_type TEXT NOT NULL,
            label TEXT,
            PRIMARY KEY (guild_id, channel_id)
        );
        CREATE INDEX IF NOT EXISTS idx_server_stats_guild ON server_stats(guild_id);

        CREATE TABLE IF NOT EXISTS voice_presence (
            guild_id TEXT PRIMARY KEY,
            channel_id TEXT NOT NULL,
            status TEXT
        );

        CREATE TABLE IF NOT EXISTS temp_vc_config (
            guild_id TEXT PRIMARY KEY,
            name_template TEXT NOT NULL DEFAULT '{name}''s channel'
        );

        CREATE TABLE IF NOT EXISTS temp_vc_triggers (
            guild_id TEXT NOT NULL,
            channel_id TEXT NOT NULL,
            category_id TEXT,
            PRIMARY KEY (guild_id, channel_id)
        );
        CREATE INDEX IF NOT EXISTS idx_temp_vc_triggers_guild ON temp_vc_triggers(guild_id);

        CREATE TABLE IF NOT EXISTS temp_vc_channels (
            channel_id TEXT PRIMARY KEY,
            guild_id TEXT NOT NULL,
            owner_id TEXT NOT NULL,
            trigger_id TEXT NOT NULL,
            created_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_temp_vc_channels_guild ON temp_vc_channels(guild_id);
        CREATE INDEX IF NOT EXISTS idx_temp_vc_channels_owner ON temp_vc_channels(owner_id);

        CREATE TABLE IF NOT EXISTS temp_vc_panels (
            guild_id TEXT NOT NULL,
            channel_id TEXT NOT NULL,
            message_id TEXT NOT NULL,
            PRIMARY KEY (guild_id, channel_id)
        );
        CREATE INDEX IF NOT EXISTS idx_temp_vc_panels_guild ON temp_vc_panels(guild_id);

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

        CREATE TABLE IF NOT EXISTS api_tokens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            token_hash TEXT NOT NULL,
            scopes TEXT NOT NULL DEFAULT '[]',
            created_at INTEGER NOT NULL,
            last_used_at INTEGER,
            expires_at INTEGER,
            UNIQUE(token_hash)
        );

        CREATE TABLE IF NOT EXISTS bot_activity (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL,
            data TEXT,
            timestamp INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_bot_activity_time ON bot_activity(timestamp);
        CREATE INDEX IF NOT EXISTS idx_bot_activity_type ON bot_activity(type);

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
        CREATE INDEX IF NOT EXISTS idx_msg_log_guild_action_time ON message_log(guild_id, action, logged_at);

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
        CREATE INDEX IF NOT EXISTS idx_mod_cases_guild_type ON mod_cases(guild_id, action_type);
        CREATE INDEX IF NOT EXISTS idx_mod_cases_guild_active ON mod_cases(guild_id, active);

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
        CREATE INDEX IF NOT EXISTS idx_cmd_usage_guild_time ON command_usage(guild_id, command, used_at);

        CREATE TABLE IF NOT EXISTS command_cooldowns (
            guild_id TEXT NOT NULL,
            command TEXT NOT NULL,
            user_id TEXT NOT NULL,
            expires_at INTEGER NOT NULL,
            PRIMARY KEY (guild_id, command, user_id)
        );
        CREATE INDEX IF NOT EXISTS idx_cmd_cooldowns_expires ON command_cooldowns(expires_at);

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
            created_at INTEGER NOT NULL,
            reviewed_by TEXT,
            reviewed_at INTEGER,
            review_note TEXT
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
            closed_reason TEXT,
            last_activity_at INTEGER
        );

        CREATE INDEX IF NOT EXISTS idx_tickets_guild ON tickets(guild_id, status);
        CREATE INDEX IF NOT EXISTS idx_tickets_creator ON tickets(creator_id);
        CREATE INDEX IF NOT EXISTS idx_tickets_inactivity ON tickets(guild_id, status, last_activity_at);

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

    // ──────────────────── Versioned schema migrations ────────────────────
    // Column/table additions live in ordered, named migrations recorded in
    // schema_migrations. This replaces the old boot-time try/catch ALTER
    // sprawl, which silently swallowed every failure — a real ALTER error
    // (locked DB, disk full, corrupted page) used to surface later as a
    // baffling "no such column" somewhere else. Now: migrations run in a
    // transaction each, are recorded by name, and a genuine failure is
    // logged and THROWN so the process fails fast instead of limping on.
    //
    // Every migration is also self-healing via addColumnIfMissing
    // (PRAGMA table_info check), so databases upgraded by the old silent
    // path — which already have the columns but no schema_migrations rows —
    // skip cleanly instead of crashing on a duplicate-column error.

    db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at INTEGER NOT NULL
    )`);

    const appliedMigrations = new Set(
        db.prepare('SELECT name FROM schema_migrations').all().map(r => r.name)
    );

    function addColumnIfMissing(table, column, definition) {
        const cols = db.prepare('PRAGMA table_info(' + table + ')').all().map(c => c.name);
        if (cols.includes(column)) return;
        db.exec('ALTER TABLE ' + table + ' ADD COLUMN ' + column + ' ' + definition);
    }

    const MIGRATIONS = [
        // guild_config additions
        { name: '0001_guild_config_prefix', run: () => addColumnIfMissing('guild_config', 'prefix', "TEXT NOT NULL DEFAULT ';'") },
        { name: '0002_guild_config_welcome', run: () => addColumnIfMissing('guild_config', 'welcome_config', "TEXT NOT NULL DEFAULT '{}'" ) },
        { name: '0003_guild_config_embed_color', run: () => addColumnIfMissing('guild_config', 'embed_color', 'TEXT') },
        // reminders: delivery retry tracking
        { name: '0004_reminders_attempts', run: () => addColumnIfMissing('reminders', 'attempts', 'INTEGER NOT NULL DEFAULT 0') },
        // Per-guild access scopes for non-owner dashboard users.
        // A discord-session user with zero rows here has access to NO servers.
        { name: '0005_create_dash_user_guilds', run: () => {
            db.exec(`CREATE TABLE IF NOT EXISTS dash_user_guilds (
                user_id TEXT NOT NULL,
                guild_id TEXT NOT NULL,
                granted_at INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY (user_id, guild_id)
            )`);
            db.exec('CREATE INDEX IF NOT EXISTS idx_dash_scopes_user ON dash_user_guilds(user_id)');
        } },
        // tickets: transcript, activity tracking, panel linkage, close/claim columns.
        // CREATE TABLE IF NOT EXISTS won't add columns to an existing table, so
        // existing databases need these explicit migrations or ticket creation
        // fails with "table tickets has no column named panel_type_id".
        { name: '0006_tickets_transcript', run: () => addColumnIfMissing('tickets', 'transcript', 'TEXT') },
        { name: '0007_tickets_last_activity_at', run: () => addColumnIfMissing('tickets', 'last_activity_at', 'INTEGER') },
        { name: '0008_tickets_panel_type_id', run: () => addColumnIfMissing('tickets', 'panel_type_id', 'TEXT') },
        { name: '0009_tickets_panel_type_name', run: () => addColumnIfMissing('tickets', 'panel_type_name', 'TEXT') },
        // Close/claim columns (used by closeTicket, claimTicket, transferTicket).
        { name: '0010_tickets_closed_by_id', run: () => addColumnIfMissing('tickets', 'closed_by_id', 'TEXT') },
        { name: '0011_tickets_closed_by_tag', run: () => addColumnIfMissing('tickets', 'closed_by_tag', 'TEXT') },
        { name: '0012_tickets_closed_at', run: () => addColumnIfMissing('tickets', 'closed_at', 'INTEGER') },
        { name: '0013_tickets_closed_reason', run: () => addColumnIfMissing('tickets', 'closed_reason', 'TEXT') },
        { name: '0014_tickets_claimer_id', run: () => addColumnIfMissing('tickets', 'claimer_id', 'TEXT') },
        // ticket_panels display columns (used by updateTicketPanel /
        // createTicketPanelWithTypes).
        { name: '0015_ticket_panels_panel_message_id', run: () => addColumnIfMissing('ticket_panels', 'panel_message_id', 'TEXT') },
        { name: '0016_ticket_panels_color', run: () => addColumnIfMissing('ticket_panels', 'color', "TEXT NOT NULL DEFAULT '#5865F2'") },
        { name: '0017_ticket_panels_image_url', run: () => addColumnIfMissing('ticket_panels', 'image_url', 'TEXT') },
        { name: '0018_ticket_panels_description', run: () => addColumnIfMissing('ticket_panels', 'description', "TEXT NOT NULL DEFAULT 'Click the button below to create a ticket and a staff member will assist you.'") },
        // Giveaway v2 columns (description, role requirements, color, image)
        { name: '0019_giveaways_description', run: () => addColumnIfMissing('giveaways', 'description', 'TEXT') },
        { name: '0020_giveaways_required_role_ids', run: () => addColumnIfMissing('giveaways', 'required_role_ids', 'TEXT') },
        { name: '0021_giveaways_banned_role_ids', run: () => addColumnIfMissing('giveaways', 'banned_role_ids', 'TEXT') },
        { name: '0022_giveaways_color', run: () => addColumnIfMissing('giveaways', 'color', 'INTEGER') },
        { name: '0023_giveaways_image_url', run: () => addColumnIfMissing('giveaways', 'image_url', 'TEXT') },
        // ticket_panel_types inactivity auto-close
        { name: '0024_ticket_panel_types_inactivity_timeout', run: () => addColumnIfMissing('ticket_panel_types', 'inactivity_timeout', 'INTEGER') },
        { name: '0025_ticket_panel_types_inactivity_grace', run: () => addColumnIfMissing('ticket_panel_types', 'inactivity_grace', 'INTEGER DEFAULT 6') },
        // ticket_panels counter for ticket numbering per panel
        { name: '0026_ticket_panels_ticket_counter', run: () => addColumnIfMissing('ticket_panels', 'ticket_counter', 'INTEGER') },
        // ban_appeals review columns (approve/deny audit trail)
        { name: '0027_ban_appeals_reviewed_by', run: () => addColumnIfMissing('ban_appeals', 'reviewed_by', 'TEXT') },
        { name: '0028_ban_appeals_reviewed_at', run: () => addColumnIfMissing('ban_appeals', 'reviewed_at', 'INTEGER') },
        { name: '0029_ban_appeals_review_note', run: () => addColumnIfMissing('ban_appeals', 'review_note', 'TEXT') },
        // activity_counts.last_seen (used by the retention sweeper to prune
        // long-inactive user/channel rows). Legacy rows are backfilled to
        // "now" so they age out on the normal schedule instead of living
        // forever.
        { name: '0030_activity_counts_last_seen', run: () => {
            addColumnIfMissing('activity_counts', 'last_seen', 'INTEGER');
            db.prepare('UPDATE activity_counts SET last_seen = ? WHERE last_seen IS NULL').run(Date.now());
        } },
    ];

    for (const migration of MIGRATIONS) {
        if (appliedMigrations.has(migration.name)) continue;
        try {
            db.transaction(() => migration.run(db))();
            db.prepare('INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)').run(migration.name, Date.now());
            console.log('[DB] Applied migration ' + migration.name);
        } catch (err) {
            console.error('[DB] FATAL: migration ' + migration.name + ' failed: ' + err.message);
            try { logError(err, 'db', 'migration:' + migration.name); } catch { /* error_logs may not exist yet during boot */ }
            // Fail fast — booting on a half-migrated schema produces cryptic
            // downstream errors; a hard stop makes the problem obvious now.
            throw err;
        }
    }

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

    // Audit trail for dashboard changes
    db.exec(`CREATE TABLE IF NOT EXISTS audit_trail (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        user_id TEXT NOT NULL,
        user_tag TEXT,
        guild_id TEXT,
        action TEXT NOT NULL,
        details TEXT,
        created_at INTEGER NOT NULL
    )`);
    db.exec('CREATE INDEX IF NOT EXISTS idx_audit_trail_time ON audit_trail(created_at DESC)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_audit_trail_type ON audit_trail(type)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_audit_trail_user ON audit_trail(user_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_audit_trail_guild ON audit_trail(guild_id)');
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

// ──────────────────── Database Backups ────────────────────
// Copies bot.db into <DATA_DIR>/backups/ and keeps the newest MAX_BACKUPS.
// better-sqlite3 is fully synchronous and single-process here, so copying the
// file between operations yields a consistent snapshot.
const BACKUP_DIR = path.join(getDataDir(), 'backups');
const MAX_BACKUPS = 7;
const BACKUP_NAME_RE = /^bot-\d{14}\.db$/;

function listBackups() {
    try {
        if (!fs.existsSync(BACKUP_DIR)) return [];
        return fs.readdirSync(BACKUP_DIR)
            .filter(n => BACKUP_NAME_RE.test(n))
            .map(n => {
                const st = fs.statSync(path.join(BACKUP_DIR, n));
                return { name: n, size: st.size, createdAt: st.mtimeMs };
            })
            .sort((a, b) => b.createdAt - a.createdAt);
    } catch {
        return [];
    }
}

function backupDatabase() {
    if (!fs.existsSync(DB_PATH)) return null;
    try {
        if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
        // Flush any WAL frames so the copied file is self-contained.
        try { db.pragma('wal_checkpoint(TRUNCATE)'); } catch {}
        const name = 'bot-' + new Date().toISOString().replace(/[-:TZ]/g, '').replace(/\.\d{3}/, '') + '.db';
        const dest = path.join(BACKUP_DIR, name);
        fs.copyFileSync(DB_PATH, dest);
        // Prune old backups, keep the newest MAX_BACKUPS.
        for (const old of listBackups().slice(MAX_BACKUPS)) {
            try { fs.unlinkSync(path.join(BACKUP_DIR, old.name)); } catch {}
        }
        const backup = { name, size: fs.statSync(dest).size, createdAt: Date.now() };
        
        // Verify backup integrity asynchronously
        setImmediate(() => verifyBackup(dest).catch(err => {
            logError(err, 'db', 'backup_verification');
        }));
        
        return backup;
    } catch (err) {
        console.error('[DB] Backup failed:', err.message);
        return null;
    }
}

// Verify backup integrity by opening it and running integrity_check
function verifyBackup(backupPath) {
    return new Promise((resolve, reject) => {
        const Database = require('better-sqlite3');
        let verifyDb;
        try {
            if (!fs.existsSync(backupPath)) {
                return resolve({ verified: false, path: backupPath, reason: 'file not found' });
            }
            verifyDb = new Database(backupPath, { readonly: true });
            // Quick integrity check
            const result = verifyDb.pragma('quick_check');
            if (result !== 'ok') {
                throw new Error(`Backup integrity check failed: ${result}`);
            }
            // Verify key tables exist
            const tables = verifyDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('guild_config', 'mod_cases', 'tickets', 'command_usage')").all();
            const expectedTables = ['guild_config', 'mod_cases', 'tickets', 'command_usage'];
            const foundTables = tables.map(t => t.name);
            for (const expected of expectedTables) {
                if (!foundTables.includes(expected)) {
                    throw new Error(`Missing critical table in backup: ${expected}`);
                }
            }
            verifyDb.close();
            console.log('[DB] Backup verified: ' + path.basename(backupPath));
            resolve({ verified: true, path: backupPath });
        } catch (err) {
            if (verifyDb) verifyDb.close();
            console.error('[DB] Backup verification failed:', err.message);
            reject(err);
        }
    });
}

// Scheduled backup verification (runs daily, verifies last 3 backups)
function scheduleBackupVerification() {
    setTimeout(() => {
        runBackupVerification().catch(err => logError(err, 'db', 'scheduled_verification'));
    }, 60 * 60 * 1000); // 1 hour after startup
    
    setInterval(() => {
        runBackupVerification().catch(err => logError(err, 'db', 'scheduled_verification'));
    }, 24 * 60 * 60 * 1000); // Daily
}

async function runBackupVerification() {
    const backups = listBackups().slice(0, 3); // Verify newest 3
    for (const backup of backups) {
        const fullPath = path.join(BACKUP_DIR, backup.name);
        if (fs.existsSync(fullPath)) {
            try {
                await verifyBackup(fullPath);
            } catch (err) {
                logError(err, 'db', 'backup_verification');
            }
        }
    }
}

function deleteBackup(name) {
    if (typeof name !== 'string' || !BACKUP_NAME_RE.test(name)) return false;
    try {
        fs.unlinkSync(path.join(BACKUP_DIR, name));
        return true;
    } catch {
        return false;
    }
}

// ──────────────────── Retention Sweeps ────────────────────
// A handful of tables grow forever if nothing prunes them (message_log,
// error_logs and bot_activity are already capped at write time). These
// sweeps keep the database bounded so backups stay small and fast:
//   - command_usage:      one row per command execution, forever → 180 days
//   - activity_counts:    one row per (user × channel) pair, churns forever
//                         → rows inactive 180 days; requires last_seen
//   - ticket_messages:    every ticket message, forever → messages of tickets
//                         closed > 365 days (transcripts are snapshotted into
//                         tickets.transcript at close, so history survives)
// invite_uses is deliberately NOT pruned — invite stats (counts, top
// inviters) are computed straight off that table, and growth is ~1 row per
// join, which is negligible.
const RETENTION_DAY_MS = 24 * 60 * 60 * 1000;
const RETENTION = {
    commandUsageMs: 180 * RETENTION_DAY_MS,
    activityMs: 180 * RETENTION_DAY_MS,
    closedTicketMessagesMs: 365 * RETENTION_DAY_MS,
};

let retentionSweeper = null;

function pruneOldData(nowMs = Date.now()) {
    const d = getDb();
    const changes = {};
    try {
        const r = d.prepare('DELETE FROM command_usage WHERE used_at < ?').run(nowMs - RETENTION.commandUsageMs);
        changes.commandUsage = r.changes;
    } catch (err) {
        logError(err, 'db', 'prune/command_usage');
    }
    try {
        // Only rows with a known last_seen — legacy NULL rows are kept rather
        // than risk deleting live activity during an in-place upgrade.
        const r = d.prepare('DELETE FROM activity_counts WHERE last_seen IS NOT NULL AND last_seen < ?').run(nowMs - RETENTION.activityMs);
        changes.activityCounts = r.changes;
    } catch (err) {
        logError(err, 'db', 'prune/activity_counts');
    }
    try {
        const r = d.prepare(`DELETE FROM ticket_messages WHERE ticket_id IN (
            SELECT id FROM tickets WHERE status = 'closed' AND closed_at < ?
        )`).run(nowMs - RETENTION.closedTicketMessagesMs);
        changes.ticketMessages = r.changes;
    } catch (err) {
        logError(err, 'db', 'prune/ticket_messages');
    }
    return changes;
}

function startDataRetentionSweeper() {
    if (retentionSweeper) return;
    pruneOldData(); // catch up once on boot, then daily
    retentionSweeper = setInterval(() => pruneOldData(), RETENTION_DAY_MS);
    retentionSweeper.unref?.();
}

function stopDataRetentionSweeper() {
    if (retentionSweeper) {
        clearInterval(retentionSweeper);
        retentionSweeper = null;
    }
}

module.exports = { getDb, initDb, closeDb, migrateFromJson, recordErrorLog, getErrorLogs, getErrorTagCounts, clearErrorLogs, backupDatabase, listBackups, deleteBackup, verifyBackup, scheduleBackupVerification, recordAuditTrail, pruneOldData, startDataRetentionSweeper, stopDataRetentionSweeper };

function recordAuditTrail({ type, userId, userTag, guildId, action, details }) {
    try {
        const db = getDb();
        db.prepare('INSERT INTO audit_trail (type, user_id, user_tag, guild_id, action, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
            .run(type, userId, userTag || null, guildId || null, action, details ? JSON.stringify(details) : null, Date.now());
    } catch (err) {
        console.error('[DB] Audit trail record failed:', err.message);
    }
}
