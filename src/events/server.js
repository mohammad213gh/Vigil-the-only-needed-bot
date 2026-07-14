const { EmbedBuilder } = require('discord.js');
const { CHANNEL_TYPE_NAMES } = require('../constants');

// ─── Permission Name Lookup (friendly display for channel overwrites) ───
const PERM_NAMES = {
    'Administrator': 'Administrator',
    'ManageGuild': 'Manage Server',
    'ManageRoles': 'Manage Roles',
    'ManageChannels': 'Manage Channels',
    'ManageMessages': 'Manage Messages',
    'ManageNicknames': 'Manage Nicknames',
    'ManageWebhooks': 'Manage Webhooks',
    'ManageThreads': 'Manage Threads',
    'ManageEvents': 'Manage Events',
    'KickMembers': 'Kick Members',
    'BanMembers': 'Ban Members',
    'ModerateMembers': 'Timeout Members',
    'MentionEveryone': 'Mention @everyone',
    'ViewChannel': 'View Channels',
    'SendMessages': 'Send Messages',
    'SendTTSMessages': 'Send TTS Messages',
    'SendMessagesInThreads': 'Send Thread Messages',
    'CreatePrivateThreads': 'Create Private Threads',
    'CreatePublicThreads': 'Create Public Threads',
    'ReadMessageHistory': 'Read History',
    'AttachFiles': 'Attach Files',
    'AddReactions': 'Add Reactions',
    'EmbedLinks': 'Embed Links',
    'UseExternalEmojis': 'Use External Emojis',
    'UseExternalStickers': 'Use External Stickers',
    'UseExternalSounds': 'Use External Sounds',
    'UseApplicationCommands': 'Use Commands',
    'Connect': 'Connect',
    'Speak': 'Speak',
    'MuteMembers': 'Mute Members',
    'DeafenMembers': 'Deafen Members',
    'MoveMembers': 'Move Members',
    'UseVAD': 'Use Voice Activity',
    'PrioritySpeaker': 'Priority Speaker',
    'Stream': 'Stream',
    'CreateInstantInvite': 'Create Invite',
    'ChangeNickname': 'Change Nickname',
    'ViewAuditLog': 'View Audit Log',
    'ViewGuildInsights': 'View Insights',
    'SendPolls': 'Send Polls',
};

function formatPermList(perms) {
    if (!perms || perms.length === 0) return '(none)';
    return perms.slice(0, 8).map(p => PERM_NAMES[p] || p).join(', ') + (perms.length > 8 ? ' (+' + (perms.length - 8) + ' more)' : '');
}

function diffOWPermissions(oldOW, newOW) {
    // Returns a detailed diff string for a single permission overwrite
    const oldAllow = oldOW.allow.toArray();
    const oldDeny = oldOW.deny.toArray();
    const newAllow = newOW.allow.toArray();
    const newDeny = newOW.deny.toArray();

    const parts = [];

    // Permissions that went from neutral/granted to denied
    const denied = newDeny.filter(p => !oldDeny.includes(p));
    // Permissions that went from neutral/denied to granted
    const granted = newAllow.filter(p => !oldAllow.includes(p));
    // Permissions that went from granted to neutral
    const removed = oldAllow.filter(p => !newAllow.includes(p));
    // Permissions that went from denied to neutral
    const unDenied = oldDeny.filter(p => !newDeny.includes(p));

    if (granted.length > 0) parts.push('\u2705 ' + formatPermList(granted));
    if (denied.length > 0) parts.push('\u274C Denied: ' + formatPermList(denied));
    if (removed.length > 0) parts.push('\u2796 Removed: ' + formatPermList(removed));
    if (unDenied.length > 0) parts.push('\u2705 Unrestricted: ' + formatPermList(unDenied));

    // If no specific changes detected but bitfields differ, show the full set
    if (parts.length === 0) {
        const allowed = newAllow.length > 0 ? 'Allowed: ' + formatPermList(newAllow) : '';
        const denied2 = newDeny.length > 0 ? 'Denied: ' + formatPermList(newDeny) : '';
        return (allowed || '(none)') + (denied2 ? ' | ' + denied2 : '');
    }

    return parts.join(' | ');
}

function getOWTargetName(guild, ow) {
    return guild.roles.cache.get(ow.id)?.name || guild.members.cache.get(ow.id)?.user?.tag || ow.id;
}

