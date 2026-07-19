// ──────────────────── Log Categories ────────────────────

const LOG_CATEGORIES = ['messages', 'reactions', 'members', 'roles', 'server', 'voice', 'threads', 'emojis', 'bans', 'invites', 'stickers', 'automod', 'scheduled', 'stage', 'webhooks', 'integrations'];

const CATEGORY_EMOJIS = {
    messages: '\uD83D\uDCE8',
    reactions: '\uD83D\uDC4D',
    members: '\uD83D\uDC65',
    roles: '\uD83C\uDFF7\uFE0F',
    server: '\uD83D\uDDA5\uFE0F',
    voice: '\uD83C\uDFA4',
    threads: '\uD83E\uDD9C',
    emojis: '\uD83D\uDE0E',
    bans: '\uD83D\uDEAB',
    invites: '\uD83D\uDD17',
    stickers: '\uD83D\uDC02',
    automod: '\uD83E\uDD16',
    scheduled: '\uD83D\uDCC5',
    stage: '\uD83C\uDF9F',
    webhooks: '\uD83D\uDD17',
    integrations: '\uD83D\uDD17',
};

// ──────────────────── WebSocket Status Map ────────────────────

const WS_STATUS = {
    0: '\u2705 Ready',
    1: '\u26A0 Connecting',
    2: '\uD83D\uDFE0 Reconnecting',
    3: '\uD83D\uDFE4 Idle',
    4: '\uD83D\uDD34 Nearly',
    5: '\uD83D\uDD34 Disconnected',
};

// ──────────────────── Channel Type Names ────────────────────

