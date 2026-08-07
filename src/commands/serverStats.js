// ──────────────────── /serverstats ────────────────────
// Manage live server stats channels: add/remove/list.
const { EmbedBuilder } = require('discord.js');
const { STAT_TYPES, setServerStat, removeServerStat, getServerStats, refreshGuildStats, formatStatName, computeStat } = require('../serverStats');

async function executeServerStats(interaction) {
    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild;

    if (sub === 'add') {
        const type = interaction.options.getString('type');
        const channel = interaction.options.getChannel('channel');
        const label = interaction.options.getString('label');

        if (!channel || channel.guildId !== guild.id) {
            return interaction.reply({ content: '❌ That channel is not in this server.', ephemeral: true });
        }
        if (channel.type === 4) { // GuildCategory
            return interaction.reply({ content: '❌ Categories can\'t hold a counter — pick a voice or text channel.', ephemeral: true });
        }
        if (channel.isThread && channel.isThread()) {
            return interaction.reply({ content: '❌ Threads can\'t hold a counter — pick a voice or text channel.', ephemeral: true });
        }
        if (!STAT_TYPES[type]) {
            return interaction.reply({ content: '❌ Unknown stat type. Valid: ' + Object.keys(STAT_TYPES).join(', '), ephemeral: true });
        }

        const res = setServerStat(guild.id, channel.id, type, label || null);
        if (res.error) {
            return interaction.reply({ content: '❌ ' + res.error, ephemeral: true });
        }

        await interaction.deferReply();
        await refreshGuildStats(guild);
        const row = getServerStats(guild.id).find(r => r.channel_id === channel.id);
        const value = computeStat(guild, guild.members, type);
        const name = formatStatName(type, value, label);
        return interaction.editReply({
            content: '✅ Counter set on <#' + channel.id + '> — the channel is now named **' + name + '**' +
                (row && type === 'online' && value === 0 ? '\nℹ️ Note: the **online** counter needs the **Presence Intent** enabled in the Discord Developer Portal to show live numbers.' : ''),
        });
    }

    if (sub === 'remove') {
        const channel = interaction.options.getChannel('channel');
        if (!channel || channel.guildId !== guild.id) {
            return interaction.reply({ content: '❌ That channel is not in this server.', ephemeral: true });
        }
        removeServerStat(guild.id, channel.id);
        return interaction.reply({ content: '✅ Stopped updating <#' + channel.id + '>.', ephemeral: true });
    }

    // list
    const rows = getServerStats(guild.id);
    if (!rows.length) {
        return interaction.reply({
            content: '📊 No stat channels configured. Use `/serverstats add <type> <channel>` — e.g. `/serverstats add members #members`.\nTypes: ' + Object.keys(STAT_TYPES).join(', '),
            ephemeral: true,
        });
    }

    const embed = new EmbedBuilder()
        .setColor(0x00BFFF)
        .setAuthor({ name: guild.name, iconURL: guild.iconURL() })
        .setTitle('📊 Server Stat Channels')
        .setDescription(rows.map(r => {
            const value = computeStat(guild, guild.members, r.stat_type);
            return '• <#' + r.channel_id + '> → **' + formatStatName(r.stat_type, value, r.label) + '**';
        }).join('\n'))
        .setFooter({ text: 'Updates live + every 10 minutes' })
        .setTimestamp();

    return interaction.reply({ embeds: [embed] });
}

module.exports = { executeServerStats };
