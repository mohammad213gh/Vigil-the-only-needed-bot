// ──────────────────── Ticket System ────────────────────
// Core logic for creating, closing, claiming tickets
// and managing ticket configuration per guild.

const {
    EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
    PermissionFlagsBits, ChannelType,
} = require('discord.js');
const { getDb } = require('./db');
const { logError } = require('./logError');

let client = null;

function setTicketClient(c) {
    client = c;
}

// ──────────────────── Ticket Config ────────────────────

function getTicketConfig(guildId) {
    const db = getDb();
    const row = db.prepare('SELECT * FROM ticket_config WHERE guild_id = ?').get(guildId);
    if (row) return row;
    // Create default
    const defaults = {
        guild_id: guildId,
        enabled: 0,
        category_id: null,
        support_role_id: null,
        ticket_count: 0,
        welcome_message: 'Thank you for creating a ticket. Please describe your issue and a staff member will be with you shortly.',
        close_on_leave: 0,
        log_channel_id: null,
    };
    db.prepare(`INSERT INTO ticket_config (guild_id, enabled, category_id, support_role_id, ticket_count, welcome_message, close_on_leave, log_channel_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
        guildId, 0, null, null, 0, defaults.welcome_message, 0, null
    );
    return defaults;
}

function updateTicketConfig(guildId, updates) {
    const db = getDb();
    const current = getTicketConfig(guildId);
    const merged = { ...current, ...updates };
    db.prepare(`UPDATE ticket_config SET
        enabled = ?, category_id = ?, support_role_id = ?, ticket_count = ?,
        welcome_message = ?, close_on_leave = ?, log_channel_id = ?
        WHERE guild_id = ?`).run(
        merged.enabled ? 1 : 0,
        merged.category_id || null,
        merged.support_role_id || null,
        merged.ticket_count || 0,
        merged.welcome_message || '',
        merged.close_on_leave ? 1 : 0,
        merged.log_channel_id || null,
        guildId
    );
    return merged;
}

// ──────────────────── Ticket Actions ────────────────────

const TICKET_COLORS = {
    open: 0x5865F2,
    closed: 0xE74C3C,
    claimed: 0xF1C40F,
};

function generateTicketId(guildId, ticketNumber) {
    return guildId + '_' + ticketNumber;
}

async function createTicket(guild, creator, reason, config) {
    const db = getDb();
    const ticketNumber = (config.ticket_count || 0) + 1;
    const ticketId = generateTicketId(guild.id, ticketNumber);

    // Update ticket count
    updateTicketConfig(guild.id, { ticket_count: ticketNumber });

    // Build channel name
    const safeName = creator.username.toLowerCase().replace(/[^a-z0-9]/g, '');
    const channelName = 'ticket-' + safeName + '-' + ticketNumber;

    // Determine permissions
    const everyoneRole = guild.roles.everyone;
    const supportRole = config.support_role_id ? guild.roles.cache.get(config.support_role_id) : null;

    const permissionOverwrites = [
        {
            id: everyoneRole.id,
            deny: [PermissionFlagsBits.ViewChannel],
        },
        {
            id: creator.id,
            allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.AttachFiles,
                PermissionFlagsBits.AddReactions,
            ],
        },
        {
            id: client.user.id,
            allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.ManageChannels,
                PermissionFlagsBits.ManageMessages,
                PermissionFlagsBits.AttachFiles,
            ],
        },
    ];

    // Add support role if set
    if (supportRole) {
        permissionOverwrites.push({
            id: supportRole.id,
            allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.AttachFiles,
                PermissionFlagsBits.AddReactions,
            ],
        });
    }

    // Create the channel
    const category = config.category_id ? guild.channels.cache.get(config.category_id) : null;
    const channel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: category ? category.id : null,
        permissionOverwrites: permissionOverwrites,
        topic: 'Ticket #' + ticketNumber + ' | Created by ' + creator.tag + ' | ' + (reason || 'No reason provided'),
    });

    // Store in DB
    db.prepare(`INSERT INTO tickets (id, guild_id, ticket_number, channel_id, creator_id, creator_tag, status, reason, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        ticketId, guild.id, ticketNumber, channel.id, creator.id, creator.tag, 'open', reason || null, Date.now()
    );

    // Send welcome embed
    const welcomeEmbed = new EmbedBuilder()
        .setColor(TICKET_COLORS.open)
        .setAuthor({ name: 'Ticket #' + ticketNumber, iconURL: guild.iconURL() })
        .setTitle('🎫 Ticket Created')
        .setDescription(config.welcome_message || 'Thank you for creating a ticket. A staff member will be with you shortly.')
        .addFields(
            { name: 'Created By', value: String(creator), inline: true },
            { name: 'Reason', value: reason || '*Not provided*', inline: true },
        )
        .setFooter({ text: guild.name, iconURL: guild.iconURL() })
        .setTimestamp();

    // Close button
    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('tk_close_' + ticketId)
            .setLabel('Close Ticket')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🔒')
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('tk_claim_' + ticketId)
            .setLabel('Claim Ticket')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('✋')
    );

    await channel.send({
        content: supportRole ? '<@&' + supportRole.id + '>' : '',
        embeds: [welcomeEmbed],
        components: [row2, row1],
    });

    // Log ticket creation to log channel
    await logTicketAction(guild, '🎫 Ticket Created', TICKET_COLORS.open, {
        'Ticket #': '#' + ticketNumber,
        'Creator': String(creator),
        'Channel': '<#' + channel.id + '>',
        'Reason': reason || '*Not provided*',
    }, config.log_channel_id);

    // Record system message
    recordTicketMessage(ticketId, '0', 'System', null, 'Ticket created by ' + creator.tag + (reason ? ' — Reason: ' + reason : ''), 1);

    return { channel, ticketId, ticketNumber };
}

