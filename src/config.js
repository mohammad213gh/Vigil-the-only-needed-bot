const { LOG_CATEGORIES } = require('./constants');
const { getDb } = require('./db');

// ──────────────────── Default Config ────────────────────

const WELCOME_DEFAULTS = {
    enabled: false,
    channelId: null,
    content: null,
    embedTitle: '👋 Welcome!',
    embedDescription: 'Welcome {user} to **{server}**!',
    embedColor: '#5865F2',
    embedFooter: 'Member #{membercount}',
    embedFooterIcon: null,
    embedThumbnail: null,
    embedImage: null,
    embedAuthor: null,
    embedAuthorIcon: null,
};

const GOODBYE_DEFAULTS = {
    enabled: false,
    channelId: null,
    content: null,
    embedTitle: '👋 Goodbye!',
    embedDescription: '{user} has left **{server}**.',
    embedColor: '#E74C3C',
    embedFooter: 'Member #{membercount}',
    embedFooterIcon: null,
    embedThumbnail: null,
    embedImage: null,
    embedAuthor: null,
    embedAuthorIcon: null,
};

function getWelcomeConfig(guildId) {
    const g = getGuildConfig(guildId);
    return { ...WELCOME_DEFAULTS, ...(g.welcomeConfig?.welcome || {}) };
}

function getGoodbyeConfig(guildId) {
    const g = getGuildConfig(guildId);
    return { ...GOODBYE_DEFAULTS, ...(g.welcomeConfig?.goodbye || {}) };
}

function updateWelcomeConfig(guildId, type, updater) {
    return updateGuildConfig(guildId, (g) => {
        const wc = g.welcomeConfig || {};
        const cfg = type === 'welcome' ? { ...WELCOME_DEFAULTS, ...(wc.welcome || {}) } : { ...GOODBYE_DEFAULTS, ...(wc.goodbye || {}) };
        const updated = updater(cfg);
        wc[type] = updated;
        g.welcomeConfig = wc;
        return g;
    });
}

function createDefaultConfig() {
    const cats = {};
    const channels = {};
    for (const c of LOG_CATEGORIES) {
        cats[c] = true;
        channels[c] = null;
    }
    return {
        logChannelId: null,
        logChannels: channels,
        trackedChannels: [],
        logCategories: cats,
        prefix: ';',
        welcomeConfig: {},
    };
}

function parseGuildRow(row) {
    if (!row) return null;
    return {
        logChannelId: row.default_channel,
        logChannels: JSON.parse(row.log_channels || '{}'),
        logCategories: JSON.parse(row.log_categories || '{}'),
        trackedChannels: JSON.parse(row.tracked_channels || '[]'),
        prefix: row.prefix || ';',
        welcomeConfig: JSON.parse(row.welcome_config || '{}'),
    };
}

// ──────────────────── Guild Config ────────────────────

function getGuildConfig(guildId) {
    const db = getDb();
    const row = db.prepare('SELECT * FROM guild_config WHERE guild_id = ?').get(guildId);
    if (row) {
        const g = parseGuildRow(row);
        // Auto-migrate missing fields
        let migrated = false;
        const defaults = createDefaultConfig();
        for (const cat of LOG_CATEGORIES) {
            if (g.logCategories[cat] === undefined) {
                g.logCategories[cat] = true;
                migrated = true;
            }
            if (g.logChannels[cat] === undefined) {
                g.logChannels[cat] = null;
                migrated = true;
            }
        }
        if (migrated) {
            updateGuildConfigRaw(guildId, g);
        }
        return g;
    }
    // Create default
    const def = createDefaultConfig();
    db.prepare(`
        INSERT INTO guild_config (guild_id, default_channel, tracked_channels, log_channels, log_categories, prefix, welcome_config)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(guildId, null, '[]', JSON.stringify(def.logChannels), JSON.stringify(def.logCategories), ';', '{}');
    return def;
}

function updateGuildConfigRaw(guildId, g) {
    const db = getDb();
    db.prepare(`
        UPDATE guild_config SET
            default_channel = ?,
            tracked_channels = ?,
            log_channels = ?,
            log_categories = ?,
            prefix = ?,
            welcome_config = ?
        WHERE guild_id = ?
    `).run(
        g.logChannelId || null,
        JSON.stringify(g.trackedChannels || []),
        JSON.stringify(g.logChannels || {}),
        JSON.stringify(g.logCategories || {}),
        g.prefix || ';',
        JSON.stringify(g.welcomeConfig || {}),
        guildId
    );
}

function updateGuildConfig(guildId, updater) {
    const g = getGuildConfig(guildId);
    const updated = updater(g);
    updateGuildConfigRaw(guildId, updated);
    return updated;
}

// ──────────────────── Load / Save (legacy — kept for external tooling compatibility) ────────────────────

function loadConfig() {
    // Returns the old nested format for compatibility with dashboard
    const db = getDb();
    const rows = db.prepare('SELECT * FROM guild_config').all();
    const config = {};
    for (const row of rows) {
        const g = parseGuildRow(row);
        config[row.guild_id] = {
            logChannelId: g.logChannelId,
            logChannels: g.logChannels,
            trackedChannels: g.trackedChannels,
            logCategories: g.logCategories,
            prefix: g.prefix,
        };
    }
    // Add bot config under _bot key
    const botCfg = getBotConfig();
    config._bot = botCfg;
    return config;
}

function saveConfig(config) {
    // Save from the old nested format back into SQLite
    const db = getDb();
    const upsert = db.prepare(`
        INSERT OR REPLACE INTO guild_config (guild_id, default_channel, tracked_channels, log_channels, log_categories, prefix, welcome_config)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const tx = db.transaction(() => {
        for (const [key, val] of Object.entries(config)) {
            if (key.startsWith('_')) {
                if (key === '_bot' && typeof val === 'object') {
                    saveBotConfig(val);
                }
                continue;
            }
            if (typeof val === 'object' && val !== null) {
                upsert.run(
                    key,
                    val.logChannelId || null,
                    JSON.stringify(val.trackedChannels || []),
                    JSON.stringify(val.logChannels || {}),
                    JSON.stringify(val.logCategories || {}),
                    val.prefix || ';',
                    JSON.stringify(val.welcomeConfig || {})
                );
            }
        }
    });
    tx();
    return true;
}

// ──────────────────── Bot Config ────────────────────

const BOT_DEFAULTS = {
    embedFooterText: null,
    embedFooterIcon: null,
    embedColor: null,
};

function getBotConfig() {
    const db = getDb();
    const rows = db.prepare('SELECT key, value FROM bot_config').all();
    const cfg = { ...BOT_DEFAULTS };
    for (const row of rows) {
        const key = row.key.replace(/^bot_/, '');
        try { cfg[key] = JSON.parse(row.value); } catch { cfg[key] = row.value; }
    }
    return cfg;
}

function saveBotConfig(partial) {
    const db = getDb();
    const upsert = db.prepare('INSERT OR REPLACE INTO bot_config (key, value) VALUES (?, ?)');
    const tx = db.transaction(() => {
        for (const [key, val] of Object.entries(partial)) {
            upsert.run('bot_' + key, JSON.stringify(val));
        }
    });
    tx();
    return { ...getBotConfig(), ...partial };
}

module.exports = {
    loadConfig,
    saveConfig,
    getGuildConfig,
    updateGuildConfig,
    getBotConfig,
    saveBotConfig,
    createDefaultConfig,
    getWelcomeConfig,
    getGoodbyeConfig,
    updateWelcomeConfig,
};
