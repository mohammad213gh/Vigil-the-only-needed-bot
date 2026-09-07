require('dotenv').config();

const {
    Client, GatewayIntentBits, Events, Partials,
} = require('discord.js');

// ─── Utilities & Data Layers ───
// Config is loaded on first access via getGuildConfig()
const { recordJoin, recordLeave } = require('./src/stats');
const { truncate, formatUptime, emojiToString, fetchAuditLogExecutor } = require('./src/helpers');
const { logError } = require('./src/logError');
const { deployCommands } = require('./src/deploy');
const { setLoggerClient, sendLog } = require('./src/logging');
const { findReactionRole } = require('./src/reactionRoles');
const { setInviteClient, handleInviteCreate, handleInviteDelete } = require('./src/invites');
const { setTicketClient, startInactivityCheck, stopInactivityCheck } = require('./src/tickets');
const { setGiveawayClient, startGiveawayCheck, stopGiveawayCheck } = require('./src/giveaways');
const { startServerStats, stopServerStats, refreshGuildStats } = require('./src/serverStats');
const { setVoiceClient, enableDiscordJsVoice, handleBotVoiceUpdate, stopVoicePresence } = require('./src/voicePresence');
const { handleVoiceStateUpdate: handleTempVoiceUpdate, stopTempVoice } = require('./src/tempVoice');
const { setTempBanClient, startTempBanSweeper, stopTempBanSweeper } = require('./src/tempBans');

// ─── Command Registry ───
const { runCommand } = require('./src/commandPipeline');

// ─── Event Handlers ───
const readyEvent = require('./src/events/ready');
const messageEvents = require('./src/events/messages');
const reactionEvents = require('./src/events/reactions');
const memberEvents = require('./src/events/members');
const roleEvents = require('./src/events/roles');
const serverEvents = require('./src/events/server');
const voiceEvents = require('./src/events/voice');
const extraEvents = require('./src/events/extras');

// ──────────────────── Bot Setup ────────────────────

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildScheduledEvents,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildExpressions,
    ],
    partials: [
        Partials.Message,
        Partials.Channel,
        Partials.Reaction,
        Partials.GuildMember,
    ],
});

setLoggerClient(client);
setInviteClient(client);
setVoiceClient(client);
setTempBanClient(client);
// @discordjs/voice — lets the bot join a VC from an idle state (the REST
// move endpoint can only move a bot that is already connected).
if (!enableDiscordJsVoice()) {
    console.warn('[WARN] @discordjs/voice is not available — /vc join will only work to MOVE the bot between VCs, not connect from idle. Run `npm install`.');
}

// ──────────────────── Event Dependencies ────────────────────

const eventDeps = {
    client,
    sendLog,
    truncate,
    formatUptime,
    emojiToString,
    deployCommands,
    recordJoin,
    recordLeave,
    rrFind: findReactionRole,
    fetchAuditLogExecutor,
    handleInviteCreate,
    handleInviteDelete,
};

// ──────────────────── Register Events ────────────────────

const allEvents = [
    readyEvent,
    ...messageEvents,
    ...reactionEvents,
    ...memberEvents,
    ...roleEvents,
    ...serverEvents,
    ...voiceEvents,
    ...extraEvents,
];

for (const event of allEvents) {
    // Wrap every event handler so a rejected promise can never crash the bot.
    // Each handler is an async fn — without this guard, one throw becomes an
    // unhandledRejection that takes the whole process down.
    const rawHandler = event.execute(eventDeps);
    const safeHandler = async (...args) => {
        try {
            await rawHandler(...args);
        } catch (err) {
            logError(err, 'event', String(event.name));
        }
    };
    if (event.once) {
        client.once(event.name, safeHandler);
    } else {
        client.on(event.name, safeHandler);
    }
}

