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

const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
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

// Append " 2", " 3", … when another voice channel (in the same category, or
// the guild) already has the base name, so "Aya's channel" stays unique.
function uniqueChannelName(guild, baseName, categoryId) {
    const taken = new Set();
    if (guild && guild.channels && guild.channels.cache) {
        for (const c of guild.channels.cache.values()) {
            if (c.type !== 2) continue;
            if (categoryId && c.parentId !== categoryId) continue;
            taken.add(c.name);
        }
    }
    if (!taken.has(baseName)) return baseName;
    let n = 2;
    while (n < 100) {
        const candidate = (baseName + ' ' + n).slice(0, MAX_CHANNEL_NAME);
        if (!taken.has(candidate)) return candidate;
        n++;
    }
    return baseName.slice(0, MAX_CHANNEL_NAME);
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

// ─── Control-panel message tracking (so panels can be edited live) ───

function registerPanel(guildId, channelId, messageId) {
    if (!guildId || !channelId || !messageId) return;
    try {
        getDb().prepare('INSERT OR REPLACE INTO temp_vc_panels (guild_id, channel_id, message_id) VALUES (?, ?, ?)')
            .run(guildId, channelId, messageId);
    } catch (err) {
        logError(err, 'tempvoice', 'registerPanel');
    }
}

function getPanels(guildId) {
    if (!guildId) return [];
    try {
        return getDb().prepare('SELECT guild_id, channel_id, message_id FROM temp_vc_panels WHERE guild_id = ?').all(guildId);
    } catch (err) {
        logError(err, 'tempvoice', 'getPanels');
        return [];
    }
}

function unregisterPanel(messageId) {
    if (!messageId) return;
    try {
        getDb().prepare('DELETE FROM temp_vc_panels WHERE message_id = ?').run(messageId);
    } catch (err) {
        logError(err, 'tempvoice', 'unregisterPanel');
    }
}

// ──────────────────── Spawn lifecycle ────────────────────

// Returns the channel on success, null on failure, or the reused channel.
// Re-render every registered control panel in a guild so the embed always
// reflects the current live channels (owner + lock status). Stale panel
// messages (deleted channel/message) are dropped. Never rejects.
// Concurrent calls for the same guild are coalesced: if a pass is already
// running, the next call marks a re-run that fires when it finishes, so a
// burst of voice events only costs one fetch+edit per panel per tick.
const panelUpdaters = new Map(); // guildId -> { again, promise }

async function renderPanels(guild) {
    const rows = getPanels(guild.id);
    if (!rows.length) return;
    let payload;
    try {
        payload = buildPanelMessage(guild);
    } catch (err) {
        logError(err, 'tempvoice', 'buildPanelMessage');
        return;
    }
    for (const row of rows) {
        try {
            const channel = guild.channels && guild.channels.cache ? guild.channels.cache.get(row.channel_id) : null;
            if (!channel || !channel.messages) {
                unregisterPanel(row.message_id);
                continue;
            }
            let msg;
            try {
                msg = await channel.messages.fetch(row.message_id);
            } catch {
                unregisterPanel(row.message_id); // message deleted
                continue;
            }
            if (!msg || !msg.editable) {
                unregisterPanel(row.message_id);
                continue;
            }
            await msg.edit(payload);
        } catch (err) {
            logError(err, 'tempvoice', 'updatePanel_' + row.channel_id);
        }
    }
}

function updatePanels(guild) {
    if (!guild || !guild.id) return Promise.resolve();
    const existing = panelUpdaters.get(guild.id);
    if (existing) {
        existing.again = true;
        return existing.promise;
    }
    const state = { again: false, promise: null };
    state.promise = (async () => {
        do {
            state.again = false;
            await renderPanels(guild);
        } while (state.again);
    })().finally(() => {
        if (panelUpdaters.get(guild.id) === state) panelUpdaters.delete(guild.id);
    });
    panelUpdaters.set(guild.id, state);
    return state.promise;
}

async function spawnChannel(guild, member, trigger) {
    if (!guild || !member || !trigger) return null;

    // The member already has a spawned channel:
    //   • still in use → move them back to it (no duplicate) and keep it alive
    //   • empty → it's doomed (deletion pending) — DON'T bounce them back into
    //     it; let it clean up and spawn a fresh one instead.
    const existing = getSpawnedByOwner(guild.id, member.id);
    if (existing) {
        const ch = guild.channels && guild.channels.cache ? guild.channels.cache.get(existing.channel_id) : null;
        if (ch) {
            if (ch.members && ch.members.size > 0) {
                cancelDeletion(existing.channel_id);
                try { await member.voice.setChannel(ch); } catch { /* fine */ }
                return ch;
            }
            scheduleDeletionIfEmpty(guild, existing.channel_id);
        }
        removeSpawned(existing.channel_id); // stale/doomed row — clean it up
    }

    const count = getSpawned(guild.id).length;
    let name = formatTemplate(getConfig(guild.id).name_template, member.user && member.user.username, count + 1);
    const parent = trigger.category_id && guild.channels && guild.channels.cache ? guild.channels.cache.get(trigger.category_id) : null;
    name = uniqueChannelName(guild, name, parent ? parent.id : null);

    const options = { name, type: 2, reason: 'Temp voice channel for ' + (member.user ? member.user.tag : member.id) };
    if (parent) options.parent = parent.id;
    // Inherit the trigger's bitrate + user limit so the spawned channel feels
    // like a real continuation of it (premium bitrate carries over).
    const triggerChannel = guild.channels && guild.channels.cache ? guild.channels.cache.get(trigger.channel_id) : null;
    if (triggerChannel) {
        if (typeof triggerChannel.bitrate === 'number') options.bitrate = triggerChannel.bitrate;
        if (typeof triggerChannel.userLimit === 'number') options.userLimit = triggerChannel.userLimit;
    }

    let channel;
    try {
        channel = await guild.channels.create(options);
    } catch (err) {
        // Bot can't create channels (permissions) — keep the member where they
        // are and let them know, so they don't sit there wondering.
        logError(err, 'tempvoice', 'create_' + guild.id);
        if (member.send) member.send('❌ I couldn\'t create a temp voice channel for you — the bot is missing **Manage Channels** permission (or the category is full).').catch(() => {});
        return null;
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
        updatePanels(guild).catch(() => {});
        return null;
    }
    updatePanels(guild).catch(() => {});
    return channel;
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
            updatePanels(guild).catch(() => {});
        } catch (err) {
            logError(err, 'tempvoice', 'delete_' + channelId);
        }
    }, EMPTY_DELETE_DELAY_MS);
    if (timer.unref) timer.unref();
    deleteTimers.set(channelId, timer);
}

