const { getDb } = require('./db');
const { sendLog } = require('./logging');
const { EmbedBuilder } = require('discord.js');

// ──────────────────── Rule Types ────────────────────
// spam      — X messages in Y seconds
// mentions  — more than X mentions in a message
// words     — banned words/phrases
// links     — block links (or allowlist)
// caps      — message is > 70% caps and > 20 chars

const RULE_TYPES = ['spam', 'mentions', 'words', 'links', 'caps'];
const ACTIONS = ['warn', 'delete', 'timeout', 'kick'];

const DEFAULT_RULES = {
    spam:      { enabled: false, threshold: 5, time_window: 10, action: 'warn', duration: null },
    mentions:  { enabled: false, threshold: 5, time_window: 0,  action: 'delete', duration: null },
    words:     { enabled: false, threshold: 0, time_window: 0,  action: 'delete', duration: null },
    links:     { enabled: false, threshold: 0, time_window: 0,  action: 'delete', duration: null },
    caps:      { enabled: false, threshold: 70, time_window: 0, action: 'warn', duration: null },
};

// ──────────────────── Rule Config ────────────────────

function getAutoModRules(guildId) {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM automod_rules WHERE guild_id = ?').all(guildId);
    const rules = {};
    for (const r of RULE_TYPES) {
        rules[r] = { ...DEFAULT_RULES[r] };
    }
    for (const row of rows) {
        if (rules[row.rule_type]) {
            rules[row.rule_type].enabled = !!row.enabled;
            rules[row.rule_type].threshold = row.threshold;
            rules[row.rule_type].time_window = row.time_window;
            rules[row.rule_type].action = row.action;
            rules[row.rule_type].duration = row.duration;
        }
    }
    return rules;
}

