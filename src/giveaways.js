// ──────────────────── Giveaway System v2 ────────────────────
// Supports multiple concurrent giveaways per guild. Winners are picked from
// the 🎉 reactions on the giveaway message, filtered by optional required /
// banned role rules. Active giveaways persist in the DB, so a bot restart
// never loses them — the periodic check sweeps anything that came due while
// the bot was offline.

const { EmbedBuilder } = require('discord.js');
const { getDb } = require('./db');
const { getBotConfig } = require('./config');
const { logError } = require('./logError');

const GW_EMOJI = '🎉';

let client = null;
function setGiveawayClient(c) { client = c; }

// ── Helpers ──

function parseRoleIds(v) {
    if (Array.isArray(v)) return v.filter(Boolean);
    if (!v) return [];
    try {
        const p = JSON.parse(v);
        return Array.isArray(p) ? p.filter(Boolean) : [];
    } catch {
        return typeof v === 'string' && v ? [v] : [];
    }
}

function parseHexColor(hex) {
    if (!hex) return null;
    const c = parseInt(String(hex).replace('#', ''), 16);
    return (isNaN(c) || c < 0 || c > 0xFFFFFF) ? null : c;
}

// Default embed color: the bot's configured embed color, else blurple.
function defaultColor() {
    try {
        const cfg = getBotConfig();
        return parseHexColor(cfg.embedColor) || 0x5865F2;
    } catch { return 0x5865F2; }
}

// ── DB lifecycle ──

function createGiveaway({ guildId, channelId, prize, durationMs, winners = 1, hostId, hostTag, description, requiredRoleIds, bannedRoleIds, color, imageUrl }) {
    const db = getDb();
    const id = 'gw_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const endsAt = Date.now() + Math.max(durationMs || 0, 10000);
    db.prepare(`INSERT INTO giveaways (id, guild_id, channel_id, message_id, prize, winners, host_id, host_tag, ends_at, status, winner_ids, created_at, description, required_role_ids, banned_role_ids, color, image_url)
                VALUES (?, ?, ?, '', ?, ?, ?, ?, ?, 'active', NULL, ?, ?, ?, ?, ?, ?)`)
        .run(
            id, guildId, channelId, prize, winners, hostId, hostTag || null, endsAt, Date.now(),
            description || null,
            Array.isArray(requiredRoleIds) && requiredRoleIds.length ? JSON.stringify(requiredRoleIds) : null,
            Array.isArray(bannedRoleIds) && bannedRoleIds.length ? JSON.stringify(bannedRoleIds) : null,
            parseHexColor(color) || null,
            imageUrl || null,
        );
    return getGiveaway(id);
}

function getGiveaway(id) {
    if (!id) return null;
    return getDb().prepare('SELECT * FROM giveaways WHERE id = ?').get(id);
}

// Resolve a giveaway from a message ID or Discord message link.
function getGiveawayByMessageRef(ref) {
    if (!ref) return null;
    const s = String(ref).trim();
    // Message link: https://discord.com/channels/<guild>/<channel>/<message>
    const linkMatch = s.match(/channels\/\d+\/\d+\/(\d+)/);
    const msgId = linkMatch ? linkMatch[1] : (s.startsWith('gw_') ? null : s);
    if (s.startsWith('gw_')) return getGiveaway(s);
    if (msgId && /^\d+$/.test(msgId)) {
        const row = getDb().prepare('SELECT * FROM giveaways WHERE message_id = ? ORDER BY created_at DESC LIMIT 1').get(msgId);
        return row || null;
    }
    return getGiveaway(s);
}

function listGiveaways(guildId, limit = 20) {
    return getDb().prepare('SELECT * FROM giveaways WHERE guild_id = ? ORDER BY created_at DESC LIMIT ?').all(guildId, Math.min(limit || 20, 100));
}

function getActiveGiveaways() {
    return getDb().prepare("SELECT * FROM giveaways WHERE status = 'active'").all();
}

function cancelGiveaway(id) {
    const g = getGiveaway(id);
    if (!g) return { error: 'Giveaway not found' };
    if (g.status !== 'active') return { error: 'Giveaway is already ' + g.status };
    getDb().prepare("UPDATE giveaways SET status = 'cancelled', ended_at = ? WHERE id = ?").run(Date.now(), id);
    return { success: true, giveaway: getGiveaway(id) };
}

// ── Winner picking + eligibility ──

// Pure + deterministic enough for tests: dedupe, Fisher-Yates shuffle, slice.
function selectWinners(entrantIds, count) {
    const unique = [...new Set(Array.isArray(entrantIds) ? entrantIds.filter(Boolean) : [])];
    for (let i = unique.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [unique[i], unique[j]] = [unique[j], unique[i]];
    }
    return unique.slice(0, Math.max(0, count));
}

// memberMap: { userId: { roles: [roleId, ...] } }. Pure, testable.
function isEligible(userId, memberMap, required, banned) {
    const member = (memberMap || {})[userId];
    const roles = new Set(member && member.roles ? member.roles : []);
    if (banned && banned.length) {
        for (const r of banned) if (roles.has(r)) return false;
    }
    if (required && required.length) {
        for (const r of required) if (!roles.has(r)) return false;
    }
    return true;
}

