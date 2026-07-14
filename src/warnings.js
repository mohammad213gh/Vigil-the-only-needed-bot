const { getDb } = require('./db');

// ─── Public API ───

function loadWarnings() {
    // Legacy: return old nested format
    const db = getDb();
    const rows = db.prepare('SELECT * FROM warnings ORDER BY date ASC').all();
    const result = {};
    for (const row of rows) {
        if (!result[row.guild_id]) result[row.guild_id] = {};
        if (!result[row.guild_id][row.user_id]) result[row.guild_id][row.user_id] = [];
        result[row.guild_id][row.user_id].push({
            id: row.id,
            reason: row.reason,
            moderator: row.moderator,
            date: row.date,
        });
    }
    return result;
}

function addWarning(guildId, userId, moderatorTag, reason) {
    const db = getDb();
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    db.prepare('INSERT INTO warnings (id, guild_id, user_id, moderator, reason, date) VALUES (?, ?, ?, ?, ?, ?)')
        .run(id, guildId, userId, moderatorTag, reason || 'No reason provided', new Date().toISOString());
    return getWarnings(guildId, userId);
}

function getWarnings(guildId, userId) {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM warnings WHERE guild_id = ? AND user_id = ? ORDER BY date ASC')
        .all(guildId, userId);
    return rows.map(r => ({
        id: r.id,
        reason: r.reason,
        moderator: r.moderator,
        date: r.date,
    }));
}

function clearWarnings(guildId, userId) {
    const db = getDb();
    db.prepare('DELETE FROM warnings WHERE guild_id = ? AND user_id = ?').run(guildId, userId);
    return true;
}

function removeWarning(guildId, userId, warningId) {
    const db = getDb();
    const result = db.prepare('DELETE FROM warnings WHERE guild_id = ? AND user_id = ? AND id = ?')
        .run(guildId, userId, warningId);
    return result.changes > 0;
}

module.exports = {
    loadWarnings,
    addWarning,
    getWarnings,
    clearWarnings,
    removeWarning,
};
