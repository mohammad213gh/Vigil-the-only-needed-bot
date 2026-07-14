const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { truncate } = require('../helpers');
const { getGuildConfig, updateGuildConfig } = require('../config');
const { deployCommands } = require('../deploy');

async function executeRole(interaction) {
    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild;
    const client = interaction.client;

    if (sub === 'add') {
        const target = interaction.options.getUser('user');
        const role = interaction.options.getRole('role');
        const member = await guild.members.fetch(target.id).catch(() => null);
        if (!member) {
            return interaction.reply({ content: '\u26A0\uFE0F Could not find that user in this server.', ephemeral: true });
        }

        if (!guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) {
            return interaction.reply({ content: '\u26A0\uFE0F I need the **Manage Roles** permission to do that.', ephemeral: true });
        }
        if (role.managed || role.id === guild.id) {
            return interaction.reply({ content: '\u26A0\uFE0F I cannot manage that role (it may be managed by an integration or be @everyone).', ephemeral: true });
        }
        if (guild.members.me.roles.highest.position <= role.position) {
            return interaction.reply({ content: '\u26A0\uFE0F That role is higher than or equal to my highest role. I cannot assign it.', ephemeral: true });
        }
        if (member.roles.cache.has(role.id)) {
            return interaction.reply({ content: '\u26A0\uFE0F ' + target + ' already has that role.', ephemeral: true });
        }

        await member.roles.add(role);
        const embed = new EmbedBuilder()
            .setColor('Green')
            .setTitle('\uD83C\uDFF7\uFE0F Role Added')
            .setDescription('Added **' + role.name + '** to ' + target)
            .setFooter({ text: 'By ' + interaction.user.tag })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    } else if (sub === 'remove') {
        const target = interaction.options.getUser('user');
        const role = interaction.options.getRole('role');
        const member = await guild.members.fetch(target.id).catch(() => null);
        if (!member) {
            return interaction.reply({ content: '\u26A0\uFE0F Could not find that user in this server.', ephemeral: true });
        }

        if (!guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) {
            return interaction.reply({ content: '\u26A0\uFE0F I need the **Manage Roles** permission to do that.', ephemeral: true });
        }
        if (role.managed || role.id === guild.id) {
            return interaction.reply({ content: '\u26A0\uFE0F I cannot manage that role.', ephemeral: true });
        }
        if (guild.members.me.roles.highest.position <= role.position) {
            return interaction.reply({ content: '\u26A0\uFE0F That role is higher than or equal to my highest role. I cannot remove it.', ephemeral: true });
        }
        if (!member.roles.cache.has(role.id)) {
            return interaction.reply({ content: '\u26A0\uFE0F ' + target + ' does not have that role.', ephemeral: true });
        }

        await member.roles.remove(role);
        const embed = new EmbedBuilder()
            .setColor('Red')
            .setTitle('\uD83C\uDFF7\uFE0F Role Removed')
            .setDescription('Removed **' + role.name + '** from ' + target)
            .setFooter({ text: 'By ' + interaction.user.tag })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    } else if (sub === 'list') {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const member = await guild.members.fetch(targetUser.id).catch(() => null);
        if (!member) {
            return interaction.reply({ content: '\u26A0\uFE0F Could not find that user in this server.', ephemeral: true });
        }

        const roles = member.roles.cache
            .filter(r => r.id !== guild.id)
            .sort((a, b) => b.position - a.position)
            .map(r => r.toString());

        const embed = new EmbedBuilder()
            .setColor(member.displayHexColor || 0x5865F2)
            .setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() })
            .setTitle('\uD83C\uDFF7\uFE0F ' + member.displayName + '\'s Roles')
            .setDescription(roles.length > 0 ? roles.join('\n') : '*No roles*')
            .setFooter({ text: 'Total: ' + roles.length + ' role(s)' })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
}

