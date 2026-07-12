const { EmbedBuilder } = require('discord.js');

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
                    const embed = new EmbedBuilder()
                        .setColor(role.hexColor || 0x2ECC71)
                        .setAuthor({ name: newMember.user.tag, iconURL: newMember.user.displayAvatarURL() })
                        .setTitle('\uD83C\uDFF7\uFE0F Role Added')
                        .setDescription(newMember.user + ' was given the **' + role.name + '** role')
                        .setThumbnail(newMember.user.displayAvatarURL({ size: 64 }))
                        .addFields(
                            { name: 'User', value: String(newMember.user), inline: true },
                            { name: 'Role', value: role.toString(), inline: true },
                            { name: 'Role ID', value: role.id, inline: true },
                        )
                        .setFooter({ text: newMember.guild.name, iconURL: newMember.guild.iconURL() })
                        .setTimestamp();

                    deps.sendLog(embed, 'roles', null, newMember.guild.id);
                }
            }

            if (removed.size > 0) {
                for (const [, role] of removed) {
                    const embed = new EmbedBuilder()
                        .setColor(0xE74C3C)
                        .setAuthor({ name: newMember.user.tag, iconURL: newMember.user.displayAvatarURL() })
                        .setTitle('\uD83C\uDFF7\uFE0F Role Removed')
                        .setDescription(newMember.user + ' lost the **' + role.name + '** role')
                        .setThumbnail(newMember.user.displayAvatarURL({ size: 64 }))
                        .addFields(
                            { name: 'User', value: String(newMember.user), inline: true },
                            { name: 'Role', value: role.name, inline: true },
                            { name: 'Role ID', value: role.id, inline: true },
                        )
                        .setFooter({ text: newMember.guild.name, iconURL: newMember.guild.iconURL() })
                        .setTimestamp();

                    deps.sendLog(embed, 'roles', null, newMember.guild.id);
                }
            }
        },
    },
];
