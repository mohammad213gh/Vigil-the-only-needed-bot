const { COUNTRY_FLAGS } = require('./constants');
const { logError } = require('./logError');
const { escapeMarkdown } = require('discord.js');

// ──────────────────── Input Sanitization ────────────────────

// Sanitize user input for safe embedding in Discord embeds
// Removes markdown that could be abused, escapes mentions, limits length
function sanitizeForEmbed(str, maxLen = 1024) {
    if (!str) return '*Empty*';
    const cleaned = escapeMarkdown(String(str))
        .replace(/@(everyone|here)/g, '@\u200b$1') // Zero-width space to prevent pings
        .replace(/<@!?&?\d+>/g, '') // Remove raw mention strings
        .slice(0, maxLen);
    return cleaned.length < String(str).length ? cleaned + '…' : cleaned;
}

// Sanitize user input for DMs (stricter, no markdown rendering)
function sanitizeForDM(str, maxLen = 2000) {
    if (!str) return '';
    return String(str)
        .replace(/@(everyone|here)/g, '@\u200b$1')
        .replace(/<@!?&?\d+>/g, '')
        .slice(0, maxLen);
}

// Sanitize user input for database storage (no length limit, just safety)
function sanitizeForDB(str) {
    if (!str) return '';
    return String(str)
        .replace(/@(everyone|here)/g, '@\u200b$1')
        .replace(/<@!?&?\d+>/g, '');
}

// Sanitize channel/role names for display
function sanitizeName(str, maxLen = 100) {
    if (!str) return 'Unnamed';
    return escapeMarkdown(String(str))
        .replace(/@(everyone|here)/g, '@\u200b$1')
        .slice(0, maxLen);
}

// Validate and sanitize modal text input
function validateModalInput(str, { required = true, minLength = 1, maxLength = 1000, allowMarkdown = false } = {}) {
    if (!str || !str.trim()) {
        if (required) return { valid: false, error: 'This field is required' };
        return { valid: true, value: '' };
    }
    const trimmed = str.trim();
    if (trimmed.length < minLength) {
        return { valid: false, error: `Must be at least ${minLength} characters` };
    }
    if (trimmed.length > maxLength) {
        return { valid: false, error: `Must be ${maxLength} characters or less` };
    }
    const sanitized = allowMarkdown
        ? sanitizeForEmbed(trimmed, maxLength)
        : sanitizeForDM(trimmed, maxLength);
    return { valid: true, value: sanitized };
}

// ──────────────────── String Utilities ────────────────────

