require('dotenv').config();
const {
    Client, GatewayIntentBits, Events, Partials, EmbedBuilder,
    REST, Routes, SlashCommandBuilder, version: djsVersion
} = require('discord.js');
const os = require('os');
const fs = require('fs');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessageReactions
    ],
    partials: [
        Partials.Message,
        Partials.Channel,
        Partials.Reaction
    ]
});

// --- Config Manager ---

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

function getGuildConfig(guildId) {
    const config = loadConfig();
    if (!config[guildId]) {
        config[guildId] = {
            logChannelId: null,
            trackedChannels: [],
            logCategories: {
                reactions: true,
                messages: true,
                members: true
            }
        };
        saveConfig(config);
    }
    return config[guildId];
}

// --- Stats Manager ---

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
        stats[guildId] = {
            totalJoins: 0,
            totalLeaves: 0,
            dailySnapshots: [],
            lastSnapshotDate: ''
        };
    }
    stats[guildId].totalJoins++;
    
    // Daily snapshot
    const today = new Date().toISOString().slice(0, 10);
    const snapshots = stats[guildId].dailySnapshots;
    const lastSnap = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
    
    if (lastSnap && lastSnap.date === today) {
        lastSnap.joins++;
    } else {
        snapshots.push({ date: today, joins: 1, leaves: 0 });
        // Keep only last 90 days
        if (snapshots.length > 90) snapshots.shift();
    }
    
    saveStats(stats);
}

function recordLeave(guildId) {
    const stats = loadStats();
    if (!stats[guildId]) {
        stats[guildId] = {
            totalJoins: 0,
            totalLeaves: 0,
            dailySnapshots: [],
            lastSnapshotDate: ''
        };
    }
    stats[guildId].totalLeaves++;
    
    // Daily snapshot
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

// --- Helpers ---

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

// --- Log Channel ---

async function sendLog(embed, category, channelId, guildId) {
    // Use provided guildId, or fallback to env var
    if (!guildId) {
        try {
            let channel = client.channels.cache.get(process.env.LOG_CHANNEL_ID);
            if (!channel) channel = await client.channels.fetch(process.env.LOG_CHANNEL_ID).catch(() => null);
            if (channel) await channel.send({ embeds: [embed] });
        } catch (err) {}
        return;
    }
    
    const guildConfig = getGuildConfig(guildId);
    
    // Check category is enabled
    if (category && guildConfig.logCategories[category] === false) return;
    
    // Check channel is tracked (if trackedChannels is non-empty)
    if (channelId && guildConfig.trackedChannels.length > 0) {
        if (!guildConfig.trackedChannels.includes(channelId)) return;
    }
    
    // Get log channel (config takes priority, then env var)
    const logChannelId = guildConfig.logChannelId || process.env.LOG_CHANNEL_ID;
    if (!logChannelId) return;
    
    try {
        let channel = client.channels.cache.get(logChannelId);
        if (!channel) channel = await client.channels.fetch(logChannelId).catch(() => null);
        if (channel) {
            await channel.send({ embeds: [embed] });
        }
    } catch (err) {
        console.error('[sendLog] Failed:', err.message);
    }
}

// --- Slash Commands ---

const commandDefs = [
    new SlashCommandBuilder()
        .setName('ping')
        .setDescription("Check the bot's latency"),
    new SlashCommandBuilder()
        .setName('status')
        .setDescription("Show the bot's status, resources, and stats"),
    new SlashCommandBuilder()
        .setName('botinfo')
        .setDescription('Show information about this bot'),
    new SlashCommandBuilder()
        .setName('setlog')
        .setDescription('Set the log channel (owner only)')
        .addChannelOption(opt =>
            opt.setName('channel')
                .setDescription('The channel to send logs to')
                .setRequired(true)),
    new SlashCommandBuilder()
        .setName('log')
        .setDescription('Configure log categories (owner only)')
        .addSubcommand(sub =>
            sub.setName('toggle')
                .setDescription('Enable or disable a log category')
                .addStringOption(opt =>
                    opt.setName('category')
                        .setDescription('Category to toggle')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Reactions', value: 'reactions' },
                            { name: 'Messages', value: 'messages' },
                            { name: 'Members', value: 'members' },
                        ))
                .addBooleanOption(opt =>
                    opt.setName('enabled')
                        .setDescription('Enable or disable')
                        .setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('Show current log category settings')),
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
].map(c => c.toJSON());

client.once(Events.ClientReady, async (c) => {
    console.log('Logged in as ' + c.user.tag);
    
    if (!process.env.OWNER_ID) {
        console.warn('[WARN] OWNER_ID is not set! Config commands (/setlog, /log, /track) will be locked for everyone.');
    }
    
    loadConfig();

    try {
        const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);

        if (process.env.GUILD_ID) {
            await rest.put(
                Routes.applicationGuildCommands(c.user.id, process.env.GUILD_ID),
                { body: commandDefs },
            );
            console.log('Registered guild commands for ' + process.env.GUILD_ID);
        } else {
            await rest.put(
                Routes.applicationCommands(c.user.id),
                { body: commandDefs },
            );
            console.log('Registered global commands (may take ~1 hour to appear)');
        }
    } catch (err) {
        console.error('Failed to register commands:', err.message);
    }
});

