const { getDb } = require('./db');

// ──────────────────── Mod Case CRUD ────────────────────

function getNextCaseNumber(guildId) {
    const db = getDb();
    const row = db.prepare('SELECT next_case FROM mod_case_counters WHERE guild_id = ?').get(guildId);
    const num = row ? row.next_case : 1;
    db.prepare('INSERT OR REPLACE INTO mod_case_counters (guild_id, next_case) VALUES (?, ?)').run(guildId, num + 1);
    return num;
}

function createCase(guildId, userId, moderatorId, moderatorTag, actionType, reason) {
    const db = getDb();
    const caseNumber = getNextCaseNumber(guildId);
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const now = Date.now();

    const active = (actionType === 'ban' || actionType === 'timeout') ? 1 : 0;

    db.prepare('INSERT INTO mod_cases (id, guild_id, case_number, user_id, moderator_id, moderator_tag, action_type, reason, created_at, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(id, guildId, caseNumber, userId, moderatorId, moderatorTag, actionType, reason || '', now, active);

    return getCase(guildId, caseNumber);
}

function getCase(guildId, caseNumber) {
    const db = getDb();
    return db.prepare('SELECT * FROM mod_cases WHERE guild_id = ? AND case_number = ?').get(guildId, caseNumber);
}

function getCases(guildId, userId, limit) {
    const db = getDb();
    limit = limit || 20;
    if (userId) {
        return db.prepare('SELECT * FROM mod_cases WHERE guild_id = ? AND user_id = ? ORDER BY case_number DESC LIMIT ?').all(guildId, userId, limit);
    }
    return db.prepare('SELECT * FROM mod_cases WHERE guild_id = ? ORDER BY case_number DESC LIMIT ?').all(guildId, limit);
}

function getActiveCases(guildId) {
    const db = getDb();
    return db.prepare('SELECT * FROM mod_cases WHERE guild_id = ? AND active = 1 ORDER BY case_number DESC').all(guildId);
}

function updateCaseReason(guildId, caseNumber, newReason, moderatorTag) {
    const db = getDb();
    const c = getCase(guildId, caseNumber);
    if (!c) return null;
    const originalReason = c.reason;
    const now = Date.now();
    db.prepare('UPDATE mod_cases SET reason = ?, moderator_tag = ? WHERE guild_id = ? AND case_number = ?')
        .run(newReason + ' (updated by ' + moderatorTag + ' — was: ' + originalReason + ')', moderatorTag, guildId, caseNumber);
    return getCase(guildId, caseNumber);
}

function closeCase(guildId, caseNumber) {
    const db = getDb();
    db.prepare('UPDATE mod_cases SET active = 0 WHERE guild_id = ? AND case_number = ?').run(guildId, caseNumber);
    return getCase(guildId, caseNumber);
}

function getUserCaseCount(guildId, userId) {
    const db = getDb();
    const row = db.prepare('SELECT COUNT(*) as count FROM mod_cases WHERE guild_id = ? AND user_id = ?').get(guildId, userId);
    return row ? row.count : 0;
}

function getTotalCases(guildId) {
    const db = getDb();
    const row = db.prepare('SELECT MAX(case_number) as max FROM mod_cases WHERE guild_id = ?').get(guildId);
    return row && row.max ? row.max : 0;
}

module.exports = {
    createCase,
    getCase,
    getCases,
    getActiveCases,
    updateCaseReason,
    closeCase,
    getUserCaseCount,
    getTotalCases,
};
