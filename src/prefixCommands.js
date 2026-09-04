// ──────────────────── Prefix Command Handlers ────────────────────
// Maps text commands (like ;kick @user) to handler functions.
// Each handler receives (message, args) via message.args / message.restArgs

const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { addWarning, getWarnings, clearWarnings } = require('./warnings');
const { addReminder, removeReminder, getUserReminders } = require('./reminders');
const { updateGuildConfig } = require('./config');
const { getGuildStats } = require('./stats');
const { isOwner, truncate, parseDuration, formatDuration, formatNumber, randomItem, randomInt, reverseText, mockText } = require('./helpers');
const { hasPermission, grantPermission, revokePermission, getAllPermissions } = require('./permissions');
const { getFlag, formatUptime } = require('./helpers');
const os = require('os');
const { getReactionRoles, addReactionRole, removeAllForMessage } = require('./reactionRoles');
const { getInviterStats, getTopInviters, getGuildInviteStats } = require('./invites');
const { addNote, getNotesForUser, editNote, removeNote, getNoteCount } = require('./staffNotes');
const { getDb } = require('./db');
const { WS_STATUS } = require('./constants');
const { getThresholds, addThreshold, removeThreshold } = require('./warningThresholds');
const {
    BALL_RESPONSES, JOKES, FACTS, ADVICE, QUOTES,
    RPS_CHOICES, RPS_EMOJIS, RPS_WINNERS, WC_OUTCOMES,
} = require('./constants');

// ─── Helpers ───

function parseUserMention(text) {
    const m = text.match(/^<@!?(\d+)>$/);
    return m ? m[1] : null;
}

function parseRoleMention(text) {
    const m = text.match(/^<@&(\d+)>$/);
    return m ? m[1] : null;
}

function checkOwnerOrPerm(message, commandName) {
    if (isOwner(message.author.id)) return true;
    if (hasPermission(message.guild.id, commandName, message.author.id)) return true;
    message.reply("❌ You don't have permission to use this command.").catch(() => {});
    return false;
}

// ─── Commands ───

const handlers = {};

handlers.ping = async (message) => {
    const sent = await message.reply('Pinging...');
    const rtt = sent.createdTimestamp - message.createdTimestamp;
    await sent.edit('**Pong!**\nWebSocket Heartbeat: `' + message.client.ws.ping + 'ms`\nRoundtrip Latency:   `' + rtt + 'ms`');
};

handlers.kick = async (message) => {
    // Permission already checked by dispatcher
    const userId = parseUserMention(message.args[0]);
    if (!userId) return message.reply('⚠️ Usage: `' + message.prefix + 'kick @user [reason]`');
    const reason = message.restArgs.slice(1).join(' ') || 'No reason provided';
    const guild = message.guild;
    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) return message.reply('⚠️ Could not find that user in this server.');
    if (!member.kickable) return message.reply('⚠️ I cannot kick that user.');
    if (!guild.members.me.permissions.has(PermissionFlagsBits.KickMembers)) return message.reply('⚠️ I need the **Kick Members** permission.');
    try {
        await member.kick(reason);
        const embed = new EmbedBuilder()
            .setColor(0xE74C3C).setTitle('👢 Member Kicked')
            .setDescription('<@' + userId + '> has been kicked.')
            .addFields({ name: 'Reason', value: reason }, { name: 'Moderator', value: message.author.tag })
            .setFooter({ text: guild.name, iconURL: guild.iconURL() }).setTimestamp();
        await message.reply({ embeds: [embed] });
    } catch (err) {
        message.reply('⚠️ Failed: ' + err.message);
    }
};

handlers.ban = async (message) => {
    // Permission already checked by dispatcher
    const userId = parseUserMention(message.args[0]);
    if (!userId) return message.reply('⚠️ Usage: `' + message.prefix + 'ban @user [reason]`');
    const reason = message.restArgs.slice(1).join(' ') || 'No reason provided';
    const guild = message.guild;
    if (!guild.members.me.permissions.has(PermissionFlagsBits.BanMembers)) return message.reply('⚠️ I need the **Ban Members** permission.');
    try {
        await guild.bans.create(userId, { reason });
        const embed = new EmbedBuilder()
            .setColor(0xE74C3C).setTitle('🔨 Member Banned')
            .setDescription('<@' + userId + '> has been banned.')
            .addFields({ name: 'Reason', value: reason }, { name: 'Moderator', value: message.author.tag })
            .setFooter({ text: guild.name, iconURL: guild.iconURL() }).setTimestamp();
        await message.reply({ embeds: [embed] });
    } catch (err) {
        message.reply('⚠️ Failed: ' + err.message);
    }
};

handlers.tempban = async (message) => {
    if (!checkOwnerOrPerm(message, 'tempban')) return;
    const userId = parseUserMention(message.args[0]);
    const durationStr = message.args[1];
    if (!userId || !durationStr) return message.reply('\u26A0\uFE0F Usage: `' + message.prefix + 'tempban @user <duration> [reason]`');
    const reason = message.restArgs.slice(2).join(' ') || 'No reason provided';
    const guild = message.guild;
    if (!guild.members.me.permissions.has(PermissionFlagsBits.BanMembers)) return message.reply('\u26A0\uFE0F I need **Ban Members** permission.');
    
    const durationMap = { '1h': 3600000, '6h': 21600000, '24h': 86400000, '3d': 259200000, '7d': 604800000, '14d': 1209600000, '30d': 2592000000 };
    const durationMs = parseDuration(durationStr) || durationMap[durationStr];
    if (!durationMs) return message.reply('\u26A0\uFE0F Invalid duration. Examples: 1h, 6h, 24h, 3d, 7d, 14d, 30d');
    
    try {
        const db = getDb();
        const unbanAt = Date.now() + durationMs;
        await guild.bans.create(userId, { reason: '[Temp Ban] ' + reason });
        db.prepare('INSERT INTO temp_bans (user_id, guild_id, reason, banned_at, unban_at) VALUES (?, ?, ?, ?, ?)')
            .run(userId, guild.id, reason, Date.now(), unbanAt);
        const embed = new EmbedBuilder()
            .setColor(0xE74C3C).setTitle('\uD83D\uDD28 Temp Banned')
            .setDescription('<@' + userId + '> was temp banned')
            .addFields({ name: 'Duration', value: formatDuration(durationMs), inline: true }, { name: 'Reason', value: reason, inline: true })
            .setFooter({ text: 'Auto-unban at <t:' + Math.floor(unbanAt / 1000) + ':R>' }).setTimestamp();
        message.reply({ embeds: [embed] });
    } catch (err) {
        message.reply('\u26A0\uFE0F Failed: ' + err.message);
    }
};

handlers.thresholds = async (message) => {
    if (!checkOwnerOrPerm(message, 'thresholds')) return;
    const sub = message.args[0];
    if (sub === 'add') {
        const warnCount = parseInt(message.args[1]);
        const action = message.args[2];
        const duration = parseInt(message.args[3]) || null;
        if (!warnCount || !['timeout', 'kick', 'ban'].includes(action)) return message.reply('\u26A0\uFE0F Usage: `' + message.prefix + 'thresholds add <warn_count> <timeout|kick|ban> [duration_min]`');
        addThreshold(message.guild.id, warnCount, action, duration);
        const embed = new EmbedBuilder()
            .setColor('Green').setTitle('\u26A0\uFE0F Threshold Added')
            .setDescription('**' + warnCount + '** warns \u2192 **' + action + '**' + (action === 'timeout' ? ' for ' + (duration || 10) + ' min' : ''))
            .setFooter({ text: message.guild.name }).setTimestamp();
        message.reply({ embeds: [embed] });
    } else if (sub === 'remove') {
        const warnCount = parseInt(message.args[1]);
        if (!warnCount) return message.reply('\u26A0\uFE0F Usage: `' + message.prefix + 'thresholds remove <warn_count>`');
        removeThreshold(message.guild.id, warnCount);
        message.reply('\u2705 Threshold for **' + warnCount + '** warns removed.');
    } else {
        const thresholds = getThresholds(message.guild.id);
        if (!thresholds.length) return message.reply('\uD83D\uDCCB No thresholds set. Use `' + message.prefix + 'thresholds add <count> <action>`');
        const lines = thresholds.map(t => '`' + t.warnCount + ' warns` \u2192 **' + t.action + '**' + (t.action === 'timeout' ? ' (' + (t.duration || 10) + ' min)' : '')).join('\n');
        message.reply('\uD83D\uDCCB **Warning Thresholds**\n' + lines);
    }
};

handlers.unban = async (message) => {
    // Permission already checked by dispatcher
    const userId = message.args[0];
    if (!userId) return message.reply('⚠️ Usage: `' + message.prefix + 'unban <user_id>`');
    const guild = message.guild;
    if (!guild.members.me.permissions.has(PermissionFlagsBits.BanMembers)) return message.reply('⚠️ I need the **Ban Members** permission.');
    try {
        await guild.bans.remove(userId);
        const embed = new EmbedBuilder()
            .setColor('Green').setTitle('🔓 Member Unbanned')
            .setDescription('User <@' + userId + '> has been unbanned.')
            .setFooter({ text: 'By ' + message.author.tag }).setTimestamp();
        await message.reply({ embeds: [embed] });
    } catch (err) {
        message.reply('⚠️ Failed: ' + err.message);
    }
};

handlers.timeout = async (message) => {
    // Permission already checked by dispatcher
    const userId = parseUserMention(message.args[0]);
    const durationStr = message.args[1];
    if (!userId || !durationStr) return message.reply('⚠️ Usage: `' + message.prefix + 'timeout @user <duration> [reason]`');
    const reason = message.restArgs.slice(2).join(' ') || 'No reason provided';
    const ms = parseDuration(durationStr);
    if (!ms) return message.reply('⚠️ Invalid duration. Examples: 60s, 5m, 1h, 1d');
    const guild = message.guild;
    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) return message.reply('⚠️ Could not find that user.');
    if (!guild.members.me.permissions.has(PermissionFlagsBits.ModerateMembers)) return message.reply('⚠️ I need **Moderate Members** permission.');
    try {
        await member.timeout(ms, reason);
        const embed = new EmbedBuilder()
            .setColor(0xF1C40F).setTitle('⏱️ Member Timed Out')
            .setDescription('<@' + userId + '> timed out.')
            .addFields({ name: 'Duration', value: formatDuration(ms), inline: true }, { name: 'Reason', value: reason, inline: true })
            .setFooter({ text: 'By ' + message.author.tag }).setTimestamp();
        await message.reply({ embeds: [embed] });
    } catch (err) {
        message.reply('⚠️ Failed: ' + err.message);
    }
};

handlers.untimeout = async (message) => {
    // Permission already checked by dispatcher
    const userId = parseUserMention(message.args[0]);
    if (!userId) return message.reply('⚠️ Usage: `' + message.prefix + 'untimeout @user`');
    const guild = message.guild;
    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) return message.reply('⚠️ Could not find that user.');
    if (!guild.members.me.permissions.has(PermissionFlagsBits.ModerateMembers)) return message.reply('⚠️ I need **Moderate Members** permission.');
    try {
        await member.timeout(null);
        const embed = new EmbedBuilder()
            .setColor('Green').setTitle('⏱️ Timeout Removed')
            .setDescription('<@' + userId + '> is no longer timed out.')
            .setFooter({ text: 'By ' + message.author.tag }).setTimestamp();
        await message.reply({ embeds: [embed] });
    } catch (err) {
        message.reply('⚠️ Failed: ' + err.message);
    }
};

handlers.warn = async (message) => {
    // Permission already checked by dispatcher
    const userId = parseUserMention(message.args[0]);
    if (!userId) return message.reply('⚠️ Usage: `' + message.prefix + 'warn @user [reason]`');
    const reason = message.restArgs.slice(1).join(' ') || 'No reason provided';
    const warnings = addWarning(message.guild.id, userId, message.author.tag, reason);
    const embed = new EmbedBuilder()
        .setColor(0xF1C40F).setTitle('⚠️ Warning Issued')
        .setDescription('<@' + userId + '> has been warned.')
        .addFields({ name: 'Reason', value: reason }, { name: 'Warning Count', value: String(warnings.length) }, { name: 'Moderator', value: message.author.tag })
        .setFooter({ text: message.guild.name, iconURL: message.guild.iconURL() }).setTimestamp();
    await message.reply({ embeds: [embed] });
    try {
        const user = await message.client.users.fetch(userId);
        await user.send('⚠️ You have been warned in **' + message.guild.name + '**.\nReason: ' + reason);
    } catch {}
};

handlers.warnings = async (message) => {
    // Permission already checked by dispatcher
    const userId = parseUserMention(message.args[0]);
    if (!userId) return message.reply('⚠️ Usage: `' + message.prefix + 'warnings @user`');
    const warnings = getWarnings(message.guild.id, userId);
    let targetUser;
    try { targetUser = await message.client.users.fetch(userId); } catch { targetUser = null; }
    const tag = targetUser ? targetUser.tag : userId;
    if (warnings.length === 0) {
        const embed = new EmbedBuilder()
            .setColor('Green').setTitle('✅ Clean Record')
            .setDescription(tag + ' has no warnings.')
            .setFooter({ text: message.guild.name }).setTimestamp();
        return message.reply({ embeds: [embed] });
    }
    const fields = warnings.map((w, i) => ({
        name: '#' + (i + 1) + ' \u2014 ' + new Date(w.date).toLocaleDateString(),
        value: 'Reason: ' + w.reason + '\nModerator: ' + w.moderator,
        inline: false,
    }));
    const embed = new EmbedBuilder()
        .setColor(0xF1C40F).setTitle('📝 Warnings for ' + tag)
        .setDescription('Total: **' + warnings.length + '** warning' + (warnings.length !== 1 ? 's' : ''))
        .addFields(fields).setFooter({ text: message.guild.name }).setTimestamp();
    await message.reply({ embeds: [embed] });
};

