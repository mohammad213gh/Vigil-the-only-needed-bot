// ──────────────────── /tempvc ────────────────────
// Temporary voice channels: join a designated trigger VC and the bot spawns
// a channel named after you; it auto-deletes when empty.
//   Admin subs (set/unset/list/name)  — bot owner or granted permission
//   Owner subs (rename/limit/lock/unlock/claim) — the temp channel's owner
const { PermissionFlagsBits } = require('discord.js');
const { isOwner } = require('../helpers');
const { hasPermission } = require('../permissions');
const tv = require('../tempVoice');

function canAdmin(interaction) {
    return isOwner(interaction.user.id) || hasPermission(interaction.guild.id, 'tempvc', interaction.user.id);
}

// The temp channel the user is currently in, falling back to one they own.
function getMemberChannel(interaction) {
    const guild = interaction.guild;
    const vcId = interaction.member.voice && interaction.member.voice.channelId;
    if (vcId) {
        const row = tv.getSpawnedChannel(vcId);
        if (row) {
            const channel = guild.channels.cache.get(vcId);
            if (channel) return { row, channel };
        }
    }
    const owned = tv.getSpawnedByOwner(guild.id, interaction.user.id);
    if (owned) {
        const channel = guild.channels.cache.get(owned.channel_id);
        if (channel) return { row: owned, channel };
    }
    return null;
}

async function setLocked(channel, guild, member, locked) {
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
}

