// Temp-isolated tests for the giveaways module: winner picking + DB lifecycle.
const { test, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gw-test-'));
process.env.DATA_DIR = tmp;

const { getDb, closeDb } = require('../src/db');
const gw = require('../src/giveaways');

after(() => {
    try { closeDb(); } catch {}
    fs.rmSync(tmp, { recursive: true, force: true });
});

test('selectWinners: correct count, subset, no dupes', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'a', 'b']; // dupes present
    const w = gw.selectWinners(ids, 3);
    assert.strictEqual(w.length, 3);
    assert.strictEqual(new Set(w).size, 3);
    assert.ok(w.every(id => ids.includes(id)));
});

test('selectWinners: more winners than entrants clamps to entrants', () => {
    assert.strictEqual(gw.selectWinners(['x', 'y'], 5).length, 2);
});

test('selectWinners: empty input yields no winners', () => {
    assert.strictEqual(gw.selectWinners([], 3).length, 0);
});

test('createGiveaway inserts and listGiveaways returns it', () => {
    const g = gw.createGiveaway({ guildId: 'g1', channelId: 'c1', prize: 'Nitro', durationMs: 60000, winners: 2, hostId: 'h1', hostTag: 'Host#1' });
    assert.ok(g && g.id.startsWith('gw_') && g.status === 'active');
    assert.strictEqual(g.prize, 'Nitro');
    const list = gw.listGiveaways('g1');
    assert.strictEqual(list.length, 1);
});

test('getActiveGiveaways only returns active rows', () => {
    assert.ok(gw.getActiveGiveaways().every(g => g.status === 'active'));
});

test('cancelGiveaway transitions status and is idempotent-guarded', () => {
    const g = gw.createGiveaway({ guildId: 'g1', channelId: 'c1', prize: 'P', durationMs: 60000, winners: 1, hostId: 'h1' });
    const res = gw.cancelGiveaway(g.id);
    assert.ok(res.success);
    assert.strictEqual(gw.getGiveaway(g.id).status, 'cancelled');
    assert.ok(gw.cancelGiveaway(g.id).error); // already cancelled
});

test('endGiveaway without client marks ended with no winners', async () => {
    const g = gw.createGiveaway({ guildId: 'g1', channelId: 'c1', prize: 'P', durationMs: 60000, winners: 1, hostId: 'h1' });
    const res = await gw.endGiveaway(g.id);
    assert.ok(res.success);
    assert.deepStrictEqual(res.winners, []);
    assert.strictEqual(gw.getGiveaway(g.id).status, 'ended');
});

test('endGiveaway rejects already-ended giveaways', async () => {
    const g = gw.createGiveaway({ guildId: 'g1', channelId: 'c1', prize: 'P', durationMs: 60000, winners: 1, hostId: 'h1' });
    await gw.endGiveaway(g.id);
    const res = await gw.endGiveaway(g.id);
    assert.ok(res.error);
});

test('rerollGiveaway requires an ended giveaway', async () => {
    const g = gw.createGiveaway({ guildId: 'g1', channelId: 'c1', prize: 'P', durationMs: 60000, winners: 1, hostId: 'h1' });
    const res = await gw.rerollGiveaway(g.id);
    assert.ok(res.error); // still active
});

test('unknown giveaway id returns an error', () => {
    assert.ok(gw.cancelGiveaway('nope').error);
});

// ── v2: role requirements / bans ──

test('isEligible: required roles enforced', () => {
    const memberMap = { u1: { roles: ['r1', 'r2'] }, u2: { roles: ['r2'] } };
    assert.strictEqual(gw.isEligible('u1', memberMap, ['r1'], []), true);
    assert.strictEqual(gw.isEligible('u2', memberMap, ['r1'], []), false);
});

test('isEligible: banned roles enforced', () => {
    const memberMap = { u1: { roles: ['b1'] }, u2: { roles: ['ok'] } };
    assert.strictEqual(gw.isEligible('u1', memberMap, [], ['b1']), false);
    assert.strictEqual(gw.isEligible('u2', memberMap, [], ['b1']), true);
});