handlers.clearwarnings = async (message) => {
    // Permission already checked by dispatcher
    const userId = parseUserMention(message.args[0]);
    if (!userId) return message.reply('⚠️ Usage: `' + message.prefix + 'clearwarnings @user`');
    clearWarnings(message.guild.id, userId);
    const embed = new EmbedBuilder()
        .setColor('Green').setTitle('🗑️ Warnings Cleared')
        .setDescription('All warnings for <@' + userId + '> cleared.')
        .setFooter({ text: 'By ' + message.author.tag }).setTimestamp();
    await message.reply({ embeds: [embed] });
};

handlers.lock = async (message) => {
    // Permission already checked by dispatcher
    const channel = message.mentions.channels.first() || message.channel;
    if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) return message.reply('⚠️ I need **Manage Channels** permission.');
    try {
        await channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false });
        const embed = new EmbedBuilder()
            .setColor(0xE74C3C).setTitle('🔒 Channel Locked')
            .setDescription(channel + ' has been locked.')
            .setFooter({ text: 'By ' + message.author.tag }).setTimestamp();
        await message.reply({ embeds: [embed] });
    } catch (err) {
        message.reply('⚠️ Failed: ' + err.message);
    }
};

handlers.unlock = async (message) => {
    // Permission already checked by dispatcher
    const channel = message.mentions.channels.first() || message.channel;
    if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) return message.reply('⚠️ I need **Manage Channels** permission.');
    try {
        await channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: null });
        const embed = new EmbedBuilder()
            .setColor('Green').setTitle('🔓 Channel Unlocked')
            .setDescription(channel + ' has been unlocked.')
            .setFooter({ text: 'By ' + message.author.tag }).setTimestamp();
        await message.reply({ embeds: [embed] });
    } catch (err) {
        message.reply('⚠️ Failed: ' + err.message);
    }
};

handlers.purge = async (message) => {
    // Permission already checked by dispatcher
    const amount = parseInt(message.args[0]);
    if (!amount || amount < 1 || amount > 100) return message.reply('⚠️ Usage: `' + message.prefix + 'purge <amount>` (1-100)');
    if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageMessages)) return message.reply('⚠️ I need **Manage Messages** permission.');
    if (!message.channel.isTextBased?.()) return message.reply('⚠️ This only works in text channels.');
    try {
        const fetched = await message.channel.bulkDelete(amount, true);
        const embed = new EmbedBuilder()
            .setColor(0x5865F2).setTitle('🧹 Messages Purged')
            .setDescription('Deleted **' + fetched.size + '** message(s) in ' + message.channel)
            .setFooter({ text: 'By ' + message.author.tag }).setTimestamp();
        await message.reply({ embeds: [embed] });
    } catch (err) {
        message.reply('⚠️ Failed: ' + err.message);
    }
};

handlers.slowmode = async (message) => {
    // Permission already checked by dispatcher
    const seconds = parseInt(message.args[0]);
    if (isNaN(seconds)) return message.reply('⚠️ Usage: `' + message.prefix + 'slowmode <seconds>`');
    const channel = message.mentions.channels.first() || message.channel;
    if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) return message.reply('⚠️ I need **Manage Channels** permission.');
    try {
        await channel.setRateLimitPerUser(seconds);
        const embed = new EmbedBuilder()
            .setColor(seconds > 0 ? 0xF1C40F : 'Green').setTitle('⏳ Slowmode Updated')
            .setDescription('Slowmode in ' + channel + ' set to **' + seconds + '**s')
            .setFooter({ text: 'By ' + message.author.tag }).setTimestamp();
        await message.reply({ embeds: [embed] });
    } catch (err) {
        message.reply('⚠️ Failed: ' + err.message);
    }
};

handlers.say = async (message) => {
    // Permission already checked by dispatcher
    const channel = message.mentions.channels.first();
    if (!channel) return message.reply('⚠️ Usage: `' + message.prefix + 'say #channel <message>`');
    const text = message.restArgs.slice(1).join(' ');
    if (!text) return message.reply('⚠️ Provide a message to send.');
    try {
        await channel.send(text);
        message.reply('✅ Message sent to ' + channel);
    } catch (err) {
        message.reply('⚠️ Failed: ' + err.message);
    }
};

handlers.role = async (message) => {
    // Permission already checked by dispatcher
    const sub = message.args[0];
    if (!sub || !['add', 'remove', 'list'].includes(sub)) return message.reply('⚠️ Usage: `' + message.prefix + 'role add/remove @user @role` or `' + message.prefix + 'role list [@user]`');
    const guild = message.guild;
    if (!guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) return message.reply('⚠️ I need **Manage Roles** permission.');

    if (sub === 'list') {
        const targetUser = message.mentions.users.first() || message.author;
        const member = await guild.members.fetch(targetUser.id).catch(() => null);
        if (!member) return message.reply('⚠️ Could not find that user.');
        const roles = member.roles.cache.filter(r => r.id !== guild.id).sort((a, b) => b.position - a.position).map(r => r.toString());
        const embed = new EmbedBuilder()
            .setColor(member.displayHexColor || 0x5865F2)
            .setAuthor({ name: targetUser.tag, iconURL: targetUser.displayAvatarURL() })
            .setTitle('🏷️ ' + member.displayName + "'s Roles")
            .setDescription(roles.length > 0 ? roles.join('\n') : '*No roles*')
            .setFooter({ text: 'Total: ' + roles.length + ' role(s)' }).setTimestamp();
        return message.reply({ embeds: [embed] });
    }

    const userId = parseUserMention(message.args[1]);
    const roleId = parseRoleMention(message.args[2]);
    if (!userId || !roleId) return message.reply('⚠️ Usage: `' + message.prefix + 'role ' + sub + ' @user @role`');
    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) return message.reply('⚠️ User not found.');
    const role = guild.roles.cache.get(roleId);
    if (!role) return message.reply('⚠️ Role not found.');
    if (role.managed || role.id === guild.id) return message.reply('⚠️ Cannot manage that role.');
    if (guild.members.me.roles.highest.position <= role.position) return message.reply('⚠️ That role is higher than mine.');

    try {
        if (sub === 'add') {
            if (member.roles.cache.has(role.id)) return message.reply('⚠️ They already have that role.');
            await member.roles.add(role);
            const embed = new EmbedBuilder()
                .setColor('Green').setTitle('🏷️ Role Added')
                .setDescription('Added **' + role.name + '** to <@' + userId + '>')
                .setFooter({ text: 'By ' + message.author.tag }).setTimestamp();
            await message.reply({ embeds: [embed] });
        } else {
            if (!member.roles.cache.has(role.id)) return message.reply("⚠️ They don't have that role.");
            await member.roles.remove(role);
            const embed = new EmbedBuilder()
                .setColor('Red').setTitle('🏷️ Role Removed')
                .setDescription('Removed **' + role.name + '** from <@' + userId + '>')
                .setFooter({ text: 'By ' + message.author.tag }).setTimestamp();
            await message.reply({ embeds: [embed] });
        }
    } catch (err) {
        message.reply('⚠️ Failed: ' + err.message);
    }
};

handlers.userinfo = async (message) => {
    const targetUser = message.mentions.users.first() || message.author;
    const member = await message.guild.members.fetch(targetUser.id).catch(() => null);
    const client = message.client;
    const sharedServers = client.guilds.cache.filter(g => g.members.cache.has(targetUser.id)).size;
    const roles = member ? member.roles.cache.filter(r => r.id !== message.guild.id).sort((a, b) => b.position - a.position).map(r => r.toString()) : [];
    const embed = new EmbedBuilder()
        .setColor(member ? member.displayHexColor : 0x5865F2)
        .setAuthor({ name: targetUser.tag, iconURL: targetUser.displayAvatarURL() })
        .setTitle('👤 User Information')
        .setThumbnail(targetUser.displayAvatarURL({ size: 128 }))
        .addFields(
            { name: 'Username', value: targetUser.tag, inline: true },
            { name: 'ID', value: targetUser.id, inline: true },
            { name: 'Bot', value: targetUser.bot ? 'Yes' : 'No', inline: true },
            { name: 'Created', value: '<t:' + Math.floor(targetUser.createdTimestamp / 1000) + ':R>', inline: true },
            { name: 'Shared Servers', value: String(sharedServers), inline: true },
        );
    if (member) {
        embed.addFields({ name: 'Joined Server', value: '<t:' + Math.floor(member.joinedTimestamp / 1000) + ':R>', inline: true });
        if (roles.length > 0) embed.addFields({ name: 'Roles (' + roles.length + ')', value: truncate(roles.join(', '), 1024) });
    }
    embed.setFooter({ text: 'Requested by ' + message.author.tag }).setTimestamp();
    await message.reply({ embeds: [embed] });
};

handlers.avatar = async (message) => {
    const targetUser = message.mentions.users.first() || message.author;
    const embed = new EmbedBuilder()
        .setColor(0x5865F2).setAuthor({ name: targetUser.tag, iconURL: targetUser.displayAvatarURL() })
        .setTitle('📷 Avatar').setImage(targetUser.displayAvatarURL({ size: 1024, forceStatic: false }))
        .setFooter({ text: 'Requested by ' + message.author.tag }).setTimestamp();
    await message.reply({ embeds: [embed] });
};

handlers.botinfo = async (message) => {
    const client = message.client;
    const embed = new EmbedBuilder()
        .setColor(0x9B59B6)
        .setAuthor({ name: client.user.username, iconURL: client.user.displayAvatarURL() })
        .setTitle('ℹ️ Bot Information')
        .addFields(
            { name: 'Name', value: client.user.tag, inline: true },
            { name: 'ID', value: client.user.id, inline: true },
            { name: 'Created', value: '<t:' + Math.floor(client.user.createdTimestamp / 1000) + ':R>', inline: true },
            { name: 'Servers', value: String(client.guilds.cache.size), inline: true },
            { name: 'Owner', value: '<@' + process.env.OWNER_ID + '>', inline: true },
            { name: 'Tech Stack', value: 'Node.js ' + process.version },
        )
        .setFooter({ text: message.guild.name, iconURL: message.guild.iconURL() }).setTimestamp();
    await message.reply({ embeds: [embed] });
};

handlers.server = async (message) => {
    const guild = message.guild;
    const channels = guild.channels.cache;
    const bots = guild.members.cache.filter(m => m.user.bot).size;
    const humans = guild.members.cache.size - bots;
    const embed = new EmbedBuilder()
        .setColor(0x00BFFF).setAuthor({ name: guild.name, iconURL: guild.iconURL() })
        .setTitle('📊 Server Statistics').setThumbnail(guild.iconURL({ size: 128 }))
        .addFields(
            { name: '👥 Members', value: 'Total: **' + formatNumber(guild.memberCount) + '**\nHumans: **' + formatNumber(humans) + '**\nBots: **' + formatNumber(bots) + '**', inline: true },
            { name: '📺 Channels', value: 'Text: **' + channels.filter(c => c.type === 0).size + '**\nVoice: **' + channels.filter(c => c.type === 2).size + '**\nCategories: **' + channels.filter(c => c.type === 4).size + '**', inline: true },
            { name: '🚀 Boosts', value: 'Boost Count: **' + (guild.premiumSubscriptionCount || 0) + '**\nTier: **' + ({ 0: 'None', 1: 'Tier 1', 2: 'Tier 2', 3: 'Tier 3' })[guild.premiumTier] + '**', inline: true },
            { name: '📅 Created', value: '<t:' + Math.floor(guild.createdTimestamp / 1000) + ':R>', inline: true },
            { name: '🏷️ Roles', value: '**' + guild.roles.cache.size + '**', inline: true },
            { name: '👑 Owner', value: '<@' + guild.ownerId + '>', inline: true },
        )
        .setFooter({ text: 'Requested by ' + message.author.tag }).setTimestamp();
    await message.reply({ embeds: [embed] });
};

handlers.growth = async (message) => {
    const gStats = getGuildStats(message.guild.id);
    const netGrowth = gStats.totalJoins - gStats.totalLeaves;
    const snapshots = gStats.dailySnapshots || [];
    let recentJoins = 0, recentLeaves = 0;
    for (let i = snapshots.length - 1; i >= 0; i--) {
        if ((Date.now() - new Date(snapshots[i].date).getTime()) / 86400000 > 7) break;
        recentJoins += snapshots[i].joins;
        recentLeaves += snapshots[i].leaves;
    }
    const embed = new EmbedBuilder()
        .setColor(0x00BFFF).setAuthor({ name: message.guild.name, iconURL: message.guild.iconURL() })
        .setTitle('📈 Member Growth').setThumbnail(message.guild.iconURL({ size: 128 }))
        .addFields(
            { name: '📊 Lifetime Totals', value: 'Total Joins: **' + gStats.totalJoins + '**\nTotal Leaves: **' + gStats.totalLeaves + '**\nNet Growth: **' + (netGrowth >= 0 ? '+' : '') + netGrowth + '**', inline: false },
            { name: '📅 Last 7 Days', value: 'Joins: **' + recentJoins + '** | Leaves: **' + recentLeaves + '**\nTrend: **' + (recentJoins - recentLeaves >= 0 ? '+' : '') + (recentJoins - recentLeaves) + '**', inline: false },
        )
        .setFooter({ text: 'Requested by ' + message.author.tag }).setTimestamp();
    await message.reply({ embeds: [embed] });
};