const CHANNEL_TYPE_NAMES = {
    0: 'Text',
    2: 'Voice',
    4: 'Category',
    5: 'Announcement',
    13: 'Stage',
    15: 'Forum',
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

// ──────────────────── 8-Ball Responses ────────────────────

const BALL_RESPONSES = [
    'It is certain.', 'It is decidedly so.', 'Without a doubt.',
    'Yes — definitely.', 'You may rely on it.', 'As I see it, yes.',
    'Most likely.', 'Outlook good.', 'Yes.', 'Signs point to yes.',
    'Reply hazy, try again.', 'Ask again later.', 'Better not tell you now.',
    'Cannot predict now.', 'Concentrate and ask again.',
    "Don't count on it.", 'My reply is no.', 'My sources say no.',
    'Outlook not so good.', 'Very doubtful.',
];

// ──────────────────── Jokes ────────────────────

const JOKES = [
    "Why do programmers prefer dark mode? Because light attracts bugs!",
    "I told my computer I needed a break. Now it won't stop sending me vacation ads.",
    "Why did the developer go broke? Because he used up all his cache!",
    "There are only 10 kinds of people in the world: those who understand binary and those who don't.",
    "Why was the JavaScript developer sad? Because he didn't know how to 'null' his feelings.",
    "I'd tell you a UDP joke, but you might not get it.",
    "Why do Java developers wear glasses? Because they can't C#.",
    "A SQL query walks into a bar, walks up to two tables and asks: 'Can I join you?'",
    "How many programmers does it take to change a light bulb? None — that's a hardware problem.",
    "Debugging: Being the detective in a crime movie where you're also the murderer.",
    "Why did the scarecrow win an award? Because he was outstanding in his field.",
    "I'm reading a book on anti-gravity. It's impossible to put down!",
    "What do you call a fake noodle? An impasta.",
    "Why don't scientists trust atoms? Because they make up everything.",
    "I would tell you a construction joke, but I'm still working on it.",
];

// ──────────────────── Facts ────────────────────

const FACTS = [
    "Honey never spoils. Archaeologists have found pots of honey in ancient Egyptian tombs that are over 3,000 years old and still edible.",
    "Octopuses have three hearts. Two pump blood to the gills, and one pumps it to the rest of the body.",
    "A day on Venus is longer than a year on Venus.",
    "Bananas are berries, but strawberries aren't.",
    "The Eiffel Tower can be 15 cm taller during the summer due to thermal expansion of the iron.",
    "Wombat poop is cube-shaped to prevent it from rolling away.",
    "A group of flamingos is called a 'flamboyance'.",
    "The shortest war in history was between Britain and Zanzibar on August 27, 1896. Zanzibar surrendered after 38 minutes.",
    "Cows have best friends and can become stressed when separated from them.",
    "The inventor of the Pringles can is now buried in one.",
    "There's a Chinese city (Chongqing) with 32 million people — more than the entire country of Saudi Arabia.",
    "The average cloud weighs about 1.1 million pounds.",
    "Your brain uses about 20% of your body's oxygen and calories.",
    "A jiffy is an actual unit of time: 1/100th of a second.",
    "Scotland's national animal is the unicorn.",
    "The longest wedding veil was the same length as 63.5 football fields.",
    "Polar bears are left-handed (or left-pawed).",
    "A bolt of lightning contains enough energy to toast 100,000 slices of bread.",
];

// ──────────────────── Advice ────────────────────

const ADVICE = [
    "Drink more water. Your brain and body will thank you.",
    "Learn to say no. It's a complete sentence.",
    "Back up your data. Today. Not tomorrow.",
    "Read more books. Your attention span will improve.",
    "Invest in good shoes and a good mattress — if you're not in one, you're in the other.",
    "Don't compare your behind-the-scenes with everyone else's highlight reel.",
    "The best time to plant a tree was 20 years ago. The second best time is now.",
    "Sleep is not a luxury. It's a necessity.",
    "If a task takes less than 2 minutes, do it immediately.",
    "Save at least 20% of your income. Future you will be grateful.",
    "Learn to cook at least 3 proper meals. It's a life skill.",
    "Be kind to yourself. You're doing the best you can with what you have.",
    "Stop scrolling. Go outside. Touch grass.",
    "Write down your goals. You're 42% more likely to achieve them.",
    "The people you surround yourself with shape who you become. Choose wisely.",
];

// ──────────────────── Quotes ────────────────────

const QUOTES = [
    { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
    { text: "In the middle of difficulty lies opportunity.", author: "Albert Einstein" },
    { text: "Be yourself; everyone else is already taken.", author: "Oscar Wilde" },
    { text: "The future belongs to those who believe in the beauty of their dreams.", author: "Eleanor Roosevelt" },
    { text: "It does not matter how slowly you go as long as you do not stop.", author: "Confucius" },
    { text: "The only impossible journey is the one you never begin.", author: "Tony Robbins" },
    { text: "What lies behind us and what lies before us are tiny matters compared to what lies within us.", author: "Ralph Waldo Emerson" },
    { text: "Creativity is intelligence having fun.", author: "Albert Einstein" },
    { text: "The best revenge is massive success.", author: "Frank Sinatra" },
    { text: "Life is what happens when you're busy making other plans.", author: "John Lennon" },
    { text: "Success is not final, failure is not fatal: it is the courage to continue that counts.", author: "Winston Churchill" },
    { text: "The only person you are destined to become is the person you decide to be.", author: "Ralph Waldo Emerson" },
    { text: "Everything you've ever wanted is on the other side of fear.", author: "George Addair" },
    { text: "The journey of a thousand miles begins with one step.", author: "Lao Tzu" },
    { text: "Happiness is not something ready made. It comes from your own actions.", author: "Dalai Lama" },
];

// ──────────────────── Rock Paper Scissors ────────────────────

const RPS_CHOICES = ['rock', 'paper', 'scissors'];

const RPS_EMOJIS = {
    rock: '\uD83E\uDEA8',
    paper: '\uD83D\uDCC4',
    scissors: '\u2702\uFE0F',
};

const RPS_WINNERS = {
    rock: 'scissors',
    paper: 'rock',
    scissors: 'paper',
};

// ──────────────────── World Cup Outcomes ────────────────────

const WC_OUTCOMES = [
    'What a match!',
    'The crowd goes wild!',
    'A thrilling encounter!',
    'Absolute nail-biter!',
    'Total football on display!',
    'A historic result!',
    'Shock result of the tournament!',
    'The underdogs prevail!',
    'A masterclass performance!',
    "They're dancing in the streets!",
];

// ──────────────────── Permission Name Lookup ────────────────────
// Shared between roles.js and server.js event handlers

const PERM_NAMES = {
    'Administrator': 'Administrator',
    'ManageGuild': 'Manage Server',
    'ManageRoles': 'Manage Roles',
    'ManageChannels': 'Manage Channels',
    'ManageMessages': 'Manage Messages',
    'ManageNicknames': 'Manage Nicknames',
    'ManageWebhooks': 'Manage Webhooks',
    'ManageThreads': 'Manage Threads',
    'ManageEvents': 'Manage Events',
    'KickMembers': 'Kick Members',
    'BanMembers': 'Ban Members',
    'ModerateMembers': 'Timeout Members',
    'MentionEveryone': 'Mention @everyone',
    'ViewChannel': 'View Channels',
    'SendMessages': 'Send Messages',
    'SendTTSMessages': 'Send TTS Messages',
    'SendMessagesInThreads': 'Send Thread Messages',
    'CreatePrivateThreads': 'Create Private Threads',
    'CreatePublicThreads': 'Create Public Threads',
    'ReadMessageHistory': 'Read History',
    'AttachFiles': 'Attach Files',
    'AddReactions': 'Add Reactions',
    'EmbedLinks': 'Embed Links',
    'UseExternalEmojis': 'Use External Emojis',
    'UseExternalStickers': 'Use External Stickers',
    'UseExternalSounds': 'Use External Sounds',
    'UseApplicationCommands': 'Use Commands',
    'Connect': 'Connect (Voice)',
    'Speak': 'Speak (Voice)',
    'MuteMembers': 'Mute Members',
    'DeafenMembers': 'Deafen Members',
    'MoveMembers': 'Move Members',
    'UseVAD': 'Use Voice Activity',
    'PrioritySpeaker': 'Priority Speaker',
    'Stream': 'Stream',
    'CreateInstantInvite': 'Create Invite',
    'ChangeNickname': 'Change Nickname',
    'ViewAuditLog': 'View Audit Log',
    'ViewGuildInsights': 'View Insights',
    'RequestToSpeak': 'Request to Speak',
    'CreateEvents': 'Create Events',
    'SendPolls': 'Send Polls',
};

module.exports = {
    LOG_CATEGORIES,
    CATEGORY_EMOJIS,
    WS_STATUS,
    CHANNEL_TYPE_NAMES,
    COUNTRY_FLAGS,
    BALL_RESPONSES,
    JOKES,
    FACTS,
    ADVICE,
    QUOTES,
    RPS_CHOICES,
    RPS_EMOJIS,
    RPS_WINNERS,
    WC_OUTCOMES,
    PERM_NAMES,
};
