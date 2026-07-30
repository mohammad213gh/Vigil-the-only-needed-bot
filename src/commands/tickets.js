// ──────────────────── Ticket Command Handlers ────────────────────

const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const {
    getTicketConfig,
    updateTicketConfig,
    createTicket,
    closeTicket,
    claimTicket,
    addUserToTicket,
    removeUserFromTicket,
    renameTicket,
    sendTicketPanel,
} = require('../tickets');
const { logError } = require('../logError');

async function executeTicket(interaction) {
    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild;

    if (!guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) {
        return interaction.reply({
            content: '❌ I need **Manage Channels** permission to manage tickets.',
            ephemeral: true,
        });
    }

    switch (sub) {
        case 'panel': return handlePanel(interaction);
        case 'config_show': return handleConfigShow(interaction);
        case 'toggle': return handleConfigToggle(interaction);
        case 'category': return handleConfigCategory(interaction);
        case 'support_role': return handleConfigSupportRole(interaction);
        case 'welcome': return handleConfigWelcome(interaction);
        case 'close_on_leave': return handleConfigCloseOnLeave(interaction);
        case 'log_channel': return handleConfigLogChannel(interaction);
        case 'add': return handleAdd(interaction);
        case 'remove': return handleRemove(interaction);
        case 'close': return handleClose(interaction);
        case 'claim': return handleClaim(interaction);
        case 'rename': return handleRename(interaction);
        default:
            return interaction.reply({ content: '❌ Unknown subcommand.', ephemeral: true });
    }
}

// ──────────────────── Panel ────────────────────

async function handlePanel(interaction) {
    const channel = interaction.options.getChannel('channel') || interaction.channel;
    const config = getTicketConfig(interaction.guild.id);

    if (!config.enabled) {
        return interaction.reply({
            content: '❌ Tickets are not enabled. Use `/ticket config` to enable them first.',
            ephemeral: true,
        });
    }

    await sendTicketPanel(channel, config);

    await interaction.reply({
        content: '✅ Ticket panel sent to ' + String(channel),
        ephemeral: true,
    });
}

// ──────────────────── Config ────────────────────