handlers['8ball'] = async (message) => {
    const question = message.restArgs.join(' ');
    if (!question) return message.reply('⚠️ Usage: `' + message.prefix + '8ball <question>`');
    const answer = randomItem(BALL_RESPONSES);
    const embed = new EmbedBuilder()
        .setColor(0x9B59B6).setTitle('🎱 Magic 8-Ball')
        .addFields({ name: 'Question', value: question }, { name: 'Answer', value: '🎱 ' + answer })
        .setFooter({ text: 'Asked by ' + message.author.tag }).setTimestamp();
    await message.reply({ embeds: [embed] });
};

handlers.coinflip = async (message) => {
    const result = Math.random() < 0.5;
    const embed = new EmbedBuilder()
        .setColor(result ? 0xFFD700 : 0xC0C0C0).setTitle('🪙 Coin Flip')
        .setDescription((result ? '👮' : '👯') + ' **' + (result ? 'Heads' : 'Tails') + '!**')
        .setFooter({ text: 'Flipped by ' + message.author.tag }).setTimestamp();
    await message.reply({ embeds: [embed] });
};

handlers.dice = async (message) => {
    const sides = parseInt(message.args[0]) || 6;
    const result = randomInt(1, sides);
    const embed = new EmbedBuilder()
        .setColor(0xE67E22).setTitle((sides === 6 ? '🎲' : '🎰') + ' Dice Roll')
        .setDescription('**' + result + '** (1\u2013' + sides + ')')
        .setFooter({ text: 'Rolled by ' + message.author.tag }).setTimestamp();
    await message.reply({ embeds: [embed] });
};

handlers.rps = async (message) => {
    const choice = (message.args[0] || '').toLowerCase();
    if (!RPS_CHOICES.includes(choice)) return message.reply('⚠️ Pick: rock, paper, or scissors.');
    const botChoice = randomItem(RPS_CHOICES);
    let result, color;
    if (choice === botChoice) { result = "It's a **tie**!"; color = 0x95A5A6; }
    else if (RPS_WINNERS[choice] === botChoice) { result = 'You **win**!'; color = 0x2ECC71; }
    else { result = 'You **lose**!'; color = 0xE74C3C; }
    const embed = new EmbedBuilder()
        .setColor(color).setTitle('💣 Rock Paper Scissors')
        .setDescription(RPS_EMOJIS[choice] + ' You chose **' + choice + '**\n' + RPS_EMOJIS[botChoice] + ' I chose **' + botChoice + '**\n\n**' + result + '**')
        .setFooter({ text: 'Played by ' + message.author.tag }).setTimestamp();
    await message.reply({ embeds: [embed] });
};

handlers.joke = async (message) => {
    const embed = new EmbedBuilder()
        .setColor(0xF1C40F).setTitle('😆 Joke')
        .setDescription(randomItem(JOKES))
        .setFooter({ text: message.author.tag }).setTimestamp();
    await message.reply({ embeds: [embed] });
};

handlers.fact = async (message) => {
    const embed = new EmbedBuilder()
        .setColor(0x3498DB).setTitle('💡 Did You Know?')
        .setDescription(randomItem(FACTS))
        .setFooter({ text: message.author.tag }).setTimestamp();
    await message.reply({ embeds: [embed] });
};

handlers.advice = async (message) => {
    const embed = new EmbedBuilder()
        .setColor(0x1ABC9C).setTitle('📝 Advice')
        .setDescription('*"' + randomItem(ADVICE) + '"*')
        .setFooter({ text: message.author.tag }).setTimestamp();
    await message.reply({ embeds: [embed] });
};

handlers.quote = async (message) => {
    const q = randomItem(QUOTES);
    const embed = new EmbedBuilder()
        .setColor(0x9B59B6).setTitle('📖 Quote')
        .setDescription('*"' + q.text + '"*\n\u2014 **' + q.author + '**')
        .setFooter({ text: message.author.tag }).setTimestamp();
    await message.reply({ embeds: [embed] });
};

handlers.reverse = async (message) => {
    const text = message.restArgs.join(' ');
    if (!text) return message.reply('⚠️ Usage: `' + message.prefix + 'reverse <text>`');
    const embed = new EmbedBuilder()
        .setColor(0x5865F2).setTitle('🔄 Reversed Text')
        .setDescription('```\n' + reverseText(text).slice(0, 2000) + '\n```')
        .setFooter({ text: message.author.tag }).setTimestamp();
    await message.reply({ embeds: [embed] });
};

handlers.mock = async (message) => {
    const text = message.restArgs.join(' ');
    if (!text) return message.reply('⚠️ Usage: `' + message.prefix + 'mock <text>`');
    const embed = new EmbedBuilder()
        .setColor(0xE67E22).setTitle('😡 Mocking SpongeBob')
        .setDescription('```\n' + mockText(text).slice(0, 2000) + '\n```')
        .setFooter({ text: message.author.tag }).setTimestamp();
    await message.reply({ embeds: [embed] });
};

handlers.random = async (message) => {
    const min = parseInt(message.args[0]);
    const max = parseInt(message.args[1]);
    if (isNaN(min) || isNaN(max) || min >= max) return message.reply('⚠️ Usage: `' + message.prefix + 'random <min> <max>`');
    const result = randomInt(min, max);
    const embed = new EmbedBuilder()
        .setColor(0x5865F2).setTitle('🎲 Random Number')
        .setDescription('**' + result + '** (' + min + '\u2013' + max + ')')
        .setFooter({ text: 'Generated for ' + message.author.tag }).setTimestamp();
    await message.reply({ embeds: [embed] });
};

handlers.worldcup = async (message) => {
    const team1 = message.args[0];
    const team2 = message.args[1];
    if (!team1 || !team2) return message.reply('⚠️ Usage: `' + message.prefix + 'worldcup <team1> <team2>`');
    const flag1 = getFlag(team1), flag2 = getFlag(team2);
    const score1 = randomInt(0, 5), score2 = randomInt(0, 5);
    const outcome = randomItem(WC_OUTCOMES);
    const embed = new EmbedBuilder()
        .setColor(0x00FF87).setTitle('⚽ World Cup Match Prediction')
        .setDescription(flag1 + ' **' + team1 + '** vs **' + team2 + '** ' + flag2 + '\n\n**Predicted Score**\n# ' + flag1 + ' ' + score1 + ' - ' + score2 + ' ' + flag2 + '\n\n_"' + outcome + '"_')
        .setFooter({ text: 'Predicted by ' + message.author.tag }).setTimestamp();
    await message.reply({ embeds: [embed] });
};

handlers.remindme = async (message) => {
    const timeStr = message.args[0];
    const text = message.restArgs.slice(1).join(' ');
    if (!timeStr || !text) return message.reply('⚠️ Usage: `' + message.prefix + 'remindme <time> <text>` (e.g. `' + message.prefix + 'remindme 30s do the thing`)');
    const ms = parseDuration(timeStr);
    if (!ms) return message.reply('⚠️ Invalid time. Examples: 30s, 5m, 2h, 1d');
    const reminder = addReminder(message.author.id, message.channel.id, text, ms);
    const embed = new EmbedBuilder()
        .setColor(0x5865F2).setTitle('⏰ Reminder Set')
        .setDescription("I'll remind you in **" + formatDuration(ms) + '**')
        .addFields({ name: 'Text', value: text })
        .setFooter({ text: 'ID: ' + reminder.id }).setTimestamp();
    await message.reply({ embeds: [embed] });
};

handlers.prefix = async (message) => {
    // Permission already checked by dispatcher
    const newPrefix = message.args[0];
    if (!newPrefix) {
        return message.reply('Current prefix is: `' + message.prefix + '`\nTo change: `' + message.prefix + 'prefix <newprefix>`');
    }
    if (newPrefix.length > 5) return message.reply('⚠️ Prefix must be 5 characters or less.');
    updateGuildConfig(message.guild.id, (cfg) => { cfg.prefix = newPrefix; return cfg; });
    const embed = new EmbedBuilder()
        .setColor('Green').setTitle('✅ Prefix Updated')
        .setDescription('Command prefix changed to `' + newPrefix + '`')
        .setFooter({ text: 'Changed by ' + message.author.tag }).setTimestamp();
    await message.reply({ embeds: [embed] });
};

handlers.status = async (message) => {
    const client = message.client;
    const guild = message.guild;
    const mem = process.memoryUsage();
    const uptime = formatUptime(client.uptime);
    const guildCount = client.guilds.cache.size;
    const userCount = client.guilds.cache.reduce((a, g) => a + g.memberCount, 0);
    const embed = new EmbedBuilder()
        .setColor(0x5865F2).setTitle('📊 Bot Status').setThumbnail(client.user.displayAvatarURL())
        .addFields(
            { name: 'Connection', value: WS_STATUS[client.ws.status] || 'Unknown', inline: true },
            { name: 'Ping', value: client.ws.ping + 'ms', inline: true },
            { name: 'Uptime', value: uptime, inline: true },
            { name: 'Servers', value: String(guildCount), inline: true },
            { name: 'Users', value: formatNumber(userCount), inline: true },
            { name: 'Memory (RSS)', value: (mem.rss / 1024 / 1024).toFixed(1) + ' MB', inline: true },
            { name: 'Platform', value: os.platform(), inline: true },
            { name: 'Node.js', value: process.version, inline: true },
        )
        .setFooter({ text: guild.name, iconURL: guild.iconURL() }).setTimestamp();
    await message.reply({ embeds: [embed] });
};

handlers.nickname = async (message) => {
    // Permission already checked by dispatcher
    const userId = parseUserMention(message.args[0]);
    if (!userId) return message.reply('⚠️ Usage: `' + message.prefix + 'nickname @user <name>` or `' + message.prefix + 'nickname @user reset`');
    const nickname = message.restArgs.slice(1).join(' ');
    if (!nickname) return message.reply('⚠️ Provide a name or "reset" to clear.');
    const guild = message.guild;
    if (!guild.members.me.permissions.has(PermissionFlagsBits.ManageNicknames)) return message.reply('⚠️ I need **Manage Nicknames** permission.');
    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) return message.reply('⚠️ User not found.');
    try {
        const newNick = nickname.toLowerCase() === 'reset' ? null : nickname;
        await member.setNickname(newNick);
        const embed = new EmbedBuilder()
            .setColor('Green').setTitle('📝 Nickname Changed')
            .setDescription('<@' + userId + '>\'s nickname is now **' + (newNick || '*none*') + '**')
            .setFooter({ text: 'By ' + message.author.tag }).setTimestamp();
        await message.reply({ embeds: [embed] });
    } catch (err) {
        message.reply('⚠️ Failed: ' + err.message);
    }
};

handlers.embed = async (message) => {
    // Permission already checked by dispatcher
    const channel = message.mentions.channels.first();
    if (!channel) return message.reply('⚠️ Usage: `' + message.prefix + 'embed #channel <title> | <description> | #color`');
    const parts = message.restArgs.slice(1).join(' ').split('|').map(s => s.trim());
    const title = parts[0] || 'No title';
    const description = parts[1] || '';
    let color = 0x5865F2;
    if (parts[2]) {
        try { color = parseInt(parts[2].replace('#', ''), 16); } catch {}
    }
    try {
        const embed = new EmbedBuilder()
            .setColor(color).setTitle(title).setDescription(description)
            .setFooter({ text: 'Sent by ' + message.author.tag }).setTimestamp();
        await channel.send({ embeds: [embed] });
        message.reply('✅ Embed sent to ' + channel);
    } catch (err) {
        message.reply('⚠️ Failed: ' + err.message);
    }
};

handlers.announce = async (message) => {
    // Permission already checked by dispatcher
    const channel = message.mentions.channels.first();
    if (!channel) return message.reply('⚠️ Usage: `' + message.prefix + 'announce #channel <title> | <message> | #color`');
    const parts = message.restArgs.slice(1).join(' ').split('|').map(s => s.trim());
    const title = parts[0] || 'Announcement';
    const msg = parts[1] || '';
    let color = 0x5865F2;
    if (parts[2]) {
        try { color = parseInt(parts[2].replace('#', ''), 16); } catch {}
    }
    try {
        const embed = new EmbedBuilder()
            .setColor(color).setTitle(title).setDescription(msg)
            .setAuthor({ name: message.guild.name, iconURL: message.guild.iconURL() })
            .setFooter({ text: 'Announcement by ' + message.author.tag }).setTimestamp();
        await channel.send({ embeds: [embed] });
        message.reply('✅ Announcement sent to ' + channel);
    } catch (err) {
        message.reply('⚠️ Failed: ' + err.message);
    }
};

handlers.poll = async (message) => {
    // Permission already checked by dispatcher
    const args = message.restArgs;
    const question = args[0];
    const opts = args.slice(1);
    if (!question || opts.length < 2) return message.reply('⚠️ Usage: `' + message.prefix + 'poll <question> | <opt1> | <opt2> [| opt3] [| opt4]`');
    const options = opts.map(o => o.trim());
    const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
    const fields = options.slice(0, 10).map((opt, i) => ({
        name: emojis[i] + ' ' + opt,
        value: 'Vote with ' + emojis[i],
        inline: true,
    }));
    const embed = new EmbedBuilder()
        .setColor(0x5865F2).setTitle('🗳️ Poll: ' + question).addFields(fields)
        .setFooter({ text: 'Poll by ' + message.author.tag }).setTimestamp();
    try {
        const pollMessage = await message.reply({ embeds: [embed], fetchReply: true });
        for (let i = 0; i < options.length && i < 10; i++) {
            await pollMessage.react(emojis[i]).catch(() => {});
        }
    } catch (err) {
        message.reply('⚠️ Failed: ' + err.message);
    }
};

