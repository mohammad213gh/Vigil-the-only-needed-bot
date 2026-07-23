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

// ─── Command Registry ───
const { commandRegistry, publicCommands } = require('./src/commands/registry');
const { ownerGuard } = require('./src/commands/_guard');

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
    if (event.once) {
        client.once(event.name, event.execute(eventDeps));
    } else {
        client.on(event.name, event.execute(eventDeps));
    }
}

// ──────────────────── Cooldown System ────────────────────

const cooldowns = new Map();
const DEFAULT_COOLDOWN = 3; // seconds
const COOLDOWN_OVERRIDES = {
    ping: 2,
    help: 2,
    status: 5,
    shutdown: 0,
    deploy: 30,
    purge: 5,
    say: 3,
    embed: 3,
    announce: 5,
    poll: 5,
    botname: 10,
    botavatar: 10,
    presence: 5,
};

function checkCooldown(interaction) {
    const cmd = interaction.commandName;
    const userId = interaction.user.id;
    const cooldownTime = (COOLDOWN_OVERRIDES[cmd] || DEFAULT_COOLDOWN) * 1000;

    if (cooldownTime <= 0) return true; // no cooldown

    if (!cooldowns.has(cmd)) {
        cooldowns.set(cmd, new Map());
    }

    const timestamps = cooldowns.get(cmd);
    const now = Date.now();
    const expiration = timestamps.get(userId);

    if (expiration && now < expiration) {
        const remaining = ((expiration - now) / 1000).toFixed(1);
        return { remaining };
    }

    timestamps.set(userId, now + cooldownTime);

    // Clean up old entries every 5 minutes
    if (timestamps.size > 100) {
        const expiry = now - 60000;
        for (const [uid, ts] of timestamps.entries()) {
            if (ts < expiry) timestamps.delete(uid);
        }
    }

    return true;
}

// ──────────────────── Interaction Handler ────────────────────

const { handleInteraction } = require('./src/interactions');

client.on(Events.InteractionCreate, async (interaction) => {
    try {
        // Handle components (buttons, modals, select menus) separately
        if (interaction.isButton() || interaction.isModalSubmit() || interaction.isStringSelectMenu()) {
            return handleInteraction(interaction);
        }

        // Handle slash commands
        if (!interaction.isChatInputCommand()) return;
        if (!interaction.guild) {
            return interaction.reply({ content: '❌ This bot only works in servers.', ephemeral: true });
        }

        const { commandName } = interaction;

        // Cooldown check
        const cooldownResult = checkCooldown(interaction);
        if (cooldownResult !== true) {
            return interaction.reply({
                content: '⏳ Please wait **' + cooldownResult.remaining + 's** before using `/' + commandName + '` again.',
                ephemeral: true,
            });
        }

        // Owner guard for non-public commands
        if (!publicCommands.includes(commandName)) {
            if (!ownerGuard(interaction)) return;
        }

        const handler = commandRegistry[commandName];
        if (!handler) {
            return interaction.reply({ content: '❌ Unknown command. Use `/help` to see available commands.', ephemeral: true });
        }

        try {
            await handler(interaction);
        } catch (err) {
            console.error('[Command Error] ' + commandName + ':', err);
            const errorMsg = getFriendlyError(err, commandName);
            const reply = interaction.deferred || interaction.replied
                ? interaction.editReply.bind(interaction)
                : interaction.reply.bind(interaction);
            reply({ content: errorMsg, ephemeral: true }).catch(e => logError(e, 'commands', 'reply_fallback'));
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

// ──────────────────── Friendly Error Messages ────────────────────

function getFriendlyError(err, commandName) {
    const msg = err.message || String(err);

    // Discord API errors
    if (msg.includes('Missing Access')) return '❌ The bot doesn\'t have access to that resource. Check permissions.';
    if (msg.includes('Missing Permissions')) return '❌ The bot doesn\'t have the required permission to do that.';
    if (msg.includes('rate limited') || msg.includes('rate limit')) return '❌ Too many requests. Please slow down.';
    if (msg.includes('Unknown User') || msg.includes('Unknown Member')) return '❌ That user was not found. They may have left the server.';
    if (msg.includes('Unknown Channel')) return '❌ That channel no longer exists.';
    if (msg.includes('Unknown Role')) return '❌ That role no longer exists.';
    if (msg.includes('Unknown Guild') || msg.includes('Unknown Server')) return '❌ That server was not found.';
    if (msg.includes('Cannot edit a message')) return '❌ Could not edit that message. It may have been deleted.';
    if (msg.includes('Target user is not a member')) return '❌ That user is not in this server.';
    if (msg.includes('Prune') || msg.includes('prune')) return '❌ Could not prune members. Check the bot\'s role position.';
    if (msg.includes('TIMEOUT') || msg.includes('timeout')) return '❌ The request timed out. Please try again.';
    if (msg.includes('ECONNRESET') || msg.includes('ETIMEDOUT') || msg.includes('ECONNREFUSED')) return '❌ Could not reach Discord. The bot may be reconnecting.';

    // Generic fallback — include the actual error for debugging
    console.error('[Unhandled] ' + commandName + ':', msg);
    return '❌ An error occurred while running `/' + commandName + '`. The issue has been logged.';
}



// ──────────────────── Start Reminder Checker ────────────────────

const { setReminderClient, startReminderChecker } = require('./src/reminders');
setReminderClient(client);
startReminderChecker();

// ──────────────────── Start Web Dashboard ────────────────────

const { createDashboard, setDashboardClient } = require('./src/dashboard');
setDashboardClient(client, process.env.DASHBOARD_PASSWORD);
const app = createDashboard();
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('Dashboard running on port ' + PORT);
});

// ──────────────────── Login ────────────────────

// ──────────────────── Graceful Shutdown ────────────────────

const { closeDb } = require('./src/db');

function shutdown(signal) {
    console.log('\n[Bot] Received ' + signal + '. Shutting down gracefully...');
    closeDb();
    client.destroy();
    console.log('[Bot] Goodbye!');
    process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGQUIT', () => shutdown('SIGQUIT'));

// ──────────────────── Login ────────────────────

client.login(process.env.BOT_TOKEN);
