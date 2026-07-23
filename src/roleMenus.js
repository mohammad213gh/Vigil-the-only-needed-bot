const { getDb } = require('./db');

// ──────────────────── Role Menu CRUD ────────────────────

function createRoleMenu(guildId, messageId, channelId, title) {
    const db = getDb();
    db.prepare('INSERT OR REPLACE INTO role_menus (guild_id, message_id, channel_id, title, created_at) VALUES (?, ?, ?, ?, ?)')
        .run(guildId, messageId, channelId, title || null, Date.now());
}

function getRoleMenus(guildId) {
    const db = getDb();
    return db.prepare('SELECT * FROM role_menus WHERE guild_id = ? ORDER BY created_at DESC').all(guildId);
}

function removeRoleMenu(guildId, messageId) {
    const db = getDb();
    db.prepare('DELETE FROM role_menu_options WHERE message_id = ?').run(messageId);
    const result = db.prepare('DELETE FROM role_menus WHERE guild_id = ? AND message_id = ?').run(guildId, messageId);
    return result.changes > 0;
}

// ──────────────────── Role Menu Options CRUD ────────────────────

function addRoleMenuOption(messageId, roleId, label, emoji, description) {
    const db = getDb();
    const maxOrder = db.prepare('SELECT MAX(sort_order) as mx FROM role_menu_options WHERE message_id = ?').get(messageId);
    const nextOrder = (maxOrder && maxOrder.mx !== null ? maxOrder.mx : -1) + 1;
    db.prepare('INSERT OR REPLACE INTO role_menu_options (message_id, role_id, label, emoji, description, sort_order) VALUES (?, ?, ?, ?, ?, ?)')
        .run(messageId, roleId, label, emoji || null, description || null, nextOrder);
}

function getRoleMenuOptions(messageId) {
    const db = getDb();
    return db.prepare('SELECT * FROM role_menu_options WHERE message_id = ? ORDER BY sort_order').all(messageId);
}

function removeRoleMenuOption(messageId, roleId) {
    const db = getDb();
    // Re-order remaining options
    const result = db.prepare('DELETE FROM role_menu_options WHERE message_id = ? AND role_id = ?').run(messageId, roleId);
    return result.changes > 0;
}

module.exports = {
    createRoleMenu,
    getRoleMenus,
    removeRoleMenu,
    addRoleMenuOption,
    getRoleMenuOptions,
    removeRoleMenuOption,
};
