const fs = require('fs');
const { getDataPath } = require('./data');

const RR_PATH = getDataPath('reactionRoles.json');

// ──────────────────── Reaction Role Structure ────────────────────
// Stored in src/data/reactionRoles.json:
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

// ─── Migration from old config.json ───
function findConfigPath() {
    if (process.env.CONFIG_PATH) return process.env.CONFIG_PATH;
    if (fs.existsSync('./config.json')) return './config.json';
    const dataPath = getDataPath('config.json');
    if (fs.existsSync(dataPath)) return dataPath;
    return './config.json';
}

function migrateFromConfig() {
    try {
        const configPath = findConfigPath();
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (config._reactionRoles && Object.keys(config._reactionRoles).length > 0) {
            fs.writeFileSync(RR_PATH, JSON.stringify(config._reactionRoles, null, 4));
            delete config._reactionRoles;
            fs.writeFileSync(configPath, JSON.stringify(config, null, 4));
            console.log('[Migration] Moved reaction roles to data/reactionRoles.json');
        }
    } catch { /* no migration needed */ }
}

function loadReactionRoles() {
    try {
        return JSON.parse(fs.readFileSync(RR_PATH, 'utf8'));
    } catch {
        migrateFromConfig();
        return {};
    }
}

function saveReactionRolesData(data) {
    try {
        fs.writeFileSync(RR_PATH, JSON.stringify(data, null, 4));
    } catch (err) {
        console.error('[ReactionRoles] Failed to save:', err.message);
    }
}

function getReactionRoles(guildId) {
    const data = loadReactionRoles();
    return data[guildId] || [];
}

function saveGuildRoles(guildId, roles) {
    const data = loadReactionRoles();
    data[guildId] = roles;
    saveReactionRolesData(data);
}

function addReactionRole(guildId, messageId, channelId, emoji, roleId, label) {
    const roles = getReactionRoles(guildId);
    roles.push({ messageId, channelId, emoji, roleId, label: label || null });
    saveGuildRoles(guildId, roles);
    return roles;
}

function removeReactionRole(guildId, messageId, emoji) {
    const roles = getReactionRoles(guildId);
    const filtered = roles.filter(r => !(r.messageId === messageId && r.emoji === emoji));
    if (filtered.length === roles.length) return false;
    saveGuildRoles(guildId, filtered);
    return true;
}

function removeAllForMessage(guildId, messageId) {
    const roles = getReactionRoles(guildId);
    const filtered = roles.filter(r => r.messageId !== messageId);
    saveGuildRoles(guildId, filtered);
    return roles.length - filtered.length;
}

function findReactionRole(guildId, messageId, emojiKey) {
    const roles = getReactionRoles(guildId);
    return roles.find(r => r.messageId === messageId && r.emoji === emojiKey);
}

module.exports = {
    getReactionRoles,
    addReactionRole,
    removeReactionRole,
    removeAllForMessage,
    findReactionRole,
};
