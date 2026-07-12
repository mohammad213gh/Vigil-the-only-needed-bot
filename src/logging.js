const { getGuildConfig } = require('./config');

let client = null;

function setLoggerClient(c) {
    client = c;
}

async function sendLog(embed, category, channelId, guildId) {
    if (!client) return;

    // Fallback: no guild -> use env LOG_CHANNEL_ID
    if (!guildId) {
        try {
            let channel = client.channels.cache.get(process.env.LOG_CHANNEL_ID);
            if (!channel) channel = await client.channels.fetch(process.env.LOG_CHANNEL_ID).catch(() => null);
            if (channel) await channel.send({ embeds: [embed] });
        } catch { /* silent */ }
        return;
    }

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
        source = 'category:' + category;
    } else if (guildConfig.logChannelId) {
        targetId = guildConfig.logChannelId;
        source = 'logChannelId';
    }
    // Verify the channel belongs to this guild — prevents cross-server leaks
    if (targetId) {
        let ch = client.channels.cache.get(targetId);
        if (!ch) try { ch = await client.channels.fetch(targetId); } catch {}
        if (ch && ch.guildId && ch.guildId !== guildId) {
            console.log('[sendLog] BLOCKED cross-server: guild=' + guildId + ' targetChannelGuild=' + ch.guildId + ' source=' + source);
            targetId = null;
        } else if (!ch) {
            console.log('[sendLog] TARGET NOT RESOLVED: guild=' + guildId + ' targetId=' + targetId + ' source=' + source + ' (channel not in cache/fetch failed)');
        }
    } else {
        console.log('[sendLog] NO TARGET: guild=' + guildId + ' category=' + category + ' source=' + source);
    }
    if (!targetId) return;

    try {
        let channel = client.channels.cache.get(targetId);
        if (!channel) channel = await client.channels.fetch(targetId).catch(() => null);
        if (channel) {
            await channel.send({ embeds: [embed] });
        }
    } catch (err) {
        console.error('[sendLog] Failed:', err.message);
    }
}

module.exports = { setLoggerClient, sendLog };
