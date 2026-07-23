const { EmbedBuilder } = require('discord.js');
const os = require('os');
const { version: djsVersion } = require('discord.js');
const { formatUptime, formatNumber, truncate } = require('../helpers');
const { WS_STATUS } = require('../constants');
const { getGuildConfig } = require('../config');
const { getGuildStats } = require('../stats');
const { CATEGORY_EMOJIS } = require('../constants');

async function executePing(interaction) {
    const sent = await interaction.reply({ content: 'Pinging...', ephemeral: true, fetchReply: true });
    const rtt = sent.createdTimestamp - interaction.createdTimestamp;
    await interaction.editReply({
        content: [
            '**Pong!**',
            'WebSocket Heartbeat: `' + interaction.client.ws.ping + 'ms`',
            'Roundtrip Latency:   `' + rtt + 'ms`',
        ].join('\n'),
    });
}

async function executeStatus(interaction) {
    const client = interaction.client;
    const guild = interaction.guild;
    const guildConfig = getGuildConfig(guild.id);
    const mem = process.memoryUsage();
    const uptime = formatUptime(client.uptime);
    const guildCount = client.guilds.cache.size;
    const userCount = client.guilds.cache.reduce((a, g) => a + g.memberCount, 0);

    let configInfo = 'No log channel set';
    if (guildConfig.logChannelId) {
        configInfo = 'Default log: <#' + guildConfig.logChannelId + '>';
    }
    const hasPerChannel = Object.values(guildConfig.logChannels).some(v => v);
    if (hasPerChannel) {
        const lines = Object.entries(guildConfig.logChannels)
            .filter(([, v]) => v)
            .map(([k, v]) => (CATEGORY_EMOJIS[k] || '\uD83D\uDD35') + ' ' + k + ': <#' + v + '>');
        configInfo = lines.join('\n');
    }
    const enabled = Object.entries(guildConfig.logCategories)
        .filter(([, v]) => v).map(([k]) => k).join(', ');
    if (enabled) configInfo += '\n\u2705 Enabled: ' + enabled;
    if (guildConfig.trackedChannels.length > 0) {
        configInfo += '\n\uD83D\uDCE1 Tracking: ' + guildConfig.trackedChannels.length + ' channel(s)';
    }

    const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('\uD83D\uDCCA Bot Status')
        .setThumbnail(client.user.displayAvatarURL())
        .addFields(
            { name: 'Connection', value: WS_STATUS[client.ws.status] || 'Unknown', inline: true },
            { name: 'Ping', value: client.ws.ping + 'ms', inline: true },
            { name: 'Uptime', value: uptime, inline: true },
            { name: 'Servers', value: String(guildCount), inline: true },
            { name: 'Users', value: formatNumber(userCount), inline: true },
            { name: 'Commands', value: '35+ total', inline: true },
            { name: 'Memory (RSS)', value: (mem.rss / 1024 / 1024).toFixed(1) + ' MB', inline: true },
            { name: 'Heap Used', value: (mem.heapUsed / 1024 / 1024).toFixed(1) + ' MB', inline: true },
            { name: 'CPU Cores', value: String(os.cpus().length), inline: true },
            { name: 'Platform', value: os.platform() + ' ' + os.arch(), inline: true },
            { name: 'Node.js', value: process.version, inline: true },
            { name: 'discord.js', value: 'v' + djsVersion, inline: true },
        )
        .setFooter({ text: guild.name, iconURL: guild.iconURL() })
        .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function executeBotInfo(interaction) {
    const client = interaction.client;
    const guild = interaction.guild;

    const embed = new EmbedBuilder()
        .setColor(0x9B59B6)
        .setAuthor({ name: client.user.username, iconURL: client.user.displayAvatarURL() })
        .setTitle('\u2139\uFE0F Bot Information')
        .addFields(
            { name: 'Name', value: client.user.tag, inline: true },
            { name: 'ID', value: client.user.id, inline: true },
            { name: 'Created', value: '<t:' + Math.floor(client.user.createdTimestamp / 1000) + ':R>', inline: true },
            { name: 'Servers', value: String(client.guilds.cache.size), inline: true },
            { name: 'Owner', value: '<@' + process.env.OWNER_ID + '>', inline: true },
            { name: 'Description', value: 'Discord server event logger — logs messages, reactions, members, roles, server changes, and voice events.' },
            { name: 'Tech Stack', value: 'Node.js ' + process.version + ' · discord.js v' + djsVersion },
        )
        .setFooter({ text: guild.name, iconURL: guild.iconURL() })
        .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function executeUserInfo(interaction) {
    const client = interaction.client;
    const guild = interaction.guild;
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const member = await guild.members.fetch(targetUser.id).catch(() => null);

    const sharedServers = client.guilds.cache.filter(g => g.members.cache.has(targetUser.id)).size;

    const roles = member
        ? member.roles.cache.filter(r => r.id !== guild.id).sort((a, b) => b.position - a.position).map(r => r.toString())
        : [];

    const embed = new EmbedBuilder()
        .setColor(member ? member.displayHexColor : 0x5865F2)
        .setAuthor({ name: targetUser.tag, iconURL: targetUser.displayAvatarURL() })
        .setTitle('\uD83D\uDC64 User Information')
        .setThumbnail(targetUser.displayAvatarURL({ size: 128 }))
        .addFields(
            { name: 'Username', value: targetUser.tag, inline: true },
            { name: 'ID', value: targetUser.id, inline: true },
            { name: 'Bot', value: targetUser.bot ? 'Yes' : 'No', inline: true },
            { name: 'Created', value: '<t:' + Math.floor(targetUser.createdTimestamp / 1000) + ':R>', inline: true },
            { name: 'Shared Servers', value: String(sharedServers), inline: true },
        );

    if (member) {
        embed.addFields(
            { name: 'Joined Server', value: '<t:' + Math.floor(member.joinedTimestamp / 1000) + ':R>', inline: true },
        );
        if (roles.length > 0) {
            embed.addFields({ name: 'Roles (' + roles.length + ')', value: truncate(roles.join(', '), 1024) });
        }
    }

    embed.setFooter({ text: 'Requested by ' + interaction.user.tag })
        .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function executeAvatar(interaction) {
    const targetUser = interaction.options.getUser('user') || interaction.user;

    const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setAuthor({ name: targetUser.tag, iconURL: targetUser.displayAvatarURL() })
        .setTitle('\uD83D\uDCF7 Avatar')
        .setImage(targetUser.displayAvatarURL({ size: 1024, forceStatic: false }))
        .setFooter({ text: 'Requested by ' + interaction.user.tag })
        .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function executeStats(interaction) {
    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild;

    if (sub === 'server') {
        const channels = guild.channels.cache;
        const bots = guild.members.cache.filter(m => m.user.bot).size;
        const humans = guild.members.cache.size - bots;
        const totalMembers = guild.memberCount;
        const boosts = guild.premiumSubscriptionCount || 0;
        const boostTier = guild.premiumTier;
        const tierNames = { 0: 'None', 1: 'Tier 1', 2: 'Tier 2', 3: 'Tier 3' };

        const textChannels = channels.filter(c => c.type === 0).size;
        const voiceChannels = channels.filter(c => c.type === 2).size;
        const categories = channels.filter(c => c.type === 4).size;
        const forums = channels.filter(c => c.type === 15).size;

        const embed = new EmbedBuilder()
            .setColor(0x00BFFF)
            .setAuthor({ name: guild.name, iconURL: guild.iconURL() })
            .setTitle('\uD83D\uDCCA Server Statistics')
            .setThumbnail(guild.iconURL({ size: 128 }))
            .addFields(
                {
                    name: '\uD83D\uDC65 Members',
                    value: 'Total: **' + formatNumber(totalMembers) + '**'
                        + '\nCached: **' + formatNumber(guild.members.cache.size) + '**'
                        + '\nHumans: **' + formatNumber(humans) + '**'
                        + '\nBots: **' + formatNumber(bots) + '**',
                    inline: true,
                },
                {
                    name: '\uD83D\uDCFA Channels',
                    value: 'Text: **' + textChannels + '**'
                        + '\nVoice: **' + voiceChannels + '**'
                        + '\nCategories: **' + categories + '**'
                        + (forums > 0 ? '\nForums: **' + forums + '**' : ''),
                    inline: true,
                },
                {
                    name: '\uD83D\uDE80 Boosts',
                    value: 'Boost Count: **' + boosts + '**'
                        + '\nTier: **' + tierNames[boostTier] + '**',
                    inline: true,
                },
                { name: '\uD83D\uDCC5 Created', value: '<t:' + Math.floor(guild.createdTimestamp / 1000) + ':R>', inline: true },
                { name: '\uD83C\uDFF7\uFE0F Roles', value: '**' + guild.roles.cache.size + '**', inline: true },
                { name: '\uD83D\uDC64 Owner', value: '<@' + guild.ownerId + '>', inline: true },
                { name: '\uD83C\uDF0D Server ID', value: guild.id, inline: true },
            )
            .setFooter({ text: 'Requested by ' + interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'growth') {
        const gStats = getGuildStats(guild.id);
        const netGrowth = gStats.totalJoins - gStats.totalLeaves;
        const snapshots = gStats.dailySnapshots;

        let recentJoins = 0;
        let recentLeaves = 0;
        for (let i = snapshots.length - 1; i >= 0; i--) {
            const daysAgo = (Date.now() - new Date(snapshots[i].date).getTime()) / 86400000;
            if (daysAgo > 7) break;
            recentJoins += snapshots[i].joins;
            recentLeaves += snapshots[i].leaves;
        }

        const last7 = snapshots.slice(-7).map(s => {
            const change = s.joins - s.leaves;
            const arrow = change > 0 ? '\u2191' : (change < 0 ? '\u2193' : '\u2192');
            return '`' + s.date.slice(5) + '` ' + arrow + ' +' + s.joins + ' -' + s.leaves + ' (' + (change > 0 ? '+' : '') + change + ')';
        }).join('\n');

        const currentMembers = guild.memberCount;

        const embed = new EmbedBuilder()
            .setColor(0x00BFFF)
            .setAuthor({ name: guild.name, iconURL: guild.iconURL() })
            .setTitle('\uD83D\uDCC8 Member Growth')
            .setThumbnail(guild.iconURL({ size: 128 }))
            .addFields(
                {
                    name: '\uD83D\uDCCA Lifetime Totals',
                    value: 'Total Joins: **' + gStats.totalJoins + '**'
                        + '\nTotal Leaves: **' + gStats.totalLeaves + '**'
                        + '\nNet Growth: **' + (netGrowth >= 0 ? '+' : '') + netGrowth + '**'
                        + '\nCurrent: **' + formatNumber(currentMembers) + '** members',
                    inline: false,
                },
                {
                    name: '\uD83D\uDCC5 Last 7 Days',
                    value: 'Joins: **' + recentJoins + '** | Leaves: **' + recentLeaves + '**'
                        + '\nTrend: **' + (recentJoins - recentLeaves >= 0 ? '+' : '') + (recentJoins - recentLeaves) + '**',
                    inline: false,
                },
            )
            .setFooter({ text: 'Requested by ' + interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
            .setTimestamp();

        if (last7) {
            embed.addFields({ name: '\uD83D\uDCC5 Daily Breakdown', value: last7 });
        } else {
            embed.addFields({ name: '\uD83D\uDCC5 Daily Breakdown', value: '*Not enough data yet — stats started tracking after this feature was added.*' });
        }

        await interaction.reply({ embeds: [embed] });
    }
}

module.exports = {
    executePing,
    executeStatus,
    executeBotInfo,
    executeUserInfo,
    executeAvatar,
    executeStats,
};