async function closeTicket(guild, channel, closer, reason) {
    const db = getDb();
    const ticket = db.prepare('SELECT * FROM tickets WHERE channel_id = ? AND guild_id = ? AND status = ?').get(channel.id, guild.id, 'open');
    if (!ticket) {
        // Check for claimed tickets
        const claimedTicket = db.prepare('SELECT * FROM tickets WHERE channel_id = ? AND guild_id = ? AND status = ?').get(channel.id, guild.id, 'claimed');
        if (!claimedTicket) return { error: 'No open ticket found for this channel.' };
        return closeTicketById(guild, channel, closer, reason, claimedTicket);
    }
    return closeTicketById(guild, channel, closer, reason, ticket);
}

async function closeTicketById(guild, channel, closer, reason, ticket) {
    const db = getDb();
    const closeReason = reason || 'No reason provided';

    db.prepare(`UPDATE tickets SET status = ?, closed_by_id = ?, closed_by_tag = ?, closed_at = ?, closed_reason = ?
        WHERE id = ?`).run('closed', closer.id, closer.tag, Date.now(), closeReason, ticket.id);

    // Send closing embed
    try {
        const closeEmbed = new EmbedBuilder()
            .setColor(TICKET_COLORS.closed)
            .setTitle('🔒 Ticket Closed')
            .setDescription('This ticket has been closed by **' + closer.tag + '**' + (reason ? '\nReason: ' + reason : ''))
            .setFooter({ text: guild.name, iconURL: guild.iconURL() })
            .setTimestamp();

        await channel.send({ embeds: [closeEmbed] });
    } catch (err) {
        logError(err, 'tickets', 'closeEmbed');
    }

    // Log
    await logTicketAction(guild, '🔒 Ticket Closed', TICKET_COLORS.closed, {
        'Ticket #': '#' + ticket.ticket_number,
        'Closed By': String(closer),
        'Reason': closeReason,
    }, null);

    // Record system message
    recordTicketMessage(ticket.id, '0', 'System', null, 'Ticket closed by ' + closer.tag + (reason ? ' — Reason: ' + reason : ''), 1);

    // Delete channel after 5 seconds
    setTimeout(async () => {
        try {
            // Save transcript before deleting
            await saveTranscript(guild, ticket, channel);
            await channel.delete('Ticket closed by ' + closer.tag);
        } catch (err) {
            logError(err, 'tickets', 'deleteChannel');
        }
    }, 5000);

    // Notify creator via DM
    try {
        const creator = await client.users.fetch(ticket.creator_id).catch(() => null);
        if (creator) {
            const dmEmbed = new EmbedBuilder()
                .setColor(TICKET_COLORS.closed)
                .setTitle('🎫 Ticket Closed — ' + guild.name)
                .setDescription('Your ticket **#' + ticket.ticket_number + '** has been closed.')
                .addFields(
                    { name: 'Closed By', value: closer.tag, inline: true },
                    { name: 'Reason', value: closeReason, inline: true },
                )
                .setFooter({ text: 'Ticket #' + ticket.ticket_number })
                .setTimestamp();
            await creator.send({ embeds: [dmEmbed] }).catch(() => {});
        }
    } catch { /* DM failed, silently skip */ }

    return { success: true, ticketNumber: ticket.ticket_number };
}

