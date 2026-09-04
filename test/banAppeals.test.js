// Temp-isolated tests for the ban appeals module.
// Uses Node's built-in test runner (node --test) — no extra dependencies.
const { test, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Isolate BEFORE requiring db — DB_PATH is computed at module load.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'appeals-test-'));
process.env.DATA_DIR = tmp;

const { getDb, closeDb } = require('../src/db');
const {
    createBanAppeal, getBanAppeal, getBanAppeals,
    updateBanAppealStatus, deleteBanAppeal, getBanAppealCount,
} = require('../src/banAppeals');

after(() => {
    try { closeDb(); } catch {}
    fs.rmSync(tmp, { recursive: true, force: true });
});

test('schema carries the review audit columns', () => {
    const cols = getDb().prepare('PRAGMA table_info(ban_appeals)').all().map(c => c.name);
    for (const c of ['reviewed_by', 'reviewed_at', 'review_note']) {
        assert.ok(cols.includes(c), 'missing column: ' + c);
    }
});

test('create / get round-trip', () => {
    const a = createBanAppeal('g1', 'u1', 'user#1', 'appealing my ban', 'I was wrong, sorry');
    assert.ok(a.id);
    assert.strictEqual(a.status, 'pending');
    assert.strictEqual(a.guild_id, 'g1');
    assert.strictEqual(getBanAppeal(a.id).user_tag, 'user#1');
});

test('approve records reviewer, timestamp and note', () => {
    const a = createBanAppeal('g1', 'u2', 'user#2', 'reason', 'please');
    const before = Date.now();
    assert.strictEqual(updateBanAppealStatus(a.id, 'approved', 'mod#1', 'second chance'), true);
    const row = getBanAppeal(a.id);
    assert.strictEqual(row.status, 'approved');
    assert.strictEqual(row.reviewed_by, 'mod#1');
    assert.strictEqual(row.review_note, 'second chance');
    assert.ok(row.reviewed_at >= before);
});

test('deny without a note still records the reviewer', () => {
    const a = createBanAppeal('g1', 'u3', 'user#3', 'reason', 'let me back');
    assert.strictEqual(updateBanAppealStatus(a.id, 'denied', 'mod#2'), true);
    const row = getBanAppeal(a.id);
    assert.strictEqual(row.status, 'denied');
    assert.strictEqual(row.reviewed_by, 'mod#2');
    assert.strictEqual(row.review_note, null);
});

test('status-only update leaves review metadata untouched', () => {
    const a = createBanAppeal('g1', 'u4', 'user#4', 'reason', 'hi');
    updateBanAppealStatus(a.id, 'approved');
    const row = getBanAppeal(a.id);
    assert.strictEqual(row.status, 'approved');
    assert.strictEqual(row.reviewed_by, null);
});

test('invalid status is rejected', () => {
    const a = createBanAppeal('g1', 'u5', 'user#5', 'reason', 'hi');
    assert.throws(() => updateBanAppealStatus(a.id, 'unbanned-lol'), /Invalid status/);
    assert.strictEqual(getBanAppeal(a.id).status, 'pending');
});

test('updating a missing appeal reports no change', () => {
    assert.strictEqual(updateBanAppealStatus('does-not-exist', 'approved', 'mod#1'), false);
});

test('listing is scoped per guild and filterable by status', () => {
    createBanAppeal('g2', 'u9', 'user#9', 'reason', 'other guild');
    const g2 = getBanAppeals('g2');
    assert.strictEqual(g2.length, 1);
    assert.ok(getBanAppeals('g1').every(r => r.guild_id === 'g1'));
    assert.ok(getBanAppeals('g1', 'pending').every(r => r.status === 'pending'));
});

test('counts respect guild and status', () => {
    assert.strictEqual(getBanAppealCount('g2'), 1);
    assert.strictEqual(getBanAppealCount('g2', 'approved'), 0);
    assert.ok(getBanAppealCount('g1') >= 5);
});

test('delete removes the row', () => {
    const a = createBanAppeal('g3', 'u10', 'user#10', 'reason', 'bye');
    assert.strictEqual(deleteBanAppeal(a.id), true);
    assert.strictEqual(getBanAppeal(a.id), undefined);
    assert.strictEqual(deleteBanAppeal(a.id), false);
});