// ──────────────────── Shared helpers (slash + panel buttons) ────────────────────

// The temp channel the member is currently in, falling back to one they own.
function getMemberChannelFor(guild, member) {
    if (!guild || !member) return null;
    const vcId = member.voice && member.voice.channelId;
    if (vcId) {
        const row = getSpawnedChannel(vcId);
        if (row) {
            const channel = guild.channels && guild.channels.cache ? guild.channels.cache.get(vcId) : null;
            if (channel) return { row, channel };
        }
    }
    const owned = getSpawnedByOwner(guild.id, member.id);
    if (owned) {
        const channel = guild.channels && guild.channels.cache ? guild.channels.cache.get(owned.channel_id) : null;
        if (channel) return { row: owned, channel };
    }
    return null;
}

async function setChannelLocked(channel, guild, member, locked) {
    const everyone = guild.roles.everyone;
    if (locked) {
        await channel.permissionOverwrites.edit(everyone, { Connect: false }, 'Temp VC locked');
        await channel.permissionOverwrites.edit(member, { Connect: true }, 'Temp VC owner');
    } else {
        const eow = channel.permissionOverwrites.cache.get(everyone.id);
        if (eow && eow.deny.has(PermissionFlagsBits.Connect)) {
            await channel.permissionOverwrites.delete(everyone, 'Temp VC unlocked');
        }
        const mow = channel.permissionOverwrites.cache.get(member.id);
        if (mow && mow.allow.has(PermissionFlagsBits.Connect)) {
            await channel.permissionOverwrites.delete(member, 'Temp VC unlocked');
        }
    }
    updatePanels(guild).catch(() => {});
}

