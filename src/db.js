const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const { getDataDir } = require('./data');

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
    `);
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

// ──────────────────── Initialize ────────────────────

function initDb() {
    const db2 = getDb();
    const count = db2.prepare('SELECT COUNT(*) as c FROM guild_config').get().c;
    if (count === 0) {
        migrateFromJson();
    }
    return db2;
}

// Call init on require — synchronously
initDb();

module.exports = { getDb, initDb, migrateFromJson };
