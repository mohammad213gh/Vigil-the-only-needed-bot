require('dotenv').config();
const {
    Client, GatewayIntentBits, Events, Partials, EmbedBuilder,
    REST, Routes, SlashCommandBuilder, PermissionFlagsBits,
    version: djsVersion
} = require('discord.js');
const os = require('os');
const fs = require('fs');

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
    ]
});

// ──────────────────── Config Manager ────────────────────

const CONFIG_PATH = './config.json';

function loadConfig() {
    try {
        return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    } catch {
        return {};
    }
}

function saveConfig(config) {
    try {
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 4));
    } catch (err) {
        console.error('[Config] Failed to save config.json:', err.message);
    }
}

const LOG_CATEGORIES = ['messages', 'reactions', 'members', 'roles', 'server', 'voice'];

function createDefaultConfig() {
    const cats = {};
    const channels = {};
    for (const c of LOG_CATEGORIES) {
        cats[c] = true;
        channels[c] = null;
    }
    return {
        logChannelId: null,
        logChannels: channels,
        trackedChannels: [],
        logCategories: cats,
    };
}

function getGuildConfig(guildId) {
    const config = loadConfig();
    if (!config[guildId]) {
        config[guildId] = createDefaultConfig();
        saveConfig(config);
        return config[guildId];
    }
    const g = config[guildId];

    // ── Auto-migrate from old single-channel format ──
    if (!g.logChannels) {
        g.logChannels = {};
        for (const c of LOG_CATEGORIES) g.logChannels[c] = null;
    }
    if (!g.logCategories) {
        g.logCategories = {};
        for (const c of LOG_CATEGORIES) g.logCategories[c] = true;
    } else {
        // Ensure new categories exist
        for (const c of LOG_CATEGORIES) {
            if (g.logCategories[c] === undefined) g.logCategories[c] = true;
            if (g.logChannels[c] === undefined) g.logChannels[c] = null;
        }
    }
    if (!g.trackedChannels) g.trackedChannels = [];
    saveConfig(config);
    return g;
}

// ──────────────────── Bot Global Config ────────────────────

const BOT_CONFIG_KEY = '_bot';

function getBotConfig() {
    const config = loadConfig();
    if (!config[BOT_CONFIG_KEY]) {
        config[BOT_CONFIG_KEY] = {
            embedFooterText: null,
            embedFooterIcon: null,
            embedColor: null,
        };
        saveConfig(config);
    }
    return config[BOT_CONFIG_KEY];
}

function saveBotConfig(partial) {
    const config = loadConfig();
    if (!config[BOT_CONFIG_KEY]) config[BOT_CONFIG_KEY] = {};
    Object.assign(config[BOT_CONFIG_KEY], partial);
    saveConfig(config);
    return config[BOT_CONFIG_KEY];
}

// ──────────────────── Stats Manager ────────────────────

const STATS_PATH = './stats.json';

function loadStats() {
    try {
        return JSON.parse(fs.readFileSync(STATS_PATH, 'utf8'));
    } catch {
        return {};
    }
}

function saveStats(stats) {
    try {
        fs.writeFileSync(STATS_PATH, JSON.stringify(stats, null, 4));
    } catch (err) {
        console.error('[Stats] Failed to save stats.json:', err.message);
    }
}

function getGuildStats(guildId) {
    const stats = loadStats();
    if (!stats[guildId]) {
        stats[guildId] = {
            totalJoins: 0,
            totalLeaves: 0,
            dailySnapshots: [],
            lastSnapshotDate: ''
        };
        saveStats(stats);
    }
    return stats[guildId];
}

function recordJoin(guildId) {
    const stats = loadStats();
    if (!stats[guildId]) {
        stats[guildId] = { totalJoins: 0, totalLeaves: 0, dailySnapshots: [], lastSnapshotDate: '' };
    }
    stats[guildId].totalJoins++;
    const today = new Date().toISOString().slice(0, 10);
    const snapshots = stats[guildId].dailySnapshots;
    const lastSnap = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
    if (lastSnap && lastSnap.date === today) {
        lastSnap.joins++;
    } else {
        snapshots.push({ date: today, joins: 1, leaves: 0 });
        if (snapshots.length > 90) snapshots.shift();
    }
    saveStats(stats);
}

function recordLeave(guildId) {
    const stats = loadStats();
    if (!stats[guildId]) {
        stats[guildId] = { totalJoins: 0, totalLeaves: 0, dailySnapshots: [], lastSnapshotDate: '' };
    }
    stats[guildId].totalLeaves++;
    const today = new Date().toISOString().slice(0, 10);
    const snapshots = stats[guildId].dailySnapshots;
    const lastSnap = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
    if (lastSnap && lastSnap.date === today) {
        lastSnap.leaves++;
    } else {
        snapshots.push({ date: today, joins: 0, leaves: 1 });
        if (snapshots.length > 90) snapshots.shift();
    }
    saveStats(stats);
}

// ──────────────────── Helpers ────────────────────

function truncate(str, max) {
    if (max === undefined) max = 1024;
    if (!str) return '*Empty*';
    return str.length > max ? str.slice(0, max - 3) + '...' : str;
}

function formatUptime(ms) {
    if (!ms) return '0s';
    const t = Math.floor(ms / 1000);
    const d = Math.floor(t / 86400);
    const h = Math.floor((t % 86400) / 3600);
    const m = Math.floor((t % 3600) / 60);
    const s = t % 60;
    const p = [];
    if (d) p.push(d + 'd');
    if (h) p.push(h + 'h');
    if (m) p.push(m + 'm');
    p.push(s + 's');
    return p.join(' ');
}

function formatNumber(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return String(n);
}

function emojiToString(emoji) {
    return emoji.id
        ? '<' + (emoji.animated ? 'a' : '') + ':' + emoji.name + ':' + emoji.id + '>'
        : emoji.name;
}

function isOwner(userId) {
    return userId === process.env.OWNER_ID;
}

const WS_STATUS = {
    0: '\u2705 Ready',
    1: '\u26A0 Connecting',
    2: '\uD83D\uDFE0 Reconnecting',
    3: '\uD83D\uDFE4 Idle',
    4: '\uD83D\uDD34 Nearly',
    5: '\uD83D\uDD34 Disconnected',
};

const CATEGORY_EMOJIS = {
    messages: '\uD83D\uDCE8',
    reactions: '\uD83D\uDC4D',
    members: '\uD83D\uDC65',
    roles: '\uD83C\uDFF7\uFE0F',
    server: '\uD83D\uDDA5\uFE0F',
    voice: '\uD83C\uDFA4',
};

// ──────────────────── Country Flag Map ────────────────────

const COUNTRY_FLAGS = {
    'argentina': '🇦🇷', 'australia': '🇦🇺', 'austria': '🇦🇹',
    'belgium': '🇧🇪', 'bolivia': '🇧🇴', 'brazil': '🇧🇷',
    'cameroon': '🇨🇲', 'canada': '🇨🇦', 'chile': '🇨🇱',
    'china': '🇨🇳', 'colombia': '🇨🇴', 'costa rica': '🇨🇷',
    'croatia': '🇭🇷', 'czech': '🇨🇿', 'czech republic': '🇨🇿',
    'denmark': '🇩🇰',
    'ecuador': '🇪🇨', 'egypt': '🇪🇬', 'england': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    'finland': '🇫🇮', 'france': '🇫🇷',
    'germany': '🇩🇪', 'ghana': '🇬🇭', 'greece': '🇬🇷',
    'holland': '🇳🇱', 'hungary': '🇭🇺',
    'iceland': '🇮🇸', 'india': '🇮🇳', 'indonesia': '🇮🇩', 'iran': '🇮🇷', 'iraq': '🇮🇶',
    'ireland': '🇮🇪', 'italy': '🇮🇹', 'ivory coast': '🇨🇮',
    'jamaica': '🇯🇲', 'japan': '🇯🇵',
    'kenya': '🇰🇪', 'kuwait': '🇰🇼',
    'mexico': '🇲🇽', 'morocco': '🇲🇦',
    'netherlands': '🇳🇱', 'new zealand': '🇳🇿', 'nigeria': '🇳🇬', 'north korea': '🇰🇵',
    'norway': '🇳🇴',
    'panama': '🇵🇦', 'paraguay': '🇵🇾', 'peru': '🇵🇪', 'poland': '🇵🇱', 'portugal': '🇵🇹',
    'qatar': '🇶🇦',
    'romania': '🇷🇴', 'russia': '🇷🇺', 'rwanda': '🇷🇼',
    'saudi arabia': '🇸🇦', 'scotland': '🏴󠁧󠁢󠁳󠁣󠁴󠁿', 'senegal': '🇸🇳', 'serbia': '🇷🇸',
    'south korea': '🇰🇷', 'spain': '🇪🇸', 'sweden': '🇸🇪', 'switzerland': '🇨🇭',
    'tunisia': '🇹🇳', 'turkey': '🇹🇷',
    'uganda': '🇺🇬', 'ukraine': '🇺🇦', 'uruguay': '🇺🇾', 'usa': '🇺🇸',
    'venezuela': '🇻🇪', 'vietnam': '🇻🇳', 'wales': '🏴󠁧󠁢󠁷󠁬󠁳󠁿',
};

