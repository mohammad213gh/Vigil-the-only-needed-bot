// ──────────────────── Interactive Components Handler ────────────────────
// Handles button clicks, modal submissions, and select menu interactions
// for commands that use Discord's modern component system.

const { EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, PermissionFlagsBits } = require('discord.js');
const { addWarning } = require('./warnings');
const { getDb } = require('./db');

// ─── Custom ID Prefixes ───
//   ck_{initiatorId}_{targetId}         = confirm kick
//   cb_{initiatorId}_{targetId}[clear]  = confirm ban
//   cp_{initiatorId}_{amount}           = confirm purge
//   cancel_{initiatorId}                = cancel action
//   wm_{initiatorId}_{targetId}         = warn modal opener
//   wr_{initiatorId}_{targetId}         = warn modal submit
//   pv_vote_{optionIndex}               = poll vote (NO initiatorId — anyone can vote)

// ──────────────────── Main Router ────────────────────

async function handleInteraction(interaction) {
    if (interaction.isButton()) {
        return handleButton(interaction);
    }
    if (interaction.isModalSubmit()) {
        return handleModal(interaction);
    }
    if (interaction.isStringSelectMenu()) {
        return handleSelectMenu(interaction);
    }
}

// ──────────────────── Button Handler ────────────────────

async function handleButton(interaction) {
    const parts = interaction.customId.split('_');
    const prefix = parts[0];
    const initiatorId = parts[1];

    // Poll votes — anyone can vote, no security check needed
    if (prefix === 'pv') {
        return handlePollVote(interaction, parts);
    }

    // All other buttons: only the person who initiated the action can interact
    if (interaction.user.id !== initiatorId) {
        return interaction.reply({
            content: '❌ Only the person who ran this command can interact with these buttons.',
            ephemeral: true,
        });
    }

    switch (prefix) {
        case 'ck': return handleConfirmKick(interaction, parts);
        case 'cb': return handleConfirmBan(interaction, parts);
        case 'cp': return handleConfirmPurge(interaction, parts);
        case 'cancel': return handleCancel(interaction, parts);
        case 'wm': return handleWarnModalOpen(interaction, parts);
        default:
            await interaction.reply({ content: 'Unknown interaction.', ephemeral: true });
    }
}

// ──────────────────── Cancel ────────────────────

async function handleCancel(interaction) {
    var desc = interaction.message.embeds[0]?.description || 'Action cancelled.';
    const embed = EmbedBuilder.from(interaction.message.embeds[0])
        .setColor(0x95A5A6)
        .setDescription('~~' + desc + '~~')
        .setFooter({ text: 'Cancelled by ' + interaction.user.tag });

    await interaction.update({ embeds: [embed], components: [] });
}

// ──────────────────── Confirm Kick ────────────────────

async function handleConfirmKick(interaction, parts) {
    const targetId = parts.slice(2).join('_');
    const guild = interaction.guild;

    if (!guild.members.me.permissions.has(PermissionFlagsBits.KickMembers)) {
        return interaction.update({ content: '❌ I lost the **Kick Members** permission.', components: [], embeds: [] });
    }

    const member = await guild.members.fetch(targetId).catch(() => null);
    if (!member) {
        return interaction.update({ content: '❌ That user is no longer in the server.', components: [], embeds: [] });
    }
    if (!member.kickable) {
        return interaction.update({ content: '❌ I can no longer kick that user (role hierarchy changed).', components: [], embeds: [] });
    }

    // Extract reason from the original embed
    const reasonField = interaction.message.embeds[0]?.fields?.find(function (f) { return f.name === 'Reason'; });
    const reason = reasonField ? reasonField.value : 'No reason provided';

    try {
        await member.kick(reason);
        const embed = EmbedBuilder.from(interaction.message.embeds[0])
            .setColor(0xE74C3C)
            .setTitle('👢 Member Kicked ✅')
            .setDescription('<@' + targetId + '> has been kicked.');
        await interaction.update({ embeds: [embed], components: [] });
    } catch (err) {
        await interaction.update({ content: '❌ Failed to kick: ' + err.message, components: [], embeds: [] });
    }
}

