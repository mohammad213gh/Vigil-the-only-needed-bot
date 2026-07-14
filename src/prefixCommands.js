// ──────────────────── Prefix Command Handlers ────────────────────
// Maps text commands (like ;kick @user) to handler functions.
// Each handler receives (message, args) via message.args / message.restArgs

const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { addWarning, getWarnings, clearWarnings } = require('./warnings');
const { addReminder } = require('./reminders');
const { updateGuildConfig } = require('./config');
const { getGuildStats } = require('./stats');
const { isOwner, truncate, parseDuration, formatDuration, formatNumber, randomItem, randomInt, reverseText, mockText } = require('./helpers');
const { hasPermission } = require('./permissions');
const { getFlag } = require('./helpers');
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

handlers.help = async (message) => {
    const prefix = message.prefix;
    const categories = [
        { name: '🛡️ Moderation', cmds: ['kick @user [reason]', 'ban @user [reason]', 'unban <id>', 'timeout @user <time> [reason]', 'untimeout @user', 'warn @user [reason]', 'warnings @user', 'clearwarnings @user', 'lock [#channel]', 'unlock [#channel]', 'purge <amount>', 'slowmode <seconds> [#channel]', 'say #channel <text>'] },
        { name: '👥 Role', cmds: ['role add/remove @user @role', 'role list [@user]'] },
        { name: '📰 Info', cmds: ['ping', 'botinfo', 'userinfo [@user]', 'avatar [@user]', 'server', 'growth'] },
        { name: '🎲 Fun', cmds: ['8ball <question>', 'coinflip', 'dice [sides]', 'rps <choice>', 'joke', 'fact', 'advice', 'quote', 'reverse <text>', 'mock <text>', 'random <min> <max>', 'worldcup <t1> <t2>'] },
        { name: '⏰ Utility', cmds: ['remindme <time> <text>', 'prefix [newprefix]', 'help'] },
    ];
    const lines = categories.map(c => '**' + c.name + '**\n' + c.cmds.map(cmd => '`' + prefix + cmd + '`').join(' ')).join('\n\n');
    const embed = new EmbedBuilder()
        .setColor(0x5865F2).setTitle('📖 Prefix Commands')
        .setDescription('Prefix: `' + prefix + '`\n\n' + lines)
        .setFooter({ text: message.guild.name, iconURL: message.guild.iconURL() }).setTimestamp();
    await message.reply({ embeds: [embed] });
};

// ─── Dispatcher ───

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
    const ownerOnlyCmds = ['kick', 'ban', 'unban', 'timeout', 'untimeout', 'warn', 'warnings', 'clearwarnings', 'lock', 'unlock', 'purge', 'slowmode', 'say', 'role', 'prefix'];
    if (ownerOnlyCmds.includes(cmdName)) {
        if (!checkOwnerOrPerm(message, cmdName)) return true;
    }

    try {
        await handler(message);
    } catch (err) {
        console.error('[PrefixCmd] Error in ' + cmdName + ':', err);
        message.reply('⚠️ An error occurred while executing that command.').catch(() => {});
    }
    return true;
}

module.exports = { handlePrefixMessage, prefixHandlers: handlers };