handlers.reminders = async (message) => {
    const sub = message.args[0];
    if (sub === 'list') {
        const userReminders = getUserReminders(message.author.id);
        if (!userReminders.length) return message.reply('⏰ You have no pending reminders.');
        const list = userReminders.map(r => {
            const t = r.remindAt - Date.now();
            const m = Math.floor(t / 60000);
            const s = Math.floor((t % 60000) / 1000);
            return '`' + r.id.slice(0, 8) + '` \u2014 ' + r.text + ' (due ' + (t > 0 ? (m > 0 ? m + 'm ' : '') + s + 's' : 'now') + ')';
        }).join('\n');
        const embed = new EmbedBuilder()
            .setColor(0x5865F2).setTitle('⏰ Your Reminders (' + userReminders.length + ')')
            .setDescription(list)
            .setFooter({ text: message.author.tag }).setTimestamp();
        await message.reply({ embeds: [embed] });
    } else if (sub === 'cancel') {
        const id = message.args[1];
        if (!id) return message.reply('⚠️ Usage: `' + message.prefix + 'reminders cancel <id>`');
        const fullId = getUserReminders(message.author.id).find(r => r.id.startsWith(id))?.id;
        if (!fullId) return message.reply('⚠️ Reminder not found. Use `' + message.prefix + 'reminders list` to find the ID.');
        if (removeReminder(fullId, message.author.id)) {
            message.reply('✅ Reminder cancelled.');
        } else {
            message.reply('⚠️ Could not cancel that reminder.');
        }
    } else {
        message.reply('⚠️ Usage: `' + message.prefix + 'reminders list` or `' + message.prefix + 'reminders cancel <id>`');
    }
};

// ─── Permissions ───

handlers.perm = async (message) => {
    // Permission already checked by dispatcher
    const sub = message.args[0];
    if (!sub || !['grant', 'revoke', 'list', 'user'].includes(sub)) {
        return message.reply('⚠️ Usage: `' + message.prefix + 'perm grant @user <cmd>`, `' + message.prefix + 'perm revoke @user <cmd>`, `' + message.prefix + 'perm list`, `' + message.prefix + 'perm user @user`');
    }
    const guild = message.guild;

    if (sub === 'grant') {
        const user = message.mentions.users.first();
        const command = message.args[2];
        if (!user || !command) return message.reply('⚠️ Usage: `' + message.prefix + 'perm grant @user <command|all>`');
        if (isOwner(user.id)) return message.reply('⚠️ The owner already has access to everything.');
        const ownerOnly = ['deploy', 'botavatar', 'botname', 'presence', 'embedconfig', 'shutdown', 'perm'];
        if (ownerOnly.includes(command)) return message.reply('⚠️ That command is owner-only and cannot be granted.');
        const grantableCmds = ['role', 'purge', 'slowmode', 'nickname', 'kick', 'ban', 'tempban', 'unban', 'timeout', 'untimeout', 'warn', 'warnings', 'clearwarnings', 'lock', 'unlock', 'say', 'embed', 'userinfo', 'avatar', 'track', 'log', 'poll', 'announce', 'reactionrole', 'prefix', 'stats', 'server', 'growth', 'invites', 'note', 'logs', 'thresholds'];
        if (command === 'all') {
            for (const cmd of grantableCmds) grantPermission(guild.id, cmd, user.id);
            return message.reply('✅ Granted **all** commands to ' + user);
        }
        if (!grantableCmds.includes(command)) return message.reply('⚠️ Unknown command. Use `all` or one of the available commands.');
        grantPermission(guild.id, command, user.id);
        const embed = new EmbedBuilder()
            .setColor('Green').setTitle('🔑 Permission Granted')
            .setDescription(user + ' can now use `' + command + '`')
            .setFooter({ text: 'Granted by ' + message.author.tag }).setTimestamp();
        await message.reply({ embeds: [embed] });
    } else if (sub === 'revoke') {
        const user = message.mentions.users.first();
        const command = message.args[2];
        if (!user || !command) return message.reply('⚠️ Usage: `' + message.prefix + 'perm revoke @user <command|all>`');
        const grantableCmds = ['role', 'purge', 'slowmode', 'nickname', 'kick', 'ban', 'tempban', 'unban', 'timeout', 'untimeout', 'warn', 'warnings', 'clearwarnings', 'lock', 'unlock', 'say', 'embed', 'userinfo', 'avatar', 'track', 'log', 'poll', 'announce', 'reactionrole', 'prefix', 'stats', 'server', 'growth', 'welcome', 'goodbye', 'invites', 'note', 'logs', 'thresholds'];
        if (command === 'all') {
            for (const cmd of grantableCmds) revokePermission(guild.id, cmd, user.id);
            return message.reply('✅ Revoked **all** permissions from ' + user);
        }
        revokePermission(guild.id, command, user.id);
        const embed = new EmbedBuilder()
            .setColor('Red').setTitle('🔑 Permission Revoked')
            .setDescription(user + ' can no longer use `' + command + '`')
            .setFooter({ text: 'Revoked by ' + message.author.tag }).setTimestamp();
        await message.reply({ embeds: [embed] });
    } else if (sub === 'list') {
        const allPerms = getAllPermissions(guild.id);
        const entries = Object.entries(allPerms);
        if (!entries.length) return message.reply('🔑 No special permissions granted.');
        const fields = entries.map(([cmd, userIds]) => '`' + cmd + '` → ' + userIds.map(id => '<@' + id + '>').join(', '));
        const embed = new EmbedBuilder()
            .setColor(0x5865F2).setTitle('🔑 Granted Permissions')
            .setDescription(fields.join('\n'))
            .setFooter({ text: guild.name }).setTimestamp();
        await message.reply({ embeds: [embed] });
    } else if (sub === 'user') {
        const user = message.mentions.users.first();
        if (!user) return message.reply('⚠️ Usage: `' + message.prefix + 'perm user @user`');
        const allPerms = getAllPermissions(guild.id);
        const granted = Object.entries(allPerms).filter(([, ids]) => ids.includes(user.id)).map(([cmd]) => '`' + cmd + '`');
        const embed = new EmbedBuilder()
            .setColor(0x5865F2).setTitle('🔑 Permissions for ' + user.tag)
            .setDescription(granted.length ? user + ' can use:\n' + granted.join('\n') : user + ' has no special permissions.')
            .setFooter({ text: guild.name }).setTimestamp();
        await message.reply({ embeds: [embed] });
    }
};

// ─── Track Channels ───

handlers.track = async (message) => {
    // Permission already checked by dispatcher
    const sub = message.args[0];
    if (!sub || !['add', 'remove', 'list'].includes(sub)) return message.reply('⚠️ Usage: `' + message.prefix + 'track add #channel`, `' + message.prefix + 'track remove #channel`, `' + message.prefix + 'track list`');
    if (sub === 'list') {
        const existing = updateGuildConfig(message.guild.id, (g) => g);
        const tracked = existing.trackedChannels || [];
        if (!tracked.length) return message.reply('📡 Tracking **all channels**. Use `' + message.prefix + 'track add #channel` to restrict.');
        const list = tracked.map(id => '<#' + id + '>').join('\n');
        const embed = new EmbedBuilder()
            .setColor(0x5865F2).setTitle('📡 Tracked Channels (' + tracked.length + ')')
            .setDescription(list).setFooter({ text: message.guild.name }).setTimestamp();
        await message.reply({ embeds: [embed] });
        return;
    }
    const channel = message.mentions.channels.first();
    if (!channel) return message.reply('⚠️ Usage: `' + message.prefix + 'track add/remove #channel`');
    updateGuildConfig(message.guild.id, (cfg) => {
        if (!cfg.trackedChannels) cfg.trackedChannels = [];
        if (sub === 'add') {
            if (!cfg.trackedChannels.includes(channel.id)) cfg.trackedChannels.push(channel.id);
        } else {
            cfg.trackedChannels = cfg.trackedChannels.filter(id => id !== channel.id);
        }
        return cfg;
    });
    const embed = new EmbedBuilder()
        .setColor(sub === 'add' ? 'Green' : 'Red').setTitle('📡 Channel ' + (sub === 'add' ? 'Added' : 'Removed'))
        .setDescription(channel + ' is ' + (sub === 'add' ? 'now' : 'no longer') + ' being tracked.')
        .setFooter({ text: 'By ' + message.author.tag }).setTimestamp();
    await message.reply({ embeds: [embed] });
};

// ─── Logging Config ───

handlers.log = async (message) => {
    // Permission already checked by dispatcher
    const sub = message.args[0];
    if (!sub || !['channel', 'toggle', 'list'].includes(sub)) return message.reply('⚠️ Usage: `' + message.prefix + 'log channel <category> [#channel]`, `' + message.prefix + 'log toggle <category> on/off`, `' + message.prefix + 'log list`');
    const guild = message.guild;
    const cats = ['messages', 'reactions', 'members', 'roles', 'server', 'voice', 'threads', 'emojis', 'bans', 'invites', 'stickers', 'automod', 'scheduled', 'stage', 'webhooks', 'integrations'];

    if (sub === 'list') {
        const cfg = updateGuildConfig(guild.id, (g) => g);
        const lines = cats.map(c => {
            const enabled = cfg.logCategories?.[c] !== false;
            const ch = cfg.logChannels?.[c] ? '<#' + cfg.logChannels[c] + '>' : '*default*';
            return (enabled ? '✅' : '❌') + ' **' + c + '** → ' + ch;
        });
        const embed = new EmbedBuilder()
            .setColor(0x5865F2).setTitle('🔍 Logging Configuration')
            .setDescription(lines.join('\n')).setFooter({ text: guild.name }).setTimestamp();
        await message.reply({ embeds: [embed] });
        return;
    }

    const category = message.args[1];
    if (!category || !cats.includes(category)) return message.reply('⚠️ Invalid category. Options: ' + cats.join(', '));

    if (sub === 'channel') {
        const channel = message.mentions.channels.first();
        updateGuildConfig(guild.id, (cfg) => {
            if (!cfg.logChannels) cfg.logChannels = {};
            cfg.logChannels[category] = channel ? channel.id : null;
            return cfg;
        });
        const embed = new EmbedBuilder()
            .setColor(channel ? 'Green' : 'Red').setTitle('📋 Log Channel: ' + category)
            .setDescription(channel ? '**' + category + '** logs → ' + channel : '**' + category + '** log channel cleared')
            .setFooter({ text: 'By ' + message.author.tag }).setTimestamp();
        await message.reply({ embeds: [embed] });
    } else if (sub === 'toggle') {
        const enabled = message.args[2] !== 'off';
        updateGuildConfig(guild.id, (cfg) => {
            if (!cfg.logCategories) cfg.logCategories = {};
            cfg.logCategories[category] = enabled;
            return cfg;
        });
        const embed = new EmbedBuilder()
            .setColor(enabled ? 'Green' : 'Red').setTitle('🔍 Log Toggle: ' + category)
            .setDescription('**' + category + '** logs ' + (enabled ? '✅ enabled' : '❌ disabled'))
            .setFooter({ text: 'By ' + message.author.tag }).setTimestamp();
        await message.reply({ embeds: [embed] });
    }
};

// ─── Reaction Roles ───

handlers.reactionrole = async (message) => {
    // Permission already checked by dispatcher
    const sub = message.args[0];
    if (!sub || !['add', 'remove', 'list'].includes(sub)) return message.reply('⚠️ Usage: `' + message.prefix + 'reactionrole add #channel @role <emoji>`, `' + message.prefix + 'reactionrole remove <message_id>`, `' + message.prefix + 'reactionrole list`');
    const guild = message.guild;
    if (!guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) return message.reply('⚠️ I need **Manage Roles** permission.');

    if (sub === 'list') {
        const roles = getReactionRoles(guild.id);
        if (!roles.length) return message.reply('🏷️ No reaction roles configured.');
        const grouped = {};
        for (const rr of roles) {
            if (!grouped[rr.messageId]) grouped[rr.messageId] = { channelId: rr.channelId, roles: [] };
            grouped[rr.messageId].roles.push(rr);
        }
        const fields = Object.entries(grouped).map(([msgId, data]) => ({
            name: 'Message: ' + msgId,
            value: data.roles.map(r => r.emoji + ' → <@&' + r.roleId + '>' + (r.label ? ' (' + r.label + ')' : '')).join('\n') + '\n[Jump](https://discord.com/channels/' + guild.id + '/' + data.channelId + '/' + msgId + ')',
        }));
        const embed = new EmbedBuilder()
            .setColor(0x5865F2).setTitle('🏷️ Reaction Roles (' + roles.length + ')')
            .addFields(fields).setFooter({ text: guild.name }).setTimestamp();
        await message.reply({ embeds: [embed] });
        return;
    }

    if (sub === 'remove') {
        const msgId = message.args[1];
        if (!msgId) return message.reply('⚠️ Usage: `' + message.prefix + 'reactionrole remove <message_id>`');
        const count = removeAllForMessage(guild.id, msgId);
        if (!count) return message.reply('⚠️ No reaction roles for that message ID.');
        return message.reply('🗑️ Removed **' + count + '** reaction role(s).');
    }

    if (sub === 'add') {
        const channel = message.mentions.channels.first();
        const role = message.mentions.roles.first();
        const emojiRaw = message.args[3];
        if (!channel || !role || !emojiRaw) return message.reply('⚠️ Usage: `' + message.prefix + 'reactionrole add #channel @role <emoji> [label]`');
        if (!channel.isTextBased?.()) return message.reply('⚠️ Please select a text channel.');
        if (role.managed || role.id === guild.id) return message.reply('⚠️ Cannot manage that role.');
        if (guild.members.me.roles.highest.position <= role.position) return message.reply('⚠️ That role is higher than mine.');
        const label = message.restArgs.slice(4).join(' ');
        try {
            const embed = new EmbedBuilder()
                .setColor(role.hexColor || 0x5865F2).setTitle('🏷️ Reaction Role' + (label ? ': ' + label : ''))
                .setDescription('React with ' + emojiRaw + ' to get the **' + role.name + '** role!')
                .addFields({ name: 'Role', value: role.toString(), inline: true }, { name: 'Reaction', value: emojiRaw, inline: true })
                .setFooter({ text: guild.name }).setTimestamp();
            const roleMessage = await channel.send({ embeds: [embed] });
            await roleMessage.react(emojiRaw);
            const normalized = emojiRaw.match(/<a?:(\w+):(\d+)>/) ? emojiRaw.match(/<a?:(\w+):(\d+)>/)[1] + ':' + emojiRaw.match(/<a?:(\w+):(\d+)>/)[2] : emojiRaw;
            addReactionRole(guild.id, roleMessage.id, channel.id, normalized, role.id, label || null);
            message.reply('✅ Reaction role set up! ' + roleMessage.url);
        } catch (err) {
            message.reply('⚠️ Failed: ' + err.message);
        }
    }
};

