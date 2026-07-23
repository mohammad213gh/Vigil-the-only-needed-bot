const { EmbedBuilder } = require('discord.js');

// ──────────────────── Command Categories ────────────────────

const CATEGORIES = [
    {
        name: 'Info',
        emoji: 'ℹ️',
        public: true,
        commands: [
            { name: 'ping', desc: "Check the bot's latency" },
            { name: 'status', desc: "Show the bot's status and stats" },
            { name: 'botinfo', desc: 'Show information about this bot' },
            { name: 'userinfo', desc: "Get info about a user" },
            { name: 'avatar', desc: "Get a user's avatar" },
            { name: 'stats', desc: 'View server/growth statistics' },
        ],
    },
    {
        name: 'Fun',
        emoji: '🎮',
        public: true,
        commands: [
            { name: 'worldcup', desc: 'Predict a World Cup match score' },
            { name: '8ball', desc: 'Ask the magic 8-ball a question' },
            { name: 'coinflip', desc: 'Flip a coin' },
            { name: 'dice', desc: 'Roll a dice' },
            { name: 'rps', desc: 'Play rock-paper-scissors' },
            { name: 'joke', desc: 'Get a random joke' },
            { name: 'fact', desc: 'Get a random interesting fact' },
            { name: 'advice', desc: 'Get a random piece of advice' },
            { name: 'quote', desc: 'Get a random inspirational quote' },
            { name: 'reverse', desc: 'Reverse some text' },
            { name: 'mock', desc: 'Mock some text (Spongebob case)' },
            { name: 'random', desc: 'Generate a random number' },
        ],
    },
    {
        name: 'Reminders',
        emoji: '⏰',
        public: true,
        commands: [
            { name: 'remindme', desc: 'Set a reminder (DMed when time is up)' },
            { name: 'reminders', desc: 'Manage your reminders' },
        ],
    },
    {
        name: 'Admin',
        emoji: '🛠️',
        public: false,
        commands: [
            { name: 'role', desc: 'Manage roles (add/remove/list)' },
            { name: 'purge', desc: 'Bulk delete messages (1-100)' },
            { name: 'slowmode', desc: 'Set channel slowmode' },
            { name: 'nickname', desc: "Change a user's nickname" },
            { name: 'say', desc: 'Make the bot say something' },
            { name: 'embed', desc: 'Send an embedded message' },
            { name: 'deploy', desc: 'Re-register all slash commands' },
            { name: 'track', desc: 'Manage tracked channels' },
            { name: 'poll', desc: 'Create a poll with up to 4 options' },
            { name: 'announce', desc: 'Send an announcement' },
        ],
    },
    {
        name: 'Moderation',
        emoji: '🛡️',
        public: false,
        commands: [
            { name: 'kick', desc: 'Kick a member from the server' },
            { name: 'ban', desc: 'Ban a member from the server' },
            { name: 'unban', desc: 'Unban a user by ID' },
            { name: 'timeout', desc: 'Timeout a member' },
            { name: 'untimeout', desc: 'Remove a timeout' },
            { name: 'warn', desc: 'Warn a member (with interactive form)' },
            { name: 'warnings', desc: 'View warnings for a member' },
            { name: 'clearwarnings', desc: 'Clear all warnings for a member' },
            { name: 'lock', desc: 'Lock a channel' },
            { name: 'unlock', desc: 'Unlock a channel' },
        ],
    },
    {
        name: 'Config',
        emoji: '⚙️',
        public: false,
        commands: [
            { name: 'log', desc: 'Configure logging channels & categories' },
            { name: 'embedconfig', desc: 'Configure embed appearance' },
            { name: 'presence', desc: "Set the bot's activity status" },
            { name: 'botavatar', desc: "Change the bot's avatar" },
            { name: 'botname', desc: "Change the bot's username" },
            { name: 'prefix', desc: 'View or change the command prefix' },
        ],
    },
    {
        name: 'Permissions',
        emoji: '🔐',
        public: false,
        commands: [
            { name: 'perm', desc: 'Manage command permissions for users' },
        ],
    },
    {
        name: 'Reaction Roles',
        emoji: '🌟',
        public: false,
        commands: [
            { name: 'reactionrole', desc: 'Manage self-assignable roles' },
        ],
    },
    {
        name: 'Welcome / Goodbye',
        emoji: '👋',
        public: false,
        commands: [
            { name: 'welcome', desc: 'Configure welcome messages' },
            { name: 'goodbye', desc: 'Configure goodbye messages' },
        ],
    },
    {
        name: 'Owner',
        emoji: '👑',
        public: false,
        commands: [
            { name: 'dashboard', desc: 'Get the link to the web dashboard' },
            { name: 'dashaccess', desc: 'Manage dashboard user access' },
            { name: 'server_leave', desc: 'Force bot to leave a server' },
            { name: 'shutdown', desc: 'Turn off the bot gracefully' },
        ],
    },
];

