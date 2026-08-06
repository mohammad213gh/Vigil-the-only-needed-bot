// ──────────────────── Interactive Components Handler ────────────────────
// Handles button clicks, modal submissions, and select menu interactions
// for commands that use Discord's modern component system.

const { EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, PermissionFlagsBits } = require('discord.js');
const { addWarning } = require('./warnings');
const { createCase, closeCase } = require('./modCases');
const { getDb } = require('./db');
const { getLeadingOption } = require('./helpers');
const { logError } = require('./logError');

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
//   tk_create                           = create ticket (no security, any user)
//   tk_close_{ticketId}                 = close ticket (no initiator check — uses interaction.user)
//   tk_claim_{ticketId}                 = claim ticket (no initiator check — uses interaction.user)

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
    if (interaction.isUserSelect()) {
        return handleUserSelect(interaction);
    }
}

// ──────────────────── Button Handler ────────────────────

async function handleButton(interaction) {
    const parts = interaction.customId.split('_');
    const prefix = parts[0];
    const initiatorId = parts[1];

    // Poll votes — anyone can vote, no security check needed
    if (prefix === 'pv' || prefix === 'pm' || prefix === 'pa') {
        return handlePollVote(interaction, parts);
    }
    // Poll voters button
    if (prefix === 'pvv') {
        return handlePollVoters(interaction);
    }
    // Ticket buttons — custom IDs are tk_{action}_{...} (anyone can interact, no initiator check)
    if (prefix === 'tk') {
        const tkAction = parts[1];
        // Ticket create — anyone can use (no initiator check)
        // Format: tk_create_{panelId}_{typeId} OR tk_create_{panelId}
        if (tkAction === 'create') {
            return handleTicketCreate(interaction, parts);
        }
        // Ticket close — anyone in the channel can use
        if (tkAction === 'close') {
            return handleTicketClose(interaction, parts);
        }
        // Ticket claim — anyone can claim
        if (tkAction === 'claim') {
            return handleTicketClaim(interaction, parts);
        }
        // Ticket rating — anyone can rate (no initiator check)
        if (tkAction === 'rate') {
            return handleTicketRating(interaction, parts);
        }
        // Ticket rating skip
        if (tkAction === 'rateskip') {
            return handleTicketRateSkip(interaction, parts);
        }
        // Ticket keep-alive (inactivity reset)
        if (tkAction === 'keep') {
            return handleTicketKeep(interaction, parts);
        }
        // Ticket transfer
        if (tkAction === 'transfer') {
            return handleTicketTransfer(interaction, parts);
        }
        // Ticket add user
        if (tkAction === 'adduser') {
            return handleTicketAddUser(interaction, parts);
        }
        return interaction.reply({ content: '❌ Unknown ticket button.', ephemeral: true });
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
        case 'ctb': return handleConfirmTempBan(interaction, parts);
        case 'cp': return handleConfirmPurge(interaction, parts);
        case 'cancel': return handleCancel(interaction, parts);
        case 'wm': return handleWarnModalOpen(interaction, parts);
        default:
            await interaction.reply({ content: 'Unknown interaction.', ephemeral: true });
    }
}

// ──────────────────── Cancel ────────────────────

async function handleCancel(interaction) {
    const desc = interaction.message.embeds[0]?.description || 'Action cancelled.';
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

    const reasonField = interaction.message.embeds[0]?.fields?.find(f => f.name === 'Reason');
    const reason = reasonField ? reasonField.value : 'No reason provided';

    try {
        await member.kick(reason);
        createCase(interaction.guild.id, targetId, interaction.user.id, interaction.user.tag, 'kick', reason);
        const embed = EmbedBuilder.from(interaction.message.embeds[0])
            .setColor(0xE74C3C)
            .setTitle('👢 Member Kicked ✅')
            .setDescription('<@' + targetId + '> has been kicked.');
        await interaction.update({ embeds: [embed], components: [] });
    } catch (err) {
        logError(err, 'interactions', 'confirmKick');
        await interaction.update({ content: '❌ Failed to kick: ' + err.message, components: [], embeds: [] });
    }
}

// ──────────────────── Confirm Temp Ban ────────────────────

