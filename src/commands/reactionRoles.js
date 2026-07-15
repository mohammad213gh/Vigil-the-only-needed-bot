const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getReactionRoles, addReactionRole, removeReactionRole, removeAllForMessage } = require('../reactionRoles');
// Normalize emoji string: convert Discord's <:name:id> or <a:name:id> to name:id
function normalizeEmoji(str) {
    const m = str.match(/<a?:(\w+):(\d+)>/);
    return m ? m[1] + ':' + m[2] : str;
}

async function executeReactionRole(interaction) {
    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild;

    if (sub === 'add') {
        const channel = interaction.options.getChannel('channel');
        const role = interaction.options.getRole('role');
        const emojiRaw = interaction.options.getString('emoji');
        const label = interaction.options.getString('label');
        const description = interaction.options.getString('description');

        if (!guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) {
            return interaction.reply({ content: '\u26A0\uFE0F I need the **Manage Roles** permission to manage reaction roles.', ephemeral: true });
        }
        if (!channel.isTextBased?.()) {
            return interaction.reply({ content: '\u26A0\uFE0F Please select a text channel.', ephemeral: true });
        }
        if (role.managed || role.id === guild.id) {
            return interaction.reply({ content: '\u26A0\uFE0F I cannot manage that role.', ephemeral: true });
        }
        if (guild.members.me.roles.highest.position <= role.position) {
            return interaction.reply({ content: '\u26A0\uFE0F That role is higher than my highest role.', ephemeral: true });
        }

        await interaction.deferReply();

        // Build the embed message
        const embed = new EmbedBuilder()
            .setColor(role.hexColor || 0x5865F2)
            .setTitle('\uD83C\uDFF7\uFE0F Reaction Role' + (label ? ': ' + label : ''))
            .setDescription(description || 'React with ' + emojiRaw + ' to get the **' + role.name + '** role!')
            .addFields(
                { name: 'Role', value: role.toString(), inline: true },
                { name: 'Reaction', value: emojiRaw, inline: true },
            )
            .setFooter({ text: guild.name, iconURL: guild.iconURL() })
            .setTimestamp();

        try {
            const roleMessage = await channel.send({ embeds: [embed] });
            await roleMessage.react(emojiRaw);

            addReactionRole(guild.id, roleMessage.id, channel.id, normalizeEmoji(emojiRaw), role.id, label);

            const successEmbed = new EmbedBuilder()
                .setColor('Green')
                .setTitle('\u2705 Reaction Role Created')
                .setDescription('Reaction role set up in ' + channel + '\n' + roleMessage.url)
                .addFields(
                    { name: 'Role', value: role.toString(), inline: true },
                    { name: 'Emoji', value: emojiRaw, inline: true },
                )
                .setFooter({ text: 'By ' + interaction.user.tag })
                .setTimestamp();

            await interaction.editReply({ embeds: [successEmbed] });
        } catch (err) {
            await interaction.editReply({ content: '\u26A0\uFE0F Failed to create reaction role: ' + err.message });
        }
    } else if (sub === 'remove') {
        const messageId = interaction.options.getString('message_id');

        const count = removeAllForMessage(guild.id, messageId);

        if (count === 0) {
            return interaction.reply({ content: '\u26A0\uFE0F No reaction roles found for that message ID.', ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setColor('Red')
            .setTitle('\uD83D\uDDD1\uFE0F Reaction Roles Removed')
            .setDescription('Removed **' + count + '** reaction role(s) for message `' + messageId + '`')
            .setFooter({ text: 'By ' + interaction.user.tag })
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
    } else if (sub === 'list') {
        const roles = getReactionRoles(guild.id);

        if (roles.length === 0) {
            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle('\uD83C\uDFF7\uFE0F Reaction Roles')
                .setDescription('No reaction roles configured. Use `/reactionrole add` to create one.')
                .setFooter({ text: guild.name, iconURL: guild.iconURL() })
                .setTimestamp();

            return interaction.reply({ embeds: [embed] });
        }

        // Group by message
        const grouped = {};
        for (const rr of roles) {
            if (!grouped[rr.messageId]) {
                grouped[rr.messageId] = { channelId: rr.channelId, roles: [] };
            }
            grouped[rr.messageId].roles.push(rr);
        }

        const fields = Object.entries(grouped).map(([msgId, data]) => ({
            name: 'Message: ' + msgId,
            value: data.roles.map(r => r.emoji + ' → <@&' + r.roleId + '>' + (r.label ? ' (' + r.label + ')' : '')).join('\n')
                + '\n[Jump](https://discord.com/channels/' + guild.id + '/' + data.channelId + '/' + msgId + ')',
            inline: false,
        }));

        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('\uD83C\uDFF7\uFE0F Reaction Roles (' + roles.length + ' total)')
            .setDescription('Self-assignable roles via reactions:')
            .addFields(fields)
            .setFooter({ text: guild.name, iconURL: guild.iconURL() })
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
}

module.exports = { executeReactionRole };
