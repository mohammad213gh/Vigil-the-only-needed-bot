// ──────────────────── Warning Thresholds Module ────────────────────
// Allows guilds to set automatic punishments when a user reaches
// a certain number of warnings (e.g., 3 warns = timeout, 5 warns = kick)

const { getDb } = require('./db');
const { getWarnings } = require('./warnings');
const { createCase } = require('./modCases');
const { logError } = require('./logError');

// ──────────────────── Threshold Config ────────────────────

const DEFAULT_ACTIONS = ['timeout', 'kick', 'ban'];

function getThresholds(guildId) {
    const db = getDb();
    const row = db.prepare('SELECT thresholds FROM warning_thresholds WHERE guild_id = ?').get(guildId);
    if (!row) return [];
    try {
        return JSON.parse(row.thresholds) || [];
    } catch {
        return [];
    }
}

function setThresholds(guildId, thresholds) {
    const db = getDb();
    if (!Array.isArray(thresholds)) thresholds = [];
    // Validate each threshold
    thresholds = thresholds.filter(t => {
        return t.warnCount > 0 && DEFAULT_ACTIONS.includes(t.action) && (!t.duration || t.duration > 0);
    });
    db.prepare('INSERT OR REPLACE INTO warning_thresholds (guild_id, thresholds) VALUES (?, ?)')
        .run(guildId, JSON.stringify(thresholds));
    return thresholds;
}

function addThreshold(guildId, warnCount, action, duration) {
    const thresholds = getThresholds(guildId);
    // Remove existing threshold for same warn count (update it)
    const filtered = thresholds.filter(t => t.warnCount !== warnCount);
    filtered.push({ warnCount, action, duration: duration || null });
    filtered.sort((a, b) => a.warnCount - b.warnCount);
    return setThresholds(guildId, filtered);
}

function removeThreshold(guildId, warnCount) {
    const thresholds = getThresholds(guildId).filter(t => t.warnCount !== warnCount);
    return setThresholds(guildId, thresholds);
}

// ──────────────────── Auto-Punish Check ────────────────────

async function checkThresholds(guild, userId, interaction) {
    const thresholds = getThresholds(guild.id);
    if (thresholds.length === 0) return null;

    const warnings = getWarnings(guild.id, userId);
    const warnCount = warnings.length;

    // Find the highest threshold that's been reached
    const matched = thresholds
        .filter(t => warnCount >= t.warnCount)
        .sort((a, b) => b.warnCount - a.warnCount);

    if (matched.length === 0) return null;

    const threshold = matched[0];

    // Get the member
    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) return null;

    // Skip if user has admin perms
    if (member.permissions.has('Administrator') || member.permissions.has('ManageMessages')) return null;

    let actionResult = null;

    try {
        switch (threshold.action) {
            case 'timeout': {
                if (!member.moderatable) break;
                const durationMs = (threshold.duration || 10) * 60 * 1000; // default 10 min
                await member.timeout(durationMs, 'Auto-punish: Reached ' + warnCount + ' warnings (threshold: ' + threshold.warnCount + ')');
                createCase(guild.id, userId, guild.members.me.id, 'Auto-Mod', 'timeout', 'Auto-punish at ' + warnCount + ' warnings');
                actionResult = 'timed out for ' + (threshold.duration || 10) + ' minutes';
                break;
            }
            case 'kick': {
                if (!member.kickable) break;
                await member.kick('Auto-punish: Reached ' + warnCount + ' warnings (threshold: ' + threshold.warnCount + ')');
                createCase(guild.id, userId, guild.members.me.id, 'Auto-Mod', 'kick', 'Auto-punish at ' + warnCount + ' warnings');
                actionResult = 'kicked';
                break;
            }
            case 'ban': {
                if (!member.bannable) break;
                await guild.bans.create(userId, { reason: 'Auto-punish: Reached ' + warnCount + ' warnings (threshold: ' + threshold.warnCount + ')' });
                createCase(guild.id, userId, guild.members.me.id, 'Auto-Mod', 'ban', 'Auto-punish at ' + warnCount + ' warnings');
                actionResult = 'banned';
                break;
            }
        }
    } catch (err) {
        logError(err, 'thresholds', 'auto_punish');
    }

    return actionResult;
}

module.exports = {
    getThresholds,
    setThresholds,
    addThreshold,
    removeThreshold,
    checkThresholds,
    DEFAULT_ACTIONS,
};
