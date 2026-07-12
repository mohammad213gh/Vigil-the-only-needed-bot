const { loadConfig, saveConfig } = require('./config');

const RR_KEY = '_reactionRoles';

// ──────────────────── Reaction Role Structure ────────────────────
// Stored in config.json under _reactionRoles key:
// {
//   "guildId": [
//     {
//       "messageId": "123",
//       "channelId": "456",
//       "emoji": "✅",          // or "emojiName:emojiId" for custom emojis
//       "roleId": "789",
//       "label": "Member"       // optional display name
//     }
//   ]
// }

function getReactionRoles(guildId) {
    const config = loadConfig();
    if (!config[RR_KEY]) config[RR_KEY] = {};
    return config[RR_KEY][guildId] || [];
}

function saveReactionRoles(guildId, roles) {
    const config = loadConfig();
    if (!config[RR_KEY]) config[RR_KEY] = {};
    config[RR_KEY][guildId] = roles;
    saveConfig(config);
}

function addReactionRole(guildId, messageId, channelId, emoji, roleId, label) {
    const roles = getReactionRoles(guildId);
    roles.push({ messageId, channelId, emoji, roleId, label: label || null });
    saveReactionRoles(guildId, roles);
    return roles;
}

function removeReactionRole(guildId, messageId, emoji) {
    const roles = getReactionRoles(guildId);
    const filtered = roles.filter(r => !(r.messageId === messageId && r.emoji === emoji));
    if (filtered.length === roles.length) return false;
    saveReactionRoles(guildId, filtered);
    return true;
}

function removeAllForMessage(guildId, messageId) {
    const roles = getReactionRoles(guildId);
    const filtered = roles.filter(r => r.messageId !== messageId);
    saveReactionRoles(guildId, filtered);
    return roles.length - filtered.length;
}

function findReactionRole(guildId, messageId, emojiKey) {
    const roles = getReactionRoles(guildId);
    return roles.find(r => r.messageId === messageId && r.emoji === emojiKey);
}

module.exports = {
    getReactionRoles,
    saveReactionRoles,
    addReactionRole,
    removeReactionRole,
    removeAllForMessage,
    findReactionRole,
};
