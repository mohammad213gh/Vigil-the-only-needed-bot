// ──────────────────── Voice Presence (24/7 VC aura) ────────────────────
// The bot can join a voice channel and just stay there, showing a
// "Listening to …" activity so it looks alive. The VC + status are saved
// per-guild in the DB, so after a restart the bot re-joins automatically.
//
//   • /vc join [channel]   — join a VC and stay (defaults to your channel)
//   • /vc move <channel>   — hop to another VC
//   • /vc status <text>    — custom "Listening to" text (the aura)
//   • /vc leave            — leave and clear the activity
//
// Implementation note: discord.js v14's REST move endpoint
// (VoiceState.setChannel) errors with "Target user is not connected to
// voice" when the bot isn't already in a VC — it can move, but NOT connect
// from idle. That's why joining uses @discordjs/voice's joinVoiceChannel
// (enabled via enableDiscordJsVoice() in index.js), which handles both
// connecting from idle and moving. The GuildVoiceStates intent is enabled.

const { ActivityType } = require('discord.js');
const { getDb } = require('./db');
const { logError } = require('./logError');

const MAX_STATUS_LENGTH = 128;
const MAX_REJOIN_ATTEMPTS = 5;
const REJOIN_BASE_DELAY_MS = 5000;

let voiceClient = null;

function setVoiceClient(client) {
    voiceClient = client;
}

// ──────────────────── Voice connection layer ────────────────────

let connectImpl = null;    // async (guild, channel) => {}
let disconnectImpl = null; // (guild) => {}

// Use @discordjs/voice for connecting so the bot can join a VC from an idle
// state (VoiceState.setChannel only moves an already-connected bot). Called
// once at boot from index.js. Returns true when enabled.
function enableDiscordJsVoice() {
    let v = null;
    try { v = require('@discordjs/voice'); } catch { v = null; }
    if (!v || typeof v.joinVoiceChannel !== 'function') return false;
    connectImpl = async (guild, channel) => {
        const conn = v.joinVoiceChannel({
            channelId: channel.id,
            guildId: guild.id,
            adapterCreator: guild.voiceAdapterCreator,
            selfDeaf: true,
            selfMute: true,
        });
        // Some failures (channel full, no permission) surface asynchronously
        // via the connection's error event instead of throwing. Log it AND
        // clear the saved presence/activity so the DB doesn't claim the bot
        // is in a VC it never actually joined.
        if (conn && typeof conn.once === 'function') {
            conn.once('error', (err) => {
                logError(err, 'voicePresence', 'connection_' + guild.id);
                clearPresence(guild.id);
                clearActivity().catch(() => {});
            });
        }
    };
    disconnectImpl = (guild) => {
        if (typeof v.getVoiceConnection !== 'function') return;
        const conn = v.getVoiceConnection(guild.id);
        if (conn) { try { conn.destroy(); } catch { /* already gone */ } }
    };
    return true;
}

// Connect or move the bot into `channel`. With @discordjs/voice enabled this
// works from idle; the VoiceState fallback (moves only) exists for tests and
// environments without the library.
async function connectVoice(guild, channel) {
    if (!guild || !channel) return;
    if (connectImpl) { await connectImpl(guild, channel); return; }
    const me = getBotMember(guild);
    if (me && me.voice) await me.voice.setChannel(channel);
}

function leaveVoice(guild) {
    if (!guild) return;
    if (disconnectImpl) { try { disconnectImpl(guild); } catch { /* ignore */ } }
    const me = getBotMember(guild);
    if (me && me.voice && me.voice.channelId) {
        try { me.voice.disconnect().catch(() => {}); } catch { /* ignore */ }
    }
}

// Test-only: drop the @discordjs/voice impl so tests exercise the VoiceState
// fallback deterministically. No-op in production (never called there).
function resetVoiceImpl() {
    connectImpl = null;
    disconnectImpl = null;
}

// ──────────────────── Pure helpers ────────────────────

function isVoiceChannel(channel) {
    // ChannelType.GuildVoice === 2
    return !!(channel && channel.id && channel.type === 2);
}

// The activity text shown while in VC. Custom status wins, otherwise the
// channel name is used ("Listening to Lounge").
function formatStatus(status, channelName) {
    const s = (status && typeof status === 'string') ? status.trim() : '';
    if (s) return s.slice(0, MAX_STATUS_LENGTH);
    return (channelName && typeof channelName === 'string') ? channelName.trim().slice(0, MAX_STATUS_LENGTH) : 'the voice channel';
}

// ──────────────────── DB access ────────────────────

function getPresence(guildId) {
    if (!guildId) return null;
    try {
        return getDb().prepare('SELECT guild_id, channel_id, status FROM voice_presence WHERE guild_id = ?').get(guildId) || null;
    } catch (err) {
        logError(err, 'voicePresence', 'getPresence');
        return null;
    }
}