// ─── Bot Customization ───

handlers.deploy = async (message) => {
    // Permission already checked by dispatcher
    await message.reply('🔄 Re-registering commands...');
    try {
        const { deployCommands } = require('./deploy');
        const success = await deployCommands(message.client.user);
        if (success === true) {
            message.reply('✅ Commands re-registered!');
        } else {
            message.reply('❌ Deploy failed: ' + (success || 'Unknown error'));
        }
    } catch (err) {
        message.reply('❌ Error: ' + err.message);
    }
};

handlers.botavatar = async (message) => {
    // Permission already checked by dispatcher
    const url = message.args[0];
    if (!url) return message.reply('⚠️ Usage: `' + message.prefix + 'botavatar <image_url>`');
    await message.reply('🔄 Changing avatar...');
    try {
        await message.client.user.setAvatar(url);
        message.reply('✅ Avatar changed!');
    } catch (err) {
        message.reply('⚠️ Failed: ' + err.message);
    }
};

handlers.botname = async (message) => {
    // Permission already checked by dispatcher
    const name = message.restArgs.join(' ');
    if (!name) return message.reply('⚠️ Usage: `' + message.prefix + 'botname <new_name>`');
    await message.reply('🔄 Changing name...');
    try {
        await message.client.user.setUsername(name);
        message.reply('✅ Name changed to **' + name + '**!');
    } catch (err) {
        message.reply('⚠️ Failed: ' + err.message + ' (Discord limits name changes to 2/hour)');
    }
};

// ─── Invites ───

handlers.invites = async (message) => {
    const sub = message.args[0];
    if (!sub || !['check', 'top', 'stats'].includes(sub)) {
        return message.reply('⚠️ Usage: `' + message.prefix + 'invites check [@user]`, `' + message.prefix + 'invites top [limit]`, `' + message.prefix + 'invites stats`');
    }

    if (sub === 'check') {
        const user = message.mentions.users.first() || message.author;
        const stats = getInviterStats(message.guild.id, user.id);
        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setAuthor({ name: user.tag, iconURL: user.displayAvatarURL() })
            .setTitle('📨 Invite Stats')
            .setDescription(user.id === message.author.id
                ? 'You have invited **' + stats.total + '** member' + (stats.total !== 1 ? 's' : '')
                : user + ' has invited **' + stats.total + '** member' + (stats.total !== 1 ? 's' : ''))
            .setFooter({ text: message.guild.name, iconURL: message.guild.iconURL() })
            .setTimestamp();
        if (stats.joiners.length > 0) {
            const recent = stats.joiners.slice(0, 10).map(j =>
                '<@' + j.joiner_id + '> — <t:' + Math.floor(j.joined_at / 1000) + ':R>'
            ).join('\n');
            embed.addFields({ name: 'Recent Invites', value: recent });
        }
        await message.reply({ embeds: [embed] });

    } else if (sub === 'top') {
        const limit = parseInt(message.args[1]) || 10;
        const top = getTopInviters(message.guild.id, Math.min(limit, 25));
        if (!top.length) return message.reply('📋 No invite data yet.');
        const maxCount = top[0].count;
        const lines = top.map((r, i) => {
            const barLen = Math.round((r.count / maxCount) * 20);
            const bar = '▰'.repeat(barLen) + '▱'.repeat(Math.max(0, 20 - barLen));
            return '`#' + (i + 1) + '` <@' + r.inviter_id + '> ' + bar + ' **' + r.count + '**';
        }).join('\n');
        const embed = new EmbedBuilder()
            .setColor(0x5865F2).setTitle('🏆 Top Inviters').setDescription(lines)
            .setFooter({ text: message.guild.name, iconURL: message.guild.iconURL() }).setTimestamp();
        await message.reply({ embeds: [embed] });

    } else if (sub === 'stats') {
        const top = getGuildInviteStats(message.guild.id);
        const totalInvites = top.reduce((a, r) => a + r.count, 0);
        const embed = new EmbedBuilder()
            .setColor(0x00BFFF).setAuthor({ name: message.guild.name, iconURL: message.guild.iconURL() })
            .setTitle('📊 Server Invite Stats')
            .setDescription('**' + totalInvites + '** total invite' + (totalInvites !== 1 ? 's' : '') + ' tracked')
            .addFields(
                { name: 'Unique Inviters', value: '**' + top.length + '**', inline: true },
                { name: 'Avg per Inviter', value: top.length > 0 ? '**' + (totalInvites / top.length).toFixed(1) + '**' : '**0**', inline: true },
            )
            .setFooter({ text: message.guild.name, iconURL: message.guild.iconURL() }).setTimestamp();
        await message.reply({ embeds: [embed] });
    }
};

// ─── Staff Notes ───

handlers.note = async (message) => {
    const sub = message.args[0];
    if (!sub || !['add', 'list', 'edit', 'remove'].includes(sub)) {
        return message.reply('⚠️ Usage: `' + message.prefix + 'note add @user <text>`, `' + message.prefix + 'note list @user`, `' + message.prefix + 'note edit <id> <text>`, `' + message.prefix + 'note remove <id>`');
    }

    if (sub === 'add') {
        const user = message.mentions.users.first();
        const text = message.restArgs.slice(2).join(' ');
        if (!user || !text) return message.reply('⚠️ Usage: `' + message.prefix + 'note add @user <note text>`');
        const result = addNote(message.guild.id, user.id, message.author.id, message.author.tag, text);
        const count = getNoteCount(message.guild.id, user.id);
        const embed = new EmbedBuilder()
            .setColor(0x5865F2).setTitle('📝 Staff Note Added')
            .setDescription('Note added for ' + user.toString())
            .addFields({ name: 'Note', value: text }, { name: 'Note Count', value: String(count), inline: true }, { name: 'Note ID', value: '`' + result.id + '`', inline: true })
            .setFooter({ text: 'By ' + message.author.tag }).setTimestamp();
        await message.reply({ embeds: [embed] });

    } else if (sub === 'list') {
        const user = message.mentions.users.first();
        if (!user) return message.reply('⚠️ Usage: `' + message.prefix + 'note list @user`');
        const notes = getNotesForUser(message.guild.id, user.id);
        if (!notes.length) return message.reply('📋 No staff notes for ' + user.toString() + '.');
        const lines = notes.map(n =>
            '**`' + n.id.slice(0, 8) + '...`** — ' + n.author_tag + ' • <t:' + Math.floor(n.created_at / 1000) + ':R>\n' +
            '> ' + n.note.slice(0, 200) +
            (n.updated_at ? '\n> *(edited <t:' + Math.floor(n.updated_at / 1000) + ':R>)*' : '')
        ).join('\n\n');
        const embed = new EmbedBuilder()
            .setColor(0x5865F2).setTitle('📋 Staff Notes — ' + user.tag).setDescription(lines.slice(0, 4096))
            .setFooter({ text: notes.length + ' note' + (notes.length !== 1 ? 's' : '') + ' • Use ' + message.prefix + 'note remove <id> to delete' }).setTimestamp();
        await message.reply({ embeds: [embed] });

    } else if (sub === 'edit') {
        const noteId = message.args[1];
        const text = message.restArgs.slice(2).join(' ');
        if (!noteId || !text) return message.reply('⚠️ Usage: `' + message.prefix + 'note edit <id> <new text>`');
        const updated = editNote(noteId, text);
        if (!updated) return message.reply('❌ Note not found. Check the ID with `' + message.prefix + 'note list @user`.');
        const embed = new EmbedBuilder()
            .setColor('Green').setTitle('✏️ Note Edited').setDescription('Note `' + noteId + '` has been updated.')
            .addFields({ name: 'Updated Note', value: text })
            .setFooter({ text: 'Edited by ' + message.author.tag }).setTimestamp();
        await message.reply({ embeds: [embed] });

    } else if (sub === 'remove') {
        const noteId = message.args[1];
        if (!noteId) return message.reply('⚠️ Usage: `' + message.prefix + 'note remove <id>`');
        const removed = removeNote(noteId);
        if (!removed) return message.reply('❌ Note not found. Check the ID with `' + message.prefix + 'note list @user`.');
        const embed = new EmbedBuilder()
            .setColor('Red').setTitle('🗑️ Note Removed').setDescription('Note `' + noteId + '` has been deleted.')
            .setFooter({ text: 'Removed by ' + message.author.tag }).setTimestamp();
        await message.reply({ embeds: [embed] });
    }
};

// ─── Log Search ───

handlers.logs = async (message) => {
    const sub = message.args[0];
    if (!sub || sub !== 'search') {
        return message.reply('⚠️ Usage: `' + message.prefix + 'logs search [@user] [keyword:<text>] [action:deleted|edited] [limit:<num>]`');
    }

    const searchUser = message.mentions.users.first();
    const args = message.restArgs.slice(1);
    const keyword = args.find(a => a.startsWith('keyword:'))?.slice(8);
    const action = args.find(a => a.startsWith('action:'))?.slice(7);
    const limit = Math.min(parseInt(args.find(a => a.startsWith('limit:'))?.slice(6)) || 15, 50);

    const db = getDb();
    const whereClauses = ['guild_id = ?'];
    const params = [message.guild.id];

    if (searchUser) {
        whereClauses.push('author_id = ?');
        params.push(searchUser.id);
    }
    if (keyword) {
        whereClauses.push('content LIKE ?');
        params.push('%' + keyword + '%');
    }
    if (action) {
        whereClauses.push('action = ?');
        params.push(action);
    }

    const sql = 'SELECT * FROM message_log WHERE ' + whereClauses.join(' AND ') + ' ORDER BY logged_at DESC LIMIT ?';
    params.push(limit);
    const results = db.prepare(sql).all(...params);

    if (!results.length) {
        let msg = '📋 No matching messages found.';
        if (searchUser) msg += '\nUser: ' + searchUser.toString();
        if (keyword) msg += '\nKeyword: `' + keyword + '`';
        if (action) msg += '\nAction: `' + action + '`';
        return message.reply(msg);
    }

    const lines = results.map(r => {
        const actionEmoji = r.action === 'deleted' ? '🗑️' : (r.action === 'edited' ? '✏️' : '📝');
        const snippet = (r.content || '*[empty]*').slice(0, 100);
        return actionEmoji + ' <@' + r.author_id + '> — <t:' + Math.floor(r.logged_at / 1000) + ':R>\n' +
            '> ' + snippet.replace(/\n/g, ' ').trim();
    }).join('\n\n');

    const embed = new EmbedBuilder()
        .setColor(0x5865F2).setAuthor({ name: message.guild.name, iconURL: message.guild.iconURL() })
        .setTitle('📋 Log Search Results').setDescription(lines.slice(0, 4096))
        .setFooter({ text: results.length + ' result' + (results.length !== 1 ? 's' : '') });

    await message.reply({ embeds: [embed] });
};

handlers.presence = async (message) => {
    // Permission already checked by dispatcher
    const type = message.args[0];
    const text = message.restArgs.slice(1).join(' ');
    if (!type || !text || !['playing', 'watching', 'listening', 'competing'].includes(type)) {
        return message.reply('⚠️ Usage: `' + message.prefix + 'presence <playing|watching|listening|competing> <text>`');
    }
    const types = { playing: 0, watching: 3, listening: 2, competing: 5 };
    try {
        await message.client.user.setPresence({
            activities: [{ name: text, type: types[type] || 0 }],
            status: 'online',
        });
        message.reply('✅ Presence updated to **' + type + '** "' + text + '"');
    } catch (err) {
        message.reply('⚠️ Failed: ' + err.message);
    }
};

handlers.embedconfig = async (message) => {
    // Permission already checked by dispatcher
    const sub = message.args[0];
    if (!sub || !['footer', 'color', 'show'].includes(sub)) return message.reply('⚠️ Usage: `' + message.prefix + 'embedconfig footer <text> [icon_url]`, `' + message.prefix + 'embedconfig color <hex>`, `' + message.prefix + 'embedconfig show`');
    const { saveBotConfig, getBotConfig } = require('./config');
    if (sub === 'footer') {
        const text = message.restArgs.slice(1).join(' ') || null;
        saveBotConfig({ embedFooterText: text });
        message.reply(text ? '✅ Embed footer set to: "' + text + '"' : '🗑️ Embed footer cleared.');
    } else if (sub === 'color') {
        const hexRaw = message.args[1];
        if (!hexRaw) return message.reply('⚠️ Usage: `' + message.prefix + 'embedconfig color <hex>` or `clear`');
        if (hexRaw.toLowerCase() === 'clear') {
            saveBotConfig({ embedColor: null });
            return message.reply('✅ Embed color reset to default.');
        }
        const color = parseInt(hexRaw.replace('#', ''), 16);
        if (isNaN(color) || color < 0 || color > 0xFFFFFF) return message.reply('⚠️ Invalid hex color! Use like `#5865F2`.');
        saveBotConfig({ embedColor: color });
        message.reply('✅ Embed color set to `#' + color.toString(16).toUpperCase().padStart(6, '0') + '`');
    } else if (sub === 'show') {
        const botCfg = getBotConfig();
        const lines = [
            '**Footer Text:** ' + (botCfg.embedFooterText || '*Not set*'),
            '**Embed Color:** ' + (botCfg.embedColor ? '`#' + botCfg.embedColor.toString(16).toUpperCase().padStart(6, '0') + '`' : '*Default (Blurple)*'),
        ];
        message.reply(lines.join('\n'));
    }
};

