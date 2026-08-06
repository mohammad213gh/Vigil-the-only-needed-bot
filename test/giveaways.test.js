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
