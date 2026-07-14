const { EmbedBuilder } = require('discord.js');
const { getGuildConfig } = require('../config');
const { handlePrefixMessage } = require('../prefixCommands');

module.exports = [
    {
        name: 'messageCreate',
        once: false,
        execute: (deps) => async (message) => {
            if (message.author?.bot) return;
            if (!message.guild) return;

            // Fast-path: check common prefixes first (; / ! .) before hitting DB
            const content = message.content;
            if (!content || (content[0] !== ';' && content[0] !== '/' && content[0] !== '!' && content[0] !== '.')) return;

            const guildConfig = getGuildConfig(message.guild.id);
            const prefix = guildConfig.prefix || ';';

            await handlePrefixMessage(message, prefix);
        },
    },
    {
        name: 'messageDelete',
        once: false,
        execute: (deps) => async (message) => {
            if (message.partial) return;
            if (!message.author || message.author.bot) return;
            if (!message.guild) return;

            const attachments = message.attachments.map(a => '[' + a.name + '](' + a.url + ')');
            const attachmentText = attachments.length > 0 ? deps.truncate(attachments.join('\n'), 1024) : null;
            const wasReply = message.reference ? ' (Reply)' : '';

            const embed = new EmbedBuilder()
                .setColor(0x992D22)
                .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
                .setTitle('\uD83D\uDDD1\uFE0F Message Deleted' + wasReply)
                .setThumbnail(message.author.displayAvatarURL({ size: 64 }))
                .addFields(
                    { name: 'Author', value: String(message.author), inline: true },
                    { name: 'Channel', value: String(message.channel), inline: true },
                    { name: 'Sent', value: message.createdTimestamp ? '<t:' + Math.floor(message.createdTimestamp / 1000) + ':R>' : '*Unknown*', inline: true },
                    { name: 'Content', value: deps.truncate(message.content || '*No text*') },
                )
                .setFooter({ text: '#' + message.channel.name + ' · ID: ' + message.id, iconURL: message.guild.iconURL() })
                .setTimestamp();

            // Show the first image inline if there are attachments
            const imageAttachment = message.attachments.find(a => a.contentType && a.contentType.startsWith('image/'));
            if (imageAttachment) {
                embed.setImage(imageAttachment.url);
            }

            if (attachmentText) {
                embed.addFields({ name: 'Attachments', value: attachmentText });
            }

            deps.sendLog(embed, 'messages', message.channelId, message.guild.id);
        },
    },
    {
        name: 'messageUpdate',
        once: false,
        execute: (deps) => async (oldMessage, newMessage) => {
            if (oldMessage.partial || (oldMessage.author && oldMessage.author.bot)) return;
            if (!oldMessage.guild) return;
            if (oldMessage.content === newMessage.content) return;

            const attachments = newMessage.attachments.map(a => '[' + a.name + '](' + a.url + ')');
            const attachmentText = attachments.length > 0 ? deps.truncate(attachments.join('\n'), 1024) : null;

            const embed = new EmbedBuilder()
                .setColor(0xF1C40F)
                .setAuthor({ name: oldMessage.author.tag, iconURL: oldMessage.author.displayAvatarURL() })
                .setTitle('\u270F\uFE0F Message Edited')
                .setThumbnail(oldMessage.author.displayAvatarURL({ size: 64 }))
                .addFields(
                    { name: 'Author', value: String(oldMessage.author), inline: true },
                    { name: 'Channel', value: String(oldMessage.channel), inline: true },
                    { name: 'Sent', value: oldMessage.createdTimestamp ? '<t:' + Math.floor(oldMessage.createdTimestamp / 1000) + ':R>' : '*Unknown*', inline: true },
                    { name: 'Before', value: deps.truncate(oldMessage.content || '*Empty*') },
                    { name: 'After', value: deps.truncate(newMessage.content || '*Empty*') },
                    { name: 'Jump', value: '[Click Here](' + newMessage.url + ')' },
                )
                .setFooter({ text: '#' + oldMessage.channel.name + ' · ID: ' + oldMessage.id, iconURL: oldMessage.guild.iconURL() })
                .setTimestamp();

            if (attachmentText) {
                embed.addFields({ name: 'Attachments', value: attachmentText });
            }

            deps.sendLog(embed, 'messages', oldMessage.channelId, oldMessage.guild.id);
        },
    },
];
