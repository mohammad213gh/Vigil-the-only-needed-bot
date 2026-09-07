// Tests for the prefix→interaction adapter and the unified dispatcher:
// prefix commands must parse against the same deploy.js schema as slash
// commands and execute the same handlers through the shared pipeline.
const { test, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Isolate BEFORE requiring modules — DB_PATH is computed at module load.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'prefix-adapter-test-'));
process.env.DATA_DIR = tmp;
process.env.OWNER_ID = 'owner1';

const { closeDb } = require('../src/db');
const { handlePrefixMessage } = require('../src/prefixCommands');
const { buildPrefixInteraction } = require('../src/prefixAdapter');
const { getWarnings } = require('../src/warnings');
const { grantPermission } = require('../src/permissions');

const GUILD = 'pa1';

after(() => {
    try { closeDb(); } catch {}
    fs.rmSync(tmp, { recursive: true, force: true });
});

function makeMessage(content, authorId, guildOverrides = {}) {
    const replies = [];
    const reply = async (contentOrOptions) => {
        const text = typeof contentOrOptions === 'string' ? contentOrOptions : contentOrOptions.content;
        replies.push(text);
        return {
            createdTimestamp: Date.now(),
            edit: async (editContent) => {
                replies.push(typeof editContent === 'string' ? editContent : editContent.content);
            },
        };
    };
    const msg = {
        content,
        guild: {
            id: GUILD,
            name: 'Adapter Test Guild',
            members: { fetch: async () => null },
            iconURL: () => null,
            ...guildOverrides,
        },
        author: { id: authorId, tag: 'Author#1' },
        reply,
        client: { ws: { ping: 42 } },
        _replies: replies,
    };
    return msg;
}

// ──────────────────── Adapter parsing (unit) ────────────────────

test('adapter: positional user + greedy last string', () => {
    const msg = makeMessage(';kick <@555> spamming the chat', 'owner1');
    const { shim } = buildPrefixInteraction(msg, 'kick', ['<@555>', 'spamming', 'the', 'chat'], ';');
    assert.strictEqual(shim.options.getUser('user').id, '555');
    assert.strictEqual(shim.options.getString('reason'), 'spamming the chat');
});

test('adapter: leftovers absorb into an earlier free-text option', () => {
    // /ban = user, reason, delete_messages(choices). A multi-word reason
    // written after skipping the trailing choices option must not be lost.
    const msg = makeMessage(';ban <@555> spamming the chat', 'owner1');
    const { shim } = buildPrefixInteraction(msg, 'ban', ['<@555>', 'spamming', 'the', 'chat'], ';');
    assert.strictEqual(shim.options.getString('reason'), 'spamming the chat');
    assert.strictEqual(shim.options.getString('delete_messages'), null);
});

test('adapter: choice tokens are consumed when they match', () => {
    const msg = makeMessage(';ban', 'owner1');
    const { shim } = buildPrefixInteraction(msg, 'ban', ['<@555>', 'rule breaking', 'hour'], ';');
    assert.strictEqual(shim.options.getString('reason'), 'rule breaking');
    assert.strictEqual(shim.options.getString('delete_messages'), 'hour');
});

test('adapter: subcommand routing from the first token', () => {
    const msg = makeMessage(';note add <@555> being helpful', 'owner1');
    const { shim } = buildPrefixInteraction(msg, 'note', ['add', '<@555>', 'being helpful'], ';');
    assert.strictEqual(shim.options.getSubcommand(), 'add');
    assert.strictEqual(shim.options.getUser('user').id, '555');
    assert.strictEqual(shim.options.getString('note'), 'being helpful');
});

test('adapter: missing subcommand yields usage', () => {
    const msg = makeMessage(';note', 'owner1');
    const built = buildPrefixInteraction(msg, 'note', [], ';');
    assert.ok(built.usage.includes('add'));
    assert.ok(!built.shim);
});

test('adapter: unknown subcommand yields usage listing subs', () => {
    const msg = makeMessage(';note bogus', 'owner1');
    const built = buildPrefixInteraction(msg, 'note', ['bogus'], ';');
    assert.ok(built.usage.includes('list'));
});

test('adapter: missing required option yields usage', () => {
    const msg = makeMessage(';purge abc', 'owner1');
    const built = buildPrefixInteraction(msg, 'purge', ['abc'], ';');
    assert.ok(built.usage.includes('amount'));
});

test('adapter: pipe custom parser for poll', () => {
    const msg = makeMessage(';poll Q|A|B', 'owner1');
    const { shim } = buildPrefixInteraction(msg, 'poll', ['Q|A|B'], ';');
    assert.strictEqual(shim.options.getString('question'), 'Q');
    assert.strictEqual(shim.options.getString('option1'), 'A');
    assert.strictEqual(shim.options.getString('option2'), 'B');
});

test('adapter: forcedSubcommand maps aliases (server → stats server)', () => {
    const msg = makeMessage(';server', 'owner1');
    const { shim } = buildPrefixInteraction(msg, 'stats', [], ';', 'server');
    assert.strictEqual(shim.options.getSubcommand(), 'server');
});

test('adapter: unknown command reports unknown', () => {
    const msg = makeMessage(';zzz', 'owner1');
    const built = buildPrefixInteraction(msg, 'zzz', [], ';');
    assert.ok(built.unknown);
});

// ──────────────────── Dispatcher end-to-end ────────────────────

test('dispatcher: ;warn runs the slash handler end-to-end (DB write)', async () => {
    const msg = makeMessage(';warn <@999> spam', 'owner1');
    const handled = await handlePrefixMessage(msg, ';');
    assert.strictEqual(handled, true);
    // The slash executeWarn replied exactly once (embed-only) with no error
    assert.strictEqual(msg._replies.length, 1);
    assert.ok(!msg._replies.some(r => typeof r === 'string' && r.includes('error occurred')));
    // And the warning actually landed in the DB through the shared service
    const warnings = getWarnings(GUILD, '999');
    assert.strictEqual(warnings.length, 1);
    assert.strictEqual(warnings[0].reason, 'spam');
});

test('dispatcher: prefix commands now respect slash cooldowns', async () => {
    const first = makeMessage(';ping', 'cooldown-user');
    await handlePrefixMessage(first, ';');
    assert.ok(first._replies.some(r => r && r.includes('Pong!')));

    const second = makeMessage(';ping', 'cooldown-user');
    await handlePrefixMessage(second, ';');
    assert.ok(second._replies.some(r => r && r.includes('Please wait')));
});

test('dispatcher: legacy commands are gated by the shared pipeline', async () => {
    // ;giveaway used to dodge the owner gate entirely — now it goes through
    // the same guard as /giveaway.
    const msg = makeMessage(';giveaway', 'random-user');
    const handled = await handlePrefixMessage(msg, ';');
    assert.strictEqual(handled, true);
    assert.strictEqual(msg._replies.length, 1);
    assert.ok(msg._replies[0].includes("don't have permission"));
});

test('dispatcher: granted users can run gated legacy commands', async () => {
    grantPermission(GUILD, 'serverstats', 'mod1');
    const msg = makeMessage(';serverstats', 'mod1');
    const handled = await handlePrefixMessage(msg, ';');
    assert.strictEqual(handled, true);
    // Past the gate — the legacy handler replied with its usage line
    assert.ok(msg._replies.some(r => r && r.includes('serverstats')));
});

test('dispatcher: unknown command falls through silently', async () => {
    const msg = makeMessage(';zzz_not_a_command', 'owner1');
    assert.strictEqual(await handlePrefixMessage(msg, ';'), false);
    assert.strictEqual(msg._replies.length, 0);
});
