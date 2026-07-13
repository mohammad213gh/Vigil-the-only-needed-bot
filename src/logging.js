const { getGuildConfig } = require('./config');

let client = null;

function setLoggerClient(c) {
    client = c;
}

async function sendLog(embed, category, channelId, guildId) {
    if (!client || !guildId) return;

    const guildConfig = getGuildConfig(guildId);

    // Check category toggle
    if (category && guildConfig.logCategories[category] === false) return;

    // Channel-level filter: if trackedChannels has entries, only log those channels
    if (channelId && guildConfig.trackedChannels.length > 0) {
        if (!guildConfig.trackedChannels.includes(channelId)) return;
    }

    // Resolve target channel — only use per-category channel, no fallback
    // If a category has no channel set, the log is not sent (user must explicitly pick a channel)
    let targetId = null;
    if (category && guildConfig.logChannels[category]) {
        targetId = guildConfig.logChannels[category];
    }

    // Verify the channel belongs to this guild — prevents cross-server leaks
    if (targetId) {
        let ch = client.channels.cache.get(targetId);
        if (!ch) try { ch = await client.channels.fetch(targetId); } catch {}
        if (!ch || (ch.guildId && ch.guildId !== guildId)) {
            targetId = null;
        }
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
