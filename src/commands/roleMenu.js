const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { createRoleMenu, getRoleMenus, addRoleMenuOption, getRoleMenuOptions, removeRoleMenuOption } = require('../roleMenus');

async function executeRoleMenu(interaction) {
    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild;

    if (sub === 'create') {
        const channel = interaction.options.getChannel('channel');
        const title = interaction.options.getString('title') || 'Self-Assignable Roles';

        if (!guild.members.me.permissions.has('ManageRoles')) {
            return interaction.reply({ content: '⚠️ I need the **Manage Roles** permission to manage role menus.', ephemeral: true });
        }

        // Create the embed first
        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('🌟 ' + title)
            .setDescription('Select the roles you want from the dropdown below!\n*(You can select multiple)*')
            .setFooter({ text: guild.name, iconURL: guild.iconURL() })
            .setTimestamp();

        // Send placeholder message, then owner adds roles via /rolemenu add
        const msg = await channel.send({ embeds: [embed] });
        createRoleMenu(guild.id, msg.id, channel.id, title);

        const confirmEmbed = new EmbedBuilder()
            .setColor('Green')
            .setTitle('✅ Role Menu Created')
            .setDescription('Role menu created in ' + channel.toString() + ' ([jump](' + msg.url + '))')
            .addFields(
                { name: 'Next Step', value: 'Use `/rolemenu add ' + msg.id + ' <role> <label>` to add roles.\nUse `/rolemenu publish ' + msg.id + '` when ready to show the dropdown.' }
            )
            .setFooter({ text: 'Role Menu ID: ' + msg.id })
            .setTimestamp();

        await interaction.reply({ embeds: [confirmEmbed], ephemeral: true });

    } else if (sub === 'add') {
        const messageId = interaction.options.getString('message_id');
        const role = interaction.options.getRole('role');
        const label = interaction.options.getString('label') || role.name;
        const emoji = interaction.options.getString('emoji') || null;

        if (role.managed) {
            return interaction.reply({ content: '⚠️ Cannot add managed/bot roles to a role menu.', ephemeral: true });
        }
        if (role.comparePositionTo(guild.members.me.roles.highest) >= 0) {
            return interaction.reply({ content: '⚠️ That role is higher than my highest role. I cannot assign it.', ephemeral: true });
        }

        addRoleMenuOption(messageId, role.id, label, emoji);

        const embed = new EmbedBuilder()
            .setColor('Green')
            .setTitle('✅ Role Added to Menu')
            .setDescription(emoji + ' **' + label + '** → ' + role.toString())
            .addFields({ name: 'Message ID', value: '`' + messageId + '`' })
            .setFooter({ text: 'Use /rolemenu publish ' + messageId + ' when ready' })
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });

    } else if (sub === 'remove') {
        const messageId = interaction.options.getString('message_id');
        const role = interaction.options.getRole('role');

        const removed = removeRoleMenuOption(messageId, role.id);
        if (!removed) {
            return interaction.reply({ content: '⚠️ That role is not in this menu.', ephemeral: true });
        }

        // Refresh the menu message if it exists
        const options = getRoleMenuOptions(messageId);
        if (options.length > 0) {
            try {
                const channel = interaction.client.channels.cache.get(interaction.channelId);
                const msg = await channel.messages.fetch(messageId).catch(() => null);
                if (msg) {
                    const newEmbed = EmbedBuilder.from(msg.embeds[0]);
                    const selectMenu = buildSelectMenu(messageId, options);
                    await msg.edit({ embeds: [newEmbed], components: options.length > 0 ? [new ActionRowBuilder().addComponents(selectMenu)] : [] });
                }
            } catch {}
        } else {
            // No roles left, remove the select menu
            try {
                const channel = interaction.client.channels.cache.get(interaction.channelId);
                const msg = await channel.messages.fetch(messageId).catch(() => null);
                if (msg) {
                    await msg.edit({ components: [] });
                }
            } catch {}
        }

        const embed = new EmbedBuilder()
            .setColor('Green')
            .setTitle('✅ Role Removed from Menu')
            .setDescription(role.toString() + ' removed from menu `' + messageId + '`')
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });

    } else if (sub === 'publish') {
        const messageId = interaction.options.getString('message_id');
        const options = getRoleMenuOptions(messageId);

        if (options.length === 0) {
            return interaction.reply({ content: '⚠️ This menu has no roles! Add some with `/rolemenu add ' + messageId + ' <role> <label>`.', ephemeral: true });
        }

        const selectMenu = buildSelectMenu(messageId, options);

        // Find and update the message
        const menus = getRoleMenus(guild.id);
        const menu = menus.find(m => m.message_id === messageId);
        if (!menu) {
            return interaction.reply({ content: '⚠️ Role menu not found.', ephemeral: true });
        }

        try {
            const channel = interaction.client.channels.cache.get(menu.channel_id);
            if (!channel) return interaction.reply({ content: '⚠️ Original channel not found.', ephemeral: true });
            const msg = await channel.messages.fetch(messageId).catch(() => null);
            if (!msg) return interaction.reply({ content: '⚠️ Original message not found. Was it deleted?', ephemeral: true });

            // Update embed to show available roles
            const embed = EmbedBuilder.from(msg.embeds[0]);
            const roleList = options.map(o => (o.emoji || '•') + ' **' + o.label + '** — <@&' + o.role_id + '>').join('\n');
            embed.addFields({ name: 'Available Roles', value: roleList });
            await msg.edit({ embeds: [embed], components: [new ActionRowBuilder().addComponents(selectMenu)] });

            await interaction.reply({ content: '✅ Role menu published and ready! ' + channel.toString(), ephemeral: true });
        } catch (err) {
            await interaction.reply({ content: '⚠️ Failed to update message: ' + err.message, ephemeral: true });
        }

    } else if (sub === 'list') {
        const menus = getRoleMenus(guild.id);
        if (menus.length === 0) {
            return interaction.reply({ content: '📋 No role menus in this server. Use `/rolemenu create` to make one.', ephemeral: true });
        }

        const lines = menus.map(m => {
            const options = getRoleMenuOptions(m.message_id);
            const roleList = options.map(o => (o.emoji || '•') + ' ' + o.label).join(', ') || '*No roles added yet*';
            return '`' + m.message_id + '` — ' + (m.title || 'Untitled') + ' (' + options.length + ' roles)\n└ ' + roleList;
        }).join('\n\n');

        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('📋 Role Menus')
            .setDescription(lines)
            .setFooter({ text: guild.name, iconURL: guild.iconURL() })
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
}

