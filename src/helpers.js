const { COUNTRY_FLAGS } = require('./constants');
const { logError } = require('./logError');

// ──────────────────── String Utilities ────────────────────

function truncate(str, max = 1024) {
    if (!str) return '*Empty*';
    return str.length > max ? str.slice(0, max - 3) + '...' : str;
}

function reverseText(text) {
    return text.split('').reverse().join('');
}

function mockText(text) {
    return text.split('').map((char, i) =>
        i % 2 === 0 ? char.toLowerCase() : char.toUpperCase()
    ).join('');
}

// ──────────────────── Number/Time Formatting ────────────────────

function formatUptime(ms) {
    if (!ms) return '0s';
    const t = Math.floor(ms / 1000);
    const d = Math.floor(t / 86400);
    const h = Math.floor((t % 86400) / 3600);
    const m = Math.floor((t % 3600) / 60);
    const s = t % 60;
    const parts = [];
    if (d) parts.push(d + 'd');
    if (h) parts.push(h + 'h');
    if (m) parts.push(m + 'm');
    parts.push(s + 's');
    return parts.join(' ');
}

function formatNumber(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return String(n);
}

function parseDuration(str) {
    // Parse strings like "10m", "1h", "2d", "30s", or combined like "1h30m" into milliseconds
    const regex = /(\d+)\s*(s|m|h|d)/gi;
    const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
    let total = 0;
    let match;
    let found = false;
    while ((match = regex.exec(str)) !== null) {
        total += parseInt(match[1]) * (multipliers[match[2].toLowerCase()] || 0);
        found = true;
    }
    return found ? total : null;
}

function formatDuration(ms) {
    if (ms < 1000) return ms + 'ms';
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    const d = Math.floor(h / 24);
    const parts = [];
    if (d) parts.push(d + 'd');
    if (h % 24) parts.push(h % 24 + 'h');
    if (m % 60) parts.push(m % 60 + 'm');
    if (s % 60) parts.push(s % 60 + 's');
    return parts.join(' ') || '0s';
}

// ──────────────────── Discord Utilities ────────────────────

function emojiToString(emoji) {
    return emoji.id
        ? '<' + (emoji.animated ? 'a' : '') + ':' + emoji.name + ':' + emoji.id + '>'
        : emoji.name;
}

function isOwner(userId) {
    return userId === process.env.OWNER_ID;
}

function getFlag(team) {
    const key = team.toLowerCase().trim();
    return COUNTRY_FLAGS[key] || '⚽';
}

// ──────────────────── Random Helpers ────────────────────

function randomItem(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ──────────────────── Audit Log Helper ────────────────────

async function fetchAuditLogExecutor(guild, actionType, targetId) {
    // Attempt to find who made a change via audit logs
    // Returns the executor (User) or null
    if (!guild || !guild.fetchAuditLogs) return null;
    try {
        const audit = await guild.fetchAuditLogs({ type: actionType, limit: 5 });
        if (!audit || !audit.entries) return null;
        // Find the entry that matches our target
        if (targetId) {
            const entry = audit.entries.find(e => e.target?.id === targetId || e.targetId === targetId);
            return entry?.executor || null;
        }
        // Return the most recent entry's executor
        const first = audit.entries.first();
        return first?.executor || null;
    } catch (err) {
        logError(err, 'helpers', 'fetchAuditLogExecutor(' + actionType + ')' );
        return null;
    }
}

module.exports = {
    truncate,
    reverseText,
    mockText,
    formatUptime,
    formatNumber,
    parseDuration,
    formatDuration,
    emojiToString,
    isOwner,
    getFlag,
    randomItem,
    randomInt,
    fetchAuditLogExecutor,
};