async function handleConfirmTempBan(interaction, parts) {
    // ctb_{initiatorId}_{targetId}_{duration}_{deleteSeconds}
    const initiatorId = parts[1];
    const targetId = parts[2];
    const duration = parts[3] || '7d';
    const deleteSeconds = parseInt(parts[4]) || 0;
    const guild = interaction.guild;

    if (!guild.members.me.permissions.has(PermissionFlagsBits.BanMembers)) {
        return interaction.update({ content: '❌ I lost the **Ban Members** permission.', components: [], embeds: [] });
    }

    const durationMs = {
        '1h': 3600000, '6h': 21600000, '24h': 86400000,
        '3d': 259200000, '7d': 604800000, '14d': 1209600000, '30d': 2592000000,
    }[duration] || 604800000;

    const durationLabel = {
        '1h': '1 hour', '6h': '6 hours', '24h': '24 hours',
        '3d': '3 days', '7d': '7 days', '14d': '14 days', '30d': '30 days',
    }[duration] || '7 days';

    const reasonField = interaction.message.embeds[0]?.fields?.find(f => f.name === 'Reason');
    const reason = reasonField ? reasonField.value : 'No reason provided';

    try {
        await guild.bans.create(targetId, { reason: '[Temp Ban ' + durationLabel + '] ' + reason, deleteMessageSeconds: deleteSeconds });

        // Store the temp ban in the DB with auto-unban timestamp
        const db = getDb();
        const unbanAt = Date.now() + durationMs;
        db.prepare('INSERT INTO temp_bans (user_id, guild_id, reason, banned_at, unban_at) VALUES (?, ?, ?, ?, ?)')
            .run(targetId, guild.id, reason, Date.now(), unbanAt);

        createCase(interaction.guild.id, targetId, interaction.user.id, interaction.user.tag, 'tempban', reason + ' (Duration: ' + durationLabel + ')');

        const embed = EmbedBuilder.from(interaction.message.embeds[0])
            .setColor(0xE74C3C)
            .setTitle('🔨 Temp Banned ✅')
            .setDescription('<@' + targetId + '> has been temp banned for **' + durationLabel + '**.')
            .setFooter({ text: 'Auto-unban at <t:' + Math.floor(unbanAt / 1000) + ':R>' });

        await interaction.update({ embeds: [embed], components: [] });

        // Schedule the unban
        setTimeout(async () => {
            try {
                await guild.bans.remove(targetId, 'Temp ban expired (' + durationLabel + ')');
                const db2 = getDb();
                db2.prepare('DELETE FROM temp_bans WHERE user_id = ? AND guild_id = ?').run(targetId, guild.id);
                console.log('[TempBan] Auto-unbanned', targetId, 'in', guild.id);
            } catch (err) {
                logError(err, 'interactions', 'autoUnban');
            }
        }, durationMs);
    } catch (err) {
        logError(err, 'interactions', 'confirmTempBan');
        await interaction.update({ content: '❌ Failed to temp ban: ' + err.message, components: [], embeds: [] });
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

    const reasonField = interaction.message.embeds[0]?.fields?.find(f => f.name === 'Reason');
    const reason = reasonField ? reasonField.value : 'No reason provided';

    try {
        await guild.bans.create(targetId, { reason: reason, deleteMessageSeconds: deleteMessageSeconds });
        createCase(interaction.guild.id, targetId, interaction.user.id, interaction.user.tag, 'ban', reason);
        const embed = EmbedBuilder.from(interaction.message.embeds[0])
            .setColor(0xE74C3C)
            .setTitle('🔨 Member Banned ✅')
            .setDescription('<@' + targetId + '> has been banned.');
        await interaction.update({ embeds: [embed], components: [] });
    } catch (err) {
        logError(err, 'interactions', 'confirmBan');
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
        logError(err, 'interactions', 'confirmPurge');
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
    if (prefix === 'tk') {
        const tkAction = parts[1];
        if (tkAction === 'questions') {
            const { handleQuestionsSubmit } = require('./tickets');
            return handleQuestionsSubmit(interaction);
        }
        if (tkAction === 'feedback') {
            return handleFeedbackModal(interaction, parts);
        }
        if (tkAction === 'transfer') {
            return handleTransferModal(interaction, parts);
        }
        if (tkAction === 'adduser') {
            return handleAddUserModal(interaction, parts);
        }
        return interaction.reply({ content: '❌ Unknown ticket form.', ephemeral: true });
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
    createCase(interaction.guild.id, targetId, interaction.user.id, interaction.user.tag, 'warn', reason);

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
    } catch {
        // DMs closed, silently skip
    }

    // Check warning thresholds for auto-punish
    try {
        const { checkThresholds } = require('./warningThresholds');
        const guild = interaction.guild;
        const result = await checkThresholds(guild, targetId, interaction);
        if (result) {
            await interaction.followUp({
                content: '⚠️ **Auto-punish:** <@' + targetId + '> was ' + result + ' (reached ' + warnings.length + ' warnings).',
                ephemeral: true,
            }).catch(() => {});
        }
    } catch (err) {
        logError(err, 'interactions', 'checkThresholds');
    }
}

// ──────────────────── Poll DB Helpers ────────────────────

function getPollVotes(messageId) {
    try {
        const db = getDb();
        const rows = db.prepare('SELECT user_id, option_index FROM poll_votes WHERE message_id = ?').all(messageId);
        const votes = new Map();
        for (const row of rows) {
            if (!votes.has(row.user_id)) {
                votes.set(row.user_id, []);
            }
            votes.get(row.user_id).push(row.option_index);
        }
        return votes;
    } catch (err) {
        logError(err, 'interactions', 'getPollVotes');
        return new Map();
    }
}

function getPollVotesFlat(messageId) {
    try {
        const db = getDb();
        const rows = db.prepare('SELECT user_id, option_index FROM poll_votes WHERE message_id = ?').all(messageId);
        const votes = new Map();
        for (const row of rows) {
            votes.set(row.user_id, row.option_index);
        }
        return votes;
    } catch (err) {
        logError(err, 'interactions', 'getPollVotesFlat');
        return new Map();
    }
}

function setPollVoteInDb(messageId, userId, optionIndex) {
    try {
        const db = getDb();
        db.prepare('INSERT OR REPLACE INTO poll_votes (message_id, user_id, option_index, voted_at) VALUES (?, ?, ?, ?)')
            .run(messageId, userId, optionIndex, Date.now());
    } catch (err) {
        logError(err, 'interactions', 'setPollVoteInDb');
    }
}

function removePollVoteFromDb(messageId, userId) {
    try {
        const db = getDb();
        db.prepare('DELETE FROM poll_votes WHERE message_id = ? AND user_id = ?').run(messageId, userId);
    } catch (err) {
        logError(err, 'interactions', 'removePollVoteFromDb');
    }
}

function removePollOptionVoteFromDb(messageId, userId, optionIndex) {
    try {
        const db = getDb();
        db.prepare('DELETE FROM poll_votes WHERE message_id = ? AND user_id = ? AND option_index = ?').run(messageId, userId, optionIndex);
    } catch (err) {
        logError(err, 'interactions', 'removePollOptionVoteFromDb');
    }
}

// ──────────────────── Poll Vote Handler ────────────────────

async function handlePollVote(interaction, parts) {
    const prefix = parts[0];
    const messageId = interaction.message.id;
    const optionIndex = parseInt(parts[2]);
    const userId = interaction.user.id;
    const isMulti = prefix === 'pm';
    const isAnonymous = prefix === 'pa';

    // ── Record the vote ──
    let userVoteAction = '';
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
        const votes = getPollVotesFlat(messageId);
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
    const totalVoters = allVotes.size;

    const voteCounts = {};
    for (const [, opts] of allVotes) {
        for (const opt of opts) {
            voteCounts[opt] = (voteCounts[opt] || 0) + 1;
        }
    }
    const totalVotes = Object.values(voteCounts).reduce((a, b) => a + b, 0);

    // Find leading option
    const leadingIdx = getLeadingOption(voteCounts);

    // ── Build updated embed ──
    const embed = EmbedBuilder.from(interaction.message.embeds[0]);
    const fields = embed.data.fields || [];

    const updatedFields = fields.map((field, i) => {
        const count = voteCounts[i] || 0;
        const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
        const isLeading = leadingIdx === i && count > 0;

        let badge = '';
        if (isLeading) badge = '  👑';
        else if (count > 0 && leadingIdx !== null && count === voteCounts[leadingIdx] && leadingIdx !== i) badge = '  👑';

        return {
            name: badge ? field.name.replace(/  🏆$/, '') + badge : field.name,
            value: '📊 Votes: **' + count + '** (' + pct + '%)',
            inline: field.inline,
        };
    });
    embed.spliceFields(0, fields.length, updatedFields);

    // ── Build footer ──
    const footerParts = ['🗳  ' + totalVoters + ' voter' + (totalVoters !== 1 ? 's' : '')];
    if (totalVotes > totalVoters) footerParts.push(totalVotes + ' total votes');
    if (isMulti) footerParts.push('🔁 Multi');
    if (isAnonymous) footerParts.push('🕵️ Anonymous');

    const desc = embed.data.description || '';
    const endMatch = desc.match(/Ends <t:(\d+):R>/);
    if (endMatch) {
        footerParts.push('Ends <t:' + endMatch[1] + ':R>');
    }

    embed.setFooter({ text: footerParts.join('  •  ') });

    // ── Defer first (instant ack — avoids 3-second timeout) ──
    await interaction.deferUpdate();

    // ── Update the embed after all DB ops ──
    const components = interaction.message.components;
    await interaction.editReply({ embeds: [embed], components: components.length > 0 ? components : undefined });

    // ── Send confirmation ──
    try {
        await interaction.followUp({ content: '✅ Vote ' + userVoteAction + '!', ephemeral: true });
    } catch (err) {
        logError(err, 'interactions', 'pollVoteFollowUp');
    }
}

// ──────────────────── Poll Voters Button ────────────────────
async function handlePollVoters(interaction) {
    const messageId = interaction.message.id;

    try {
        const db = getDb();
        const rows = db.prepare('SELECT user_id, option_index FROM poll_votes WHERE message_id = ? ORDER BY option_index, voted_at').all(messageId);

        if (rows.length === 0) {
            return interaction.reply({ content: 'No votes have been cast yet.', ephemeral: true });
        }

        const votersByOption = {};
        const userIds = new Set();
        for (const r of rows) {
            if (!votersByOption[r.option_index]) votersByOption[r.option_index] = [];
            votersByOption[r.option_index].push(r.user_id);
            userIds.add(r.user_id);
        }

        const lines = ['**🗳️ Poll Voters**', ''];
        const optNames = interaction.message.embeds[0]?.fields?.map(f => f.name) || [];

        for (const optIdx in votersByOption) {
            if (!Object.prototype.hasOwnProperty.call(votersByOption, optIdx)) continue;
            const idx = parseInt(optIdx);
            const voters = votersByOption[idx];
            const name = optNames[idx] || 'Option ' + (idx + 1);
            lines.push('**' + name + '** (' + voters.length + ' vote' + (voters.length !== 1 ? 's' : '') + '):');

            const showVoters = voters.slice(0, 15);
            const mentions = showVoters.map(uid => '<@' + uid + '>').join(', ');
            if (voters.length > 15) mentions += ' +' + (voters.length - 15) + ' more';
            lines.push(mentions);
            lines.push('');
        }

        lines.push('📊 **' + userIds.size + '** total voter' + (userIds.size !== 1 ? 's' : ''));

        await interaction.reply({ content: lines.join('\n').slice(0, 1900), ephemeral: true });
    } catch (err) {
        logError(err, 'interactions', 'handlePollVoters');
        await interaction.reply({ content: 'Failed to load voters.', ephemeral: true });
    }
}

// ──────────────────── Select Menu Handler ────────────────────

const { handleRoleMenuSelect } = require('./commands/roleMenu');
const { getPanel, getPanelTypes } = require('./tickets');

async function handleSelectMenu(interaction) {
    const parts = interaction.customId.split('_');
    if (parts[0] === 'rm') {
        return handleRoleMenuSelect(interaction);
    }
    // Ticket panel type selection
    if (parts[0] === 'tk' && parts[1] === 'select') {
        return handleTicketTypeSelect(interaction, parts);
    }
    await interaction.reply({ content: 'Select menu received.', ephemeral: true });
}

async function handleTicketTypeSelect(interaction, parts) {
    // tk_select_{panelId}
    const panelId = parts.slice(2).join('_');
    const typeId = interaction.values[0];

    const guild = interaction.guild;
    const config = require('./tickets').getTicketConfig(guild.id);
    if (!config.enabled) {
        return interaction.reply({ content: '❌ Tickets are not enabled in this server.', ephemeral: true });
    }

    // Feature 3: Check blacklist
    const { isBlacklisted } = require('./tickets');
    const blacklisted = isBlacklisted(guild.id, interaction.user.id);
    if (blacklisted) {
        return interaction.reply({
            content: '❌ You are blacklisted from creating tickets.\nReason: ' + (blacklisted.reason || 'No reason provided'),
            ephemeral: true,
        });
    }

    // Check for existing open ticket (auto-closes stale tickets whose channel was deleted)
    const db = getDb();
    const existing = require('./tickets').getBlockingOpenTicket(guild, interaction.user.id);
    if (existing) {
        return interaction.reply({ content: '❌ You already have an open ticket! <#' + existing.channel_id + '>', ephemeral: true });
    }

    const { showQuestionsModal } = require('./tickets');
    const type = require('./tickets').getPanelType(typeId);
    if (!type) {
        return interaction.reply({ content: '❌ This ticket type no longer exists.', ephemeral: true });
    }

    // Show the questions modal (must be the first response — do NOT update() first)
    await showQuestionsModal(interaction, type);
}

// ──────────────────── Rating Handlers (Feature 1) ────────────────────

async function handleTicketRating(interaction, parts) {
    // tk_rate_{ticketId}_{rating}
    const ticketId = parts.slice(2, -1).join('_');
    const rating = parseInt(parts[parts.length - 1]);

    if (rating < 1 || rating > 5) {
        return interaction.reply({ content: '❌ Invalid rating.', ephemeral: true });
    }

    const { saveRating } = require('./tickets');

    // Get guild ID from the ticket record
    const db = getDb();
    const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId);
    if (!ticket) {
        return interaction.reply({ content: '❌ Ticket not found.', ephemeral: true });
    }

    // Show feedback modal (must be the first response — do NOT update() first)
    const modal = new ModalBuilder()
        .setCustomId('tk_feedback_' + ticketId + '_' + rating)
        .setTitle('Rate Your Experience — ' + rating + '/5');

    const feedbackInput = new TextInputBuilder()
        .setCustomId('tk_feedback_text')
        .setLabel('Any additional feedback? (optional)')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Tell us about your experience...')
        .setMaxLength(1000)
        .setRequired(false);

    modal.addComponents(new ActionRowBuilder().addComponents(feedbackInput));

    try {
        await interaction.showModal(modal);
    } catch (err) {
        // If modal fails (e.g. message deleted), save rating without feedback
        saveRating(ticketId, ticket.guild_id, rating, null);
        await interaction.reply({ content: '✅ Thanks for your rating!', ephemeral: true }).catch(() => {});
    }
}

// ──────────────────── Rating Skip Handler (Feature 1) ────────────────────

async function handleTicketRateSkip(interaction, parts) {
    // tk_rateskip_{ticketId} — dismiss the rating prompt and disable the buttons
    try {
        const disabledComponents = interaction.message.components.map(row =>
            new ActionRowBuilder().addComponents(
                row.components.map(btn =>
                    ButtonBuilder.from(btn).setDisabled(true)
                )
            )
        );
        await interaction.update({ components: disabledComponents });
    } catch {
        await interaction.deferUpdate().catch(() => {});
    }
}

// ──────────────────── Feedback Modal Handler (Feature 1) ────────────────────

async function handleFeedbackModal(interaction, parts) {
    // tk_feedback_{ticketId}_{rating}
    const ticketId = parts.slice(2, -1).join('_');
    const rating = parseInt(parts[parts.length - 1]);
    const feedback = interaction.fields.getTextInputValue('tk_feedback_text');

    const db = getDb();
    const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId);
    if (!ticket) {
        return interaction.reply({ content: '❌ Ticket not found.', ephemeral: true });
    }

    const { saveRating } = require('./tickets');
    saveRating(ticketId, ticket.guild_id, rating, feedback || null);

    // Disable the rating buttons on the DM message
    let disabled = false;
    try {
        const disabledComponents = interaction.message.components.map(row =>
            new ActionRowBuilder().addComponents(
                row.components.map(btn =>
                    ButtonBuilder.from(btn).setDisabled(true)
                )
            )
        );
        await interaction.update({ components: disabledComponents });
        disabled = true;
    } catch {}

    if (disabled) {
        await interaction.followUp({ content: '✅ Thanks for your feedback!', ephemeral: true }).catch(() => {});
    } else {
        await interaction.reply({ content: '✅ Thanks for your feedback!', ephemeral: true }).catch(() => {});
    }
}

