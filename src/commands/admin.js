const { EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { truncate } = require('../helpers');
const { getGuildConfig, updateGuildConfig } = require('../config');
const { deployCommands } = require('../deploy');

async function executeRole(interaction) {
    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild;

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

    // Show confirmation buttons
    const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('\u2753 Confirm Purge')
        .setDescription('Are you sure you want to delete **' + amount + '** messages in ' + interaction.channel + '?')
        .setFooter({ text: 'By ' + interaction.user.tag })
        .setTimestamp();

    const confirm = new ButtonBuilder()
        .setCustomId('cp_' + interaction.user.id + '_' + amount)
        .setLabel('Confirm Purge')
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
        await interaction.reply({ content: '\u26A0\uFE0F Failed to set slowmode: ' + err.message, ephemeral: true })                .catch(() => {});
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
        })                .catch(() => {});
            } catch (err) {
        await interaction.reply({ content: '\u26A0\uFE0F Failed to send embed: ' + err.message, ephemeral: true })                .catch(() => {});
            }
}

async function executeDeploy(interaction) {
    await interaction.deferReply({ ephemeral: true });
    try {
        const result = await deployCommands(interaction.client.user);
        if (result === true) {
            await interaction.editReply({ content: '\u2705 Slash commands re-registered successfully!' });
        } else {
            await interaction.editReply({ content: '\u274C **Deploy failed:** ' + (result || 'Unknown error. Check Railway logs for details.') });
        }
    } catch (err) {
        await interaction.editReply({ content: '\u274C **Deploy error:** ' + (err.message || 'Unknown error') });
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

        await interaction.reply({ embeds: [embed], ephemeral: true });
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

        await interaction.reply({ embeds: [embed], ephemeral: true });
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

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
}

async function executePoll(interaction) {
    const question = interaction.options.getString('question');
    const option1 = interaction.options.getString('option1');
    const option2 = interaction.options.getString('option2');
    const option3 = interaction.options.getString('option3');
    const option4 = interaction.options.getString('option4');
    const multi = interaction.options.getBoolean('multi') || false;
    const anonymous = interaction.options.getBoolean('anonymous') || false;
    const duration = interaction.options.getString('duration') || null;

    const options = [option1, option2];
    if (option3) options.push(option3);
    if (option4) options.push(option4);

    const emojis = ['1\uFE0F\u20E3', '2\uFE0F\u20E3', '3\uFE0F\u20E3', '4\uFE0F\u20E3'];
    
    // ── Calculate end time ──
    let endTimestamp = null;
    let durationLabel = '';
    if (duration) {
        const durationMap = { '5m': 300, '15m': 900, '30m': 1800, '1h': 3600, '6h': 21600, '24h': 86400, '3d': 259200, '7d': 604800 };
        const seconds = durationMap[duration] || 0;
        if (seconds > 0) {
            endTimestamp = Math.floor(Date.now() / 1000) + seconds;
            durationLabel = 'Ends <t:' + endTimestamp + ':R>';
        }
    }

    // ── Pick embed color based on poll type ──
    // Like logs: blue default, multi=purple, anonymous=dark, timed=orange
    let embedColor = 0x5865F2;
    if (anonymous) embedColor = 0x2C2F33;
    else if (multi && durationLabel) embedColor = 0x9B59B6;
    else if (multi) embedColor = 0x71368A;
    else if (durationLabel) embedColor = 0xE67E22;

    // ── Build mode badges ──
    let badges = [];
    if (multi) badges.push('\uD83D\uDD01 Multi-vote');
    if (anonymous) badges.push('\uD83D\uDD75\uFE0F Anonymous');
    if (durationLabel) badges.push('\u23F3 ' + durationLabel);
    const badgeStr = badges.length > 0 ? badges.join('  ') : null;

    // ── Build embed (log-style — clean fields, no progress bars) ──
    const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
        .setTitle('\uD83D\uDDF3\uFE0F  ' + question)
        .setThumbnail(interaction.user.displayAvatarURL({ size: 64 }))
        .setDescription(badgeStr ? '── ' + badgeStr + ' ──' : null)
        .setTimestamp();

    // Add each option as a clean field (like log embeds: Name / Value pairs)
    for (let i = 0; i < options.length; i++) {
        embed.addFields({
            name: emojis[i] + '  ' + options[i],
            value: '\uD83D\uDCCA Votes: **0** (0%)',
            inline: options.length <= 2 ? true : false,
        });
    }

    embed.setFooter({ text: '\uD83D\uDDF3  Click a button below to vote!' + (anonymous ? '  \u2022  \uD83D\uDD75\uFE0F Anonymous' : '') });

    // ── Build vote buttons with actual option text ──
    const votePrefix = multi ? 'pm_vote_' : (anonymous ? 'pa_vote_' : 'pv_vote_');
    const buttons = options.map((opt, i) => {
        const label = opt.length > 50 ? opt.substring(0, 47) + '...' : opt;
        return new ButtonBuilder()
            .setCustomId(votePrefix + i)
            .setStyle(i === 0 ? ButtonStyle.Primary : i === 1 ? ButtonStyle.Success : i === 2 ? ButtonStyle.Primary : ButtonStyle.Danger)
            .setLabel(label)
            .setEmoji(emojis[i]);
    });

    const rows = [];
    for (let i = 0; i < buttons.length; i += 2) {
        rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 2)));
    }

    // Add Show Voters button (not for anonymous polls)
    if (!anonymous) {
        const votersBtn = new ButtonBuilder()
            .setCustomId('pvv_voters')
            .setLabel('Show Voters \uD83D\uDC65')
            .setStyle(ButtonStyle.Secondary);
        rows.push(new ActionRowBuilder().addComponents(votersBtn));
    }

    // ── Send the poll ──
    const reply = await interaction.reply({ embeds: [embed], components: rows, fetchReply: true });
    const messageId = reply.id;

    // ── Schedule auto-end if duration set ──
    if (endTimestamp) {
        const ms = (endTimestamp - Math.floor(Date.now() / 1000)) * 1000;
        setTimeout(async () => {
            try {
                const channel = interaction.channel;
                const msg = await channel.messages.fetch(messageId).catch(() => null);
                if (!msg) return;
                
                // Calculate final results
                const { getDb } = require('../db');
                const db = getDb();
                const rows = db.prepare('SELECT user_id, option_index FROM poll_votes WHERE message_id = ?').all(messageId);
                const voteCounts = {};
                const voters = {};
                for (const r of rows) {
                    voteCounts[r.option_index] = (voteCounts[r.option_index] || 0) + 1;
                    if (!voters[r.option_index]) voters[r.option_index] = [];
                    voters[r.option_index].push(r.user_id);
                }
                const totalVotes = Object.values(voteCounts).reduce((a, c) => a + c, 0);
                
                // Find winner(s)
                let maxVotes = 0;
                const winners = [];
                for (const k in voteCounts) {
                    if (Object.prototype.hasOwnProperty.call(voteCounts, k)) {
                        if (voteCounts[k] > maxVotes) {
                            maxVotes = voteCounts[k];
                            winners.length = 0;
                            winners.push(parseInt(k));
                        } else if (voteCounts[k] === maxVotes && maxVotes > 0) {
                            winners.push(parseInt(k));
                        }
                    }
                }
                
                const totalVoters = Object.keys(voters).length || totalVotes;
                
                const finalEmbed = EmbedBuilder.from(msg.embeds[0])
                    .setColor(0x95A5A6)
                    .setTitle('\uD83D\uDDF3\uFE0F  Poll Ended: ' + question)
                    .setDescription('\uD83D\uDD14 **Poll has ended!**' + (winners.length > 0 ? '\n\uD83C\uDFC6 **Winner:** ' + winners.map(w => '**' + options[w] + '**').join(', ') : ''));
                
                // Rebuild fields with final results
                finalEmbed.spliceFields(0, embed.data.fields?.length || 0);
                for (let i = 0; i < options.length; i++) {
                    const count = voteCounts[i] || 0;
                    const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                    const isWinner = winners.includes(i);
                    finalEmbed.addFields({
                        name: emojis[i] + '  ' + options[i] + (isWinner ? '  \uD83C\uDFC6' : ''),
                        value: '\uD83D\uDCCA Votes: **' + count + '** (' + pct + '%)',
                        inline: options.length <= 2,
                    });
                }
                
                finalEmbed.setFooter({ text: '\uD83D\uDDF3  ' + totalVotes + ' total votes  \u2022  ' + totalVoters + ' voter' + (totalVoters !== 1 ? 's' : '') + '  \u2022  Poll ended' });
                await msg.edit({ embeds: [finalEmbed], components: [] });
            } catch (err) {
                const { logError } = require('../logError');
                logError(err, 'commands', 'admin/poll_end');
            }
        }, ms);
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
        await interaction.reply({ content: '\u2705 Announcement sent to ' + channel, ephemeral: true })                .catch(() => {});
            } catch (err) {
        await interaction.reply({ content: '\u26A0\uFE0F Failed to send announcement: ' + err.message, ephemeral: true })                .catch(() => {});
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
