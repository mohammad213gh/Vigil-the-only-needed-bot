const { EmbedBuilder } = require('discord.js');
const { makeEmbed } = require('../embeds');

async function executeDashboard(interaction) {
    const domain = process.env.RAILWAY_PUBLIC_DOMAIN;
    const dashUrl = domain ? 'https://' + domain : 'Unknown (check Railway Settings → Networking)';

    const embed = makeEmbed({
        color: 0x5865F2,
        title: '\uD83C\uDF10 Bot Dashboard',
        description: domain
            ? '**[Open Dashboard](' + dashUrl + ')**\n\nUse your `DASHBOARD_PASSWORD` to sign in.'
            : 'Go to **Railway Dashboard** \u2192 **Settings** \u2192 **Networking** \u2192 **Generate Domain**\nThen add `RAILWAY_PUBLIC_DOMAIN` to your env vars.',
        footer: { text: 'Dashboard v2.0' },
        timestamp: true,
    });
    await interaction.reply({ embeds: [embed] });
}

async function executeDashAccess(interaction) {
    const sub = interaction.options.getSubcommand();
    const { addDashUser, removeDashUser, getDashUsers } = require('../dashboard');

    if (sub === 'add') {
        const user = interaction.options.getUser('user');
        if (!user) return interaction.reply({ content: 'Please specify a user.', ephemeral: true });
        addDashUser(user.id, interaction.user.tag);
        const embed = makeEmbed({
            color: 'Green',
            title: '\u2705 Dashboard Access Granted',
            description: '<@' + user.id + '> can now log into the dashboard using their Discord ID.',
            fields: [
                { name: 'User', value: user.tag + ' (' + user.id + ')', inline: false },
                { name: 'Login', value: 'Go to the dashboard URL \u2192 choose **"Discord ID"** \u2192 enter their ID.', inline: false },
            ],
        });
        await interaction.reply({ embeds: [embed] });
    } else if (sub === 'remove') {
        const userId = interaction.options.getString('user_id');
        removeDashUser(userId);
        const embed = makeEmbed({
            color: 'Red',
            title: '\u274C Dashboard Access Revoked',
            description: 'User `' + userId + '` can no longer log into the dashboard.',
        });
        await interaction.reply({ embeds: [embed] });
    } else if (sub === 'list') {
        const users = getDashUsers();
        const entries = Object.entries(users).filter(([, u]) => u.active);
        if (!entries.length) {
            return interaction.reply({ embeds: [makeEmbed({
                color: 'Yellow',
                title: '\uD83D\uDC40 Dashboard Users',
                description: 'No users have been granted dashboard access yet.\nUse `/dashaccess add @user` to grant access.',
            })] });
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

async function executeShutdown(interaction) {
    const embed = makeEmbed({
        color: 'Red',
        title: '\uD83D\uDCA4 Shutting Down',
        description: 'Bot is going offline. Goodbye!',
        footer: { text: 'Shutdown by ' + interaction.user.tag },
        timestamp: true,
    });
    await interaction.reply({ embeds: [embed] });
    setTimeout(() => process.exit(0), 1500);
}

module.exports = { executeDashboard, executeDashAccess, executeShutdown };