// "Create my VC" (panel button): gives the member their own channel using
// the first configured trigger's category/template/bitrate, without them
// needing to join the trigger channel.
async function createForMember(guild, member) {
    if (!guild || !member) {
        const err = new Error('Guild or member not available');
        err.code = 'NO_CONTEXT';
        throw err;
    }
    const triggers = getTriggers(guild.id);
    if (!triggers.length) {
        const err = new Error('No join-to-create trigger is configured yet — an admin must run `/tempvc set #channel` first');
        err.code = 'NO_TRIGGER';
        throw err;
    }
    // The bot can only MOVE a member who is already in a voice channel
    // (VoiceState.setChannel is the REST move endpoint — connecting an idle
    // user from nothing isn't possible). The trigger flow is safe because the
    // member is already inside the trigger; the panel button needs this guard.
    if (!member.voice || !member.voice.channelId) {
        const err = new Error('Join any voice channel first (or the trigger channel), then press **Create my VC**.');
        err.code = 'NOT_IN_VC';
        throw err;
    }
    const trigger = triggers[0];

    // Already in/owning a live channel → move them back (the button acts as
    // a "return to my VC" as well).
    const existing = getSpawnedByOwner(guild.id, member.id);
    if (existing) {
        const ch = guild.channels && guild.channels.cache ? guild.channels.cache.get(existing.channel_id) : null;
        if (ch && ch.members && ch.members.size > 0) {
            cancelDeletion(existing.channel_id);
            try { await member.voice.setChannel(ch); } catch { /* fine */ }
            return { reused: true, channel: ch };
        }
        if (ch) scheduleDeletionIfEmpty(guild, existing.channel_id);
        removeSpawned(existing.channel_id);
    }

    const channel = await spawnChannel(guild, member, trigger);
    if (!channel) {
        const err = new Error('Couldn\'t create your voice channel — the bot is missing **Manage Channels** permission, or the category is full.');
        err.code = 'CREATE_FAILED';
        throw err;
    }
    return { created: true, channel };
}

// Owner closes their own temp channel (panel button).
async function deleteOwnedChannel(guild, ownerId) {
    const existing = getSpawnedByOwner(guild.id, ownerId);
    if (!existing) {
        const err = new Error('You don\'t have a temp voice channel to delete.');
        err.code = 'NONE';
        throw err;
    }
    const channel = guild.channels && guild.channels.cache ? guild.channels.cache.get(existing.channel_id) : null;
    cancelDeletion(existing.channel_id);
    removeSpawned(existing.channel_id);
    if (channel) {
        try {
            await channel.delete('Temp VC closed by owner');
        } catch (err) {
            logError(err, 'tempvoice', 'ownerDelete_' + existing.channel_id);
        }
    }
    updatePanels(guild).catch(() => {});
    return { success: true };
}

// ──────────────────── Control panel (embed + buttons) ────────────────────

