require('dotenv').config();
const { Client, GatewayIntentBits, Events, Partials, EmbedBuilder } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers, // Needed to track joins/leaves
        GatewayIntentBits.GuildMessageReactions // Needed for reactions
    ],
    partials: [
        Partials.Message, 
        Partials.Channel, 
        Partials.Reaction // Forces bot to see reactions on OLD messages
    ]
});

// Helper function to send logs to your specific channel
async function sendLog(embed) {
    const logChannel = client.channels.cache.get(process.env.LOG_CHANNEL_ID);
    if (logChannel) {
        await logChannel.send({ embeds: [embed] }).catch(console.error);
    } else {
        console.log("Could not find the log channel! Check your LOG_CHANNEL_ID.");
    }
}

// --- BOT READY ---
client.once(Events.ClientReady, () => {
    console.log(`Logged in as ${client.user.tag}! I am ready to log everything.`);
});

// --- REACTION ADDED ---
client.on(Events.MessageReactionAdd, async (reaction, user) => {
    if (reaction.partial) await reaction.fetch(); // Fetch old messages
    if (user.bot) return; // Ignore bot reactions

    const embed = new EmbedBuilder()
        .setColor('Green')
        .setTitle('➕ Reaction Added')
        .setDescription(`**${user.tag}** reacted with ${reaction.emoji.name} in <#${reaction.message.channelId}>`)
        .addFields({ name: 'Message Link', value: `[Click Here](${reaction.message.url})` })
        .setTimestamp();
        
    sendLog(embed);
});

// --- REACTION REMOVED ---
client.on(Events.MessageReactionRemove, async (reaction, user) => {
    if (reaction.partial) await reaction.fetch();
    if (user.bot) return;

    const embed = new EmbedBuilder()
        .setColor('Red')
        .setTitle('➖ Reaction Removed')
        .setDescription(`**${user.tag}** removed their ${reaction.emoji.name} reaction in <#${reaction.message.channelId}>`)
        .setTimestamp();
        
    sendLog(embed);
});

// --- MESSAGE DELETED ---
client.on(Events.MessageDelete, (message) => {
    if (message.partial || message.author.bot) return;

    const embed = new EmbedBuilder()
        .setColor('DarkRed')
        .setTitle('🗑️ Message Deleted')
        .setDescription(`A message by **${message.author.tag}** was deleted in ${message.channel}`)
        .addFields({ name: 'Content', value: message.content || '*No text (maybe an image)*' })
        .setTimestamp();
        
    sendLog(embed);
});

// --- MESSAGE EDITED ---
client.on(Events.MessageUpdate, (oldMessage, newMessage) => {
    if (oldMessage.partial || oldMessage.author.bot) return;
    if (oldMessage.content === newMessage.content) return; // Ignore embeds loading

    const embed = new EmbedBuilder()
        .setColor('Yellow')
        .setTitle('✏️ Message Edited')
        .setDescription(`**${oldMessage.author.tag}** edited their message in ${oldMessage.channel}`)
        .addFields(
            { name: 'Before', value: oldMessage.content || '*Empty*' },
            { name: 'After', value: newMessage.content || '*Empty*' },
            { name: 'Message Link', value: `[Click Here](${newMessage.url})` }
        )
        .setTimestamp();
        
    sendLog(embed);
});

// --- MEMBER JOINED ---
client.on(Events.GuildMemberAdd, (member) => {
    const embed = new EmbedBuilder()
        .setColor('Blue')
        .setTitle('👋 Member Joined')
        .setDescription(`**${member.user.tag}** has joined the server.`)
        .setFooter({ text: `Account created: ${member.user.createdAt.toDateString()}` })
        .setTimestamp();
        
    sendLog(embed);
});

// --- MEMBER LEFT ---
client.on(Events.GuildMemberRemove, (member) => {
    const embed = new EmbedBuilder()
        .setColor('Orange')
        .setTitle('🚪 Member Left')
        .setDescription(`**${member.user.tag}** has left the server.`)
        .setTimestamp();
        
    sendLog(embed);
});

client.login(process.env.BOT_TOKEN);