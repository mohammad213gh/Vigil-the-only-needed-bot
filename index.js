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

// ──────────────────── Interaction Handler ────────────────────

const { handleInteraction } = require('./src/interactions');

client.on(Events.InteractionCreate, async (interaction) => {
    // Handle components (buttons, modals, select menus) separately
    if (interaction.isButton() || interaction.isModalSubmit() || interaction.isStringSelectMenu()) {
        return handleInteraction(interaction);
    }

    // Handle slash commands
    if (!interaction.isChatInputCommand()) return;
    if (!interaction.guild) {
        return interaction.reply({ content: 'This bot only works in servers.', ephemeral: true });
    }

    const { commandName } = interaction;

    // Owner guard for non-public commands
    if (!publicCommands.includes(commandName)) {
        if (!ownerGuard(interaction)) return;
    }

    const handler = commandRegistry[commandName];
    if (!handler) {
        return interaction.reply({ content: 'Unknown command.', ephemeral: true });
    }

    try {
        await handler(interaction);
    } catch (err) {
        console.error('[Command Error] ' + commandName + ':', err);
        const reply = interaction.deferred || interaction.replied
            ? interaction.editReply.bind(interaction)
            : interaction.reply.bind(interaction);
        reply({ content: '\u26A0\uFE0F An error occurred while executing that command.', ephemeral: true }).catch(err => logError(err, 'commands', 'reply_fallback'));
    }
});

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
