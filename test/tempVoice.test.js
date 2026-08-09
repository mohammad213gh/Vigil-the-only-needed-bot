// Temp-isolated tests for the temp voice channels module: template
// formatting, DB lifecycle, spawn-on-join, auto-delete, and cancel-on-rejoin.
const { test, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tvc-test-'));
process.env.DATA_DIR = tmp;

const { getDb, closeDb } = require('../src/db');
const tv = require('../src/tempVoice');

after(() => {
    try { closeDb(); } catch {}
    fs.rmSync(tmp, { recursive: true, force: true });
});

// ── Mocks ──
function makeVoiceChannel(id, name) {
    const members = new Map();
    return {
        id,
        name,
        type: 2,
        members,
        deleted: false,
        async delete(reason) { this.deleted = true; },
        async setName(n) { this.name = n; },
        async setUserLimit() {},
        permissionOverwrites: { cache: new Map(), async edit() {}, async delete() {} },
    };
}
function makeMember(id, username, { vcId = null } = {}) {
    return {
        id,
        user: { id, username, tag: username, bot: false },
        voice: {
            channelId: vcId,
            moves: [],
            async setChannel(ch) { this.channelId = ch.id; this.moves.push(ch.id); },
        },
    };
}
function makeGuild(opts = {}) {
    const channels = new Map();
    for (const c of (opts.channels || [])) channels.set(c.id, c);
    return {
        id: opts.id || 'g1',
        channels: {
            cache: channels,
            create: opts.create || (async () => { throw new Error('no create mock'); }),
        },
        members: { cache: new Map() },
        roles: { everyone: { id: 'everyone' } },
    };
}
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await new Promise(r => setImmediate(r)); };

// ── formatTemplate ──
test('formatTemplate substitutes {name} and {number}', () => {
    assert.strictEqual(tv.formatTemplate('{name}\'s channel', 'Aya', 1), 'Aya\'s channel');
    assert.strictEqual(tv.formatTemplate('{name} • {number}', 'Aya', 3), 'Aya • 3');
    assert.strictEqual(tv.formatTemplate('{name}\'s channel', 'Aya', 0), 'Aya\'s channel'); // 0 → 1
});
test('formatTemplate falls back to defaults and caps length', () => {
    assert.strictEqual(tv.formatTemplate(null, 'Aya', 1), 'Aya\'s channel');
    assert.strictEqual(tv.formatTemplate('{unknown}', 'Aya', 1), '{unknown}');
    const long = tv.formatTemplate('{name}', 'x'.repeat(300), 1);
    assert.strictEqual(long.length, 100);
});

// ── DB lifecycle ──
test('config get/set roundtrip with default', () => {
    assert.strictEqual(tv.getConfig('g1').name_template, tv.DEFAULT_TEMPLATE);
    tv.setConfig('g1', '{name} • VC {number}');
    assert.strictEqual(tv.getConfig('g1').name_template, '{name} • VC {number}');
    tv.setConfig('g1', '');
    assert.strictEqual(tv.getConfig('g1').name_template, tv.DEFAULT_TEMPLATE);
});
test('trigger and spawned channel CRUD', () => {
    tv.setTrigger('g1', 'trig1', 'cat1');
    assert.ok(tv.getTriggerForChannel('g1', 'trig1'));
    assert.strictEqual(tv.getTriggers('g1').length, 1);
    tv.removeTrigger('g1', 'trig1');
    assert.strictEqual(tv.getTriggers('g1').length, 0);

    tv.addSpawned('sp1', 'g1', 'u1', 'trig1');
    assert.strictEqual(tv.getSpawned('g1').length, 1);
    assert.strictEqual(tv.getSpawnedChannel('sp1').owner_id, 'u1');
    assert.strictEqual(tv.getSpawnedByOwner('g1', 'u1').channel_id, 'sp1');
    tv.removeSpawned('sp1');
    assert.strictEqual(tv.getSpawned('g1').length, 0);
});

// ── Spawn on join ──
test('joining a trigger spawns a channel and moves the member', async () => {
    const trigger = makeVoiceChannel('trig1', 'Join to Create');
    let createdChannel = null;
    const guild = makeGuild({
        channels: [trigger],
        create: async (opts) => {
            createdChannel = makeVoiceChannel('sp1', opts.name);
            guild.channels.cache.set('sp1', createdChannel);
            return createdChannel;
        },
    });
    const member = makeMember('u1', 'Aya', { vcId: 'trig1' });
    tv.setTrigger('g1', 'trig1', null);

    tv.handleVoiceStateUpdate(
        { guild, member, channelId: null },
        { guild, member, channelId: 'trig1' },
    );
    await flush();

    assert.ok(createdChannel, 'channel should be created');
    assert.strictEqual(createdChannel.name, 'Aya\'s channel');
    assert.strictEqual(member.voice.channelId, 'sp1', 'member should be moved in');
    assert.strictEqual(tv.getSpawned('g1').length, 1);
    assert.strictEqual(tv.getSpawned('g1')[0].owner_id, 'u1');
    tv.removeSpawned('sp1');
});

