const { EmbedBuilder } = require('discord.js');
const { CHANNEL_TYPE_NAMES } = require('../constants');

module.exports = [
    {
        name: 'channelCreate',
        once: false,
        execute: (deps) => async (channel) => {
            if (!channel.guild) return;
            const typeName = CHANNEL_TYPE_NAMES[channel.type] || 'Unknown';

            const embed = new EmbedBuilder()
                .setColor(0x2ECC71)
                .setTitle('\uD83D\uDCE6 Channel Created')
                .setDescription('A new **' + typeName + '** channel was created')
                .addFields(
                    { name: 'Name', value: channel.name, inline: true },
                    { name: 'Type', value: typeName, inline: true },
                    { name: 'Channel', value: channel.toString(), inline: true },
                    { name: 'ID', value: channel.id, inline: true },
                )
                .setFooter({ text: channel.guild.name, iconURL: channel.guild.iconURL() })
                .setTimestamp();

            deps.sendLog(embed, 'server', null, channel.guild.id);
        },
    },
    {
        name: 'channelDelete',
        once: false,
        execute: (deps) => async (channel) => {
            if (!channel.guild) return;
            const typeName = CHANNEL_TYPE_NAMES[channel.type] || 'Unknown';

            const embed = new EmbedBuilder()
                .setColor(0xE74C3C)
                .setTitle('\uD83D\uDCE6 Channel Deleted')
                .setDescription('A **' + typeName + '** channel was deleted')
                .addFields(
                    { name: 'Name', value: channel.name, inline: true },
                    { name: 'Type', value: typeName, inline: true },
                    { name: 'ID', value: channel.id, inline: true },
                )
                .setFooter({ text: channel.guild.name, iconURL: channel.guild.iconURL() })
                .setTimestamp();

            deps.sendLog(embed, 'server', null, channel.guild.id);
        },
    },
    {
        name: 'channelUpdate',
        once: false,
        execute: (deps) => async (oldChannel, newChannel) => {
            if (!newChannel.guild) return;
            if (oldChannel.name === newChannel.name) return;

            const embed = new EmbedBuilder()
                .setColor(0xF1C40F)
                .setTitle('\uD83D\uDCE6 Channel Renamed')
                .setDescription('A channel was renamed')
                .addFields(
                    { name: 'Before', value: oldChannel.name || '*Unknown*', inline: true },
                    { name: 'After', value: newChannel.name, inline: true },
                    { name: 'Channel', value: newChannel.toString(), inline: true },
                    { name: 'ID', value: newChannel.id, inline: true },
                )
                .setFooter({ text: newChannel.guild.name, iconURL: newChannel.guild.iconURL() })
                .setTimestamp();

            deps.sendLog(embed, 'server', null, newChannel.guild.id);
        },
    },
];