// ──────────────────── Inactivity Keep-Alive (Feature 2) ────────────────────

async function handleTicketKeep(interaction, parts) {
    // tk_keep_{ticketId}
    const ticketId = parts.slice(2).join('_');

    const { updateLastActivity } = require('./tickets');
    updateLastActivity(ticketId);

    // Update the warning embed
    try {
        const embed = EmbedBuilder.from(interaction.message.embeds[0])
            .setColor(0x5865F2)
            .setTitle('✅ Still Active')
            .setDescription('This ticket has been marked as still active. The inactivity timer has been reset.')
            .setFooter({ text: 'Reset by ' + interaction.user.tag });

        const disabledRow = new ActionRowBuilder().addComponents(
            interaction.message.components[0].components.map(btn =>
                ButtonBuilder.from(btn).setDisabled(true)
            )
        );

        await interaction.update({ embeds: [embed], components: [disabledRow] });
    } catch {}

    await interaction.followUp({ content: '✅ The inactivity timer has been reset.', ephemeral: true }).catch(() => {});
}

// ──────────────────── Ticket Transfer (Feature 4) ────────────────────

async function handleTicketTransfer(interaction, parts) {
    // tk_transfer_{ticketId}
    const ticketId = parts.slice(2).join('_');

    // Show user select modal
    const modal = new ModalBuilder()
        .setCustomId('tk_transfer_modal_' + ticketId)
        .setTitle('Transfer Ticket');

    const userInput = new TextInputBuilder()
        .setCustomId('tk_transfer_user')
        .setLabel('User ID to transfer to')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Enter the Discord ID of the staff member')
        .setRequired(true)
        .setMaxLength(30);

    modal.addComponents(new ActionRowBuilder().addComponents(userInput));

    await interaction.showModal(modal);
}

