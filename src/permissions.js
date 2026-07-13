const { loadConfig, saveConfig } = require('./config');

const PERM_KEY = '_perms';

// ──────────────────── Permission Structure ────────────────────
// Config stored in config.json under _perms key:
// {
//   "guildId": {
//     "commandName": ["userId1", "userId2"]
//   }
// }

function getPermissions(guildId) {
    const config = loadConfig();
    if (!config[PERM_KEY]) config[PERM_KEY] = {};
    if (!config[PERM_KEY][guildId]) config[PERM_KEY][guildId] = {};
    return config[PERM_KEY][guildId];
}

function savePermissions(guildId, perms) {
    const config = loadConfig();
    if (!config[PERM_KEY]) config[PERM_KEY] = {};
    config[PERM_KEY][guildId] = perms;
    saveConfig(config);
}

function grantPermission(guildId, command, userId) {
    const perms = getPermissions(guildId);
    if (!perms[command]) perms[command] = [];
    if (!perms[command].includes(userId)) {
        perms[command].push(userId);
    }
    savePermissions(guildId, perms);
    return true;
}

function revokePermission(guildId, command, userId) {
    const perms = getPermissions(guildId);
    if (perms[command]) {
        perms[command] = perms[command].filter(id => id !== userId);
        if (perms[command].length === 0) delete perms[command];
    }
    savePermissions(guildId, perms);
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
