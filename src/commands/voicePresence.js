// ──────────────────── /vc ────────────────────
// Voice presence — the bot joins a voice channel and stays there with a
// "Listening to …" activity (24/7, survives restarts via the DB).
const { PermissionFlagsBits } = require('discord.js');
const {
    isVoiceChannel,
    getPresence,
    joinChannel,
    moveChannel,
    leaveChannel,
    setStatusText,
} = require('../voicePresence');

async function executeVoicePresence(interaction) {
    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild;
    const member = interaction.member;
    const me = guild.members.me;

    if (sub === 'join') {
        let channel = interaction.options.getChannel('channel');
        if (!channel) {
            channel = member.voice && member.voice.channel ? member.voice.channel : null;
            if (!channel) {
                return interaction.reply({
                    content: '❌ You\'re not in a voice channel. Join one first, or pass one: `/vc join #channel`',
                    ephemeral: true,
                });
            }
        }
        if (!isVoiceChannel(channel)) {
            return interaction.reply({ content: '❌ That\'s not a voice channel.', ephemeral: true });
        }
        if (channel.guildId !== guild.id) {
            return interaction.reply({ content: '❌ That channel is not in this server.', ephemeral: true });
        }
        const perms = channel.permissionsFor(me);
        if (!perms || !perms.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect])) {
            return interaction.reply({
                content: '❌ The bot can\'t join <#' + channel.id + '> — missing **View Channel** or **Connect** permission.',
                ephemeral: true,
            });
        }

        try {
            await joinChannel(guild, channel, null);
        } catch (err) {
            return handleJoinError(interaction, err, channel);
        }
        return interaction.reply({
            content: '🎧 Joined **' + channel.name + '** and I\'m staying. Use `/vc status <text>` to flex a custom "Listening to" line.',
        });
    }

    if (sub === 'move') {
        const channel = interaction.options.getChannel('channel');
        if (!isVoiceChannel(channel) || channel.guildId !== guild.id) {
            return interaction.reply({ content: '❌ Pick a voice channel in this server.', ephemeral: true });
        }
        const perms = channel.permissionsFor(me);
        if (!perms || !perms.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect])) {
            return interaction.reply({
                content: '❌ The bot can\'t join <#' + channel.id + '> — missing **View Channel** or **Connect** permission.',
                ephemeral: true,
            });
        }
        try {
            await moveChannel(guild, channel);
        } catch (err) {
            if (err.code === 'NOT_IN_VC') {
                return interaction.reply({ content: '❌ ' + err.message, ephemeral: true });
            }
            if (err.code === 'ALREADY_THERE') {
                return interaction.reply({ content: '🎧 ' + err.message + '.', ephemeral: true });
            }
            return interaction.reply({ content: '❌ Failed to move: ' + (err.message || err), ephemeral: true });
        }
        return interaction.reply({ content: '🎧 Moved to **' + channel.name + '**.', ephemeral: true });
    }

    if (sub === 'leave') {
        await leaveChannel(guild);
        return interaction.reply({ content: '👋 Left the voice channel. The aura has been stored for later.', ephemeral: true });
    }

    // status
    const text = interaction.options.getString('text');
    try {
        const clean = await setStatusText(guild, text || '');
        if (clean === null) {
            return interaction.reply({ content: '🎧 Status reset — back to "Listening to <channel name>".', ephemeral: true });
        }
        return interaction.reply({ content: '🎧 Now "Listening to **' + clean + '**".', ephemeral: true });
    } catch (err) {
        if (err.code === 'NOT_IN_VC') {
            return interaction.reply({ content: '❌ ' + err.message, ephemeral: true });
        }
        return interaction.reply({ content: '❌ Failed to set status: ' + (err.message || err), ephemeral: true });
    }
}

function handleJoinError(interaction, err, channel) {
    if (err.code === 'ALREADY_THERE') {
        return interaction.reply({ content: '🎧 I\'m already in **' + channel.name + '**.', ephemeral: true });
    }
    if (err.code === 'NOT_VOICE') {
        return interaction.reply({ content: '❌ That\'s not a voice channel.', ephemeral: true });
    }
    const msg = String(err.message || err);
    if (msg.includes('Missing Permissions') || msg.includes('Missing Access')) {
        return interaction.reply({
            content: '❌ The bot can\'t join <#' + channel.id + '> — check **View Channel** / **Connect** permissions and that the channel isn\'t full.',
            ephemeral: true,
        });
    }
    return interaction.reply({ content: '❌ Failed to join: ' + msg, ephemeral: true });
}

module.exports = { executeVoicePresence };
