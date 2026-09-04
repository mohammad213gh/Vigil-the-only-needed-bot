const { EmbedBuilder } = require('discord.js');
const { getThresholds, addThreshold, removeThreshold } = require('../warningThresholds');

async function executeThresholds(interaction) {
    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild;

    if (sub === 'add') {
        const warnCount = interaction.options.getInteger('warnings');
        const action = interaction.options.getString('action');
        const duration = interaction.options.getInteger('duration');

        addThreshold(guild.id, warnCount, action, duration);

        const embed = new EmbedBuilder()
            .setColor('Green')
            .setTitle('⚠️ Warning Threshold Added')
            .setDescription(
                'When a user reaches **' + warnCount + '** warnings, they will be **' + action + '**' +
                (action === 'timeout' ? ' for **' + (duration || 10) + ' minutes**' : '') + '.'
            )
            .setFooter({ text: 'Use /thresholds list to see all thresholds' })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    } else if (sub === 'remove') {
        const warnCount = interaction.options.getInteger('warnings');
        const result = removeThreshold(guild.id, warnCount);
        const stillExists = result.some(t => t.warnCount === warnCount);

        const embed = new EmbedBuilder()
            .setColor(stillExists ? 'Yellow' : 'Red')
            .setTitle(stillExists ? '⚠️ Failed to Remove' : '🗑️ Threshold Removed')
            .setDescription(stillExists
                ? 'Could not remove threshold for **' + warnCount + '** warnings.'
                : 'Auto-punishment for **' + warnCount + '** warnings has been removed.'
            )
            .setFooter({ text: 'Use /thresholds list to see current thresholds' })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    } else if (sub === 'list') {
        const thresholds = getThresholds(guild.id);

        if (thresholds.length === 0) {
            return interaction.reply({
                content: '📋 No warning thresholds configured. Use `/thresholds add <warnings> <action>` to set one.',
                ephemeral: true,
            });
        }

        const lines = thresholds.map(t =>
            '`' + t.warnCount + ' warns` → **' + t.action + '**' +
            (t.action === 'timeout' ? ' for **' + (t.duration || 10) + ' min**' : '')
        ).join('\n');

        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('⚠️ Warning Thresholds')
            .setDescription(lines)
            .setFooter({ text: thresholds.length + ' threshold(s) configured' })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
}

module.exports = { executeThresholds };