test('joining a trigger moves an existing owner back instead of duplicating', async () => {
    const trigger = makeVoiceChannel('trig1', 'Join to Create');
    const existing = makeVoiceChannel('sp1', 'Aya\'s channel');
    const guild = makeGuild({ channels: [trigger, existing] });
    const member = makeMember('u1', 'Aya', { vcId: 'trig1' });
    tv.setTrigger('g1', 'trig1', null);
    tv.addSpawned('sp1', 'g1', 'u1', 'trig1');

    tv.handleVoiceStateUpdate(
        { guild, member, channelId: null },
        { guild, member, channelId: 'trig1' },
    );
    await flush();

    assert.deepStrictEqual(member.voice.moves, ['sp1'], 'should be moved to the existing channel');
    assert.strictEqual(tv.getSpawned('g1').length, 1, 'no duplicate spawned');
    tv.removeSpawned('sp1');
});

// ── Auto-delete when empty ──
test('leaving an empty spawned channel deletes it after the grace delay', async () => {
    const { mock } = require('node:test');
    mock.timers.enable({ apis: ['setTimeout'] });
    try {
        const spawned = makeVoiceChannel('sp1', 'Aya\'s channel');
        const guild = makeGuild({ channels: [spawned] });
        tv.addSpawned('sp1', 'g1', 'u1', 'trig1');

        const member = makeMember('u1', 'Aya', { vcId: 'sp1' });
        spawned.members.set('u1', member);
        spawned.members.delete('u1'); // they've left — the channel is now empty
        // Member leaves: still in the channel in oldState, gone in newState.
        tv.handleVoiceStateUpdate(
            { guild, member, channelId: 'sp1' },
            { guild, member, channelId: null },
        );
        await flush();
        // Grace period hasn't elapsed — channel still alive.
        mock.timers.tick(1000);
        await flush();
        assert.strictEqual(spawned.deleted, false, 'not deleted during the grace period');

        mock.timers.tick(5000);
        await flush();
        assert.strictEqual(spawned.deleted, true, 'deleted once empty for > grace period');
        assert.strictEqual(tv.getSpawned('g1').length, 0, 'row removed');
    } finally {
        mock.timers.reset();
        tv.stopTempVoice();
    }
});

test('rejoining a spawned channel cancels the pending deletion', async () => {
    const { mock } = require('node:test');
    mock.timers.enable({ apis: ['setTimeout'] });
    try {
        const spawned = makeVoiceChannel('sp1', 'Aya\'s channel');
        const guild = makeGuild({ channels: [spawned] });
        tv.addSpawned('sp1', 'g1', 'u1', 'trig1');

        const member = makeMember('u1', 'Aya', { vcId: 'sp1' });
        spawned.members.set('u1', member);
        spawned.members.delete('u1'); // they've left — the channel is now empty
        // Member leaves → deletion scheduled.
        tv.handleVoiceStateUpdate(
            { guild, member, channelId: 'sp1' },
            { guild, member, channelId: null },
        );
        await flush();

        // Someone joins before the timer fires → cancel.
        spawned.members.set('u2', { id: 'u2' });
        const member2 = makeMember('u2', 'Ben', { vcId: 'sp1' });
        tv.handleVoiceStateUpdate(
            { guild, member: member2, channelId: null },
            { guild, member: member2, channelId: 'sp1' },
        );
        await flush();

        mock.timers.tick(10000);
        await flush();
        assert.strictEqual(spawned.deleted, false, 'deletion should have been cancelled');
        assert.strictEqual(tv.getSpawned('g1').length, 1, 'row still present');
        spawned.members.clear();
        tv.removeSpawned('sp1');
    } finally {
        mock.timers.reset();
        tv.stopTempVoice();
    }
});

// ── cleanupOrphans ──
test('cleanupOrphans deletes empty spawned channels and drops stale rows', async () => {
    const empty = makeVoiceChannel('spEmpty', 'Empty VC');
    const busy = makeVoiceChannel('spBusy', 'Busy VC');
    busy.members.set('u1', { id: 'u1' });
    const guild = makeGuild({ channels: [empty, busy] });
    tv.addSpawned('spEmpty', 'g1', 'u1', 'trig1');
    tv.addSpawned('spBusy', 'g1', 'u2', 'trig1');
    tv.addSpawned('spGone', 'g1', 'u3', 'trig1'); // no channel in cache
    // Age the rows past the 60s safety window so the sweep considers them.
    getDb().prepare('UPDATE temp_vc_channels SET created_at = ?').run(Date.now() - 120000);

    const client = { guilds: { cache: new Map([['g1', guild]]) } };
    await tv.cleanupOrphans(client);

    assert.strictEqual(empty.deleted, true, 'empty channel deleted');
    assert.strictEqual(busy.deleted, false, 'busy channel kept');
    const remaining = tv.getSpawned('g1');
    assert.strictEqual(remaining.length, 1);
    assert.strictEqual(remaining[0].channel_id, 'spBusy');
    tv.removeSpawned('spBusy');
});

test('cleanupOrphans spares channels spawned within the last minute', async () => {
    const fresh = makeVoiceChannel('spFresh', 'Fresh VC'); // empty, but brand new
    const guild = makeGuild({ channels: [fresh] });
    tv.addSpawned('spFresh', 'g1', 'u1', 'trig1'); // created_at = now
    const client = { guilds: { cache: new Map([['g1', guild]]) } };
    await tv.cleanupOrphans(client);
    assert.strictEqual(fresh.deleted, false, 'fresh channel must survive the sweep');
    assert.strictEqual(tv.getSpawned('g1').length, 1);
    tv.removeSpawned('spFresh');
});