function filterEligibleEntrants(entrantIds, memberMap, required, banned) {
    const req = parseRoleIds(required);
    const ban = parseRoleIds(banned);
    if (!req.length && !ban.length) return entrantIds;
    return entrantIds.filter(id => memberMap && memberMap[id] && isEligible(id, memberMap, req, ban));
}

// Fetches 🎉 reactors from a discord.js message and picks `count` winners,
// honoring role requirements via the guild's member cache.
async function pickWinners(message, count, guild, required, banned) {
    const req = parseRoleIds(required);
    const ban = parseRoleIds(banned);
    const entrants = [];
    for (const reaction of message.reactions.cache.values()) {
        if (reaction.emoji.name !== GW_EMOJI) continue;
        try {
            const users = await reaction.users.fetch();
            for (const u of users.values()) {
                if (u.bot) continue;
                entrants.push(u.id);
            }
        } catch { /* skip unreadable reaction */ }
    }
    const unique = [...new Set(entrants)];
    if (!req.length && !ban.length) return selectWinners(unique, count);

    // Role-gated giveaways: only entrants whose roles we can verify are eligible.
    const memberMap = {};
    if (guild) {
        const missing = [];
        for (const id of unique) {
            const m = guild.members.cache.get(id);
            if (m && m.roles) memberMap[id] = { roles: m.roles.cache.map(r => r.id) };
            else missing.push(id);
        }
        // Fetch uncached entrants so role-gated giveaways work right after boot
        // or on large servers where the member cache is partial. Bulk first; if
        // any entrant left the guild the whole bulk call rejects, so fall back to
        // per-ID fetches — one left member must not exclude still-valid entrants.
        if (missing.length) {
            try { await guild.members.fetch({ user: missing }); } catch {
                for (const id of missing) {
                    try { await guild.members.fetch(id); } catch { /* left the guild */ }
                }
            }
            for (const id of missing) {
                const m = guild.members.cache.get(id);
                if (m && m.roles) memberMap[id] = { roles: m.roles.cache.map(r => r.id) };
            }
        }
    }
    const eligible = unique.filter(id => memberMap[id] && isEligible(id, memberMap, req, ban));
    return selectWinners(eligible, count);
}

// ── Embed builders ──

function buildActiveEmbed(g) {
    const req = parseRoleIds(g.required_role_ids);
    const ban = parseRoleIds(g.banned_role_ids);
    const lines = [];
    if (g.description) lines.push(g.description, '');
    lines.push('React with 🎉 to enter!');
    if (req.length) lines.push('\n✅ Requires: ' + req.map(r => '<@&' + r + '>').join(' '));
    if (ban.length) lines.push('🚫 Banned: ' + ban.map(r => '<@&' + r + '>').join(' '));
    lines.push('\n⏳ Ends <t:' + Math.floor(g.ends_at / 1000) + ':R>');

    const embed = new EmbedBuilder()
        .setColor(parseHexColor(g.color) || defaultColor())
        .setTitle('🎉 Giveaway: ' + g.prize)
        .setDescription(lines.join('\n'))
        .addFields(
            { name: 'Host', value: g.host_tag ? '`' + g.host_tag + '`' : '<@' + g.host_id + '>', inline: true },
            { name: 'Winners', value: String(g.winners), inline: true },
            { name: 'Status', value: '🟢 Active', inline: true },
        );
    if (g.image_url) embed.setImage(g.image_url);
    embed.setFooter({ text: 'Giveaway ID: ' + g.id });
    embed.setTimestamp(new Date(g.ends_at));
    return embed;
}

function buildEndedEmbed(g, winnerIds) {
    const embed = new EmbedBuilder()
        .setColor(parseHexColor(g.color) || defaultColor())
        .setTitle('🎉 Giveaway Ended: ' + g.prize)
        .addFields(
            { name: 'Host', value: g.host_tag ? '`' + g.host_tag + '`' : '<@' + g.host_id + '>', inline: true },
            { name: 'Winners', value: winnerIds.length ? winnerIds.map(w => '<@' + w + '>').join(', ') : 'No one entered 😢', inline: false },
        );
    if (g.image_url) embed.setImage(g.image_url);
    if (g.ended_at) embed.setTimestamp(new Date(g.ended_at));
    return embed;
}

function winnersAnnouncement(winnerIds, prize) {
    if (!winnerIds.length) return '😢 No one entered the giveaway — no winner could be picked.';
    return '🎉 Congratulations ' + winnerIds.map(w => '<@' + w + '>').join(', ') + '! You won **' + (prize || 'the giveaway') + '**!';
}

// ── Discord actions ──

async function postGiveaway(channel, g) {
    const msg = await channel.send({ embeds: [buildActiveEmbed(g)] });
    await msg.react(GW_EMOJI).catch(() => {});
    getDb().prepare('UPDATE giveaways SET message_id = ? WHERE id = ?').run(msg.id, g.id);
    return getGiveaway(g.id);
}