// ── Live server-stats refresh (join / leave / boost changes) ──
// Fires on top of the registered events so stat channels update instantly
// instead of waiting for the 10-minute sweep.
client.on(Events.GuildMemberAdd, (member) => { refreshGuildStats(member.guild).catch(() => {}); });
client.on(Events.GuildMemberRemove, (member) => { refreshGuildStats(member.guild).catch(() => {}); });
client.on(Events.GuildMemberUpdate, (oldMember, newMember) => {
    if ((oldMember.premiumSince || null) !== (newMember.premiumSince || null)) {
        refreshGuildStats(newMember.guild).catch(() => {});
    }
});

// ── Voice presence self-heal ──
// If the bot is moved manually it follows; if it gets disconnected while a
// presence is saved (kicked / channel deleted / blip) it rejoins with
// bounded backoff. Never throws.
client.on(Events.VoiceStateUpdate, (oldState, newState) => {
    try { handleBotVoiceUpdate(oldState, newState); } catch { /* never crash on voice state */ }
});

// ── Temp voice channels ──
// Joining a trigger VC spawns a per-user channel; leaving an empty spawned
// channel schedules its deletion. Never throws.
client.on(Events.VoiceStateUpdate, (oldState, newState) => {
    try { handleTempVoiceUpdate(oldState, newState); } catch { /* never crash on voice state */ }
});// ──────────────────── Cooldown cleanup on startup ────────────────────
// (The cooldown system itself lives in src/commandPipeline.js, shared
// with the prefix dispatcher.)

// Cleanup expired DB cooldowns on startup
function cleanupExpiredCooldowns() {
    try {
        const { getDb } = require('./src/db');
        const db = getDb();
        db.prepare('DELETE FROM command_cooldowns WHERE expires_at <= ?').run(Date.now());
    } catch (err) {
        console.error('[Cooldown] Cleanup failed:', err.message);
    }
}
cleanupExpiredCooldowns();

// ──────────────────── Interaction Handler ────────────────────

const { handleInteraction } = require('./src/interactions');

client.on(Events.InteractionCreate, async (interaction) => {
    try {
        // Handle components (buttons, modals, select menus) separately
        if (interaction.isButton() || interaction.isModalSubmit() || interaction.isStringSelectMenu()) {
            return handleInteraction(interaction);
        }

        // Handle slash commands — shared pipeline (cooldown, owner guard,
        // registry, usage tracking, friendly errors). The prefix dispatcher
        // runs the exact same pipeline via the interaction shim.
        if (!interaction.isChatInputCommand()) return;
        if (!interaction.guild) {
            return interaction.reply({ content: '❌ This bot only works in servers.', ephemeral: true });
        }

        const handled = await runCommand(interaction);
        if (!handled) {
            return interaction.reply({ content: '❌ Unknown command. Use `/help` to see available commands.', ephemeral: true });
        }
    } catch (err) {
        // Top-level catch — prevents crashes from reaching Discord's generic "Interaction failed"
        console.error('[Interaction Fatal]', err);
        logError(err, 'interaction', 'fatal');
        try {
            const reply = interaction.deferred || interaction.replied
                ? interaction.editReply.bind(interaction)
                : interaction.reply.bind(interaction);
            reply({ content: '❌ Something went wrong. Please try again.', ephemeral: true });
        } catch { /* ignore double-fail */ }
    }
});

// ──────────────────── Reminder Client (checker starts post-login) ────────────────────

const { setReminderClient, startReminderChecker, stopReminderChecker } = require('./src/reminders');
setReminderClient(client);

// ──────────────────── Start Web Dashboard ────────────────────

const { createDashboard, setDashboardClient } = require('./src/dashboard');
setDashboardClient(client, process.env.DASHBOARD_PASSWORD);
setTicketClient(client);
const app = createDashboard();
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('Dashboard running on port ' + PORT);
});

// ──────────────────── Login ────────────────────

// ──────────────────── Graceful Shutdown ────────────────────