async function handleTransferModal(interaction, parts) {
    // tk_transfer_modal_{ticketId}
    const ticketId = parts.slice(3).join('_');
    const targetId = interaction.fields.getTextInputValue('tk_transfer_user').trim();

    if (!targetId) {
        return interaction.reply({ content: '❌ Please enter a valid user ID.', ephemeral: true });
    }

    const guild = interaction.guild;
    const channel = interaction.channel;

    const targetMember = await guild.members.fetch(targetId).catch(() => null);
    if (!targetMember) {
        return interaction.reply({ content: '❌ Could not find a member with that ID in this server.', ephemeral: true });
    }

    const { transferTicket } = require('./tickets');
    const result = await transferTicket(guild, channel, interaction.user, targetMember);

    if (result.error) {
        return interaction.reply({ content: '❌ ' + result.error, ephemeral: true });
    }

    await interaction.reply({ content: '✅ Ticket transferred to **' + targetMember.user.tag + '**.', ephemeral: true });
}

// ──────────────────── Ticket Add User ────────────────────

async function handleTicketAddUser(interaction, parts) {
    const ticketId = parts.slice(2).join('_');

    const modal = new ModalBuilder()
        .setCustomId('tk_adduser_modal_' + ticketId)
        .setTitle('Add User to Ticket');

    const userInput = new TextInputBuilder()
        .setCustomId('tk_adduser_id')
        .setLabel('User ID to add')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Enter the Discord ID of the user')
        .setRequired(true)
        .setMaxLength(30);

    modal.addComponents(new ActionRowBuilder().addComponents(userInput));

    await interaction.showModal(modal);
}

