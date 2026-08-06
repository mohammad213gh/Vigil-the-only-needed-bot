// Temp-isolated tests for the ticket cleanup helpers — the deleted-channel
// fixes: stale rows must not block new tickets, and deletion must close them.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tk-test-'));
process.env.DATA_DIR = tmp;

const { getDb, closeDb } = require('../src/db');
const { getBlockingOpenTicket, closeDeletedChannelTickets, handleTicketChannelDeleted } = require('../src/tickets');

// A guild whose channel cache never contains anything (all channels "deleted").
function makeGuild() {
    return { id: 'guild-1', channels: { cache: { get: () => null } } };
}

before(() => {
    const db = getDb();
    const ins = db.prepare(
        'INSERT INTO tickets (id, guild_id, ticket_number, channel_id, creator_id, creator_tag, status, created_at) VALUES (?,?,?,?,?,?,?,?)'
    );
    ins.run('t-stale-1', 'guild-1', 1, 'gone-ch-1', 'u1', 'User#1', 'open', Date.now() - 1000);
    ins.run('t-stale-2', 'guild-1', 2, 'gone-ch-2', 'u1', 'User#1', 'claimed', Date.now() - 1000);
    ins.run('t-live', 'guild-1', 3, 'live-ch', 'u2', 'User#2', 'open', Date.now() - 1000);
});

after(() => {
    try { closeDb(); } catch {}
    fs.rmSync(tmp, { recursive: true, force: true });
});

test('stale deleted-channel tickets do not block new ones', () => {
    const blocker = getBlockingOpenTicket(makeGuild(), 'u1');
    assert.strictEqual(blocker, null); // both stale → auto-closed → no blocker
    const rows = getDb().prepare("SELECT status FROM tickets WHERE id IN ('t-stale-1','t-stale-2')").all();
    assert.ok(rows.every(r => r.status === 'closed'));
});

test('a live open ticket still blocks', () => {
    const g = makeGuild();
    g.channels.cache.get = (id) => (id === 'live-ch' ? { id } : null);
    const blocker = getBlockingOpenTicket(g, 'u2');
    assert.ok(blocker && blocker.id === 't-live');
});

test('closeDeletedChannelTickets sweeps stale open tickets', () => {
    const closed = closeDeletedChannelTickets(makeGuild());
    assert.ok(closed >= 1); // t-live has a missing channel here too
});

test('channelDelete hook closes the matching ticket with the right reason', () => {
    const db = getDb();
    db.prepare("UPDATE tickets SET status='open' WHERE id='t-stale-1'").run();
    handleTicketChannelDeleted({ id: 'gone-ch-1', guild: makeGuild() });
    const row = db.prepare("SELECT status, closed_reason FROM tickets WHERE id='t-stale-1'").get();
    assert.strictEqual(row.status, 'closed');
    assert.strictEqual(row.closed_reason, 'Channel deleted');
});
