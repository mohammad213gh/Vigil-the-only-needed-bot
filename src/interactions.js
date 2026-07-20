// ──────────────────── Interactive Components Handler ────────────────────
// Handles button clicks, modal submissions, and select menu interactions
// for commands that use Discord's modern component system.

const { EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, PermissionFlagsBits } = require('discord.js');
const { addWarning } = require('./warnings');
const { getDb } = require('./db');
const { getLeadingOption } = require('./helpers');

// ─── Custom ID Prefixes ───
//   ck_{initiatorId}_{targetId}         = confirm kick
//   cb_{initiatorId}_{targetId}[clear]  = confirm ban
//   cp_{initiatorId}_{amount}           = confirm purge
//   cancel_{initiatorId}                = cancel action
//   wm_{initiatorId}_{targetId}         = warn modal opener
//   wr_{initiatorId}_{targetId}         = warn modal submit
//   pv_vote_{optionIndex}               = single poll vote (NO initiatorId — anyone can vote)
//   pm_vote_{optionIndex}               = multi poll vote (can vote for multiple)
//   pa_vote_{optionIndex}               = anonymous poll vote (votes hidden)

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
    // pv = single vote, pm = multi vote, pa = anonymous
    if (prefix === 'pv' || prefix === 'pm' || prefix === 'pa') {
        return handlePollVote(interaction, parts);
    }
    // Poll voters button
    if (prefix === 'pvv') {
        return handlePollVoters(interaction);
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

    // Defer first so the interaction is acknowledged before potentially slow DB ops
    await interaction.deferUpdate();

    try {
        const fetched = await interaction.channel.bulkDelete(amount, true);
        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('🧹 Messages Purged ✅')
            .setDescription('Deleted **' + fetched.size + '** message(s) in ' + interaction.channel)
            .setFooter({ text: 'By ' + interaction.user.tag })
            .setTimestamp();

        // Try to edit the confirmation message — it might have been bulk-deleted
        try {
            await interaction.editReply({ embeds: [embed], components: [] });
        } catch {
            // Original message was deleted by bulkDelete, send a fresh one
            await interaction.channel.send({ embeds: [embed] });
        }
    } catch (err) {
        const errMsg = '❌ Failed to purge: ' + err.message;
        try {
            await interaction.editReply({ content: errMsg, components: [], embeds: [] });
        } catch {
            await interaction.channel.send({ content: errMsg });
        }
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

// ──────────────────── Poll DB Helpers ────────────────────

function getPollVotes(messageId) {
    const db = getDb();
    const rows = db.prepare('SELECT user_id, option_index FROM poll_votes WHERE message_id = ?').all(messageId);
    var votes = new Map();
    for (var i = 0; i < rows.length; i++) {
        if (!votes.has(rows[i].user_id)) {
            votes.set(rows[i].user_id, []);
        }
        votes.get(rows[i].user_id).push(rows[i].option_index);
    }
    return votes;
}

function getPollVotesFlat(messageId) {
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

function removePollOptionVoteFromDb(messageId, userId, optionIndex) {
    const db = getDb();
    db.prepare('DELETE FROM poll_votes WHERE message_id = ? AND user_id = ? AND option_index = ?').run(messageId, userId, optionIndex);
}

// ──────────────────── Poll Vote Handler (log-style: clean fields, no bars) ────────────────────

async function handlePollVote(interaction, parts) {
    const prefix = parts[0];
    const messageId = interaction.message.id;
    const optionIndex = parseInt(parts[2]);
    const userId = interaction.user.id;
    const isMulti = prefix === 'pm';
    const isAnonymous = prefix === 'pa';

    // ── Record the vote ──
    var userVoteAction = '';
    if (isMulti) {
        const votes = getPollVotes(messageId);
        const userOptions = votes.get(userId) || [];
        if (userOptions.includes(optionIndex)) {
            removePollOptionVoteFromDb(messageId, userId, optionIndex);
            userVoteAction = 'removed from option ' + (optionIndex + 1);
        } else {
            setPollVoteInDb(messageId, userId, optionIndex);
            userVoteAction = 'cast for option ' + (optionIndex + 1);
        }
    } else if (isAnonymous) {
        const votes = getPollVotesFlat(messageId);
        if (votes.has(userId)) {
            removePollVoteFromDb(messageId, userId);
        }
        setPollVoteInDb(messageId, userId, optionIndex);
        userVoteAction = 'anonymously cast';
    } else {
        var votes = getPollVotesFlat(messageId);
        if (votes.get(userId) === optionIndex) {
            removePollVoteFromDb(messageId, userId);
            userVoteAction = 'removed';
        } else {
            if (votes.has(userId)) removePollVoteFromDb(messageId, userId);
            setPollVoteInDb(messageId, userId, optionIndex);
            userVoteAction = 'cast';
        }
    }

    // ── Reload votes ──
    const allVotes = getPollVotes(messageId);
    var totalVoters = allVotes.size;

    var voteCounts = {};
    for (var [uid, opts] of allVotes) {
        for (var opt of opts) {
            voteCounts[opt] = (voteCounts[opt] || 0) + 1;
        }
    }
    var totalVotes = Object.keys(voteCounts).reduce(function(a, k) { return a + voteCounts[k]; }, 0);

    // Find leading option
    var leadingIdx = getLeadingOption(voteCounts);

    // ── Build updated embed (log-style: clean field values, no progress bars) ──
    const embed = EmbedBuilder.from(interaction.message.embeds[0]);
    
    const fields = embed.data.fields || [];
    
    var updatedFields = [];
    for (var i = 0; i < fields.length; i++) {
        const count = voteCounts[i] || 0;
        const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
        var isLeading = (leadingIdx === i && count > 0);
        
        var optionName = fields[i].name;
        var badge = '';
        if (isLeading) badge = '  \uD83D\uDC51';
        else if (count > 0 && leadingIdx !== null && count === voteCounts[leadingIdx] && leadingIdx !== i) badge = '  \uD83D\uDC51';
        
        updatedFields.push({
            name: badge ? optionName.replace(/  \uD83C\uDFC6$/, '') + badge : optionName,
            value: '\uD83D\uDCCA Votes: **' + count + '** (' + pct + '%)',
            inline: fields[i].inline,
        });
    }
    embed.spliceFields(0, fields.length, updatedFields);

    // ── Build footer ──
    var footerParts = ['\uD83D\uDDF3  ' + totalVoters + ' voter' + (totalVoters !== 1 ? 's' : '')];
    if (totalVotes > totalVoters) footerParts.push(totalVotes + ' total votes');
    if (isMulti) footerParts.push('\uD83D\uDD01 Multi');
    if (isAnonymous) footerParts.push('\uD83D\uDD75\uFE0F Anonymous');
    
    var desc = embed.data.description || '';
    var endMatch = desc.match(/Ends <t:(\d+):R>/);
    if (endMatch) {
        footerParts.push('Ends <t:' + endMatch[1] + ':R>');
    }
    
    embed.setFooter({ text: footerParts.join('  \u2022  ') });

    // ── Defer first (instant ack — avoids 3-second timeout) ──
    await interaction.deferUpdate();

    // ── Update the embed after all DB ops ──
    var components = interaction.message.components;
    await interaction.editReply({ embeds: [embed], components: components.length > 0 ? components : undefined });

    // ── Send confirmation ──
    await interaction.followUp({ content: '\u2705 Vote ' + userVoteAction + '!', ephemeral: true });
}

// ──────────────────── Poll Voters Button ────────────────────
async function handlePollVoters(interaction) {
    const messageId = interaction.message.id;
    
    const db = getDb();
    const rows = db.prepare('SELECT user_id, option_index FROM poll_votes WHERE message_id = ? ORDER BY option_index, voted_at').all(messageId);
    
    if (rows.length === 0) {
        return interaction.reply({ content: 'No votes have been cast yet.', ephemeral: true });
    }
    
    var votersByOption = {};
    var userIds = new Set();
    for (var r of rows) {
        if (!votersByOption[r.option_index]) votersByOption[r.option_index] = [];
        votersByOption[r.option_index].push(r.user_id);
        userIds.add(r.user_id);
    }
    
    var lines = ['**\uD83D\uDDF3\uFE0F Poll Voters**', ''];
    var optNames = interaction.message.embeds[0]?.fields?.map(function(f) { return f.name; }) || [];
    
    for (var optIdx in votersByOption) {
        var idx = parseInt(optIdx);
        var voters = votersByOption[idx];
        var name = optNames[idx] || 'Option ' + (idx + 1);
        lines.push('**' + name + '** (' + voters.length + ' vote' + (voters.length !== 1 ? 's' : '') + '):');
        
        var showVoters = voters.slice(0, 15);
        var mentions = showVoters.map(function(uid) { return '<@' + uid + '>'; }).join(', ');
        if (voters.length > 15) mentions += ' +' + (voters.length - 15) + ' more';
        lines.push(mentions);
        lines.push('');
    }
    
    lines.push('\uD83D\uDCCA **' + userIds.size + '** total voter' + (userIds.size !== 1 ? 's' : ''));
    
    await interaction.reply({ content: lines.join('\n').slice(0, 1900), ephemeral: true });
}

// ──────────────────── Select Menu Handler ────────────────────

async function handleSelectMenu(interaction) {
    await interaction.reply({ content: 'Select menu received.', ephemeral: true });
}

// ──────────────────── Exports ────────────────────

module.exports = {
    handleInteraction,
};
