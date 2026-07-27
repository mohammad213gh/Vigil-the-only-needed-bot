// ──────────────────── Invite Tracking Module ────────────────────
// Caches all guild invites on startup and detects which invite code
// was used when a new member joins by comparing invite counts.

const { getDb } = require('./db');
const { logError } = require('./logError');

// ──── In-memory cache: guildId → { code → { uses, inviterId, ... } } ────
const inviteCache = new Map();
let client = null;

function setInviteClient(c) {
    client = c;
}

// ──────────────────── Cache Management ────────────────────

async function cacheGuildInvites(guild) {
    if (!guild || !guild.invitesFetch) return;
    try {
        const invites = await guild.invites.fetch();
        const cache = new Map();
        for (const [code, invite] of invites) {
            cache.set(code, {
                uses: invite.uses || 0,
                inviterId: invite.inviter?.id || null,
                maxUses: invite.maxUses,
                temporary: invite.temporary,
                createdAt: invite.createdTimestamp,
                expiresAt: invite.expiresTimestamp,
            });
        }
        inviteCache.set(guild.id, cache);
    } catch (err) {
        // Missing MANAGE_GUILD permission — can't fetch invites, skip
        if (err.code !== 50013) {
            logError(err, 'invites', 'cacheGuildInvites(' + guild.id + ')');
        }
    }
}

async function cacheAllInvites() {
    if (!client) return;
    for (const [, guild] of client.guilds.cache) {
        await cacheGuildInvites(guild);
    }
    console.log('[Invites] Cached invites for ' + client.guilds.cache.size + ' guild(s)');
}

// ──────────────────── Join Detection ────────────────────

async function detectUsedInvite(member) {
    if (!member.guild || !member.guild.invitesFetch) return null;
    const guildId = member.guild.id;
    const oldCache = inviteCache.get(guildId);
    if (!oldCache) return null;

    try {
        const currentInvites = await member.guild.invites.fetch();
        const newCache = new Map();

        for (const [code, invite] of currentInvites) {
            newCache.set(code, {
                uses: invite.uses || 0,
                inviterId: invite.inviter?.id || null,
                maxUses: invite.maxUses,
                temporary: invite.temporary,
                createdAt: invite.createdTimestamp,
                expiresAt: invite.expiresTimestamp,
            });

            // Compare with old cache
            const old = oldCache.get(code);
            if (old && invite.uses > old.uses) {
                // This invite was used
                inviteCache.set(guildId, newCache);

                // Record in DB
                recordInviteUse(guildId, code, old.inviterId, member.id);
                return {
                    code,
                    inviterId: old.inviterId,
                    uses: invite.uses,
                };
            }
        }

        // No match found — invite may have been deleted after use (vanity/never-cached)
        inviteCache.set(guildId, newCache);
        return null;
    } catch (err) {
        // Try to update cache anyway
        try {
            const invites = await member.guild.invites.fetch();
            const nc = new Map();
            for (const [c, inv] of invites) {
                nc.set(c, { uses: inv.uses || 0, inviterId: inv.inviter?.id || null });
            }
            inviteCache.set(guildId, nc);
        } catch {}
        return null;
    }
}

// ──────────────────── DB Operations ────────────────────

function recordInviteUse(guildId, code, inviterId, joinerId) {
    const db = getDb();
    db.prepare('INSERT INTO invite_uses (guild_id, code, inviter_id, joiner_id, joined_at) VALUES (?, ?, ?, ?, ?)')
        .run(guildId, code, inviterId || 'unknown', joinerId, Date.now());

    // Update invite_tracking table
    db.prepare(`
        INSERT INTO invite_tracking (guild_id, code, inviter_id, uses, created_at)
        VALUES (?, ?, ?, 1, ?)
        ON CONFLICT(guild_id, code) DO UPDATE SET uses = uses + 1
    `).run(guildId, code, inviterId || 'unknown', Date.now());
}

function getInviterStats(guildId, userId) {
    const db = getDb();
    const totalInvites = db.prepare('SELECT COUNT(*) as count FROM invite_uses WHERE guild_id = ? AND inviter_id = ?').get(guildId, userId);
    const joiners = db.prepare('SELECT joiner_id, joined_at FROM invite_uses WHERE guild_id = ? AND inviter_id = ? ORDER BY joined_at DESC LIMIT 25').all(guildId, userId);
    return {
        total: totalInvites ? totalInvites.count : 0,
        joiners: joiners || [],
    };
}

function getGuildInviteStats(guildId) {
    const db = getDb();
    const rows = db.prepare(`
        SELECT inviter_id, COUNT(*) as count
        FROM invite_uses
        WHERE guild_id = ?
        GROUP BY inviter_id
        ORDER BY count DESC
    `).all(guildId);
    return rows || [];
}

function getTopInviters(guildId, limit) {
    const db = getDb();
    limit = limit || 10;
    return db.prepare(`
        SELECT inviter_id, COUNT(*) as count
        FROM invite_uses
        WHERE guild_id = ?
        GROUP BY inviter_id
        ORDER BY count DESC
        LIMIT ?
    `).all(guildId, limit);
}

// ──────────────────── Event Handlers ────────────────────

async function handleInviteCreate(invite) {
    if (!invite.guild) return;
    const guildId = invite.guild.id;
    const cache = inviteCache.get(guildId) || new Map();
    cache.set(invite.code, {
        uses: invite.uses || 0,
        inviterId: invite.inviter?.id || null,
        maxUses: invite.maxUses,
        temporary: invite.temporary,
        createdAt: invite.createdTimestamp,
        expiresAt: invite.expiresTimestamp,
    });
    inviteCache.set(guildId, cache);
}

async function handleInviteDelete(invite) {
    if (!invite.guild) return;
    const guildId = invite.guild.id;
    const cache = inviteCache.get(guildId);
    if (cache) {
        cache.delete(invite.code);
    }
}

// ──────────────────── Exports ────────────────────

module.exports = {
    setInviteClient,
    cacheAllInvites,
    cacheGuildInvites,
    detectUsedInvite,
    getInviterStats,
    getGuildInviteStats,
    getTopInviters,
    handleInviteCreate,
    handleInviteDelete,
};
