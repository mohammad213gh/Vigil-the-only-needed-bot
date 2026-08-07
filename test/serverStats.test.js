// Temp-isolated tests for the server stats module: computation, formatting,
// DB lifecycle, and the refresh/rename loop.
const { test, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ss-test-'));
process.env.DATA_DIR = tmp;

const { getDb, closeDb } = require('../src/db');
const ss = require('../src/serverStats');

after(() => {
    try { closeDb(); } catch {}
    fs.rmSync(tmp, { recursive: true, force: true });
});

// ── Mocks ──
function makeMember(id, { bot = false, status = null } = {}) {
    const m = { id, user: { bot }, presence: status ? { status } : null };
    return m;
}
function makeChannel(id, name) {
    return {
        id,
        name,
        manageable: true,
        renames: 0,
        async setName(n) { this.name = n; this.renames += 1; },
    };
}
function makeGuild(opts = {}) {
    const members = new Map();
    for (const [id, m] of Object.entries(opts.members || {})) members.set(id, m);
    const channels = new Map();
    for (const c of (opts.channels || [])) channels.set(c.id, c);
    const roles = new Map();
    for (let i = 0; i < (opts.roleCount || 0); i++) roles.set('r' + i, { id: 'r' + i });
    const emojis = new Map();
    for (let i = 0; i < (opts.emojiCount || 0); i++) emojis.set('e' + i, { id: 'e' + i });
    return {
        id: opts.id || 'g1',
        memberCount: opts.memberCount || 0,
        premiumSubscriptionCount: opts.premiumSubscriptionCount || 0,
        premiumTier: opts.premiumTier || 0,
        members: { cache: members },
        channels: { cache: channels },
        roles: { cache: roles },
        emojis: { cache: emojis },
    };
}

// ── computeStat ──
test('computeStat: counts members, humans, bots, online', () => {
    const g = makeGuild({
        memberCount: 100,
        members: {
            a: makeMember('a'),
            b: makeMember('b', { bot: true }),
            c: makeMember('c', { status: 'online' }),
            d: makeMember('d', { status: 'dnd' }),
            e: makeMember('e', { status: 'offline' }),
        },
    });
    assert.strictEqual(ss.computeStat(g, g.members, 'members'), 100);
    assert.strictEqual(ss.computeStat(g, g.members, 'humans'), 4);
    assert.strictEqual(ss.computeStat(g, g.members, 'bots'), 1);
    assert.strictEqual(ss.computeStat(g, g.members, 'online'), 2);
});

test('computeStat: boosts, tier, channels, roles, emojis', () => {
    const g = makeGuild({
        premiumSubscriptionCount: 7,
        premiumTier: 2,
        channels: [makeChannel('c1', 'x'), makeChannel('c2', 'y')],
        roleCount: 5,
        emojiCount: 3,
    });
    assert.strictEqual(ss.computeStat(g, g.members, 'boosting'), 7);
    assert.strictEqual(ss.computeStat(g, g.members, 'boost_tier'), 2);
    assert.strictEqual(ss.computeStat(g, g.members, 'channels'), 2);
    assert.strictEqual(ss.computeStat(g, g.members, 'roles'), 5);
    assert.strictEqual(ss.computeStat(g, g.members, 'emojis'), 3);
});

test('computeStat: unknown type or missing guild is 0', () => {
    assert.strictEqual(ss.computeStat(makeGuild(), makeGuild().members, 'nope'), 0);
    assert.strictEqual(ss.computeStat(null, null, 'members'), 0);
});

// ── formatStatName ──
test('formatStatName: default label, thousands separators, custom label', () => {
    assert.strictEqual(ss.formatStatName('members', 1234, null), '👥 Members • 1,234');
    assert.strictEqual(ss.formatStatName('members', 50, 'Total'), '👥 Total • 50');
    assert.strictEqual(ss.formatStatName('boost_tier', 2, null), '💎 Boost Tier • Tier 2');
    assert.strictEqual(ss.formatStatName('nope', 1, null), '');
});

test('formatStatName: zero values and boost tier 0', () => {
    assert.strictEqual(ss.formatStatName('members', 0, null), '👥 Members • 0');
    assert.strictEqual(ss.formatStatName('boost_tier', 0, null), '💎 Boost Tier • Tier 0');
    assert.strictEqual(ss.formatStatName('boosting', 0, null), '🚀 Boosts • 0');
});

test('formatStatName: never exceeds 100 chars and never contains @ # :', () => {
    const long = ss.formatStatName('members', 123456789, 'X'.repeat(200));
    assert.ok(long.length <= 100);
    assert.ok(!/[@#:]/.test(long), 'channel-name-invalid chars present: ' + long);
});

// ── DB lifecycle ──
test('DB: set, get, update (replace), remove', () => {
    const r1 = ss.setServerStat('g1', 'c1', 'members', null);
    assert.ok(r1.success);
    const r2 = ss.setServerStat('g1', 'c2', 'boosting', 'Boosters');
    assert.ok(r2.success);
    assert.strictEqual(ss.getServerStats('g1').length, 2);

    // Replace same channel -> still one row, new type
    ss.setServerStat('g1', 'c1', 'online', null);
    const rows = ss.getServerStats('g1');
    assert.strictEqual(rows.length, 2);
    assert.strictEqual(rows.find(r => r.channel_id === 'c1').stat_type, 'online');

    // Invalid type rejected
    assert.ok(ss.setServerStat('g1', 'c3', 'bogus', null).error);

    ss.removeServerStat('g1', 'c1');
    assert.strictEqual(ss.getServerStats('g1').length, 1);
    // Per-guild isolation
    assert.strictEqual(ss.getServerStats('other').length, 0);
});

// ── refreshGuildStats ──
test('refresh: renames channel to the computed name', async () => {
    const ch = makeChannel('c1', 'old name');
    const g = makeGuild({ memberCount: 42, channels: [ch], members: {} });
    ss.setServerStat('g1', 'c1', 'members', null);

    await ss.refreshGuildStats(g);
    assert.strictEqual(ch.name, '👥 Members • 42');
    assert.strictEqual(ch.renames, 1);

    // Second refresh with same value -> no rename (rate-limit safety)
    await ss.refreshGuildStats(g);
    assert.strictEqual(ch.renames, 1);
});

test('refresh: drops config when the channel is deleted', async () => {
    const g = makeGuild({ memberCount: 10, channels: [], members: {} });
    ss.setServerStat('g1', 'gone', 'members', null);
    await ss.refreshGuildStats(g);
    assert.strictEqual(ss.getServerStats('g1').length, 0);
});

test('refresh: respects custom label and never throws on unmanageable channel', async () => {
    const ch = makeChannel('c1', 'x');
    ch.manageable = false;
    const g = makeGuild({ memberCount: 7, channels: [ch], members: {} });
    ss.setServerStat('g1', 'c1', 'members', 'Total Humans');
    await ss.refreshGuildStats(g); // must not throw
    assert.strictEqual(ch.name, 'x'); // untouched
});