function savePresence(guildId, channelId, status) {
    if (!guildId || !channelId) return { error: 'Missing guild or channel' };
    try {
        getDb().prepare('INSERT OR REPLACE INTO voice_presence (guild_id, channel_id, status) VALUES (?, ?, ?)')
            .run(guildId, channelId, (status && String(status).trim()) || null);
        return { success: true };
    } catch (err) {
        logError(err, 'voicePresence', 'savePresence');
        return { error: err.message || 'Failed to save voice presence' };
    }
}

function clearPresence(guildId) {
    if (!guildId) return;
    try {
        getDb().prepare('DELETE FROM voice_presence WHERE guild_id = ?').run(guildId);
    } catch (err) {
        logError(err, 'voicePresence', 'clearPresence');
    }
}

// ──────────────────── Activity (the aura) ────────────────────

// Snapshot of the bot's activities before the VC override, so we can put
// them back on leave instead of wiping an owner-configured /presence.
let savedActivities = null;

function captureActivities() {
    if (savedActivities !== null || !voiceClient || !voiceClient.user) return;
    const p = voiceClient.user.presence;
    savedActivities = (p && p.activities && p.activities.length)
        ? p.activities.map(a => ({ name: a.name, type: a.type, state: a.state, url: a.url }))
        : [];
}

async function updateActivity(guild, channel, status) {
    if (!voiceClient || !voiceClient.user || !guild || !channel) return;
    captureActivities();
    const name = formatStatus(status, channel.name);
    try {
        await voiceClient.user.setPresence({
            activities: [{ name, type: ActivityType.Listening }],
        });
    } catch (err) {
        logError(err, 'voicePresence', 'updateActivity');
    }
}

async function clearActivity() {
    if (!voiceClient || !voiceClient.user) return;
    try {
        if (savedActivities !== null) {
            // Restore whatever the bot was showing before the VC override.
            await voiceClient.user.setPresence({ activities: savedActivities });
            savedActivities = null;
        } else {
            await voiceClient.user.setPresence({ activities: [] });
        }
    } catch (err) {
        logError(err, 'voicePresence', 'clearActivity');
    }
}

// ──────────────────── Actions ────────────────────

function getBotMember(guild) {
    return guild && guild.members && guild.members.me ? guild.members.me : null;
}

// Join a voice channel and stay. Saves the presence BEFORE moving so the
// voiceStateUpdate self-heal (which adopts/repairs on our behalf) never
// sees a stale state; rolls back the DB row if the move fails.
async function joinChannel(guild, channel, status) {
    if (!isVoiceChannel(channel)) {
        const err = new Error('Not a voice channel');
        err.code = 'NOT_VOICE';
        throw err;
    }
    const me = getBotMember(guild);
    if (!me) {
        const err = new Error('Bot member not loaded yet — try again in a few seconds');
        err.code = 'NO_MEMBER';
        throw err;
    }
    if (me.voice && me.voice.channelId === channel.id) {
        const err = new Error('Already in ' + channel.name);
        err.code = 'ALREADY_THERE';
        throw err;
    }

    const prev = getPresence(guild.id);
    savePresence(guild.id, channel.id, status || null);
    try {
        await connectVoice(guild, channel);
    } catch (err) {
        // Roll back so a failed join doesn't leave a phantom presence.
        if (prev && prev.channel_id) savePresence(guild.id, prev.channel_id, prev.status);
        else clearPresence(guild.id);
        throw err;
    }
    await updateActivity(guild, channel, status);
    return channel;
}

async function moveChannel(guild, channel) {
    if (!isVoiceChannel(channel)) {
        const err = new Error('Not a voice channel');
        err.code = 'NOT_VOICE';
        throw err;
    }
    const me = getBotMember(guild);
    if (!me) {
        const err = new Error('Bot member not loaded yet — try again in a few seconds');
        err.code = 'NO_MEMBER';
        throw err;
    }
    const prev = getPresence(guild.id);
    if (!prev || !prev.channel_id) {
        const err = new Error('The bot is not in a voice channel here — use /vc join first');
        err.code = 'NOT_IN_VC';
        throw err;
    }
    if (prev.channel_id === channel.id) {
        const err = new Error('Already in ' + channel.name);
        err.code = 'ALREADY_THERE';
        throw err;
    }

    savePresence(guild.id, channel.id, prev.status);
    try {
        await connectVoice(guild, channel);
    } catch (err) {
        savePresence(guild.id, prev.channel_id, prev.status);
        throw err;
    }
    await updateActivity(guild, channel, prev.status);
    return channel;
}

async function leaveChannel(guild) {
    leaveVoice(guild);
    clearPresence(guild.id);
    await clearActivity();
}

// Set (or clear) the "Listening to" text. Requires the bot to already be
// in a VC here — otherwise there is nothing to be listening to.
async function setStatusText(guild, text) {
    const prev = getPresence(guild.id);
    if (!prev || !prev.channel_id) {
        const err = new Error('The bot is not in a voice channel here — use /vc join first');
        err.code = 'NOT_IN_VC';
        throw err;
    }
    const clean = (text && typeof text === 'string') ? text.trim().slice(0, MAX_STATUS_LENGTH) : '';
    savePresence(guild.id, prev.channel_id, clean || null);
    const channel = guild.channels && guild.channels.cache ? guild.channels.cache.get(prev.channel_id) : null;
    if (channel) await updateActivity(guild, channel, clean);
    return clean || null;
}