handlers.dashboard = async (message) => {
    // Permission already checked by dispatcher
    const dashUrl = process.env.DASHBOARD_URL || (process.env.RAILWAY_PUBLIC_DOMAIN ? 'https://' + process.env.RAILWAY_PUBLIC_DOMAIN : null);
    if (dashUrl) {
        try {
            await message.author.send('🌐 **Bot Dashboard**\n[Open Dashboard](' + dashUrl + ')');
            message.reply('📬 Check your DMs for the dashboard link!').catch(() => {});
        } catch {
            message.reply('⚠️ Could not DM you. Dashboard URL: ' + dashUrl);
        }
    } else {
        message.reply('⚠️ DASHBOARD_URL is not set.');
    }
};

handlers.dashaccess = async (message) => {
    // Permission already checked by dispatcher
    const sub = message.args[0];
    if (!sub || !['add', 'remove', 'list'].includes(sub)) return message.reply('⚠️ Usage: `' + message.prefix + 'dashaccess add @user`, `' + message.prefix + 'dashaccess remove <user_id>`, `' + message.prefix + 'dashaccess list`');
    const { addDashUser, removeDashUser, getDashUsers } = require('./dashboard');
    if (sub === 'add') {
        const user = message.mentions.users.first();
        if (!user) return message.reply('⚠️ Mention a user.');
        const result = addDashUser(user.id, message.author.tag);
        const token = result.accessToken;
        try {
            await user.send('✅ Dashboard access granted!\n**Access Token:** `' + token + '`\nUse this to log in via Discord ID.');
            message.reply('✅ Dashboard access granted to ' + user);
        } catch {
            message.reply('✅ Access granted but could not DM them. Token: `' + token + '`');
        }
    } else if (sub === 'remove') {
        const userId = message.args[1];
        if (!userId) return message.reply('⚠️ Usage: `' + message.prefix + 'dashaccess remove <user_id>`');
        removeDashUser(userId);
        message.reply('✅ Dashboard access removed from `' + userId + '`');
    } else if (sub === 'list') {
        const users = getDashUsers();
        const entries = Object.entries(users).filter(([, u]) => u.active);
        if (!entries.length) return message.reply('ℹ️ No dashboard users.');
        const lines = entries.map(([id, u]) => '<@' + id + '> — Added by ' + u.addedBy);
        const embed = new EmbedBuilder()
            .setColor(0x5865F2).setTitle('👥 Dashboard Users (' + entries.length + ')')
            .setDescription(lines.join('\n')).setTimestamp();
        await message.reply({ embeds: [embed] });
    }
};

handlers.server_leave = async (message) => {
    // Permission already checked by dispatcher
    const guildId = message.args[0];
    if (!guildId) return message.reply('⚠️ Usage: `' + message.prefix + 'server_leave <server_id>`');
    const guild = message.client.guilds.cache.get(guildId);
    if (!guild) return message.reply('⚠️ I\'m not in a server with that ID.');
    try {
        await guild.leave();
        const embed = new EmbedBuilder()
            .setColor(0xE74C3C).setTitle('👋 Left Server')
            .setDescription('Successfully left **' + guild.name + '** (' + guildId + ').')
            .setFooter({ text: 'By ' + message.author.tag }).setTimestamp();
        await message.reply({ embeds: [embed] });
    } catch (err) {
        message.reply('⚠️ Failed: ' + err.message);
    }
};

handlers.shutdown = async (message) => {
    // Permission already checked by dispatcher
    await message.reply('💤 Shutting down... Goodbye!');
    setTimeout(() => process.exit(0), 1500);
};

handlers.stats = async (message) => {
    const sub = message.args[0];
    if (sub === 'server') return handlers.server(message);
    if (sub === 'growth') return handlers.growth(message);
    return message.reply('⚠️ Usage: `' + message.prefix + 'stats server` or `' + message.prefix + 'stats growth`');
};

handlers.help = async (message) => {
    const prefix = message.prefix;
    const categories = [
        { name: '🛡️ Moderation', cmds: ['kick @user [reason]', 'ban @user [reason]', 'unban <id>', 'timeout @user <time> [reason]', 'untimeout @user', 'warn @user [reason]', 'warnings @user', 'clearwarnings @user', 'lock [#channel]', 'unlock [#channel]', 'purge <amount>', 'slowmode <seconds> [#channel]', 'nickname @user <name>', 'say #channel <text>'] },
        { name: '📝 Utility', cmds: ['embed #channel <title> | <desc> | #color', 'announce #channel <title> | <msg> | #color', 'poll <q> | <opt1> | <opt2> [| opt3]', 'track add/remove/list [#channel]', 'log channel/toggle/list <cat>', 'deploy'] },
        { name: '👥 Role', cmds: ['role add/remove @user @role', 'role list [@user]', 'reactionrole add #ch @role <emoji>', 'reactionrole list', 'reactionrole remove <msg_id>'] },
        { name: '🔑 Permissions', cmds: ['perm grant @user <cmd|all>', 'perm revoke @user <cmd|all>', 'perm list', 'perm user @user'] },
        { name: '📰 Info', cmds: ['ping', 'status', 'botinfo', 'userinfo [@user]', 'avatar [@user]', 'server', 'growth', 'stats server/growth'] },
        { name: '🎲 Fun', cmds: ['8ball <question>', 'coinflip', 'dice [sides]', 'rps <choice>', 'joke', 'fact', 'advice', 'quote', 'reverse <text>', 'mock <text>', 'random <min> <max>', 'worldcup <t1> <t2>'] },
        { name: '⏰ Utilities', cmds: ['remindme <time> <text>', 'reminders list', 'reminders cancel <id>', 'prefix [newprefix]', 'help'] },
        { name: '🎉 Giveaways', cmds: ['giveaway start <duration> [winners] <prize> [--desc "..."] [--role @role] [--ban @role] [--color #hex] [--img <url>]', 'giveaway end <id|link>', 'giveaway reroll <id|link>', 'giveaway cancel <id|link>', 'giveaway list'] },
        { name: '⚙️ Bot Config', cmds: ['botname <name>', 'botavatar <url>', 'presence <type> <text>', 'embedconfig footer/color/show', 'dashboard', 'dashaccess add/remove/list', 'shutdown'] },
    ];
    const lines = categories.map(c => '**' + c.name + '**\n' + c.cmds.map(cmd => '`' + prefix + cmd + '`').join(' ')).join('\n\n');
    const embed = new EmbedBuilder()
        .setColor(0x5865F2).setTitle('📖 Prefix Commands')
        .setDescription('Prefix: `' + prefix + '`\n\n' + lines)
        .setFooter({ text: message.guild.name, iconURL: message.guild.iconURL() }).setTimestamp();
    await message.reply({ embeds: [embed] });
};

// ─── Dispatcher ───

// ─── Giveaways (Prefix) ───

function parseGwFlags(args, startIdx) {
    // message.args is whitespace-split, so quoted multi-word flag values arrive as
    // separate tokens (e.g. --desc "Members only" → '"Members', 'only"'). Re-join
    // tokens that are inside quotes BEFORE parsing flags, then strip the quotes.
    const unquote = (s) => (typeof s === 'string' && s.length >= 2 && s.startsWith('"') && s.endsWith('"')) ? s.slice(1, -1) : s;
    const tokens = [];
    for (let i = startIdx; i < args.length; i++) {
        let a = args[i];
        if (a.startsWith('"') && !a.endsWith('"')) {
            const parts = [a];
            while (i + 1 < args.length && !args[i + 1].endsWith('"')) parts.push(args[++i]);
            if (i + 1 < args.length) parts.push(args[++i]);
            a = parts.join(' ');
        }
        tokens.push(a);
    }
    // Flags: --desc "..." --role @role --ban @role --color #hex --img <url>
    const flags = { desc: null, role: null, ban: null, color: null, img: null };
    const positional = [];
    for (let i = 0; i < tokens.length; i++) {
        const a = tokens[i];
        if (a === '--desc' || a === '--role' || a === '--ban' || a === '--color' || a === '--img') {
            const key = a.slice(2);
            const val = tokens[i + 1];
            if (val === undefined) { flags.error = 'Missing value for ' + a; return flags; }
            flags[key] = unquote(val);
            i++;
        } else {
            positional.push(unquote(a));
        }
    }
    flags.positional = positional;
    return flags;
}

function parseRoleMentionId(text) {
    if (!text) return null;
    const m = String(text).match(/^<@&(\d+)>$/);
    return m ? m[1] : (/^\d+$/.test(text) ? text : null);
}

handlers.giveaway = async (message) => {
    if (!checkOwnerOrPerm(message, 'giveaway')) return;
    const sub = message.args[0];
    const gw = require('./giveaways');
    const gid = message.guild.id;

    if (sub === 'start') {
        const flags = parseGwFlags(message.args, 1);
        if (flags.error) return message.reply('⚠️ ' + flags.error);
        const pos = flags.positional || [];
        const timeStr = pos[0];
        // winners is optional — only consume pos[1] as the winner count when numeric.
        let winners = 1, prizeIdx = 1;
        const w = parseInt(pos[1], 10);
        if (!isNaN(w)) { winners = Math.min(Math.max(w, 1), 20); prizeIdx = 2; }
        const prize = pos.slice(prizeIdx).join(' ');
        if (!timeStr || !prize) return message.reply('⚠️ Usage: `' + message.prefix + 'giveaway start <duration> [winners] <prize> [--desc "..."] [--role @role] [--ban @role] [--color #ff5500] [--img <url>]` — e.g. `' + message.prefix + 'giveaway start 1h 1 Nitro --desc "Members only" --role @Member --color #ff5500`');
        const ms = parseDuration(timeStr);
        if (!ms) return message.reply('⚠️ Invalid duration! Use e.g. `1h`, `30m`, `2d`, `1h30m`.');
        if (ms < 15000) return message.reply('⚠️ Minimum giveaway duration is 15 seconds.');
        if (flags.color && !gw.parseHexColor(flags.color)) return message.reply('⚠️ Invalid color! Use a hex like `#ff5500`.');
        const requiredRoleId = parseRoleMentionId(flags.role);
        const bannedRoleId = parseRoleMentionId(flags.ban);
        if (flags.role && !requiredRoleId) return message.reply('⚠️ Could not parse `--role` — use an @mention or a role ID.');
        if (flags.ban && !bannedRoleId) return message.reply('⚠️ Could not parse `--ban` — use an @mention or a role ID.');
        if (requiredRoleId && requiredRoleId === bannedRoleId) return message.reply('⚠️ A role cannot be both required and banned.');
        const g = gw.createGiveaway({
            guildId: gid, channelId: message.channel.id, prize, durationMs: ms, winners,
            hostId: message.author.id, hostTag: message.author.tag,
            description: flags.desc || null,
            requiredRoleIds: requiredRoleId ? [requiredRoleId] : [],
            bannedRoleIds: bannedRoleId ? [bannedRoleId] : [],
            color: flags.color || null,
            imageUrl: flags.img || null,
        });
        try {
            await gw.postGiveaway(message.channel, g);
            return message.reply('✅ Giveaway started! ID: `' + g.id + '` — ends in ' + formatDuration(ms));
        } catch (err) {
            gw.cancelGiveaway(g.id);
            return message.reply('❌ Failed: ' + err.message);
        }
    }

    if (sub === 'end' || sub === 'reroll' || sub === 'cancel') {
        const ref = message.args[1];
        if (!ref) return message.reply('⚠️ Usage: `' + message.prefix + 'giveaway ' + sub + ' <id|message-link>`');
        const g = gw.getGiveawayByMessageRef(ref);
        if (!g) return message.reply('⚠️ Giveaway not found. Use the ID from `;giveaway list` or paste the giveaway message link.');
        try {
            const res = sub === 'end' ? await gw.endGiveaway(g.id) : (sub === 'reroll' ? await gw.rerollGiveaway(g.id) : gw.cancelGiveaway(g.id));
            if (res.error) return message.reply('⚠️ ' + res.error);
            const done = sub === 'cancel' ? 'cancelled' : (sub === 'reroll' ? 'rerolled' : 'ended');
            return message.reply('✅ Giveaway ' + done + (res.winners && res.winners.length ? ' — winners: ' + res.winners.map(w => '<@' + w + '>').join(', ') : ''));
        } catch (err) {
            return message.reply('❌ Failed: ' + err.message);
        }
    }

    if (sub === 'list') {
        const list = gw.listGiveaways(gid, 10);
        if (!list.length) return message.reply('ℹ️ No giveaways in this server.');
        return message.reply('**🎉 Giveaways**\n' + list.map(g => '`' + g.id + '` — **' + g.prize + '** (' + g.status + (g.status === 'active' ? ', ends <t:' + Math.floor(g.ends_at / 1000) + ':R>' : '') + ')').join('\n'));
    }

    return message.reply('⚠️ Usage: `' + message.prefix + 'giveaway start <duration> [winners] <prize> [flags]` | `end <id|link>` | `reroll <id|link>` | `cancel <id|link>` | `list`');
};

// ─── Server Stats (Prefix) ───

