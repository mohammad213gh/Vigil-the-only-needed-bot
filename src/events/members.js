    const { EmbedBuilder } = require('discord.js');
const { logError } = require('../logError');

    module.exports = [
        {
            name: 'guildMemberAdd',
            once: false,
            execute: (deps) => async (member) => {
                const isBot = member.user.bot;
                
                if (!isBot) deps.recordJoin(member.guild.id);

                const daysSinceCreation = Math.floor((Date.now() - member.user.createdTimestamp) / 86400000);
                const isNewAccount = daysSinceCreation < 7;
                const ageWarning = isNewAccount
                    ? '\n\u26A0\uFE0F **Warning: Account is only ' + daysSinceCreation + ' day' + (daysSinceCreation === 1 ? '' : 's') + ' old**'
                    : '';

                const titleIcon = isBot ? '\uD83E\uDD16' : '\uD83D\uDC4B';
                const titleText = isBot ? 'Bot Added' : 'Member Joined';
                const description = isBot
                    ? member.user + ' (**' + member.user.tag + '**) was added to the server'
                    : member.user + ' joined the server';
                const embedColor = isBot ? 0x9B59B6 : 0x3498DB;

                // Find who added the bot (only for bots)
                let addedBy = '';
                if (isBot && member.guild.fetchAuditLogs) {
                    try {
                        const audit = await member.guild.fetchAuditLogs({ type: 28, limit: 3 }); // BOT_ADD
                        const entry = audit?.entries?.first();
                        if (entry && entry.target?.id === member.user.id) {
                            addedBy = ' by ' + String(entry.executor);
                        }
                    } catch (err) {
                        logError(err, 'events', 'guildMemberAdd/bot_audit');
                    }
                }

                const embed = new EmbedBuilder()
                    .setColor(embedColor)
                    .setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() })
                    .setTitle(titleIcon + ' ' + titleText)
                    .setDescription(description + addedBy)
                    .setThumbnail(member.user.displayAvatarURL({ size: 128 }))
                    .addFields(
                        {
                            name: '\uD83D\uDD10 Account Info',
                            value: 'Created: <t:' + Math.floor(member.user.createdTimestamp / 1000) + ':R>'
                                + '\nAge: ' + daysSinceCreation + ' day' + (daysSinceCreation === 1 ? '' : 's')
                                + (isBot ? '\n\uD83E\uDD16 **Bot account**' : ageWarning),
                        },
                        { name: '\uD83D\uDCC5 Joined Server', value: '<t:' + Math.floor(Date.now() / 1000) + ':R>', inline: true },
                        { name: '\uD83D\uDC65 Member Count', value: String(member.guild.memberCount), inline: true },
                        { name: '\uD83D\uDC64 ID', value: member.user.id, inline: true },
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