async function handleConfigShow(interaction) {
    const config = getTicketConfig(interaction.guild.id);
    const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setAuthor({ name: interaction.guild.name, iconURL: interaction.guild.iconURL() })
        .setTitle('🎫 Ticket Configuration')
        .addFields(
            { name: 'Enabled', value: config.enabled ? '✅ Yes' : '❌ No', inline: true },
            { name: 'Category', value: config.category_id ? '<#' + config.category_id + '>' : '*Not set*', inline: true },
            { name: 'Support Role', value: config.support_role_id ? '<@&' + config.support_role_id + '>' : '*Not set*', inline: true },
            { name: 'Tickets Created', value: String(config.ticket_count || 0), inline: true },
            { name: 'Close on Leave', value: config.close_on_leave ? '✅ Yes' : '❌ No', inline: true },
            { name: 'Log Channel', value: config.log_channel_id ? '<#' + config.log_channel_id + '>' : '*Not set*', inline: true },
        )
        .setTimestamp();

    const welcome = config.welcome_message || '*Not set*';
    embed.addFields({ name: 'Welcome Message', value: welcome.length > 200 ? welcome.slice(0, 197) + '...' : welcome });

    return interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleConfigToggle(interaction) {
    const value = interaction.options.getBoolean('enabled');
    updateTicketConfig(interaction.guild.id, { enabled: value });
    return interaction.reply({
        content: value ? '✅ Tickets are now **enabled**.' : '❌ Tickets are now **disabled**.',
        ephemeral: true,
    });
}

async function handleConfigCategory(interaction) {
    const value = interaction.options.getChannel('channel');
    updateTicketConfig(interaction.guild.id, { category_id: value ? value.id : null });
    return interaction.reply({
        content: value ? '✅ Ticket category set to ' + String(value) + '.' : '✅ Ticket category cleared.',
        ephemeral: true,
    });
}

async function handleConfigSupportRole(interaction) {
    const value = interaction.options.getRole('role');
    updateTicketConfig(interaction.guild.id, { support_role_id: value ? value.id : null });
    return interaction.reply({
        content: value ? '✅ Support role set to ' + String(value) + '.' : '✅ Support role cleared.',
        ephemeral: true,
    });
}

async function handleConfigWelcome(interaction) {
    const value = interaction.options.getString('message');
    updateTicketConfig(interaction.guild.id, { welcome_message: value });
    return interaction.reply({
        content: '✅ Welcome message updated.',
        ephemeral: true,
    });
}

async function handleConfigCloseOnLeave(interaction) {
    const value = interaction.options.getBoolean('enabled');
    updateTicketConfig(interaction.guild.id, { close_on_leave: value });
    return interaction.reply({
        content: value ? '✅ Tickets will now auto-close when members leave.' : '✅ Auto-close on leave disabled.',
        ephemeral: true,
    });
}

async function handleConfigLogChannel(interaction) {
    const value = interaction.options.getChannel('channel');
    updateTicketConfig(interaction.guild.id, { log_channel_id: value ? value.id : null });
    return interaction.reply({
        content: value ? '✅ Ticket log channel set to ' + String(value) + '.' : '✅ Ticket log channel cleared.',
        ephemeral: true,
    });
}

// ──────────────────── Add ────────────────────

async function handleAdd(interaction) {
    const user = interaction.options.getUser('user');
    const channel = interaction.channel;

    const result = await addUserToTicket(interaction.guild, channel, interaction.user, user);
    if (result.error) {
        return interaction.reply({ content: '❌ ' + result.error, ephemeral: true });
    }

    await interaction.reply({
        content: '✅ ' + String(user) + ' has been added to this ticket.',
        ephemeral: true,
    });
}

// ──────────────────── Remove ────────────────────

async function handleRemove(interaction) {
    const user = interaction.options.getUser('user');
    const channel = interaction.channel;

    const result = await removeUserFromTicket(interaction.guild, channel, interaction.user, user);
    if (result.error) {
        return interaction.reply({ content: '❌ ' + result.error, ephemeral: true });
    }

    await interaction.reply({
        content: '✅ ' + String(user) + ' has been removed from this ticket.',
        ephemeral: true,
    });
}

// ──────────────────── Close ────────────────────

async function handleClose(interaction) {
    const reason = interaction.options.getString('reason') || null;
    const channel = interaction.channel;

    const result = await closeTicket(interaction.guild, channel, interaction.user, reason);
    if (result.error) {
        return interaction.reply({ content: '❌ ' + result.error, ephemeral: true });
    }

    await interaction.reply({
        content: '✅ Ticket **#' + result.ticketNumber + '** is being closed. Channel will be deleted shortly.',
        ephemeral: true,
    });
}

// ──────────────────── Claim ────────────────────

async function handleClaim(interaction) {
    const channel = interaction.channel;

    const result = await claimTicket(interaction.guild, channel, interaction.user);
    if (result.error) {
        return interaction.reply({ content: '❌ ' + result.error, ephemeral: true });
    }

    await interaction.reply({
        content: '✅ You are now handling ticket **#' + result.ticketNumber + '**.',
        ephemeral: true,
    });
}

// ──────────────────── Rename ────────────────────

async function handleRename(interaction) {
    const name = interaction.options.getString('name');
    const channel = interaction.channel;

    const result = await renameTicket(interaction.guild, channel, interaction.user, name);
    if (result.error) {
        return interaction.reply({ content: '❌ ' + result.error, ephemeral: true });
    }

    await interaction.reply({
        content: '✅ Channel renamed to `' + name + '`.',
        ephemeral: true,
    });
}

module.exports = { executeTicket };
