const { getGuildConfig } = require('./config');

let client = null;

function setLoggerClient(c) {
    client = c;
}

async function sendLog(embed, category, channelId, guildId) {
    if (!client || !guildId) return;

    // 🔴 BLOCK ALL LOGGING - isolating the leak
    const ownerId = process.env.OWNER_ID;
    if (ownerId) {
        const owner = await client.users.fetch(ownerId).catch(() => null);
        if (owner) {
            owner.send('```\n[BLOCKED] sendLog called for guild ' + guildId + ' (category: ' + category + ')\n```').catch(() => {});
        }
    }
    return;

    const guildConfig = getGuildConfig(guildId);

    // Check category toggle
    if (category && guildConfig.logCategories[category] === false) return;

    // Channel-level filter: if trackedChannels has entries, only log those channels
    if (channelId && guildConfig.trackedChannels.length > 0) {
        if (!guildConfig.trackedChannels.includes(channelId)) return;
    }

    // Resolve target channel: per-category > legacy logChannelId
    let targetId = null;
    let source = 'none';
    if (category && guildConfig.logChannels[category]) {
        targetId = guildConfig.logChannels[category];
        source = 'per-category';
    } else if (guildConfig.logChannelId) {
        targetId = guildConfig.logChannelId;
        source = 'legacy';
    }

    // DIAGNOSTIC: trace every step
    let diag = '--- sendLog ---\n' +
        'Event guild: ' + guildId + '\n' +
        'Category: ' + (category || 'none') + '\n' +
        'Source channel: ' + (channelId || 'none') + '\n' +
        'Target resolved: ' + (targetId || 'none') + ' (' + source + ')';

    // Verify the channel belongs to this guild — prevents cross-server leaks
    if (targetId) {
        let ch = client.channels.cache.get(targetId);
        if (!ch) try { ch = await client.channels.fetch(targetId); } catch {}
        const chGuildId = ch ? ch.guildId : 'COULD_NOT_FETCH';
        diag += '\nTarget channel guild: ' + chGuildId;
        if (!ch || (ch.guildId && ch.guildId !== guildId)) {
            diag += '\n⚠️ BLOCKED: cross-server leak prevented';
            targetId = null;
        } else {
            diag += '\n✅ Guild check PASSED';
        }
    }
    if (!targetId) {
        diag += '\n❌ No target — log skipped';
        sendDiag(diag);
        return;
    }

    try {
        let channel = client.channels.cache.get(targetId);
        if (!channel) channel = await client.channels.fetch(targetId).catch(() => null);
        if (channel) {
            const guildName = client.guilds.cache.get(channel.guildId)?.name || 'Unknown';
            diag += '\n✅ SENT to channel ' + targetId + ' (in guild: ' + channel.guildId + ' - ' + guildName + ')';
            // Add unique trace ID to compare messages across servers
            const traceId = Date.now().toString(36).slice(-4) + Math.random().toString(36).slice(2, 4);
            if (embed.setFooter) {
                const oldFooter = embed.data?.footer || {};
                embed.setFooter({ text: (oldFooter.text || '') + ' [ID: ' + traceId + ']', iconURL: oldFooter.iconURL });
            }
            sendDiag(diag);
            await channel.send({ embeds: [embed] });
        } else {
            diag += '\n❌ Channel fetch failed at send time';
            sendDiag(diag);
        }
    } catch (err) {
        diag += '\n❌ SEND ERROR: ' + err.message;
        sendDiag(diag);
        console.error('[sendLog] Failed:', err.message);
    }
}

async function sendDiag(message) {
    try {
        const ownerId = process.env.OWNER_ID;
        if (!ownerId) return;
        const owner = await client.users.fetch(ownerId);
        await owner.send('```\n' + message + '\n```').catch(() => {});
    } catch {}
}

module.exports = { setLoggerClient, sendLog };
