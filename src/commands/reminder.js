const { EmbedBuilder } = require('discord.js');
const { addReminder, removeReminder, getUserReminders } = require('../reminders');
const { formatDuration, parseDuration } = require('../helpers');
const { makeEmbed } = require('../embeds');

async function executeRemindMe(interaction) {
    const timeStr = interaction.options.getString('time');
    const text = interaction.options.getString('text');

    const ms = parseDuration(timeStr);
    if (!ms) {
        return interaction.reply({
            content: '\u26A0\uFE0F Invalid time format! Use e.g. `30s`, `5m`, `2h`, `1d` or combine like `1h30m`.',
            ephemeral: true,
        });
    }

    if (ms < 10000) {
        return interaction.reply({
            content: '\u26A0\uFE0F Minimum reminder time is 10 seconds.',
            ephemeral: true,
        });
    }

    if (ms > 2592000000) {
        return interaction.reply({
            content: '\u26A0\uFE0F Maximum reminder time is 30 days.',
            ephemeral: true,
        });
    }

    const reminder = addReminder(interaction.user.id, interaction.channelId, text, ms);

    const embed = makeEmbed({
        color: 0x5865F2,
        title: '\u23F0 Reminder Set',
        description: 'I\'ll remind you in **' + formatDuration(ms) + '**',
        fields: [
            { name: 'Reminder', value: text },
            { name: 'ID', value: '`' + reminder.id + '`' },
        ],
        footer: { text: 'You\'ll receive a DM when the time is up' },
        timestamp: true,
    });

    await interaction.reply({ embeds: [embed] });
}

async function executeReminders(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'list') {
        const reminders = getUserReminders(interaction.user.id);

        if (reminders.length === 0) {
            const embed = makeEmbed({
                color: 0x5865F2,
                title: '\u23F0 Your Reminders',
                description: 'You have no active reminders. Use `/remindme` to set one!',
                timestamp: true,
            });
            return interaction.reply({ embeds: [embed] });
        }

        const fields = reminders.map(r => ({
            name: 'In ' + formatDuration(r.remindAt - Date.now()),
            value: r.text.slice(0, 200) + '\nID: `' + r.id + '`',
            inline: false,
        }));

        // Split into chunks of 5 fields (embed limit is 25)
        const chunks = [];
        for (let i = 0; i < fields.length; i += 5) {
            chunks.push(fields.slice(i, i + 5));
        }

        const embeds = chunks.map((chunk, i) => makeEmbed({
            color: 0x5865F2,
            title: '\u23F0 Your Reminders' + (chunks.length > 1 ? ' (' + (i + 1) + '/' + chunks.length + ')' : ''),
            description: 'Total: **' + reminders.length + '** active reminder' + (reminders.length !== 1 ? 's' : ''),
            fields: chunk,
            timestamp: true,
        }));

        await interaction.reply({ embeds });
    } else if (sub === 'cancel') {
        const reminderId = interaction.options.getString('id');

        const removed = removeReminder(reminderId, interaction.user.id);

        if (!removed) {
            return interaction.reply({
                content: '\u26A0\uFE0F No reminder found with that ID. Use `/reminders list` to see your reminders.',
                ephemeral: true,
            });
        }

        const embed = makeEmbed({
            color: 'Red',
            title: '\uD83D\uDDD1\uFE0F Reminder Cancelled',
            description: 'Reminder `' + reminderId + '` has been cancelled.',
            timestamp: true,
        });

        await interaction.reply({ embeds: [embed] });
    }
}

module.exports = { executeRemindMe, executeReminders };