function buildSelectMenu(messageId, options) {
    return new StringSelectMenuBuilder()
        .setCustomId('rm_' + messageId)
        .setPlaceholder('Select roles to add/remove...')
        .setMinValues(0)
        .setMaxValues(options.length)
        .addOptions(options.map(o => ({
            label: o.label,
            value: o.role_id,
            description: o.description || undefined,
            emoji: o.emoji || undefined,
        })));
}

async function handleRoleMenuSelect(interaction) {
    const parts = interaction.customId.split('_');
    const messageId = parts[1];
    const selectedRoles = interaction.values;
    const member = interaction.member;

    if (!member) {
        return interaction.reply({ content: '❌ Could not find your member data.', ephemeral: true });
    }

    const options = getRoleMenuOptions(messageId);
    if (options.length === 0) {
        return interaction.reply({ content: '❌ This menu is no longer configured.', ephemeral: true });
    }

    const roleIds = new Set(options.map(o => o.role_id));
    const currentRoles = new Set(member.roles.cache.keys());
    let added = [];
    let removed = [];

    // Add selected roles if user doesn't have them
    for (const roleId of selectedRoles) {
        if (!currentRoles.has(roleId) && roleIds.has(roleId)) {
            try {
                await member.roles.add(roleId);
                added.push(roleId);
            } catch {}
        }
    }

    // Remove unselected roles that are in the menu
    for (const opt of options) {
        if (currentRoles.has(opt.role_id) && !selectedRoles.includes(opt.role_id)) {
            try {
                await member.roles.remove(opt.role_id);
                removed.push(opt.role_id);
            } catch {}
        }
    }

    const parts2 = [];
    if (added.length > 0) parts2.push('➕ Added: ' + added.map(id => '<@&' + id + '>').join(', '));
    if (removed.length > 0) parts2.push('➖ Removed: ' + removed.map(id => '<@&' + id + '>').join(', '));
    if (parts2.length === 0) parts2.push('✅ No changes needed — you already have those roles.');

    await interaction.reply({ content: parts2.join('\n'), ephemeral: true });
}

module.exports = {
    executeRoleMenu,
    handleRoleMenuSelect,
};
