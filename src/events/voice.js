const { EmbedBuilder } = require('discord.js');

module.exports = [
    {
        name: 'voiceStateUpdate',
        once: false,
        execute: (deps) => async (oldState, newState) => {
            const user = newState.member?.user || oldState.member?.user;
            if (!user || user.bot) return;
            if (!oldState.guild) return;

            const guild = oldState.guild || newState.guild;

            // Joined voice
            if (!oldState.channelId && newState.channelId) {
                const embed = new EmbedBuilder()
                    .setColor(0x2ECC71)
                    .setAuthor({ name: user.tag, iconURL: user.displayAvatarURL() })
                    .setTitle('\uD83C\uDFA4 Voice Joined')
                    .setDescription(user + ' joined voice channel **' + newState.channel.name + '**')
                    .setThumbnail(user.displayAvatarURL({ size: 64 }))
                    .addFields(
                        { name: 'Channel', value: newState.channel.toString(), inline: true },
                        { name: 'User', value: String(user), inline: true },
                    )
                    .setFooter({ text: guild.name, iconURL: guild.iconURL() })
                    .setTimestamp();

                deps.sendLog(embed, 'voice', null, guild.id);
            }
            // Left voice
            else if (oldState.channelId && !newState.channelId) {
                const embed = new EmbedBuilder()
                    .setColor(0xE74C3C)
                    .setAuthor({ name: user.tag, iconURL: user.displayAvatarURL() })
                    .setTitle('\uD83C\uDFA4 Voice Left')
                    .setDescription(user + ' left voice channel **' + oldState.channel.name + '**')
                    .setThumbnail(user.displayAvatarURL({ size: 64 }))
                    .addFields(
                        { name: 'Channel', value: oldState.channel.toString(), inline: true },
                        { name: 'User', value: String(user), inline: true },
                    )
                    .setFooter({ text: guild.name, iconURL: guild.iconURL() })
                    .setTimestamp();

                deps.sendLog(embed, 'voice', null, guild.id);
            }
            // Moved voice
            else if (oldState.channelId !== newState.channelId) {
                const embed = new EmbedBuilder()
                    .setColor(0xF1C40F)
                    .setAuthor({ name: user.tag, iconURL: user.displayAvatarURL() })
                    .setTitle('\uD83C\uDFA4 Voice Moved')
                    .setDescription(user + ' moved from **' + oldState.channel.name + '** to **' + newState.channel.name + '**')
                    .setThumbnail(user.displayAvatarURL({ size: 64 }))
                    .addFields(
                        { name: 'From', value: oldState.channel.toString(), inline: true },
                        { name: 'To', value: newState.channel.toString(), inline: true },
                        { name: 'User', value: String(user), inline: true },
                    )
                    .setFooter({ text: guild.name, iconURL: guild.iconURL() })
                    .setTimestamp();

                deps.sendLog(embed, 'voice', null, guild.id);
            }
        },
    },
];