function getFlag(team) {
    const key = team.toLowerCase().trim();
    return COUNTRY_FLAGS[key] || '⚽';
}

// ──────────────────── Embed Builder Helper ────────────────────

function makeEmbed(opts) {
    const botCfg = getBotConfig();
    const embed = new EmbedBuilder()
        .setColor(opts.color || botCfg.embedColor || 0x5865F2);

    if (opts.title) embed.setTitle(opts.title);
    if (opts.description) embed.setDescription(opts.description);
    if (opts.author) embed.setAuthor(opts.author);
    if (opts.thumbnail) embed.setThumbnail(opts.thumbnail);
    if (opts.image) embed.setImage(opts.image);
    if (opts.fields) embed.addFields(opts.fields);
    if (opts.timestamp) embed.setTimestamp();

    // Apply custom footer from config if set and no explicit footer provided
    if (opts.footer) {
        embed.setFooter(opts.footer);
    } else if (botCfg.embedFooterText) {
        embed.setFooter({
            text: botCfg.embedFooterText,
            iconURL: botCfg.embedFooterIcon || client.user?.displayAvatarURL(),
        });
    }

    return embed;
}

// ──────────────────── Log Dispatcher ────────────────────

async function sendLog(embed, category, channelId, guildId) {
    // Fallback: no guild → use env LOG_CHANNEL_ID
    if (!guildId) {
        try {
            let channel = client.channels.cache.get(process.env.LOG_CHANNEL_ID);
            if (!channel) channel = await client.channels.fetch(process.env.LOG_CHANNEL_ID).catch(() => null);
            if (channel) await channel.send({ embeds: [embed] });
        } catch (err) { /* silent */ }
        return;
    }

    const guildConfig = getGuildConfig(guildId);

    // Check category toggle
    if (category && guildConfig.logCategories[category] === false) return;

    // Channel-level filter (tracked channels)
    if (channelId && guildConfig.trackedChannels.length > 0) {
        if (!guildConfig.trackedChannels.includes(channelId)) return;
    }

    // Resolve target channel: per-category > legacy logChannelId > env var
    let targetId = null;
    if (category && guildConfig.logChannels[category]) {
        targetId = guildConfig.logChannels[category];
    } else if (guildConfig.logChannelId) {
        targetId = guildConfig.logChannelId;
    } else {
        targetId = process.env.LOG_CHANNEL_ID;
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

// ──────────────────── Command Definitions ────────────────────

const commandDefs = [
    // ── Info (public) ──
    new SlashCommandBuilder()
        .setName('ping')
        .setDescription("Check the bot's latency"),
    new SlashCommandBuilder()
        .setName('status')
        .setDescription("Show the bot's status, resources, and stats"),
    new SlashCommandBuilder()
        .setName('botinfo')
        .setDescription('Show information about this bot'),

    // ── Log config ──
    new SlashCommandBuilder()
        .setName('log')
        .setDescription('Configure logging (owner only)')
        .addSubcommand(sub =>
            sub.setName('channel')
                .setDescription('Set or remove a dedicated channel for a log type')
                .addStringOption(opt =>
                    opt.setName('type')
                        .setDescription('Log type to configure')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Messages', value: 'messages' },
                            { name: 'Reactions', value: 'reactions' },
                            { name: 'Members', value: 'members' },
                            { name: 'Roles', value: 'roles' },
                            { name: 'Server', value: 'server' },
                            { name: 'Voice', value: 'voice' },
                        ))
                .addChannelOption(opt =>
                    opt.setName('channel')
                        .setDescription('Channel to send these logs to (leave empty to clear)')
                        .setRequired(false)))
        .addSubcommand(sub =>
            sub.setName('toggle')
                .setDescription('Enable or disable a log category')
                .addStringOption(opt =>
                    opt.setName('category')
                        .setDescription('Category to toggle')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Messages', value: 'messages' },
                            { name: 'Reactions', value: 'reactions' },
                            { name: 'Members', value: 'members' },
                            { name: 'Roles', value: 'roles' },
                            { name: 'Server', value: 'server' },
                            { name: 'Voice', value: 'voice' },
                        ))
                .addBooleanOption(opt =>
                    opt.setName('enabled')
                        .setDescription('Enable or disable')
                        .setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('Show current logging configuration')),
    new SlashCommandBuilder()
        .setName('track')
        .setDescription('Manage tracked channels (owner only)')
        .addSubcommand(sub =>
            sub.setName('add')
                .setDescription('Add a channel to track')
                .addChannelOption(opt =>
                    opt.setName('channel')
                        .setDescription('Channel to track')
                        .setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('remove')
                .setDescription('Remove a channel from tracking')
                .addChannelOption(opt =>
                    opt.setName('channel')
                        .setDescription('Channel to stop tracking')
                        .setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('Show all tracked channels')),
    new SlashCommandBuilder()
        .setName('stats')
        .setDescription('View server statistics')
        .addSubcommand(sub =>
            sub.setName('server')
                .setDescription('Show live server stats'))
        .addSubcommand(sub =>
            sub.setName('growth')
                .setDescription('Show member growth over time')),

    // ── Role management ──
    new SlashCommandBuilder()
        .setName('role')
        .setDescription('Manage roles (owner only)')
        .addSubcommand(sub =>
            sub.setName('add')
                .setDescription('Add a role to a user')
                .addUserOption(opt =>
                    opt.setName('user')
                        .setDescription('The user')
                        .setRequired(true))
                .addRoleOption(opt =>
                    opt.setName('role')
                        .setDescription('The role to add')
                        .setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('remove')
                .setDescription('Remove a role from a user')
                .addUserOption(opt =>
                    opt.setName('user')
                        .setDescription('The user')
                        .setRequired(true))
                .addRoleOption(opt =>
                    opt.setName('role')
                        .setDescription('The role to remove')
                        .setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription("List a user's roles")
                .addUserOption(opt =>
                    opt.setName('user')
                        .setDescription('The user (defaults to you)')
                        .setRequired(false))),

    // ── Moderation ──
    new SlashCommandBuilder()
        .setName('purge')
        .setDescription('Bulk delete messages (owner only)')
        .addIntegerOption(opt =>
            opt.setName('amount')
                .setDescription('Number of messages (1-100)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(100)),
    new SlashCommandBuilder()
        .setName('slowmode')
        .setDescription('Set channel slowmode (owner only)')
        .addIntegerOption(opt =>
            opt.setName('seconds')
                .setDescription('Slowmode in seconds (0-21600)')
                .setRequired(true)
                .setMinValue(0)
                .setMaxValue(21600))
        .addChannelOption(opt =>
            opt.setName('channel')
                .setDescription('Channel (defaults to current)')
                .setRequired(false)),
    new SlashCommandBuilder()
        .setName('nickname')
        .setDescription("Change a user's nickname (owner only)")
        .addUserOption(opt =>
            opt.setName('user')
                .setDescription('The user')
                .setRequired(true))
        .addStringOption(opt =>
            opt.setName('nickname')
                .setDescription('New nickname (or "reset" to clear)')
                .setRequired(true)),

    // ── Utility ──
    new SlashCommandBuilder()
        .setName('say')
        .setDescription('Make the bot say something (owner only)')
        .addChannelOption(opt =>
            opt.setName('channel')
                .setDescription('Channel to send the message to')
                .setRequired(true))
        .addStringOption(opt =>
            opt.setName('message')
                .setDescription('Message content')
                .setRequired(true)),
    new SlashCommandBuilder()
        .setName('embed')
        .setDescription('Send an embedded message (owner only)')
        .addChannelOption(opt =>
            opt.setName('channel')
                .setDescription('Channel to send the embed to')
                .setRequired(true))
        .addStringOption(opt =>
            opt.setName('title')
                .setDescription('Embed title')
                .setRequired(true))
        .addStringOption(opt =>
            opt.setName('description')
                .setDescription('Embed description')
                .setRequired(false))
        .addStringOption(opt =>
            opt.setName('color')
                .setDescription('Hex color (e.g. #5865F2)')
                .setRequired(false)),
    new SlashCommandBuilder()
        .setName('userinfo')
        .setDescription("Get info about a user (owner only)")
        .addUserOption(opt =>
            opt.setName('user')
                .setDescription('The user (defaults to you)')
                .setRequired(false)),
    new SlashCommandBuilder()
        .setName('avatar')
        .setDescription("Get a user's avatar (owner only)")
        .addUserOption(opt =>
            opt.setName('user')
                .setDescription('The user (defaults to you)')
                .setRequired(false)),
    new SlashCommandBuilder()
        .setName('deploy')
        .setDescription('Re-register all slash commands (owner only)'),

    // ── World Cup (public) ──
    new SlashCommandBuilder()
        .setName('worldcup')
        .setDescription('Predict a World Cup match score between two countries')
        .addStringOption(opt =>
            opt.setName('team1')
                .setDescription('First team/country')
                .setRequired(true))
        .addStringOption(opt =>
            opt.setName('team2')
                .setDescription('Second team/country')
                .setRequired(true)),

    // ── Bot Customization (owner only) ──
    new SlashCommandBuilder()
        .setName('presence')
        .setDescription('Set the bot\'s activity status (owner only)')
        .addStringOption(opt =>
            opt.setName('type')
                .setDescription('Activity type')
                .setRequired(true)
                .addChoices(
                    { name: 'Playing', value: 'playing' },
                    { name: 'Watching', value: 'watching' },
                    { name: 'Listening', value: 'listening' },
                    { name: 'Competing', value: 'competing' },
                ))
        .addStringOption(opt =>
            opt.setName('text')
                .setDescription('Activity text (e.g. "World Cup 2026")')
                .setRequired(true)),
    new SlashCommandBuilder()
        .setName('botavatar')
        .setDescription("Change the bot's avatar (owner only)")
        .addStringOption(opt =>
            opt.setName('url')
                .setDescription('Direct image URL for the new avatar')
                .setRequired(true)),
    new SlashCommandBuilder()
        .setName('botname')
        .setDescription("Change the bot's username (owner only)")
        .addStringOption(opt =>
            opt.setName('name')
                .setDescription('New username (max 32 chars)')
                .setRequired(true)),
    new SlashCommandBuilder()
        .setName('embedconfig')
        .setDescription('Configure embed appearance (owner only)')
        .addSubcommand(sub =>
            sub.setName('footer')
                .setDescription('Set a custom embed footer text (and optional icon)')
                .addStringOption(opt =>
                    opt.setName('text')
                        .setDescription('Footer text (leave empty to clear)')
                        .setRequired(false))
                .addStringOption(opt =>
                    opt.setName('icon')
                        .setDescription('Optional icon URL for the footer')
                        .setRequired(false)))
        .addSubcommand(sub =>
            sub.setName('color')
                .setDescription('Set a default embed color (hex)')
                .addStringOption(opt =>
                    opt.setName('hex')
                        .setDescription('Hex color (e.g. #5865F2 or \"clear\" to reset)')
                        .setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('show')
                .setDescription('Show current embed configuration')),
].map(c => c.toJSON());

// ──────────────────── Client Ready ────────────────────

client.once(Events.ClientReady, async (c) => {
    console.log('Logged in as ' + c.user.tag);

    if (!process.env.OWNER_ID) {
        console.warn('[WARN] OWNER_ID is not set! All owner-only commands will be locked for everyone.');
    }

    loadConfig();
    await deployCommands(c);
});

async function deployCommands(clientUser) {
    try {
        const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);

        if (process.env.GUILD_ID) {
            await rest.put(
                Routes.applicationGuildCommands(clientUser.id, process.env.GUILD_ID),
                { body: commandDefs },
            );
            console.log('Registered guild commands for ' + process.env.GUILD_ID);
        } else {
            await rest.put(
                Routes.applicationCommands(clientUser.id),
                { body: commandDefs },
            );
            console.log('Registered global commands (may take ~1 hour to appear)');
        }
        return true;
    } catch (err) {
        console.error('Failed to register commands:', err.message);
        return false;
    }
}

// ──────────────────── Interaction Handler ────────────────────

client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    if (!interaction.guild) {
        return interaction.reply({ content: 'This bot only works in servers.', ephemeral: true });
    }

    const { commandName, guild } = interaction;
    const guildConfig = getGuildConfig(guild.id);

    // ── Owner guard for all commands ──
    function ownerGuard() {
        if (!isOwner(interaction.user.id)) {
            interaction.reply({ content: '\u274C Only the bot owner can use this command.', ephemeral: true });
            return false;
        }
        return true;
    }

    // If it's not a public command, enforce owner-only
    const publicCommands = ['ping', 'status', 'botinfo', 'stats', 'worldcup'];
    if (!publicCommands.includes(commandName)) {
        if (!ownerGuard()) return;
    }

    // ── /ping ──
    if (commandName === 'ping') {
        const sent = await interaction.reply({ content: 'Pinging...', fetchReply: true });
        const rtt = sent.createdTimestamp - interaction.createdTimestamp;
        await interaction.editReply({
            content: [
                '**Pong!**',
                'WebSocket Heartbeat: `' + client.ws.ping + 'ms`',
                'Roundtrip Latency:   `' + rtt + 'ms`',
            ].join('\n'),
        });
        return;
    }

    // ── /status ──
    if (commandName === 'status') {
        const mem = process.memoryUsage();
        const uptime = formatUptime(client.uptime);
        const guildCount = client.guilds.cache.size;
        const userCount = client.guilds.cache.reduce((a, g) => a + g.memberCount, 0);

        let configInfo = 'No log channel set';
        if (guildConfig.logChannelId) {
            configInfo = 'Default log: <#' + guildConfig.logChannelId + '>';
        }
        const hasPerChannel = Object.values(guildConfig.logChannels).some(v => v);
        if (hasPerChannel) {
            const lines = Object.entries(guildConfig.logChannels)
                .filter(([, v]) => v)
                .map(([k, v]) => (CATEGORY_EMOJIS[k] || '\uD83D\uDD35') + ' ' + k + ': <#' + v + '>');
            configInfo = lines.join('\n');
        }
        const enabled = Object.entries(guildConfig.logCategories)
            .filter(([, v]) => v).map(([k]) => k).join(', ');
        if (enabled) configInfo += '\n\u2705 Enabled: ' + enabled;
        if (guildConfig.trackedChannels.length > 0) {
            configInfo += '\n\uD83D\uDCE1 Tracking: ' + guildConfig.trackedChannels.length + ' channel(s)';
        }

        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('\uD83D\uDCCA Bot Status')
            .setThumbnail(client.user.displayAvatarURL())
            .addFields(
                { name: 'Connection', value: WS_STATUS[client.ws.status] || 'Unknown', inline: true },
                { name: 'Ping', value: client.ws.ping + 'ms', inline: true },
                { name: 'Uptime', value: uptime, inline: true },
                { name: 'Servers', value: String(guildCount), inline: true },
                { name: 'Users', value: formatNumber(userCount), inline: true },
                { name: 'Commands', value: String(commandDefs.length) + ' total', inline: true },
                { name: 'Memory (RSS)', value: (mem.rss / 1024 / 1024).toFixed(1) + ' MB', inline: true },
                { name: 'Heap Used', value: (mem.heapUsed / 1024 / 1024).toFixed(1) + ' MB', inline: true },
                { name: 'CPU Cores', value: String(os.cpus().length), inline: true },
                { name: 'Platform', value: os.platform() + ' ' + os.arch(), inline: true },
                { name: 'Node.js', value: process.version, inline: true },
                { name: 'discord.js', value: 'v' + djsVersion, inline: true },
            )
            .setFooter({ text: guild.name, iconURL: guild.iconURL() })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
        return;
    }

    // ── /botinfo ──
    if (commandName === 'botinfo') {
        const embed = new EmbedBuilder()
            .setColor(0x9B59B6)
            .setAuthor({ name: client.user.username, iconURL: client.user.displayAvatarURL() })
            .setTitle('\u2139\uFE0F Bot Information')
            .addFields(
                { name: 'Name', value: client.user.tag, inline: true },
                { name: 'ID', value: client.user.id, inline: true },
                { name: 'Created', value: '<t:' + Math.floor(client.user.createdTimestamp / 1000) + ':R>', inline: true },
                { name: 'Servers', value: String(client.guilds.cache.size), inline: true },
                { name: 'Owner', value: '<@' + process.env.OWNER_ID + '>', inline: true },
                { name: 'Description', value: 'Discord server event logger \u2014 logs messages, reactions, members, roles, server changes, and voice events.' },
                { name: 'Tech Stack', value: 'Node.js ' + process.version + ' \u00B7 discord.js v' + djsVersion },
            )
            .setFooter({ text: guild.name, iconURL: guild.iconURL() })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
        return;
    }

    // ── /log ──
    if (commandName === 'log') {
        // Already guarded above (not in publicCommands)
        const sub = interaction.options.getSubcommand();

        if (sub === 'channel') {
            const type = interaction.options.getString('type');
            const channel = interaction.options.getChannel('channel');

            if (channel) {
                guildConfig.logChannels[type] = channel.id;
            } else {
                guildConfig.logChannels[type] = null;
            }
            const config = loadConfig();
            config[guild.id] = guildConfig;
            saveConfig(config);

            const emoji = CATEGORY_EMOJIS[type] || '\uD83D\uDD35';
            const embed = new EmbedBuilder()
                .setColor(channel ? 'Green' : 'Red')
                .setTitle(emoji + ' Log Channel: ' + type.charAt(0).toUpperCase() + type.slice(1))
                .setDescription(channel
                    ? '**' + type + '** logs will be sent to ' + channel
                    : '**' + type + '** log channel cleared (will use default)')
                .setFooter({ text: 'Changed by ' + interaction.user.tag })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        } else if (sub === 'toggle') {
            const category = interaction.options.getString('category');
            const enabled = interaction.options.getBoolean('enabled');
            guildConfig.logCategories[category] = enabled;
            const config = loadConfig();
            config[guild.id] = guildConfig;
            saveConfig(config);

            const status = enabled ? '\u2705 Enabled' : '\u274C Disabled';
            const embed = new EmbedBuilder()
                .setColor(enabled ? 'Green' : 'Red')
                .setTitle('\uD83D\uDD0D Log Category: ' + category.charAt(0).toUpperCase() + category.slice(1))
                .setDescription('**' + category + '** logs are now ' + status)
                .setFooter({ text: 'Changed by ' + interaction.user.tag })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        } else if (sub === 'list') {
            const lines = [];
            const cats = guildConfig.logCategories;
            const chs = guildConfig.logChannels;
            for (const c of LOG_CATEGORIES) {
                const emoji = CATEGORY_EMOJIS[c] || '\uD83D\uDD35';
                const toggle = cats[c] ? '\u2705' : '\u274C';
                const ch = chs[c] ? '<#' + chs[c] + '>' : '*default*';
                lines.push(toggle + ' ' + emoji + ' **' + c.charAt(0).toUpperCase() + c.slice(1) + '** \u2192 ' + ch);
            }
            if (guildConfig.logChannelId) {
                lines.push('\n\uD83D\uDCC0 **Default fallback:** <#' + guildConfig.logChannelId + '>');
            }
            if (guildConfig.trackedChannels.length > 0) {
                const tracked = guildConfig.trackedChannels.map(id => '<#' + id + '>').join(' ');
                lines.push('\uD83D\uDCE1 **Tracked channels:** ' + tracked);
            } else {
                lines.push('\uD83D\uDCE1 **Tracked channels:** All');
            }

            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle('\uD83D\uDD0D Logging Configuration')
                .setDescription(lines.join('\n'))
                .setFooter({ text: guild.name, iconURL: guild.iconURL() })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        }
        return;
    }

    // ── /track ──
    if (commandName === 'track') {
        const sub = interaction.options.getSubcommand();

        if (sub === 'add') {
            const channel = interaction.options.getChannel('channel');
            if (guildConfig.trackedChannels.includes(channel.id)) {
                return interaction.reply({ content: '\u26A0\uFE0F That channel is already being tracked.', ephemeral: true });
            }
            guildConfig.trackedChannels.push(channel.id);
            const config = loadConfig();
            config[guild.id] = guildConfig;
            saveConfig(config);

            const embed = new EmbedBuilder()
                .setColor('Green')
                .setTitle('\uD83D\uDCE1 Channel Added')
                .setDescription(channel + ' is now being tracked.')
                .setFooter({ text: 'Added by ' + interaction.user.tag })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        } else if (sub === 'remove') {
            const channel = interaction.options.getChannel('channel');
            const idx = guildConfig.trackedChannels.indexOf(channel.id);
            if (idx === -1) {
                return interaction.reply({ content: '\u26A0\uFE0F That channel is not being tracked.', ephemeral: true });
            }
            guildConfig.trackedChannels.splice(idx, 1);
            const config = loadConfig();
            config[guild.id] = guildConfig;
            saveConfig(config);

            const embed = new EmbedBuilder()
                .setColor('Red')
                .setTitle('\uD83D\uDCE1 Channel Removed')
                .setDescription(channel + ' is no longer being tracked.')
                .setFooter({ text: 'Removed by ' + interaction.user.tag })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        } else if (sub === 'list') {
            if (guildConfig.trackedChannels.length === 0) {
                return interaction.reply({ content: '\uD83D\uDCE1 Currently tracking **all channels**. Use `/track add` to restrict to specific channels.', ephemeral: false });
            }
            const list = guildConfig.trackedChannels.map(function(id) {
                return '<#' + id + '>';
            }).join('\n');
            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle('\uD83D\uDCE1 Tracked Channels (' + guildConfig.trackedChannels.length + ')')
                .setDescription(list)
                .setFooter({ text: guild.name, iconURL: guild.iconURL() })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        }
        return;
    }

    // ── /stats ──
    if (commandName === 'stats') {
        const sub = interaction.options.getSubcommand();

        if (sub === 'server') {
            const channels = guild.channels.cache;
            const bots = guild.members.cache.filter(function(m) { return m.user.bot; }).size;
            const humans = guild.members.cache.size - bots;
            const totalMembers = guild.memberCount;
            const boosts = guild.premiumSubscriptionCount || 0;
            const boostTier = guild.premiumTier;
            const tierNames = { 0: 'None', 1: 'Tier 1', 2: 'Tier 2', 3: 'Tier 3' };

            const textChannels = channels.filter(function(c) { return c.type === 0; }).size;
            const voiceChannels = channels.filter(function(c) { return c.type === 2; }).size;
            const categories = channels.filter(function(c) { return c.type === 4; }).size;
            const forums = channels.filter(function(c) { return c.type === 15; }).size;

            const embed = new EmbedBuilder()
                .setColor(0x00BFFF)
                .setAuthor({ name: guild.name, iconURL: guild.iconURL() })
                .setTitle('\uD83D\uDCCA Server Statistics')
                .setThumbnail(guild.iconURL({ size: 128 }))
                .addFields(
                    {
                        name: '\uD83D\uDC65 Members',
                        value: 'Total: **' + formatNumber(totalMembers) + '**'
                            + '\nCached: **' + formatNumber(guild.members.cache.size) + '**'
                            + '\nHumans: **' + formatNumber(humans) + '**'
                            + '\nBots: **' + formatNumber(bots) + '**',
                        inline: true,
                    },
                    {
                        name: '\uD83D\uDCFA Channels',
                        value: 'Text: **' + textChannels + '**'
                            + '\nVoice: **' + voiceChannels + '**'
                            + '\nCategories: **' + categories + '**'
                            + (forums > 0 ? '\nForums: **' + forums + '**' : ''),
                        inline: true,
                    },
                    {
                        name: '\uD83D\uDE80 Boosts',
                        value: 'Boost Count: **' + boosts + '**'
                            + '\nTier: **' + tierNames[boostTier] + '**',
                        inline: true,
                    },
                    { name: '\uD83D\uDCC5 Created', value: '<t:' + Math.floor(guild.createdTimestamp / 1000) + ':R>', inline: true },
                    { name: '\uD83C\uDFF7\uFE0F Roles', value: '**' + guild.roles.cache.size + '**', inline: true },
                    { name: '\uD83D\uDC64 Owner', value: '<@' + guild.ownerId + '>', inline: true },
                    { name: '\uD83C\uDF0D Server ID', value: guild.id, inline: true },
                )
                .setFooter({ text: 'Requested by ' + interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        }

        if (sub === 'growth') {
            const gStats = getGuildStats(guild.id);
            const netGrowth = gStats.totalJoins - gStats.totalLeaves;
            const snapshots = gStats.dailySnapshots;

            let recentJoins = 0;
            let recentLeaves = 0;
            for (let i = snapshots.length - 1; i >= 0; i--) {
                const daysAgo = (Date.now() - new Date(snapshots[i].date).getTime()) / 86400000;
                if (daysAgo > 7) break;
                recentJoins += snapshots[i].joins;
                recentLeaves += snapshots[i].leaves;
            }

            const last7 = snapshots.slice(-7).map(function(s) {
                const change = s.joins - s.leaves;
                const arrow = change > 0 ? '\u2191' : (change < 0 ? '\u2193' : '\u2192');
                return '`' + s.date.slice(5) + '` ' + arrow + ' +' + s.joins + ' -' + s.leaves + ' (' + (change > 0 ? '+' : '') + change + ')';
            }).join('\n');

            const currentMembers = guild.memberCount;

            const embed = new EmbedBuilder()
                .setColor(0x00BFFF)
                .setAuthor({ name: guild.name, iconURL: guild.iconURL() })
                .setTitle('\uD83D\uDCC8 Member Growth')
                .setThumbnail(guild.iconURL({ size: 128 }))
                .addFields(
                    {
                        name: '\uD83D\uDCCA Lifetime Totals',
                        value: 'Total Joins: **' + gStats.totalJoins + '**'
                            + '\nTotal Leaves: **' + gStats.totalLeaves + '**'
                            + '\nNet Growth: **' + (netGrowth >= 0 ? '+' : '') + netGrowth + '**'
                            + '\nCurrent: **' + formatNumber(currentMembers) + '** members',
                        inline: false,
                    },
                    {
                        name: '\uD83D\uDCC5 Last 7 Days',
                        value: 'Joins: **' + recentJoins + '** | Leaves: **' + recentLeaves + '**'
                            + '\nTrend: **' + (recentJoins - recentLeaves >= 0 ? '+' : '') + (recentJoins - recentLeaves) + '**',
                        inline: false,
                    },
                )
                .setFooter({ text: 'Requested by ' + interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
                .setTimestamp();

            if (last7) {
                embed.addFields({ name: '\uD83D\uDCC5 Daily Breakdown', value: last7 });
            } else {
                embed.addFields({ name: '\uD83D\uDCC5 Daily Breakdown', value: '*Not enough data yet \u2014 stats started tracking after this feature was added.*' });
            }

            await interaction.reply({ embeds: [embed] });
        }
        return;
    }

    // ── /role ──
    if (commandName === 'role') {
        const sub = interaction.options.getSubcommand();

        if (sub === 'add') {
            const target = interaction.options.getUser('user');
            const role = interaction.options.getRole('role');
            const member = await guild.members.fetch(target.id).catch(() => null);
            if (!member) {
                return interaction.reply({ content: '\u26A0\uFE0F Could not find that user in this server.', ephemeral: true });
            }

            // Permission checks
            if (!guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) {
                return interaction.reply({ content: '\u26A0\uFE0F I need the **Manage Roles** permission to do that.', ephemeral: true });
            }
            if (role.managed || role.id === guild.id) {
                return interaction.reply({ content: '\u26A0\uFE0F I cannot manage that role (it may be managed by an integration or be @everyone).', ephemeral: true });
            }
            if (guild.members.me.roles.highest.position <= role.position) {
                return interaction.reply({ content: '\u26A0\uFE0F That role is higher than or equal to my highest role. I cannot assign it.', ephemeral: true });
            }
            if (member.roles.cache.has(role.id)) {
                return interaction.reply({ content: '\u26A0\uFE0F ' + target + ' already has that role.', ephemeral: true });
            }

            await member.roles.add(role);
            const embed = new EmbedBuilder()
                .setColor('Green')
                .setTitle('\uD83C\uDFF7\uFE0F Role Added')
                .setDescription('Added **' + role.name + '** to ' + target)
                .setFooter({ text: 'By ' + interaction.user.tag })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        } else if (sub === 'remove') {
            const target = interaction.options.getUser('user');
            const role = interaction.options.getRole('role');
            const member = await guild.members.fetch(target.id).catch(() => null);
            if (!member) {
                return interaction.reply({ content: '\u26A0\uFE0F Could not find that user in this server.', ephemeral: true });
            }

            if (!guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) {
                return interaction.reply({ content: '\u26A0\uFE0F I need the **Manage Roles** permission to do that.', ephemeral: true });
            }
            if (role.managed || role.id === guild.id) {
                return interaction.reply({ content: '\u26A0\uFE0F I cannot manage that role.', ephemeral: true });
            }
            if (guild.members.me.roles.highest.position <= role.position) {
                return interaction.reply({ content: '\u26A0\uFE0F That role is higher than or equal to my highest role. I cannot remove it.', ephemeral: true });
            }
            if (!member.roles.cache.has(role.id)) {
                return interaction.reply({ content: '\u26A0\uFE0F ' + target + ' does not have that role.', ephemeral: true });
            }

            await member.roles.remove(role);
            const embed = new EmbedBuilder()
                .setColor('Red')
                .setTitle('\uD83C\uDFF7\uFE0F Role Removed')
                .setDescription('Removed **' + role.name + '** from ' + target)
                .setFooter({ text: 'By ' + interaction.user.tag })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        } else if (sub === 'list') {
            const targetUser = interaction.options.getUser('user') || interaction.user;
            const member = await guild.members.fetch(targetUser.id).catch(() => null);
            if (!member) {
                return interaction.reply({ content: '\u26A0\uFE0F Could not find that user in this server.', ephemeral: true });
            }

            const roles = member.roles.cache
                .filter(r => r.id !== guild.id)
                .sort((a, b) => b.position - a.position)
                .map(r => r.toString());

            const embed = new EmbedBuilder()
                .setColor(member.displayHexColor || 0x5865F2)
                .setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() })
                .setTitle('\uD83C\uDFF7\uFE0F ' + member.displayName + '\'s Roles')
                .setDescription(roles.length > 0 ? roles.join('\n') : '*No roles*')
                .setFooter({ text: 'Total: ' + roles.length + ' role(s)' })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        }
        return;
    }

    // ── /purge ──
    if (commandName === 'purge') {
        const amount = interaction.options.getInteger('amount');

        if (!guild.members.me.permissions.has(PermissionFlagsBits.ManageMessages)) {
            return interaction.reply({ content: '\u26A0\uFE0F I need the **Manage Messages** permission to purge messages.', ephemeral: true });
        }

        // Check that the channel is a text-based channel
        if (!interaction.channel.isTextBased?.()) {
            return interaction.reply({ content: '\u26A0\uFE0F This command can only be used in text channels.', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            const fetched = await interaction.channel.bulkDelete(amount, true);
            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle('\uD83E\uDDF9 Messages Purged')
                .setDescription('Deleted **' + fetched.size + '** message(s) in ' + interaction.channel)
                .setFooter({ text: 'By ' + interaction.user.tag })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            await interaction.editReply({ content: '\u26A0\uFE0F Failed to purge messages: ' + err.message });
        }
        return;
    }

    // ── /slowmode ──
    if (commandName === 'slowmode') {
        const seconds = interaction.options.getInteger('seconds');
        const channel = interaction.options.getChannel('channel') || interaction.channel;

        if (!guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return interaction.reply({ content: '\u26A0\uFE0F I need the **Manage Channels** permission to change slowmode.', ephemeral: true });
        }

        try {
            await channel.setRateLimitPerUser(seconds);
            const embed = new EmbedBuilder()
                .setColor(seconds > 0 ? 0xF1C40F : 'Green')
                .setTitle('\u23F3 Slowmode Updated')
                .setDescription('Slowmode in ' + channel + ' set to **' + seconds + '** second' + (seconds !== 1 ? 's' : ''))
                .setFooter({ text: 'By ' + interaction.user.tag })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        } catch (err) {
            await interaction.reply({ content: '\u26A0\uFE0F Failed to set slowmode: ' + err.message, ephemeral: true });
        }
        return;
    }

    // ── /nickname ──
    if (commandName === 'nickname') {
        const target = interaction.options.getUser('user');
        const nickname = interaction.options.getString('nickname');
        const member = await guild.members.fetch(target.id).catch(() => null);
        if (!member) {
            return interaction.reply({ content: '\u26A0\uFE0F Could not find that user in this server.', ephemeral: true });
        }

        if (!guild.members.me.permissions.has(PermissionFlagsBits.ManageNicknames)) {
            return interaction.reply({ content: '\u26A0\uFE0F I need the **Manage Nicknames** permission to change nicknames.', ephemeral: true });
        }
        if (guild.members.me.roles.highest.position <= member.roles.highest.position && guild.ownerId !== client.user.id) {
            return interaction.reply({ content: '\u26A0\uFE0F That user has a higher role than me. I cannot change their nickname.', ephemeral: true });
        }

        try {
            const newNick = nickname.toLowerCase() === 'reset' ? null : nickname;
            await member.setNickname(newNick);
            const embed = new EmbedBuilder()
                .setColor('Green')
                .setTitle('\uD83D\uDCDD Nickname Changed')
                .setDescription(target + '\'s nickname is now **' + (newNick || '*none*') + '**')
                .setFooter({ text: 'By ' + interaction.user.tag })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        } catch (err) {
            await interaction.reply({ content: '\u26A0\uFE0F Failed to change nickname: ' + err.message, ephemeral: true });
        }
        return;
    }

    // ── /say ──
    if (commandName === 'say') {
        const channel = interaction.options.getChannel('channel');
        const message = interaction.options.getString('message');

        if (!channel.isTextBased?.()) {
            return interaction.reply({ content: '\u26A0\uFE0F Please select a text channel.', ephemeral: true });
        }

        try {
            await channel.send(message);
            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle('\uD83D\uDCAC Message Sent')
                .setDescription('Message sent to ' + channel)
                .addFields({ name: 'Content', value: truncate(message, 1024) })
                .setFooter({ text: 'By ' + interaction.user.tag })
                .setTimestamp();

            await interaction.reply({ embeds: [embed], ephemeral: true });
        } catch (err) {
            await interaction.reply({ content: '\u26A0\uFE0F Failed to send message: ' + err.message, ephemeral: true });
        }
        return;
    }

    // ── /embed ──
    if (commandName === 'embed') {
        const channel = interaction.options.getChannel('channel');
        const title = interaction.options.getString('title');
        const description = interaction.options.getString('description') || '';
        const colorStr = interaction.options.getString('color') || '#5865F2';

        if (!channel.isTextBased?.()) {
            return interaction.reply({ content: '\u26A0\uFE0F Please select a text channel.', ephemeral: true });
        }

        let color = 0x5865F2;
        try {
            color = parseInt(colorStr.replace('#', ''), 16);
        } catch { /* use default */ }

        try {
            const embed = new EmbedBuilder()
                .setColor(color)
                .setTitle(title)
                .setDescription(description)
                .setFooter({ text: 'Sent by ' + interaction.user.tag })
                .setTimestamp();

            await channel.send({ embeds: [embed] });
            await interaction.reply({
                content: '\u2705 Embed sent to ' + channel,
                ephemeral: true,
            });
        } catch (err) {
            await interaction.reply({ content: '\u26A0\uFE0F Failed to send embed: ' + err.message, ephemeral: true });
        }
        return;
    }

    // ── /userinfo ──
    if (commandName === 'userinfo') {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const member = await guild.members.fetch(targetUser.id).catch(() => null);

        const sharedServers = client.guilds.cache.filter(g => g.members.cache.has(targetUser.id)).size;

        const roles = member
            ? member.roles.cache.filter(r => r.id !== guild.id).sort((a, b) => b.position - a.position).map(r => r.toString())
            : [];

        const embed = new EmbedBuilder()
            .setColor(member ? member.displayHexColor : 0x5865F2)
            .setAuthor({ name: targetUser.tag, iconURL: targetUser.displayAvatarURL() })
            .setTitle('\uD83D\uDC64 User Information')
            .setThumbnail(targetUser.displayAvatarURL({ size: 128 }))
            .addFields(
                { name: 'Username', value: targetUser.tag, inline: true },
                { name: 'ID', value: targetUser.id, inline: true },
                { name: 'Bot', value: targetUser.bot ? 'Yes' : 'No', inline: true },
                { name: 'Created', value: '<t:' + Math.floor(targetUser.createdTimestamp / 1000) + ':R>', inline: true },
                { name: 'Shared Servers', value: String(sharedServers), inline: true },
            );

        if (member) {
            embed.addFields(
                { name: 'Joined Server', value: '<t:' + Math.floor(member.joinedTimestamp / 1000) + ':R>', inline: true },
            );
            if (roles.length > 0) {
                embed.addFields({ name: 'Roles (' + roles.length + ')', value: truncate(roles.join(', '), 1024) });
            }
        }

        embed.setFooter({ text: 'Requested by ' + interaction.user.tag })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
        return;
    }

    // ── /avatar ──
    if (commandName === 'avatar') {
        const targetUser = interaction.options.getUser('user') || interaction.user;

        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setAuthor({ name: targetUser.tag, iconURL: targetUser.displayAvatarURL() })
            .setTitle('\uD83D\uDCF7 Avatar')
            .setImage(targetUser.displayAvatarURL({ size: 1024, forceStatic: false }))
            .setFooter({ text: 'Requested by ' + interaction.user.tag })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
        return;
    }

    // ── /deploy ──
    if (commandName === 'deploy') {
        await interaction.deferReply({ ephemeral: true });
        const success = await deployCommands(client.user);
        if (success) {
            await interaction.editReply({ content: '\u2705 Slash commands re-registered successfully!' });
        } else {
            await interaction.editReply({ content: '\u26A0\uFE0F Failed to re-register commands. Check the console for details.' });
        }
        return;
    }

    // ════════════════════════════════════════════════════════════
    //                  WORLD CUP PREDICT (PUBLIC)
    // ════════════════════════════════════════════════════════════

    // ── /worldcup ──
    if (commandName === 'worldcup') {
        let team1 = interaction.options.getString('team1');
        let team2 = interaction.options.getString('team2');

        const flag1 = getFlag(team1);
        const flag2 = getFlag(team2);

        const score1 = Math.floor(Math.random() * 6); // 0-5
        const score2 = Math.floor(Math.random() * 6); // 0-5

        const scoreDisplay = score1 + ' - ' + score2;

        const outcomes = [
            'What a match!',
            'The crowd goes wild!',
            'A thrilling encounter!',
            'Absolute nail-biter!',
            'Total football on display!',
            'A historic result!',
            'Shock result of the tournament!',
            'The underdogs prevail!',
            'A masterclass performance!',
            'They\'re dancing in the streets!',
        ];
        const outcome = outcomes[Math.floor(Math.random() * outcomes.length)];

        const embed = makeEmbed({
            color: 0x00FF87,
            title: '⚽ World Cup Match Prediction',
            description: [
                flag1 + ' **' + team1 + '**  vs  **' + team2 + '** ' + flag2,
                '',
                '**Predicted Score**',
                '# ' + flag1 + '  ' + score1 + ' - ' + score2 + '  ' + flag2,
                '',
                '_' + outcome + '_',
            ].join('\n'),
            footer: { text: 'Predicted by ' + interaction.user.tag, iconURL: interaction.user.displayAvatarURL() },
            timestamp: true,
        });

        await interaction.reply({ embeds: [embed] });
        return;
    }

    // ════════════════════════════════════════════════════════════
    //              BOT CUSTOMIZATION (OWNER ONLY)
    // ════════════════════════════════════════════════════════════

    // ── /presence ──
    if (commandName === 'presence') {
        const type = interaction.options.getString('type');
        const text = interaction.options.getString('text');

        const activityTypes = {
            playing: 0,
            watching: 3,
            listening: 2,
            competing: 5,
        };

        try {
            client.user.setPresence({
                activities: [{
                    name: text,
                    type: activityTypes[type] || 0,
                }],
                status: 'online',
            });

            const embed = makeEmbed({
                color: 'Green',
                title: '🎮 Presence Updated',
                description: 'Bot is now **' + type + '** \"' + text + '\"',
                footer: { text: 'Changed by ' + interaction.user.tag },
                timestamp: true,
            });

            await interaction.reply({ embeds: [embed] });
        } catch (err) {
            await interaction.reply({ content: '\u26A0\uFE0F Failed to set presence: ' + err.message, ephemeral: true });
        }
        return;
    }

    // ── /botavatar ──
    if (commandName === 'botavatar') {
        const url = interaction.options.getString('url');

        await interaction.deferReply({ ephemeral: false });

        try {
            await client.user.setAvatar(url);
            const embed = makeEmbed({
                color: 'Green',
                title: '🖼️ Avatar Changed',
                description: 'Bot avatar has been updated!',
                image: url,
                footer: { text: 'Changed by ' + interaction.user.tag },
                timestamp: true,
            });
            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            await interaction.editReply({ content: '\u26A0\uFE0F Failed to change avatar: ' + err.message + '\nMake sure the URL is a direct image link (e.g. ending in .png/.jpg/.gif).' });
        }
        return;
    }

    // ── /botname ──
    if (commandName === 'botname') {
        const name = interaction.options.getString('name');

        if (name.length > 32) {
            return interaction.reply({ content: '\u26A0\uFE0F Username must be 32 characters or less.', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: false });

        try {
            const oldName = client.user.username;
            await client.user.setUsername(name);
            const embed = makeEmbed({
                color: 'Green',
                title: '✏️ Username Changed',
                description: 'Bot name changed from **' + oldName + '** to **' + name + '**',
                footer: { text: 'Changed by ' + interaction.user.tag },
                timestamp: true,
            });
            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            await interaction.editReply({ content: '\u26A0\uFE0F Failed to change username: ' + err.message + '\nNote: Discord limits username changes to 2 per hour.' });
        }
        return;
    }

    // ── /embedconfig ──
    if (commandName === 'embedconfig') {
        const sub = interaction.options.getSubcommand();

        if (sub === 'footer') {
            const text = interaction.options.getString('text') || null;
            const icon = interaction.options.getString('icon') || null;

            saveBotConfig({ embedFooterText: text, embedFooterIcon: icon });

            if (text) {
                const embed = makeEmbed({
                    color: 'Green',
                    title: '📝 Embed Footer Set',
                    description: 'Custom footer: \"' + text + '\"' + (icon ? '\nWith icon: ' + icon : ''),
                    footer: { text: 'Changed by ' + interaction.user.tag },
                    timestamp: true,
                });
                await interaction.reply({ embeds: [embed] });
            } else {
                const embed = makeEmbed({
                    color: 'Red',
                    title: '🗑️ Embed Footer Cleared',
                    description: 'Custom embed footer has been removed.',
                    footer: { text: 'Changed by ' + interaction.user.tag },
                    timestamp: true,
                });
                await interaction.reply({ embeds: [embed] });
            }
        } else if (sub === 'color') {
            const hexRaw = interaction.options.getString('hex');

            if (hexRaw.toLowerCase() === 'clear' || hexRaw.toLowerCase() === 'reset') {
                saveBotConfig({ embedColor: null });
                const embed = makeEmbed({
                    color: 0x5865F2,
                    title: '🎨 Embed Color Reset',
                    description: 'Default embed color restored to Discord Blurple.',
                    footer: { text: 'Changed by ' + interaction.user.tag },
                    timestamp: true,
                });
                await interaction.reply({ embeds: [embed] });
                return;
            }

            let color = 0x5865F2;
            try {
                color = parseInt(hexRaw.replace('#', ''), 16);
                if (isNaN(color) || color < 0 || color > 0xFFFFFF) throw new Error();
            } catch {
                return interaction.reply({ content: '\u26A0\uFE0F Invalid hex color! Use format like `#5865F2` or `FF5733` (without #).', ephemeral: true });
            }

            saveBotConfig({ embedColor: color });

            const embed = makeEmbed({
                color: color,
                title: '🎨 Embed Color Updated',
                description: 'Default embed color set to `#' + color.toString(16).toUpperCase().padStart(6, '0') + '`',
                footer: { text: 'Changed by ' + interaction.user.tag },
                timestamp: true,
            });
            await interaction.reply({ embeds: [embed] });
        } else if (sub === 'show') {
            const botCfg = getBotConfig();
            const lines = [];
            lines.push('**Footer Text:** ' + (botCfg.embedFooterText || '*Not set*'));
            lines.push('**Footer Icon:** ' + (botCfg.embedFooterIcon || '*Not set*'));
            lines.push('**Embed Color:** ' + (botCfg.embedColor ? '`#' + botCfg.embedColor.toString(16).toUpperCase().padStart(6, '0') + '`' : '*Default (Blurple)*'));

            const embed = makeEmbed({
                color: botCfg.embedColor || 0x5865F2,
                title: '⚙️ Embed Configuration',
                description: lines.join('\n'),
                footer: { text: guild.name, iconURL: guild.iconURL() },
                timestamp: true,
            });
            await interaction.reply({ embeds: [embed] });
        }
        return;
    }
});

// ════════════════════════════════════════════════════════════
//                       LOG EVENT HANDLERS
// ════════════════════════════════════════════════════════════

// ──────────────────── Reaction Added ────────────────────

client.on(Events.MessageReactionAdd, async (reaction, user) => {
    if (reaction.partial) await reaction.fetch();
    if (user.bot) return;

    const msg = reaction.message;
    if (msg.partial) await msg.fetch();
    if (!msg.guild) return;

    const contentSnippet = msg.content
        ? truncate(msg.content, 200)
        : msg.attachments.size > 0
            ? '*[Attachment]*'
            : '*No text*';

    const embed = new EmbedBuilder()
        .setColor(0x2ECC71)
        .setAuthor({ name: user.tag, iconURL: user.displayAvatarURL() })
        .setTitle('\u2795 Reaction Added')
        .setDescription(user + ' reacted with ' + emojiToString(reaction.emoji))
        .setThumbnail(user.displayAvatarURL({ size: 64 }))
        .addFields(
            { name: 'Channel', value: String(msg.channel), inline: true },
            { name: 'Author', value: String(msg.author), inline: true },
            { name: 'Total', value: String(reaction.count) + ' reaction' + (reaction.count !== 1 ? 's' : ''), inline: true },
            { name: 'Content', value: '```' + contentSnippet + '```' },
            { name: 'Jump', value: '[View Message](' + msg.url + ')' },
        )
        .setFooter({ text: '#' + msg.channel.name + ' \u00B7 ' + msg.guild.name, iconURL: msg.guild.iconURL() })
        .setTimestamp();

    sendLog(embed, 'reactions', msg.channelId, msg.guild.id);
});

// ──────────────────── Reaction Removed ────────────────────

client.on(Events.MessageReactionRemove, async (reaction, user) => {
    if (reaction.partial) await reaction.fetch();
    if (user.bot) return;

    const msg = reaction.message;
    if (!msg.guild) return;

    const embed = new EmbedBuilder()
        .setColor(0xE74C3C)
        .setAuthor({ name: user.tag, iconURL: user.displayAvatarURL() })
        .setTitle('\u2796 Reaction Removed')
        .setDescription(user + ' removed their ' + emojiToString(reaction.emoji) + ' reaction')
        .setThumbnail(user.displayAvatarURL({ size: 64 }))
        .addFields(
            { name: 'Channel', value: String(msg.channel), inline: true },
            { name: 'Remaining', value: String(reaction.count) + ' reaction' + (reaction.count !== 1 ? 's' : ''), inline: true },
            { name: 'Jump', value: '[View Message](' + msg.url + ')' },
        )
        .setFooter({ text: '#' + msg.channel.name + ' \u00B7 ' + msg.guild.name, iconURL: msg.guild.iconURL() })
        .setTimestamp();

    sendLog(embed, 'reactions', msg.channelId, msg.guild.id);
});

// ──────────────────── Message Deleted ────────────────────

client.on(Events.MessageDelete, (message) => {
    if (message.partial) return;
    if (!message.author || message.author.bot) return;
    if (!message.guild) return;

    const attachments = message.attachments.map(function(a) {
        return '[' + a.name + '](' + a.url + ')';
    });
    const attachmentText = attachments.length > 0 ? truncate(attachments.join('\n'), 1024) : null;
    const wasReply = message.reference ? ' (Reply)' : '';

    const embed = new EmbedBuilder()
        .setColor(0x992D22)
        .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
        .setTitle('\uD83D\uDDD1\uFE0F Message Deleted' + wasReply)
        .setThumbnail(message.author.displayAvatarURL({ size: 64 }))
        .addFields(
            { name: 'Author', value: String(message.author), inline: true },
            { name: 'Channel', value: String(message.channel), inline: true },
            { name: 'Sent', value: message.createdTimestamp ? '<t:' + Math.floor(message.createdTimestamp / 1000) + ':R>' : '*Unknown*', inline: true },
            { name: 'Content', value: truncate(message.content || '*No text (maybe an image)*') },
        )
        .setFooter({ text: '#' + message.channel.name + ' \u00B7 ID: ' + message.id, iconURL: message.guild.iconURL() })
        .setTimestamp();

    if (attachmentText) {
        embed.addFields({ name: 'Attachments', value: attachmentText });
    }

    sendLog(embed, 'messages', message.channelId, message.guild.id);
});

// ──────────────────── Message Edited ────────────────────

client.on(Events.MessageUpdate, (oldMessage, newMessage) => {
    if (oldMessage.partial || (oldMessage.author && oldMessage.author.bot)) return;
    if (!oldMessage.guild) return;
    if (oldMessage.content === newMessage.content) return;

    const attachments = newMessage.attachments.map(function(a) {
        return '[' + a.name + '](' + a.url + ')';
    });
    const attachmentText = attachments.length > 0 ? truncate(attachments.join('\n'), 1024) : null;

    const embed = new EmbedBuilder()
        .setColor(0xF1C40F)
        .setAuthor({ name: oldMessage.author.tag, iconURL: oldMessage.author.displayAvatarURL() })
        .setTitle('\u270F\uFE0F Message Edited')
        .setThumbnail(oldMessage.author.displayAvatarURL({ size: 64 }))
        .addFields(
            { name: 'Author', value: String(oldMessage.author), inline: true },
            { name: 'Channel', value: String(oldMessage.channel), inline: true },
            { name: 'Sent', value: oldMessage.createdTimestamp ? '<t:' + Math.floor(oldMessage.createdTimestamp / 1000) + ':R>' : '*Unknown*', inline: true },
            { name: 'Before', value: truncate(oldMessage.content || '*Empty*') },
            { name: 'After', value: truncate(newMessage.content || '*Empty*') },
            { name: 'Jump', value: '[Click Here](' + newMessage.url + ')' },
        )
        .setFooter({ text: '#' + oldMessage.channel.name + ' \u00B7 ID: ' + oldMessage.id, iconURL: oldMessage.guild.iconURL() })
        .setTimestamp();

    if (attachmentText) {
        embed.addFields({ name: 'Attachments', value: attachmentText });
    }

    sendLog(embed, 'messages', oldMessage.channelId, oldMessage.guild.id);
});

// ──────────────────── Member Joined ────────────────────

client.on(Events.GuildMemberAdd, (member) => {
    if (member.user.bot) return;

    recordJoin(member.guild.id);

    const daysSinceCreation = Math.floor((Date.now() - member.user.createdTimestamp) / 86400000);
    const isNewAccount = daysSinceCreation < 7;
    const ageWarning = isNewAccount
        ? '\n\u26A0\uFE0F **Warning: Account is only ' + daysSinceCreation + ' day' + (daysSinceCreation === 1 ? '' : 's') + ' old**'
        : '';

    const embed = new EmbedBuilder()
        .setColor(0x3498DB)
        .setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() })
        .setTitle('\uD83D\uDC4B Member Joined')
        .setDescription(member.user + ' joined the server')
        .setThumbnail(member.user.displayAvatarURL({ size: 128 }))
        .addFields(
            {
                name: '\uD83D\uDD10 Account Info',
                value: 'Created: <t:' + Math.floor(member.user.createdTimestamp / 1000) + ':R>'
                    + '\nAge: ' + daysSinceCreation + ' day' + (daysSinceCreation === 1 ? '' : 's')
                    + ageWarning,
            },
            { name: '\uD83D\uDCC5 Joined Server', value: '<t:' + Math.floor(Date.now() / 1000) + ':R>', inline: true },
            { name: '\uD83D\uDC65 Member Count', value: String(member.guild.memberCount), inline: true },
            { name: '\uD83D\uDC64 User ID', value: member.user.id, inline: true },
        )
        .setFooter({ text: member.guild.name, iconURL: member.guild.iconURL() })
        .setTimestamp();

    sendLog(embed, 'members', null, member.guild.id);
});

// ──────────────────── Member Left ────────────────────

client.on(Events.GuildMemberRemove, (member) => {
    if (member.user.bot) return;

    recordLeave(member.guild.id);

    const daysSinceCreation = Math.floor((Date.now() - member.user.createdTimestamp) / 86400000);
    const membershipDuration = member.joinedAt
        ? formatUptime(Date.now() - member.joinedAt.getTime())
        : '*Unknown*';

    const embed = new EmbedBuilder()
        .setColor(0xE67E22)
        .setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() })
        .setTitle('\uD83D\uDEAA Member Left')
        .setDescription(member.user + ' has left the server')
        .setThumbnail(member.user.displayAvatarURL({ size: 128 }))
        .addFields(
            {
                name: '\uD83D\uDD10 Account Info',
                value: 'Created: <t:' + Math.floor(member.user.createdTimestamp / 1000) + ':R>'
                    + '\nAge: ' + daysSinceCreation + ' day' + (daysSinceCreation === 1 ? '' : 's'),
            },
            {
                name: '\uD83D\uDC4B Membership',
                value: 'Joined: ' + (member.joinedAt ? '<t:' + Math.floor(member.joinedAt.getTime() / 1000) + ':R>' : '*Unknown*')
                    + '\nWas here: ' + membershipDuration,
                inline: true,
            },
            { name: '\uD83D\uDC65 Member Count', value: String(member.guild.memberCount), inline: true },
            { name: '\uD83D\uDC64 User ID', value: member.user.id, inline: true },
        )
        .setFooter({ text: member.guild.name, iconURL: member.guild.iconURL() })
        .setTimestamp();

    const roles = member.roles.cache
        .filter(function(r) { return r.id !== r.guild.id; })
        .map(function(r) { return r.name; });
    if (roles.length > 0) {
        embed.addFields({ name: '\uD83C\uDFF7\uFE0F Roles (' + roles.length + ')', value: truncate(roles.join(', '), 1024) });
    }

    sendLog(embed, 'members', null, member.guild.id);
});

// ──────────────────── NEW: Role Logs ────────────────────

client.on(Events.GuildMemberUpdate, (oldMember, newMember) => {
    if (oldMember.user.bot) return;
    if (!oldMember.guild) return;
    if (oldMember.partial) return;

    const oldRoles = oldMember.roles.cache;
    const newRoles = newMember.roles.cache;

    // Roles added
    const added = newRoles.filter(role => !oldRoles.has(role.id) && role.id !== role.guild.id);
    // Roles removed
    const removed = oldRoles.filter(role => !newRoles.has(role.id) && role.id !== role.guild.id);

    if (added.size > 0) {
        for (const [, role] of added) {
            const embed = new EmbedBuilder()
                .setColor(role.hexColor || 0x2ECC71)
                .setAuthor({ name: newMember.user.tag, iconURL: newMember.user.displayAvatarURL() })
                .setTitle('\uD83C\uDFF7\uFE0F Role Added')
                .setDescription(newMember.user + ' was given the **' + role.name + '** role')
                .setThumbnail(newMember.user.displayAvatarURL({ size: 64 }))
                .addFields(
                    { name: 'User', value: String(newMember.user), inline: true },
                    { name: 'Role', value: role.toString(), inline: true },
                    { name: 'Role ID', value: role.id, inline: true },
                )
                .setFooter({ text: newMember.guild.name, iconURL: newMember.guild.iconURL() })
                .setTimestamp();

            sendLog(embed, 'roles', null, newMember.guild.id);
        }
    }

    if (removed.size > 0) {
        for (const [, role] of removed) {
            const embed = new EmbedBuilder()
                .setColor(0xE74C3C)
                .setAuthor({ name: newMember.user.tag, iconURL: newMember.user.displayAvatarURL() })
                .setTitle('\uD83C\uDFF7\uFE0F Role Removed')
                .setDescription(newMember.user + ' lost the **' + role.name + '** role')
                .setThumbnail(newMember.user.displayAvatarURL({ size: 64 }))
                .addFields(
                    { name: 'User', value: String(newMember.user), inline: true },
                    { name: 'Role', value: role.name, inline: true },
                    { name: 'Role ID', value: role.id, inline: true },
                )
                .setFooter({ text: newMember.guild.name, iconURL: newMember.guild.iconURL() })
                .setTimestamp();

            sendLog(embed, 'roles', null, newMember.guild.id);
        }
    }
});

// ──────────────────── NEW: Server Logs (Channels) ────────────────────

client.on(Events.ChannelCreate, (channel) => {
    if (!channel.guild) return;
    const typeNames = { 0: 'Text', 2: 'Voice', 4: 'Category', 5: 'Announcement', 13: 'Stage', 15: 'Forum' };
    const typeName = typeNames[channel.type] || 'Unknown';

    const embed = new EmbedBuilder()
        .setColor(0x2ECC71)
        .setTitle('\uD83D\uDCE6 Channel Created')
        .setDescription('A new **' + typeName + '** channel was created')
        .addFields(
            { name: 'Name', value: channel.name, inline: true },
            { name: 'Type', value: typeName, inline: true },
            { name: 'Channel', value: channel.toString(), inline: true },
            { name: 'ID', value: channel.id, inline: true },
        )
        .setFooter({ text: channel.guild.name, iconURL: channel.guild.iconURL() })
        .setTimestamp();

    sendLog(embed, 'server', null, channel.guild.id);
});

client.on(Events.ChannelDelete, (channel) => {
    if (!channel.guild) return;
    const typeNames = { 0: 'Text', 2: 'Voice', 4: 'Category', 5: 'Announcement', 13: 'Stage', 15: 'Forum' };
    const typeName = typeNames[channel.type] || 'Unknown';

    const embed = new EmbedBuilder()
        .setColor(0xE74C3C)
        .setTitle('\uD83D\uDCE6 Channel Deleted')
        .setDescription('A **' + typeName + '** channel was deleted')
        .addFields(
            { name: 'Name', value: channel.name, inline: true },
            { name: 'Type', value: typeName, inline: true },
            { name: 'ID', value: channel.id, inline: true },
        )
        .setFooter({ text: channel.guild.name, iconURL: channel.guild.iconURL() })
        .setTimestamp();

    sendLog(embed, 'server', null, channel.guild.id);
});

client.on(Events.ChannelUpdate, (oldChannel, newChannel) => {
    if (!newChannel.guild) return;
    if (oldChannel.name === newChannel.name) return;

    const embed = new EmbedBuilder()
        .setColor(0xF1C40F)
        .setTitle('\uD83D\uDCE6 Channel Renamed')
        .setDescription('A channel was renamed')
        .addFields(
            { name: 'Before', value: oldChannel.name || '*Unknown*', inline: true },
            { name: 'After', value: newChannel.name, inline: true },
            { name: 'Channel', value: newChannel.toString(), inline: true },
            { name: 'ID', value: newChannel.id, inline: true },
        )
        .setFooter({ text: newChannel.guild.name, iconURL: newChannel.guild.iconURL() })
        .setTimestamp();

    sendLog(embed, 'server', null, newChannel.guild.id);
});

// ──────────────────── NEW: Voice Logs ────────────────────

client.on(Events.VoiceStateUpdate, (oldState, newState) => {
    const user = newState.member?.user || oldState.member?.user;
    if (!user || user.bot) return;
    if (!oldState.guild) return;

    const guild = oldState.guild || newState.guild;

    // Joined voice
    if (!oldState.channelId && newState.channelId) {
        const embed = new EmbedBuilder()
            .setColor(0x2ECC71)
            .setAuthor({ name: user.tag, iconURL: user.displayAvatarURL() })
            .setTitle('\uD83C\uDFA4 Voice Joined')
            .setDescription(user + ' joined voice channel **' + newState.channel.name + '**')
            .setThumbnail(user.displayAvatarURL({ size: 64 }))
            .addFields(
                { name: 'Channel', value: newState.channel.toString(), inline: true },
                { name: 'User', value: String(user), inline: true },
            )
            .setFooter({ text: guild.name, iconURL: guild.iconURL() })
            .setTimestamp();

        sendLog(embed, 'voice', null, guild.id);
    }
    // Left voice
    else if (oldState.channelId && !newState.channelId) {
        const embed = new EmbedBuilder()
            .setColor(0xE74C3C)
            .setAuthor({ name: user.tag, iconURL: user.displayAvatarURL() })
            .setTitle('\uD83C\uDFA4 Voice Left')
            .setDescription(user + ' left voice channel **' + oldState.channel.name + '**')
            .setThumbnail(user.displayAvatarURL({ size: 64 }))
            .addFields(
                { name: 'Channel', value: oldState.channel.toString(), inline: true },
                { name: 'User', value: String(user), inline: true },
            )
            .setFooter({ text: guild.name, iconURL: guild.iconURL() })
            .setTimestamp();

        sendLog(embed, 'voice', null, guild.id);
    }
    // Moved voice
    else if (oldState.channelId !== newState.channelId) {
        const embed = new EmbedBuilder()
            .setColor(0xF1C40F)
            .setAuthor({ name: user.tag, iconURL: user.displayAvatarURL() })
            .setTitle('\uD83C\uDFA4 Voice Moved')
            .setDescription(user + ' moved from **' + oldState.channel.name + '** to **' + newState.channel.name + '**')
            .setThumbnail(user.displayAvatarURL({ size: 64 }))
            .addFields(
                { name: 'From', value: oldState.channel.toString(), inline: true },
                { name: 'To', value: newState.channel.toString(), inline: true },
                { name: 'User', value: String(user), inline: true },
            )
            .setFooter({ text: guild.name, iconURL: guild.iconURL() })
            .setTimestamp();

        sendLog(embed, 'voice', null, guild.id);
    }
});

// ──────────────────── Login ────────────────────

client.login(process.env.BOT_TOKEN);