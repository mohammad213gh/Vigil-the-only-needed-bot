const { EmbedBuilder } = require('discord.js');
const { CHANNEL_TYPE_NAMES } = require('../constants');

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
                    const names = added.map(ow => {
                        const target = newChannel.guild.roles.cache.get(ow.id)?.name || newChannel.guild.members.cache.get(ow.id)?.user?.tag || ow.id;
                        return '\u2795 ' + target;
                    });
                    changes.push({ name: 'Permission Overwrites Added', old: 'None', new: deps.truncate(names.join(', '), 800) });
                }
                if (removed.size > 0) {
                    const names = removed.map(ow => {
                        const target = oldChannel.guild.roles.cache.get(ow.id)?.name || oldChannel.guild.members.cache.get(ow.id)?.user?.tag || ow.id;
                        return '\u2796 ' + target;
                    });
                    changes.push({ name: 'Permission Overwrites Removed', old: 'None', new: deps.truncate(names.join(', '), 800) });
                }
                if (modified.size > 0) {
                    changes.push({ name: 'Permission Overwrites Modified', old: 'Permissions changed', new: String(modified.size) + ' overwrite(s) modified' });
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

            deps.sendLog(embed, 'server', null, channel.guild.id);
        },
    },
];

// ─── Audit log action type constants ───
// 10 = CHANNEL_CREATE, 11 = CHANNEL_UPDATE, 12 = CHANNEL_DELETE
// 30 = ROLE_CREATE, 31 = ROLE_UPDATE, 32 = ROLE_DELETE
// 50 = WEBHOOK_CREATE, 51 = WEBHOOK_UPDATE, 52 = WEBHOOK_DELETE
