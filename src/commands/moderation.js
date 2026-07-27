const { EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { formatDuration } = require('../helpers');
const { addWarning, getWarnings, clearWarnings } = require('../warnings');
const { createCase, closeCase } = require('../modCases');

async function executeKick(interaction) {
    const target = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const guild = interaction.guild;
    const member = await guild.members.fetch(target.id).catch(() => null);

    if (!member) {
        return interaction.reply({ content: '\u26A0\uFE0F Could not find that user in this server.', ephemeral: true });
    }
    if (!member.kickable) {
        return interaction.reply({ content: '\u26A0\uFE0F I cannot kick that user. They may have a higher role than me.', ephemeral: true });
    }
    if (!guild.members.me.permissions.has(PermissionFlagsBits.KickMembers)) {
        return interaction.reply({ content: '\u26A0\uFE0F I need the **Kick Members** permission to do that.', ephemeral: true });
    }

    // Show confirmation buttons
    const embed = new EmbedBuilder()
        .setColor(0xE74C3C)
        .setTitle('\u2753 Confirm Kick')
        .setDescription('Are you sure you want to kick ' + target + '?')
        .addFields(
            { name: 'User', value: String(target), inline: true },
            { name: 'Reason', value: reason, inline: true },
        )
        .setFooter({ text: guild.name, iconURL: guild.iconURL() })
        .setTimestamp();

    const confirm = new ButtonBuilder()
        .setCustomId('ck_' + interaction.user.id + '_' + target.id)
        .setLabel('Confirm Kick')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('\u2705');

    const cancel = new ButtonBuilder()
        .setCustomId('cancel_' + interaction.user.id)
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('\u274C');

    const row = new ActionRowBuilder().addComponents(confirm, cancel);

    await interaction.reply({ embeds: [embed], components: [row] });
}

async function executeBan(interaction) {
    const target = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const deleteMessages = interaction.options.getString('delete_messages') || 'none';
    const guild = interaction.guild;

    if (!guild.members.me.permissions.has(PermissionFlagsBits.BanMembers)) {
        return interaction.reply({ content: '\u26A0\uFE0F I need the **Ban Members** permission to do that.', ephemeral: true });
    }

    // Check if user is bannable (if they're in the server)
    const member = await guild.members.fetch(target.id).catch(() => null);
    if (member && !member.bannable) {
        return interaction.reply({ content: '\u26A0\uFE0F I cannot ban that user. They may have a higher role than me.', ephemeral: true });
    }

    const deleteSeconds = {
        'none': 0,
        'hour': 3600,
        '6hours': 21600,
        '24hours': 86400,
    }[deleteMessages] || 0;

    // Show confirmation buttons
    const embed = new EmbedBuilder()
        .setColor(0xE74C3C)
        .setTitle('\u2753 Confirm Ban')
        .setDescription('Are you sure you want to ban ' + target + '?')
        .addFields(
            { name: 'User', value: String(target), inline: true },
            { name: 'Reason', value: reason, inline: true },
            { name: 'Delete Messages', value: deleteMessages, inline: true },
        )
        .setFooter({ text: guild.name, iconURL: guild.iconURL() })
        .setTimestamp();

    const confirm = new ButtonBuilder()
        .setCustomId('cb_' + interaction.user.id + '_' + target.id + (deleteSeconds > 0 ? '_clear' : ''))
        .setLabel('Confirm Ban')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('\u2705');

    const cancel = new ButtonBuilder()
        .setCustomId('cancel_' + interaction.user.id)
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('\u274C');

    const row = new ActionRowBuilder().addComponents(confirm, cancel);

    await interaction.reply({ embeds: [embed], components: [row] });
}

async function executeTempBan(interaction) {
    const target = interaction.options.getUser('user');
    const duration = interaction.options.getString('duration');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const deleteMessages = interaction.options.getString('delete_messages') || 'none';
    const guild = interaction.guild;

    if (!guild.members.me.permissions.has(PermissionFlagsBits.BanMembers)) {
        return interaction.reply({ content: '\u26A0\uFE0F I need the **Ban Members** permission to do that.', ephemeral: true });
    }

    const member = await guild.members.fetch(target.id).catch(() => null);
    if (member && !member.bannable) {
        return interaction.reply({ content: '\u26A0\uFE0F I cannot ban that user. They may have a higher role than me.', ephemeral: true });
    }

    const durationMap = {
        '1h': 3600000,
        '6h': 21600000,
        '24h': 86400000,
        '3d': 259200000,
        '7d': 604800000,
        '14d': 1209600000,
        '30d': 2592000000,
    };
    const durationMs = durationMap[duration];
    if (!durationMs) {
        return interaction.reply({ content: '\u26A0\uFE0F Invalid duration.', ephemeral: true });
    }

    const deleteSeconds = { 'none': 0, 'hour': 3600, '6hours': 21600, '24hours': 86400 }[deleteMessages] || 0;
    const durationLabel = { '1h': '1 hour', '6h': '6 hours', '24h': '24 hours', '3d': '3 days', '7d': '7 days', '14d': '14 days', '30d': '30 days' }[duration];

    const embed = new EmbedBuilder()
        .setColor(0xE74C3C)
        .setTitle('\u2753 Confirm Temp Ban')
        .setDescription('Are you sure you want to **temporarily ban** ' + target + ' for **' + durationLabel + '**?')
        .addFields(
            { name: 'User', value: String(target), inline: true },
            { name: 'Duration', value: durationLabel, inline: true },
            { name: 'Reason', value: reason, inline: true },
        )
        .setFooter({ text: 'They will be auto-unbanned after ' + durationLabel })
        .setTimestamp();

    const confirm = new ButtonBuilder()
        .setCustomId('ctb_' + interaction.user.id + '_' + target.id + '_' + duration + '_' + deleteSeconds)
        .setLabel('Confirm Temp Ban')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('\u2705');

    const cancel = new ButtonBuilder()
        .setCustomId('cancel_' + interaction.user.id)
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('\u274C');

    const row = new ActionRowBuilder().addComponents(confirm, cancel);

    await interaction.reply({ embeds: [embed], components: [row] });
}

async function executeUnban(interaction) {
    const userId = interaction.options.getString('user_id');
    const guild = interaction.guild;

    if (!guild.members.me.permissions.has(PermissionFlagsBits.BanMembers)) {
        return interaction.reply({ content: '\u26A0\uFE0F I need the **Ban Members** permission to do that.', ephemeral: true });
    }

    try {
        await guild.bans.remove(userId);
        const embed = new EmbedBuilder()
            .setColor('Green')
            .setTitle('\uD83D\uDD13 Member Unbanned')
            .setDescription('User <@' + userId + '> (' + userId + ') has been unbanned.')
            .setFooter({ text: 'By ' + interaction.user.tag })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    } catch (err) {
        await interaction.reply({ content: '\u26A0\uFE0F Failed to unban user: ' + err.message, ephemeral: true }).catch(err => console.error('[Fallback]', err.message));
    }
}

async function executeTimeout(interaction) {
    const target = interaction.options.getUser('user');
    const duration = interaction.options.getString('duration');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const guild = interaction.guild;
    const member = await guild.members.fetch(target.id).catch(() => null);

    if (!member) {
        return interaction.reply({ content: '\u26A0\uFE0F Could not find that user in this server.', ephemeral: true });
    }
    if (!guild.members.me.permissions.has(PermissionFlagsBits.ModerateMembers)) {
        return interaction.reply({ content: '\u26A0\uFE0F I need the **Moderate Members** permission to do that.', ephemeral: true });
    }
    if (!member.moderatable) {
        return interaction.reply({ content: '\u26A0\uFE0F I cannot timeout that user. They may have a higher role than me.', ephemeral: true });
    }

    const durationMap = {
        '60s': 60_000,
        '5m': 300_000,
        '10m': 600_000,
        '1h': 3_600_000,
        '6h': 21_600_000,
        '24h': 86_400_000,
        '3d': 259_200_000,
        '7d': 604_800_000,
    };
    const ms = durationMap[duration];
    if (!ms) {
        return interaction.reply({ content: '\u26A0\uFE0F Invalid duration. Choose from: 60s, 5m, 10m, 1h, 6h, 24h, 3d, 7d.', ephemeral: true });
    }

    try {
        await member.timeout(ms, reason);
        createCase(guild.id, target.id, interaction.user.id, interaction.user.tag, 'timeout', reason);
        const embed = new EmbedBuilder()
            .setColor(0xF1C40F)
            .setTitle('\u23F1\uFE0F Member Timed Out')
            .setDescription(target + ' has been timed out.')
            .addFields(
                { name: 'Duration', value: formatDuration(ms), inline: true },
                { name: 'Reason', value: reason, inline: true },
                { name: 'Moderator', value: String(interaction.user), inline: true },
            )
            .setFooter({ text: guild.name, iconURL: guild.iconURL() })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    } catch (err) {
        await interaction.reply({ content: '\u26A0\uFE0F Failed to timeout user: ' + err.message, ephemeral: true }).catch(err => console.error('[Fallback]', err.message));
    }
}

async function executeUntimeout(interaction) {
    const target = interaction.options.getUser('user');
    const guild = interaction.guild;
    const member = await guild.members.fetch(target.id).catch(() => null);

    if (!member) {
        return interaction.reply({ content: '\u26A0\uFE0F Could not find that user in this server.', ephemeral: true });
    }
    if (!guild.members.me.permissions.has(PermissionFlagsBits.ModerateMembers)) {
        return interaction.reply({ content: '\u26A0\uFE0F I need the **Moderate Members** permission to do that.', ephemeral: true });
    }
    if (!member.communicationDisabledUntilTimestamp) {
        return interaction.reply({ content: '\u26A0\uFE0F That user is not currently timed out.', ephemeral: true });
    }

    try {
        await member.timeout(null);
        // Close active timeout cases for this user
        const timeoutCases = require('../modCases').getCases(guild.id, target.id, 50).filter(function(c) { return c.action_type === 'timeout' && c.active; });
        for (const tc of timeoutCases) {
            closeCase(guild.id, tc.case_number);
        }
        const embed = new EmbedBuilder()
            .setColor('Green')
            .setTitle('\u23F1\uFE0F Timeout Removed')
            .setDescription(target + ' is no longer timed out.')
            .setFooter({ text: 'By ' + interaction.user.tag })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    } catch (err) {
        await interaction.reply({ content: '\u26A0\uFE0F Failed to remove timeout: ' + err.message, ephemeral: true }).catch(err => console.error('[Fallback]', err.message));
    }
}

async function executeWarn(interaction) {
    const target = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason');
    const guild = interaction.guild;

    // If reason is provided, execute immediately (backward compat)
    if (reason) {
        const warnings = addWarning(guild.id, target.id, interaction.user.tag, reason);

        const embed = new EmbedBuilder()
            .setColor(0xF1C40F)
            .setTitle('\u26A0\uFE0F Warning Issued')
            .setDescription(target + ' has been warned.')
            .addFields(
                { name: 'Reason', value: reason },
                { name: 'Warning Count', value: String(warnings.length) },
                { name: 'Moderator', value: String(interaction.user) },
            )
            .setFooter({ text: guild.name, iconURL: guild.iconURL() })
            .setTimestamp();

        createCase(guild.id, target.id, interaction.user.id, interaction.user.tag, 'warn', reason);
        await interaction.reply({ embeds: [embed] });

        // Check warning thresholds for auto-punish
        try {
            const { checkThresholds } = require('../warningThresholds');
            const result = await checkThresholds(guild, target.id, interaction);
            if (result) {
                // Send a follow-up about the auto-punish
                await interaction.followUp({
                    content: '\u26A0\uFE0F **Auto-punish:** ' + target + ' was ' + result + ' (reached ' + warnings.length + ' warnings).',
                    ephemeral: true,
                }).catch(() => {});
            }
        } catch (err) {
            console.error('[Thresholds] Check failed:', err.message);
        }

        // DM the user about the warning
        try {
            await target.send('\u26A0\uFE0F You have been warned in **' + guild.name + '**.\nReason: ' + reason);
        } catch { /* if DMs are closed, that's fine */ }
        return;
    }

    // No reason provided — show button to open modal
    const embed = new EmbedBuilder()
        .setColor(0xF1C40F)
        .setTitle('\u26A0\uFE0F Warning ' + target.tag)
        .setDescription('Click the button below to enter the warning reason.')
        .setFooter({ text: guild.name, iconURL: guild.iconURL() })
        .setTimestamp();

    const openModal = new ButtonBuilder()
        .setCustomId('wm_' + interaction.user.id + '_' + target.id)
        .setLabel('Write Reason')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('\uD83D\uDCDD');

    const row = new ActionRowBuilder().addComponents(openModal);

    await interaction.reply({ embeds: [embed], components: [row] });
}

async function executeWarnings(interaction) {
    const target = interaction.options.getUser('user');
    const guild = interaction.guild;

    const warnings = getWarnings(guild.id, target.id);

    if (warnings.length === 0) {
        const embed = new EmbedBuilder()
            .setColor('Green')
            .setTitle('\u2705 Clean Record')
            .setDescription(target + ' has no warnings.')
            .setFooter({ text: guild.name, iconURL: guild.iconURL() })
            .setTimestamp();

        return interaction.reply({ embeds: [embed] });
    }

    const fields = warnings.map((w, i) => ({
        name: '#' + (i + 1) + ' — ' + new Date(w.date).toLocaleDateString(),
        value: 'Reason: ' + w.reason + '\nModerator: ' + w.moderator,
        inline: false,
    }));

    const embed = new EmbedBuilder()
        .setColor(0xF1C40F)
        .setTitle('\uD83D\uDCDD Warnings for ' + target.tag)
        .setDescription('Total: **' + warnings.length + '** warning' + (warnings.length !== 1 ? 's' : ''))
        .addFields(fields)
        .setFooter({ text: guild.name, iconURL: guild.iconURL() })
        .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function executeClearWarnings(interaction) {
    const target = interaction.options.getUser('user');
    const guild = interaction.guild;

    clearWarnings(guild.id, target.id);

    const embed = new EmbedBuilder()
        .setColor('Green')
        .setTitle('\uD83D\uDDD1\uFE0F Warnings Cleared')
        .setDescription('All warnings for ' + target + ' have been cleared.')
        .setFooter({ text: 'By ' + interaction.user.tag })
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}

async function executeLock(interaction) {
    const channel = interaction.options.getChannel('channel') || interaction.channel;
    const guild = interaction.guild;

    if (!guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) {
        return interaction.reply({ content: '\u26A0\uFE0F I need the **Manage Channels** permission to lock channels.', ephemeral: true });
    }

    try {
        await channel.permissionOverwrites.edit(guild.roles.everyone, {
            SendMessages: false,
        });
        const embed = new EmbedBuilder()
            .setColor(0xE74C3C)
            .setTitle('\uD83D\uDD12 Channel Locked')
            .setDescription(channel + ' has been locked.')
            .setFooter({ text: 'By ' + interaction.user.tag })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    } catch (err) {
        await interaction.reply({ content: '\u26A0\uFE0F Failed to lock channel: ' + err.message, ephemeral: true }).catch(err => console.error('[Fallback]', err.message));
    }
}

async function executeUnlock(interaction) {
    const channel = interaction.options.getChannel('channel') || interaction.channel;
    const guild = interaction.guild;

    if (!guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) {
        return interaction.reply({ content: '\u26A0\uFE0F I need the **Manage Channels** permission to unlock channels.', ephemeral: true });
    }

    try {
        await channel.permissionOverwrites.edit(guild.roles.everyone, {
            SendMessages: null,
        });
        const embed = new EmbedBuilder()
            .setColor('Green')
            .setTitle('\uD83D\uDD13 Channel Unlocked')
            .setDescription(channel + ' has been unlocked.')
            .setFooter({ text: 'By ' + interaction.user.tag })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    } catch (err) {
        await interaction.reply({ content: '\u26A0\uFE0F Failed to unlock channel: ' + err.message, ephemeral: true }).catch(err => console.error('[Fallback]', err.message));
    }
}

module.exports = {
    executeKick,
    executeBan,
    executeTempBan,
    executeUnban,
    executeTimeout,
    executeUntimeout,
    executeWarn,
    executeWarnings,
    executeClearWarnings,
    executeLock,
    executeUnlock,
};
