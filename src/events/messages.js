const { EmbedBuilder } = require('discord.js');
const { getGuildConfig } = require('../config');
const { handlePrefixMessage } = require('../prefixCommands');
const { logError } = require('../logError');

const { getDb } = require('../db');
const { checkMessage } = require('../automod');

// ──────────────────── Track message activity for insights ────────────────────
function trackActivity(guildId, userId, channelId) {
    const db = getDb();
    try {
        db.prepare('INSERT OR REPLACE INTO activity_counts (guild_id, user_id, channel_id, message_count) VALUES (?, ?, ?, COALESCE((SELECT message_count + 1 FROM activity_counts WHERE guild_id = ? AND user_id = ? AND channel_id = ?), 1))')
            .run(guildId, userId, channelId, guildId, userId, channelId);
    } catch (err) {
        logError(err, 'events', 'messages/trackActivity');
    }
}

// ──────────────────── Log deleted/edited messages for search ────────────────────
function logMessageAction(guildId, channelId, messageId, authorId, authorTag, content, action, attachments) {
    const db = getDb();
    try {
        db.prepare('INSERT INTO message_log (guild_id, channel_id, message_id, author_id, author_tag, content, action, attachments, logged_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
            .run(guildId, channelId, messageId, authorId, authorTag, content || '', action, attachments ? JSON.stringify(attachments) : null, Date.now());
        // Keep only last 1000 per guild
        db.prepare('DELETE FROM message_log WHERE id IN (SELECT id FROM message_log WHERE guild_id = ? ORDER BY logged_at DESC LIMIT -1 OFFSET 1000)').run(guildId);
    } catch (err) {
        logError(err, 'events', 'messages/logMessageAction');
    }
}

// Prefix cache — avoids a config read per message; 30s staleness window
const prefixCache = new Map();
function getCachedPrefix(guildId) {
    const cached = prefixCache.get(guildId);
    if (cached && Date.now() - cached.ts < 30000) return cached.prefix;
    let prefix = ';';
    try {
        prefix = getGuildConfig(guildId).prefix || ';';
    } catch (err) {
        logError(err, 'events', 'messages/prefix');
    }
    prefixCache.set(guildId, { prefix, ts: Date.now() });
    return prefix;
}

module.exports = [
    {
        name: 'messageCreate',
        once: false,
        execute: (deps) => async (message) => {
            if (message.author?.bot) return;
            if (!message.guild) return;

            // Track activity for server insights
            trackActivity(message.guild.id, message.author.id, message.channelId);

            // Auto-mod check (async, non-blocking — runs in background)
            checkMessage(message, message.guild.id).catch(() => {});

            // Prefix dispatch — cached lookup supports ANY configured prefix
            // (the old hardcoded ; / ! . gate silently broke custom prefixes)
            const content = message.content;
            if (!content || content.length < 2) return;

            await handlePrefixMessage(message, getCachedPrefix(message.guild.id));
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

            // Log for message search
            logMessageAction(message.guild.id, message.channelId, message.id, message.author.id, message.author.tag, message.content, 'deleted', message.attachments.map(a => ({ name: a.name, url: a.url })));

            // Broadcast to dashboard via SSE
            if (global.broadcastDashboard) {
                global.broadcastDashboard('msg_deleted', {
                    guildId: message.guild.id, channelId: message.channelId,
                    authorTag: message.author.tag, content: message.content?.slice(0, 200),
                });
            }

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

            // Log for message search
            logMessageAction(oldMessage.guild.id, oldMessage.channelId, oldMessage.id, oldMessage.author.id, oldMessage.author.tag, oldMessage.content + ' → ' + newMessage.content, 'edited', null);

            // Broadcast to dashboard via SSE
            if (global.broadcastDashboard) {
                global.broadcastDashboard('msg_edited', {
                    guildId: oldMessage.guild.id, channelId: oldMessage.channelId,
                    authorTag: oldMessage.author.tag,
                    before: oldMessage.content?.slice(0, 100),
                    after: newMessage.content?.slice(0, 100),
                });
            }

            if (attachmentText) {
                embed.addFields({ name: 'Attachments', value: attachmentText });
            }

            deps.sendLog(embed, 'messages', oldMessage.channelId, oldMessage.guild.id);
        },
    },
];
