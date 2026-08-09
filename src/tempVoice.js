// ──────────────────── Temporary Voice Channels ────────────────────
// A designated "join to create" voice channel: when a member joins it, the
// bot spawns a private voice channel named after them and moves them in.
// The spawned channel is deleted automatically once it's empty (with a
// short grace delay so people hopping out/in don't flicker it).
//
//   • /tempvc set <channel> [category]  — designate a trigger channel
//   • /tempvc name <template>           — {name} / {number} template
//   • /tempvc rename/limit/lock/unlock/claim — owner controls for their VC
//
// Implementation: the bot listens to voiceStateUpdate (wired in index.js)
// and uses member.voice.setChannel() — the same zero-dependency approach as
// the voice presence module. Spawned channels are tracked in the DB so
// empty orphans can be cleaned up on restart.

const { getDb } = require('./db');
const { logError } = require('./logError');

const DEFAULT_TEMPLATE = '{name}\'s channel';
const MAX_CHANNEL_NAME = 100;
const EMPTY_DELETE_DELAY_MS = 5000;

// channelId -> pending deletion timer
const deleteTimers = new Map();

// ──────────────────── Pure helpers ────────────────────

function isVoiceChannel(channel) {
    // ChannelType.GuildVoice === 2
    return !!(channel && channel.id && channel.type === 2);
}

// {name} → username, {number} → spawn counter (1-based). Unknown
// placeholders are left untouched. Output capped at Discord's 100-char limit.
function formatTemplate(template, username, number) {
    const t = (template && typeof template === 'string') ? template : DEFAULT_TEMPLATE;
    return t
        .replace(/\{name\}/g, (username && typeof username === 'string') ? username : 'member')
        .replace(/\{number\}/g, String(Number(number) || 1))
        .slice(0, MAX_CHANNEL_NAME);
}

// ──────────────────── DB access ────────────────────

function getConfig(guildId) {
    if (!guildId) return { name_template: DEFAULT_TEMPLATE };
    try {
        const row = getDb().prepare('SELECT name_template FROM temp_vc_config WHERE guild_id = ?').get(guildId);
        return { name_template: (row && row.name_template) || DEFAULT_TEMPLATE };
    } catch (err) {
        logError(err, 'tempvoice', 'getConfig');
        return { name_template: DEFAULT_TEMPLATE };
    }
}

function setConfig(guildId, nameTemplate) {
    if (!guildId) return { error: 'Missing guild' };
    try {
        const t = (nameTemplate && String(nameTemplate).trim()) || DEFAULT_TEMPLATE;
        getDb().prepare('INSERT OR REPLACE INTO temp_vc_config (guild_id, name_template) VALUES (?, ?)')
            .run(guildId, t.slice(0, MAX_CHANNEL_NAME));
        return { success: true, name_template: t };
    } catch (err) {
        logError(err, 'tempvoice', 'setConfig');
        return { error: err.message || 'Failed to save config' };
    }
}

function getTriggers(guildId) {
    if (!guildId) return [];
    try {
        return getDb().prepare('SELECT guild_id, channel_id, category_id FROM temp_vc_triggers WHERE guild_id = ?').all(guildId);
    } catch (err) {
        logError(err, 'tempvoice', 'getTriggers');
        return [];
    }
}

function getTriggerForChannel(guildId, channelId) {
    if (!guildId || !channelId) return null;
    try {
        return getDb().prepare('SELECT guild_id, channel_id, category_id FROM temp_vc_triggers WHERE guild_id = ? AND channel_id = ?')
            .get(guildId, channelId) || null;
    } catch (err) {
        logError(err, 'tempvoice', 'getTriggerForChannel');
        return null;
    }
}

function setTrigger(guildId, channelId, categoryId) {
    try {
        getDb().prepare('INSERT OR REPLACE INTO temp_vc_triggers (guild_id, channel_id, category_id) VALUES (?, ?, ?)')
            .run(guildId, channelId, categoryId || null);
        return { success: true };
    } catch (err) {
        logError(err, 'tempvoice', 'setTrigger');
        return { error: err.message || 'Failed to save trigger' };
    }
}

function removeTrigger(guildId, channelId) {
    if (!channelId) return { success: true };
    try {
        getDb().prepare('DELETE FROM temp_vc_triggers WHERE guild_id = ? AND channel_id = ?').run(guildId, channelId);
        return { success: true };
    } catch (err) {
        logError(err, 'tempvoice', 'removeTrigger');
        return { error: err.message || 'Failed to remove trigger' };
    }
}

