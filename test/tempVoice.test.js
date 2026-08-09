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

test('joining a trigger moves the owner back to an in-use channel instead of duplicating', async () => {
    const trigger = makeVoiceChannel('trig1', 'Join to Create');
    const existing = makeVoiceChannel('sp1', 'Aya\'s channel');
    const guild = makeGuild({ channels: [trigger, existing] });
    const member = makeMember('u1', 'Aya', { vcId: 'trig1' });
    existing.members.set('u1', member); // channel still has people in it
    tv.setTrigger('g1', 'trig1', null);
    tv.addSpawned('sp1', 'g1', 'u1', 'trig1');

    tv.handleVoiceStateUpdate(
        { guild, member, channelId: null },
        { guild, member, channelId: 'trig1' },
    );
    await flush();

    assert.deepStrictEqual(member.voice.moves, ['sp1'], 'should be moved back to the in-use channel');
    assert.strictEqual(tv.getSpawned('g1').length, 1, 'no duplicate spawned');
    tv.removeSpawned('sp1');
});

test('an EMPTY existing channel is not reused — a fresh one spawns and the old one gets deleted', async () => {
    const { mock } = require('node:test');
    mock.timers.enable({ apis: ['setTimeout'] });
    try {
        const trigger = makeVoiceChannel('trig1', 'Join to Create');
        const existing = makeVoiceChannel('sp1', 'Aya\'s channel'); // empty
        let created = null;
        const guild = makeGuild({
            channels: [trigger, existing],
            create: async (opts) => { created = makeVoiceChannel('sp2', opts.name); guild.channels.cache.set('sp2', created); return created; },
        });
        const member = makeMember('u1', 'Aya', { vcId: 'trig1' });
        tv.setTrigger('g1', 'trig1', null);
        tv.addSpawned('sp1', 'g1', 'u1', 'trig1');

        tv.handleVoiceStateUpdate(
            { guild, member, channelId: null },
            { guild, member, channelId: 'trig1' },
        );
        await flush();

        assert.ok(created, 'a fresh channel should spawn');
        assert.strictEqual(member.voice.channelId, 'sp2', 'member moved into the fresh channel');
        assert.strictEqual(tv.getSpawned('g1')[0].channel_id, 'sp2', 'row now points at the fresh channel');
        // The old empty channel is scheduled for deletion.
        mock.timers.tick(6000);
        await flush();
        assert.strictEqual(existing.deleted, true, 'old empty channel deleted after the grace period');
        tv.removeSpawned('sp2');
    } finally {
        mock.timers.reset();
        tv.stopTempVoice();
    }
});

test('spawned channel names are deduplicated', async () => {
    const trigger = makeVoiceChannel('trig1', 'Join to Create');
    const existing = makeVoiceChannel('sp1', 'Aya\'s channel');
    let created = null;
    const guild = makeGuild({
        channels: [trigger, existing],
        create: async (opts) => { created = makeVoiceChannel('sp2', opts.name); guild.channels.cache.set('sp2', created); return created; },
    });
    const member = makeMember('u1', 'Aya', { vcId: 'trig1' });
    tv.setTrigger('g1', 'trig1', null);

    tv.handleVoiceStateUpdate(
        { guild, member, channelId: null },
        { guild, member, channelId: 'trig1' },
    );
    await flush();

    assert.strictEqual(created.name, 'Aya\'s channel 2', 'duplicate name should get a number suffix');
    assert.strictEqual(tv.getSpawned('g1').length, 1);
    tv.removeSpawned('sp2');
});

test('spawnChannel inherits the trigger bitrate and user limit', async () => {
    const trigger = makeVoiceChannel('trig1', 'Join to Create');
    trigger.bitrate = 384000;
    trigger.userLimit = 8;
    let createdOpts = null;
    const guild = makeGuild({
        channels: [trigger],
        create: async (opts) => { createdOpts = opts; const ch = makeVoiceChannel('sp1', opts.name); guild.channels.cache.set('sp1', ch); return ch; },
    });
    const member = makeMember('u1', 'Aya', { vcId: 'trig1' });
    tv.setTrigger('g1', 'trig1', null);

    tv.handleVoiceStateUpdate(
        { guild, member, channelId: null },
        { guild, member, channelId: 'trig1' },
    );
    await flush();

    assert.strictEqual(createdOpts.bitrate, 384000);
    assert.strictEqual(createdOpts.userLimit, 8);
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

// ── createForMember (panel button) ──
test('createForMember spawns a channel from the first trigger', async () => {
    const trigger = makeVoiceChannel('trig1', 'Join to Create');
    let created = null;
    const guild = makeGuild({
        channels: [trigger],
        create: async (opts) => { created = makeVoiceChannel('sp1', opts.name); guild.channels.cache.set('sp1', created); return created; },
    });
    const member = makeMember('u1', 'Aya', { vcId: 'trig1' }); // already in the trigger
    tv.setTrigger('g1', 'trig1', null);

    const res = await tv.createForMember(guild, member);
    assert.strictEqual(res.created, true);
    assert.strictEqual(member.voice.channelId, 'sp1');
    assert.strictEqual(tv.getSpawned('g1')[0].owner_id, 'u1');
    tv.removeSpawned('sp1');
});

test('createForMember errors when no trigger is configured', async () => {
    const guild = makeGuild({ id: 'gNoTrig' }); // fresh guild with no trigger row
    const member = makeMember('u1', 'Aya', { vcId: 'trig1' });
    await assert.rejects(tv.createForMember(guild, member), (e) => e.code === 'NO_TRIGGER');
});

test('createForMember errors when the member is not in any voice channel', async () => {
    const trigger = makeVoiceChannel('trig1', 'Join to Create');
    const guild = makeGuild({ channels: [trigger] });
    tv.setTrigger('g1', 'trig1', null);
    // Idle member — the bot can only MOVE connected users into a VC.
    await assert.rejects(tv.createForMember(guild, makeMember('u1', 'Aya')), (e) => e.code === 'NOT_IN_VC');
    tv.removeTrigger('g1', 'trig1');
});

test('createForMember moves the user back to their in-use channel', async () => {
    const trigger = makeVoiceChannel('trig1', 'Join to Create');
    const existing = makeVoiceChannel('sp1', 'Aya\'s channel');
    const guild = makeGuild({ channels: [trigger, existing] });
    const member = makeMember('u1', 'Aya', { vcId: 'sp1' });
    existing.members.set('u1', member);
    tv.setTrigger('g1', 'trig1', null);
    tv.addSpawned('sp1', 'g1', 'u1', 'trig1');

    const res = await tv.createForMember(guild, member);
    assert.strictEqual(res.reused, true);
    assert.strictEqual(res.channel.id, 'sp1');
    assert.strictEqual(member.voice.channelId, 'sp1');
    tv.removeSpawned('sp1');
});

// ── deleteOwnedChannel (panel button) ──
test('deleteOwnedChannel deletes the owner\'s channel and drops the row', async () => {
    const spawned = makeVoiceChannel('sp1', 'Aya\'s channel');
    const guild = makeGuild({ channels: [spawned] });
    tv.addSpawned('sp1', 'g1', 'u1', 'trig1');

    await tv.deleteOwnedChannel(guild, 'u1');
    assert.strictEqual(spawned.deleted, true);
    assert.strictEqual(tv.getSpawned('g1').length, 0);
});

test('deleteOwnedChannel errors when the user has no channel', async () => {
    const guild = makeGuild();
    await assert.rejects(tv.deleteOwnedChannel(guild, 'u9'), (e) => e.code === 'NONE');
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
