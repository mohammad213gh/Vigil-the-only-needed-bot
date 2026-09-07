// Isolated tests for the prefix command dispatcher (handlePrefixMessage):
// routing, owner/permission gating, unknown commands, and prefixes.
const { test, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Isolate BEFORE requiring modules — DB_PATH is computed at module load.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'prefix-test-'));
process.env.DATA_DIR = tmp;
process.env.OWNER_ID = 'owner1';

const { closeDb } = require('../src/db');
const { handlePrefixMessage } = require('../src/prefixCommands');
const { grantPermission } = require('../src/permissions');

const GUILD = 'pg1';

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
            name: 'Test Guild',
            members: { fetch: async () => null },
            ...guildOverrides,
        },
        author: { id: authorId, tag: 'Author#1' },
        reply,
        client: { ws: { ping: 42 } },
        _replies: replies,
    };
    return msg;
}

test('prefix: public command runs for any user', async () => {
    const msg = makeMessage(';ping', 'random-user');
    const handled = await handlePrefixMessage(msg, ';');
    assert.strictEqual(handled, true);
    assert.ok(msg._replies.some(r => r.includes('Pong!')));
});

test('prefix: owner-only command is blocked for non-owners without permission', async () => {
    const msg = makeMessage(';kick <@123>', 'random-user');
    const handled = await handlePrefixMessage(msg, ';');
    assert.strictEqual(handled, true); // treated as handled (gated reply sent)
    assert.strictEqual(msg._replies.length, 1);
    assert.ok(msg._replies[0].includes("don't have permission"));
});

test('prefix: owner bypasses the gate', async () => {
    const msg = makeMessage(';kick <@999>', 'owner1');
    const handled = await handlePrefixMessage(msg, ';');
    assert.strictEqual(handled, true);
    // Gate passed — handler ran and reported the user was not found.
    assert.ok(msg._replies.some(r => r.includes('Could not find that user')));
});

test('prefix: granted permission lets a non-owner run an owner-only command', async () => {
    grantPermission(GUILD, 'kick', 'mod1');
    const msg = makeMessage(';kick <@999>', 'mod1');
    const handled = await handlePrefixMessage(msg, ';');
    assert.strictEqual(handled, true);
    assert.ok(msg._replies.some(r => r.includes('Could not find that user')));
});

test('prefix: unknown command falls through silently', async () => {
    const msg = makeMessage(';zzz_not_a_command', 'owner1');
    const handled = await handlePrefixMessage(msg, ';');
    assert.strictEqual(handled, false);
    assert.strictEqual(msg._replies.length, 0);
});

test('prefix: message without the prefix is ignored', async () => {
    const msg = makeMessage('@ping', 'owner1');
    const handled = await handlePrefixMessage(msg, ';');
    assert.strictEqual(handled, false);
});

test('prefix: a bare prefix does nothing', async () => {
    const msg = makeMessage(';', 'owner1');
    const handled = await handlePrefixMessage(msg, ';');
    assert.strictEqual(handled, false);
});

test('prefix: custom prefixes work', async () => {
    const msg = makeMessage('@ping', 'owner1');
    const handled = await handlePrefixMessage(msg, '@');
    assert.strictEqual(handled, true);
    assert.ok(msg._replies.some(r => r.includes('Pong!')));
});
