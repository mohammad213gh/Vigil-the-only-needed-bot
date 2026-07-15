const { EmbedBuilder } = require('discord.js');
const { makeEmbed } = require('../embeds');
const { logError } = require('../logError');

async function executeDashboard(interaction) {
    // Support both Railway's auto-domain and generic DASHBOARD_URL
    const dashUrl = process.env.DASHBOARD_URL || (process.env.RAILWAY_PUBLIC_DOMAIN ? 'https://' + process.env.RAILWAY_PUBLIC_DOMAIN : null);

    const embed = makeEmbed({
        color: 0x5865F2,
        title: '\uD83C\uDF10 Bot Dashboard',
        description: dashUrl
            ? '**[Open Dashboard](' + dashUrl + ')**\n\nSign in with your dashboard password.'
            : 'Set `DASHBOARD_URL` in your .env file to the public URL of your dashboard.\n\nIf using Railway, the `RAILWAY_PUBLIC_DOMAIN` env var is auto-set.',
        footer: { text: 'Dashboard v2.0' },
        timestamp: true,
    });
    await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function executeDashAccess(interaction) {
    const sub = interaction.options.getSubcommand();
    const { addDashUser, removeDashUser, getDashUsers } = require('../dashboard');

    if (sub === 'add') {
        const user = interaction.options.getUser('user');
        if (!user) return interaction.reply({ content: 'Please specify a user.', ephemeral: true });
        const result = addDashUser(user.id, interaction.user.tag);
        const token = result.accessToken;
        // DM the user their access token
        let dmSent = false;
        try {
            await user.send('**\u2705 Dashboard Access Granted**\n\nYou can now log into the bot dashboard using your Discord ID and this access token:\n\n**Access Token:** `' + token + '`\n\nGo to the dashboard URL \u2192 **Discord ID** tab \u2192 enter your ID and this token.\n\n\u26A0\uFE0F **Keep this token private.** Do not share it with anyone.');
            dmSent = true;
        } catch (err) {
            logError(err, 'commands', 'dashaccess DM to ' + user.id);
        }
        const embed = makeEmbed({
            color: 'Green',
            title: '\u2705 Dashboard Access Granted',
            description: '<@' + user.id + '> can now log into the dashboard.\n' + (dmSent ? '\u2709\uFE0F Token sent via DM.' : '\u26A0\uFE0F Could not DM the user. Token shown below.'),
            fields: dmSent ? [] : [
                { name: 'Access Token', value: '`' + token + '`\nShare this with them privately.', inline: false },
            ],
        });
        await interaction.reply({ embeds: [embed], ephemeral: true });
    } else if (sub === 'remove') {
        const user = interaction.options.getUser('user');
        if (!user) return interaction.reply({ content: 'Please specify a user.', ephemeral: true });
        const result = removeDashUser(user.id);
        if (!result) {
            return interaction.reply({ content: 'User <@' + user.id + '> was not found in the dashboard access list.', ephemeral: true });
        }
        const embed = makeEmbed({
            color: 'Red',
            title: '\u274C Dashboard Access Revoked',
            description: '<@' + user.id + '> (' + user.id + ') can no longer log into the dashboard.\nThey have been logged out of any active sessions.',
        });
        await interaction.reply({ embeds: [embed], ephemeral: true });
    } else if (sub === 'list') {
        const users = getDashUsers();
        const entries = Object.entries(users).filter(([, u]) => u.active);
        if (!entries.length) {
            return interaction.reply({ embeds: [makeEmbed({
                color: 'Yellow',
                title: '\uD83D\uDC40 Dashboard Users',
                description: 'No users have been granted dashboard access yet.\nUse `/dashaccess add @user` to grant access.',
            })], ephemeral: true });
        }
        const embed = makeEmbed({
            color: 0x5865F2,
            title: '\uD83D\uDC40 Dashboard Users (' + entries.length + ')',
            description: entries.map(([id, u]) =>
                '<@' + id + '> \u2014 Added <t:' + Math.floor(u.addedAt / 1000) + ':R> by ' + u.addedBy
            ).join('\n'),
        });
        await interaction.reply({ embeds: [embed] });
    }
}

async function executeServerLeave(interaction) {
    const guildId = interaction.options.getString('server_id');
    if (!guildId) return interaction.reply({ content: '\u26A0\uFE0F Please provide a server ID.', ephemeral: true });

    const guild = interaction.client.guilds.cache.get(guildId);
    if (!guild) return interaction.reply({ content: '\u26A0\uFE0F I\'m not in a server with that ID.', ephemeral: true });

    const guildName = guild.name;
    try {
        await guild.leave();
        const embed = makeEmbed({
            color: 'Red',
            title: '\uD83D\uDC4B Left Server',
            description: 'Successfully left **' + guildName + '** (' + guildId + ').',
            footer: { text: 'Forced leave by ' + interaction.user.tag },
            timestamp: true,
        });
        await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (err) {
        await interaction.reply({ content: '\u274C Failed to leave: ' + err.message, ephemeral: true });
    }
}

async function executeShutdown(interaction) {
    const embed = makeEmbed({
        color: 'Red',
        title: '\uD83D\uDCA4 Shutting Down',
        description: 'Bot is going offline. Goodbye!',
        footer: { text: 'Shutdown by ' + interaction.user.tag },
        timestamp: true,
    });
    await interaction.reply({ embeds: [embed], ephemeral: true });
    setTimeout(() => process.exit(0), 1500);
}

module.exports = { executeDashboard, executeDashAccess, executeServerLeave, executeShutdown };
