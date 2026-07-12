const { EmbedBuilder } = require('discord.js');
const { makeEmbed } = require('../embeds');

async function executeDashboard(interaction) {
    // Railway auto-sets RAILWAY_PUBLIC_DOMAIN. If that's missing (e.g. local dev),
    // we fall back nicely.
    const domain = process.env.RAILWAY_PUBLIC_DOMAIN;
    const dashUrl = domain
        ? 'https://' + domain
        : 'Your Railway URL (check your Railway dashboard → Settings → Networking)';

    const embed = makeEmbed({
        color: 0x5865F2,
        title: '🌐 Bot Dashboard',
        description: domain
            ? '**[🔗 Open Dashboard](' + dashUrl + ')**\n\n' +
              '> Password-protected — only you can access it.\n' +
              '> Manage servers, logs, permissions, reaction roles, reminders and more!'
            : 'Open your **Railway dashboard** → **Settings** → **Networking** to find your URL.\n\n' +
              'Then paste it into your `.env` file as:\n`RAILWAY_PUBLIC_DOMAIN=your-app.up.railway.app`\n\n' +
              'After that, this command will give you a clickable link!',
        fields: domain
            ? [
                { name: 'URL', value: dashUrl, inline: false },
                { name: 'Login', value: 'Use your `DASHBOARD_PASSWORD` to sign in', inline: false },
              ]
            : [
                { name: 'Need help?', value: 'Run `/deploy` first to register commands, then check Railway for your app URL.', inline: false },
              ],
        footer: { text: 'Dashboard v2.0' },
        timestamp: true,
    });

    await interaction.reply({ embeds: [embed] });
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

    // Give Discord time to receive the response, then exit
    setTimeout(() => {
        process.exit(0);
    }, 1500);
}

module.exports = { executeDashboard, executeShutdown };
