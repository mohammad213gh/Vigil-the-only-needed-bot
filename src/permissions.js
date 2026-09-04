const { getDb } = require('./db');

// ─── Permission Cache ───
const permCache = new Map(); // guildId -> { commands: Map<command, Set<userId>>, timestamp }
const PERM_CACHE_TTL = 30000; // 30 seconds
const PERM_CACHE_MAX = 500; // max guilds cached

function getCachedPermissions(guildId) {
    const cached = permCache.get(guildId);
    if (cached && Date.now() - cached.timestamp < PERM_CACHE_TTL) {
        return cached.commands;
    }
    const db = getDb();
    const rows = db.prepare('SELECT command, user_id FROM permissions WHERE guild_id = ?').all(guildId);
    const commands = new Map();
    for (const row of rows) {
        if (!commands.has(row.command)) commands.set(row.command, new Set());
        commands.get(row.command).add(row.user_id);
    }
    if (permCache.size >= PERM_CACHE_MAX) {
        const oldestKey = permCache.keys().next().value;
        permCache.delete(oldestKey);
    }
    permCache.set(guildId, { commands, timestamp: Date.now() });
    return commands;
}

function invalidatePermissionCache(guildId) {
    permCache.delete(guildId);
}

// ─── Public API ───

function grantPermission(guildId, command, userId) {
    const db = getDb();
    db.prepare('INSERT OR IGNORE INTO permissions (guild_id, command, user_id) VALUES (?, ?, ?)')
        .run(guildId, command, userId);
    invalidatePermissionCache(guildId);
}

function revokePermission(guildId, command, userId) {
    const db = getDb();
    db.prepare('DELETE FROM permissions WHERE guild_id = ? AND command = ? AND user_id = ?')
        .run(guildId, command, userId);
    invalidatePermissionCache(guildId);
}

function hasPermission(guildId, command, userId) {
    const commands = getCachedPermissions(guildId);
    const users = commands.get(command);
    return users ? users.has(userId) : false;
}

function getGrantedUsers(guildId, command) {
    const commands = getCachedPermissions(guildId);
    const users = commands.get(command);
    return users ? [...users] : [];
}

function getAllPermissions(guildId) {
    const commands = getCachedPermissions(guildId);
    const result = {};
    for (const [cmd, users] of commands.entries()) {
        result[cmd] = [...users];
    }
    return result;
}

module.exports = {
    grantPermission,
    revokePermission,
    hasPermission,
    getGrantedUsers,
    getAllPermissions,
    invalidatePermissionCache,
};