// ──────────────────── Confirm Ban ────────────────────

async function handleConfirmBan(interaction, parts) {
    const targetId = parts.slice(2).join('_');
    const guild = interaction.guild;
    const deleteMessageSeconds = parts[parts.length - 1] === 'clear' ? 86400 : 0;

    if (!guild.members.me.permissions.has(PermissionFlagsBits.BanMembers)) {
        return interaction.update({ content: '❌ I lost the **Ban Members** permission.', components: [], embeds: [] });
    }

    // Extract reason from the original embed
    const reasonField = interaction.message.embeds[0]?.fields?.find(function (f) { return f.name === 'Reason'; });
    const reason = reasonField ? reasonField.value : 'No reason provided';

    try {
        await guild.bans.create(targetId, { reason: reason, deleteMessageSeconds: deleteMessageSeconds });
        const embed = EmbedBuilder.from(interaction.message.embeds[0])
            .setColor(0xE74C3C)
            .setTitle('🔨 Member Banned ✅')
            .setDescription('<@' + targetId + '> has been banned.');
        await interaction.update({ embeds: [embed], components: [] });
    } catch (err) {
        await interaction.update({ content: '❌ Failed to ban: ' + err.message, components: [], embeds: [] });
    }
}

// ──────────────────── Confirm Purge ────────────────────

async function handleConfirmPurge(interaction, parts) {
    const amount = parseInt(parts[2]) || 0;
    const guild = interaction.guild;

    if (!guild.members.me.permissions.has(PermissionFlagsBits.ManageMessages)) {
        return interaction.update({ content: '❌ I lost the **Manage Messages** permission.', components: [], embeds: [] });
    }
    if (!interaction.channel.isTextBased?.()) {
        return interaction.update({ content: '❌ This channel is not a text channel.', components: [], embeds: [] });
    }

    try {
        const fetched = await interaction.channel.bulkDelete(amount, true);
        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('🧹 Messages Purged ✅')
            .setDescription('Deleted **' + fetched.size + '** message(s) in ' + interaction.channel)
            .setFooter({ text: 'By ' + interaction.user.tag })
            .setTimestamp();
        await interaction.update({ embeds: [embed], components: [] });
    } catch (err) {
        await interaction.update({ content: '❌ Failed to purge: ' + err.message, components: [], embeds: [] });
    }
}

// ──────────────────── Warn Modal (open) ────────────────────

async function handleWarnModalOpen(interaction, parts) {
    const targetId = parts.slice(2).join('_');

    const modal = new ModalBuilder()
        .setCustomId('wr_' + interaction.user.id + '_' + targetId)
        .setTitle('Issue Warning');

    const reasonInput = new TextInputBuilder()
        .setCustomId('warn_reason')
        .setLabel('Reason for warning')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Enter the reason for this warning...')
        .setMaxLength(1000)
        .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));

    await interaction.showModal(modal);
}

// ──────────────────── Modal Handler ────────────────────

async function handleModal(interaction) {
    const parts = interaction.customId.split('_');
    const prefix = parts[0];

    if (prefix === 'wr') {
        return handleWarnSubmit(interaction, parts);
    }
}

async function handleWarnSubmit(interaction, parts) {
    const initiatorId = parts[1];
    const targetId = parts.slice(2).join('_');
    const reason = interaction.fields.getTextInputValue('warn_reason');

    // Security check
    if (interaction.user.id !== initiatorId) {
        return interaction.reply({ content: '❌ This isn\'t your warning form.', ephemeral: true });
    }

    const warnings = addWarning(interaction.guild.id, targetId, interaction.user.tag, reason);

    const embed = new EmbedBuilder()
        .setColor(0xF1C40F)
        .setTitle('⚠️ Warning Issued')
        .setDescription('<@' + targetId + '> has been warned.')
        .addFields(
            { name: 'Reason', value: reason },
            { name: 'Warning Count', value: String(warnings.length) },
            { name: 'Moderator', value: String(interaction.user) },
        )
        .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL() })
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });

    // DM the user
    try {
        const user = await interaction.client.users.fetch(targetId);
        await user.send('⚠️ You have been warned in **' + interaction.guild.name + '**.\nReason: ' + reason);
    } catch { /* DMs closed */ }
}