async function executeTempVoice(interaction) {
    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild;

    // ── Admin subcommands ──
    if (sub === 'set' || sub === 'unset' || sub === 'name' || sub === 'list') {
        if (!canAdmin(interaction)) {
            return interaction.reply({ content: '❌ You need the **bot owner** or the `tempvc` permission to manage temp voice channels.', ephemeral: true });
        }
    }

    if (sub === 'set') {
        const channel = interaction.options.getChannel('channel');
        const category = interaction.options.getChannel('category');
        if (!tv.isVoiceChannel(channel)) {
            return interaction.reply({ content: '❌ The trigger must be a voice channel.', ephemeral: true });
        }
        if (category && category.type !== 4) {
            return interaction.reply({ content: '❌ The category option must be a category.', ephemeral: true });
        }
        if (channel.guildId !== guild.id || (category && category.guildId !== guild.id)) {
            return interaction.reply({ content: '❌ Those channels are not in this server.', ephemeral: true });
        }
        tv.setTrigger(guild.id, channel.id, category ? category.id : null);
        return interaction.reply({
            content: '✅ <#' + channel.id + '> is now a **join-to-create** trigger' +
                (category ? ' (channels spawn in **' + category.name + '**)' : '') +
                '.\nWhen someone joins it, the bot spawns a channel named after them. Use `/tempvc name <template>` to change the naming.',
        });
    }

    if (sub === 'unset') {
        const channel = interaction.options.getChannel('channel');
        if (channel) {
            tv.removeTrigger(guild.id, channel.id);
            return interaction.reply({ content: '✅ Removed <#' + channel.id + '> as a trigger.', ephemeral: true });
        }
        const triggers = tv.getTriggers(guild.id);
        for (const t of triggers) tv.removeTrigger(guild.id, t.channel_id);
        return interaction.reply({ content: triggers.length ? '✅ Removed all **' + triggers.length + '** triggers.' : 'ℹ️ No triggers configured.', ephemeral: true });
    }

    if (sub === 'name') {
        const template = interaction.options.getString('template');
        const res = tv.setConfig(guild.id, template);
        if (res.error) return interaction.reply({ content: '❌ ' + res.error, ephemeral: true });
        return interaction.reply({
            content: '✅ Name template set to **' + res.name_template + '** — placeholders: `{name}` (username) and `{number}` (spawn counter).',
            ephemeral: true,
        });
    }

    if (sub === 'list') {
        const triggers = tv.getTriggers(guild.id);
        const spawned = tv.getSpawned(guild.id);
        const triggerLines = [];
        for (const t of triggers) {
            const ch = guild.channels.cache.get(t.channel_id);
            if (!ch) {
                tv.removeTrigger(guild.id, t.channel_id); // self-heal dead rows
                continue;
            }
            triggerLines.push('• <#' + t.channel_id + '>' + (t.category_id ? ' → spawns in <#' + t.category_id + '>' : ''));
        }
        const spawnedLines = [];
        for (const s of spawned) {
            const ch = guild.channels.cache.get(s.channel_id);
            if (!ch) { tv.removeSpawned(s.channel_id); continue; }
            const owner = guild.members.cache.get(s.owner_id);
            spawnedLines.push('• <#' + s.channel_id + '> → owned by ' + (owner ? String(owner.user) : '`' + s.owner_id + '`') + (ch.members && ch.members.size ? ' (' + ch.members.size + ' in it)' : ' (empty)'));
        }
        if (!triggerLines.length && !spawnedLines.length) {
            return interaction.reply({ content: 'ℹ️ No temp voice channels configured. Use `/tempvc set #channel` to add a join-to-create trigger.', ephemeral: true });
        }
        return interaction.reply({
            content: '**🎙️ Temp Voice Channels**\n' +
                (triggerLines.length ? '**Triggers:**\n' + triggerLines.join('\n') + '\n' : '') +
                (spawnedLines.length ? '**Live channels:**\n' + spawnedLines.join('\n') : ''),
            ephemeral: true,
        });
    }

    // ── Owner subcommands ──
    if (sub === 'rename' || sub === 'limit' || sub === 'lock' || sub === 'unlock') {
        const found = getMemberChannel(interaction);
        if (!found) {
            return interaction.reply({ content: '❌ You\'re not in a temp voice channel (and don\'t own one). Join a trigger VC to get your own.', ephemeral: true });
        }
        if (found.row.owner_id !== interaction.user.id && !isOwner(interaction.user.id)) {
            return interaction.reply({ content: '❌ Only the channel owner can do that. (Owner is gone? Use `/tempvc claim`.)', ephemeral: true });
        }
        const { channel } = found;

        if (sub === 'rename') {
            const name = interaction.options.getString('name').trim().slice(0, tv.MAX_CHANNEL_NAME);
            if (!name) return interaction.reply({ content: '❌ Name can\'t be empty.', ephemeral: true });
            try {
                await channel.setName(name, 'Temp VC renamed');
                return interaction.reply({ content: '✅ Renamed to **' + name + '**.', ephemeral: true });
            } catch (err) {
                return interaction.reply({ content: '❌ Failed to rename: ' + (err.message || err), ephemeral: true });
            }
        }

        if (sub === 'limit') {
            const limit = interaction.options.getInteger('limit');
            try {
                await channel.setUserLimit(limit, 'Temp VC user limit');
                return interaction.reply({ content: limit === 0 ? '✅ User limit cleared (unlimited).' : '✅ User limit set to **' + limit + '**.', ephemeral: true });
            } catch (err) {
                return interaction.reply({ content: '❌ Failed to set limit: ' + (err.message || err), ephemeral: true });
            }
        }

        if (sub === 'lock' || sub === 'unlock') {
            const locked = sub === 'lock';
            try {
                await setLocked(channel, guild, interaction.member, locked);
                return interaction.reply({ content: locked ? '🔒 Channel locked — only you can join now.' : '🔓 Channel unlocked — everyone can join.', ephemeral: true });
            } catch (err) {
                return interaction.reply({ content: '❌ Failed to ' + sub + ': ' + (err.message || err), ephemeral: true });
            }
        }
    }

    // claim
    const vcId = interaction.member.voice && interaction.member.voice.channelId;
    if (!vcId) {
        return interaction.reply({ content: '❌ You need to be inside a temp voice channel to claim it.', ephemeral: true });
    }
    const row = tv.getSpawnedChannel(vcId);
    if (!row) {
        return interaction.reply({ content: '❌ This isn\'t a temp voice channel.', ephemeral: true });
    }
    const channel = guild.channels.cache.get(vcId);
    // channel.members is voice-state-driven and authoritative for "who is in
    // this VC" — guild.members.cache can miss the owner on large servers.
    if (channel && channel.members && channel.members.has(row.owner_id)) {
        return interaction.reply({ content: '❌ The owner is still here — no need to claim.', ephemeral: true });
    }
    tv.addSpawned(vcId, guild.id, interaction.user.id, row.trigger_id);
    tv.cancelDeletion(vcId);
    return interaction.reply({ content: '👑 You now own this channel. You can `/tempvc rename`, `/tempvc limit`, `/tempvc lock` it.', ephemeral: true });

}

module.exports = { executeTempVoice };
