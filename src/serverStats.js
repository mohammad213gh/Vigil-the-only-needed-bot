// ──────────────────── Live Server Stats Channels ────────────────────
// Voice/text channels whose names show a live value (members, humans, bots,
// online, boosts, channels, roles, emojis, boost tier). Values refresh:
//   • instantly on member join / leave / boost changes (hooks in index.js)
//   • on a 10-minute timer (catches anything that drifted, incl. offline time)
// Channels are only renamed when the value actually changed, so Discord's
// rate limits are never an issue. If a configured channel is deleted, its
// config row is dropped automatically on the next refresh.

const { getDb } = require('./db');
const { logError } = require('./logError');

// ──────────────────── Stat Types ────────────────────
// compute(guild, members) receives the guild plus its member cache, so the
// helpers are pure-ish and unit-testable with mocks.
const STAT_TYPES = {
    members:    { emoji: '👥', label: 'Members',    needsMembers: false, compute: (g) => g.memberCount || 0 },
    humans:     { emoji: '🧑', label: 'Humans',     needsMembers: true,  compute: (g, m) => (m ? Array.from(m.cache.values()).filter(x => x && !x.user.bot).length : 0) },
    bots:       { emoji: '🤖', label: 'Bots',       needsMembers: true,  compute: (g, m) => (m ? Array.from(m.cache.values()).filter(x => x && x.user.bot).length : 0) },
    online:     { emoji: '🟢', label: 'Online',     needsMembers: true,  compute: (g, m) => (m ? Array.from(m.cache.values()).filter(x => x && x.presence && x.presence.status && x.presence.status !== 'offline').length : 0) },
    boosting:   { emoji: '🚀', label: 'Boosts',     needsMembers: false, compute: (g) => g.premiumSubscriptionCount || 0 },
    boost_tier: { emoji: '💎', label: 'Boost Tier', needsMembers: false, compute: (g) => g.premiumTier || 0 },
    channels:   { emoji: '📁', label: 'Channels',   needsMembers: false, compute: (g) => (g.channels && g.channels.cache ? g.channels.cache.size : 0) },
    roles:      { emoji: '🎭', label: 'Roles',      needsMembers: false, compute: (g) => (g.roles && g.roles.cache ? g.roles.cache.size : 0) },
    emojis:     { emoji: '😀', label: 'Emojis',     needsMembers: false, compute: (g) => (g.emojis && g.emojis.cache ? g.emojis.cache.size : 0) },
};

// Channel names cannot contain @ # : — use a bullet separator.
const NAME_SEPARATOR = ' • ';
const MAX_CHANNEL_NAME = 100;

function computeStat(guild, members, statType) {
    const type = STAT_TYPES[statType];
    if (!type || !guild) return 0;
    try { return type.compute(guild, members); } catch (err) {
        logError(err, 'serverstats', 'compute_' + statType);
        return 0;
    }
}

function formatStatName(statType, value, labelOverride) {
    const type = STAT_TYPES[statType];
    if (!type) return '';
    const label = (labelOverride && String(labelOverride).trim()) || type.label;
    let text;
    if (statType === 'boost_tier') {
        text = 'Tier ' + value;
    } else {
        try { text = Number(value || 0).toLocaleString('en-US'); } catch { text = String(value || 0); }
    }
    return (type.emoji + ' ' + label + NAME_SEPARATOR + text).slice(0, MAX_CHANNEL_NAME);
}

// ──────────────────── DB Access ────────────────────

function getServerStats(guildId) {
    try {
        return getDb().prepare('SELECT guild_id, channel_id, stat_type, label FROM server_stats WHERE guild_id = ?').all(guildId);
    } catch (err) {
        logError(err, 'serverstats', 'getServerStats');
        return [];
    }
}

function setServerStat(guildId, channelId, statType, label) {
    if (!STAT_TYPES[statType]) return { error: 'Unknown stat type: ' + statType + '. Valid: ' + Object.keys(STAT_TYPES).join(', ') };
    try {
        getDb().prepare(
            'INSERT OR REPLACE INTO server_stats (guild_id, channel_id, stat_type, label) VALUES (?, ?, ?, ?)'
        ).run(guildId, channelId, statType, (label && String(label).trim()) || null);
        return { success: true };
    } catch (err) {
        logError(err, 'serverstats', 'setServerStat');
        return { error: err.message || 'Failed to save stat config' };
    }
}

function removeServerStat(guildId, channelId) {
    try {
        getDb().prepare('DELETE FROM server_stats WHERE guild_id = ? AND channel_id = ?').run(guildId, channelId);
        return { success: true };
    } catch (err) {
        logError(err, 'serverstats', 'removeServerStat');
        return { error: err.message || 'Failed to remove stat config' };
    }
}

// ──────────────────── Refreshing ────────────────────

// Update every configured stat channel for one guild. Never throws — every
// failure is logged so one bad channel can't take down the whole refresh.
async function refreshGuildStats(guild) {
    if (!guild || !guild.id) return;
    const rows = getServerStats(guild.id);
    if (!rows.length) return;

    // If any stat needs member presence data and the cache is incomplete,
    // bulk-fetch once. Wrapped so rate limits / partial caches can't break us.
    const needMembers = rows.some(r => STAT_TYPES[r.stat_type] && STAT_TYPES[r.stat_type].needsMembers);
    if (needMembers && guild.members && guild.memberCount && guild.members.cache.size < guild.memberCount) {
        try { await guild.members.fetch(); } catch { /* cache may stay partial — fine */ }
    }

    for (const row of rows) {
        const type = STAT_TYPES[row.stat_type];
        if (!type) continue;
        const channel = guild.channels && guild.channels.cache ? guild.channels.cache.get(row.channel_id) : null;
        if (!channel) {
            // Channel was deleted — stop tracking it.
            removeServerStat(guild.id, row.channel_id);
            continue;
        }
        if (!channel.manageable || typeof channel.setName !== 'function') continue;
        const value = computeStat(guild, guild.members, row.stat_type);
        const name = formatStatName(row.stat_type, value, row.label);
        if (channel.name === name) continue; // only rename when changed
        try {
            await channel.setName(name, 'Server stats auto-update');
        } catch (err) {
            logError(err, 'serverstats', 'rename_' + row.channel_id);
        }
    }
}

// Refresh every guild the bot is in, one at a time (gentler on rate limits).
async function updateAllServerStats(client) {
    if (!client || !client.guilds || !client.guilds.cache) return;
    for (const guild of client.guilds.cache.values()) {
        try {
            await refreshGuildStats(guild);
        } catch (err) {
            logError(err, 'serverstats', 'guild_' + guild.id);
        }
    }
}

// ──────────────────── Timer ────────────────────

let statTimer = null;

function startServerStats(client) {
    if (statTimer) return;
    // First sweep shortly after boot (guilds are usually ready by then).
    setTimeout(() => updateAllServerStats(client).catch(() => {}), 10 * 1000);
    // Keep counters fresh — the join/leave hooks handle most cases instantly.
    statTimer = setInterval(() => updateAllServerStats(client).catch(() => {}), 10 * 60 * 1000);
    statTimer.unref();
}

function stopServerStats() {
    if (statTimer) {
        clearInterval(statTimer);
        statTimer = null;
    }
}

module.exports = {
    STAT_TYPES,
    computeStat,
    formatStatName,
    getServerStats,
    setServerStat,
    removeServerStat,
    refreshGuildStats,
    updateAllServerStats,
    startServerStats,
    stopServerStats,
};
