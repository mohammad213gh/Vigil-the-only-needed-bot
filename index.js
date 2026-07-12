require('dotenv').config();

const {
    Client, GatewayIntentBits, Events, Partials,
} = require('discord.js');

// ─── Utilities & Data Layers ───
const { loadConfig } = require('./src/config');
const { recordJoin, recordLeave } = require('./src/stats');
const { truncate, formatUptime, emojiToString, fetchAuditLogExecutor } = require('./src/helpers');
const { deployCommands } = require('./src/deploy');
const { setLoggerClient, sendLog } = require('./src/logging');
const { findReactionRole } = require('./src/reactionRoles');

// ─── Command Handlers ───
const { executePing, executeStatus, executeBotInfo, executeUserInfo, executeAvatar, executeStats } = require('./src/commands/info');
const { executeRemindMe, executeReminders } = require('./src/commands/reminder');
const { executeRole, executePurge, executeSlowmode, executeNickname, executeSay, executeEmbed, executeDeploy, executeTrack, executePoll, executeAnnounce } = require('./src/commands/admin');
const { executeKick, executeBan, executeUnban, executeTimeout, executeUntimeout, executeWarn, executeWarnings, executeClearWarnings, executeLock, executeUnlock } = require('./src/commands/moderation');
const { executeWorldCup, execute8Ball, executeCoinflip, executeDice, executeRPS, executeJoke, executeFact, executeAdvice, executeQuote, executeReverse, executeMock, executeRandom } = require('./src/commands/fun');
const { executeLog, executeEmbedConfig, executePresence, executeBotAvatar, executeBotName } = require('./src/commands/config');
const { executePerm } = require('./src/commands/permissions');
const { executeReactionRole } = require('./src/commands/reactionRoles');
const { executeDashboard, executeDashAccess, executeShutdown } = require('./src/commands/owner');
const { ownerGuard } = require('./src/commands/_guard');

// ─── Event Handlers ───
const readyEvent = require('./src/events/ready');
const messageEvents = require('./src/events/messages');
const reactionEvents = require('./src/events/reactions');
const memberEvents = require('./src/events/members');
const roleEvents = require('./src/events/roles');
const serverEvents = require('./src/events/server');
const voiceEvents = require('./src/events/voice');

// ──────────────────── Bot Setup ────────────────────

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildVoiceStates,
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
    loadConfig,
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
];

for (const event of allEvents) {
    if (event.once) {
        client.once(event.name, event.execute(eventDeps));
    } else {
        client.on(event.name, event.execute(eventDeps));
    }
}

// ──────────────────── Interaction Handler ────────────────────

const publicCommands = ['ping', 'worldcup', '8ball', 'coinflip', 'dice', 'rps', 'joke', 'fact', 'advice', 'quote', 'reverse', 'mock', 'random'];

