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
        } catch {}
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
