// Isolated tests for auto-moderation detection + bypass logic.
// Each scenario uses its own guild id so DB rows and the in-memory spam
// tracker never leak between tests.
const { test, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Isolate BEFORE requiring db — DB_PATH is computed at module load.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'automod-test-'));
process.env.DATA_DIR = tmp;

const { closeDb } = require('../src/db');
const am = require('../src/automod');

after(() => {
    try { closeDb(); } catch {}
    fs.rmSync(tmp, { recursive: true, force: true });
});

function makeMessage(overrides = {}) {
    const msg = {
        content: '',
        channelId: 'c1',
        author: { id: 'u1', tag: 'User#1', bot: false },
        member: {
            user: { bot: false },
            permissions: { has: () => false },
            roles: { cache: { some: () => false } },
            send: async () => {},
            moderatable: true,
            kickable: true,
            timeout: async () => {},
            kick: async () => {},
        },
        deletable: true,
        delete: async () => {},
        mentions: { users: { size: 0 }, roles: { size: 0 }, channels: { size: 0 } },
        guild: { id: 'g1', name: 'Test Guild' },
        channel: { toString: () => '<#c1>' },
        ...overrides,
    };
    return msg;
}

function enableRule(guildId, rule, extra = {}) {
    am.updateAutoModRule(guildId, rule, {
        enabled: true, threshold: 0, time_window: 0, action: 'delete', duration: null, ...extra,
    });
}

test('automod: all rules disabled → message passes', async () => {
    const msg = makeMessage({ content: 'hello world', deletable: true, delete: async () => { throw new Error('should not delete'); } });
    const hit = await am.checkMessage(msg, 'ga');
    assert.strictEqual(hit, false);
});

test('automod: banned word triggers the configured action', async () => {
    enableRule('gb', 'words');
    am.addAutoModFilter('gb', 'words', 'badword', 'delete');
    let deleted = 0;
    const msg = makeMessage({ content: 'this message has a badword in it', delete: async () => { deleted++; } });
    const hit = await am.checkMessage(msg, 'gb');
    assert.strictEqual(hit, true);
    assert.strictEqual(deleted, 1);
});

test('automod: banned word matching is case-insensitive', async () => {
    enableRule('gc', 'words');
    am.addAutoModFilter('gc', 'words', 'spamword', 'delete');
    let deleted = 0;
    const msg = makeMessage({ content: 'SPAMWORD here', delete: async () => { deleted++; } });
    const hit = await am.checkMessage(msg, 'gc');
    assert.strictEqual(hit, true);
    assert.strictEqual(deleted, 1);
});

test('automod: excessive caps triggers', async () => {
    enableRule('gd', 'caps', { threshold: 70 });
    let deleted = 0;
    const msg = makeMessage({ content: 'A'.repeat(40), delete: async () => { deleted++; } });
    const hit = await am.checkMessage(msg, 'gd');
    assert.strictEqual(hit, true);
    assert.strictEqual(deleted, 1);
});

test('automod: short all-caps messages are not flagged', async () => {
    enableRule('ge', 'caps', { threshold: 70 });
    let deleted = 0;
    const msg = makeMessage({ content: 'OK FINE', delete: async () => { deleted++; } }); // < 20 chars
    const hit = await am.checkMessage(msg, 'ge');
    assert.strictEqual(hit, false);
    assert.strictEqual(deleted, 0);
});

test('automod: mass mentions trigger', async () => {
    enableRule('gf', 'mentions', { threshold: 5 });
    let deleted = 0;
    const msg = makeMessage({
        content: '<@1> <@2> <@3> <@4> <@5> <@6>',
        mentions: { users: { size: 6 }, roles: { size: 0 }, channels: { size: 0 } },
        delete: async () => { deleted++; },
    });
    const hit = await am.checkMessage(msg, 'gf');
    assert.strictEqual(hit, true);
    assert.strictEqual(deleted, 1);
});

