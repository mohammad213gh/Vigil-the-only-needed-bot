const fs = require('fs');
const { LOG_CATEGORIES } = require('./constants');

const CONFIG_PATH = './config.json';

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
    } catch (err) {
        console.error('[Config] Failed to save config.json:', err.message);
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

    // Auto-migrate from old single-channel format
    if (!g.logChannels) {
        g.logChannels = {};
        for (const c of LOG_CATEGORIES) g.logChannels[c] = null;
    }
    if (!g.logCategories) {
        g.logCategories = {};
        for (const c of LOG_CATEGORIES) g.logCategories[c] = true;
    } else {
        for (const c of LOG_CATEGORIES) {
            if (g.logCategories[c] === undefined) g.logCategories[c] = true;
            if (g.logChannels[c] === undefined) g.logChannels[c] = null;
        }
    }
    if (!g.trackedChannels) g.trackedChannels = [];
    saveConfig(config);
    return g;
}

function updateGuildConfig(guildId, updater) {
    const config = loadConfig();
    const guildConfig = config[guildId] || createDefaultConfig();
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
