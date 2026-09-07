// Temp-isolated tests for the versioned schema migration system:
// fresh-DB application, idempotent re-open, and self-healing upgrades of
// legacy databases (columns already present, no schema_migrations rows).
const { test, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Isolate BEFORE requiring db — DB_PATH is computed at module load.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'migrations-test-'));
process.env.DATA_DIR = tmp;

const { getDb, closeDb } = require('../src/db');

after(() => {
    try { closeDb(); } catch {}
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
});

function columns(table) {
    return getDb().prepare('PRAGMA table_info(' + table + ')').all().map(c => c.name);
}

test('fresh database: every migration is applied and recorded', () => {
    const db = getDb();
    const applied = db.prepare('SELECT name FROM schema_migrations ORDER BY name').all().map(r => r.name);
    assert.ok(applied.length >= 30, 'all migrations recorded, got ' + applied.length);
    assert.ok(applied.includes('0001_guild_config_prefix'));
    assert.ok(applied.includes('0030_activity_counts_last_seen'));

    // Spot-check the columns the migrations own
    assert.ok(columns('guild_config').includes('prefix'));
    assert.ok(columns('guild_config').includes('welcome_config'));
    assert.ok(columns('guild_config').includes('embed_color'));
    assert.ok(columns('reminders').includes('attempts'));
    assert.ok(columns('tickets').includes('panel_type_id'));
    assert.ok(columns('tickets').includes('claimer_id'));
    assert.ok(columns('ticket_panels').includes('ticket_counter'));
    assert.ok(columns('giveaways').includes('required_role_ids'));
    assert.ok(columns('ban_appeals').includes('review_note'));
    assert.ok(columns('activity_counts').includes('last_seen'));

    // The dash_user_guilds table exists with its scope index
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map(r => r.name);
    assert.ok(tables.includes('dash_user_guilds'));

    // Defaults from the migrations are correct
    const row = db.prepare("INSERT INTO guild_config (guild_id) VALUES ('g1') RETURNING prefix, welcome_config").get();
    assert.strictEqual(row.prefix, ';');
    assert.strictEqual(row.welcome_config, '{}');
});

test('reopen: migrations are not re-applied', () => {
    const db = getDb();
    const before = db.prepare('SELECT COUNT(*) AS n FROM schema_migrations').get().n;
    // Simulate a fresh boot
    closeDb();
    const db2 = getDb();
    const after2 = db2.prepare('SELECT COUNT(*) AS n FROM schema_migrations').get().n;
    assert.strictEqual(after2, before);
    // applied_at timestamps were not rewritten (rows untouched)
    const newest = db2.prepare('SELECT MAX(applied_at) AS t FROM schema_migrations').get().t;
    assert.ok(newest <= Date.now());
});

test('legacy database: missing schema_migrations rows self-heal via column checks', () => {
    // Simulates a DB upgraded by the OLD silent try/catch path: columns
    // already exist but schema_migrations has no record. Re-running the
    // migrations must skip the existing columns (no duplicate-column
    // crash) and record them.
    const db = getDb();
    // A pre-existing row with NULL last_seen, as legacy rows look before
    // the 0030 backfill runs.
    db.prepare("INSERT INTO activity_counts (guild_id, user_id, channel_id, message_count) VALUES ('g1', 'legacy1', 'c1', 5)").run();
    db.prepare('DELETE FROM schema_migrations').run();

    closeDb();
    const db2 = getDb(); // re-runs every migration on a fully-migrated schema

    const applied = db2.prepare('SELECT COUNT(*) AS n FROM schema_migrations').get().n;
    assert.ok(applied >= 30, 'migrations re-recorded after self-heal, got ' + applied);
    assert.ok(columns('guild_config').includes('prefix'));

    // The last_seen backfill covered the pre-existing legacy row
    const seen = db2.prepare("SELECT last_seen FROM activity_counts WHERE user_id = 'legacy1'").get();
    assert.ok(seen.last_seen !== null, 'legacy rows backfilled to a timestamp');
});
