const { REST, Routes, SlashCommandBuilder } = require('discord.js');

// ──────────────────── All Command Definitions ────────────────────

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

    // ── Log Config (owner only) ──
    new SlashCommandBuilder()
        .setName('log')
        .setDescription('Configure logging')
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
                            { name: 'Threads', value: 'threads' },
                            { name: 'Emojis', value: 'emojis' },
                            { name: 'Bans', value: 'bans' },
                            { name: 'Invites', value: 'invites' },
                            { name: 'Stickers', value: 'stickers' },
                            { name: 'Auto Mod', value: 'automod' },
                            { name: 'Scheduled', value: 'scheduled' },
                            { name: 'Stage', value: 'stage' },
                            { name: 'Webhooks', value: 'webhooks' },
                            { name: 'Integrations', value: 'integrations' },
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
                            { name: 'Threads', value: 'threads' },
                            { name: 'Emojis', value: 'emojis' },
                            { name: 'Bans', value: 'bans' },
                            { name: 'Invites', value: 'invites' },
                            { name: 'Stickers', value: 'stickers' },
                            { name: 'Auto Mod', value: 'automod' },
                            { name: 'Scheduled', value: 'scheduled' },
                            { name: 'Stage', value: 'stage' },
                            { name: 'Webhooks', value: 'webhooks' },
                            { name: 'Integrations', value: 'integrations' },
                        ))
                .addBooleanOption(opt =>
                    opt.setName('enabled')
                        .setDescription('Enable or disable')
                        .setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('Show current logging configuration')),

    // ── Track channels (owner only) ──
    new SlashCommandBuilder()
        .setName('track')
        .setDescription('Manage tracked channels')
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

    // ── Stats (public) ──
    new SlashCommandBuilder()
        .setName('stats')
        .setDescription('View server statistics')
        .addSubcommand(sub =>
            sub.setName('server')
                .setDescription('Show live server stats'))
        .addSubcommand(sub =>
            sub.setName('growth')
                .setDescription('Show member growth over time')),

    // ── Role management (owner only) ──
    new SlashCommandBuilder()
        .setName('role')
        .setDescription('Manage roles')
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

    // ── Moderation (owner only) ──
    new SlashCommandBuilder()
        .setName('purge')
        .setDescription('Bulk delete messages')
        .addIntegerOption(opt =>
            opt.setName('amount')
                .setDescription('Number of messages (1-100)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(100)),
    new SlashCommandBuilder()
        .setName('slowmode')
        .setDescription('Set channel slowmode')
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
        .setDescription("Change a user's nickname")
        .addUserOption(opt =>
            opt.setName('user')
                .setDescription('The user')
                .setRequired(true))
        .addStringOption(opt =>
            opt.setName('nickname')
                .setDescription('New nickname (or "reset" to clear)')
                .setRequired(true)),

    // ── New Moderation Commands (owner only) ──
    new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Kick a member from the server')
        .addUserOption(opt =>
            opt.setName('user')
                .setDescription('The user to kick')
                .setRequired(true))
        .addStringOption(opt =>
            opt.setName('reason')
                .setDescription('Reason for the kick')
                .setRequired(false)),
    new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Ban a member from the server')
        .addUserOption(opt =>
            opt.setName('user')
                .setDescription('The user to ban')
                .setRequired(true))
        .addStringOption(opt =>
            opt.setName('reason')
                .setDescription('Reason for the ban')
                .setRequired(false))
        .addStringOption(opt =>
            opt.setName('delete_messages')
                .setDescription('Delete recent messages')
                .setRequired(false)
                .addChoices(
                    { name: "Don't delete any", value: 'none' },
                    { name: 'Past hour', value: 'hour' },
                    { name: 'Past 6 hours', value: '6hours' },
                    { name: 'Past 24 hours', value: '24hours' },
                )),
    new SlashCommandBuilder()
        .setName('unban')
        .setDescription('Unban a user by their ID')
        .addStringOption(opt =>
            opt.setName('user_id')
                .setDescription('The ID of the user to unban')
                .setRequired(true)),
    new SlashCommandBuilder()
        .setName('timeout')
        .setDescription('Timeout a member')
        .addUserOption(opt =>
            opt.setName('user')
                .setDescription('The user to timeout')
                .setRequired(true))
        .addStringOption(opt =>
            opt.setName('duration')
                .setDescription('Duration of the timeout')
                .setRequired(true)
                .addChoices(
                    { name: '60 seconds', value: '60s' },
                    { name: '5 minutes', value: '5m' },
                    { name: '10 minutes', value: '10m' },
                    { name: '1 hour', value: '1h' },
                    { name: '6 hours', value: '6h' },
                    { name: '24 hours', value: '24h' },
                    { name: '3 days', value: '3d' },
                    { name: '7 days', value: '7d' },
                ))
        .addStringOption(opt =>
            opt.setName('reason')
                .setDescription('Reason for the timeout')
                .setRequired(false)),
    new SlashCommandBuilder()
        .setName('untimeout')
        .setDescription('Remove a timeout from a member')
        .addUserOption(opt =>
            opt.setName('user')
                .setDescription('The user to remove timeout from')
                .setRequired(true)),
    new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Warn a member')
        .addUserOption(opt =>
            opt.setName('user')
                .setDescription('The user to warn')
                .setRequired(true))
        .addStringOption(opt =>
            opt.setName('reason')
                .setDescription('Reason for the warning (or leave blank to use the interactive form)')
                .setRequired(false)),
    new SlashCommandBuilder()
        .setName('warnings')
        .setDescription('View warnings for a member')
        .addUserOption(opt =>
            opt.setName('user')
                .setDescription('The user to check')
                .setRequired(true)),
    new SlashCommandBuilder()
        .setName('clearwarnings')
        .setDescription('Clear all warnings for a member')
        .addUserOption(opt =>
            opt.setName('user')
                .setDescription('The user to clear warnings for')
                .setRequired(true)),
    new SlashCommandBuilder()
        .setName('lock')
        .setDescription('Lock a channel')
        .addChannelOption(opt =>
            opt.setName('channel')
                .setDescription('Channel to lock (defaults to current)')
                .setRequired(false)),
    new SlashCommandBuilder()
        .setName('unlock')
        .setDescription('Unlock a channel')
        .addChannelOption(opt =>
            opt.setName('channel')
                .setDescription('Channel to unlock (defaults to current)')
                .setRequired(false)),
    new SlashCommandBuilder()
        .setName('poll')
        .setDescription('Create a poll')
        .addStringOption(opt =>
            opt.setName('question')
                .setDescription('The poll question')
                .setRequired(true))
        .addStringOption(opt =>
            opt.setName('option1')
                .setDescription('First option')
                .setRequired(true))
        .addStringOption(opt =>
            opt.setName('option2')
                .setDescription('Second option')
                .setRequired(true))
        .addStringOption(opt =>
            opt.setName('option3')
                .setDescription('Third option')
                .setRequired(false))
        .addStringOption(opt =>
            opt.setName('option4')
                .setDescription('Fourth option')
                .setRequired(false))
        .addBooleanOption(opt =>
            opt.setName('multi')
                .setDescription('Allow voting for multiple options')
                .setRequired(false))
        .addBooleanOption(opt =>
            opt.setName('anonymous')
                .setDescription('Hide who voted for what')
                .setRequired(false)),
    new SlashCommandBuilder()
        .setName('announce')
        .setDescription('Send an announcement to a channel')
        .addChannelOption(opt =>
            opt.setName('channel')
                .setDescription('Channel to send the announcement to')
                .setRequired(true))
        .addStringOption(opt =>
            opt.setName('title')
                .setDescription('Announcement title')
                .setRequired(true))
        .addStringOption(opt =>
            opt.setName('message')
                .setDescription('Announcement message')
                .setRequired(true))
        .addStringOption(opt =>
            opt.setName('color')
                .setDescription('Hex color (e.g. #FF0000)')
                .setRequired(false))
        .addBooleanOption(opt =>
            opt.setName('ping')
                .setDescription('Ping @everyone')
                .setRequired(false)),

    // ── Utility (owner only) ──
    new SlashCommandBuilder()
        .setName('say')
        .setDescription('Make the bot say something')
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
        .setDescription('Send an embedded message')
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
        .setDescription("Get info about a user")
        .addUserOption(opt =>
            opt.setName('user')
                .setDescription('The user (defaults to you)')
                .setRequired(false)),
    new SlashCommandBuilder()
        .setName('avatar')
        .setDescription("Get a user's avatar")
        .addUserOption(opt =>
            opt.setName('user')
                .setDescription('The user (defaults to you)')
                .setRequired(false)),
    new SlashCommandBuilder()
        .setName('deploy')
        .setDescription('Re-register all slash commands'),

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

    // ── Fun Commands (public) ──
    new SlashCommandBuilder()
        .setName('8ball')
        .setDescription('Ask the magic 8-ball a question')
        .addStringOption(opt =>
            opt.setName('question')
                .setDescription('Your question')
                .setRequired(true)),
    new SlashCommandBuilder()
        .setName('coinflip')
        .setDescription('Flip a coin'),
    new SlashCommandBuilder()
        .setName('dice')
        .setDescription('Roll a dice')
        .addIntegerOption(opt =>
            opt.setName('sides')
                .setDescription('Number of sides (default: 6)')
                .setRequired(false)
                .setMinValue(2)
                .setMaxValue(100)),
    new SlashCommandBuilder()
        .setName('rps')
        .setDescription('Play rock-paper-scissors')
        .addStringOption(opt =>
            opt.setName('choice')
                .setDescription('Your choice')
                .setRequired(true)
                .addChoices(
                    { name: 'Rock', value: 'rock' },
                    { name: 'Paper', value: 'paper' },
                    { name: 'Scissors', value: 'scissors' },
                )),
    new SlashCommandBuilder()
        .setName('joke')
        .setDescription('Get a random joke'),
    new SlashCommandBuilder()
        .setName('fact')
        .setDescription('Get a random interesting fact'),
    new SlashCommandBuilder()
        .setName('advice')
        .setDescription('Get a random piece of advice'),
    new SlashCommandBuilder()
        .setName('quote')
        .setDescription('Get a random inspirational quote'),
    new SlashCommandBuilder()
        .setName('reverse')
        .setDescription('Reverse some text')
        .addStringOption(opt =>
            opt.setName('text')
                .setDescription('Text to reverse')
                .setRequired(true)),
    new SlashCommandBuilder()
        .setName('mock')
        .setDescription('Mock some text (Spongebob case)')
        .addStringOption(opt =>
            opt.setName('text')
                .setDescription('Text to mock')
                .setRequired(true)),
    new SlashCommandBuilder()
        .setName('random')
        .setDescription('Generate a random number')
        .addIntegerOption(opt =>
            opt.setName('min')
                .setDescription('Minimum value')
                .setRequired(true))
        .addIntegerOption(opt =>
            opt.setName('max')
                .setDescription('Maximum value')
                .setRequired(true)),

    // ── Reminders (public) ──
    new SlashCommandBuilder()
        .setName('remindme')
        .setDescription('Set a reminder (you will be DMed when the time is up)')
        .addStringOption(opt =>
            opt.setName('time')
                .setDescription('When to remind you (e.g. 30s, 5m, 2h, 1d, or 1h30m)')
                .setRequired(true))
        .addStringOption(opt =>
            opt.setName('text')
                .setDescription('What to remind you about')
                .setRequired(true)),
    new SlashCommandBuilder()
        .setName('reminders')
        .setDescription('Manage your reminders')
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('List all your active reminders'))
        .addSubcommand(sub =>
            sub.setName('cancel')
                .setDescription('Cancel a reminder by its ID')
                .addStringOption(opt =>
                    opt.setName('id')
                        .setDescription('The reminder ID (use /reminders list)')
                        .setRequired(true))),

    // ── Bot Customization (owner only) ──
    new SlashCommandBuilder()
        .setName('presence')
        .setDescription("Set the bot's activity status")
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
        .setDescription("Change the bot's avatar")
        .addStringOption(opt =>
            opt.setName('url')
                .setDescription('Direct image URL for the new avatar')
                .setRequired(true)),
    new SlashCommandBuilder()
        .setName('botname')
        .setDescription("Change the bot's username")
        .addStringOption(opt =>
            opt.setName('name')
                .setDescription('New username (max 32 chars)')
                .setRequired(true)),
    new SlashCommandBuilder()
        .setName('embedconfig')
        .setDescription('Configure embed appearance')
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
                        .setDescription('Hex color (e.g. #5865F2 or "clear" to reset)')
                        .setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('show')
                .setDescription('Show current embed configuration')),

    // ── Permissions (owner only) ──
    new SlashCommandBuilder()
        .setName('perm')
        .setDescription('Manage user permissions for commands')
        .addSubcommand(sub =>
            sub.setName('grant')
                .setDescription('Grant a user access to a command')
                .addUserOption(opt =>
                    opt.setName('user')
                        .setDescription('The user to grant access to')
                        .setRequired(true))
                .addStringOption(opt =>
                    opt.setName('command')
                        .setDescription('The command to grant access to')
                        .setRequired(true)
                        .addChoices(
                            { name: 'all', value: 'all' },
                            { name: 'role', value: 'role' },
                            { name: 'purge', value: 'purge' },
                            { name: 'slowmode', value: 'slowmode' },
                            { name: 'nickname', value: 'nickname' },
                            { name: 'kick', value: 'kick' },
                            { name: 'ban', value: 'ban' },
                            { name: 'unban', value: 'unban' },
                            { name: 'timeout', value: 'timeout' },
                            { name: 'untimeout', value: 'untimeout' },
                            { name: 'warn', value: 'warn' },
                            { name: 'warnings', value: 'warnings' },
                            { name: 'clearwarnings', value: 'clearwarnings' },
                            { name: 'lock', value: 'lock' },
                            { name: 'unlock', value: 'unlock' },
                            { name: 'say', value: 'say' },
                            { name: 'embed', value: 'embed' },
                            { name: 'userinfo', value: 'userinfo' },
                            { name: 'avatar', value: 'avatar' },
                            { name: 'track', value: 'track' },
                            { name: 'log', value: 'log' },
                            { name: 'poll', value: 'poll' },
                            { name: 'announce', value: 'announce' },
                            { name: 'reactionrole', value: 'reactionrole' },
                        )))
        .addSubcommand(sub =>
            sub.setName('revoke')
                .setDescription('Revoke a user\'s access to a command')
                .addUserOption(opt =>
                    opt.setName('user')
                        .setDescription('The user to revoke access from')
                        .setRequired(true))
                .addStringOption(opt =>
                    opt.setName('command')
                        .setDescription('The command to revoke access from')
                        .setRequired(true)
                        .addChoices(
                            { name: 'all', value: 'all' },
                            { name: 'role', value: 'role' },
                            { name: 'purge', value: 'purge' },
                            { name: 'slowmode', value: 'slowmode' },
                            { name: 'nickname', value: 'nickname' },
                            { name: 'kick', value: 'kick' },
                            { name: 'ban', value: 'ban' },
                            { name: 'unban', value: 'unban' },
                            { name: 'timeout', value: 'timeout' },
                            { name: 'untimeout', value: 'untimeout' },
                            { name: 'warn', value: 'warn' },
                            { name: 'warnings', value: 'warnings' },
                            { name: 'clearwarnings', value: 'clearwarnings' },
                            { name: 'lock', value: 'lock' },
                            { name: 'unlock', value: 'unlock' },
                            { name: 'say', value: 'say' },
                            { name: 'embed', value: 'embed' },
                            { name: 'userinfo', value: 'userinfo' },
                            { name: 'avatar', value: 'avatar' },
                            { name: 'track', value: 'track' },
                            { name: 'log', value: 'log' },
                            { name: 'poll', value: 'poll' },
                            { name: 'announce', value: 'announce' },
                            { name: 'reactionrole', value: 'reactionrole' },
                        )))
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('List all granted permissions'))
        .addSubcommand(sub =>
            sub.setName('user')
                .setDescription('Check a user\'s permissions')
                .addUserOption(opt =>
                    opt.setName('user')
                        .setDescription('The user to check')
                        .setRequired(true))),

    // ── Dashboard link (owner only) ──
    new SlashCommandBuilder()
        .setName('dashboard')
        .setDescription('Get the link to the web dashboard'),

    // ── Dashboard Access (owner only) ──
    new SlashCommandBuilder()
        .setName('dashaccess')
        .setDescription('Manage who can access the dashboard via Discord ID')
        .addSubcommand(sub =>
            sub.setName('add')
                .setDescription('Grant a user dashboard access')
                .addUserOption(opt =>
                    opt.setName('user')
                        .setDescription('The user to grant access')
                        .setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('remove')
                .setDescription('Revoke dashboard access from a user')
                .addUserOption(opt =>
                    opt.setName('user')
                        .setDescription('The user to revoke dashboard access from')
                        .setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('List all users with dashboard access')),

    // ── Server Leave (owner only) ──
    new SlashCommandBuilder()
        .setName('server_leave')
        .setDescription('Force the bot to leave a server by ID (owner only)')
        .addStringOption(opt =>
            opt.setName('server_id')
                .setDescription('The ID of the server to leave')
                .setRequired(true)),

    // ── Shutdown (owner only) ──
    new SlashCommandBuilder()
        .setName('shutdown')
        .setDescription('Turn off the bot gracefully (owner only)'),

    // ── Prefix ──
    new SlashCommandBuilder()
        .setName('prefix')
        .setDescription('View or change the command prefix for this server')
        .addStringOption(opt =>
            opt.setName('new_prefix')
                .setDescription('New prefix (leave empty to see current)')
                .setRequired(false)),

    // ── Reaction Roles (owner only) ──
    new SlashCommandBuilder()
        .setName('reactionrole')
        .setDescription('Manage self-assignable reaction roles')
        .addSubcommand(sub =>
            sub.setName('add')
                .setDescription('Create a new reaction role message')
                .addChannelOption(opt =>
                    opt.setName('channel')
                        .setDescription('The channel to send the message in')
                        .setRequired(true))
                .addRoleOption(opt =>
                    opt.setName('role')
                        .setDescription('The role to assign')
                        .setRequired(true))
                .addStringOption(opt =>
                    opt.setName('emoji')
                        .setDescription('The emoji to react with (e.g. ✅ or custom emoji)')
                        .setRequired(true))
                .addStringOption(opt =>
                    opt.setName('label')
                        .setDescription('Optional label for this role')
                        .setRequired(false))
                .addStringOption(opt =>
                    opt.setName('description')
                        .setDescription('Optional description text')
                        .setRequired(false)))
        .addSubcommand(sub =>
            sub.setName('remove')
                .setDescription('Remove all reaction roles for a message')
                .addStringOption(opt =>
                    opt.setName('message_id')
                        .setDescription('The message ID of the reaction role')
                        .setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('List all reaction roles on this server')),
].map(c => c.toJSON());

// ──────────────────── Deploy Function ────────────────────

async function deployCommands(clientUser) {
    const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);

    // Try guild-specific deploy first (instant updates)
    if (process.env.GUILD_ID) {
        try {
            await rest.put(
                Routes.applicationGuildCommands(clientUser.id, process.env.GUILD_ID),
                { body: commandDefs },
            );
            console.log('\u2705 Registered ' + commandDefs.length + ' commands for guild ' + process.env.GUILD_ID);
            // Also deploy globally so commands work in other servers
            try {
                await rest.put(
                    Routes.applicationCommands(clientUser.id),
                    { body: commandDefs },
                );
                console.log('\u2705 Also deployed globally for other servers.');
            } catch (globalErr) {
                // Global deploy is non-critical if guild deploy succeeded
                console.log('\u26A0\uFE0F Global deploy optional, guild commands are live.');
            }
            return true;
        } catch (guildErr) {
            const guildMsg = guildErr.rawError?.message || guildErr.message || 'Unknown error';
            console.error('\u26A0\uFE0F Guild deploy failed (' + guildMsg + '). Falling back to global deploy...');
            // Fall through to global deploy
        }
    }

    // Global deploy (works regardless of GUILD_ID)
    try {
        await rest.put(
            Routes.applicationCommands(clientUser.id),
            { body: commandDefs },
        );
        const guildNote = process.env.GUILD_ID ? ' (GUILD_ID is set but guild deploy failed)' : '';
        console.log('\u26A0\uFE0F Registered ' + commandDefs.length + ' global commands. They may take ~1 hour to appear in Discord.' + guildNote);
        console.log('\uD83D\uDC41\uFE0F Tip: For instant updates, set GUILD_ID to a server ID your bot is in.');
        if (process.env.GUILD_ID) {
            console.log('\u274C Your GUILD_ID (' + process.env.GUILD_ID + ') may be wrong or the bot lacks the applications.commands scope in that server.');
        }
        return true;
    } catch (err) {
        const msg = err.rawError?.message || err.message || 'Unknown error';
        const code = err.rawError?.code || '';
        console.error('\u274C Failed to register commands:', msg);
        if (err.rawError?.errors) {
            try { console.error('Detailed errors:', JSON.stringify(err.rawError.errors, null, 2).slice(0, 2000)); } catch {}
        }
        return 'Discord API: ' + msg + (code ? ' (code ' + code + ')' : '');
    }
}

module.exports = { commandDefs, deployCommands };