function updateAutoModRule(guildId, ruleType, config) {
    const db = getDb();
    db.prepare('INSERT OR REPLACE INTO automod_rules (guild_id, rule_type, enabled, threshold, time_window, action, duration) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(guildId, ruleType, config.enabled ? 1 : 0, config.threshold || 0, config.time_window || 0, config.action || 'warn', config.duration || null);
}

// ──────────────────── Word Filters ────────────────────

function getAutoModFilters(guildId, filterType) {
    const db = getDb();
    return db.prepare('SELECT * FROM automod_filters WHERE guild_id = ? AND filter_type = ?').all(guildId, filterType);
}

function addAutoModFilter(guildId, filterType, pattern, action) {
    const db = getDb();
    db.prepare('INSERT OR REPLACE INTO automod_filters (guild_id, filter_type, pattern, action) VALUES (?, ?, ?, ?)')
        .run(guildId, filterType, pattern.toLowerCase(), action || 'delete');
}

function removeAutoModFilter(guildId, filterType, pattern) {
    const db = getDb();
    const result = db.prepare('DELETE FROM automod_filters WHERE guild_id = ? AND filter_type = ? AND pattern = ?')
        .run(guildId, filterType, pattern.toLowerCase());
    return result.changes > 0;
}

// ──────────────────── Spam Tracking (in-memory) ────────────────────

const spamTracker = new Map(); // guildId_userId → [timestamps]

// Periodic cleanup of stale spam entries (every 5 minutes)
setInterval(() => {
    const cutoff = Date.now() - 120000; // 2 minutes
    for (const [key, timestamps] of spamTracker.entries()) {
        while (timestamps.length > 0 && timestamps[0] < cutoff) {
            timestamps.shift();
        }
        if (timestamps.length === 0) {
            spamTracker.delete(key);
        }
    }
}, 300000).unref();

function checkSpam(guildId, userId, threshold, timeWindow) {
    const key = guildId + '_' + userId;
    const now = Date.now();
    if (!spamTracker.has(key)) spamTracker.set(key, []);
    const timestamps = spamTracker.get(key);
    // Remove old entries outside the time window
    const cutoff = now - timeWindow * 1000;
    while (timestamps.length > 0 && timestamps[0] < cutoff) {
        timestamps.shift();
    }
    timestamps.push(now);
    return timestamps.length >= threshold;
}

// ──────────────────── Message Check ────────────────────

async function checkMessage(message, guildId) {
    const rules = getAutoModRules(guildId);
    const content = message.content || '';
    const member = message.member;
    if (!member) return;

    // Skip bots and users with admin/manage messages
    if (member.user.bot) return;
    if (member.permissions.has('Administrator') || member.permissions.has('ManageMessages')) return;

    let violations = [];

    // ── Spam check ──
    if (rules.spam.enabled && content.length > 0) {
        if (checkSpam(guildId, message.author.id, rules.spam.threshold, rules.spam.time_window)) {
            violations.push({ type: 'spam', rule: rules.spam, reason: 'Spam detected (' + rules.spam.threshold + ' msgs in ' + rules.spam.time_window + 's)' });
        }
    }

    // ── Mention check ──
    if (rules.mentions.enabled) {
        const mentionCount = (message.mentions.users.size + message.mentions.roles.size + message.mentions.channels.size);
        if (mentionCount > rules.mentions.threshold) {
            violations.push({ type: 'mass mention', rule: rules.mentions, reason: 'Mass mention (' + mentionCount + ' mentions)' });
        }
    }

    // ── Word filter check ──
    if (rules.words.enabled && content.length > 0) {
        const filters = getAutoModFilters(guildId, 'words');
        const lower = content.toLowerCase();
        for (const f of filters) {
            if (lower.includes(f.pattern)) {
                violations.push({ type: 'banned word', rule: { ...rules.words, action: f.action }, reason: 'Banned word: "' + f.pattern + '"' });
                break;
            }
        }
    }

    // ── Link check ──
    if (rules.links.enabled && content.length > 0) {
        const linkRegex = /https?:\/\/[^\s]+/gi;
        if (linkRegex.test(content)) {
            const whitelist = getAutoModFilters(guildId, 'links');
            const allLinks = content.match(linkRegex) || [];
            const allowed = whitelist.length === 0 ? [] : whitelist.map(f => f.pattern.toLowerCase());
            const blocked = allLinks.filter(link => {
                if (allowed.length === 0) return true; // no whitelist = block all
                return !allowed.some(a => link.toLowerCase().includes(a));
            });
            if (blocked.length > 0) {
                violations.push({ type: 'link', rule: rules.links, reason: 'Blocked link' });
            }
        }
    }

    // ── Caps check ──
    if (rules.caps.enabled && content.length > 20) {
        const upper = (content.match(/[A-Z]/g) || []).length;
        const pct = (upper / content.length) * 100;
        if (pct > rules.caps.threshold) {
            violations.push({ type: 'excessive caps', rule: rules.caps, reason: 'Excessive caps (' + Math.round(pct) + '%)' });
        }
    }

    // ── Execute actions ──
    for (const v of violations) {
        await executeAutoModAction(message, guildId, v);
    }

    return violations.length > 0;
}

async function executeAutoModAction(message, guildId, violation) {
    const action = violation.rule.action;

    // Delete message
    if (action === 'delete' || action === 'timeout' || action === 'kick') {
        if (message.deletable) {
            try { await message.delete(); } catch { /* already deleted */ }
        }
    }

    // Warn user
    if (action === 'warn' || action === 'timeout') {
        try {
            await message.member.send('⚠️ **Auto-Moderation** in **' + message.guild.name + '**\\nReason: ' + violation.reason).catch(() => {});
        } catch { /* DMs closed */ }
    }

    // Timeout user
    if (action === 'timeout') {
        const duration = violation.rule.duration || 600000; // default 10 min
        if (message.member.moderatable) {
            try { await message.member.timeout(duration, violation.reason); } catch {}
        }
    }

    // Kick user
    if (action === 'kick') {
        if (message.member.kickable) {
            try { await message.member.kick(violation.reason); } catch {}
        }
    }

    // Log the action
    const embed = new EmbedBuilder()
        .setColor(0xE74C3C)
        .setTitle('🤖 Auto-Mod: ' + violation.type)
        .setDescription('**User:** ' + message.author.tag + ' (' + message.author.id + ')' + '\n**Action:** ' + action + '\n**Reason:** ' + violation.reason + '\n**Channel:** ' + message.channel.toString())
        .setTimestamp();

    if (message.content && message.content.length > 0) {
        embed.addFields({ name: 'Message', value: message.content.slice(0, 1024) });
    }

    await sendLog(embed, 'automod', null, guildId);
}

module.exports = {
    RULE_TYPES,
    ACTIONS,
    getAutoModRules,
    updateAutoModRule,
    getAutoModFilters,
    addAutoModFilter,
    removeAutoModFilter,
    checkMessage,
};
