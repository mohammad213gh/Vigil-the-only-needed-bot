// ──────────────────── Command Registry ────────────────────
// Maps command names to their handler functions.
// Add new commands here instead of wiring them into index.js.

// ── Info ──
const { executePing, executeStatus, executeBotInfo, executeUserInfo, executeAvatar, executeStats } = require('./info');
const { executeHelp } = require('./help');



// ── Fun ──
const { executeWorldCup, execute8Ball, executeCoinflip, executeDice, executeRPS, executeJoke, executeFact, executeAdvice, executeQuote, executeReverse, executeMock, executeRandom } = require('./fun');

// ── Reminders ──
const { executeRemindMe, executeReminders } = require('./reminder');

// ── Admin ──
const { executeRole, executePurge, executeSlowmode, executeNickname, executeSay, executeEmbed, executeDeploy, executeTrack, executePoll, executeAnnounce } = require('./admin');

// ── Moderation ──
const { executeKick, executeBan, executeUnban, executeTimeout, executeUntimeout, executeWarn, executeWarnings, executeClearWarnings, executeLock, executeUnlock } = require('./moderation');
const { executeHistory, executeCase as executeCaseCmd, executeReason } = require('./modCases');



// ── Config ──
const { executeLog, executeEmbedConfig, executePresence, executeBotAvatar, executeBotName, executePrefix } = require('./config');

// ── Permissions ──
const { executePerm } = require('./permissions');

// ── Reaction Roles ──
const { executeReactionRole } = require('./reactionRoles');

// ── Owner ──
const { executeDashboard, executeDashAccess, executeServerLeave, executeShutdown } = require('./owner');

// ── Welcome/Goodbye ──
const { executeWelcome, executeGoodbye } = require('./greetings');

// ──────────────────── Registry Map ────────────────────

const commandRegistry = {
    // Info
    help: executeHelp,
    ping: executePing,
    status: executeStatus,
    botinfo: executeBotInfo,
    userinfo: executeUserInfo,
    avatar: executeAvatar,
    stats: executeStats,

    // Fun (public)
    worldcup: executeWorldCup,
    '8ball': execute8Ball,
    coinflip: executeCoinflip,
    dice: executeDice,
    rps: executeRPS,
    joke: executeJoke,
    fact: executeFact,
    advice: executeAdvice,
    quote: executeQuote,
    reverse: executeReverse,
    mock: executeMock,
    random: executeRandom,

    // Reminders (public)
    remindme: executeRemindMe,
    reminders: executeReminders,

    // Admin
    role: executeRole,
    purge: executePurge,
    slowmode: executeSlowmode,
    nickname: executeNickname,
    say: executeSay,
    embed: executeEmbed,
    deploy: executeDeploy,
    track: executeTrack,
    poll: executePoll,
    announce: executeAnnounce,

    // Moderation
    kick: executeKick,
    ban: executeBan,
    unban: executeUnban,
    timeout: executeTimeout,
    untimeout: executeUntimeout,
    warn: executeWarn,
    warnings: executeWarnings,
    clearwarnings: executeClearWarnings,
    lock: executeLock,
    unlock: executeUnlock,
    history: executeHistory,
    case: executeCaseCmd,
    reason: executeReason,

    // Config
    log: executeLog,
    embedconfig: executeEmbedConfig,
    presence: executePresence,
    botavatar: executeBotAvatar,
    botname: executeBotName,
    prefix: executePrefix,

    // Permissions
    perm: executePerm,

    // Reaction Roles
    reactionrole: executeReactionRole,

    // Welcome/Goodbye
    welcome: executeWelcome,
    goodbye: executeGoodbye,

    // Owner
    dashboard: executeDashboard,
    dashaccess: executeDashAccess,
    server_leave: executeServerLeave,
    shutdown: executeShutdown,
};

// Commands that anyone can use (no owner guard)
const publicCommands = [
    'help', 'ping', 'worldcup', '8ball', 'coinflip', 'dice', 'rps',
    'joke', 'fact', 'advice', 'quote', 'reverse', 'mock', 'random',
    'remindme', 'reminders',
];

module.exports = { commandRegistry, publicCommands };