function truncate(str, max = 1024) {
    if (!str) return '*Empty*';
    if (typeof str !== 'string') return String(str).slice(0, max);
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
    if (!guild?.fetchAuditLogs) return null;
    try {
        const audit = await guild.fetchAuditLogs({ type: actionType, limit: 5 });
        if (!audit?.entries) return null;
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

// ──────────────────── Poll Helpers ────────────────────
function makePollBar(count, total, isLeading) {
    if (total === 0) return '\u25AB'.repeat(10);
    const filled = Math.max(Math.round((count / total) * 10), count > 0 ? 1 : 0);
    const fillChar = isLeading ? '\uD83D\uDFE2' : '\uD83D\uDD35';
    const emptyChar = '\u25AB';
    return fillChar.repeat(filled) + emptyChar.repeat(10 - filled);
}

function getLeadingOption(voteCounts) {
    if (!voteCounts || typeof voteCounts !== 'object') return null;
    const entries = Object.entries(voteCounts);
    if (entries.length === 0) return null;
    const maxEntry = entries.reduce((max, curr) => curr[1] > max[1] ? curr : max);
    return parseInt(maxEntry[0]);
}

// ──────────────────── Welcome/Goodbye Placeholders ────────────────────

function replacePlaceholders(text, member, type) {
    if (!text || !member?.guild?.members?.cache) return text || '';
    const guild = member.guild;
    const user = member.user;
    const memberCount = guild.memberCount || 0;
    const botCount = guild.members.cache.filter(m => m.user.bot).size;
    const humanCount = memberCount - botCount;
    
    const replacements = {
        // User
        '{user}': '<@' + user.id + '>',
        '{username}': user.tag,
        '{name}': user.username,
        '{displayname}': member.displayName || user.username,
        '{mention}': '<@' + user.id + '>',
        '{userid}': user.id,
        '{discriminator}': user.discriminator,
        '{avatar}': user.displayAvatarURL({ size: 128 }),
        '{created}': '<t:' + Math.floor(user.createdTimestamp / 1000) + ':R>',
        '{age}': formatUptime(Date.now() - user.createdTimestamp),
        // Server
        '{server}': guild.name,
        '{serverid}': guild.id,
        '{servericon}': guild.iconURL({ size: 128 }) || '',
        '{owner}': '<@' + guild.ownerId + '>',
        '{ownerid}': guild.ownerId,
        '{membercount}': String(memberCount),
        '{members}': String(memberCount),
        '{botcount}': String(botCount),
        '{humancount}': String(humanCount),
        '{channelcount}': String(guild.channels.cache.size),
        '{textchannelcount}': String(guild.channels.cache.filter(function(c) { return c.type === 0; }).size),
        '{voicechannelcount}': String(guild.channels.cache.filter(function(c) { return c.type === 2; }).size),
        '{rolecount}': String(guild.roles.cache.size),
        '{boosts}': String(guild.premiumSubscriptionCount || 0),
        '{boosttier}': String(guild.premiumTier),
        // Date/time
        '{date}': new Date().toLocaleDateString(),
        '{time}': new Date().toLocaleTimeString(),
        '{year}': String(new Date().getFullYear()),
    };
    
    // Type-specific placeholders
    if (type === 'welcome') {
        replacements['{joined}'] = '<t:' + Math.floor(Date.now() / 1000) + ':R>';
        replacements['{created_relative}'] = '<t:' + Math.floor(user.createdTimestamp / 1000) + ':R>';
    }
    if (type === 'goodbye') {
        replacements['{joined}'] = member.joinedAt
            ? '<t:' + Math.floor(member.joinedAt.getTime() / 1000) + ':R>'
            : '*Unknown*';
        replacements['{duration}'] = member.joinedAt
            ? formatUptime(Date.now() - member.joinedAt.getTime())
            : '*Unknown*';
        replacements['{left}'] = '<t:' + Math.floor(Date.now() / 1000) + ':R>';
    }
    
    let result = text;
    for (const [key, value] of Object.entries(replacements)) {
        result = result.split(key).join(value);
    }
    return result;
}

// ──────────────────── Circuit Breaker & Retry ────────────────────

class CircuitBreaker {
    constructor(options = {}) {
        this.failureThreshold = options.failureThreshold || 5;
        this.successThreshold = options.successThreshold || 2;
        this.timeout = options.timeout || 30000;
        this.state = 'closed';
        this.failures = 0;
        this.successes = 0;
        this.lastFailureTime = null;
        this.onStateChange = options.onStateChange || (() => {});
    }

    async execute(fn) {
        if (this.state === 'open') {
            if (Date.now() - this.lastFailureTime > this.timeout) {
                this.state = 'half-open';
                this.onStateChange('half-open');
            } else {
                throw new Error('Circuit breaker is open');
            }
        }

        try {
            const result = await fn();
            this.onSuccess();
            return result;
        } catch (err) {
            this.onFailure();
            throw err;
        }
    }

    onSuccess() {
        this.failures = 0;
        if (this.state === 'half-open') {
            this.successes++;
            if (this.successes >= this.successThreshold) {
                this.state = 'closed';
                this.successes = 0;
                this.onStateChange('closed');
            }
        }
    }

    onFailure() {
        this.failures++;
        this.lastFailureTime = Date.now();
        if (this.state === 'half-open' || this.failures >= this.failureThreshold) {
            this.state = 'open';
            this.successes = 0;
            this.onStateChange('open');
        }
    }

    getState() {
        return this.state;
    }

    reset() {
        this.state = 'closed';
        this.failures = 0;
        this.successes = 0;
        this.lastFailureTime = null;
    }
}

// Discord API circuit breaker instance
const discordApiBreaker = new CircuitBreaker({
    failureThreshold: 10,
    successThreshold: 3,
    timeout: 60000,
    onStateChange: (state) => {
        logWarn(`Discord API circuit breaker: ${state}`, 'circuit-breaker');
    },
});

// Retry with exponential backoff
async function withRetry(fn, options = {}) {
    const maxRetries = options.maxRetries ?? 3;
    const baseDelay = options.baseDelay ?? 1000;
    const maxDelay = options.maxDelay ?? 10000;
    const retryableErrors = options.retryableErrors ?? ['rate limited', 'timeout', 'ECONNRESET', 'ETIMEDOUT', '502', '503', '504'];

    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (err) {
            lastError = err;
            const msg = err.message?.toLowerCase() || '';
            const isRetryable = retryableErrors.some(e => msg.includes(e.toLowerCase()));
            
            if (!isRetryable || attempt === maxRetries) {
                throw err;
            }
            
            const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
            const jitter = delay * 0.1 * Math.random();
            await new Promise(r => setTimeout(r, delay + jitter));
        }
    }
    throw lastError;
}

// Execute Discord API call with circuit breaker + retry
async function discordApiCall(fn, context = '') {
    return discordApiBreaker.execute(() => withRetry(fn, {
        maxRetries: 3,
        baseDelay: 1000,
        retryableErrors: ['rate limited', 'timeout', '502', '503', '504', 'ECONNRESET', 'ETIMEDOUT'],
    })).catch(err => {
        logError(err, 'discord-api', context);
        throw err;
    });
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
    makePollBar,
    getLeadingOption,
    replacePlaceholders,
    sanitizeForEmbed,
    sanitizeForDM,
    sanitizeForDB,
    sanitizeName,
    validateModalInput,
    CircuitBreaker,
    withRetry,
    discordApiCall,
    discordApiBreaker,
};
