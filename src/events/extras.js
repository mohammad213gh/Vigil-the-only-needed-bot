const { EmbedBuilder } = require('discord.js');

// ─── Friendly names for thread types ───
const THREAD_TYPES = { 10: 'News Thread', 11: 'Public Thread', 12: 'Private Thread' };

module.exports = [
    // ═══════════════════════════════════════════
    //  THREAD EVENTS
    // ═══════════════════════════════════════════
    {
        name: 'threadCreate',
        once: false,
        execute: (deps) => async (thread) => {
            if (!thread.guild) return;
            const typeName = THREAD_TYPES[thread.type] || 'Thread';
            const executor = await deps.fetchAuditLogExecutor(thread.guild, 110, thread.id).catch(() => null);
            const byUser = executor ? ' by ' + String(executor) : '';

            const embed = new EmbedBuilder()
                .setColor(0x2ECC71)
                .setTitle('\uD83E\uDD9C Thread Created')
                .setDescription('A new **' + typeName + '** was created' + byUser)
                .addFields(
                    { name: 'Name', value: thread.name, inline: true },
                    { name: 'Type', value: typeName, inline: true },
                    { name: 'Channel', value: thread.parent ? thread.parent.toString() : 'N/A', inline: true },
                    { name: 'ID', value: thread.id, inline: true },
                )
                .setFooter({ text: thread.guild.name, iconURL: thread.guild.iconURL() })
                .setTimestamp();
            if (executor) embed.setAuthor({ name: executor.tag, iconURL: executor.displayAvatarURL() });
            deps.sendLog(embed, 'threads', null, thread.guild.id);
        },
    },
    {
        name: 'threadDelete',
        once: false,
        execute: (deps) => async (thread) => {
            if (!thread.guild) return;
            const typeName = THREAD_TYPES[thread.type] || 'Thread';
            const executor = await deps.fetchAuditLogExecutor(thread.guild, 112, thread.id).catch(() => null);
            const byUser = executor ? ' by ' + String(executor) : '';

            const embed = new EmbedBuilder()
                .setColor(0xE74C3C)
                .setTitle('\uD83E\uDD9C Thread Deleted')
                .setDescription('A **' + typeName + '** was deleted' + byUser)
                .addFields(
                    { name: 'Name', value: thread.name || '*Unknown*', inline: true },
                    { name: 'Type', value: typeName, inline: true },
                    { name: 'ID', value: thread.id, inline: true },
                )
                .setFooter({ text: thread.guild.name, iconURL: thread.guild.iconURL() })
                .setTimestamp();
            if (executor) embed.setAuthor({ name: executor.tag, iconURL: executor.displayAvatarURL() });
            deps.sendLog(embed, 'threads', null, thread.guild.id);
        },
    },
    {
        name: 'threadUpdate',
        once: false,
        execute: (deps) => async (oldThread, newThread) => {
            if (!newThread.guild) return;
            const changes = [];
            if (oldThread.name !== newThread.name) changes.push({ name: 'Name', old: oldThread.name, new: newThread.name });
            if (oldThread.archived !== newThread.archived) changes.push({ name: 'Archived', old: oldThread.archived ? 'Yes' : 'No', new: newThread.archived ? 'Yes' : 'No' });
            if (oldThread.locked !== newThread.locked) changes.push({ name: 'Locked', old: oldThread.locked ? 'Yes' : 'No', new: newThread.locked ? 'Yes' : 'No' });
            if (oldThread.rateLimitPerUser !== newThread.rateLimitPerUser) changes.push({ name: 'Slowmode', old: oldThread.rateLimitPerUser + 's', new: newThread.rateLimitPerUser + 's' });
            if (changes.length === 0) return;

            const executor = await deps.fetchAuditLogExecutor(newThread.guild, 111, newThread.id).catch(() => null);
            const byUser = executor ? ' by ' + String(executor) : '';
            const embed = new EmbedBuilder()
                .setColor(0xF1C40F)
                .setTitle('\uD83E\uDD9C Thread Updated')
                .setDescription('Thread **' + newThread.name + '** was modified' + byUser)
                .setTimestamp();
            for (const c of changes) embed.addFields({ name: c.name, value: '**Before:** ' + deps.truncate(String(c.old), 500) + '\n**After:** ' + deps.truncate(String(c.new), 500), inline: false });
            embed.setFooter({ text: newThread.guild.name, iconURL: newThread.guild.iconURL() });
            if (executor) embed.setAuthor({ name: executor.tag, iconURL: executor.displayAvatarURL() });
            deps.sendLog(embed, 'server', null, newThread.guild.id);
        },
    },

    // ═══════════════════════════════════════════
    //  GUILD UPDATE (server name, icon, etc.)
    // ═══════════════════════════════════════════
    {
        name: 'guildUpdate',
        once: false,
        execute: (deps) => async (oldGuild, newGuild) => {
            if (!newGuild.id) return;
            const changes = [];
            if (oldGuild.name !== newGuild.name) changes.push({ name: 'Server Name', old: oldGuild.name, new: newGuild.name });
            if (oldGuild.icon !== newGuild.icon) changes.push({ name: 'Server Icon', old: 'Changed', new: '\uD83D\uDDBC Updated' });
            if (oldGuild.vanityURLCode !== newGuild.vanityURLCode) changes.push({ name: 'Vanity URL', old: oldGuild.vanityURLCode || '(none)', new: newGuild.vanityURLCode || '(none)' });
            if (oldGuild.afkChannelId !== newGuild.afkChannelId) changes.push({ name: 'AFK Channel', old: oldGuild.afkChannelId ? '<#' + oldGuild.afkChannelId + '>' : '(none)', new: newGuild.afkChannelId ? '<#' + newGuild.afkChannelId + '>' : '(none)' });
            if (oldGuild.description !== newGuild.description) changes.push({ name: 'Description', old: oldGuild.description || '(none)', new: newGuild.description || '(none)' });
            if (changes.length === 0) return;

            const executor = await deps.fetchAuditLogExecutor(newGuild, 1, newGuild.id).catch(() => null);
            const byUser = executor ? ' by ' + String(executor) : '';
            const embed = new EmbedBuilder()
                .setColor(0xF1C40F)
                .setTitle('\uD83D\uDDA5\uFE0F Server Updated')
                .setDescription('Server settings were modified' + byUser)
                .setTimestamp();
            for (const c of changes) embed.addFields({ name: c.name, value: '**Before:** ' + deps.truncate(String(c.old), 500) + '\n**After:** ' + deps.truncate(String(c.new), 500), inline: false });
            embed.setFooter({ text: newGuild.name, iconURL: newGuild.iconURL() });
            if (executor) embed.setAuthor({ name: executor.tag, iconURL: executor.displayAvatarURL() });
            deps.sendLog(embed, 'server', null, newGuild.id);
        },
    },

    // ═══════════════════════════════════════════
    //  EMOJI EVENTS
    // ═══════════════════════════════════════════
    {
        name: 'emojiCreate',
        once: false,
        execute: (deps) => async (emoji) => {
            if (!emoji.guild) return;
            const executor = await deps.fetchAuditLogExecutor(emoji.guild, 60, emoji.id).catch(() => null);
            const byUser = executor ? ' by ' + String(executor) : '';
            const embed = new EmbedBuilder()
                .setColor(0x2ECC71)
                .setTitle('\uD83D\uDE0E Emoji Created')
                .setDescription('A new emoji **' + emoji.name + '** was added' + byUser)
                .addFields(
                    { name: 'Name', value: emoji.name, inline: true },
                    { name: 'Animated', value: emoji.animated ? 'Yes' : 'No', inline: true },
                    { name: 'ID', value: emoji.id, inline: true },
                )
                .setThumbnail(emoji.url)
                .setFooter({ text: emoji.guild.name, iconURL: emoji.guild.iconURL() })
                .setTimestamp();
            if (executor) embed.setAuthor({ name: executor.tag, iconURL: executor.displayAvatarURL() });
            deps.sendLog(embed, 'emojis', null, emoji.guild.id);
        },
    },
    {
        name: 'emojiDelete',
        once: false,
        execute: (deps) => async (emoji) => {
            if (!emoji.guild) return;
            const embed = new EmbedBuilder()
                .setColor(0xE74C3C)
                .setTitle('\uD83D\uDE0E Emoji Deleted')
                .setDescription('The emoji **' + emoji.name + '** was removed')
                .addFields(
                    { name: 'Name', value: emoji.name, inline: true },
                    { name: 'Animated', value: emoji.animated ? 'Yes' : 'No', inline: true },
                    { name: 'ID', value: emoji.id, inline: true },
                )
                .setFooter({ text: emoji.guild.name, iconURL: emoji.guild.iconURL() })
                .setTimestamp();
            deps.sendLog(embed, 'emojis', null, emoji.guild.id);
        },
    },
    {
        name: 'emojiUpdate',
        once: false,
        execute: (deps) => async (oldEmoji, newEmoji) => {
            if (!newEmoji.guild) return;
            if (oldEmoji.name === newEmoji.name) return;
            const executor = await deps.fetchAuditLogExecutor(newEmoji.guild, 61, newEmoji.id).catch(() => null);
            const byUser = executor ? ' by ' + String(executor) : '';
            const embed = new EmbedBuilder()
                .setColor(0xF1C40F)
                .setTitle('\uD83D\uDE0E Emoji Renamed')
                .setDescription('Emoji was renamed' + byUser)
                .addFields(
                    { name: 'Before', value: oldEmoji.name, inline: true },
                    { name: 'After', value: newEmoji.name, inline: true },
                    { name: 'ID', value: newEmoji.id, inline: true },
                )
                .setThumbnail(newEmoji.url)
                .setFooter({ text: newEmoji.guild.name, iconURL: newEmoji.guild.iconURL() })
                .setTimestamp();
            if (executor) embed.setAuthor({ name: executor.tag, iconURL: executor.displayAvatarURL() });
            deps.sendLog(embed, 'emojis', null, newEmoji.guild.id);
        },
    },

    // ═══════════════════════════════════════════
    //  BAN EVENTS
    // ═══════════════════════════════════════════
    {
        name: 'guildBanAdd',
        once: false,
        execute: (deps) => async (ban) => {
            if (!ban.guild) return;
            const executor = await deps.fetchAuditLogExecutor(ban.guild, 22, ban.user.id).catch(() => null);
            const byUser = executor ? ' by ' + String(executor) : '';
            const embed = new EmbedBuilder()
                .setColor(0xE74C3C)
                .setTitle('\uD83D\uDEAB Member Banned')
                .setDescription(ban.user + ' was banned from the server' + (ban.reason ? '\nReason: ' + ban.reason : '') + byUser)
                .addFields(
                    { name: 'User', value: String(ban.user), inline: true },
                    { name: 'Tag', value: ban.user.tag, inline: true },
                    { name: 'ID', value: ban.user.id, inline: true },
                )
                .setThumbnail(ban.user.displayAvatarURL({ size: 64 }))
                .setFooter({ text: ban.guild.name, iconURL: ban.guild.iconURL() })
                .setTimestamp();
            if (executor) embed.setAuthor({ name: executor.tag, iconURL: executor.displayAvatarURL() });
            deps.sendLog(embed, 'bans', null, ban.guild.id);
        },
    },
    {
        name: 'guildBanRemove',
        once: false,
        execute: (deps) => async (ban) => {
            if (!ban.guild) return;
            const executor = await deps.fetchAuditLogExecutor(ban.guild, 23, ban.user.id).catch(() => null);
            const byUser = executor ? ' by ' + String(executor) : '';
            const embed = new EmbedBuilder()
                .setColor(0x2ECC71)
                .setTitle('\uD83D\uDEAB Member Unbanned')
                .setDescription(ban.user + ' was unbanned from the server' + byUser)
                .addFields(
                    { name: 'User', value: String(ban.user), inline: true },
                    { name: 'Tag', value: ban.user.tag, inline: true },
                    { name: 'ID', value: ban.user.id, inline: true },
                )
                .setThumbnail(ban.user.displayAvatarURL({ size: 64 }))
                .setFooter({ text: ban.guild.name, iconURL: ban.guild.iconURL() })
                .setTimestamp();
            if (executor) embed.setAuthor({ name: executor.tag, iconURL: executor.displayAvatarURL() });
            deps.sendLog(embed, 'bans', null, ban.guild.id);
        },
    },

    // ═══════════════════════════════════════════
    //  INVITE EVENTS
    // ═══════════════════════════════════════════
    {
        name: 'inviteCreate',
        once: false,
        execute: (deps) => async (invite) => {
            if (!invite.guild) return;
            const expiresText = invite.maxAge && invite.maxAge > 0 ? '<t:' + Math.floor((Date.now() + invite.maxAge * 1000) / 1000) + ':R>' : 'Never';
            const embed = new EmbedBuilder()
                .setColor(0x2ECC71)
                .setTitle('\uD83D\uDD17 Invite Created')
                .setDescription('An invite was created for ' + invite.channel.toString())
                .addFields(
                    { name: 'Channel', value: invite.channel.toString(), inline: true },
                    { name: 'Code', value: invite.code, inline: true },
                    { name: 'Expires', value: expiresText, inline: true },
                    { name: 'Uses', value: invite.maxUses > 0 ? String(invite.maxUses) : 'Unlimited', inline: true },
                    { name: 'Created by', value: invite.inviter ? String(invite.inviter) : 'Unknown', inline: true },
                )
                .setFooter({ text: invite.guild.name, iconURL: invite.guild.iconURL() })
                .setTimestamp();
            deps.sendLog(embed, 'invites', null, invite.guild.id);

            // Update invite cache
            if (deps.handleInviteCreate) {
                deps.handleInviteCreate(invite);
            }
        },
    },
    {
        name: 'inviteDelete',
        once: false,
        execute: (deps) => async (invite) => {
            if (!invite.guild) return;
            const embed = new EmbedBuilder()
                .setColor(0xE74C3C)
                .setTitle('\uD83D\uDD17 Invite Deleted')
                .setDescription('An invite was deleted for ' + invite.channel.toString())
                .addFields(
                    { name: 'Channel', value: invite.channel.toString(), inline: true },
                    { name: 'Code', value: invite.code, inline: true },
                )
                .setFooter({ text: invite.guild.name, iconURL: invite.guild.iconURL() })
                .setTimestamp();
            deps.sendLog(embed, 'invites', null, invite.guild.id);

            // Update invite cache
            if (deps.handleInviteDelete) {
                deps.handleInviteDelete(invite);
            }
        },
    },

    // ═══════════════════════════════════════════
    //  STAGE INSTANCE EVENTS
    // ═══════════════════════════════════════════
    {
        name: 'stageInstanceCreate',
        once: false,
        execute: (deps) => async (stage) => {
            if (!stage.guild) return;
            const embed = new EmbedBuilder()
                .setColor(0x9B59B6)
                .setTitle('\uD83C\uDF9F Stage Started')
                .setDescription('A stage channel **' + stage.channel.name + '** is now live')
                .addFields(
                    { name: 'Topic', value: stage.topic || 'No topic', inline: true },
                    { name: 'Channel', value: stage.channel.toString(), inline: true },
                    { name: 'Speaker Count', value: String(stage.guild.members.cache.filter(m => m.voice.channelId === stage.channelId && m.voice.suppress === false).size), inline: true },
                )
                .setFooter({ text: stage.guild.name, iconURL: stage.guild.iconURL() })
                .setTimestamp();
            deps.sendLog(embed, 'stage', null, stage.guild.id);
        },
    },
    {
        name: 'stageInstanceDelete',
        once: false,
        execute: (deps) => async (stage) => {
            if (!stage.guild) return;
            const embed = new EmbedBuilder()
                .setColor(0xE74C3C)
                .setTitle('\uD83C\uDF9F Stage Ended')
                .setDescription('The stage **' + stage.channel.name + '** has ended')
                .addFields(
                    { name: 'Topic', value: stage.topic || 'No topic', inline: true },
                    { name: 'Channel', value: stage.channel.toString(), inline: true },
                )
                .setFooter({ text: stage.guild.name, iconURL: stage.guild.iconURL() })
                .setTimestamp();
            deps.sendLog(embed, 'stage', null, stage.guild.id);
        },
    },
    {
        name: 'stageInstanceUpdate',
        once: false,
        execute: (deps) => async (oldStage, newStage) => {
            if (!newStage.guild) return;
            if (oldStage.topic === newStage.topic) return;
            const embed = new EmbedBuilder()
                .setColor(0xF1C40F)
                .setTitle('\uD83C\uDF9F Stage Updated')
                .setDescription('Stage topic changed in **' + newStage.channel.name + '**')
                .addFields(
                    { name: 'Before', value: oldStage.topic || '(none)', inline: true },
                    { name: 'After', value: newStage.topic || '(none)', inline: true },
                )
                .setFooter({ text: newStage.guild.name, iconURL: newStage.guild.iconURL() })
                .setTimestamp();
            deps.sendLog(embed, 'stage', null, newStage.guild.id);
        },
    },

    // ═══════════════════════════════════════════
    //  SCHEDULED EVENT EVENTS
    // ═══════════════════════════════════════════
    {
        name: 'guildScheduledEventCreate',
        once: false,
        execute: (deps) => async (event) => {
            if (!event.guild) return;
            const entityType = { 1: 'Stage', 2: 'Voice', 3: 'External' }[event.entityType] || 'Unknown';
            const embed = new EmbedBuilder()
                .setColor(0x2ECC71)
                .setTitle('\uD83D\uDCC5 Event Created')
                .setDescription('A new event **' + event.name + '** was scheduled')
                .addFields(
                    { name: 'Name', value: event.name, inline: true },
                    { name: 'Type', value: entityType, inline: true },
                    { name: 'Starts', value: '<t:' + Math.floor(event.scheduledStartTimestamp / 1000) + ':R>', inline: true },
                    { name: 'Description', value: deps.truncate(event.description || '(none)', 500), inline: false },
                )
                .setFooter({ text: event.guild.name, iconURL: event.guild.iconURL() })
                .setTimestamp();
            deps.sendLog(embed, 'scheduled', null, event.guild.id);
        },
    },
    {
        name: 'guildScheduledEventDelete',
        once: false,
        execute: (deps) => async (event) => {
            if (!event.guild) return;
            const embed = new EmbedBuilder()
                .setColor(0xE74C3C)
                .setTitle('\uD83D\uDCC5 Event Cancelled')
                .setDescription('The event **' + event.name + '** was cancelled')
                .addFields(
                    { name: 'Name', value: event.name, inline: true },
                    { name: 'Status', value: String(event.status), inline: true },
                )
                .setFooter({ text: event.guild.name, iconURL: event.guild.iconURL() })
                .setTimestamp();
            deps.sendLog(embed, 'scheduled', null, event.guild.id);
        },
    },
    {
        name: 'guildScheduledEventUpdate',
        once: false,
        execute: (deps) => async (oldEvent, newEvent) => {
            if (!newEvent.guild) return;
            const changes = [];
            if (oldEvent.name !== newEvent.name) changes.push({ name: 'Name', old: oldEvent.name, new: newEvent.name });
            if (oldEvent.description !== newEvent.description) changes.push({ name: 'Description', old: oldEvent.description || '(none)', new: newEvent.description || '(none)' });
            if (oldEvent.scheduledStartTimestamp !== newEvent.scheduledStartTimestamp) changes.push({ name: 'Start Time', old: '<t:' + Math.floor(oldEvent.scheduledStartTimestamp / 1000) + ':R>', new: '<t:' + Math.floor(newEvent.scheduledStartTimestamp / 1000) + ':R>' });
            if (changes.length === 0) return;
            const embed = new EmbedBuilder()
                .setColor(0xF1C40F)
                .setTitle('\uD83D\uDCC5 Event Updated')
                .setDescription('The event **' + newEvent.name + '** was modified')
                .setTimestamp();
            for (const c of changes) embed.addFields({ name: c.name, value: '**Before:** ' + deps.truncate(String(c.old), 500) + '\n**After:** ' + deps.truncate(String(c.new), 500), inline: false });
            embed.setFooter({ text: newEvent.guild.name, iconURL: newEvent.guild.iconURL() });
            deps.sendLog(embed, 'scheduled', null, newEvent.guild.id);
        },
    },

    // ═══════════════════════════════════════════
    //  INTEGRATION EVENT
    // ═══════════════════════════════════════════
    {
        name: 'guildIntegrationsUpdate',
        once: false,
        execute: (deps) => async (guild) => {
            if (!guild) return;
            const executor = await deps.fetchAuditLogExecutor(guild, 80, guild.id).catch(() => null);
            const byUser = executor ? ' by ' + String(executor) : '';
            const embed = new EmbedBuilder()
                .setColor(0xF1C40F)
                .setTitle('\uD83D\uDD17 Integrations Updated')
                .setDescription('Server integrations were updated' + byUser)
                .addFields(
                    { name: 'Server', value: guild.name, inline: true },
                )
                .setFooter({ text: guild.name, iconURL: guild.iconURL() })
                .setTimestamp();
            if (executor) embed.setAuthor({ name: executor.tag, iconURL: executor.displayAvatarURL() });
            deps.sendLog(embed, 'integrations', null, guild.id);
        },
    },

    // ═══════════════════════════════════════════
    //  STICKER EVENTS
    // ═══════════════════════════════════════════
    {
        name: 'stickerCreate',
        once: false,
        execute: (deps) => async (sticker) => {
            if (!sticker.guild) return;
            const executor = await deps.fetchAuditLogExecutor(sticker.guild, 90, sticker.id).catch(() => null);
            const byUser = executor ? ' by ' + String(executor) : '';
            const embed = new EmbedBuilder()
                .setColor(0x2ECC71)
                .setTitle('\uD83D\uDC02 Sticker Added')
                .setDescription('A new sticker **' + sticker.name + '** was added' + byUser)
                .addFields(
                    { name: 'Name', value: sticker.name, inline: true },
                    { name: 'Description', value: sticker.description || '(none)', inline: true },
                    { name: 'Format', value: sticker.format === 1 ? 'PNG' : sticker.format === 2 ? 'APNG' : 'Lottie', inline: true },
                    { name: 'ID', value: sticker.id, inline: true },
                )
                .setFooter({ text: sticker.guild.name, iconURL: sticker.guild.iconURL() })
                .setTimestamp();
            if (executor) embed.setAuthor({ name: executor.tag, iconURL: executor.displayAvatarURL() });
            deps.sendLog(embed, 'stickers', null, sticker.guild.id);
        },
    },
    {
        name: 'stickerDelete',
        once: false,
        execute: (deps) => async (sticker) => {
            if (!sticker.guild) return;
            const embed = new EmbedBuilder()
                .setColor(0xE74C3C)
                .setTitle('\uD83D\uDC02 Sticker Removed')
                .setDescription('The sticker **' + sticker.name + '** was removed')
                .addFields(
                    { name: 'Name', value: sticker.name, inline: true },
                    { name: 'ID', value: sticker.id, inline: true },
                )
                .setFooter({ text: sticker.guild.name, iconURL: sticker.guild.iconURL() })
                .setTimestamp();
            deps.sendLog(embed, 'stickers', null, sticker.guild.id);
        },
    },
    {
        name: 'stickerUpdate',
        once: false,
        execute: (deps) => async (oldSticker, newSticker) => {
            if (!newSticker.guild) return;
            if (oldSticker.name === newSticker.name) return;
            const executor = await deps.fetchAuditLogExecutor(newSticker.guild, 91, newSticker.id).catch(() => null);
            const byUser = executor ? ' by ' + String(executor) : '';
            const embed = new EmbedBuilder()
                .setColor(0xF1C40F)
                .setTitle('\uD83D\uDC02 Sticker Updated')
                .setDescription('Sticker was renamed' + byUser)
                .addFields(
                    { name: 'Before', value: oldSticker.name, inline: true },
                    { name: 'After', value: newSticker.name, inline: true },
                )
                .setFooter({ text: newSticker.guild.name, iconURL: newSticker.guild.iconURL() })
                .setTimestamp();
            if (executor) embed.setAuthor({ name: executor.tag, iconURL: executor.displayAvatarURL() });
            deps.sendLog(embed, 'stickers', null, newSticker.guild.id);
        },
    },

    // ═══════════════════════════════════════════
    //  AUTO MODERATION EVENTS
    // ═══════════════════════════════════════════
    {
        name: 'autoModerationRuleCreate',
        once: false,
        execute: (deps) => async (rule) => {
            if (!rule.guild) return;
            const executor = await deps.fetchAuditLogExecutor(rule.guild, 140, rule.id).catch(() => null);
            const byUser = executor ? ' by ' + String(executor) : '';
            const triggerType = { 1: 'Keyword', 2: 'Spam', 3: 'Spam', 4: 'Keyword', 5: 'Mention Limit' }[rule.triggerType] || 'Unknown';
            const embed = new EmbedBuilder()
                .setColor(0x2ECC71)
                .setTitle('\uD83E\uDD16 Auto Mod Rule Created')
                .setDescription('A new auto-mod rule **' + rule.name + '** was created' + byUser)
                .addFields(
                    { name: 'Name', value: rule.name, inline: true },
                    { name: 'Trigger', value: triggerType, inline: true },
                    { name: 'Enabled', value: rule.enabled ? 'Yes' : 'No', inline: true },
                    { name: 'Actions', value: String(rule.actions.length) + ' action(s)', inline: true },
                )
                .setFooter({ text: rule.guild.name, iconURL: rule.guild.iconURL() })
                .setTimestamp();
            if (executor) embed.setAuthor({ name: executor.tag, iconURL: executor.displayAvatarURL() });
            deps.sendLog(embed, 'automod', null, rule.guild.id);
        },
    },
    {
        name: 'autoModerationRuleDelete',
        once: false,
        execute: (deps) => async (rule) => {
            if (!rule.guild) return;
            const embed = new EmbedBuilder()
                .setColor(0xE74C3C)
                .setTitle('\uD83E\uDD16 Auto Mod Rule Deleted')
                .setDescription('The auto-mod rule **' + rule.name + '** was deleted')
                .addFields(
                    { name: 'Name', value: rule.name, inline: true },
                    { name: 'Trigger', value: String(rule.triggerType), inline: true },
                )
                .setFooter({ text: rule.guild.name, iconURL: rule.guild.iconURL() })
                .setTimestamp();
            deps.sendLog(embed, 'automod', null, rule.guild.id);
        },
    },
    {
        name: 'autoModerationRuleUpdate',
        once: false,
        execute: (deps) => async (oldRule, newRule) => {
            if (!newRule.guild) return;
            const changes = [];
            if (oldRule.name !== newRule.name) changes.push({ name: 'Name', old: oldRule.name, new: newRule.name });
            if (oldRule.enabled !== newRule.enabled) changes.push({ name: 'Enabled', old: oldRule.enabled ? 'Yes' : 'No', new: newRule.enabled ? 'Yes' : 'No' });
            if (changes.length === 0) return;
            const executor = await deps.fetchAuditLogExecutor(newRule.guild, 141, newRule.id).catch(() => null);
            const byUser = executor ? ' by ' + String(executor) : '';
            const embed = new EmbedBuilder()
                .setColor(0xF1C40F)
                .setTitle('\uD83E\uDD16 Auto Mod Rule Updated')
                .setDescription('Auto-mod rule **' + newRule.name + '** was modified' + byUser)
                .setTimestamp();
            for (const c of changes) embed.addFields({ name: c.name, value: '**Before:** ' + deps.truncate(String(c.old), 500) + '\n**After:** ' + deps.truncate(String(c.new), 500), inline: false });
            embed.setFooter({ text: newRule.guild.name, iconURL: newRule.guild.iconURL() });
            if (executor) embed.setAuthor({ name: executor.tag, iconURL: executor.displayAvatarURL() });
            deps.sendLog(embed, 'automod', null, newRule.guild.id);
        },
    },
];
