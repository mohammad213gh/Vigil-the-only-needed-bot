const { EmbedBuilder } = require('discord.js');
const { getBotConfig } = require('./config');

function makeEmbed(opts) {
    const botCfg = getBotConfig();
    const embed = new EmbedBuilder()
        .setColor(opts.color || botCfg.embedColor || 0x5865F2);

    if (opts.title) embed.setTitle(opts.title);
    if (opts.description) embed.setDescription(opts.description);
    if (opts.author) embed.setAuthor(opts.author);
    if (opts.thumbnail) embed.setThumbnail(opts.thumbnail);
    if (opts.image) embed.setImage(opts.image);
    if (opts.fields) embed.addFields(opts.fields);
    if (opts.timestamp) embed.setTimestamp();

    if (opts.footer) {
        embed.setFooter(opts.footer);
    } else if (botCfg.embedFooterText) {
        embed.setFooter({
            text: botCfg.embedFooterText,
            iconURL: botCfg.embedFooterIcon || undefined,
        });
    }

    return embed;
}

module.exports = { makeEmbed };
