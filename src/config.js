const fs = require('fs');
const { LOG_CATEGORIES } = require('./constants');
const { getDataPath } = require('./data');

// Use existing config.json at project root if it exists (backward compatibility),
// otherwise use DATA_DIR location
const CONFIG_PATH = process.env.CONFIG_PATH || (
    fs.existsSync('./config.json') ? './config.json' : getDataPath('config.json')
);

// ──────────────────── Load / Save ────────────────────

function loadConfig() {
    try {
        return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    } catch {
        return {};
    }
}

function saveConfig(config) {
    try {
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 4));
        return true;
    } catch (err) {
        console.error('[Config] Failed to save config.json:', err.message);
        console.error('[Config] Current config has', Object.keys(config).length, 'top-level keys');
        return false;
    }
}

// ──────────────────── Default Config ────────────────────

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
    };
}

// ──────────────────── Guild Config ────────────────────

function getGuildConfig(guildId) {
    const config = loadConfig();
    if (!config[guildId]) {
        config[guildId] = createDefaultConfig();
        saveConfig(config);
        return config[guildId];
    }
    const g = config[guildId];

    // Auto-migrate from old single-channel format — only saves if changes were made
    let migrated = false;
    if (!g.logChannels) {
        g.logChannels = {};
        for (const c of LOG_CATEGORIES) g.logChannels[c] = null;
        migrated = true;
    }
    if (!g.logCategories) {
        g.logCategories = {};
        for (const c of LOG_CATEGORIES) g.logCategories[c] = true;
        migrated = true;
    } else {
        for (const c of LOG_CATEGORIES) {
            if (g.logCategories[c] === undefined) {
                g.logCategories[c] = true;
                migrated = true;
            }
            if (g.logChannels[c] === undefined) {
                g.logChannels[c] = null;
                migrated = true;
            }
        }
    }
    if (!g.trackedChannels) {
        g.trackedChannels = [];
        migrated = true;
    }
    
    // Only save to disk if we actually migrated something
    if (migrated) {
        saveConfig(config);
    }
    return g;
}

function updateGuildConfig(guildId, updater) {
    const config = loadConfig();
    // Ensure the guild has a default config if it doesn't exist yet
    if (!config[guildId]) {
        config[guildId] = createDefaultConfig();
    }
    const guildConfig = config[guildId];
    
    // Ensure logChannels and logCategories exist (migration)
    if (!guildConfig.logChannels) {
        guildConfig.logChannels = {};
        for (const c of LOG_CATEGORIES) guildConfig.logChannels[c] = null;
    }
    if (!guildConfig.logCategories) {
        guildConfig.logCategories = {};
        for (const c of LOG_CATEGORIES) guildConfig.logCategories[c] = true;
    } else {
        for (const c of LOG_CATEGORIES) {
            if (guildConfig.logCategories[c] === undefined) guildConfig.logCategories[c] = true;
            if (guildConfig.logChannels[c] === undefined) guildConfig.logChannels[c] = null;
        }
    }
    if (!guildConfig.trackedChannels) guildConfig.trackedChannels = [];
    
    // Apply the updater
    config[guildId] = updater(guildConfig);
    saveConfig(config);
    return config[guildId];
}

// ──────────────────── Bot Config ────────────────────

const BOT_CONFIG_KEY = '_bot';

function getBotConfig() {
    const config = loadConfig();
    if (!config[BOT_CONFIG_KEY]) {
        config[BOT_CONFIG_KEY] = {
            embedFooterText: null,
            embedFooterIcon: null,
            embedColor: null,
        };
        saveConfig(config);
    }
    return config[BOT_CONFIG_KEY];
}

function saveBotConfig(partial) {
    const config = loadConfig();
    if (!config[BOT_CONFIG_KEY]) config[BOT_CONFIG_KEY] = {};
    Object.assign(config[BOT_CONFIG_KEY], partial);
    saveConfig(config);
    return config[BOT_CONFIG_KEY];
}

module.exports = {
    loadConfig,
    saveConfig,
    getGuildConfig,
    updateGuildConfig,
    getBotConfig,
    saveBotConfig,
    createDefaultConfig,
};
