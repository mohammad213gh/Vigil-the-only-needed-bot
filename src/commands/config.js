const { EmbedBuilder } = require('discord.js');
const { getBotConfig, saveBotConfig, getGuildConfig, updateGuildConfig } = require('../config');
const { makeEmbed } = require('../embeds');
const { CATEGORY_EMOJIS, LOG_CATEGORIES } = require('../constants');

async function executeLog(interaction) {
    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild;

    if (sub === 'channel') {
        const type = interaction.options.getString('type');
        const channel = interaction.options.getChannel('channel');

        // Use atomic updateGuildConfig to prevent race conditions
        updateGuildConfig(guild.id, (guildConfig) => {
            if (channel) {
                guildConfig.logChannels[type] = channel.id;
            } else {
                guildConfig.logChannels[type] = null;
            }
            return guildConfig;
        });

        const emoji = CATEGORY_EMOJIS[type] || '\uD83D\uDD35';
        const embed = new EmbedBuilder()
            .setColor(channel ? 'Green' : 'Red')
            .setTitle(emoji + ' Log Channel: ' + type.charAt(0).toUpperCase() + type.slice(1))
            .setDescription(channel
                ? '**' + type + '** logs will be sent to ' + channel
                : '**' + type + '** log channel cleared (will use default)')
            .setFooter({ text: 'Changed by ' + interaction.user.tag })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    } else if (sub === 'toggle') {
        const category = interaction.options.getString('category');
        const enabled = interaction.options.getBoolean('enabled');

        updateGuildConfig(guild.id, (guildConfig) => {
            guildConfig.logCategories[category] = enabled;
            return guildConfig;
        });

        const status = enabled ? '\u2705 Enabled' : '\u274C Disabled';
        const embed = new EmbedBuilder()
            .setColor(enabled ? 'Green' : 'Red')
            .setTitle('\uD83D\uDD0D Log Category: ' + category.charAt(0).toUpperCase() + category.slice(1))
            .setDescription('**' + category + '** logs are now ' + status)
            .setFooter({ text: 'Changed by ' + interaction.user.tag })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    } else if (sub === 'list') {
        const guildConfig = getGuildConfig(guild.id);
        const lines = [];
        const cats = guildConfig.logCategories;
        const chs = guildConfig.logChannels;
        for (const c of LOG_CATEGORIES) {
            const emoji = CATEGORY_EMOJIS[c] || '\uD83D\uDD35';
            const toggle = cats[c] ? '\u2705' : '\u274C';
            const ch = chs[c] ? '<#' + chs[c] + '>' : '*default*';
            lines.push(toggle + ' ' + emoji + ' **' + c.charAt(0).toUpperCase() + c.slice(1) + '** → ' + ch);
        }
        if (guildConfig.logChannelId) {
            lines.push('\n\uD83D\uDCC0 **Default fallback:** <#' + guildConfig.logChannelId + '>');
        }
        if (guildConfig.trackedChannels.length > 0) {
            const tracked = guildConfig.trackedChannels.map(id => '<#' + id + '>').join(' ');
            lines.push('\uD83D\uDCE1 **Tracked channels:** ' + tracked);
        } else {
            lines.push('\uD83D\uDCE1 **Tracked channels:** All');
        }

        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('\uD83D\uDD0D Logging Configuration')
            .setDescription(lines.join('\n'))
            .setFooter({ text: guild.name, iconURL: guild.iconURL() })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
}

async function executeEmbedConfig(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'footer') {
        const text = interaction.options.getString('text') || null;
        const icon = interaction.options.getString('icon') || null;

        saveBotConfig({ embedFooterText: text, embedFooterIcon: icon });

        if (text) {
            const embed = makeEmbed({
                color: 'Green',
                title: '\uD83D\uDCDD Embed Footer Set',
                description: 'Custom footer: "' + text + '"' + (icon ? '\nWith icon: ' + icon : ''),
                footer: { text: 'Changed by ' + interaction.user.tag },
                timestamp: true,
            });
            await interaction.reply({ embeds: [embed] });
        } else {
            const embed = makeEmbed({
                color: 'Red',
                title: '\uD83D\uDDD1\uFE0F Embed Footer Cleared',
                description: 'Custom embed footer has been removed.',
                footer: { text: 'Changed by ' + interaction.user.tag },
                timestamp: true,
            });
            await interaction.reply({ embeds: [embed] });
        }
    } else if (sub === 'color') {
        const hexRaw = interaction.options.getString('hex');

        if (hexRaw.toLowerCase() === 'clear' || hexRaw.toLowerCase() === 'reset') {
            saveBotConfig({ embedColor: null });
            const embed = makeEmbed({
                color: 0x5865F2,
                title: '\uD83C\uDFA8 Embed Color Reset',
                description: 'Default embed color restored to Discord Blurple.',
                footer: { text: 'Changed by ' + interaction.user.tag },
                timestamp: true,
            });
            await interaction.reply({ embeds: [embed] });
            return;
        }

        let color = 0x5865F2;
        try {
            color = parseInt(hexRaw.replace('#', ''), 16);
            if (isNaN(color) || color < 0 || color > 0xFFFFFF) throw new Error();
        } catch {
            return interaction.reply({ content: '\u26A0\uFE0F Invalid hex color! Use format like `#5865F2` or `FF5733`.', ephemeral: true });
        }

        saveBotConfig({ embedColor: color });

        const embed = makeEmbed({
            color: color,
            title: '\uD83C\uDFA8 Embed Color Updated',
            description: 'Default embed color set to `#' + color.toString(16).toUpperCase().padStart(6, '0') + '`',
            footer: { text: 'Changed by ' + interaction.user.tag },
            timestamp: true,
        });
        await interaction.reply({ embeds: [embed] });
    } else if (sub === 'show') {
        const botCfg = getBotConfig();
        const lines = [];
        lines.push('**Footer Text:** ' + (botCfg.embedFooterText || '*Not set*'));
        lines.push('**Footer Icon:** ' + (botCfg.embedFooterIcon || '*Not set*'));
        lines.push('**Embed Color:** ' + (botCfg.embedColor ? '`#' + botCfg.embedColor.toString(16).toUpperCase().padStart(6, '0') + '`' : '*Default (Blurple)*'));

        const embed = makeEmbed({
            color: botCfg.embedColor || 0x5865F2,
            title: '\u2699\uFE0F Embed Configuration',
            description: lines.join('\n'),
            footer: { text: interaction.guild.name, iconURL: interaction.guild.iconURL() },
            timestamp: true,
        });
        await interaction.reply({ embeds: [embed] });
    }
}

