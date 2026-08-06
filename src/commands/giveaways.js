const { parseDuration, formatDuration } = require('../helpers');
const { logError } = require('../logError');
const {
    createGiveaway, postGiveaway, endGiveaway, rerollGiveaway,
    cancelGiveaway, listGiveaways, getGiveawayByMessageRef, parseHexColor,
} = require('../giveaways');

// /giveaway start <prize> <duration> [winners] [description] [role] [banrole] [color] [image]
async function cmdStart(interaction) {
    const prize = (interaction.options.getString('prize') || '').trim();
    if (!prize) return interaction.reply({ content: '⚠️ Giveaway prize cannot be empty.', ephemeral: true });

    const timeStr = interaction.options.getString('duration');
    const winners = Math.min(Math.max(interaction.options.getInteger('winners') || 1, 1), 20);
    const ms = parseDuration(timeStr);
    if (!ms) return interaction.reply({ content: '⚠️ Invalid duration! Use e.g. `1h`, `30m`, `2d` or `1h30m`.', ephemeral: true });
    if (ms < 15000) return interaction.reply({ content: '⚠️ Minimum giveaway duration is 15 seconds.', ephemeral: true });

    const description = interaction.options.getString('description');
    const requiredRole = interaction.options.getRole('role');
    const bannedRole = interaction.options.getRole('banrole');
    const colorRaw = interaction.options.getString('color');
    const imageUrl = interaction.options.getString('image');

    if (colorRaw && !parseHexColor(colorRaw)) {
        return interaction.reply({ content: '⚠️ Invalid color! Use a hex like `#ff5500`.', ephemeral: true });
    }
    if (requiredRole && bannedRole && requiredRole.id === bannedRole.id) {
        return interaction.reply({ content: '⚠️ A role cannot be both required and banned.', ephemeral: true });
    }

    const g = createGiveaway({
        guildId: interaction.guild.id,
        channelId: interaction.channelId,
        prize,
        durationMs: ms,
        winners,
        hostId: interaction.user.id,
        hostTag: interaction.user.tag,
        description: description || null,
        requiredRoleIds: requiredRole ? [requiredRole.id] : [],
        bannedRoleIds: bannedRole ? [bannedRole.id] : [],
        color: colorRaw || null,
        imageUrl: imageUrl || null,
    });

    try {
        await postGiveaway(interaction.channel, g);
        const req = requiredRole ? ', requires <@&' + requiredRole.id + '>' : '';
        const ban = bannedRole ? ', banned: <@&' + bannedRole.id + '>' : '';
        return interaction.reply({
            content: '✅ Giveaway **' + prize + '** started! Ends in **' + formatDuration(ms) + '** with **' + winners + '** winner' + (winners > 1 ? 's' : '') + req + ban + '. ID: `' + g.id + '`',
            ephemeral: true,
        });
    } catch (err) {
        logError(err, 'giveaways', 'start:' + g.id);
        cancelGiveaway(g.id);
        return interaction.reply({ content: '❌ Failed to post the giveaway: ' + err.message, ephemeral: true });
    }
}

// end / reroll / cancel accept a giveaway ID, a message ID, or a message link.
function resolveRef(raw) {
    return getGiveawayByMessageRef((raw || '').trim());
}

async function cmdEnd(interaction) {
    const ref = interaction.options.getString('id') || '';
    const g = resolveRef(ref);
    if (!g) return interaction.reply({ content: '⚠️ Giveaway not found. Use the ID from `/giveaway list` or paste the giveaway message link.', ephemeral: true });
    try {
        const res = await endGiveaway(g.id);
        if (res.error) return interaction.reply({ content: '⚠️ ' + res.error, ephemeral: true });
        return interaction.reply({
            content: '✅ Giveaway ended.' + (res.winners.length ? ' Winners: ' + res.winners.map(w => '<@' + w + '>').join(', ') : ' No one entered.'),
            ephemeral: true,
        });
    } catch (err) {
        logError(err, 'giveaways', 'end:' + g.id);
        return interaction.reply({ content: '❌ Failed to end giveaway: ' + err.message, ephemeral: true });
    }
}

async function cmdReroll(interaction) {
    const ref = interaction.options.getString('id') || '';
    const g = resolveRef(ref);
    if (!g) return interaction.reply({ content: '⚠️ Giveaway not found. Use the ID from `/giveaway list` or paste the giveaway message link.', ephemeral: true });
    try {
        const res = await rerollGiveaway(g.id);
        if (res.error) return interaction.reply({ content: '⚠️ ' + res.error, ephemeral: true });
        return interaction.reply({
            content: '✅ Rerolled!' + (res.winners.length ? ' New winners: ' + res.winners.map(w => '<@' + w + '>').join(', ') : ' Still no entrants.'),
            ephemeral: true,
        });
    } catch (err) {
        logError(err, 'giveaways', 'reroll:' + g.id);
        return interaction.reply({ content: '❌ Failed to reroll: ' + err.message, ephemeral: true });
    }
}

async function cmdCancel(interaction) {
    const ref = interaction.options.getString('id') || '';
    const g = resolveRef(ref);
    if (!g) return interaction.reply({ content: '⚠️ Giveaway not found. Use the ID from `/giveaway list` or paste the giveaway message link.', ephemeral: true });
    const res = cancelGiveaway(g.id);
    if (res.error) return interaction.reply({ content: '⚠️ ' + res.error, ephemeral: true });
    return interaction.reply({ content: '🛑 Giveaway cancelled.', ephemeral: true });
}

async function cmdList(interaction) {
    const giveaways = listGiveaways(interaction.guild.id, 10);
    if (!giveaways.length) return interaction.reply({ content: 'ℹ️ No giveaways have been run in this server.', ephemeral: true });
    const lines = giveaways.map(g => {
        const status = g.status === 'active' ? '🟢 active' : (g.status === 'ended' ? '✅ ended' : '🛑 cancelled');
        const when = g.status === 'active' ? 'ends <t:' + Math.floor(g.ends_at / 1000) + ':R>' : 'ended';
        const req = parseRoleIdsForList(g.required_role_ids);
        return '`' + g.id + '` — **' + g.prize + '** (' + status + ', ' + when + ')' + (req ? ' · requires ' + req : '');
    });
    return interaction.reply({
        content: '**🎉 Giveaways**\nUse the `id` with `/giveaway end|reroll|cancel <id>`.\n\n' + lines.join('\n'),
        ephemeral: true,
    });
}

function parseRoleIdsForList(v) {
    if (!v) return '';
    try { const p = JSON.parse(v); return Array.isArray(p) ? p.map(r => '<@&' + r + '>').join(' ') : ''; } catch { return ''; }
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