function getSpawned(guildId) {
    if (!guildId) return [];
    try {
        return getDb().prepare('SELECT channel_id, guild_id, owner_id, trigger_id, created_at FROM temp_vc_channels WHERE guild_id = ? ORDER BY created_at ASC').all(guildId);
    } catch (err) {
        logError(err, 'tempvoice', 'getSpawned');
        return [];
    }
}

function getSpawnedChannel(channelId) {
    if (!channelId) return null;
    try {
        return getDb().prepare('SELECT channel_id, guild_id, owner_id, trigger_id, created_at FROM temp_vc_channels WHERE channel_id = ?').get(channelId) || null;
    } catch (err) {
        logError(err, 'tempvoice', 'getSpawnedChannel');
        return null;
    }
}

function getSpawnedByOwner(guildId, ownerId) {
    if (!guildId || !ownerId) return null;
    try {
        return getDb().prepare('SELECT channel_id, guild_id, owner_id, trigger_id, created_at FROM temp_vc_channels WHERE guild_id = ? AND owner_id = ? ORDER BY created_at DESC').get(guildId, ownerId) || null;
    } catch (err) {
        logError(err, 'tempvoice', 'getSpawnedByOwner');
        return null;
    }
}

function addSpawned(channelId, guildId, ownerId, triggerId) {
    try {
        getDb().prepare('INSERT OR REPLACE INTO temp_vc_channels (channel_id, guild_id, owner_id, trigger_id, created_at) VALUES (?, ?, ?, ?, ?)')
            .run(channelId, guildId, ownerId, triggerId, Date.now());
        return { success: true };
    } catch (err) {
        logError(err, 'tempvoice', 'addSpawned');
        return { error: err.message || 'Failed to save spawned channel' };
    }
}

function removeSpawned(channelId) {
    if (!channelId) return;
    try {
        getDb().prepare('DELETE FROM temp_vc_channels WHERE channel_id = ?').run(channelId);
    } catch (err) {
        logError(err, 'tempvoice', 'removeSpawned');
    }
}

function getAllSpawned() {
    try {
        return getDb().prepare('SELECT channel_id, guild_id, owner_id, trigger_id, created_at FROM temp_vc_channels').all();
    } catch (err) {
        logError(err, 'tempvoice', 'getAllSpawned');
        return [];
    }
}

// ──────────────────── Spawn lifecycle ────────────────────

async function spawnChannel(guild, member, trigger) {
    if (!guild || !member || !trigger) return;

    // The member already has a live spawned channel → move them back to it
    // instead of creating a duplicate (e.g. they joined the trigger again).
    const existing = getSpawnedByOwner(guild.id, member.id);
    if (existing) {
        const ch = guild.channels && guild.channels.cache ? guild.channels.cache.get(existing.channel_id) : null;
        if (ch) {
            cancelDeletion(existing.channel_id);
            try { await member.voice.setChannel(ch); } catch { /* fine */ }
            return;
        }
        removeSpawned(existing.channel_id); // stale row — clean it up
    }

    const count = getSpawned(guild.id).length;
    const name = formatTemplate(getConfig(guild.id).name_template, member.user && member.user.username, count + 1);
    const parent = trigger.category_id && guild.channels && guild.channels.cache ? guild.channels.cache.get(trigger.category_id) : null;

    const options = { name, type: 2, reason: 'Temp voice channel for ' + (member.user ? member.user.tag : member.id) };
    if (parent) options.parent = parent.id;
    let channel;
    try {
        channel = await guild.channels.create(options);
    } catch (err) {
        // Bot can't create channels (permissions) — keep the member in the
        // trigger and let them know, so they don't sit there wondering.
        logError(err, 'tempvoice', 'create_' + guild.id);
        if (member.send) member.send('❌ I couldn\'t create a temp voice channel for you — the bot is missing **Manage Channels** permission (or the category is full).').catch(() => {});
        return;
    }

    addSpawned(channel.id, guild.id, member.id, trigger.channel_id);
    try {
        await member.voice.setChannel(channel);
    } catch (err) {
        // Couldn't move them in — undo the spawn so we don't leak empty channels.
        logError(err, 'tempvoice', 'move_' + guild.id);
        cancelDeletion(channel.id);
        removeSpawned(channel.id);
        channel.delete('Member could not be moved into temp channel').catch(() => {});
    }
}

