const { EmbedBuilder } = require('discord.js');
const { PERM_NAMES } = require('../constants');

function formatPerms(permissions) {
    const perms = permissions.toArray ? permissions.toArray() : permissions;
    const names = perms.slice(0, 8).map(p => PERM_NAMES[p] || p);
    const extra = perms.length > 8 ? ' (+' + (perms.length - 8) + ' more)' : '';
    return names.join(', ') + extra || 'None';
}

module.exports = [
    {
        name: 'guildMemberUpdate',
        once: false,
        execute: (deps) => async (oldMember, newMember) => {
            if (oldMember.user.bot) return;
            if (!oldMember.guild) return;
            if (oldMember.partial) return;

            const oldRoles = oldMember.roles.cache;
            const newRoles = newMember.roles.cache;

            // Roles added
            const added = newRoles.filter(role => !oldRoles.has(role.id) && role.id !== role.guild.id);
            // Roles removed
            const removed = oldRoles.filter(role => !newRoles.has(role.id) && role.id !== role.guild.id);

            if (added.size > 0) {
                for (const [, role] of added) {
                    const executor = await deps.fetchAuditLogExecutor(newMember.guild, 25, newMember.id).catch(() => null);
                    const byUser = executor ? ' by ' + String(executor) : '';
                    const embed = new EmbedBuilder()
                        .setColor(role.hexColor || 0x2ECC71)
                        .setAuthor({ name: newMember.user.tag, iconURL: newMember.user.displayAvatarURL() })
                        .setTitle('\uD83C\uDFF7\uFE0F Role Added')
                        .setDescription(newMember.user + ' was given the **' + role.name + '** role' + byUser)
                        .setThumbnail(newMember.user.displayAvatarURL({ size: 64 }))
                        .addFields(
                            { name: 'User', value: String(newMember.user), inline: true },
                            { name: 'Role', value: role.toString(), inline: true },
                            { name: 'Role ID', value: role.id, inline: true },
                        )
                        .setFooter({ text: newMember.guild.name, iconURL: newMember.guild.iconURL() })
                        .setTimestamp();

                    if (executor) embed.setAuthor({ name: executor.tag, iconURL: executor.displayAvatarURL() });
                    deps.sendLog(embed, 'roles', null, newMember.guild.id);
                }
            }

            if (removed.size > 0) {
                for (const [, role] of removed) {
                    const executor = await deps.fetchAuditLogExecutor(newMember.guild, 25, newMember.id).catch(() => null);
                    const byUser = executor ? ' by ' + String(executor) : '';
                    const embed = new EmbedBuilder()
                        .setColor(0xE74C3C)
                        .setAuthor({ name: newMember.user.tag, iconURL: newMember.user.displayAvatarURL() })
                        .setTitle('\uD83C\uDFF7\uFE0F Role Removed')
                        .setDescription(newMember.user + ' lost the **' + role.name + '** role' + byUser)
                        .setThumbnail(newMember.user.displayAvatarURL({ size: 64 }))
                        .addFields(
                            { name: 'User', value: String(newMember.user), inline: true },
                            { name: 'Role', value: role.name, inline: true },
                            { name: 'Role ID', value: role.id, inline: true },
                        )
                        .setFooter({ text: newMember.guild.name, iconURL: newMember.guild.iconURL() })
                        .setTimestamp();

                    if (executor) embed.setAuthor({ name: executor.tag, iconURL: executor.displayAvatarURL() });
                    deps.sendLog(embed, 'roles', null, newMember.guild.id);
                }
            }

            // ── Also track nickname and timeout changes ──
            const nickChanges = [];
            if (oldMember.nickname !== newMember.nickname) {
                nickChanges.push({ name: 'Nickname', old: oldMember.nickname || '(none)', new: newMember.nickname || '(none)' });
            }
            if (String(oldMember.communicationDisabledUntil) !== String(newMember.communicationDisabledUntil)) {
                if (newMember.communicationDisabledUntil && newMember.communicationDisabledUntil > new Date()) {
                    nickChanges.push({ name: '\u23F1 Timeout', old: oldMember.communicationDisabledUntil ? 'Already timed out' : 'Not timed out', new: 'Timed out until <t:' + Math.floor(newMember.communicationDisabledUntil.getTime() / 1000) + ':R>' });
                } else if (oldMember.communicationDisabledUntil && (!newMember.communicationDisabledUntil || newMember.communicationDisabledUntil <= new Date())) {
                    nickChanges.push({ name: '\u23F1 Timeout Removed', old: 'Timed out', new: 'Timeout removed' });
                }
            }
            if (nickChanges.length > 0) {
                const executor = await deps.fetchAuditLogExecutor(newMember.guild, 24, newMember.id).catch(() => null);
                const byUser = executor ? ' by ' + String(executor) : '';
                const embed = new EmbedBuilder()
                    .setColor(0xF1C40F)
                    .setAuthor({ name: newMember.user.tag, iconURL: newMember.user.displayAvatarURL() })
                    .setTitle('\uD83D\uDC65 Member Updated')
                    .setDescription(newMember.user + ' was modified' + byUser)
                    .setThumbnail(newMember.user.displayAvatarURL({ size: 64 }))
                    .setTimestamp();
                for (const c of nickChanges) {
                    embed.addFields({ name: c.name, value: '**Before:** ' + deps.truncate(String(c.old), 500) + '\n**After:** ' + deps.truncate(String(c.new), 500), inline: false });
                }
                embed.setFooter({ text: newMember.guild.name, iconURL: newMember.guild.iconURL() });
                if (executor) embed.setAuthor({ name: executor.tag, iconURL: executor.displayAvatarURL() });
                deps.sendLog(embed, 'members', null, newMember.guild.id);
            }
        },
    },
    {
        name: 'roleCreate',
        once: false,
        execute: (deps) => async (role) => {
            if (!role.guild) return;

            const colorHex = role.hexColor === '#000000' ? 'None' : role.hexColor;
            // Fetch who created the role
            const executor = await deps.fetchAuditLogExecutor(role.guild, 30, role.id).catch(() => null);
            const byUser = executor ? ' by ' + String(executor) : '';

            const embed = new EmbedBuilder()
                .setColor(role.color || 0x2ECC71)
                .setTitle('\uD83C\uDFF7\uFE0F Role Created')
                .setDescription('A new role **' + role.name + '** was created' + byUser)
                .addFields(
                    { name: 'Name', value: role.name, inline: true },
                    { name: 'Color', value: colorHex, inline: true },
                    { name: 'Position', value: String(role.rawPosition), inline: true },
                    { name: 'ID', value: role.id, inline: true },
                    { name: 'Hoisted', value: role.hoist ? 'Yes' : 'No', inline: true },
                    { name: 'Mentionable', value: role.mentionable ? 'Yes' : 'No', inline: true },
                    { name: 'Permissions', value: formatPerms(role.permissions), inline: false },
                )
                .setFooter({ text: role.guild.name, iconURL: role.guild.iconURL() })
                .setTimestamp();

            if (executor) embed.setAuthor({ name: executor.tag, iconURL: executor.displayAvatarURL() });

            deps.sendLog(embed, 'roles', null, role.guild.id);
        },
    },
    {
        name: 'roleDelete',
        once: false,
        execute: (deps) => async (role) => {
            if (!role.guild) return;

            const colorHex = role.hexColor === '#000000' ? 'None' : role.hexColor;
            // Fetch who deleted the role
            const executor = await deps.fetchAuditLogExecutor(role.guild, 32, role.id).catch(() => null);
            const byUser = executor ? ' by ' + String(executor) : '';

            const embed = new EmbedBuilder()
                .setColor(0xE74C3C)
                .setTitle('\uD83C\uDFF7\uFE0F Role Deleted')
                .setDescription('The role **' + role.name + '** was deleted' + byUser)
                .addFields(
                    { name: 'Name', value: role.name, inline: true },
                    { name: 'Color', value: colorHex, inline: true },
                    { name: 'Position', value: String(role.rawPosition), inline: true },
                    { name: 'ID', value: role.id, inline: true },
                    { name: 'Managed', value: role.managed ? 'Yes (bot/integration)' : 'No', inline: true },
                )
                .setFooter({ text: role.guild.name, iconURL: role.guild.iconURL() })
                .setTimestamp();

            if (executor) embed.setAuthor({ name: executor.tag, iconURL: executor.displayAvatarURL() });

            deps.sendLog(embed, 'roles', null, role.guild.id);
        },
    },
    {
        name: 'roleUpdate',
        once: false,
        execute: (deps) => async (oldRole, newRole) => {
            if (!newRole.guild) return;

            const changes = [];

            // Name change
            if (oldRole.name !== newRole.name) {
                changes.push({ name: 'Name', old: oldRole.name, new: newRole.name });
            }

            // Color change
            if (oldRole.hexColor !== newRole.hexColor) {
                changes.push({ name: 'Color', old: oldRole.hexColor === '#000000' ? 'None' : oldRole.hexColor, new: newRole.hexColor === '#000000' ? 'None' : newRole.hexColor });
            }

            // Hoist change
            if (oldRole.hoist !== newRole.hoist) {
                changes.push({ name: 'Hoisted', old: oldRole.hoist ? 'Yes' : 'No', new: newRole.hoist ? 'Yes' : 'No' });
            }

            // Mentionable change
            if (oldRole.mentionable !== newRole.mentionable) {
                changes.push({ name: 'Mentionable', old: oldRole.mentionable ? 'Yes' : 'No', new: newRole.mentionable ? 'Yes' : 'No' });
            }

            // Permission changes — compare bitfields to detect any change
            if (oldRole.permissions.bitfield !== newRole.permissions.bitfield) {
                const addedPerms = newRole.permissions.toArray().filter(p => !oldRole.permissions.has(p));
                const removedPerms = oldRole.permissions.toArray().filter(p => !newRole.permissions.has(p));
                const parts = [];
                if (addedPerms.length > 0) {
                    parts.push('\u2705 Added: ' + addedPerms.slice(0, 5).map(p => PERM_NAMES[p] || p).join(', ') + (addedPerms.length > 5 ? ' (+' + (addedPerms.length - 5) + ')' : ''));
                }
                if (removedPerms.length > 0) {
                    parts.push('\u274C Removed: ' + removedPerms.slice(0, 5).map(p => PERM_NAMES[p] || p).join(', ') + (removedPerms.length > 5 ? ' (+' + (removedPerms.length - 5) + ')' : ''));
                }
                changes.push({ name: 'Permissions', old: parts.join(' | ') || 'Changed', new: formatPerms(newRole.permissions) });
            }

            if (changes.length === 0) return;

            // Fetch who updated the role
            const executor = await deps.fetchAuditLogExecutor(newRole.guild, 31, newRole.id).catch(() => null);
            const byUser = executor ? ' by ' + String(executor) : '';

            const embed = new EmbedBuilder()
                .setColor(0xF1C40F)
                .setTitle('\uD83C\uDFF7\uFE0F Role Updated')
                .setDescription('The role **' + newRole.name + '** was modified' + byUser)
                .setTimestamp();

            for (const change of changes) {
                embed.addFields({
                    name: change.name,
                    value: '**Before:** ' + deps.truncate(String(change.old), 900) + '\n**After:** ' + deps.truncate(String(change.new), 900),
                    inline: false,
                });
            }

            embed.setFooter({ text: newRole.guild.name, iconURL: newRole.guild.iconURL() });
            if (executor) embed.setAuthor({ name: executor.tag, iconURL: executor.displayAvatarURL() });

            deps.sendLog(embed, 'roles', null, newRole.guild.id);
        },
    },
];