async function claimTicket(guild, channel, claimer) {
    const db = getDb();
    const ticket = db.prepare('SELECT * FROM tickets WHERE channel_id = ? AND guild_id = ? AND status = ?').get(channel.id, guild.id, 'open');
    if (!ticket) return { error: 'No open ticket found for this channel.' };

    db.prepare('UPDATE tickets SET status = ?, claimer_id = ? WHERE id = ?').run('claimed', claimer.id, ticket.id);

    const claimEmbed = new EmbedBuilder()
        .setColor(TICKET_COLORS.claimed)
        .setTitle('✋ Ticket Claimed')
        .setDescription('**' + claimer.tag + '** is now handling this ticket.')
        .setFooter({ text: guild.name, iconURL: guild.iconURL() })
        .setTimestamp();

    await channel.send({ embeds: [claimEmbed] });

    // Send follow-up message with close button only (claimed state)
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('tk_close_' + ticket.id)
            .setLabel('Close Ticket')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🔒')
    );

    await channel.send({ components: [row] });

    // Log
    await logTicketAction(guild, '✋ Ticket Claimed', TICKET_COLORS.claimed, {
        'Ticket #': '#' + ticket.ticket_number,
        'Claimed By': String(claimer),
    }, null);

    recordTicketMessage(ticket.id, '0', 'System', null, 'Ticket claimed by ' + claimer.tag, 1);

    return { success: true, ticketNumber: ticket.ticket_number };
}

async function addUserToTicket(guild, channel, adder, targetUser) {
    const db = getDb();
    const ticket = db.prepare('SELECT * FROM tickets WHERE channel_id = ? AND guild_id = ?').get(channel.id, guild.id);
    if (!ticket) return { error: 'No ticket found for this channel.' };

    try {
        await channel.permissionOverwrites.create(targetUser, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true,
            AttachFiles: true,
            AddReactions: true,
        });

        const embed = new EmbedBuilder()
            .setColor(TICKET_COLORS.open)
            .setDescription('➕ ' + String(targetUser) + ' has been added to this ticket by **' + adder.tag + '**')
            .setTimestamp();

        await channel.send({ embeds: [embed] });

        recordTicketMessage(ticket.id, '0', 'System', null, targetUser.tag + ' added to ticket by ' + adder.tag, 1);
        return { success: true };
    } catch (err) {
        logError(err, 'tickets', 'addUser');
        return { error: 'Failed to add user: ' + err.message };
    }
}

async function removeUserFromTicket(guild, channel, remover, targetUser) {
    const db = getDb();
    const ticket = db.prepare('SELECT * FROM tickets WHERE channel_id = ? AND guild_id = ?').get(channel.id, guild.id);
    if (!ticket) return { error: 'No ticket found for this channel.' };

    try {
        await channel.permissionOverwrites.delete(targetUser).catch(() => {});

        const embed = new EmbedBuilder()
            .setColor(TICKET_COLORS.closed)
            .setDescription('➖ ' + String(targetUser) + ' has been removed from this ticket by **' + remover.tag + '**')
            .setTimestamp();

        await channel.send({ embeds: [embed] });

        recordTicketMessage(ticket.id, '0', 'System', null, targetUser.tag + ' removed from ticket by ' + remover.tag, 1);
        return { success: true };
    } catch (err) {
        logError(err, 'tickets', 'removeUser');
        return { error: 'Failed to remove user: ' + err.message };
    }
}

