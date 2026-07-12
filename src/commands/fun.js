const { EmbedBuilder } = require('discord.js');
const { getFlag, randomItem, randomInt, reverseText, mockText } = require('../helpers');
const { makeEmbed } = require('../embeds');
const {
    BALL_RESPONSES,
    JOKES,
    FACTS,
    ADVICE,
    QUOTES,
    RPS_CHOICES,
    RPS_EMOJIS,
    RPS_WINNERS,
    WC_OUTCOMES,
} = require('../constants');

async function executeWorldCup(interaction) {
    const team1 = interaction.options.getString('team1');
    const team2 = interaction.options.getString('team2');

    const flag1 = getFlag(team1);
    const flag2 = getFlag(team2);

    const score1 = randomInt(0, 5);
    const score2 = randomInt(0, 5);

    const outcome = randomItem(WC_OUTCOMES);

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
}

async function execute8Ball(interaction) {
    const question = interaction.options.getString('question');
    const answer = randomItem(BALL_RESPONSES);

    const embed = makeEmbed({
        color: 0x9B59B6,
        title: '\uD83C\uDFB1 Magic 8-Ball',
        fields: [
            { name: 'Question', value: question },
            { name: 'Answer', value: '🎱 ' + answer },
        ],
        footer: { text: 'Asked by ' + interaction.user.tag },
        timestamp: true,
    });

    await interaction.reply({ embeds: [embed] });
}

async function executeCoinflip(interaction) {
    const result = Math.random() < 0.5;
    const side = result ? 'Heads' : 'Tails';
    const emoji = result ? '\uD83D\uDC6E' : '\uD83D\uDC6F';
    const color = result ? 0xFFD700 : 0xC0C0C0;

    const embed = makeEmbed({
        color: color,
        title: '\uD83E\uDE99 Coin Flip',
        description: emoji + ' **' + side + '!**',
        footer: { text: 'Flipped by ' + interaction.user.tag },
        timestamp: true,
    });

    await interaction.reply({ embeds: [embed] });
}

async function executeDice(interaction) {
    const sides = interaction.options.getInteger('sides') || 6;
    const result = randomInt(1, sides);

    const diceEmoji = sides === 6 ? '\uD83C\uDFB2' : '\uD83C\uDFB0';
    const embed = makeEmbed({
        color: 0xE67E22,
        title: diceEmoji + ' Dice Roll',
        description: '**' + result + '** (1–' + sides + ')',
        footer: { text: 'Rolled by ' + interaction.user.tag },
        timestamp: true,
    });

    await interaction.reply({ embeds: [embed] });
}

async function executeRPS(interaction) {
    const choice = interaction.options.getString('choice').toLowerCase();
    const botChoice = randomItem(RPS_CHOICES);

    if (!RPS_CHOICES.includes(choice)) {
        return interaction.reply({
            content: '\u26A0\uFE0F Invalid choice! Pick: rock, paper, or scissors.',
            ephemeral: true,
        });
    }

    let result, color;
    if (choice === botChoice) {
        result = 'It\'s a **tie**!';
        color = 0x95A5A6;
    } else if (RPS_WINNERS[choice] === botChoice) {
        result = 'You **win**!';
        color = 0x2ECC71;
    } else {
        result = 'You **lose**!';
        color = 0xE74C3C;
    }

    const embed = makeEmbed({
        color: color,
        title: '\uD83D\uDCA3 Rock Paper Scissors',
        description: [
            RPS_EMOJIS[choice] + ' You chose **' + choice + '**',
            RPS_EMOJIS[botChoice] + ' I chose **' + botChoice + '**',
            '',
            '**' + result + '**',
        ].join('\n'),
        footer: { text: 'Played by ' + interaction.user.tag },
        timestamp: true,
    });

    await interaction.reply({ embeds: [embed] });
}

async function executeJoke(interaction) {
    const joke = randomItem(JOKES);

    const embed = makeEmbed({
        color: 0xF1C40F,
        title: '\uD83D\uDE06 Joke',
        description: joke,
        footer: { text: interaction.user.tag },
        timestamp: true,
    });

    await interaction.reply({ embeds: [embed] });
}

async function executeFact(interaction) {
    const fact = randomItem(FACTS);

    const embed = makeEmbed({
        color: 0x3498DB,
        title: '\uD83D\uDCA1 Did You Know?',
        description: fact,
        footer: { text: interaction.user.tag },
        timestamp: true,
    });

    await interaction.reply({ embeds: [embed] });
}

async function executeAdvice(interaction) {
    const advice = randomItem(ADVICE);

    const embed = makeEmbed({
        color: 0x1ABC9C,
        title: '\uD83D\uDCDD Advice',
        description: '*"' + advice + '"*',
        footer: { text: interaction.user.tag },
        timestamp: true,
    });

    await interaction.reply({ embeds: [embed] });
}

async function executeQuote(interaction) {
    const quote = randomItem(QUOTES);

    const embed = makeEmbed({
        color: 0x9B59B6,
        title: '\uD83D\uDCD6 Quote',
        description: '*"' + quote.text + '"*\n— **' + quote.author + '**',
        footer: { text: interaction.user.tag },
        timestamp: true,
    });

    await interaction.reply({ embeds: [embed] });
}

async function executeReverse(interaction) {
    const text = interaction.options.getString('text');
    const reversed = reverseText(text);

    const embed = makeEmbed({
        color: 0x5865F2,
        title: '\uD83D\uDD04 Reversed Text',
        description: '```\n' + reversed.slice(0, 2000) + '\n```',
        footer: { text: interaction.user.tag },
        timestamp: true,
    });

    await interaction.reply({ embeds: [embed] });
}

async function executeMock(interaction) {
    const text = interaction.options.getString('text');
    const mocked = mockText(text);

    const embed = makeEmbed({
        color: 0xE67E22,
        title: '\uD83D\uDE21 Mocking SpongeBob',
        description: '```\n' + mocked.slice(0, 2000) + '\n```',
        footer: { text: interaction.user.tag },
        timestamp: true,
    });

    await interaction.reply({ embeds: [embed] });
}

async function executeRandom(interaction) {
    const min = interaction.options.getInteger('min');
    const max = interaction.options.getInteger('max');

    if (min >= max) {
        return interaction.reply({
            content: '\u26A0\uFE0F Minimum must be less than maximum!',
            ephemeral: true,
        });
    }

    const result = randomInt(min, max);

    const embed = makeEmbed({
        color: 0x5865F2,
        title: '\uD83C\uDFB2 Random Number',
        description: '**' + result + '** (' + min + '–' + max + ')',
        footer: { text: 'Generated for ' + interaction.user.tag },
        timestamp: true,
    });

    await interaction.reply({ embeds: [embed] });
}

module.exports = {
    executeWorldCup,
    execute8Ball,
    executeCoinflip,
    executeDice,
    executeRPS,
    executeJoke,
    executeFact,
    executeAdvice,
    executeQuote,
    executeReverse,
    executeMock,
    executeRandom,
};