client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    if (!interaction.guild) {
        return interaction.reply({ content: 'This bot only works in servers.', ephemeral: true });
    }

    const { commandName } = interaction;

    // Owner guard for non-public commands
    if (!publicCommands.includes(commandName)) {
        if (!ownerGuard(interaction)) return;
    }

    try {
        switch (commandName) {
            // ── Info ──
            case 'ping': await executePing(interaction); break;
            case 'status': await executeStatus(interaction); break;
            case 'botinfo': await executeBotInfo(interaction); break;
            case 'userinfo': await executeUserInfo(interaction); break;
            case 'avatar': await executeAvatar(interaction); break;
            case 'stats': await executeStats(interaction); break;

            // ── Admin ──
            case 'role': await executeRole(interaction); break;
            case 'purge': await executePurge(interaction); break;
            case 'slowmode': await executeSlowmode(interaction); break;
            case 'nickname': await executeNickname(interaction); break;
            case 'say': await executeSay(interaction); break;
            case 'embed': await executeEmbed(interaction); break;
            case 'deploy': await executeDeploy(interaction); break;
            case 'track': await executeTrack(interaction); break;
            case 'poll': await executePoll(interaction); break;
            case 'announce': await executeAnnounce(interaction); break;

            // ── Moderation ──
            case 'kick': await executeKick(interaction); break;
            case 'ban': await executeBan(interaction); break;
            case 'unban': await executeUnban(interaction); break;
            case 'timeout': await executeTimeout(interaction); break;
            case 'untimeout': await executeUntimeout(interaction); break;
            case 'warn': await executeWarn(interaction); break;
            case 'warnings': await executeWarnings(interaction); break;
            case 'clearwarnings': await executeClearWarnings(interaction); break;
            case 'lock': await executeLock(interaction); break;
            case 'unlock': await executeUnlock(interaction); break;

            // ── Reminders ──
            case 'remindme': await executeRemindMe(interaction); break;
            case 'reminders': await executeReminders(interaction); break;

            // ── Fun ──
            case 'worldcup': await executeWorldCup(interaction); break;
            case '8ball': await execute8Ball(interaction); break;
            case 'coinflip': await executeCoinflip(interaction); break;
            case 'dice': await executeDice(interaction); break;
            case 'rps': await executeRPS(interaction); break;
            case 'joke': await executeJoke(interaction); break;
            case 'fact': await executeFact(interaction); break;
            case 'advice': await executeAdvice(interaction); break;
            case 'quote': await executeQuote(interaction); break;
            case 'reverse': await executeReverse(interaction); break;
            case 'mock': await executeMock(interaction); break;
            case 'random': await executeRandom(interaction); break;

            // ── Config ──
            case 'log': await executeLog(interaction); break;
            case 'embedconfig': await executeEmbedConfig(interaction); break;
            case 'presence': await executePresence(interaction); break;
            case 'botavatar': await executeBotAvatar(interaction); break;
            case 'botname': await executeBotName(interaction); break;

            // ── Permissions ──
            case 'perm': await executePerm(interaction); break;

            // ── Reaction Roles ──
            case 'reactionrole': await executeReactionRole(interaction); break;

            // ── Dashboard ──
            case 'dashboard': await executeDashboard(interaction); break;

            // ── Dashboard Access ──
            case 'dashaccess': await executeDashAccess(interaction); break;

            // ── Shutdown ──
            case 'shutdown': await executeShutdown(interaction); break;

            default:
                await interaction.reply({ content: 'Unknown command.', ephemeral: true });
        }
    } catch (err) {
        console.error('[Command Error] ' + commandName + ':', err);
        const reply = interaction.deferred || interaction.replied
            ? interaction.editReply.bind(interaction)
            : interaction.reply.bind(interaction);
        reply({ content: '\u26A0\uFE0F An error occurred while executing that command.', ephemeral: true }).catch(() => {});
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

// ──────────────────── DIAGNOSTIC: Capture ALL sends to in-memory array (no rate limits) ────────────────────

global.__sendLogs = [];

function interceptSend(channelProto, name) {
    const orig = channelProto.send;
    channelProto.send = function (...args) {
        const stack = new Error().stack.split('\n').slice(2, 12).join('\n').trim();
        const entry = {
            t: Date.now(),
            type: name,
            guildId: this.guildId || 'DM',
            channelId: this.id,
            channelName: this.name || 'Unknown',
            stack: stack,
        };
        global.__sendLogs.push(entry);
        if (global.__sendLogs.length > 200) global.__sendLogs.shift();
        console.log('[SEND-' + name + '] guild: ' + entry.guildId + ' | channel: ' + entry.channelId);
        return orig.apply(this, args);
    };
}

const { TextChannel, NewsChannel, VoiceChannel, StageChannel, ThreadChannel } = require('discord.js');
interceptSend(TextChannel.prototype, 'Text');
interceptSend(NewsChannel.prototype, 'News');
interceptSend(VoiceChannel.prototype, 'Voice');
interceptSend(StageChannel.prototype, 'Stage');
interceptSend(ThreadChannel.prototype, 'Thread');

// ──────────────────── Login ────────────────────

client.login(process.env.BOT_TOKEN);