// ──────────────────── executeHelp ────────────────────

async function executeHelp(interaction) {
    const query = interaction.options.getString('command');
    const cat = interaction.options.getString('category');

    // If a specific command name was provided, show detailed help for that command
    if (query) {
        return showCommandDetail(interaction, query.toLowerCase());
    }

    // If a category was provided (e.g., /help category:moderation), show that category
    if (cat) {
        return showCategory(interaction, cat);
    }

    // Otherwise show the full categorized overview
    return showOverview(interaction);
}

// ──────────────────── Show Overview (all categories) ────────────────────

async function showOverview(interaction) {
    const publicCmds = CATEGORIES.filter(c => c.public);
    const ownerCmds = CATEGORIES.filter(c => !c.public);

    const publicLines = publicCmds.map(c =>
        c.emoji + ' **' + c.name + '** — ' + c.commands.map(cmd => '`/' + cmd.name + '`').join(', ')
    ).join('\n');

    const ownerLines = ownerCmds.map(c =>
        c.emoji + ' **' + c.name + '** — ' + c.commands.map(cmd => '`/' + cmd.name + '`').join(', ')
    ).join('\n');

    const totalCmds = CATEGORIES.reduce((a, c) => a + c.commands.length, 0);
    const totalPublic = CATEGORIES.reduce((a, c) => a + (c.public ? c.commands.length : 0), 0);

    const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('📖 Bot Commands')
        .setDescription('**' + totalCmds + '** total commands • **' + totalPublic + '** public')
        .addFields(
            { name: '🌐 Public Commands', value: publicLines, inline: false },
            { name: '🔒 Server Owner Commands', value: ownerLines, inline: false },
        )
        .addFields(
            { name: '📋 Detailed Info', value: 'Use `/' + interaction.commandName + ' <category>` to see a category\'s commands.\nUse `/' + interaction.commandName + ' command:<name>` for details on a specific command.', inline: false },
        )
        .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL() })
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}

// ──────────────────── Show Single Category ────────────────────

async function showCategory(interaction, categoryName) {
    const cat = CATEGORIES.find(c => c.name.toLowerCase() === categoryName.toLowerCase());
    if (!cat) {
        const names = CATEGORIES.map(c => '`' + c.name.toLowerCase() + '`').join(', ');
        return interaction.reply({
            content: '❌ Unknown category. Available: ' + names,
            ephemeral: true,
        });
    }

    const cmdLines = cat.commands.map(cmd =>
        '`/' + cmd.name + '` — ' + cmd.desc
    ).join('\n');

    const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(cat.emoji + ' ' + cat.name + ' Commands')
        .setDescription('**' + cat.commands.length + '** command' + (cat.commands.length !== 1 ? 's' : '') + (cat.public ? ' • Public' : ' • Server Owner Only'))
        .addFields({ name: 'Commands', value: cmdLines })
        .setFooter({ text: 'Use /help command:<name> for details' })
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}

// ──────────────────── Show Single Command Detail ────────────────────

async function showCommandDetail(interaction, query) {
    // Search across all categories
    for (const cat of CATEGORIES) {
        const cmd = cat.commands.find(c => c.name === query);
        if (cmd) {
            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle('/' + cmd.name)
                .setDescription(cmd.desc)
                .addFields(
                    { name: 'Category', value: cat.emoji + ' ' + cat.name, inline: true },
                    { name: 'Access', value: cat.public ? '🌐 Public' : '🔒 Server Owner Only', inline: true },
                )
                .setFooter({ text: 'Use /help for all commands' })
                .setTimestamp();

            return interaction.reply({ embeds: [embed] });
        }
    }

    await interaction.reply({
        content: '❌ Command `/' + query + '` not found. Use `/help` to see all commands.',
        ephemeral: true,
    });
}

module.exports = { executeHelp };
