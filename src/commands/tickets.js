// ──────────────────── Ticket Command Handlers v2 ────────────────────
// Panel CRUD, type management, question editing

const { EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const {
    getTicketConfig, updateTicketConfig,
    getPanels, getPanel, createPanel, updatePanel, deletePanel,
    getPanelTypes, getPanelType, createPanelType, updatePanelType, deletePanelType,
    parseQuestions, parseSupportRoles,
    closeTicket, claimTicket, addUserToTicket, removeUserFromTicket, renameTicket,
    sendTicketPanel, createTicket,
} = require('../tickets');
const { logError } = require('../logError');
const { getDb } = require('../db');

async function executeTicket(interaction) {
    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild;

    if (!guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) {
        return interaction.reply({ content: '❌ I need **Manage Channels** permission to manage tickets.', ephemeral: true });
    }

    switch (sub) {
        // Panel management
        case 'panel_create': return handlePanelCreate(interaction);
        case 'panel_delete': return handlePanelDelete(interaction);
        case 'panel_list': return handlePanelList(interaction);
        case 'panel_send': return handlePanelSend(interaction);
        // Panel type management
        case 'type_add': return handleTypeAdd(interaction);
        case 'type_remove': return handleTypeRemove(interaction);
        case 'type_list': return handleTypeList(interaction);
        case 'type_category': return handleTypeCategory(interaction);
        case 'type_role': return handleTypeRole(interaction);
        case 'type_welcome': return handleTypeWelcome(interaction);
        case 'type_question': return handleTypeQuestion(interaction);
        case 'type_question_remove': return handleTypeQuestionRemove(interaction);
        // Global config
        case 'config_show': return handleConfigShow(interaction);
        case 'toggle': return handleConfigToggle(interaction);
        case 'close_on_leave': return handleConfigCloseOnLeave(interaction);
        case 'log_channel': return handleConfigLogChannel(interaction);
        // Ticket actions
        case 'add': return handleAdd(interaction);
        case 'remove': return handleRemove(interaction);
        case 'close': return handleClose(interaction);
        case 'claim': return handleClaim(interaction);
        case 'rename': return handleRename(interaction);
        default:
            return interaction.reply({ content: '❌ Unknown subcommand.', ephemeral: true });
    }
}

// ──────────────────── Panel CRUD ────────────────────

async function handlePanelList(interaction) {
    const panels = getPanels(interaction.guild.id);
    if (panels.length === 0) {
        return interaction.reply({
            content: '📋 No ticket panels configured. Use `/ticket panel_create <name>` to create one.',
            ephemeral: true,
        });
    }

    const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setAuthor({ name: interaction.guild.name, iconURL: interaction.guild.iconURL() })
        .setTitle('📋 Ticket Panels')
        .setTimestamp();

    for (const p of panels) {
        const types = getPanelTypes(p.id);
        const typeNames = types.map(t => t.emoji + ' ' + t.name).join(', ') || '*No types*';
        embed.addFields({
            name: p.name,
            value: '🆔 `' + p.id + '`\n' +
                '📝 Types: ' + types.length + '\n' +
                '📌 Types: ' + typeNames.slice(0, 200) + '\n' +
                (p.channel_id ? '📍 Channel: <#' + p.channel_id + '>' : '📍 *Not sent yet*'),
            inline: false,
        });
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handlePanelCreate(interaction) {
    const name = interaction.options.getString('name');
    createPanel(interaction.guild.id, name);
    await interaction.reply({
        content: '✅ Panel **' + name + '** created! Now add ticket types with `/ticket type_add` and send it with `/ticket panel_send`.',
        ephemeral: true,
    });
}

async function handlePanelDelete(interaction) {
    const name = interaction.options.getString('name');
    const panels = getPanels(interaction.guild.id);
    const panel = panels.find(p => p.name.toLowerCase() === name.toLowerCase() || p.id === name);
    if (!panel) return interaction.reply({ content: '❌ Panel not found. Use `/ticket panel_list` to see available panels.', ephemeral: true });

    deletePanel(panel.id);
    await interaction.reply({ content: '✅ Panel **' + panel.name + '** deleted.', ephemeral: true });
}

async function handlePanelSend(interaction) {
    const name = interaction.options.getString('panel');
    const channel = interaction.options.getChannel('channel') || interaction.channel;
    const panels = getPanels(interaction.guild.id);
    const panel = panels.find(p => p.name.toLowerCase() === name.toLowerCase() || p.id === name);
    if (!panel) return interaction.reply({ content: '❌ Panel not found. Use `/ticket panel_list` to see available panels.', ephemeral: true });

    const types = getPanelTypes(panel.id);
    if (types.length === 0) {
        return interaction.reply({ content: '❌ This panel has no ticket types. Add one with `/ticket type_add` first.', ephemeral: true });
    }

    await sendTicketPanel(panel, channel);
    await interaction.reply({ content: '✅ Panel **' + panel.name + '** sent to ' + String(channel) + '.', ephemeral: true });
}

// ──────────────────── Panel Type Management ────────────────────

async function handleTypeAdd(interaction) {
    const panelName = interaction.options.getString('panel');
    const typeName = interaction.options.getString('name');
    const emoji = interaction.options.getString('emoji') || '🎫';

    const panels = getPanels(interaction.guild.id);
    const panel = panels.find(p => p.name.toLowerCase() === panelName.toLowerCase() || p.id === panelName);
    if (!panel) return interaction.reply({ content: '❌ Panel not found.', ephemeral: true });

    const existing = getPanelTypes(panel.id).find(t => t.name.toLowerCase() === typeName.toLowerCase());
    if (existing) return interaction.reply({ content: '❌ A type with that name already exists in this panel.', ephemeral: true });

    createPanelType(panel.id, interaction.guild.id, typeName, emoji);
    await interaction.reply({ content: '✅ Type **' + emoji + ' ' + typeName + '** added to panel **' + panel.name + '**.', ephemeral: true });
}

async function handleTypeRemove(interaction) {
    const panelName = interaction.options.getString('panel');
    const typeName = interaction.options.getString('type');
    const panels = getPanels(interaction.guild.id);
    const panel = panels.find(p => p.name.toLowerCase() === panelName.toLowerCase() || p.id === panelName);
    if (!panel) return interaction.reply({ content: '❌ Panel not found.', ephemeral: true });

    const types = getPanelTypes(panel.id);
    const type = types.find(t => t.name.toLowerCase() === typeName.toLowerCase() || t.id === typeName);
    if (!type) return interaction.reply({ content: '❌ Ticket type not found.', ephemeral: true });

    deletePanelType(type.id);
    await interaction.reply({ content: '✅ Type **' + type.emoji + ' ' + type.name + '** removed from panel **' + panel.name + '**.', ephemeral: true });
}

async function handleTypeList(interaction) {
    const panelName = interaction.options.getString('panel');
    const panels = getPanels(interaction.guild.id);
    const panel = panels.find(p => p.name.toLowerCase() === panelName.toLowerCase() || p.id === panelName);
    if (!panel) return interaction.reply({ content: '❌ Panel not found.', ephemeral: true });

    const types = getPanelTypes(panel.id);
    if (types.length === 0) {
        return interaction.reply({ content: '❌ No types in this panel. Add one with `/ticket type_add`.', ephemeral: true });
    }

    const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setAuthor({ name: interaction.guild.name, iconURL: interaction.guild.iconURL() })
        .setTitle('🎫 ' + panel.name + ' — Ticket Types')
        .setTimestamp();

    for (const t of types) {
        const supportRoles = parseSupportRoles(t.support_roles);
        const roleMentions = supportRoles.length > 0 ? supportRoles.map(r => '<@&' + r + '>').join(', ') : '*None*';
        const questions = parseQuestions(t.questions);
        const questionList = questions.length > 0 ? questions.map((q, i) => (i + 1) + '. ' + (q.label || q.question)).join('\n') : '*None*';

        embed.addFields({
            name: t.emoji + ' ' + t.name,
            value: '🆔 `' + t.id + '`\n' +
                '📁 Category: ' + (t.category_id ? '<#' + t.category_id + '>' : '*Default*') + '\n' +
                '👥 Support Roles: ' + roleMentions.slice(0, 100) + '\n' +
                '📝 Questions: ' + questions.length + '\n' +
                '💬 ' + questionList.slice(0, 150),
            inline: false,
        });
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleTypeCategory(interaction) {
    const panelName = interaction.options.getString('panel');
    const typeName = interaction.options.getString('type');
    const channel = interaction.options.getChannel('channel');

    const panels = getPanels(interaction.guild.id);
    const panel = panels.find(p => p.name.toLowerCase() === panelName.toLowerCase() || p.id === panelName);
    if (!panel) return interaction.reply({ content: '❌ Panel not found.', ephemeral: true });

    const types = getPanelTypes(panel.id);
    const type = types.find(t => t.name.toLowerCase() === typeName.toLowerCase() || t.id === typeName);
    if (!type) return interaction.reply({ content: '❌ Ticket type not found.', ephemeral: true });

    updatePanelType(type.id, { category_id: channel ? channel.id : null });
    await interaction.reply({
        content: channel ? '✅ Category set to ' + String(channel) + ' for type **' + type.name + '**.' : '✅ Category cleared for type **' + type.name + '**.',
        ephemeral: true,
    });
}

async function handleTypeRole(interaction) {
    const panelName = interaction.options.getString('panel');
    const typeName = interaction.options.getString('type');
    const role = interaction.options.getRole('role');

    const panels = getPanels(interaction.guild.id);
    const panel = panels.find(p => p.name.toLowerCase() === panelName.toLowerCase() || p.id === panelName);
    if (!panel) return interaction.reply({ content: '❌ Panel not found.', ephemeral: true });

    const types = getPanelTypes(panel.id);
    const type = types.find(t => t.name.toLowerCase() === typeName.toLowerCase() || t.id === typeName);
    if (!type) return interaction.reply({ content: '❌ Ticket type not found.', ephemeral: true });

    const currentRoles = parseSupportRoles(type.support_roles);
    const action = interaction.options.getString('action') || 'add';

    let updatedRoles;
    if (action === 'add') {
        if (currentRoles.includes(role.id)) return interaction.reply({ content: '❌ That role is already added.', ephemeral: true });
        updatedRoles = [...currentRoles, role.id];
    } else {
        updatedRoles = currentRoles.filter(r => r !== role.id);
    }

    updatePanelType(type.id, { support_roles: updatedRoles });
    await interaction.reply({
        content: action === 'add'
            ? '✅ ' + String(role) + ' added to support roles for **' + type.name + '**.'
            : '✅ ' + String(role) + ' removed from support roles for **' + type.name + '**.',
        ephemeral: true,
    });
}

async function handleTypeWelcome(interaction) {
    const panelName = interaction.options.getString('panel');
    const typeName = interaction.options.getString('type');
    const message = interaction.options.getString('message');

    const panels = getPanels(interaction.guild.id);
    const panel = panels.find(p => p.name.toLowerCase() === panelName.toLowerCase() || p.id === panelName);
    if (!panel) return interaction.reply({ content: '❌ Panel not found.', ephemeral: true });

    const types = getPanelTypes(panel.id);
    const type = types.find(t => t.name.toLowerCase() === typeName.toLowerCase() || t.id === typeName);
    if (!type) return interaction.reply({ content: '❌ Ticket type not found.', ephemeral: true });

    updatePanelType(type.id, { welcome_message: message });
    await interaction.reply({ content: '✅ Welcome message updated for **' + type.name + '**.', ephemeral: true });
}

async function handleTypeQuestion(interaction) {
    const panelName = interaction.options.getString('panel');
    const typeName = interaction.options.getString('type');
    const label = interaction.options.getString('label');
    const required = interaction.options.getBoolean('required') ?? true;
    const placeholder = interaction.options.getString('placeholder') || '';

    const panels = getPanels(interaction.guild.id);
    const panel = panels.find(p => p.name.toLowerCase() === panelName.toLowerCase() || p.id === panelName);
    if (!panel) return interaction.reply({ content: '❌ Panel not found.', ephemeral: true });

    const types = getPanelTypes(panel.id);
    const type = types.find(t => t.name.toLowerCase() === typeName.toLowerCase() || t.id === typeName);
    if (!type) return interaction.reply({ content: '❌ Ticket type not found.', ephemeral: true });

    const questions = parseQuestions(type.questions);
    if (questions.length >= 5) return interaction.reply({ content: '❌ Max 5 questions per type.', ephemeral: true });

    questions.push({ label, required, placeholder, maxLength: 500 });
    updatePanelType(type.id, { questions });
    await interaction.reply({ content: '✅ Question **' + label + '** added (#' + questions.length + ').', ephemeral: true });
}

async function handleTypeQuestionRemove(interaction) {
    const panelName = interaction.options.getString('panel');
    const typeName = interaction.options.getString('type');
    const index = interaction.options.getInteger('index');

    const panels = getPanels(interaction.guild.id);
    const panel = panels.find(p => p.name.toLowerCase() === panelName.toLowerCase() || p.id === panelName);
    if (!panel) return interaction.reply({ content: '❌ Panel not found.', ephemeral: true });

    const types = getPanelTypes(panel.id);
    const type = types.find(t => t.name.toLowerCase() === typeName.toLowerCase() || t.id === typeName);
    if (!type) return interaction.reply({ content: '❌ Ticket type not found.', ephemeral: true });

    const questions = parseQuestions(type.questions);
    if (index < 1 || index > questions.length) return interaction.reply({ content: '❌ Invalid question index. Use `/ticket type_list` to see question numbers.', ephemeral: true });

    const removed = questions.splice(index - 1, 1);
    updatePanelType(type.id, { questions });
    await interaction.reply({ content: '✅ Removed question **' + (removed[0]?.label || 'Unknown') + '**.', ephemeral: true });
}

// ──────────────────── Config ────────────────────

async function handleConfigShow(interaction) {
    const config = getTicketConfig(interaction.guild.id);
    const panels = getPanels(interaction.guild.id);
    const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setAuthor({ name: interaction.guild.name, iconURL: interaction.guild.iconURL() })
        .setTitle('🎫 Ticket Configuration')
        .addFields(
            { name: 'Enabled', value: config.enabled ? '✅ Yes' : '❌ No', inline: true },
            { name: 'Panels', value: String(panels.length), inline: true },
            { name: 'Tickets Created', value: String(config.ticket_count || 0), inline: true },
            { name: 'Close on Leave', value: config.close_on_leave ? '✅ Yes' : '❌ No', inline: true },
            { name: 'Log Channel', value: config.log_channel_id ? '<#' + config.log_channel_id + '>' : '*Not set*', inline: true },
        )
        .setTimestamp();
    return interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleConfigToggle(interaction) {
    const value = interaction.options.getBoolean('enabled');
    updateTicketConfig(interaction.guild.id, { enabled: value });
    return interaction.reply({ content: value ? '✅ Tickets are now **enabled**.' : '❌ Tickets are now **disabled**.', ephemeral: true });
}

async function handleConfigCloseOnLeave(interaction) {
    const value = interaction.options.getBoolean('enabled');
    updateTicketConfig(interaction.guild.id, { close_on_leave: value });
    return interaction.reply({ content: value ? '✅ Auto-close on leave enabled.' : '✅ Auto-close on leave disabled.', ephemeral: true });
}

async function handleConfigLogChannel(interaction) {
    const value = interaction.options.getChannel('channel');
    updateTicketConfig(interaction.guild.id, { log_channel_id: value ? value.id : null });
    return interaction.reply({ content: value ? '✅ Log channel set to ' + String(value) + '.' : '✅ Log channel cleared.', ephemeral: true });
}

// ──────────────────── Ticket Actions ────────────────────

async function handleAdd(interaction) {
    const user = interaction.options.getUser('user');
    const result = await addUserToTicket(interaction.guild, interaction.channel, interaction.user, user);
    if (result.error) return interaction.reply({ content: '❌ ' + result.error, ephemeral: true });
    await interaction.reply({ content: '✅ ' + String(user) + ' has been added.', ephemeral: true });
}

async function handleRemove(interaction) {
    const user = interaction.options.getUser('user');
    const result = await removeUserFromTicket(interaction.guild, interaction.channel, interaction.user, user);
    if (result.error) return interaction.reply({ content: '❌ ' + result.error, ephemeral: true });
    await interaction.reply({ content: '✅ ' + String(user) + ' has been removed.', ephemeral: true });
}

async function handleClose(interaction) {
    const reason = interaction.options.getString('reason') || null;
    const result = await closeTicket(interaction.guild, interaction.channel, interaction.user, reason);
    if (result.error) return interaction.reply({ content: '❌ ' + result.error, ephemeral: true });
    await interaction.reply({ content: '✅ Ticket **#' + result.ticketNumber + '** is being closed.', ephemeral: true });
}

async function handleClaim(interaction) {
    const result = await claimTicket(interaction.guild, interaction.channel, interaction.user);
    if (result.error) return interaction.reply({ content: '❌ ' + result.error, ephemeral: true });
    await interaction.reply({ content: '✅ You are now handling ticket **#' + result.ticketNumber + '**.', ephemeral: true });
}

async function handleRename(interaction) {
    const name = interaction.options.getString('name');
    const result = await renameTicket(interaction.guild, interaction.channel, interaction.user, name);
    if (result.error) return interaction.reply({ content: '❌ ' + result.error, ephemeral: true });
    await interaction.reply({ content: '✅ Channel renamed to `' + name + '`.', ephemeral: true });
}

module.exports = { executeTicket };
