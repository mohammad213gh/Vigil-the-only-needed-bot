const { EmbedBuilder } = require('discord.js');
const { logError } = require('../logError');

module.exports = [
    {
        name: 'messageReactionAdd',
        once: false,
        execute: (deps) => async (reaction, user) => {
            if (reaction.partial) await reaction.fetch();
            if (user.bot) return;

            const msg = reaction.message;
            if (msg.partial) await msg.fetch();

            // ── Handle Reaction Roles ──
            if (msg.guild && deps.rrFind) {
                const emojiKey = reaction.emoji.id
                    ? reaction.emoji.name + ':' + reaction.emoji.id
                    : reaction.emoji.name;
                const rr = deps.rrFind(msg.guild.id, msg.id, emojiKey);
                if (rr) {
                    const member = await msg.guild.members.fetch(user.id).catch(() => null);
                    if (member) {
                        try {
                            await member.roles.add(rr.roleId);
                        } catch (err) {
                            logError(err, 'events', 'reaction_roles/add ' + rr.roleId);
                        }
                    }
                    return; // Don't log reaction role interactions
                }
            }

            // ── Normal Reaction Logging ──
            if (!msg.guild) return;

            const contentSnippet = msg.content
                ? deps.truncate(msg.content, 200)
                : msg.attachments.size > 0
                    ? '*[Attachment]*'
                    : '*No text*';

            const embed = new EmbedBuilder()
                .setColor(0x2ECC71)
                .setAuthor({ name: user.tag, iconURL: user.displayAvatarURL() })
                .setTitle('\u2795 Reaction Added')
                .setDescription(user + ' reacted with ' + deps.emojiToString(reaction.emoji))
                .setThumbnail(user.displayAvatarURL({ size: 64 }))
                .addFields(
                    { name: 'Channel', value: String(msg.channel), inline: true },
                    { name: 'Author', value: String(msg.author), inline: true },
                    { name: 'Total', value: String(reaction.count) + ' reaction' + (reaction.count !== 1 ? 's' : ''), inline: true },
                    { name: 'Content', value: '```' + contentSnippet + '```' },
                    { name: 'Jump', value: '[View Message](' + msg.url + ')' },
                )
                .setFooter({ text: '#' + msg.channel.name + ' · ' + msg.guild.name, iconURL: msg.guild.iconURL() })
                .setTimestamp();

            deps.sendLog(embed, 'reactions', msg.channelId, msg.guild.id);
        },
    },
    {
        name: 'messageReactionRemove',
        once: false,
        execute: (deps) => async (reaction, user) => {
            if (reaction.partial) await reaction.fetch();
            if (user.bot) return;

            const msg = reaction.message;

            // ── Handle Reaction Roles ──
            if (msg.guild && deps.rrFind) {
                const emojiKey = reaction.emoji.id
                    ? reaction.emoji.name + ':' + reaction.emoji.id
                    : reaction.emoji.name;
                const rr = deps.rrFind(msg.guild.id, msg.id, emojiKey);
                if (rr) {
                    const member = await msg.guild.members.fetch(user.id).catch(() => null);
                    if (member) {
                        try {
                            await member.roles.remove(rr.roleId);
                        } catch (err) {
                            logError(err, 'events', 'reaction_roles/remove ' + rr.roleId);
                        }
                    }
                    return; // Don't log reaction role interactions
                }
            }

            // ── Normal Reaction Logging ──
            if (!msg.guild) return;

            const embed = new EmbedBuilder()
                .setColor(0xE74C3C)
                .setAuthor({ name: user.tag, iconURL: user.displayAvatarURL() })
                .setTitle('\u2796 Reaction Removed')
                .setDescription(user + ' removed their ' + deps.emojiToString(reaction.emoji) + ' reaction')
                .setThumbnail(user.displayAvatarURL({ size: 64 }))
                .addFields(
                    { name: 'Channel', value: String(msg.channel), inline: true },
                    { name: 'Remaining', value: String(reaction.count) + ' reaction' + (reaction.count !== 1 ? 's' : ''), inline: true },
                    { name: 'Jump', value: '[View Message](' + msg.url + ')' },
                )
                .setFooter({ text: '#' + msg.channel.name + ' · ' + msg.guild.name, iconURL: msg.guild.iconURL() })
                .setTimestamp();

            deps.sendLog(embed, 'reactions', msg.channelId, msg.guild.id);
        },
    },
];
