const { EmbedBuilder } = require('discord.js');
const { getWelcomeConfig, getGoodbyeConfig, updateWelcomeConfig } = require('../config');
const { replacePlaceholders } = require('../helpers');

// ─── Shared helpers ───

function parseHex(hex) {
    if (!hex) return null;
    try {
        const c = parseInt(hex.replace('#', ''), 16);
        if (isNaN(c) || c < 0 || c > 0xFFFFFF) return null;
        return c;
    } catch { return null; }
}

function hexToInt(hex) {
    const c = parseHex(hex);
    return c || 0x5865F2;
}

// ─── Build a welcome/goodbye embed from config ───

function buildGreetingEmbed(cfg, member, type) {
    const embed = new EmbedBuilder()
        .setColor(hexToInt(cfg.embedColor));

    if (cfg.embedTitle) {
        embed.setTitle(replacePlaceholders(cfg.embedTitle, member, type));
    }
    if (cfg.embedDescription) {
        embed.setDescription(replacePlaceholders(cfg.embedDescription, member, type));
    }
    if (cfg.embedAuthor) {
        embed.setAuthor({
            name: replacePlaceholders(cfg.embedAuthor, member, type),
            iconURL: cfg.embedAuthorIcon || undefined,
        });
    }
    if (cfg.embedThumbnail) {
        embed.setThumbnail(replacePlaceholders(cfg.embedThumbnail, member, type));
    }
    if (cfg.embedImage) {
        embed.setImage(replacePlaceholders(cfg.embedImage, member, type));
    }
    if (cfg.embedFooter) {
        embed.setFooter({
            text: replacePlaceholders(cfg.embedFooter, member, type),
            iconURL: cfg.embedFooterIcon || undefined,
        });
    }
    embed.setTimestamp();

    return embed;
}

// ─── Build a config summary embed ───

function buildConfigEmbed(cfg, type, _guild) {
    const typeLabel = type === 'welcome' ? 'Welcome' : 'Goodbye';
    const lines = [
        '**Status:** ' + (cfg.enabled ? '✅ Enabled' : '❌ Disabled'),
        '**Channel:** ' + (cfg.channelId ? '<#' + cfg.channelId + '>' : '*Not set*'),
    ];
    if (cfg.content) lines.push('**Plain Text:** ' + cfg.content.slice(0, 200));
    if (cfg.embedTitle) lines.push('**Embed Title:** ' + cfg.embedTitle.slice(0, 100));
    if (cfg.embedDescription) lines.push('**Embed Description:** ' + cfg.embedDescription.slice(0, 200));
    if (cfg.embedColor) lines.push('**Embed Color:** `' + cfg.embedColor + '`');
    if (cfg.embedFooter) lines.push('**Embed Footer:** ' + cfg.embedFooter.slice(0, 100));
    if (cfg.embedThumbnail) lines.push('**Thumbnail:** ' + cfg.embedThumbnail.slice(0, 100));
    if (cfg.embedImage) lines.push('**Image:** ' + cfg.embedImage.slice(0, 100));
    if (cfg.embedAuthor) lines.push('**Author:** ' + cfg.embedAuthor.slice(0, 100));

    return new EmbedBuilder()
        .setColor(hexToInt(cfg.embedColor))
        .setTitle('\\uD83D\\uDC4B ' + typeLabel + ' Settings')
        .setDescription(lines.join('\\n'))
        .setFooter({ text: 'Placeholders: {user} {username} {server} {membercount} {userid} {age} {created}' })
        .setTimestamp();
}

// ─── Generic handler for welcome/goodbye subcommands ───