function cancelDeletion(channelId) {
    const t = deleteTimers.get(channelId);
    if (t) {
        clearTimeout(t);
        deleteTimers.delete(channelId);
    }
}

// If the channel is empty, schedule its deletion after a short grace period
// (cancelled if someone joins before the timer fires).
function scheduleDeletionIfEmpty(guild, channelId) {
    const channel = guild.channels && guild.channels.cache ? guild.channels.cache.get(channelId) : null;
    if (!channel) {
        removeSpawned(channelId);
        return;
    }
    if (channel.members && channel.members.size > 0) {
        cancelDeletion(channelId);
        return;
    }
    if (deleteTimers.has(channelId)) return; // already pending

    const timer = setTimeout(async () => {
        deleteTimers.delete(channelId);
        try {
            const ch = guild.channels && guild.channels.cache ? guild.channels.cache.get(channelId) : null;
            if (!ch) { removeSpawned(channelId); return; }
            if (ch.members && ch.members.size > 0) return; // someone joined again
            await ch.delete('Temp voice channel empty');
            removeSpawned(channelId);
        } catch (err) {
            logError(err, 'tempvoice', 'delete_' + channelId);
        }
    }, EMPTY_DELETE_DELAY_MS);
    if (timer.unref) timer.unref();
    deleteTimers.set(channelId, timer);
}

// ──────────────────── voiceStateUpdate entry point ────────────────────

// Wire this to the client's VoiceStateUpdate event (index.js). Never throws.
function handleVoiceStateUpdate(oldState, newState) {
    try {
        const guild = (newState && newState.guild) || (oldState && oldState.guild);
        if (!guild || !guild.id) return;
        const member = (newState && newState.member) || (oldState && oldState.member);
        if (!member || member.user && member.user.bot) return;

        const joinedId = newState ? newState.channelId : null;
        const leftId = oldState ? oldState.channelId : null;

        // 1. Joined a spawned channel → cancel any pending deletion.
        if (joinedId && getSpawnedChannel(joinedId)) {
            cancelDeletion(joinedId);
        }

        // 2. Joined a trigger channel → spawn a new channel for them.
        if (joinedId) {
            const trigger = getTriggerForChannel(guild.id, joinedId);
            if (trigger) {
                spawnChannel(guild, member, trigger).catch(err => logError(err, 'tempvoice', 'spawn_' + guild.id));
            }
        }

        // 3. Left a spawned channel → maybe delete it (when empty).
        if (leftId && getSpawnedChannel(leftId)) {
            scheduleDeletionIfEmpty(guild, leftId);
        }
    } catch (err) {
        logError(err, 'tempvoice', 'handleVoiceStateUpdate');
    }
}

// ──────────────────── Boot cleanup ────────────────────

// After restart: drop rows for channels that no longer exist and delete
// spawned channels that are empty (channels still in use are kept).
async function cleanupOrphans(client) {
    if (!client || !client.guilds || !client.guilds.cache) return;
    const rows = getAllSpawned();
    const now = Date.now();
    for (const row of rows) {
        const guild = client.guilds.cache.get(row.guild_id);
        if (!guild) { removeSpawned(row.channel_id); continue; }
        const channel = guild.channels && guild.channels.cache ? guild.channels.cache.get(row.channel_id) : null;
        if (!channel) { removeSpawned(row.channel_id); continue; }
        // Channels spawned within the last minute are left alone — voice states
        // may not be fully synced yet, and an occupied channel must not be
        // deleted just because the client hasn't cached its members yet.
        if (row.created_at > now - 60000) continue;
        if (channel.members && channel.members.size === 0) {
            try {
                await channel.delete('Temp voice channel empty (restart cleanup)');
            } catch { /* already gone / no perms — row cleanup below handles it */ }
            removeSpawned(row.channel_id);
        }
    }
}

function stopTempVoice() {
    for (const [, t] of deleteTimers) clearTimeout(t);
    deleteTimers.clear();
}

module.exports = {
    DEFAULT_TEMPLATE,
    MAX_CHANNEL_NAME,
    isVoiceChannel,
    formatTemplate,
    getConfig,
    setConfig,
    getTriggers,
    getTriggerForChannel,
    setTrigger,
    removeTrigger,
    getSpawned,
    getSpawnedChannel,
    getSpawnedByOwner,
    addSpawned,
    removeSpawned,
    spawnChannel,
    cancelDeletion,
    scheduleDeletionIfEmpty,
    handleVoiceStateUpdate,
    cleanupOrphans,
    stopTempVoice,
};