test('filterEligibleEntrants: no constraints passes everyone through', () => {
    assert.deepStrictEqual(gw.filterEligibleEntrants(['a', 'b'], null, null, null), ['a', 'b']);
});

test('filterEligibleEntrants: role-gated drops ineligible + unknown members', () => {
    const memberMap = { a: { roles: ['req'] }, b: { roles: ['other'] }, c: { roles: ['req', 'bad'] } };
    // required 'req' + banned 'bad'
    const out = gw.filterEligibleEntrants(['a', 'b', 'c', 'ghost'], memberMap, ['req'], ['bad']);
    assert.deepStrictEqual(out, ['a']);
});

// ── v2: colors ──

test('parseHexColor handles #hex, bare hex, and rejects garbage', () => {
    assert.strictEqual(gw.parseHexColor('#ff5500'), 0xff5500);
    assert.strictEqual(gw.parseHexColor('ff5500'), 0xff5500);
    assert.strictEqual(gw.parseHexColor('nope'), null);
});

// ── v2: message-link resolution ──

test('getGiveawayByMessageRef resolves by id, message id, and message link', () => {
    const g = gw.createGiveaway({ guildId: 'g1', channelId: 'c1', prize: 'P', durationMs: 60000, winners: 1, hostId: 'h1' });
    // No message_id yet, so link lookup fails — wire one in like postGiveaway does.
    const db = getDb();
    db.prepare('UPDATE giveaways SET message_id = ? WHERE id = ?').run('987654321', g.id);
    assert.strictEqual(gw.getGiveawayByMessageRef(g.id).id, g.id);
    assert.strictEqual(gw.getGiveawayByMessageRef('987654321').id, g.id);
    assert.strictEqual(gw.getGiveawayByMessageRef('https://discord.com/channels/1/2/987654321').id, g.id);
    assert.strictEqual(gw.getGiveawayByMessageRef('https://discord.com/channels/1/2/999999'), null);
});

// ── v2: fields persist ──

test('createGiveaway persists description, roles, color, image', () => {
    const g = gw.createGiveaway({
        guildId: 'g1', channelId: 'c1', prize: 'Nitro', durationMs: 60000, winners: 1,
        hostId: 'h1', description: 'Members only', requiredRoleIds: ['r1'], bannedRoleIds: ['b1'],
        color: '#ff5500', imageUrl: 'https://example.com/x.gif',
    });
    assert.strictEqual(g.description, 'Members only');
    assert.deepStrictEqual(JSON.parse(g.required_role_ids), ['r1']);
    assert.deepStrictEqual(JSON.parse(g.banned_role_ids), ['b1']);
    assert.strictEqual(g.color, 0xff5500);
    assert.strictEqual(g.image_url, 'https://example.com/x.gif');
});

// ── v2: prefix flag parser (quoted values) ──

const { parseGwFlags } = require('../src/prefixCommands');

test('parseGwFlags: multi-word quoted --desc value stays intact', () => {
    // Discord passes whitespace-split args: `--desc "Members only"` → ['--desc', '"Members', 'only"']
    const flags = parseGwFlags(['start', '--desc', '"Members', 'only"', '--role', '<@&123>', '1h', '1', 'Nitro'], 1);
    assert.strictEqual(flags.desc, 'Members only');
    assert.strictEqual(flags.role, '<@&123>');
    assert.deepStrictEqual(flags.positional, ['1h', '1', 'Nitro']);
});

test('parseGwFlags: quoted positional prize is re-joined and unquoted', () => {
    const flags = parseGwFlags(['start', '1h', '"Nitro', 'boost"'], 1);
    assert.deepStrictEqual(flags.positional, ['1h', 'Nitro boost']);
});

test('parseGwFlags: single-word quoted value strips quotes', () => {
    const flags = parseGwFlags(['start', '--color', '"#ff5500"', '1h', 'Nitro'], 1);
    assert.strictEqual(flags.color, '#ff5500');
});

test('parseGwFlags: missing flag value reports an error', () => {
    const flags = parseGwFlags(['start', '--desc'], 1);
    assert.ok(flags.error);
});
