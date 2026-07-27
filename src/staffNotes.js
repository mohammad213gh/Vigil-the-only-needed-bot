// ──────────────────── Staff Notes Module ────────────────────
// Allows staff to leave private notes on users (not visible to the user).

const { getDb } = require('./db');

// ──────────────────── CRUD Operations ────────────────────

function addNote(guildId, targetUserId, authorId, authorTag, note) {
    const db = getDb();
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const now = Date.now();

    db.prepare('INSERT INTO staff_notes (id, guild_id, target_user_id, author_id, author_tag, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(id, guildId, targetUserId, authorId, authorTag, note, now);

    return getNote(id);
}

function getNote(noteId) {
    const db = getDb();
    return db.prepare('SELECT * FROM staff_notes WHERE id = ?').get(noteId);
}

function getNotesForUser(guildId, targetUserId) {
    const db = getDb();
    return db.prepare(`
        SELECT * FROM staff_notes
        WHERE guild_id = ? AND target_user_id = ?
        ORDER BY created_at DESC
    `).all(guildId, targetUserId);
}

function editNote(noteId, newNote) {
    const db = getDb();
    const result = db.prepare('UPDATE staff_notes SET note = ?, updated_at = ? WHERE id = ?')
        .run(newNote, Date.now(), noteId);
    if (result.changes === 0) return null;
    return getNote(noteId);
}

function removeNote(noteId) {
    const db = getDb();
    const result = db.prepare('DELETE FROM staff_notes WHERE id = ?').run(noteId);
    return result.changes > 0;
}

function getRecentNotes(guildId, limit) {
    const db = getDb();
    limit = limit || 20;
    return db.prepare(`
        SELECT * FROM staff_notes
        WHERE guild_id = ?
        ORDER BY created_at DESC
        LIMIT ?
    `).all(guildId, limit);
}

function getNoteCount(guildId, targetUserId) {
    const db = getDb();
    const row = db.prepare('SELECT COUNT(*) as count FROM staff_notes WHERE guild_id = ? AND target_user_id = ?')
        .get(guildId, targetUserId);
    return row ? row.count : 0;
}

// ──────────────────── Dashboard API Helper ────────────────────

function getGuildNotesForDashboard(guildId) {
    const db = getDb();
    return db.prepare(`
        SELECT * FROM staff_notes
        WHERE guild_id = ?
        ORDER BY created_at DESC
        LIMIT 50
    `).all(guildId);
}

module.exports = {
    addNote,
    getNote,
    getNotesForUser,
    editNote,
    removeNote,
    getRecentNotes,
    getNoteCount,
    getGuildNotesForDashboard,
};