client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    if (!interaction.guild) {
        return interaction.reply({ content: 'This bot only works in servers.', ephemeral: true });
    }

    const { commandName, guild } = interaction;
    const guildConfig = getGuildConfig(guild.id);

    // --- Owner-only guard for config commands ---
    function ownerGuard() {
        if (!isOwner(interaction.user.id)) {
            interaction.reply({ content: '❌ Only the bot owner can use this command.', ephemeral: true });
            return false;
        }
        return true;
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

        const config = loadConfig();
        let configInfo = 'No log channel set';
        if (guildConfig.logChannelId) {
            configInfo = 'Log channel: <#' + guildConfig.logChannelId + '>';
            const enabled = Object.entries(guildConfig.logCategories)
                .filter(([, v]) => v).map(([k]) => k).join(', ');
            configInfo += '\nCategories: ' + enabled;
            if (guildConfig.trackedChannels.length > 0) {
                configInfo += '\nTracking: ' + guildConfig.trackedChannels.length + ' channel(s)';
            }
        }

        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('📊 Bot Status')
            .setThumbnail(client.user.displayAvatarURL())
            .addFields(
                { name: 'Connection', value: WS_STATUS[client.ws.status] || 'Unknown', inline: true },
                { name: 'Ping', value: client.ws.ping + 'ms', inline: true },
                { name: 'Uptime', value: uptime, inline: true },
                { name: 'Servers', value: String(guildCount), inline: true },
                { name: 'Users', value: formatNumber(userCount), inline: true },
                { name: 'Commands', value: '`/ping` `/status` `/botinfo`', inline: true },
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
            .setTitle('ℹ️ Bot Information')
            .addFields(
                { name: 'Name', value: client.user.tag, inline: true },
                { name: 'ID', value: client.user.id, inline: true },
                { name: 'Created', value: '<t:' + Math.floor(client.user.createdTimestamp / 1000) + ':R>', inline: true },
                { name: 'Servers', value: String(client.guilds.cache.size), inline: true },
                { name: 'Owner', value: '<@' + process.env.OWNER_ID + '>', inline: true },
                { name: 'Description', value: 'Discord server event logger \u2014 logs message edits, deletions, reactions, and member changes.' },
                { name: 'Tech Stack', value: 'Node.js ' + process.version + ' \u00B7 discord.js v' + djsVersion },
            )
            .setFooter({ text: guild.name, iconURL: guild.iconURL() })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
        return;
    }

    // ── /setlog ──
    if (commandName === 'setlog') {
        if (!ownerGuard()) return;
        const channel = interaction.options.getChannel('channel');
        guildConfig.logChannelId = channel.id;
        const config = loadConfig();
        config[guild.id] = guildConfig;
        saveConfig(config);

        const embed = new EmbedBuilder()
            .setColor('Green')
            .setTitle('✅ Log Channel Set')
            .setDescription('All logs will now be sent to ' + channel)
            .setFooter({ text: 'Changed by ' + interaction.user.tag })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
        return;
    }

    // ── /log ──
    if (commandName === 'log') {
        if (!ownerGuard()) return;
        const sub = interaction.options.getSubcommand();

        if (sub === 'toggle') {
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
            const cats = guildConfig.logCategories;
            const lines = Object.entries(cats).map(function(e) {
                return (e[1] ? '\u2705' : '\u274C') + ' ' + e[0].charAt(0).toUpperCase() + e[0].slice(1);
            });
            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle('\uD83D\uDD0D Log Categories')
                .setDescription(lines.join('\n'))
                .setFooter({ text: guild.name, iconURL: guild.iconURL() })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        }
        return;
    }

    // ── /track ──
    if (commandName === 'track') {
        if (!ownerGuard()) return;
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

        // ── /stats server ──
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

        // ── /stats growth ──
        if (sub === 'growth') {
            const gStats = getGuildStats(guild.id);
            const netGrowth = gStats.totalJoins - gStats.totalLeaves;
            const snapshots = gStats.dailySnapshots;

            // Calculate last 7 days trend
            let recentJoins = 0;
            let recentLeaves = 0;
            for (let i = snapshots.length - 1; i >= 0; i--) {
                const daysAgo = (Date.now() - new Date(snapshots[i].date).getTime()) / 86400000;
                if (daysAgo > 7) break;
                recentJoins += snapshots[i].joins;
                recentLeaves += snapshots[i].leaves;
            }

            // Build daily breakdown (last 7 days)
            const last7 = snapshots.slice(-7).map(function(s) {
                const change = s.joins - s.leaves;
                const arrow = change > 0 ? '\u2191' : (change < 0 ? '\u2193' : '\u2192');
                return '`' + s.date.slice(5) + '` ' + arrow + ' +' + s.joins + ' -' + s.leaves + ' (' + (change > 0 ? '+' : '') + change + ')';
            }).join('\n');

            const currentMembers = guild.memberCount;

            const embed = new EmbedBuilder()
                .setColor(0x00BFFF)
                .setAuthor({ name: guild.name, iconURL: guild.iconURL() })
                .setTitle('\uD83D\udCC8 Member Growth')
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
                embed.addFields({ name: '\uD83D\uDCC5 Daily Breakdown', value: '*Not enough data yet — stats started tracking after this feature was added.*' });
            }

            await interaction.reply({ embeds: [embed] });
        }
        return;
    }
});

// --- Reaction Added ---

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
        .setTitle('➕ Reaction Added')
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

// --- Reaction Removed ---

client.on(Events.MessageReactionRemove, async (reaction, user) => {
    if (reaction.partial) await reaction.fetch();
    if (user.bot) return;

    const msg = reaction.message;
    if (!msg.guild) return;

    const embed = new EmbedBuilder()
        .setColor(0xE74C3C)
        .setAuthor({ name: user.tag, iconURL: user.displayAvatarURL() })
        .setTitle('➖ Reaction Removed')
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

// --- Message Deleted ---

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

// --- Message Edited ---

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

// --- Member Joined ---

client.on(Events.GuildMemberAdd, (member) => {
    if (member.user.bot) return;
    
    // Record stats
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

// --- Member Left ---

client.on(Events.GuildMemberRemove, (member) => {
    if (member.user.bot) return;
    
    // Record stats
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

// --- Login ---

client.login(process.env.BOT_TOKEN);

