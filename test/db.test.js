// Temp-isolated tests for the db layer: error logs + database backups.
// Uses Node's built-in test runner (node --test) — no extra dependencies.
const { test, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Isolate BEFORE requiring db — DB_PATH is computed at module load.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dashdb-test-'));
process.env.DATA_DIR = tmp;

const {
    getDb, closeDb, recordErrorLog, getErrorLogs, getErrorTagCounts,
    clearErrorLogs, backupDatabase, listBackups, deleteBackup,
} = require('../src/db');

after(() => {
    try { closeDb(); } catch {}
    fs.rmSync(tmp, { recursive: true, force: true });
});

test('error log: records and reads newest-first', () => {
    recordErrorLog({ tag: 'events', message: 'boom', stack: 'Error: boom\n    at x', timestamp: new Date(Date.now() - 5000).toISOString() });
    recordErrorLog({ tag: 'dashboard', message: 'route fail', timestamp: new Date(Date.now() - 3000).toISOString() });
    recordErrorLog({ tag: 'unhandledRejection', message: 'rejected', timestamp: new Date(Date.now() - 1000).toISOString() });
    const all = getErrorLogs(10);
    assert.strictEqual(all.length, 3);
    assert.strictEqual(all[0].tag, 'unhandledRejection'); // newest first
    assert.ok(all[2].stack.includes('boom'));
});

test('error log: tag filter + counts', () => {
    const ev = getErrorLogs(10, 'events');
    assert.strictEqual(ev.length, 1);
    const counts = getErrorTagCounts(60);
    assert.ok(counts.some(c => c.tag === 'dashboard' && c.count === 1));
});

test('error log: clear by tag then all', () => {
    clearErrorLogs('events');
    assert.strictEqual(getErrorLogs(10, 'events').length, 0);
    clearErrorLogs();
    assert.strictEqual(getErrorLogs(10).length, 0);
});

test('error log: capped at 500 rows', () => {
    for (let i = 0; i < 510; i++) recordErrorLog({ tag: 'flood', message: 'm' + i, timestamp: new Date(Date.now() - i).toISOString() });
    assert.strictEqual(getErrorLogs(1000).length, 500);
    clearErrorLogs();
});

test('backups: create, list, delete round-trip', () => {
    const b = backupDatabase();
    assert.ok(b && /^bot-\d{14}\.db$/.test(b.name));
    assert.ok(listBackups().some(x => x.name === b.name));
    assert.ok(deleteBackup(b.name));
    assert.ok(!listBackups().some(x => x.name === b.name));
});

test('backups: invalid names rejected (path-traversal guard)', () => {
    assert.strictEqual(deleteBackup('../../evil.db'), false);
    assert.strictEqual(deleteBackup('bot-notadate.db'), false);
});

test('backups: only newest 7 are kept', () => {
    for (let i = 0; i < 10; i++) backupDatabase();
    assert.ok(listBackups().length <= 7);
    for (const b of listBackups()) deleteBackup(b.name);
});

test('db is usable after all that', () => {
    const db = getDb();
    assert.ok(db.prepare('SELECT 1 AS ok').get().ok === 1);
});