async function handleAddUserModal(interaction, parts) {
    // tk_adduser_modal_{ticketId}
    const ticketId = parts.slice(3).join('_');
    const targetId = interaction.fields.getTextInputValue('tk_adduser_id').trim();

    if (!targetId) {
        return interaction.reply({ content: '❌ Please enter a valid user ID.', ephemeral: true });
    }

    const guild = interaction.guild;
    const channel = interaction.channel;

    const targetMember = await guild.members.fetch(targetId).catch(() => null);
    if (!targetMember) {
        return interaction.reply({ content: '❌ Could not find a member with that ID in this server.', ephemeral: true });
    }

    const { addUserToTicket } = require('./tickets');
    const result = await addUserToTicket(guild, channel, interaction.user, targetMember);

    if (result.error) {
        return interaction.reply({ content: '❌ ' + result.error, ephemeral: true });
    }

    await interaction.reply({ content: '✅ Added **' + targetMember.user.tag + '** to this ticket.', ephemeral: true });
}

// ──────────────────── User Select Handler ────────────────────

async function handleUserSelect(interaction) {
    // Currently unused but needed for future user-select menus
    await interaction.reply({ content: 'User selected.', ephemeral: true });
}

// ──────────────────── Ticket Handlers ────────────────────

// These don't use the initiatorId prefix pattern because anyone can
// create a ticket, and close/claim use the actual button-presser.