module.exports = [
    {
        name: 'channelCreate',
        once: false,
        execute: (deps) => async (channel) => {
            if (!channel.guild) return;
            const typeName = CHANNEL_TYPE_NAMES[channel.type] || 'Unknown';
            const executor = await deps.fetchAuditLogExecutor(channel.guild, 10, channel.id).catch(() => null);
            const byUser = executor ? ' by ' + String(executor) : '';

            const embed = new EmbedBuilder()
                .setColor(0x2ECC71)
                .setTitle('\uD83D\uDCE6 Channel Created')
                .setDescription('A new **' + typeName + '** channel was created' + byUser)
                .addFields(
                    { name: 'Name', value: channel.name, inline: true },
                    { name: 'Type', value: typeName, inline: true },
                    { name: 'Channel', value: channel.toString(), inline: true },
                    { name: 'ID', value: channel.id, inline: true },
                )
                .setFooter({ text: channel.guild.name, iconURL: channel.guild.iconURL() })
                .setTimestamp();

            if (executor) embed.setAuthor({ name: executor.tag, iconURL: executor.displayAvatarURL() });

            deps.sendLog(embed, 'server', null, channel.guild.id);
        },
    },
    {
        name: 'channelDelete',
        once: false,
        execute: (deps) => async (channel) => {
            if (!channel.guild) return;
            const typeName = CHANNEL_TYPE_NAMES[channel.type] || 'Unknown';
            const executor = await deps.fetchAuditLogExecutor(channel.guild, 12, channel.id).catch(() => null);
            const byUser = executor ? ' by ' + String(executor) : '';

            const embed = new EmbedBuilder()
                .setColor(0xE74C3C)
                .setTitle('\uD83D\uDCE6 Channel Deleted')
                .setDescription('A **' + typeName + '** channel was deleted' + byUser)
                .addFields(
                    { name: 'Name', value: channel.name, inline: true },
                    { name: 'Type', value: typeName, inline: true },
                    { name: 'ID', value: channel.id, inline: true },
                )
                .setFooter({ text: channel.guild.name, iconURL: channel.guild.iconURL() })
                .setTimestamp();

            if (executor) embed.setAuthor({ name: executor.tag, iconURL: executor.displayAvatarURL() });

            deps.sendLog(embed, 'server', null, channel.guild.id);
        },
    },
    {
        name: 'channelUpdate',
        once: false,
        execute: (deps) => async (oldChannel, newChannel) => {
            if (!newChannel.guild) return;

            const changes = [];

            // Name change
            if (oldChannel.name !== newChannel.name) {
                changes.push({ name: 'Name', old: oldChannel.name || '*Unknown*', new: newChannel.name });
            }

            // Topic change (text channels)
            if (oldChannel.topic !== newChannel.topic && newChannel.type === 0) {
                changes.push({ name: 'Topic', old: oldChannel.topic || '(empty)', new: newChannel.topic || '(empty)' });
            }

            // NSFW change
            if (oldChannel.nsfw !== newChannel.nsfw) {
                changes.push({ name: 'NSFW', old: oldChannel.nsfw ? 'Yes' : 'No', new: newChannel.nsfw ? 'Yes' : 'No' });
            }

            // Bitrate change (voice channels)
            if (newChannel.type === 2 && oldChannel.bitrate !== newChannel.bitrate) {
                changes.push({ name: 'Bitrate', old: (oldChannel.bitrate / 1000).toFixed(0) + 'kbps', new: (newChannel.bitrate / 1000).toFixed(0) + 'kbps' });
            }

            // User limit change (voice channels)
            if (newChannel.type === 2 && oldChannel.userLimit !== newChannel.userLimit) {
                changes.push({ name: 'User Limit', old: String(oldChannel.userLimit || 0), new: String(newChannel.userLimit || 0) });
            }

            // Permission overwrite changes
            if (oldChannel.permissionOverwrites && newChannel.permissionOverwrites) {
                const oldOverwrites = oldChannel.permissionOverwrites.cache;
                const newOverwrites = newChannel.permissionOverwrites.cache;
                const guild = newChannel.guild;

                // Check for added overwrites
                const added = newOverwrites.filter((ow, id) => !oldOverwrites.has(id));
                // Check for removed overwrites
                const removed = oldOverwrites.filter((ow, id) => !newOverwrites.has(id));
                // Check for modified overwrites (compare allow/deny bitfields)
                const modified = oldOverwrites.filter((ow, id) => {
                    const nw = newOverwrites.get(id);
                    return nw && (ow.allow.bitfield !== nw.allow.bitfield || ow.deny.bitfield !== nw.deny.bitfield);
                });

                if (added.size > 0) {
                    for (const [, ow] of added) {
                        const target = getOWTargetName(guild, ow);
                        const allowed = ow.allow.toArray();
                        const denied = ow.deny.toArray();
                        const parts = [];
                        if (allowed.length > 0) parts.push('\u2705 ' + formatPermList(allowed));
                        if (denied.length > 0) parts.push('\u274C Denied: ' + formatPermList(denied));
                        changes.push({ name: '\u2795 Permissions: ' + target, old: 'None', new: parts.join(' | ') || '(none)' });
                    }
                }
                if (removed.size > 0) {
                    for (const [, ow] of removed) {
                        const target = getOWTargetName(guild, ow);
                        const oldAllowed = ow.allow.toArray();
                        const oldDenied = ow.deny.toArray();
                        const parts = [];
                        if (oldAllowed.length > 0) parts.push('\u2705 ' + formatPermList(oldAllowed));
                        if (oldDenied.length > 0) parts.push('\u274C Denied: ' + formatPermList(oldDenied));
                        changes.push({ name: '\u2796 Permissions Removed: ' + target, old: parts.join(' | ') || '(none)', new: 'All permissions cleared' });
                    }
                }
                if (modified.size > 0) {
                    for (const [, ow] of modified) {
                        const nw = newOverwrites.get(ow.id);
                        if (!nw) continue;
                        const target = getOWTargetName(guild, ow);
                        const diff = diffOWPermissions(ow, nw);
                        const oldAllowFormatted = formatPermList(ow.allow.toArray());
                        const oldDenyArr = ow.deny.toArray();
                        const oldFull = 'Allowed: ' + oldAllowFormatted + (oldDenyArr.length ? ' | \u274C Denied: ' + formatPermList(oldDenyArr) : '');
                        changes.push({ name: '\uD83D\uDD04 Permissions: ' + target, old: oldFull, new: diff });
                    }
                }
            }

            // Only log if something actually changed
            if (changes.length === 0) return;

            const executor = await deps.fetchAuditLogExecutor(newChannel.guild, 11, newChannel.id).catch(() => null);
            const byUser = executor ? ' by ' + String(executor) : '';

            const embed = new EmbedBuilder()
                .setColor(0xF1C40F)
                .setTitle('\uD83D\uDCE6 Channel Updated')
                .setDescription(newChannel.toString() + ' was modified' + byUser)
                .setTimestamp();

            for (const change of changes) {
                const val = change.old !== undefined && change.old !== null
                    ? '**Before:** ' + deps.truncate(String(change.old), 500) + '\n**After:** ' + deps.truncate(String(change.new), 500)
                    : deps.truncate(String(change.new), 1000);
                embed.addFields({ name: change.name, value: val, inline: false });
            }

            embed.setFooter({ text: newChannel.guild.name, iconURL: newChannel.guild.iconURL() });
            if (executor) embed.setAuthor({ name: executor.tag, iconURL: executor.displayAvatarURL() });

            deps.sendLog(embed, 'server', null, newChannel.guild.id);
        },
    },
    {
        name: 'webhooksUpdate',
        once: false,
        execute: (deps) => async (channel) => {
            if (!channel.guild) return;

            // Fetch recent audit logs to see what happened with webhooks
            let actionType = 'updated';
            let embedColor = 0xF1C40F;
            let executor = null;

            try {
                const guild = channel.guild;
                // Try WEBHOOK_CREATE (50), WEBHOOK_UPDATE (51), WEBHOOK_DELETE (52)
                let audit = null;
                for (const type of [50, 51, 52]) {
                    try {
                        audit = await guild.fetchAuditLogs({ type, limit: 3 });
                        if (audit?.entries?.size) break;
                    } catch {}
                }
                if (audit?.entries?.size) {
                    const entry = audit.entries.filter(e => {
                        const tId = e.target?.id || e.targetId || e.extra?.channel?.id;
                        return tId === channel.id;
                    }).first();
                    if (entry) {
                        executor = entry.executor;
                        if (entry.action === 50) { actionType = 'created'; embedColor = 0x2ECC71; }
                        else if (entry.action === 52) { actionType = 'deleted'; embedColor = 0xE74C3C; }
                        else { actionType = 'updated'; embedColor = 0xF1C40F; }
                    }
                }
            } catch {}

            const byUser = executor ? ' by ' + String(executor) : '';

            const embed = new EmbedBuilder()
                .setColor(embedColor)
                .setTitle('\uD83D\uDD17 Webhook ' + actionType.charAt(0).toUpperCase() + actionType.slice(1))
                .setDescription('A webhook was ' + actionType + ' in ' + channel.toString() + byUser)
                .addFields(
                    { name: 'Channel', value: channel.toString(), inline: true },
                    { name: 'Action', value: actionType === 'created' ? '\u2705 Added' : actionType === 'deleted' ? '\u274C Removed' : '\uD83D\uDD04 Updated', inline: true },
                )
                .setFooter({ text: channel.guild.name, iconURL: channel.guild.iconURL() })
                .setTimestamp();

            if (executor) embed.setAuthor({ name: executor.tag, iconURL: executor.displayAvatarURL() });

            deps.sendLog(embed, 'webhooks', null, channel.guild.id);
        },
    },
];

// ─── Audit log action type constants ───
// 10 = CHANNEL_CREATE, 11 = CHANNEL_UPDATE, 12 = CHANNEL_DELETE
// 30 = ROLE_CREATE, 31 = ROLE_UPDATE, 32 = ROLE_DELETE
// 50 = WEBHOOK_CREATE, 51 = WEBHOOK_UPDATE, 52 = WEBHOOK_DELETE
