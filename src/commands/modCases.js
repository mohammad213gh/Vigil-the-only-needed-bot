const { EmbedBuilder } = require('discord.js');
const { getCase, getCases, updateCaseReason, getUserCaseCount, getTotalCases } = require('../modCases');

// ──────────────────── /history <user> ────────────────────

async function executeHistory(interaction) {
    const target = interaction.options.getUser('user');
    const guild = interaction.guild;

    const cases = getCases(guild.id, target.id, 20);
    const total = getUserCaseCount(guild.id, target.id);

    if (cases.length === 0) {
        const embed = new EmbedBuilder()
            .setColor('Green')
            .setTitle('✅ Clean Record')
            .setDescription(target + ' has no moderation history.')
            .setFooter({ text: guild.name, iconURL: guild.iconURL() })
            .setTimestamp();
        return interaction.reply({ embeds: [embed] });
    }

    const actionEmojis = {
        warn: '⚠️',
        kick: '👢',
        ban: '🔨',
        unban: '🔓',
        timeout: '⏱️',
        untimeout: '▶️',
        lock: '🔒',
        unlock: '🔓',
        purge: '🧹',
    };

    const lines = cases.map(c => {
        const emoji = actionEmojis[c.action_type] || '📋';
        const status = c.active ? '🟢 Active' : '✅ Closed';
        return '`#' + c.case_number + '` ' + emoji + ' **' + c.action_type + '** — ' + c.reason.slice(0, 80) + (c.reason.length > 80 ? '...' : '') + '\n└ ' + c.moderator_tag + ' · <t:' + Math.floor(c.created_at / 1000) + ':R> · ' + status;
    }).join('\n\n');

    const embed = new EmbedBuilder()
        .setColor(0xF1C40F)
        .setTitle('📋 Moderation History for ' + target.tag)
        .setDescription('Total: **' + total + '** case' + (total !== 1 ? 's' : '') + ' — Showing last **' + cases.length + '**')
        .setThumbnail(target.displayAvatarURL({ size: 64 }))
        .addFields({ name: 'Cases', value: lines.slice(0, 1024) })
        .setFooter({ text: 'Use /case <id> for details' })
        .setTimestamp();

    // If lines overflow, add a second field
    if (lines.length > 1024) {
        embed.addFields({ name: 'Continued', value: lines.slice(1024, 2048) });
    }

    await interaction.reply({ embeds: [embed] });
}

// ──────────────────── /case <id> ────────────────────

async function executeCase(interaction) {
    const caseNumber = interaction.options.getInteger('id');
    const guild = interaction.guild;

    const c = getCase(guild.id, caseNumber);
    if (!c) {
        return interaction.reply({
            content: '❌ Case `#' + caseNumber + '` not found in this server.',
            ephemeral: true,
        });
    }

    const actionEmojis = {
        warn: '⚠️',
        kick: '👢',
        ban: '🔨',
        unban: '🔓',
        timeout: '⏱️',
        untimeout: '▶️',
        lock: '🔒',
        unlock: '🔓',
        purge: '🧹',
    };

    const embed = new EmbedBuilder()
        .setColor(c.active ? 0xE74C3C : 0x95A5A6)
        .setTitle(actionEmojis[c.action_type] || '📋' + ' Case #' + c.case_number + ' — ' + c.action_type)
        .addFields(
            { name: 'User', value: '<@' + c.user_id + '> (' + c.user_id + ')', inline: true },
            { name: 'Moderator', value: c.moderator_tag, inline: true },
            { name: 'Status', value: c.active ? '🟢 Active' : '✅ Closed', inline: true },
            { name: 'Date', value: '<t:' + Math.floor(c.created_at / 1000) + ':F>', inline: true },
            { name: 'Reason', value: c.reason || '*No reason provided*', inline: false },
        )
        .setFooter({ text: 'Use /reason ' + caseNumber + ' <text> to update' })
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}

// ──────────────────── /reason <id> <text> ────────────────────

async function executeReason(interaction) {
    const caseNumber = interaction.options.getInteger('id');
    const newReason = interaction.options.getString('text');
    const guild = interaction.guild;

    const updated = updateCaseReason(guild.id, caseNumber, newReason, interaction.user.tag);
    if (!updated) {
        return interaction.reply({
            content: '❌ Case `#' + caseNumber + '` not found in this server.',
            ephemeral: true,
        });
    }

    const embed = new EmbedBuilder()
        .setColor('Green')
        .setTitle('✅ Case #' + caseNumber + ' Updated')
        .addFields(
            { name: 'New Reason', value: newReason },
            { name: 'Updated By', value: interaction.user.tag, inline: true },
        )
        .setFooter({ text: guild.name, iconURL: guild.iconURL() })
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}

module.exports = { executeHistory, executeCase, executeReason };
