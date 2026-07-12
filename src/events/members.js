const { EmbedBuilder } = require('discord.js');

module.exports = [
    {
        name: 'guildMemberAdd',
        once: false,
        execute: (deps) => async (member) => {
            if (member.user.bot) return;

            deps.recordJoin(member.guild.id);

            const daysSinceCreation = Math.floor((Date.now() - member.user.createdTimestamp) / 86400000);
            const isNewAccount = daysSinceCreation < 7;
            const ageWarning = isNewAccount
                ? '\n\u26A0\uFE0F **Warning: Account is only ' + daysSinceCreation + ' day' + (daysSinceCreation === 1 ? '' : 's') + ' old**'
                : '';

            const embed = new EmbedBuilder()
                .setColor(0x3498DB)
                .setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() })
                .setTitle('\uD83D\uDC4B Member Joined')
                .setDescription(member.user + ' joined the server')
                .setThumbnail(member.user.displayAvatarURL({ size: 128 }))
                .addFields(
                    {
                        name: '\uD83D\uDD10 Account Info',
                        value: 'Created: <t:' + Math.floor(member.user.createdTimestamp / 1000) + ':R>'
                            + '\nAge: ' + daysSinceCreation + ' day' + (daysSinceCreation === 1 ? '' : 's')
                            + ageWarning,
                    },
                    { name: '\uD83D\uDCC5 Joined Server', value: '<t:' + Math.floor(Date.now() / 1000) + ':R>', inline: true },
                    { name: '\uD83D\uDC65 Member Count', value: String(member.guild.memberCount), inline: true },
                    { name: '\uD83D\uDC64 User ID', value: member.user.id, inline: true },
                )
                .setFooter({ text: member.guild.name, iconURL: member.guild.iconURL() })
                .setTimestamp();

            deps.sendLog(embed, 'members', null, member.guild.id);
        },
    },
    {
        name: 'guildMemberRemove',
        once: false,
        execute: (deps) => async (member) => {
            if (member.user.bot) return;

            deps.recordLeave(member.guild.id);

            const daysSinceCreation = Math.floor((Date.now() - member.user.createdTimestamp) / 86400000);
            const membershipDuration = member.joinedAt
                ? deps.formatUptime(Date.now() - member.joinedAt.getTime())
                : '*Unknown*';

            const embed = new EmbedBuilder()
                .setColor(0xE67E22)
                .setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() })
                .setTitle('\uD83D\uDEAA Member Left')
                .setDescription(member.user + ' has left the server')
                .setThumbnail(member.user.displayAvatarURL({ size: 128 }))
                .addFields(
                    {
                        name: '\uD83D\uDD10 Account Info',
                        value: 'Created: <t:' + Math.floor(member.user.createdTimestamp / 1000) + ':R>'
                            + '\nAge: ' + daysSinceCreation + ' day' + (daysSinceCreation === 1 ? '' : 's'),
                    },
                    {
                        name: '\uD83D\uDC4B Membership',
                        value: 'Joined: ' + (member.joinedAt ? '<t:' + Math.floor(member.joinedAt.getTime() / 1000) + ':R>' : '*Unknown*')
                            + '\nWas here: ' + membershipDuration,
                        inline: true,
                    },
                    { name: '\uD83D\uDC65 Member Count', value: String(member.guild.memberCount), inline: true },
                    { name: '\uD83D\uDC64 User ID', value: member.user.id, inline: true },
                )
                .setFooter({ text: member.guild.name, iconURL: member.guild.iconURL() })
                .setTimestamp();

            const roles = member.roles.cache
                .filter(r => r.id !== r.guild.id)
                .map(r => r.name);
            if (roles.length > 0) {
                embed.addFields({ name: '\uD83C\uDFF7\uFE0F Roles (' + roles.length + ')', value: deps.truncate(roles.join(', '), 1024) });
            }

            deps.sendLog(embed, 'members', null, member.guild.id);
        },
    },
];
