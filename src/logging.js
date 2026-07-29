const { getGuildConfig } = require('./config');
const { logError } = require('./logError');

let client = null;

function setLoggerClient(c) {
    client = c;
}

function applyGuildEmbedColor(embed, guildId) {
    try {
        const guildConfig = getGuildConfig(guildId);
        if (guildConfig?.embedColor) {
            // Only override if embed doesn't already have a specific color set
            // (embeds with 0xE74C3C for kick/ban, 0xF1C40F for warn, etc. keep their color)
            const current = embed.data?.color;
            if (!current || current === 0x5865F2) {
                embed.setColor(guildConfig.embedColor);
            }
        }
    } catch {
        // Silently skip color override failures - non-critical
    }
    return embed;
}

async function sendLog(embed, category, channelId, guildId) {
    if (!client || !guildId) return;

    let guildConfig;
    try {
        guildConfig = getGuildConfig(guildId);
    } catch {
        return; // Can't log without config
    }
    if (!guildConfig) return;
    
    embed = applyGuildEmbedColor(embed, guildId);

    // Check category toggle
    if (category && guildConfig.logCategories?.[category] === false) return;

    // Channel-level filter: if trackedChannels has entries, only log those channels
    if (channelId && guildConfig.trackedChannels?.length > 0) {
        if (!guildConfig.trackedChannels.includes(channelId)) return;
    }

    // Resolve target channel — only use per-category channel, no fallback
    let targetId = null;
    if (category && guildConfig.logChannels?.[category]) {
        targetId = guildConfig.logChannels[category];
    }

    // Verify the channel belongs to this guild — prevents cross-server leaks
    if (targetId) {
        try {
            let ch = client.channels.cache.get(targetId);
            if (!ch) ch = await client.channels.fetch(targetId);
            if (!ch || (ch.guildId && ch.guildId !== guildId)) {
                targetId = null;
            }
        } catch (err) {
            logError(err, 'logging', 'channel_fetch ' + targetId);
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
        logError(err, 'logging', 'send_failed');
    }
}

module.exports = { setLoggerClient, sendLog };