function buildPanelComponents() {
    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('tvc_create').setLabel('Create my VC').setStyle(ButtonStyle.Primary).setEmoji('🎧'),
        new ButtonBuilder().setCustomId('tvc_rename').setLabel('Rename').setStyle(ButtonStyle.Secondary).setEmoji('✏️'),
        new ButtonBuilder().setCustomId('tvc_limit').setLabel('Limit').setStyle(ButtonStyle.Secondary).setEmoji('👥'),
        new ButtonBuilder().setCustomId('tvc_lock').setLabel('Lock').setStyle(ButtonStyle.Danger).setEmoji('🔒'),
        new ButtonBuilder().setCustomId('tvc_unlock').setLabel('Unlock').setStyle(ButtonStyle.Success).setEmoji('🔓'),
    );
    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('tvc_claim').setLabel('Claim').setStyle(ButtonStyle.Secondary).setEmoji('👑'),
        new ButtonBuilder().setCustomId('tvc_delete').setLabel('Delete my VC').setStyle(ButtonStyle.Danger).setEmoji('🗑️'),
    );
    return [row1, row2];
}

function buildPanelMessage(guild) {
    const triggers = getTriggers(guild.id);
    const spawned = getSpawned(guild.id);
    const embed = new EmbedBuilder()
        .setColor(0x00BFFF)
        .setAuthor({ name: guild.name, iconURL: guild.iconURL() })
        .setTitle('🎙️ Temp Voice Control Panel')
        .setDescription(
            'Get your own private voice channel and control it right here.\n\n' +
            '**How it works:** join a trigger channel (or press **Create my VC**) and a channel named after you appears. ' +
            'It **auto-deletes** once everyone leaves.\n\n' +
            'You can only control your own channel — locked channels only let the owner in.'
        )
        .setFooter({ text: 'Temp Voice Channels' })
        .setTimestamp();

    if (triggers.length) {
        embed.addFields({
            name: '🎟️ Trigger channels',
            value: triggers.map(t => '<#' + t.channel_id + '>' + (t.category_id ? ' → spawns in <#' + t.category_id + '>' : '')).join('\n'),
            inline: false,
        });
    }
    if (spawned.length) {
        // One line per live channel: tag — owner — lock state.
        const lines = [];
        const everyoneId = guild.roles && guild.roles.everyone ? guild.roles.everyone.id : null;
        for (const s of spawned) {
            const ch = guild.channels && guild.channels.cache ? guild.channels.cache.get(s.channel_id) : null;
            if (!ch) continue;
            const owner = guild.members && guild.members.cache ? guild.members.cache.get(s.owner_id) : null;
            const ownerName = (owner && owner.user && owner.user.username) || ('<@' + s.owner_id + '>');
            const eow = everyoneId && ch.permissionOverwrites && ch.permissionOverwrites.cache
                ? ch.permissionOverwrites.cache.get(everyoneId) : null;
            // Lock state is derived from the cached @everyone overwrite (the
            // same one setChannelLocked edits). If it isn't cached yet, the
            // channel shows as Open — acceptable, the next event re-renders.
            const locked = !!(eow && eow.deny && eow.deny.has(PermissionFlagsBits.Connect));
            lines.push('• <#' + ch.id + '> — **' + ownerName + '** — ' + (locked ? '🔒 Locked' : '🔓 Open'));
        }
        // Truncate on line boundaries so a channel tag is never cut in half.
        let text = '';
        let shown = 0;
        for (const line of lines) {
            if ((text ? text + '\n' + line : line).length > 1000) break;
            text = text ? text + '\n' + line : line;
            shown++;
        }
        if (shown < lines.length) text += '\n…+' + (lines.length - shown) + ' more';
        embed.addFields({ name: '🔊 Live channels (' + lines.length + ')', value: text || '—', inline: false });
    }
    return { embeds: [embed], components: buildPanelComponents() };
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
    uniqueChannelName,
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
    registerPanel,
    getPanels,
    unregisterPanel,
    updatePanels,
    spawnChannel,
    cancelDeletion,
    scheduleDeletionIfEmpty,
    getMemberChannelFor,
    setChannelLocked,
    createForMember,
    deleteOwnedChannel,
    buildPanelMessage,
    buildPanelComponents,
    handleVoiceStateUpdate,
    cleanupOrphans,
    stopTempVoice,
};
