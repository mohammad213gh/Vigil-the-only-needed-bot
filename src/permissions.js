const { getDb } = require('./db');

// ─── Public API ───

function grantPermission(guildId, command, userId) {
    const db = getDb();
    db.prepare('INSERT OR IGNORE INTO permissions (guild_id, command, user_id) VALUES (?, ?, ?)')
        .run(guildId, command, userId);
}

function revokePermission(guildId, command, userId) {
    const db = getDb();
    db.prepare('DELETE FROM permissions WHERE guild_id = ? AND command = ? AND user_id = ?')
        .run(guildId, command, userId);
}

function hasPermission(guildId, command, userId) {
    const db = getDb();
    const row = db.prepare('SELECT 1 FROM permissions WHERE guild_id = ? AND command = ? AND user_id = ?')
        .get(guildId, command, userId);
    return !!row;
}

function getGrantedUsers(guildId, command) {
    const db = getDb();
    const rows = db.prepare('SELECT user_id FROM permissions WHERE guild_id = ? AND command = ?')
        .all(guildId, command);
    return rows.map(r => r.user_id);
}

function getAllPermissions(guildId) {
    const db = getDb();
    const rows = db.prepare('SELECT command, user_id FROM permissions WHERE guild_id = ?').all(guildId);
    const result = {};
    for (const row of rows) {
        if (!result[row.command]) result[row.command] = [];
        result[row.command].push(row.user_id);
    }
    return result;
}

module.exports = {
    grantPermission,
    revokePermission,
    hasPermission,
    getGrantedUsers,
    getAllPermissions,
};