async function handleTicketCreate(interaction, parts) {
    // tk_create_{panelId}_{typeId} OR tk_create_{panelId}
    const panelId = parts[2];
    const typeId = parts[3];

    const guild = interaction.guild;
    const config = require('./tickets').getTicketConfig(guild.id);

    if (!config.enabled) {
        return interaction.reply({ content: '❌ Tickets are not enabled in this server.', ephemeral: true });
    }

    // Feature 3: Check blacklist
    const { isBlacklisted } = require('./tickets');
    const blacklisted = isBlacklisted(guild.id, interaction.user.id);
    if (blacklisted) {
        return interaction.reply({
            content: '❌ You are blacklisted from creating tickets.\nReason: ' + (blacklisted.reason || 'No reason provided'),
            ephemeral: true,
        });
    }

    // Check for existing open ticket (auto-closes stale tickets whose channel was deleted)
    const existing = require('./tickets').getBlockingOpenTicket(guild, interaction.user.id);

    if (existing) {
        return interaction.reply({ content: '❌ You already have an open ticket! <#' + existing.channel_id + '>', ephemeral: true });
    }

    if (typeId) {
        // Direct type specified — show questions modal
        const type = require('./tickets').getPanelType(typeId);
        if (!type) return interaction.reply({ content: '❌ This ticket type no longer exists.', ephemeral: true });
        const { showQuestionsModal } = require('./tickets');
        return showQuestionsModal(interaction, type);
    }

    // No type — show panel type selector
    const { showTicketTypeModal } = require('./tickets');
    const panel = require('./tickets').getPanel(panelId);
    if (!panel) return interaction.reply({ content: '❌ This panel no longer exists.', ephemeral: true });
    await showTicketTypeModal(interaction, panel);
}