async function renameTicket(guild, channel, renamer, newName) {
    try {
        await channel.setName(newName);
        return { success: true };
    } catch (err) {
        logError(err, 'tickets', 'rename');
        return { error: 'Failed to rename channel: ' + err.message };
    }
}

// ──────────────────── Transcript ────────────────────

function recordTicketMessage(ticketId, authorId, authorTag, authorAvatar, content, isSystem) {
    try {
        const db = getDb();
        db.prepare(`INSERT INTO ticket_messages (ticket_id, author_id, author_tag, author_avatar, content, is_system, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
            ticketId, authorId, authorTag, authorAvatar || null, content || '', isSystem ? 1 : 0, Date.now()
        );
    } catch (err) {
        logError(err, 'tickets', 'recordMessage');
    }
}

async function saveTranscript(guild, ticket, channel) {
    try {
        const db = getDb();
        // Fetch all messages from the channel for the transcript
        const messages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
        if (!messages) return;

        // Store all messages
        const insert = db.prepare(`INSERT OR IGNORE INTO ticket_messages (ticket_id, author_id, author_tag, author_avatar, content, is_system, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`);

        const tx = db.transaction(() => {
            for (const [, msg] of messages) {
                if (msg.author.bot && !msg.system) continue; // Skip bot messages unless system
                const avatar = msg.author.displayAvatarURL({ size: 32 }) || null;
                insert.run(
                    ticket.id,
                    msg.author.id,
                    msg.author.tag,
                    avatar,
                    msg.content || '',
                    msg.system ? 1 : 0,
                    msg.createdTimestamp || Date.now()
                );
            }
        });
        tx();

        // Generate transcript text and save
        const transcriptLines = [
            '═══════════════════════════════════════════',
            '  TICKET TRANSCRIPT — #' + ticket.ticket_number,
            '  Guild: ' + guild.name + ' (' + guild.id + ')',
            '  Created by: ' + ticket.creator_tag + ' (' + ticket.creator_id + ')',
            '  Created at: ' + new Date(ticket.created_at).toLocaleString(),
            ticket.closed_at ? '  Closed at: ' + new Date(ticket.closed_at).toLocaleString() : '',
            '═══════════════════════════════════════════',
            '',
        ];

        // Replay messages in order
        const allMsgs = db.prepare('SELECT * FROM ticket_messages WHERE ticket_id = ? ORDER BY created_at ASC').all(ticket.id);
        for (const m of allMsgs) {
            const time = new Date(m.created_at).toLocaleString();
            if (m.is_system) {
                transcriptLines.push('[System — ' + time + '] ' + m.content);
            } else {
                transcriptLines.push('[' + time + '] ' + m.author_tag + ': ' + m.content);
            }
        }

        transcriptLines.push('');
        transcriptLines.push('═══════════════════════════════════════════');
        transcriptLines.push('  End of transcript — ' + allMsgs.length + ' messages');

        const transcript = transcriptLines.join('\n');

        // Store transcript in the ticket record
        db.prepare('UPDATE tickets SET transcript = ? WHERE id = ?').run(transcript.slice(0, 100000), ticket.id);

        // Send transcript to log channel if configured
        const config = getTicketConfig(guild.id);
        if (config.log_channel_id) {
            try {
                const logChannel = guild.channels.cache.get(config.log_channel_id);
                if (logChannel) {
                    const transcriptEmbed = new EmbedBuilder()
                        .setColor(TICKET_COLORS.closed)
                        .setTitle('📄 Ticket #' + ticket.ticket_number + ' — Transcript')
                        .setDescription('Ticket closed with **' + allMsgs.length + '** messages.')
                        .addFields(
                            { name: 'Created By', value: ticket.creator_tag || 'Unknown', inline: true },
                            { name: 'Closed By', value: ticket.closed_by_tag || 'Unknown', inline: true },
                            { name: 'Reason', value: ticket.closed_reason || '*Not provided*', inline: true },
                        )
                        .setFooter({ text: guild.name, iconURL: guild.iconURL() })
                        .setTimestamp();

                    // Send transcript as a file
                    await logChannel.send({
                        embeds: [transcriptEmbed],
                        files: [{
                            attachment: Buffer.from(transcript),
                            name: 'ticket-' + ticket.ticket_number + '-' + guild.id + '.txt',
                        }],
                    }).catch(() => {});
                }
            } catch { /* log channel failed */ }
        }
    } catch (err) {
        logError(err, 'tickets', 'saveTranscript');
    }
}

// ──────────────────── Ticket Panel ────────────────────

async function sendTicketPanel(channel, config) {
    const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setAuthor({ name: channel.guild.name, iconURL: channel.guild.iconURL() })
        .setTitle('🎫 Support Tickets')
        .setDescription(
            'Need help from the staff team? Click the button below to create a ticket.\n\n' +
            '**Before opening a ticket:**\n' +
            '• Check if your question is answered in the server rules/FAQ\n' +
            '• Be clear and detailed about your issue\n' +
            '• Do not create multiple tickets for the same issue\n\n' +
            'A staff member will assist you as soon as possible.'
        )
        .setFooter({ text: 'Click the button below to create a ticket' })
        .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('tk_create')
            .setLabel('Create Ticket')
            .setStyle(ButtonStyle.Success)
            .setEmoji('🎫')
    );

    await channel.send({ embeds: [embed], components: [row] });
}

// ──────────────────── Logging Helper ────────────────────

async function logTicketAction(guild, title, color, fields, logChannelId) {
    if (!logChannelId) {
        const config = getTicketConfig(guild.id);
        logChannelId = config.log_channel_id;
    }
    if (!logChannelId) return;

    try {
        const channel = guild.channels.cache.get(logChannelId);
        if (!channel) return;

        const embed = new EmbedBuilder()
            .setColor(color)
            .setTitle(title)
            .setFooter({ text: guild.name, iconURL: guild.iconURL() })
            .setTimestamp();

        for (const [name, value] of Object.entries(fields)) {
            embed.addFields({ name: name, value: String(value), inline: true });
        }

        await channel.send({ embeds: [embed] });
    } catch (err) {
        logError(err, 'tickets', 'logTicketAction');
    }
}

// ──────────────────── Member Leave Check ────────────────────

async function handleMemberLeave(member) {
    const db = getDb();
    const config = getTicketConfig(member.guild.id);
    if (!config.close_on_leave) return;

    // Find all open tickets by this user
    const tickets = db.prepare('SELECT * FROM tickets WHERE guild_id = ? AND creator_id = ? AND status IN (?, ?)')
        .all(member.guild.id, member.id, 'open', 'claimed');

    for (const ticket of tickets) {
        try {
            const channel = member.guild.channels.cache.get(ticket.channel_id);
            if (!channel) continue;

            // Close the ticket automatically
            db.prepare(`UPDATE tickets SET status = ?, closed_by_id = ?, closed_by_tag = ?, closed_at = ?, closed_reason = ?
                WHERE id = ?`).run('closed', client.user.id, client.user.tag + ' (Auto)', Date.now(), 'Member left the server', ticket.id);

            const embed = new EmbedBuilder()
                .setColor(TICKET_COLORS.closed)
                .setTitle('🔒 Ticket Auto-Closed')
                .setDescription('**' + member.user.tag + '** has left the server. Ticket automatically closed.')
                .setTimestamp();

            await channel.send({ embeds: [embed] });

            setTimeout(async () => {
                try {
                    await saveTranscript(member.guild, ticket, channel);
                    await channel.delete('Member left — auto close ticket');
                } catch (err) {
                    logError(err, 'tickets', 'autoCloseDelete');
                }
            }, 5000);
        } catch (err) {
            logError(err, 'tickets', 'handleMemberLeave');
        }
    }
}

// ──────────────────── Exports ────────────────────

module.exports = {
    setTicketClient,
    getTicketConfig,
    updateTicketConfig,
    createTicket,
    closeTicket,
    claimTicket,
    addUserToTicket,
    removeUserFromTicket,
    renameTicket,
    sendTicketPanel,
    saveTranscript,
    recordTicketMessage,
    handleMemberLeave,
    TICKET_COLORS,
};