handlers.serverstats = async (message) => {
    if (!checkOwnerOrPerm(message, 'serverstats')) return;
    const sub = message.args[0];
    const ss = require('./serverStats');
    const gid = message.guild.id;

    const typesList = Object.keys(ss.STAT_TYPES).join(', ');

    if (sub === 'add') {
        const type = message.args[1];
        const chanArg = message.args[2];
        const label = message.args.slice(3).join(' ').trim() || null;
        if (!type || !chanArg) {
            return message.reply('⚠️ Usage: `' + message.prefix + 'serverstats add <type> #channel [label]`\nTypes: ' + typesList);
        }
        if (!ss.STAT_TYPES[type]) {
            return message.reply('⚠️ Unknown type `' + type + '`. Valid: ' + typesList);
        }
        const m = String(chanArg).match(/^<#(\d+)>$/);
        const chanId = (m && m[1]) || String(chanArg);
        const channel = message.guild.channels.cache.get(chanId);
        if (!channel) return message.reply('⚠️ Channel not found — mention it like `#channel` or paste its ID.');
        if (channel.type === 4) return message.reply('⚠️ Categories can\'t hold a counter — pick a voice or text channel.');
        if (channel.isThread && channel.isThread()) return message.reply('⚠️ Threads can\'t hold a counter — pick a voice or text channel.');
        const res = ss.setServerStat(gid, channel.id, type, label);
        if (res.error) return message.reply('❌ ' + res.error);
        try { await ss.refreshGuildStats(message.guild); } catch {}
        const value = ss.computeStat(message.guild, message.guild.members, type);
        const note = type === 'online' && value === 0 ? '\nℹ️ The **online** counter needs the **Presence Intent** enabled in the Discord Developer Portal to show live numbers.' : '';
        return message.reply('✅ Counter set on <#' + channel.id + '> — now named **' + ss.formatStatName(type, value, label) + '**' + note);
    }

    if (sub === 'remove') {
        const chanArg = message.args[1];
        if (!chanArg) return message.reply('⚠️ Usage: `' + message.prefix + 'serverstats remove #channel`');
        const m = String(chanArg).match(/^<#(\d+)>$/);
        const chanId = (m && m[1]) || String(chanArg);
        const channel = message.guild.channels.cache.get(chanId);
        if (!channel) return message.reply('⚠️ Channel not found.');
        ss.removeServerStat(gid, channel.id);
        return message.reply('✅ Stopped updating <#' + channel.id + '>.');
    }

    if (sub === 'list') {
        const rows = ss.getServerStats(gid);
        if (!rows.length) return message.reply('ℹ️ No stat channels configured. Types: ' + typesList);
        const lines = rows.map(r => {
            const value = ss.computeStat(message.guild, message.guild.members, r.stat_type);
            return '• <#' + r.channel_id + '> → **' + ss.formatStatName(r.stat_type, value, r.label) + '**';
        }).join('\n');
        return message.reply('**📊 Server Stat Channels**\n' + lines);
    }

    return message.reply('⚠️ Usage: `' + message.prefix + 'serverstats add <type> #channel [label]` | `remove #channel` | `list`\nTypes: ' + typesList);
};

// ─── Voice Presence (Prefix) ───

handlers.vc = async (message) => {
    if (!checkOwnerOrPerm(message, 'vc')) return;
    const sub = (message.args[0] || '').toLowerCase();
    const vp = require('./voicePresence');
    const guild = message.guild;

    const usage = '⚠️ Usage: `' + message.prefix + 'vc join [#channel]` | `move #channel` | `status <text>` | `leave`';

    if (sub === 'join') {
        let channel = null;
        const chanArg = message.args[1];
        if (chanArg) {
            const m = String(chanArg).match(/^<#(\d+)>$/);
            const chanId = (m && m[1]) || String(chanArg);
            channel = guild.channels.cache.get(chanId);
            if (!channel) return message.reply('⚠️ Channel not found — mention it like `#channel` or paste its ID.');
        } else {
            channel = message.member.voice && message.member.voice.channel ? message.member.voice.channel : null;
            if (!channel) return message.reply('⚠️ You\'re not in a voice channel. Join one first, or pass one: `' + message.prefix + 'vc join #channel`');
        }
        if (!vp.isVoiceChannel(channel)) return message.reply('⚠️ That\'s not a voice channel.');
        const perms = channel.permissionsFor(guild.members.me);
        if (!perms || !perms.has(PermissionFlagsBits.Connect) || !perms.has(PermissionFlagsBits.ViewChannel)) {
            return message.reply('⚠️ The bot can\'t join <#' + channel.id + '> — missing **View Channel** or **Connect** permission.');
        }
        try {
            await vp.joinChannel(guild, channel, null);
        } catch (err) {
            if (err.code === 'ALREADY_THERE') return message.reply('🎧 I\'m already in **' + channel.name + '**.');
            const msg = String(err.message || err);
            if (msg.includes('Target user is not connected to voice')) {
                return message.reply('❌ The bot couldn\'t connect — the voice library (@discordjs/voice) isn\'t loaded. Restart the bot after `npm install` to fix this.');
            }
            return message.reply('❌ Failed to join: ' + msg);
        }
        return message.reply('🎧 Joined **' + channel.name + '** and I\'m staying. Use `' + message.prefix + 'vc status <text>` to flex a custom "Listening to" line.');
    }

    if (sub === 'move') {
        const chanArg = message.args[1];
        if (!chanArg) return message.reply(usage);
        const m = String(chanArg).match(/^<#(\d+)>$/);
        const chanId = (m && m[1]) || String(chanArg);
        const channel = guild.channels.cache.get(chanId);
        if (!channel) return message.reply('⚠️ Channel not found.');
        if (!vp.isVoiceChannel(channel)) return message.reply('⚠️ That\'s not a voice channel.');
        try {
            await vp.moveChannel(guild, channel);
        } catch (err) {
            return message.reply('❌ ' + (err.message || err));
        }
        return message.reply('🎧 Moved to **' + channel.name + '**.');
    }

    if (sub === 'leave') {
        await vp.leaveChannel(guild);
        return message.reply('👋 Left the voice channel. The aura has been stored for later.');
    }

    if (sub === 'status') {
        const text = message.args.slice(1).join(' ').trim();
        try {
            const clean = await vp.setStatusText(guild, text);
            if (clean === null) return message.reply('🎧 Status reset — back to "Listening to <channel name>".');
            return message.reply('🎧 Now "Listening to **' + clean + '**".');
        } catch (err) {
            return message.reply('❌ ' + (err.message || err));
        }
    }

    return message.reply(usage);
};

// ─── Temp Voice Channels (Prefix) ───

handlers.tempvc = async (message) => {
    const tv = require('./tempVoice');
    const guild = message.guild;
    const sub = (message.args[0] || '').toLowerCase();
    const adminSubs = ['set', 'unset', 'name', 'list', 'panel'];

    if (adminSubs.includes(sub) && !checkOwnerOrPerm(message, 'tempvc')) return;

    const usage = '⚠️ Usage: `' + message.prefix + 'tempvc set #channel [category]` | `unset [#channel]` | `name <template>` | `list` | `rename <name>` | `limit <n>` | `lock` | `unlock` | `claim`';

    // Helpers
    const parseChannel = (arg) => {
        if (!arg) return null;
        const m = String(arg).match(/^<#(\d+)>$/);
        const id = (m && m[1]) || String(arg);
        const ch = guild.channels.cache.get(id);
        return ch || null;
    };
    const getMemberChannel = () => {
        const vcId = message.member.voice && message.member.voice.channelId;
        if (vcId) {
            const row = tv.getSpawnedChannel(vcId);
            if (row) {
                const ch = guild.channels.cache.get(vcId);
                if (ch) return { row, channel: ch };
            }
        }
        const owned = tv.getSpawnedByOwner(guild.id, message.author.id);
        if (owned) {
            const ch = guild.channels.cache.get(owned.channel_id);
            if (ch) return { row: owned, channel: ch };
        }
        return null;
    };

    if (sub === 'set') {
        const channel = parseChannel(message.args[1]);
        const category = parseChannel(message.args[2]);
        if (!channel) return message.reply('⚠️ Usage: `' + message.prefix + 'tempvc set #channel [category]`');
        if (!tv.isVoiceChannel(channel)) return message.reply('⚠️ The trigger must be a voice channel.');
        if (category && category.type !== 4) return message.reply('⚠️ The second arg must be a category.');
        tv.setTrigger(guild.id, channel.id, category ? category.id : null);
        return message.reply('✅ <#' + channel.id + '> is now a **join-to-create** trigger' + (category ? ' (spawns in **' + category.name + '**)' : '') + '.');
    }

    if (sub === 'unset') {
        const channel = parseChannel(message.args[1]);
        if (channel) {
            tv.removeTrigger(guild.id, channel.id);
            return message.reply('✅ Removed <#' + channel.id + '> as a trigger.');
        }
        const triggers = tv.getTriggers(guild.id);
        for (const t of triggers) tv.removeTrigger(guild.id, t.channel_id);
        return message.reply(triggers.length ? '✅ Removed all **' + triggers.length + '** triggers.' : 'ℹ️ No triggers configured.');
    }

    if (sub === 'name') {
        const template = message.args.slice(1).join(' ').trim();
        if (!template) return message.reply('⚠️ Usage: `' + message.prefix + 'tempvc name <template>` — placeholders `{name}` and `{number}`.');
        const res = tv.setConfig(guild.id, template);
        if (res.error) return message.reply('❌ ' + res.error);
        return message.reply('✅ Name template set to **' + res.name_template + '**.');
    }

    if (sub === 'list') {
        const triggers = tv.getTriggers(guild.id);
        const spawned = tv.getSpawned(guild.id);
        const tLines = [];
        for (const t of triggers) {
            const ch = guild.channels.cache.get(t.channel_id);
            if (!ch) { tv.removeTrigger(guild.id, t.channel_id); continue; }
            tLines.push('• <#' + t.channel_id + '>' + (t.category_id ? ' → <#' + t.category_id + '>' : ''));
        }
        const sLines = [];
        for (const s of spawned) {
            const ch = guild.channels.cache.get(s.channel_id);
            if (!ch) { tv.removeSpawned(s.channel_id); continue; }
            const owner = guild.members.cache.get(s.owner_id);
            sLines.push('• <#' + s.channel_id + '> → ' + (owner ? String(owner.user) : '`' + s.owner_id + '`') + (ch.members && ch.members.size ? ' (' + ch.members.size + ' in it)' : ' (empty)'));
        }
        if (!tLines.length && !sLines.length) return message.reply('ℹ️ No temp voice channels configured. Use `' + message.prefix + 'tempvc set #channel`.');
        return message.reply('**🎙️ Temp Voice Channels**\n' + (tLines.length ? '**Triggers:**\n' + tLines.join('\n') + '\n' : '') + (sLines.length ? '**Live:**\n' + sLines.join('\n') : ''));
    }

    if (sub === 'panel') {
        let channel = message.channel;
        const chanArg = message.args[1];
        if (chanArg) {
            const m = String(chanArg).match(/^<#(\d+)>$/);
            const chanId = (m && m[1]) || String(chanArg);
            const ch = guild.channels.cache.get(chanId);
            if (!ch || !ch.isTextBased || !ch.isTextBased()) return message.reply('⚠️ Pick a text channel to send the panel to.');
            channel = ch;
        }
        try {
            const msg = await channel.send(tv.buildPanelMessage(guild));
            tv.registerPanel(guild.id, channel.id, msg.id);
            return message.reply('🎙️ Control panel sent to ' + channel + '. It now updates live as channels are created, locked, or deleted.');
        } catch (err) {
            return message.reply('❌ Failed to send the panel: ' + (err.message || err));
        }
    }

    if (sub === 'rename' || sub === 'limit' || sub === 'lock' || sub === 'unlock') {
        const found = getMemberChannel();
        if (!found) return message.reply('⚠️ You\'re not in a temp voice channel (and don\'t own one).');
        if (found.row.owner_id !== message.author.id && !isOwner(message.author.id)) {
            return message.reply('⚠️ Only the channel owner can do that. Owner gone? Use `' + message.prefix + 'tempvc claim`.');
        }
        const { channel } = found;
        if (sub === 'rename') {
            const name = message.args.slice(1).join(' ').trim().slice(0, tv.MAX_CHANNEL_NAME);
            if (!name) return message.reply('⚠️ Usage: `' + message.prefix + 'tempvc rename <name>`');
            try { await channel.setName(name, 'Temp VC renamed'); return message.reply('✅ Renamed to **' + name + '**.'); }
            catch (err) { return message.reply('❌ Failed to rename: ' + (err.message || err)); }
        }
        if (sub === 'limit') {
            const n = parseInt(message.args[1], 10);
            if (isNaN(n) || n < 0 || n > 99) return message.reply('⚠️ Usage: `' + message.prefix + 'tempvc limit <0-99>`');
            try { await channel.setUserLimit(n, 'Temp VC user limit'); return message.reply(n === 0 ? '✅ User limit cleared (unlimited).' : '✅ User limit set to **' + n + '**.', ); }
            catch (err) { return message.reply('❌ Failed to set limit: ' + (err.message || err)); }
        }
        const locked = sub === 'lock';
        try {
            const everyone = guild.roles.everyone;
            if (locked) {
                await channel.permissionOverwrites.edit(everyone, { Connect: false }, 'Temp VC locked');
                await channel.permissionOverwrites.edit(message.member, { Connect: true }, 'Temp VC owner');
                tv.updatePanels(guild).catch(() => {});
                return message.reply('🔒 Channel locked — only you can join now.');
            }
            const eow = channel.permissionOverwrites.cache.get(everyone.id);
            if (eow && eow.deny.has(PermissionFlagsBits.Connect)) await channel.permissionOverwrites.delete(everyone, 'Temp VC unlocked');
            const mow = channel.permissionOverwrites.cache.get(message.member.id);
            if (mow && mow.allow.has(PermissionFlagsBits.Connect)) await channel.permissionOverwrites.delete(message.member, 'Temp VC unlocked');
            tv.updatePanels(guild).catch(() => {});
            return message.reply('🔓 Channel unlocked — everyone can join.');
        } catch (err) { return message.reply('❌ Failed to ' + sub + ': ' + (err.message || err)); }
    }

    if (sub === 'claim') {
        const vcId = message.member.voice && message.member.voice.channelId;
        if (!vcId) return message.reply('⚠️ You need to be inside a temp voice channel to claim it.');
        const row = tv.getSpawnedChannel(vcId);
        if (!row) return message.reply('⚠️ This isn\'t a temp voice channel.');
        const claimChannel = guild.channels.cache.get(vcId);
        // channel.members is authoritative for who is in the VC (the members
        // cache can miss the owner on large servers).
        if (claimChannel && claimChannel.members && claimChannel.members.has(row.owner_id)) {
            return message.reply('⚠️ The owner is still here — no need to claim.');
        }
        tv.addSpawned(vcId, guild.id, message.author.id, row.trigger_id);
        tv.cancelDeletion(vcId);
        tv.updatePanels(guild).catch(() => {});
        return message.reply('👑 You now own this channel.');
    }

    return message.reply(usage);
};

// ─── Welcome / Goodbye (Prefix) ───

handlers.welcome = async (message) => {
    if (!checkOwnerOrPerm(message, 'welcome')) return;
    const sub = message.args[0];
    const { getWelcomeConfig, updateWelcomeConfig } = require('./config');
    const { buildGreetingEmbed, buildConfigEmbed } = require('./commands/greetings');
    const type = 'welcome';
    const typeLabel = 'Welcome';

    if (!sub) {
        const cfg = getWelcomeConfig(message.guild.id);
        const embed = buildConfigEmbed(cfg, type, message.guild);
        return message.reply({ embeds: [embed] });
    }

    if (sub === 'channel') {
        const channel = message.mentions.channels.first();
        updateWelcomeConfig(message.guild.id, type, (cfg) => {
            cfg.channelId = channel ? channel.id : null;
            if (channel) cfg.enabled = true;
            return cfg;
        });
        message.reply(channel ? '✅ ' + typeLabel + ' channel set to ' + channel : '🗑️ ' + typeLabel + ' channel cleared.');
    } else if (sub === 'toggle') {
        const enabled = message.args[1] !== 'off' && message.args[1] !== 'false';
        updateWelcomeConfig(message.guild.id, type, (cfg) => { cfg.enabled = enabled; return cfg; });
        message.reply(enabled ? '✅ ' + typeLabel + ' enabled.' : '❌ ' + typeLabel + ' disabled.');
    } else if (sub === 'message') {
        const text = message.restArgs.slice(1).join(' ');
        updateWelcomeConfig(message.guild.id, type, (cfg) => { cfg.content = text || null; return cfg; });
        message.reply(text ? '✅ ' + typeLabel + ' plain text set.' : '🗑️ ' + typeLabel + ' plain text cleared.');
    } else if (sub === 'title') {
        const text = message.restArgs.slice(1).join(' ');
        updateWelcomeConfig(message.guild.id, type, (cfg) => { cfg.embedTitle = text || null; return cfg; });
        message.reply(text ? '✅ ' + typeLabel + ' embed title set.' : '🗑️ ' + typeLabel + ' embed title cleared.');
    } else if (sub === 'description') {
        const text = message.restArgs.slice(1).join(' ');
        updateWelcomeConfig(message.guild.id, type, (cfg) => { cfg.embedDescription = text || null; return cfg; });
        message.reply(text ? '✅ ' + typeLabel + ' embed description set.' : '🗑️ ' + typeLabel + ' embed description cleared.');
    } else if (sub === 'color') {
        const hex = message.args[1];
        const pc = parseInt(hex?.replace('#', ''), 16);
        if (!hex || isNaN(pc) || pc < 0 || pc > 0xFFFFFF) return message.reply('⚠️ Invalid hex color. Use like #5865F2');
        updateWelcomeConfig(message.guild.id, type, (cfg) => { cfg.embedColor = hex; return cfg; });
        message.reply('🎨 ' + typeLabel + ' color set to ' + hex);
    } else if (sub === 'footer') {
        const text = message.restArgs.slice(1).join(' ');
        updateWelcomeConfig(message.guild.id, type, (cfg) => { cfg.embedFooter = text || null; return cfg; });
        message.reply(text ? '✅ ' + typeLabel + ' footer set.' : '🗑️ ' + typeLabel + ' footer cleared.');
    } else if (sub === 'thumbnail') {
        const url = message.args[1];
        updateWelcomeConfig(message.guild.id, type, (cfg) => { cfg.embedThumbnail = url || null; return cfg; });
        message.reply(url ? '✅ ' + typeLabel + ' thumbnail set.' : '🗑️ ' + typeLabel + ' thumbnail cleared.');
    } else if (sub === 'image') {
        const url = message.args[1];
        updateWelcomeConfig(message.guild.id, type, (cfg) => { cfg.embedImage = url || null; return cfg; });
        message.reply(url ? '✅ ' + typeLabel + ' image set.' : '🗑️ ' + typeLabel + ' image cleared.');
    } else if (sub === 'test') {
        const cfg = getWelcomeConfig(message.guild.id);
        if (!cfg.channelId) return message.reply('⚠️ No ' + typeLabel.toLowerCase() + ' channel set.');
        const channel = message.guild.channels.cache.get(cfg.channelId);
        if (!channel) return message.reply('⚠️ ' + typeLabel + ' channel no longer exists.');
        const testMember = message.guild.members.me;
        const content = cfg.content ? require('./helpers').replacePlaceholders(cfg.content, testMember, type) : '';
        const embed = buildGreetingEmbed(cfg, testMember, type);
        try {
            await channel.send({ content: content || undefined, embeds: [embed] });
            message.reply('✅ Test ' + typeLabel.toLowerCase() + ' sent to ' + channel);
        } catch (err) {
            message.reply('⚠️ Failed: ' + err.message);
        }
    } else if (sub === 'reset') {
        updateWelcomeConfig(message.guild.id, type, (cfg) => {
            Object.assign(cfg, { enabled: false, channelId: null, content: null, embedTitle: '👋 Welcome!', embedDescription: 'Welcome {user} to **{server}**!', embedColor: '#5865F2', embedFooter: 'Member #{membercount}', embedFooterIcon: null, embedThumbnail: null, embedImage: null, embedAuthor: null, embedAuthorIcon: null });
            return cfg;
        });
        message.reply('🔄 ' + typeLabel + ' settings reset to defaults.');
    } else {
        message.reply('⚠️ Subcommands: channel, toggle, message, title, description, color, footer, thumbnail, image, test, reset');
    }
};

handlers.goodbye = async (message) => {
    if (!checkOwnerOrPerm(message, 'goodbye')) return;
    const sub = message.args[0];
    const { getGoodbyeConfig, updateWelcomeConfig } = require('./config');
    const { buildGreetingEmbed, buildConfigEmbed } = require('./commands/greetings');
    const type = 'goodbye';
    const typeLabel = 'Goodbye';

    if (!sub) {
        const cfg = getGoodbyeConfig(message.guild.id);
        const embed = buildConfigEmbed(cfg, type, message.guild);
        return message.reply({ embeds: [embed] });
    }

    if (sub === 'channel') {
        const channel = message.mentions.channels.first();
        updateWelcomeConfig(message.guild.id, type, (cfg) => {
            cfg.channelId = channel ? channel.id : null;
            if (channel) cfg.enabled = true;
            return cfg;
        });
        message.reply(channel ? '✅ ' + typeLabel + ' channel set to ' + channel : '🗑️ ' + typeLabel + ' channel cleared.');
    } else if (sub === 'toggle') {
        const enabled = message.args[1] !== 'off' && message.args[1] !== 'false';
        updateWelcomeConfig(message.guild.id, type, (cfg) => { cfg.enabled = enabled; return cfg; });
        message.reply(enabled ? '✅ ' + typeLabel + ' enabled.' : '❌ ' + typeLabel + ' disabled.');
    } else if (sub === 'message') {
        const text = message.restArgs.slice(1).join(' ');
        updateWelcomeConfig(message.guild.id, type, (cfg) => { cfg.content = text || null; return cfg; });
        message.reply(text ? '✅ ' + typeLabel + ' plain text set.' : '🗑️ ' + typeLabel + ' plain text cleared.');
    } else if (sub === 'title') {
        const text = message.restArgs.slice(1).join(' ');
        updateWelcomeConfig(message.guild.id, type, (cfg) => { cfg.embedTitle = text || null; return cfg; });
        message.reply(text ? '✅ ' + typeLabel + ' embed title set.' : '🗑️ ' + typeLabel + ' embed title cleared.');
    } else if (sub === 'description') {
        const text = message.restArgs.slice(1).join(' ');
        updateWelcomeConfig(message.guild.id, type, (cfg) => { cfg.embedDescription = text || null; return cfg; });
        message.reply(text ? '✅ ' + typeLabel + ' embed description set.' : '🗑️ ' + typeLabel + ' embed description cleared.');
    } else if (sub === 'color') {
        const hex = message.args[1];
        const pc = parseInt(hex?.replace('#', ''), 16);
        if (!hex || isNaN(pc) || pc < 0 || pc > 0xFFFFFF) return message.reply('⚠️ Invalid hex color. Use like #E74C3C');
        updateWelcomeConfig(message.guild.id, type, (cfg) => { cfg.embedColor = hex; return cfg; });
        message.reply('🎨 ' + typeLabel + ' color set to ' + hex);
    } else if (sub === 'footer') {
        const text = message.restArgs.slice(1).join(' ');
        updateWelcomeConfig(message.guild.id, type, (cfg) => { cfg.embedFooter = text || null; return cfg; });
        message.reply(text ? '✅ ' + typeLabel + ' footer set.' : '🗑️ ' + typeLabel + ' footer cleared.');
    } else if (sub === 'thumbnail') {
        const url = message.args[1];
        updateWelcomeConfig(message.guild.id, type, (cfg) => { cfg.embedThumbnail = url || null; return cfg; });
        message.reply(url ? '✅ ' + typeLabel + ' thumbnail set.' : '🗑️ ' + typeLabel + ' thumbnail cleared.');
    } else if (sub === 'image') {
        const url = message.args[1];
        updateWelcomeConfig(message.guild.id, type, (cfg) => { cfg.embedImage = url || null; return cfg; });
        message.reply(url ? '✅ ' + typeLabel + ' image set.' : '🗑️ ' + typeLabel + ' image cleared.');
    } else if (sub === 'test') {
        const cfg = getGoodbyeConfig(message.guild.id);
        if (!cfg.channelId) return message.reply('⚠️ No ' + typeLabel.toLowerCase() + ' channel set.');
        const channel = message.guild.channels.cache.get(cfg.channelId);
        if (!channel) return message.reply('⚠️ ' + typeLabel + ' channel no longer exists.');
        const testMember = message.guild.members.me;
        const content = cfg.content ? require('./helpers').replacePlaceholders(cfg.content, testMember, type) : '';
        const embed = buildGreetingEmbed(cfg, testMember, type);
        try {
            await channel.send({ content: content || undefined, embeds: [embed] });
            message.reply('✅ Test ' + typeLabel.toLowerCase() + ' sent to ' + channel);
        } catch (err) {
            message.reply('⚠️ Failed: ' + err.message);
        }
    } else if (sub === 'reset') {
        updateWelcomeConfig(message.guild.id, type, (cfg) => {
            Object.assign(cfg, { enabled: false, channelId: null, content: null, embedTitle: '👋 Goodbye!', embedDescription: '{user} has left **{server}**.', embedColor: '#E74C3C', embedFooter: 'Member #{membercount}', embedFooterIcon: null, embedThumbnail: null, embedImage: null, embedAuthor: null, embedAuthorIcon: null });
            return cfg;
        });
        message.reply('🔄 ' + typeLabel + ' settings reset to defaults.');
    } else {
        message.reply('⚠️ Subcommands: channel, toggle, message, title, description, color, footer, thumbnail, image, test, reset');
    }
};

async function handlePrefixMessage(message, prefix) {
    const content = message.content;
    if (!content.startsWith(prefix)) return false;

    const afterPrefix = content.slice(prefix.length).trim();
    if (!afterPrefix) return false;

    const parts = afterPrefix.split(/\s+/);
    const cmdName = parts[0].toLowerCase();

    const handler = handlers[cmdName];
    if (!handler) return false;

    // Attach parsed data to message for handlers to use
    message.prefix = prefix;
    message.args = parts.slice(1);
    message.restArgs = parts.slice(1);

    // Check permission for owner-only prefix commands

    const ownerOnlyCmds = ['kick', 'ban', 'unban', 'timeout', 'untimeout', 'warn', 'warnings', 'clearwarnings', 'lock', 'unlock', 'purge', 'slowmode', 'say', 'role', 'prefix', 'nickname', 'embed', 'announce', 'poll', 'perm', 'track', 'log', 'reactionrole', 'deploy', 'botavatar', 'botname', 'presence', 'embedconfig', 'dashboard', 'dashaccess', 'server_leave', 'shutdown', 'welcome', 'goodbye', 'invites', 'note', 'logs', 'vc'];
    if (ownerOnlyCmds.includes(cmdName)) {
        if (!checkOwnerOrPerm(message, cmdName)) return true;
    }

    try {
        await handler(message);
    } catch (err) {
        const { logError } = require('./logError');
        logError(err, 'prefixCommands', cmdName);
        message.reply('⚠️ An error occurred while executing that command.').catch(() => {});
    }
    return true;
}

module.exports = { handlePrefixMessage, prefixHandlers: handlers, parseGwFlags };