// ──────────────────── Poll Vote (SQLite — survives restarts) ────────────────────

// Load all votes for a message from the DB
function getPollVotes(messageId) {
    const db = getDb();
    const rows = db.prepare('SELECT user_id, option_index FROM poll_votes WHERE message_id = ?').all(messageId);
    var votes = new Map();
    for (var i = 0; i < rows.length; i++) {
        votes.set(rows[i].user_id, rows[i].option_index);
    }
    return votes;
}

function setPollVoteInDb(messageId, userId, optionIndex) {
    const db = getDb();
    db.prepare('INSERT OR REPLACE INTO poll_votes (message_id, user_id, option_index, voted_at) VALUES (?, ?, ?, ?)')
        .run(messageId, userId, optionIndex, Date.now());
}

function removePollVoteFromDb(messageId, userId) {
    const db = getDb();
    db.prepare('DELETE FROM poll_votes WHERE message_id = ? AND user_id = ?').run(messageId, userId);
}

async function handlePollVote(interaction, parts) {
    const messageId = interaction.message.id;
    const optionIndex = parseInt(parts[2]); // parts = ['pv', 'vote', '0']
    const userId = interaction.user.id;

    // Load votes fresh from SQLite (survives restarts)
    var votes = getPollVotes(messageId);

    // Toggle vote: if already voted for this option, remove; otherwise set
    const previousVote = votes.get(userId);
    if (previousVote === optionIndex) {
        removePollVoteFromDb(messageId, userId);
        await interaction.reply({ content: '🗳️ Your vote has been removed.', ephemeral: true });
    } else {
        setPollVoteInDb(messageId, userId, optionIndex);
        votes.set(userId, optionIndex);
        await interaction.reply({ content: '🗳️ Your vote has been recorded!', ephemeral: true });
    }

    // Reload votes after change to get accurate counts
    votes = getPollVotes(messageId);
    const totalVoters = votes.size;

    // Count votes per option
    var voteCounts = {};
    for (var [, optIndex] of votes) {
        voteCounts[optIndex] = (voteCounts[optIndex] || 0) + 1;
    }

    // Update the embed fields to show vote counts
    const embed = EmbedBuilder.from(interaction.message.embeds[0]);
    const fields = embed.data.fields || [];
    const updatedFields = fields.map(function (field, i) {
        const count = voteCounts[i] || 0;
        const bar = makeBar(count, totalVoters);
        return {
            name: field.name,
            value: field.value.split('\n')[0] + '\n' + bar + ' **' + count + '** vote' + (count !== 1 ? 's' : ''),
            inline: field.inline,
        };
    });
    embed.spliceFields(0, fields.length, updatedFields);
    embed.setFooter({ text: '🗳️ ' + totalVoters + ' total vote' + (totalVoters !== 1 ? 's' : '') + ' · Poll' });

    await interaction.update({ embeds: [embed] });
}

function makeBar(count, total) {
    if (total === 0) return '▱▱▱▱▱▱▱▱▱▱';
    const filled = Math.round((count / total) * 10);
    var bar = '';
    for (var i = 0; i < filled; i++) bar += '▰';
    for (var i = filled; i < 10; i++) bar += '▱';
    return bar;
}

// ──────────────────── Select Menu Handler ────────────────────

async function handleSelectMenu(interaction) {
    // Placeholder for future select menu interactions
    await interaction.reply({ content: 'Select menu received.', ephemeral: true });
}

// ──────────────────── Exports ────────────────────

module.exports = {
    handleInteraction,
};
