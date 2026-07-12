const { EmbedBuilder } = require('discord.js');
const { grantPermission, revokePermission, getAllPermissions, getGrantedUsers } = require('../permissions');
const { isOwner } = require('../helpers');

async function executePerm(interaction) {
    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild;

    if (sub === 'grant') {
        const user = interaction.options.getUser('user');
        const command = interaction.options.getString('command');

        // Can't grant owner-only commands
        const ownerOnly = ['deploy', 'botavatar', 'botname', 'presence', 'embedconfig', 'shutdown', 'perm'];
        if (ownerOnly.includes(command)) {
            return interaction.reply({ content: '\u26A0\uFE0F That command is owner-only and cannot be granted to others.', ephemeral: true });
        }

        // Can't grant to the owner
        if (isOwner(user.id)) {
            return interaction.reply({ content: '\u26A0\uFE0F The bot owner already has access to all commands.', ephemeral: true });
        }

        grantPermission(guild.id, command, user.id);

        const embed = new EmbedBuilder()
            .setColor('Green')
            .setTitle('\uD83D\uDD11 Permission Granted')
            .setDescription(user + ' can now use `/' + command + '`')
            .setFooter({ text: 'Granted by ' + interaction.user.tag })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    } else if (sub === 'revoke') {
        const user = interaction.options.getUser('user');
        const command = interaction.options.getString('command');

        revokePermission(guild.id, command, user.id);

        const embed = new EmbedBuilder()
            .setColor('Red')
            .setTitle('\uD83D\uDD11 Permission Revoked')
            .setDescription(user + ' can no longer use `/' + command + '`')
            .setFooter({ text: 'Revoked by ' + interaction.user.tag })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    } else if (sub === 'list') {
        const allPerms = getAllPermissions(guild.id);
        const entries = Object.entries(allPerms);

        if (entries.length === 0) {
            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle('\uD83D\uDD11 Granted Permissions')
                .setDescription('No special permissions have been granted. Only the owner can use admin commands.')
                .setFooter({ text: guild.name, iconURL: guild.iconURL() })
                .setTimestamp();

            return interaction.reply({ embeds: [embed] });
        }

        const fields = entries.map(([cmd, userIds]) => ({
            name: '/' + cmd,
            value: userIds.map(id => '<@' + id + '>').join('\n') || '*None*',
            inline: true,
        }));

        // Split into multiple embeds if too many fields
        const chunks = [];
        for (let i = 0; i < fields.length; i += 6) {
            chunks.push(fields.slice(i, i + 6));
        }

        const embeds = chunks.map((chunk, i) => new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('\uD83D\uDD11 Granted Permissions' + (chunks.length > 1 ? ' (' + (i + 1) + '/' + chunks.length + ')' : ''))
            .setDescription('Users who have been granted access to specific commands:')
            .addFields(chunk)
            .setFooter({ text: guild.name, iconURL: guild.iconURL() })
            .setTimestamp());

        await interaction.reply({ embeds });
    } else if (sub === 'user') {
        const user = interaction.options.getUser('user');
        const allPerms = getAllPermissions(guild.id);

        const granted = Object.entries(allPerms)
            .filter(([, userIds]) => userIds.includes(user.id))
            .map(([cmd]) => '/' + cmd);

        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('\uD83D\uDD11 Permissions for ' + user.tag)
            .setDescription(granted.length > 0
                ? user + ' has access to:\n' + granted.join('\n')
                : user + ' has no special permissions.')
            .setFooter({ text: guild.name, iconURL: guild.iconURL() })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
}

module.exports = { executePerm };