async function handleTicketClose(interaction, parts) {
    const ticketId = parts.slice(2).join('_');
    const guild = interaction.guild;
    const channel = interaction.channel;

    await interaction.deferReply({ ephemeral: true });

    try {
        const { closeTicket } = require('./tickets');
        const result = await closeTicket(guild, channel, interaction.user, null);
        if (result.error) {
            return interaction.editReply({ content: '❌ ' + result.error });
        }
        await interaction.editReply({ content: '✅ Closing ticket **#' + result.ticketNumber + '**...' });
    } catch (err) {
        logError(err, 'interactions', 'ticketClose');
        await interaction.editReply({ content: '❌ Failed to close ticket.' });
    }
}

async function handleTicketClaim(interaction, parts) {
    const ticketId = parts.slice(2).join('_');
    const guild = interaction.guild;
    const channel = interaction.channel;

    await interaction.deferReply({ ephemeral: true });

    try {
        const { claimTicket } = require('./tickets');
        const result = await claimTicket(guild, channel, interaction.user);
        if (result.error) {
            return interaction.editReply({ content: '❌ ' + result.error });
        }
        await interaction.editReply({ content: '✅ You claimed ticket **#' + result.ticketNumber + '**.' });
    } catch (err) {
        logError(err, 'interactions', 'ticketClaim');
        await interaction.editReply({ content: '❌ Failed to claim ticket.' });
    }
}

// ──────────────────── Exports ────────────────────

module.exports = {
    handleInteraction,
};