async function handleGreeting(interaction, type) {
    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild;
    const typeLabel = type === 'welcome' ? 'Welcome' : 'Goodbye';

    if (sub === 'channel') {
        const channel = interaction.options.getChannel('channel');
        updateWelcomeConfig(guild.id, type, (cfg) => {
            cfg.channelId = channel ? channel.id : null;
            if (channel) cfg.enabled = true;
            return cfg;
        });
        const cfg = type === 'welcome' ? getWelcomeConfig(guild.id) : getGoodbyeConfig(guild.id);
        const embed = new EmbedBuilder()
            .setColor(channel ? 'Green' : 'Red')
            .setTitle('\\uD83D\\uDCE6 ' + typeLabel + ' Channel ' + (channel ? 'Set' : 'Cleared'))
            .setDescription(channel
                ? typeLabel + ' messages will be sent to ' + channel
                : typeLabel + ' channel has been cleared. ' + (cfg.enabled ? 'Messages are still enabled but won\'t send without a channel.' : ''))
            .setFooter({ text: 'Changed by ' + interaction.user.tag })
            .setTimestamp();
        await interaction.reply({ embeds: [embed], ephemeral: true });
    } else if (sub === 'toggle') {
        const enabled = interaction.options.getBoolean('enabled');
        updateWelcomeConfig(guild.id, type, (cfg) => {
            cfg.enabled = enabled;
            return cfg;
        });
        const embed = new EmbedBuilder()
            .setColor(enabled ? 'Green' : 'Red')
            .setTitle('\\uD83D\\uDD04 ' + typeLabel + ' ' + (enabled ? 'Enabled' : 'Disabled'))
            .setDescription(typeLabel + ' messages are now ' + (enabled ? '✅ **enabled**' : '❌ **disabled**'))
            .setFooter({ text: 'Changed by ' + interaction.user.tag })
            .setTimestamp();
        await interaction.reply({ embeds: [embed], ephemeral: true });
    } else if (sub === 'message') {
        const text = interaction.options.getString('text');
        updateWelcomeConfig(guild.id, type, (cfg) => {
            cfg.content = (text && text.toLowerCase() !== 'clear' && text.toLowerCase() !== 'none') ? text : null;
            return cfg;
        });
        const embed = new EmbedBuilder()
            .setColor(text ? 'Green' : 'Red')
            .setTitle('\\uD83D\\uDCAC ' + typeLabel + ' Message ' + (text ? 'Set' : 'Cleared'))
            .setDescription(text
                ? 'Plain text message set.\\n```' + text.slice(0, 500) + '```'
                : 'Plain text message cleared.')
            .addFields({ name: '\\uD83D\\uDCA1 Placeholders', value: '`{user}` `{username}` `{server}` `{membercount}` `{userid}` `{age}` `{created}`' })
            .setFooter({ text: 'Changed by ' + interaction.user.tag })
            .setTimestamp();
        await interaction.reply({ embeds: [embed], ephemeral: true });
    } else if (sub === 'title') {
        const text = interaction.options.getString('text');
        updateWelcomeConfig(guild.id, type, (cfg) => {
            cfg.embedTitle = (text && text.toLowerCase() !== 'clear' && text.toLowerCase() !== 'none') ? text : null;
            return cfg;
        });
        const embed = new EmbedBuilder()
            .setColor('Green')
            .setTitle('\\uD83D\\uDCDD ' + typeLabel + ' Embed Title ' + (text ? 'Updated' : 'Cleared'))
            .setDescription(text ? 'Title set to: **' + text.slice(0, 256) + '**' : 'Embed title cleared.')
            .setFooter({ text: 'Changed by ' + interaction.user.tag })
            .setTimestamp();
        await interaction.reply({ embeds: [embed], ephemeral: true });
    } else if (sub === 'description') {
        const text = interaction.options.getString('text');
        updateWelcomeConfig(guild.id, type, (cfg) => {
            cfg.embedDescription = (text && text.toLowerCase() !== 'clear' && text.toLowerCase() !== 'none') ? text : null;
            return cfg;
        });
        const embed = new EmbedBuilder()
            .setColor('Green')
            .setTitle('\\uD83D\\uDCDD ' + typeLabel + ' Embed Description ' + (text ? 'Updated' : 'Cleared'))
            .setDescription(text ? 'Description set.```' + text.slice(0, 1000) + '```' : 'Embed description cleared.')
            .setFooter({ text: 'Changed by ' + interaction.user.tag })
            .setTimestamp();
        await interaction.reply({ embeds: [embed], ephemeral: true });
    } else if (sub === 'color') {
        const hex = interaction.options.getString('hex');
        if (hex && parseHex(hex) === null) {
            return interaction.reply({ content: '\\u26A0\\uFE0F Invalid hex color! Use format like `#5865F2` or `FF5733`.', ephemeral: true });
        }
        updateWelcomeConfig(guild.id, type, (cfg) => {
            cfg.embedColor = hex || null;
            return cfg;
        });
        const embed = new EmbedBuilder()
            .setColor(hex ? parseHex(hex) : 0x5865F2)
            .setTitle('\\uD83C\\uDFA8 ' + typeLabel + ' Embed Color ' + (hex ? 'Updated' : 'Reset'))
            .setDescription(hex ? 'Color set to `' + hex + '`' : 'Color reset to default.')
            .setFooter({ text: 'Changed by ' + interaction.user.tag })
            .setTimestamp();
        await interaction.reply({ embeds: [embed], ephemeral: true });
    } else if (sub === 'footer') {
        const text = interaction.options.getString('text');
        const icon = interaction.options.getString('icon');
        updateWelcomeConfig(guild.id, type, (cfg) => {
            cfg.embedFooter = (text && text.toLowerCase() !== 'clear' && text.toLowerCase() !== 'none') ? text : null;
            cfg.embedFooterIcon = (icon && icon.toLowerCase() !== 'clear' && icon.toLowerCase() !== 'none') ? icon : null;
            return cfg;
        });
        const embed = new EmbedBuilder()
            .setColor('Green')
            .setTitle('\\uD83D\\uDCDD ' + typeLabel + ' Embed Footer ' + (text ? 'Updated' : 'Cleared'))
            .setDescription(text ? 'Footer set to: **' + text.slice(0, 200) + '**' + (icon ? '\\nWith icon: ' + icon : '') : 'Embed footer cleared.')
            .setFooter({ text: 'Changed by ' + interaction.user.tag })
            .setTimestamp();
        await interaction.reply({ embeds: [embed], ephemeral: true });        } else if (sub === 'thumbnail') {
        const url = interaction.options.getString('url');
        updateWelcomeConfig(guild.id, type, (cfg) => {
            cfg.embedThumbnail = (url && url.toLowerCase() !== 'clear' && url.toLowerCase() !== 'none') ? url : null;
            return cfg;
        });
        const embed = new EmbedBuilder()
            .setColor('Green')
            .setTitle('\\uD83D\\uDDBC\\uFE0F ' + typeLabel + ' Thumbnail ' + (url ? 'Set' : 'Cleared'))
            .setDescription(url ? 'Thumbnail URL set.' : 'Thumbnail cleared.')
            .setThumbnail(url || null)
            .setFooter({ text: 'Changed by ' + interaction.user.tag })
            .setTimestamp();
        await interaction.reply({ embeds: [embed], ephemeral: true });
    } else if (sub === 'image') {
        const url = interaction.options.getString('url');
        updateWelcomeConfig(guild.id, type, (cfg) => {
            cfg.embedImage = (url && url.toLowerCase() !== 'clear' && url.toLowerCase() !== 'none') ? url : null;
            return cfg;
        });
        const embed = new EmbedBuilder()
            .setColor('Green')
            .setTitle('\\uD83D\\uDDBC\\uFE0F ' + typeLabel + ' Image ' + (url ? 'Set' : 'Cleared'))
            .setDescription(url ? 'Image URL set.' : 'Image cleared.')
            .setImage(url || null)
            .setFooter({ text: 'Changed by ' + interaction.user.tag })
            .setTimestamp();
        await interaction.reply({ embeds: [embed], ephemeral: true });
    } else if (sub === 'author') {
        const name = interaction.options.getString('name');
        const icon = interaction.options.getString('icon');
        updateWelcomeConfig(guild.id, type, (cfg) => {
            cfg.embedAuthor = (name && name.toLowerCase() !== 'clear' && name.toLowerCase() !== 'none') ? name : null;
            cfg.embedAuthorIcon = (icon && icon.toLowerCase() !== 'clear' && icon.toLowerCase() !== 'none') ? icon : null;
            return cfg;
        });
        const embed = new EmbedBuilder()
            .setColor('Green')
            .setTitle('\\uD83D\\uDC64 ' + typeLabel + ' Embed Author ' + (name ? 'Updated' : 'Cleared'))
            .setDescription(name ? 'Author set to: **' + name.slice(0, 100) + '**' + (icon ? '\\nWith icon: ' + icon : '') : 'Embed author cleared.')
            .setFooter({ text: 'Changed by ' + interaction.user.tag })
            .setTimestamp();
        await interaction.reply({ embeds: [embed], ephemeral: true });
    } else if (sub === 'show') {
        const cfg = type === 'welcome' ? getWelcomeConfig(guild.id) : getGoodbyeConfig(guild.id);
        const embed = buildConfigEmbed(cfg, type, guild);
        await interaction.reply({ embeds: [embed], ephemeral: true });
    } else if (sub === 'test') {
        const cfg = type === 'welcome' ? getWelcomeConfig(guild.id) : getGoodbyeConfig(guild.id);
        if (!cfg.channelId) {
            return interaction.reply({ content: '\\u26A0\\uFE0F No ' + typeLabel.toLowerCase() + ' channel is set! Use `/' + type + ' channel #channel` first.', ephemeral: true });
        }
        if (!cfg.enabled) {
            return interaction.reply({ content: '\\u26A0\\uFE0F ' + typeLabel + ' messages are disabled! Use `/' + type + ' toggle true` to enable.', ephemeral: true });
        }

        const channel = guild.channels.cache.get(cfg.channelId);
        if (!channel) {
            return interaction.reply({ content: '\\u26A0\\uFE0F The ' + typeLabel.toLowerCase() + ' channel no longer exists. Set a new one with `/' + type + ' channel #channel`.', ephemeral: true });
        }

        // Use the bot itself as a proxy member for testing
        const testMember = guild.members.me;

        try {
            const messageContent = cfg.content ? replacePlaceholders(cfg.content, testMember, type) : '';
            const embed = buildGreetingEmbed(cfg, testMember, type);

            await channel.send({ content: messageContent || undefined, embeds: [embed] });
            await interaction.reply({ content: '\\u2705 Test ' + typeLabel.toLowerCase() + ' message sent to ' + channel, ephemeral: true });
        } catch (err) {
            await interaction.reply({ content: '\\u26A0\\uFE0F Failed to send test message: ' + err.message, ephemeral: true });
        }
    } else if (sub === 'reset') {
        updateWelcomeConfig(guild.id, type, (cfg) => {
            // Return a clean default — effectively resetting
            const fresh = type === 'welcome'
                ? { enabled: false, channelId: null, content: null, embedTitle: '👋 Welcome!', embedDescription: 'Welcome {user} to **{server}**!', embedColor: '#5865F2', embedFooter: 'Member #{membercount}', embedFooterIcon: null, embedThumbnail: null, embedImage: null, embedAuthor: null, embedAuthorIcon: null }
                : { enabled: false, channelId: null, content: null, embedTitle: '👋 Goodbye!', embedDescription: '{user} has left **{server}**.', embedColor: '#E74C3C', embedFooter: 'Member #{membercount}', embedFooterIcon: null, embedThumbnail: null, embedImage: null, embedAuthor: null, embedAuthorIcon: null };
            Object.assign(cfg, fresh);
            return cfg;
        });
        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('\\uD83D\\uDD04 ' + typeLabel + ' Reset to Defaults')
            .setDescription(typeLabel + ' settings have been reset to their defaults.')
            .setFooter({ text: 'Changed by ' + interaction.user.tag })
            .setTimestamp();
        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
}

async function executeWelcome(interaction) {
    await handleGreeting(interaction, 'welcome');
}

async function executeGoodbye(interaction) {
    await handleGreeting(interaction, 'goodbye');
}

module.exports = {
    executeWelcome,
    executeGoodbye,
    buildGreetingEmbed,
    buildConfigEmbed,
};