async function executePurge(interaction) {
    const amount = interaction.options.getInteger('amount');
    const guild = interaction.guild;

    if (!guild.members.me.permissions.has(PermissionFlagsBits.ManageMessages)) {
        return interaction.reply({ content: '\u26A0\uFE0F I need the **Manage Messages** permission to purge messages.', ephemeral: true });
    }
    if (!interaction.channel.isTextBased?.()) {
        return interaction.reply({ content: '\u26A0\uFE0F This command can only be used in text channels.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
        const fetched = await interaction.channel.bulkDelete(amount, true);
        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('\uD83E\uDDF9 Messages Purged')
            .setDescription('Deleted **' + fetched.size + '** message(s) in ' + interaction.channel)
            .setFooter({ text: 'By ' + interaction.user.tag })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    } catch (err) {
        await interaction.editReply({ content: '\u26A0\uFE0F Failed to purge messages: ' + err.message });
    }
}

async function executeSlowmode(interaction) {
    const seconds = interaction.options.getInteger('seconds');
    const channel = interaction.options.getChannel('channel') || interaction.channel;
    const guild = interaction.guild;

    if (!guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) {
        return interaction.reply({ content: '\u26A0\uFE0F I need the **Manage Channels** permission to change slowmode.', ephemeral: true });
    }

    try {
        await channel.setRateLimitPerUser(seconds);
        const embed = new EmbedBuilder()
            .setColor(seconds > 0 ? 0xF1C40F : 'Green')
            .setTitle('\u23F3 Slowmode Updated')
            .setDescription('Slowmode in ' + channel + ' set to **' + seconds + '** second' + (seconds !== 1 ? 's' : ''))
            .setFooter({ text: 'By ' + interaction.user.tag })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    } catch (err) {
        await interaction.reply({ content: '\u26A0\uFE0F Failed to set slowmode: ' + err.message, ephemeral: true }).catch(err => console.error('[ReplyFallback]', err.message));
    }
}

async function executeNickname(interaction) {
    const target = interaction.options.getUser('user');
    const nickname = interaction.options.getString('nickname');
    const guild = interaction.guild;
    const member = await guild.members.fetch(target.id).catch(() => null);
    if (!member) {
        return interaction.reply({ content: '\u26A0\uFE0F Could not find that user in this server.', ephemeral: true });
    }

    if (!guild.members.me.permissions.has(PermissionFlagsBits.ManageNicknames)) {
        return interaction.reply({ content: '\u26A0\uFE0F I need the **Manage Nicknames** permission to change nicknames.', ephemeral: true });
    }
    if (guild.members.me.roles.highest.position <= member.roles.highest.position && guild.ownerId !== interaction.client.user.id) {
        return interaction.reply({ content: '\u26A0\uFE0F That user has a higher role than me. I cannot change their nickname.', ephemeral: true });
    }

    try {
        const newNick = nickname.toLowerCase() === 'reset' ? null : nickname;
        await member.setNickname(newNick);
        const embed = new EmbedBuilder()
            .setColor('Green')
            .setTitle('\uD83D\uDCDD Nickname Changed')
            .setDescription(target + '\'s nickname is now **' + (newNick || '*none*') + '**')
            .setFooter({ text: 'By ' + interaction.user.tag })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    } catch (err) {
        await interaction.reply({ content: '\u26A0\uFE0F Failed to change nickname: ' + err.message, ephemeral: true }).catch(() => {});
    }
}

async function executeSay(interaction) {
    const channel = interaction.options.getChannel('channel');
    const message = interaction.options.getString('message');

    if (!channel.isTextBased?.()) {
        return interaction.reply({ content: '\u26A0\uFE0F Please select a text channel.', ephemeral: true });
    }

    try {
        await channel.send(message);
        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('\uD83D\uDCAC Message Sent')
            .setDescription('Message sent to ' + channel)
            .addFields({ name: 'Content', value: truncate(message, 1024) })
            .setFooter({ text: 'By ' + interaction.user.tag })
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (err) {
        await interaction.reply({ content: '\u26A0\uFE0F Failed to send message: ' + err.message, ephemeral: true }).catch(() => {});
    }
}

async function executeEmbed(interaction) {
    const channel = interaction.options.getChannel('channel');
    const title = interaction.options.getString('title');
    const description = interaction.options.getString('description') || '';
    const colorStr = interaction.options.getString('color') || '#5865F2';

    if (!channel.isTextBased?.()) {
        return interaction.reply({ content: '\u26A0\uFE0F Please select a text channel.', ephemeral: true });
    }

    let color = 0x5865F2;
    try {
        color = parseInt(colorStr.replace('#', ''), 16);
    } catch { /* use default */ }

    try {
        const embed = new EmbedBuilder()
            .setColor(color)
            .setTitle(title)
            .setDescription(description)
            .setFooter({ text: 'Sent by ' + interaction.user.tag })
            .setTimestamp();

        await channel.send({ embeds: [embed] });
        await interaction.reply({
            content: '\u2705 Embed sent to ' + channel,
            ephemeral: true,
        }).catch(err => console.error('[ReplyFallback]', err.message));
    } catch (err) {
        await interaction.reply({ content: '\u26A0\uFE0F Failed to send embed: ' + err.message, ephemeral: true }).catch(err => console.error('[ReplyFallback]', err.message));
    }
}

async function executeDeploy(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const success = await deployCommands(interaction.client.user);
    if (success) {
        await interaction.editReply({ content: '\u2705 Slash commands re-registered successfully!' });
    } else {
        await interaction.editReply({ content: '\u26A0\uFE0F Failed to re-register commands. Check the console for details.' });
    }
}

async function executeTrack(interaction) {
    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild;

    if (sub === 'add') {
        const channel = interaction.options.getChannel('channel');
        
        const existing = getGuildConfig(guild.id);
        if (existing.trackedChannels.includes(channel.id)) {
            return interaction.reply({ content: '\u26A0\uFE0F That channel is already being tracked.', ephemeral: true });
        }
        
        updateGuildConfig(guild.id, (guildConfig) => {
            guildConfig.trackedChannels.push(channel.id);
            return guildConfig;
        });

        const embed = new EmbedBuilder()
            .setColor('Green')
            .setTitle('\uD83D\uDCE1 Channel Added')
            .setDescription(channel + ' is now being tracked.')
            .setFooter({ text: 'Added by ' + interaction.user.tag })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    } else if (sub === 'remove') {
        const channel = interaction.options.getChannel('channel');
        
        updateGuildConfig(guild.id, (guildConfig) => {
            const idx = guildConfig.trackedChannels.indexOf(channel.id);
            if (idx === -1) {
                return guildConfig; // No change needed
            }
            guildConfig.trackedChannels.splice(idx, 1);
            return guildConfig;
        });

        const embed = new EmbedBuilder()
            .setColor('Red')
            .setTitle('\uD83D\uDCE1 Channel Removed')
            .setDescription(channel + ' is no longer being tracked.')
            .setFooter({ text: 'Removed by ' + interaction.user.tag })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    } else if (sub === 'list') {
        const guildConfig = getGuildConfig(guild.id);
        if (guildConfig.trackedChannels.length === 0) {
            return interaction.reply({ content: '\uD83D\uDCE1 Currently tracking **all channels**. Use `/track add` to restrict to specific channels.', ephemeral: false });
        }
        const list = guildConfig.trackedChannels.map(id => '<#' + id + '>').join('\n');
        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('\uD83D\uDCE1 Tracked Channels (' + guildConfig.trackedChannels.length + ')')
            .setDescription(list)
            .setFooter({ text: guild.name, iconURL: guild.iconURL() })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
}

async function executePoll(interaction) {
    const question = interaction.options.getString('question');
    const option1 = interaction.options.getString('option1');
    const option2 = interaction.options.getString('option2');
    const option3 = interaction.options.getString('option3');
    const option4 = interaction.options.getString('option4');

    const options = [option1, option2];
    if (option3) options.push(option3);
    if (option4) options.push(option4);

    const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
    const fields = options.map((opt, i) => ({
        name: emojis[i] + ' ' + opt,
        value: 'Vote with ' + emojis[i],
        inline: true,
    }));

    const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('\uD83D\uDDF3\uFE0F Poll: ' + question)
        .addFields(fields)
        .setFooter({ text: 'Poll by ' + interaction.user.tag })
        .setTimestamp();

    const pollMessage = await interaction.reply({ embeds: [embed], fetchReply: true });

    for (let i = 0; i < options.length; i++) {
        await pollMessage.react(emojis[i]).catch(err => console.error('[PollReaction]', err.message));
    }
}

async function executeAnnounce(interaction) {
    const channel = interaction.options.getChannel('channel');
    const title = interaction.options.getString('title');
    const message = interaction.options.getString('message');
    const colorStr = interaction.options.getString('color') || '#5865F2';
    const ping = interaction.options.getBoolean('ping') || false;

    if (!channel.isTextBased?.()) {
        return interaction.reply({ content: '\u26A0\uFE0F Please select a text channel.', ephemeral: true });
    }

    let color = 0x5865F2;
    try {
        color = parseInt(colorStr.replace('#', ''), 16);
    } catch { /* use default */ }

    const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(title)
        .setDescription(message)
        .setAuthor({ name: interaction.guild.name, iconURL: interaction.guild.iconURL() })
        .setFooter({ text: 'Announcement by ' + interaction.user.tag })
        .setTimestamp();

    const content = ping ? '@everyone' : '';

    try {
        await channel.send({ content, embeds: [embed] });
        await interaction.reply({ content: '\u2705 Announcement sent to ' + channel, ephemeral: true }).catch(err => console.error('[ReplyFallback]', err.message));
    } catch (err) {
        await interaction.reply({ content: '\u26A0\uFE0F Failed to send announcement: ' + err.message, ephemeral: true }).catch(err => console.error('[ReplyFallback]', err.message));
    }
}

module.exports = {
    executeRole,
    executePurge,
    executeSlowmode,
    executeNickname,
    executeSay,
    executeEmbed,
    executeDeploy,
    executeTrack,
    executePoll,
    executeAnnounce,
};