const { closeDb, getDb, backupDatabase, startDataRetentionSweeper, stopDataRetentionSweeper } = require('./src/db');

function shutdown(signal) {
    console.log('\n[Bot] Received ' + signal + '. Shutting down gracefully...');
    stopInactivityCheck();
    stopGiveawayCheck();
    stopServerStats();
    stopVoicePresence();
    stopTempVoice();
    stopTempBanSweeper();
    stopReminderChecker();
    stopDataRetentionSweeper();
    closeDb();
    client.destroy();
    console.log('[Bot] Goodbye!');
    process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGQUIT', () => shutdown('SIGQUIT'));

// ──────────────────── Global Crash Safety Nets ────────────────────
// A single unhandled rejection or uncaught exception must never take the bot
// down silently. Log full context so failures are visible in the logs.
process.on('unhandledRejection', (reason) => {
    // Keep running: most rejections are transient API hiccups / network errors.
    logError(reason instanceof Error ? reason : new Error(String(reason)), 'unhandledRejection');
});

process.on('uncaughtException', (err) => {
    // Unrecoverable — log loudly, then exit so the host restarts us cleanly.
    logError(err, 'uncaughtException');
    try { closeDb(); } catch {}
    try { client.destroy(); } catch {}
    process.exit(1);
});

// ──────────────────── Scheduled Database Backups ────────────────────
// Snapshot bot.db shortly after boot, then once per day. The dashboard can
// also trigger backups manually and download/delete them.
function runScheduledBackup() {
    try {
        const r = backupDatabase();
        if (r) console.log('[Backup] Created ' + r.name + ' (' + (r.size / 1024).toFixed(1) + ' KB)');
    } catch (err) {
        logError(err, 'backup');
    }
}
setTimeout(runScheduledBackup, 10 * 1000);
setInterval(runScheduledBackup, 24 * 60 * 60 * 1000);

// ──────────────────── Error Alert Notifier ────────────────────
// If an alert channel is configured from the dashboard, surface critical
// errors there. Rate-limited to 1 message / 60s to avoid spam storms.
const { setErrorListener } = require('./src/logError');
let lastErrorAlertAt = 0;
const CRITICAL_ERROR_TAGS = new Set(['uncaughtException', 'unhandledRejection']);
setErrorListener((entry) => {
    try {
        if (!entry || !CRITICAL_ERROR_TAGS.has(entry.tag)) return;
        const now = Date.now();
        if (now - lastErrorAlertAt < 60 * 1000) return;
        const row = getDb().prepare('SELECT value FROM bot_config WHERE key = ?').get('bot_error_alert_channel');
        if (!row || !row.value) return;
        const channel = client.channels.cache.get(row.value);
        if (!channel || !channel.isTextBased || !channel.isTextBased()) return;
        lastErrorAlertAt = now;
        channel.send({
            embeds: [{
                color: 0xED4245,
                author: { name: '⚠️ Critical Bot Error' },
                title: entry.tag,
                description: '```\n' + String(entry.message || 'Unknown error').slice(0, 1500) + '\n```',
                fields: entry.stack ? [{ name: 'Stack (first lines)', value: '```\n' + String(entry.stack).slice(0, 900) + '\n```' }] : [],
                timestamp: entry.timestamp || new Date().toISOString(),
            }],
        }).catch(() => {});
    } catch { /* alerting must never crash the bot */ }
});

// ──────────────────── Login ────────────────────

client.login(process.env.BOT_TOKEN).then(() => {
    startInactivityCheck(client);
    setGiveawayClient(client);
    startGiveawayCheck();
    startServerStats(client);
    startTempBanSweeper();
    startReminderChecker();
    startDataRetentionSweeper();
    console.log('[Bot] Ticket inactivity, giveaway + server stats checks started.');
}).catch(err => {
    console.error('[Bot] Failed to login:', err.message || err);
    process.exit(1);
});
