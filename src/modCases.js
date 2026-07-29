const { getDb } = require('./db');
const { logError } = require('./logError');

// ──────────────────── Mod Case CRUD ────────────────────

function getNextCaseNumber(guildId) {
    const db = getDb();
    try {
        const row = db.prepare('SELECT next_case FROM mod_case_counters WHERE guild_id = ?').get(guildId);
        const num = row ? row.next_case : 1;
        db.prepare('INSERT OR REPLACE INTO mod_case_counters (guild_id, next_case) VALUES (?, ?)').run(guildId, num + 1);
        return num;
    } catch (err) {
        logError(err, 'modCases', 'getNextCaseNumber(' + guildId + ')');
        return Date.now() % 100000;
    }
}

function createCase(guildId, userId, moderatorId, moderatorTag, actionType, reason) {
    try {
        const db = getDb();
        const caseNumber = getNextCaseNumber(guildId);
        const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
        const now = Date.now();

        const active = (actionType === 'ban' || actionType === 'tempban' || actionType === 'timeout') ? 1 : 0;

        db.prepare('INSERT INTO mod_cases (id, guild_id, case_number, user_id, moderator_id, moderator_tag, action_type, reason, created_at, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
            .run(id, guildId, caseNumber, userId, moderatorId, moderatorTag, actionType, reason || '', now, active);

        return getCase(guildId, caseNumber);
    } catch (err) {
        logError(err, 'modCases', 'createCase');
        return null;
    }
}

function getCase(guildId, caseNumber) {
    try {
        const db = getDb();
        return db.prepare('SELECT * FROM mod_cases WHERE guild_id = ? AND case_number = ?').get(guildId, caseNumber);
    } catch (err) {
        logError(err, 'modCases', 'getCase(' + guildId + ', ' + caseNumber + ')');
        return null;
    }
}

function getCases(guildId, userId, limit) {
    try {
        const db = getDb();
        const safeLimit = Math.min(limit || 20, 100);
        if (userId) {
            return db.prepare('SELECT * FROM mod_cases WHERE guild_id = ? AND user_id = ? ORDER BY case_number DESC LIMIT ?').all(guildId, userId, safeLimit);
        }
        return db.prepare('SELECT * FROM mod_cases WHERE guild_id = ? ORDER BY case_number DESC LIMIT ?').all(guildId, safeLimit);
    } catch (err) {
        logError(err, 'modCases', 'getCases');
        return [];
    }
}

function getActiveCases(guildId) {
    try {
        const db = getDb();
        return db.prepare('SELECT * FROM mod_cases WHERE guild_id = ? AND active = 1 ORDER BY case_number DESC').all(guildId);
    } catch (err) {
        logError(err, 'modCases', 'getActiveCases(' + guildId + ')');
        return [];
    }
}

function updateCaseReason(guildId, caseNumber, newReason, moderatorTag) {
    try {
        const db = getDb();
        const c = getCase(guildId, caseNumber);
        if (!c) return null;
        db.prepare('UPDATE mod_cases SET reason = ?, moderator_tag = ? WHERE guild_id = ? AND case_number = ?')
            .run(newReason + ' (updated by ' + moderatorTag + ')', moderatorTag, guildId, caseNumber);
        return getCase(guildId, caseNumber);
    } catch (err) {
        logError(err, 'modCases', 'updateCaseReason');
        return null;
    }
}

function closeCase(guildId, caseNumber) {
    try {
        const db = getDb();
        db.prepare('UPDATE mod_cases SET active = 0 WHERE guild_id = ? AND case_number = ?').run(guildId, caseNumber);
        return getCase(guildId, caseNumber);
    } catch (err) {
        logError(err, 'modCases', 'closeCase');
        return null;
    }
}

function getUserCaseCount(guildId, userId) {
    try {
        const db = getDb();
        const row = db.prepare('SELECT COUNT(*) as count FROM mod_cases WHERE guild_id = ? AND user_id = ?').get(guildId, userId);
        return row ? row.count : 0;
    } catch (err) {
        logError(err, 'modCases', 'getUserCaseCount');
        return 0;
    }
}

function getTotalCases(guildId) {
    try {
        const db = getDb();
        const row = db.prepare('SELECT MAX(case_number) as max FROM mod_cases WHERE guild_id = ?').get(guildId);
        return row?.max || 0;
    } catch (err) {
        logError(err, 'modCases', 'getTotalCases');
        return 0;
    }
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
