const { getDb } = require('./db');

// ─── Public API ───

function getReactionRoles(guildId) {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM reaction_roles WHERE guild_id = ?').all(guildId);
    return rows.map(r => ({
        messageId: r.message_id,
        channelId: r.channel_id,
        emoji: r.emoji,
        roleId: r.role_id,
        label: r.label,
    }));
}

function addReactionRole(guildId, messageId, channelId, emoji, roleId, label) {
    const db = getDb();
    db.prepare('INSERT OR IGNORE INTO reaction_roles (guild_id, message_id, channel_id, emoji, role_id, label) VALUES (?, ?, ?, ?, ?, ?)')
        .run(guildId, messageId, channelId, emoji, roleId, label || null);
    // Return updated list
    return getReactionRoles(guildId);
}

function removeReactionRole(guildId, messageId, emoji) {
    const db = getDb();
    const result = db.prepare('DELETE FROM reaction_roles WHERE guild_id = ? AND message_id = ? AND emoji = ?')
        .run(guildId, messageId, emoji);
    return result.changes > 0;
}

function removeAllForMessage(guildId, messageId) {
    const db = getDb();
    const result = db.prepare('DELETE FROM reaction_roles WHERE guild_id = ? AND message_id = ?')
        .run(guildId, messageId);
    return result.changes;
}

function findReactionRole(guildId, messageId, emojiKey) {
    const db = getDb();
    const row = db.prepare('SELECT * FROM reaction_roles WHERE guild_id = ? AND message_id = ? AND emoji = ?')
        .get(guildId, messageId, emojiKey);
    if (!row) return null;
    return {
        messageId: row.message_id,
        channelId: row.channel_id,
        emoji: row.emoji,
        roleId: row.role_id,
        label: row.label,
    };
}

module.exports = {
    getReactionRoles,
    addReactionRole,
    removeReactionRole,
    removeAllForMessage,
    findReactionRole,
};
