const fs = require('fs');
const { getDataPath } = require('./data');

const PERMS_PATH = getDataPath('permissions.json');

// ──────────────────── Permission Structure ────────────────────
// Stored in src/data/permissions.json:
// {
//   "guildId": {
//     "commandName": ["userId1", "userId2"]
//   }
// }

// ─── Migration from old config.json ───
function findConfigPath() {
    if (process.env.CONFIG_PATH) return process.env.CONFIG_PATH;
    if (fs.existsSync('./config.json')) return './config.json';
    const dataPath = getDataPath('config.json');
    if (fs.existsSync(dataPath)) return dataPath;
    return './config.json'; // fallback
}

function migrateFromConfig() {
    try {
        const configPath = findConfigPath();
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (config._perms && Object.keys(config._perms).length > 0) {
            fs.writeFileSync(PERMS_PATH, JSON.stringify(config._perms, null, 4));
            delete config._perms;
            fs.writeFileSync(configPath, JSON.stringify(config, null, 4));
            console.log('[Migration] Moved permissions data to data/permissions.json');
        }
    } catch { /* no migration needed */ }
}

function loadPerms() {
    try {
        return JSON.parse(fs.readFileSync(PERMS_PATH, 'utf8'));
    } catch {
        migrateFromConfig();
        return {};
    }
}

function savePerms(perms) {
    try {
        fs.writeFileSync(PERMS_PATH, JSON.stringify(perms, null, 4));
    } catch (err) {
        console.error('[Permissions] Failed to save:', err.message);
    }
}

function getPermissions(guildId) {
    const perms = loadPerms();
    if (!perms[guildId]) perms[guildId] = {};
    return perms[guildId];
}

function savePermissionsToFile(guildId, guildPerms) {
    const perms = loadPerms();
    perms[guildId] = guildPerms;
    savePerms(perms);
}

function grantPermission(guildId, command, userId) {
    const perms = getPermissions(guildId);
    if (!perms[command]) perms[command] = [];
    if (!perms[command].includes(userId)) {
        perms[command].push(userId);
    }
    savePermissionsToFile(guildId, perms);
    return true;
}

function revokePermission(guildId, command, userId) {
    const perms = getPermissions(guildId);
    if (perms[command]) {
        perms[command] = perms[command].filter(id => id !== userId);
        if (perms[command].length === 0) delete perms[command];
    }
    savePermissionsToFile(guildId, perms);
    return true;
}

function hasPermission(guildId, command, userId) {
    const perms = getPermissions(guildId);
    return perms[command] && perms[command].includes(userId);
}

function getGrantedUsers(guildId, command) {
    const perms = getPermissions(guildId);
    return perms[command] || [];
}

function getAllPermissions(guildId) {
    return getPermissions(guildId);
}

module.exports = {
    grantPermission,
    revokePermission,
    hasPermission,
    getGrantedUsers,
    getAllPermissions,
};