// ──────────────────── Boot restore ────────────────────

// After login, re-join every guild that had a saved presence so the bot
// is back in its VC (24/7). Channels that no longer exist drop the row.
async function restoreAllPresences(client) {
    if (!client || !client.guilds || !client.guilds.cache) return;
    for (const guild of client.guilds.cache.values()) {
        const saved = getPresence(guild.id);
        if (!saved || !saved.channel_id) continue;
        const channel = guild.channels && guild.channels.cache ? guild.channels.cache.get(saved.channel_id) : null;
        if (!channel) {
            clearPresence(guild.id);
            continue;
        }
        if (!isVoiceChannel(channel)) {
            clearPresence(guild.id);
            continue;
        }
        const me = getBotMember(guild);
        if (!me) continue;
        try {
            await connectVoice(guild, channel);
            await updateActivity(guild, channel, saved.status);
        } catch (err) {
            logError(err, 'voicePresence', 'restore_' + guild.id);
        }
    }
}

// ──────────────────── Self-heal on voiceStateUpdate ────────────────────

const rejoinTimers = new Map(); // guildId -> { attempts, timer }

// Wire this to the client's VoiceStateUpdate event. Two jobs:
//   1. If the bot was manually moved to another VC, adopt the new channel.
//   2. If the bot got disconnected while a presence is saved (kicked,
//      channel deleted, network blip), rejoin with bounded backoff. If the
//      channel is gone, the presence row is dropped.
function handleBotVoiceUpdate(oldState, newState) {
    try {
        if (!voiceClient || !voiceClient.user) return;
        const botId = voiceClient.user.id;
        const member = (oldState && oldState.member) || (newState && newState.member);
        if (!member || member.id !== botId) return;
        const guild = (oldState && oldState.guild) || (newState && newState.guild);
        if (!guild || !guild.id) return;

        const saved = getPresence(guild.id);
        if (!saved) return;

        const newChannelId = newState ? newState.channelId : null;
        const wasConnected = oldState && oldState.channelId;

        if (newChannelId && newChannelId !== saved.channel_id) {
            // Moved somewhere else (our own /vc move saves first, so this
            // only fires for manual moves) — follow along.
            savePresence(guild.id, newChannelId, saved.status);
            return;
        }

        if (!newChannelId && wasConnected) {
            scheduleRejoin(guild, saved);
        }
    } catch (err) {
        logError(err, 'voicePresence', 'handleBotVoiceUpdate');
    }
}

function scheduleRejoin(guild, saved) {
    const gid = guild.id;
    const cur = rejoinTimers.get(gid) || { attempts: 0, timer: null };
    if (cur.attempts >= MAX_REJOIN_ATTEMPTS) {
        clearPresence(gid);
        rejoinTimers.delete(gid);
        return;
    }
    clearTimeout(cur.timer);
    const delay = REJOIN_BASE_DELAY_MS * Math.pow(2, cur.attempts);
    cur.attempts += 1;
    cur.timer = setTimeout(async () => {
        try {
            const channel = guild.channels && guild.channels.cache ? guild.channels.cache.get(saved.channel_id) : null;
            if (!channel) {
                clearPresence(gid);
                rejoinTimers.delete(gid);
                return;
            }
            const me = getBotMember(guild);
            if (!me) {
                // Bot member not ready — drop the pending entry; the next
                // voiceStateUpdate will schedule a fresh attempt if needed.
                rejoinTimers.delete(gid);
                return;
            }
            // Someone/something already put us back — done.
            if (me.voice && me.voice.channelId) {
                rejoinTimers.delete(gid);
                return;
            }
            await connectVoice(guild, channel);
            await updateActivity(guild, channel, saved.status);
            rejoinTimers.delete(gid);
        } catch (err) {
            // Keep the entry (attempts counter included) and retry with a
            // longer delay. scheduleRejoin bails out (clearing the presence)
            // once the cap is reached.
            logError(err, 'voicePresence', 'rejoin_' + gid);
            scheduleRejoin(guild, saved);
        }
    }, delay);
    if (cur.timer.unref) cur.timer.unref();
    rejoinTimers.set(gid, cur);
}

function stopVoicePresence() {
    for (const [, entry] of rejoinTimers) clearTimeout(entry.timer);
    rejoinTimers.clear();
}

module.exports = {
    setVoiceClient,
    enableDiscordJsVoice,
    connectVoice,
    leaveVoice,
    resetVoiceImpl,
    isVoiceChannel,
    formatStatus,
    getPresence,
    savePresence,
    clearPresence,
    joinChannel,
    moveChannel,
    leaveChannel,
    setStatusText,
    updateActivity,
    clearActivity,
    restoreAllPresences,
    handleBotVoiceUpdate,
    stopVoicePresence,
};
