const { parseDuration, formatDuration } = require('../helpers');
const { logError } = require('../logError');
const {
    createGiveaway, postGiveaway, endGiveaway, rerollGiveaway,
    cancelGiveaway, listGiveaways,
} = require('../giveaways');

// /giveaway start <prize> <duration> [winners]
async function cmdStart(interaction) {
    const prize = (interaction.options.getString('prize') || '').trim();
    if (!prize) return interaction.reply({ content: '⚠️ Giveaway prize cannot be empty.', ephemeral: true });

    const timeStr = interaction.options.getString('duration');
    const winners = Math.min(Math.max(interaction.options.getInteger('winners') || 1, 1), 20);
    const ms = parseDuration(timeStr);
    if (!ms) return interaction.reply({ content: '⚠️ Invalid duration! Use e.g. `1h`, `30m`, `2d` or `1h30m`.', ephemeral: true });
    if (ms < 15000) return interaction.reply({ content: '⚠️ Minimum giveaway duration is 15 seconds.', ephemeral: true });

    const g = createGiveaway({
        guildId: interaction.guild.id,
        channelId: interaction.channelId,
        prize,
        durationMs: ms,
        winners,
        hostId: interaction.user.id,
        hostTag: interaction.user.tag,
    });

    try {
        await postGiveaway(interaction.channel, g);
        return interaction.reply({
            content: '✅ Giveaway **' + prize + '** started! Ends in **' + formatDuration(ms) + '** with **' + winners + '** winner' + (winners > 1 ? 's' : '') + '. Giveaway ID: `' + g.id + '`',
            ephemeral: true,
        });
    } catch (err) {
        logError(err, 'giveaways', 'start:' + g.id);
        cancelGiveaway(g.id);
        return interaction.reply({ content: '❌ Failed to post the giveaway: ' + err.message, ephemeral: true });
    }
}

async function cmdEnd(interaction) {
    const id = (interaction.options.getString('id') || '').trim();
    if (!id) return interaction.reply({ content: '⚠️ Provide the giveaway ID.', ephemeral: true });
    try {
        const res = await endGiveaway(id);
        if (res.error) return interaction.reply({ content: '⚠️ ' + res.error, ephemeral: true });
        return interaction.reply({
            content: '✅ Giveaway ended.' + (res.winners.length ? ' Winners: ' + res.winners.map(w => '<@' + w + '>').join(', ') : ' No one entered.'),
            ephemeral: true,
        });
    } catch (err) {
        logError(err, 'giveaways', 'end:' + id);
        return interaction.reply({ content: '❌ Failed to end giveaway: ' + err.message, ephemeral: true });
    }
}

async function cmdReroll(interaction) {
    const id = (interaction.options.getString('id') || '').trim();
    if (!id) return interaction.reply({ content: '⚠️ Provide the giveaway ID.', ephemeral: true });
    try {
        const res = await rerollGiveaway(id);
        if (res.error) return interaction.reply({ content: '⚠️ ' + res.error, ephemeral: true });
        return interaction.reply({
            content: '✅ Rerolled!' + (res.winners.length ? ' New winners: ' + res.winners.map(w => '<@' + w + '>').join(', ') : ' Still no entrants.'),
            ephemeral: true,
        });
    } catch (err) {
        logError(err, 'giveaways', 'reroll:' + id);
        return interaction.reply({ content: '❌ Failed to reroll: ' + err.message, ephemeral: true });
    }
}

async function cmdCancel(interaction) {
    const id = (interaction.options.getString('id') || '').trim();
    if (!id) return interaction.reply({ content: '⚠️ Provide the giveaway ID.', ephemeral: true });
    const res = cancelGiveaway(id);
    if (res.error) return interaction.reply({ content: '⚠️ ' + res.error, ephemeral: true });
    return interaction.reply({ content: '🛑 Giveaway cancelled.', ephemeral: true });
}

async function cmdList(interaction) {
    const giveaways = listGiveaways(interaction.guild.id, 10);
    if (!giveaways.length) return interaction.reply({ content: 'ℹ️ No giveaways have been run in this server.', ephemeral: true });
    const lines = giveaways.map(g => {
        const status = g.status === 'active' ? '🟢 active' : (g.status === 'ended' ? '✅ ended' : '🛑 cancelled');
        return '`' + g.id + '` — **' + g.prize + '** (' + status + ', ends <t:' + Math.floor(g.ends_at / 1000) + ':R>)';
    });
    return interaction.reply({ content: '**🎉 Giveaways**\n' + lines.join('\n'), ephemeral: true });
}

async function executeGiveaway(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'start') return cmdStart(interaction);
    if (sub === 'end') return cmdEnd(interaction);
    if (sub === 'reroll') return cmdReroll(interaction);
    if (sub === 'cancel') return cmdCancel(interaction);
    if (sub === 'list') return cmdList(interaction);
    return interaction.reply({ content: 'Unknown giveaway subcommand.', ephemeral: true });
}

module.exports = { executeGiveaway };
