const { EmbedBuilder } = require('discord.js');
const { getInviterStats, getTopInviters, getGuildInviteStats } = require('../invites');

async function executeInvites(interaction) {
    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild;

    if (sub === 'check') {
        const targetUser = interaction.options.getUser('user');
        const userId = targetUser ? targetUser.id : interaction.user.id;
        const stats = getInviterStats(guild.id, userId);
        const isSelf = userId === interaction.user.id;

        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setAuthor({ name: targetUser ? targetUser.tag : interaction.user.tag, iconURL: (targetUser || interaction.user).displayAvatarURL() })
            .setTitle('📨 Invite Stats')
            .setDescription(targetUser
                ? '<@' + userId + '> has invited **' + stats.total + '** member' + (stats.total !== 1 ? 's' : '')
                : 'You have invited **' + stats.total + '** member' + (stats.total !== 1 ? 's' : ''))
            .setFooter({ text: guild.name, iconURL: guild.iconURL() })
            .setTimestamp();

        if (stats.joiners.length > 0) {
            const recent = stats.joiners.slice(0, 10).map(j =>
                '<@' + j.joiner_id + '> — <t:' + Math.floor(j.joined_at / 1000) + ':R>'
            ).join('\n');
            embed.addFields({ name: 'Recent Invites', value: recent });
        }            await interaction.reply({ embeds: [embed], ephemeral: interaction.user.id !== userId });

        } else if (sub === 'top') {
        const topLimit = interaction.options.getInteger('limit') || 10;
        const top = getTopInviters(guild.id, Math.min(topLimit, 25));

        if (top.length === 0) {
            return interaction.reply({ content: '📋 No invite data yet. Invites are tracked from now on.', ephemeral: true });
        }

        const maxCount = top[0].count;
        const lines = top.map((r, i) => {
            const barLen = Math.round((r.count / maxCount) * 20);
            const bar = '▰'.repeat(barLen) + '▱'.repeat(Math.max(0, 20 - barLen));
            return '`#' + (i + 1) + '` <@' + r.inviter_id + '> ' + bar + ' **' + r.count + '**';
        }).join('\n');

        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('🏆 Top Inviters')
            .setDescription(lines)
            .setFooter({ text: guild.name, iconURL: guild.iconURL() })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });

    } else if (sub === 'stats') {
        const top = getGuildInviteStats(guild.id);
        const totalInvites = top.reduce((a, r) => a + r.count, 0);

        const embed = new EmbedBuilder()
            .setColor(0x00BFFF)
            .setAuthor({ name: guild.name, iconURL: guild.iconURL() })
            .setTitle('📊 Server Invite Stats')
            .setDescription('**' + totalInvites + '** total invite' + (totalInvites !== 1 ? 's' : '') + ' tracked')
            .addFields(
                { name: 'Unique Inviters', value: '**' + top.length + '**', inline: true },
                { name: 'Avg per Inviter', value: top.length > 0 ? '**' + (totalInvites / top.length).toFixed(1) + '**' : '**0**', inline: true },
            )
            .setFooter({ text: guild.name, iconURL: guild.iconURL() })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
}

module.exports = { executeInvites };