async function executePresence(interaction) {
    const type = interaction.options.getString('type');
    const text = interaction.options.getString('text');

    const activityTypes = {
        playing: 0,
        watching: 3,
        listening: 2,
        competing: 5,
    };

    try {
        interaction.client.user.setPresence({
            activities: [{
                name: text,
                type: activityTypes[type] || 0,
            }],
            status: 'online',
        });

        const embed = makeEmbed({
            color: 'Green',
            title: '\uD83C\uDFAE Presence Updated',
            description: 'Bot is now **' + type + '** "' + text + '"',
            footer: { text: 'Changed by ' + interaction.user.tag },
            timestamp: true,
        });

        await interaction.reply({ embeds: [embed] });
    } catch (err) {
        await interaction.reply({ content: '\u26A0\uFE0F Failed to set presence: ' + err.message, ephemeral: true }).catch(() => {});
    }
}

async function executeBotAvatar(interaction) {
    const url = interaction.options.getString('url');

    await interaction.deferReply({ ephemeral: false });

    try {
        await interaction.client.user.setAvatar(url);
        const embed = makeEmbed({
            color: 'Green',
            title: '\uD83D\uDDBC\uFE0F Avatar Changed',
            description: 'Bot avatar has been updated!',
            image: url,
            footer: { text: 'Changed by ' + interaction.user.tag },
            timestamp: true,
        });
        await interaction.editReply({ embeds: [embed] });
    } catch (err) {
        await interaction.editReply({ content: '\u26A0\uFE0F Failed to change avatar: ' + err.message + '\nMake sure the URL is a direct image link (e.g. ending in .png/.jpg/.gif).' });
    }
}

async function executeBotName(interaction) {
    const name = interaction.options.getString('name');

    if (name.length > 32) {
        return interaction.reply({ content: '\u26A0\uFE0F Username must be 32 characters or less.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: false });

    try {
        const oldName = interaction.client.user.username;
        await interaction.client.user.setUsername(name);
        const embed = makeEmbed({
            color: 'Green',
            title: '\u270F\uFE0F Username Changed',
            description: 'Bot name changed from **' + oldName + '** to **' + name + '**',
            footer: { text: 'Changed by ' + interaction.user.tag },
            timestamp: true,
        });
        await interaction.editReply({ embeds: [embed] });
    } catch (err) {
        await interaction.editReply({ content: '\u26A0\uFE0F Failed to change username: ' + err.message + '\nNote: Discord limits username changes to 2 per hour.' });
    }
}

module.exports = {
    executeLog,
    executeEmbedConfig,
    executePresence,
    executeBotAvatar,
    executeBotName,
};