test('automod: timeout action deletes the message and times out the member', async () => {
    enableRule('gg', 'words');
    am.addAutoModFilter('gg', 'words', 'nasty', 'timeout');
    let deleted = 0;
    let timedOut = 0;
    const msg = makeMessage({
        content: 'that is nasty',
        delete: async () => { deleted++; },
        member: { user: { bot: false }, permissions: { has: () => false }, roles: { cache: { some: () => false } }, send: async () => {}, moderatable: true, kickable: true, timeout: async () => { timedOut++; }, kick: async () => {} },
    });
    const hit = await am.checkMessage(msg, 'gg');
    assert.strictEqual(hit, true);
    assert.strictEqual(deleted, 1);
    assert.strictEqual(timedOut, 1);
});

test('automod: whitelisted role bypasses all rules', async () => {
    enableRule('gh', 'words');
    am.addAutoModFilter('gh', 'words', 'badword', 'delete');
    am.updateAutoModConfig('gh', { whitelistedRoles: ['R1'] });
    let deleted = 0;
    const msg = makeMessage({
        content: 'has badword',
        member: { user: { bot: false }, permissions: { has: () => false }, roles: { cache: { some: (fn) => fn({ id: 'R1' }) } }, send: async () => {}, moderatable: true, kickable: true, timeout: async () => {}, kick: async () => {} },
        delete: async () => { deleted++; },
    });
    const hit = await am.checkMessage(msg, 'gh');
    assert.ok(!hit);
    assert.strictEqual(deleted, 0);
});

test('automod: excluded channel is not checked', async () => {
    enableRule('gi', 'words');
    am.addAutoModFilter('gi', 'words', 'badword', 'delete');
    am.updateAutoModConfig('gi', { excludedChannels: ['c9'] });
    let deleted = 0;
    const msg = makeMessage({ content: 'has badword', channelId: 'c9', delete: async () => { deleted++; } });
    const hit = await am.checkMessage(msg, 'gi');
    assert.ok(!hit);
    assert.strictEqual(deleted, 0);
});

test('automod: bot messages are never flagged', async () => {
    enableRule('gj', 'words');
    am.addAutoModFilter('gj', 'words', 'badword', 'delete');
    let deleted = 0;
    const msg = makeMessage({
        content: 'has badword',
        member: { user: { bot: true }, permissions: { has: () => false }, roles: { cache: { some: () => false } } },
        delete: async () => { deleted++; },
    });
    const hit = await am.checkMessage(msg, 'gj');
    assert.ok(!hit);
    assert.strictEqual(deleted, 0);
});

test('automod: members with ManageMessages permission are skipped', async () => {
    enableRule('gk', 'words');
    am.addAutoModFilter('gk', 'words', 'badword', 'delete');
    let deleted = 0;
    const msg = makeMessage({
        content: 'has badword',
        member: { user: { bot: false }, permissions: { has: () => true }, roles: { cache: { some: () => false } } },
        delete: async () => { deleted++; },
    });
    const hit = await am.checkMessage(msg, 'gk');
    assert.ok(!hit);
    assert.strictEqual(deleted, 0);
});

test('automod: spam detection fires once the threshold is reached within the window', async () => {
    am.updateAutoModRule('gs', 'spam', { enabled: true, threshold: 2, time_window: 10, action: 'delete', duration: null });
    let deleted = 0;
    const mk = () => makeMessage({ author: { id: 'spammer', tag: 'Spam#1', bot: false }, content: 'hi', delete: async () => { deleted++; } });
    const first = await am.checkMessage(mk(), 'gs');
    assert.strictEqual(first, false); // 1st message: under threshold
    assert.strictEqual(deleted, 0);
    const second = await am.checkMessage(mk(), 'gs');
    assert.strictEqual(second, true); // 2nd within window: threshold reached
    assert.strictEqual(deleted, 1);
});

test('automod: export/import round-trips rules and filters', async () => {
    enableRule('gl', 'words');
    am.addAutoModFilter('gl', 'words', 'roundtripword', 'delete');
    const exported = am.exportAutoModConfig('gl');
    assert.ok(exported.rules.words.enabled);
    assert.strictEqual(exported.filters.words.length, 1);
    assert.strictEqual(exported.filters.words[0].pattern, 'roundtripword');

    // Import into a fresh guild and confirm the filter is live.
    am.importAutoModConfig('gm', exported);
    let deleted = 0;
    const msg = makeMessage({ content: 'roundtripword!', delete: async () => { deleted++; } });
    const hit = await am.checkMessage(msg, 'gm');
    assert.strictEqual(hit, true);
    assert.strictEqual(deleted, 1);
});