// Ends a giveaway: picks winners from reactions (role-filtered), persists the
// result, edits the embed and announces winners.
async function endGiveaway(id, opts = {}) {
    const g = getGiveaway(id);
    if (!g) return { error: 'Giveaway not found' };
    if (g.status !== 'active') return { error: 'Giveaway is already ' + g.status };

    let winnerIds = [];
    let message = null;
    let guild = null;
    if (client) {
        const channel = client.channels.cache.get(g.channel_id);
        if (channel && channel.isTextBased && channel.messages) {
            try { message = await channel.messages.fetch(g.message_id); } catch { /* deleted */ }
        }
        guild = channel && channel.guild ? channel.guild : null;
        if (message) {
            try {
                winnerIds = await pickWinners(message, g.winners, guild, g.required_role_ids, g.banned_role_ids);
            } catch (err) { logError(err, 'giveaways', 'pickWinners'); }
        }
    }

    // Atomically reserve the end — guards against the 15s timer racing a manual /end.
    // better-sqlite3 runs this single statement synchronously, so only one caller wins.
    const result = getDb().prepare("UPDATE giveaways SET status = 'ended', winner_ids = ?, ended_at = ? WHERE id = ? AND status = 'active'")
        .run(winnerIds.join(','), Date.now(), id);
    if (result.changes === 0) {
        return { error: 'Giveaway is already ended' };
    }

    const ended = getGiveaway(id);
    if (message && opts.announce !== false) {
        try {
            await message.edit({ embeds: [buildEndedEmbed(ended, winnerIds)] }).catch(() => {});
            await message.channel.send({ content: winnersAnnouncement(winnerIds, ended.prize) }).catch(() => {});
        } catch (err) { logError(err, 'giveaways', 'announce'); }
    }

    return { success: true, winners: winnerIds, giveaway: ended };
}

// Picks NEW winners for an ended giveaway (previous winners excluded).
async function rerollGiveaway(id) {
    const g = getGiveaway(id);
    if (!g) return { error: 'Giveaway not found' };
    if (g.status !== 'ended') return { error: 'Only ended giveaways can be rerolled' };

    const previous = (g.winner_ids || '').split(',').filter(Boolean);
    let newWinners = [];
    let message = null;
    let guild = null;
    if (client) {
        const channel = client.channels.cache.get(g.channel_id);
        if (channel && channel.isTextBased && channel.messages) {
            try { message = await channel.messages.fetch(g.message_id); } catch {}
        }
        guild = channel && channel.guild ? channel.guild : null;
        if (message) {
            try {
                const picked = await pickWinners(message, g.winners + previous.length, guild, g.required_role_ids, g.banned_role_ids);
                newWinners = picked.filter(w => !previous.includes(w)).slice(0, g.winners);
            } catch (err) { logError(err, 'giveaways', 'reroll'); }
        }
    }

    getDb().prepare('UPDATE giveaways SET winner_ids = ?, ended_at = ? WHERE id = ?')
        .run(newWinners.join(','), Date.now(), id);

    const updated = getGiveaway(id);
    if (message) {
        try {
            await message.edit({ embeds: [buildEndedEmbed(updated, newWinners)] }).catch(() => {});
            await message.channel.send({ content: '🔁 Reroll — ' + winnersAnnouncement(newWinners, updated.prize) }).catch(() => {});
        } catch (err) { logError(err, 'giveaways', 'reroll_announce'); }
    }

    return { success: true, winners: newWinners, giveaway: updated };
}

// ── Timer (restart-safe: anything due while offline is swept on boot) ──

async function checkGiveaways() {
    const due = getActiveGiveaways().filter(g => g.ends_at <= Date.now());
    for (const g of due) {
        try {
            await endGiveaway(g.id);
            console.log('[Giveaway] Ended ' + g.id + ' (' + g.prize + ')');
        } catch (err) {
            logError(err, 'giveaways', 'checkGiveaways:' + g.id);
        }
    }
    return due.length;
}

let checkInterval = null;
function startGiveawayCheck() {
    if (checkInterval) return;
    checkInterval = setInterval(() => { checkGiveaways().catch(() => {}); }, 15 * 1000);
    // Sweep giveaways that ended while the bot was offline.
    setTimeout(() => { checkGiveaways().catch(() => {}); }, 5000);
}

function stopGiveawayCheck() {
    if (checkInterval) { clearInterval(checkInterval); checkInterval = null; }
}

module.exports = {
    setGiveawayClient,
    createGiveaway,
    getGiveaway,
    getGiveawayByMessageRef,
    listGiveaways,
    getActiveGiveaways,
    cancelGiveaway,
    selectWinners,
    isEligible,
    filterEligibleEntrants,
    pickWinners,
    parseHexColor,
    postGiveaway,
    endGiveaway,
    rerollGiveaway,
    checkGiveaways,
    startGiveawayCheck,
    stopGiveawayCheck,
};
