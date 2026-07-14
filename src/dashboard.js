const fs = require('fs');
const { getDataPath } = require('./data');

const WARNINGS_PATH = getDataPath('warnings.json');

function loadWarnings() {
    try {
        return JSON.parse(fs.readFileSync(WARNINGS_PATH, 'utf8'));
    } catch {
        return {};
    }
}

function saveWarnings(warnings) {
    try {
        fs.writeFileSync(WARNINGS_PATH, JSON.stringify(warnings, null, 4));
    } catch (err) {
        console.error('[Warnings] Failed to save warnings.json:', err.message);
    }
}

function getGuildWarnings(guildId) {
    const warnings = loadWarnings();
    if (!warnings[guildId]) {
        warnings[guildId] = {};
        saveWarnings(warnings);
    }
    return warnings[guildId];
}

function addWarning(guildId, userId, moderatorTag, reason) {
    const warnings = loadWarnings();
    if (!warnings[guildId]) warnings[guildId] = {};
    if (!warnings[guildId][userId]) warnings[guildId][userId] = [];

    warnings[guildId][userId].push({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        reason: reason || 'No reason provided',
        moderator: moderatorTag,
        date: new Date().toISOString(),
    });

    saveWarnings(warnings);
    return warnings[guildId][userId];
}

function getWarnings(guildId, userId) {
    const warnings = loadWarnings();
    return warnings[guildId]?.[userId] || [];
}

function clearWarnings(guildId, userId) {
    const warnings = loadWarnings();
    if (warnings[guildId]) {
        delete warnings[guildId][userId];
        saveWarnings(warnings);
    }
    return true;
}

function removeWarning(guildId, userId, warningId) {
    const warnings = loadWarnings();
    const userWarnings = warnings[guildId]?.[userId];
    if (!userWarnings) return false;

    const index = userWarnings.findIndex(w => w.id === warningId);
    if (index === -1) return false;

    userWarnings.splice(index, 1);
    saveWarnings(warnings);
    return true;
}

module.exports = {
    loadWarnings,
    addWarning,
    getWarnings,
    clearWarnings,
    removeWarning,
};
