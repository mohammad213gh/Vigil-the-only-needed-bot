// Temp-isolated tests for the voice presence module: status formatting,
// channel validation, DB lifecycle, and the join save/rollback behavior.
const { test, after } = require('node:test');
const assert = require('node:assert');
const { ActivityType } = require('discord.js');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vp-test-'));
process.env.DATA_DIR = tmp;

const { getDb, closeDb } = require('../src/db');
const vp = require('../src/voicePresence');

after(() => {
    try { closeDb(); } catch {}
    fs.rmSync(tmp, { recursive: true, force: true });
});

// ── Mocks ──
function makeVoiceChannel(id, name) {
    return { id, name, type: 2 }; // GuildVoice
}
function makeBotMember({ channelId = null, fail = false } = {}) {
    const me = {
        voice: {
            channelId,
            async setChannel(ch) {
                if (fail) { const e = new Error('setChannel failed'); throw e; }
                this.channelId = ch.id;
            },
            async disconnect() { this.channelId = null; },
        },
    };
    return me;
}
function makeGuild(opts = {}) {
    return {
        id: opts.id || 'g1',
        members: { me: opts.me !== undefined ? opts.me : makeBotMember() },
        channels: { cache: new Map() },
    };
}

// ── formatStatus ──
test('formatStatus uses custom status, trimmed and capped at 128', () => {
    assert.strictEqual(vp.formatStatus('  chill vibes  ', 'Lounge'), 'chill vibes');
    assert.strictEqual(vp.formatStatus('x'.repeat(200), 'Lounge'), 'x'.repeat(128));
});
test('formatStatus falls back to the channel name', () => {
    assert.strictEqual(vp.formatStatus('', 'Lounge'), 'Lounge');
    assert.strictEqual(vp.formatStatus(null, 'Lounge'), 'Lounge');
    assert.strictEqual(vp.formatStatus(undefined, 'Lounge'), 'Lounge');
});
test('formatStatus ultimate fallback when both empty', () => {
    assert.strictEqual(vp.formatStatus('', ''), 'the voice channel');
});

// ── isVoiceChannel ──
test('isVoiceChannel only accepts voice channels', () => {
    assert.strictEqual(vp.isVoiceChannel(makeVoiceChannel('vc1', 'Lounge')), true);
    assert.strictEqual(vp.isVoiceChannel({ id: 't1', name: 'general', type: 0 }), false);
    assert.strictEqual(vp.isVoiceChannel(null), false);
    assert.strictEqual(vp.isVoiceChannel({ type: 2 }), false); // missing id
});

// ── DB lifecycle ──
test('savePresence / getPresence / clearPresence roundtrip', () => {
    vp.savePresence('g1', 'vc1', 'aura');
    let p = vp.getPresence('g1');
    assert.strictEqual(p.channel_id, 'vc1');
    assert.strictEqual(p.status, 'aura');

    // Overwrite moves the channel and nulls the status
    vp.savePresence('g1', 'vc2', null);
    p = vp.getPresence('g1');
    assert.strictEqual(p.channel_id, 'vc2');
    assert.strictEqual(p.status, null);

    vp.clearPresence('g1');
    assert.strictEqual(vp.getPresence('g1'), null);
});
test('getPresence is per-guild', () => {
    vp.savePresence('gA', 'vc1', 'x');
    vp.savePresence('gB', 'vc2', 'y');
    assert.strictEqual(vp.getPresence('gA').channel_id, 'vc1');
    assert.strictEqual(vp.getPresence('gB').channel_id, 'vc2');
    vp.clearPresence('gA');
    vp.clearPresence('gB');
});

// ── joinChannel ──
test('joinChannel saves presence then moves the bot', async () => {
    const guild = makeGuild();
    const vc = makeVoiceChannel('vc1', 'Lounge');
    await vp.joinChannel(guild, vc, null);
    assert.strictEqual(guild.members.me.voice.channelId, 'vc1');
    assert.strictEqual(vp.getPresence('g1').channel_id, 'vc1');
    assert.strictEqual(vp.getPresence('g1').status, null);
    vp.clearPresence('g1');
});
test('joinChannel rejects non-voice channels', async () => {
    const guild = makeGuild();
    await assert.rejects(vp.joinChannel(guild, { id: 't1', type: 0 }, null), (e) => e.code === 'NOT_VOICE');
});
test('joinChannel rejects when the bot member is not loaded', async () => {
    const guild = makeGuild({ me: null });
    await assert.rejects(vp.joinChannel(guild, makeVoiceChannel('vc1', 'L'), null), (e) => e.code === 'NO_MEMBER');
});
test('joinChannel rolls back the saved presence when the move fails', async () => {
    vp.savePresence('g1', 'vc0', 'old status');
    const guild = makeGuild({ me: makeBotMember({ channelId: 'vc0', fail: true }) });
    await assert.rejects(vp.joinChannel(guild, makeVoiceChannel('vc1', 'New'), null));
    const p = vp.getPresence('g1');
    assert.strictEqual(p.channel_id, 'vc0');
    assert.strictEqual(p.status, 'old status');
    vp.clearPresence('g1');
});
test('joinChannel is a no-op error when already in the channel', async () => {
    const guild = makeGuild({ me: makeBotMember({ channelId: 'vc1' }) });
    await assert.rejects(vp.joinChannel(guild, makeVoiceChannel('vc1', 'L'), null), (e) => e.code === 'ALREADY_THERE');
});

// ── moveChannel ──
test('moveChannel requires an existing presence and moves the bot', async () => {
    const guild = makeGuild({ me: makeBotMember({ channelId: 'vc0' }) });
    await assert.rejects(vp.moveChannel(guild, makeVoiceChannel('vc1', 'L'), null), (e) => e.code === 'NOT_IN_VC');
    vp.savePresence('g1', 'vc0', 'aura');
    await vp.moveChannel(guild, makeVoiceChannel('vc1', 'Lounge'));
    assert.strictEqual(guild.members.me.voice.channelId, 'vc1');
    assert.strictEqual(vp.getPresence('g1').channel_id, 'vc1');
    assert.strictEqual(vp.getPresence('g1').status, 'aura'); // status carried over
    vp.clearPresence('g1');
});

// ── setStatusText ──
test('setStatusText updates and resets the stored status', async () => {
    vp.savePresence('g1', 'vc1', null);
    const guild = makeGuild({ me: makeBotMember({ channelId: 'vc1' }) });
    const clean = await vp.setStatusText(guild, '  chill vibes  ');
    assert.strictEqual(clean, 'chill vibes');
    assert.strictEqual(vp.getPresence('g1').status, 'chill vibes');
    const reset = await vp.setStatusText(guild, '');
    assert.strictEqual(reset, null);
    assert.strictEqual(vp.getPresence('g1').status, null);
    vp.clearPresence('g1');
});
test('setStatusText requires the bot to be in a VC', async () => {
    await assert.rejects(vp.setStatusText(makeGuild(), 'x'), (e) => e.code === 'NOT_IN_VC');
});

// ── @discordjs/voice wiring ──
test('enableDiscordJsVoice turns on the idle-join implementation', () => {
    const ok = vp.enableDiscordJsVoice();
    assert.strictEqual(ok, true, '@discordjs/voice should be installed');
    vp.resetVoiceImpl(); // don\'t leak the real impl into the other tests
});
test('connectVoice falls back to the VoiceState move when no impl is enabled', async () => {
    vp.resetVoiceImpl();
    const guild = makeGuild();
    const vc = makeVoiceChannel('vc9', 'Lounge');
    await vp.connectVoice(guild, vc);
    assert.strictEqual(guild.members.me.voice.channelId, 'vc9', 'fallback should move the bot via VoiceState');
});

// ── leaveChannel ──
test('leaveChannel clears the presence and disconnects', async () => {
    const guild = makeGuild({ me: makeBotMember({ channelId: 'vc1' }) });
    vp.savePresence('g1', 'vc1', 'aura');
    await vp.leaveChannel(guild);
    assert.strictEqual(vp.getPresence('g1'), null);
    assert.strictEqual(guild.members.me.voice.channelId, null);
});

// ── Activity snapshot / restore ──
test('updateActivity snapshots the pre-VC activity and clearActivity restores it', async () => {
    let recorded = null;
    const mockClient = {
        user: {
            id: 'bot1',
            presence: { activities: [{ name: 'World Cup 2026', type: 0, state: null, url: null }] },
            async setPresence(p) { recorded = p; },
        },
    };
    vp.setVoiceClient(mockClient);
    try {
        const guild = makeGuild();
        await vp.updateActivity(guild, makeVoiceChannel('vc1', 'Lounge'), 'chill vibes');
        assert.deepStrictEqual(recorded.activities, [{ name: 'chill vibes', type: ActivityType.Listening }]);
        await vp.clearActivity();
        assert.deepStrictEqual(recorded.activities, [{ name: 'World Cup 2026', type: 0, state: null, url: null }]);
    } finally {
        vp.setVoiceClient(null);
    }
});

// ── Rejoin self-heal (mock timers) ──
test('handleBotVoiceUpdate rejoins with backoff after a disconnect', async () => {
    const { mock } = require('node:test');
    mock.timers.enable({ apis: ['setTimeout'] });
    const mockClient = { user: { id: 'bot1', presence: null, async setPresence() {} } };
    vp.setVoiceClient(mockClient);
    try {
        const me = makeBotMember({ channelId: 'vc1' });
        me.voice.channelId = null; // disconnected
        const guild = { id: 'g1', members: { me }, channels: { cache: new Map() } };
        guild.channels.cache.set('vc1', makeVoiceChannel('vc1', 'Lounge'));
        vp.savePresence('g1', 'vc1', 'aura');

        // Bot got kicked: connected (vc1) → disconnected.
        const oldState = { member: { id: 'bot1' }, guild, channelId: 'vc1' };
        const newState = { member: { id: 'bot1' }, guild, channelId: null };
        vp.handleBotVoiceUpdate(oldState, newState);

        // First attempt after 5s — should reconnect. Flush microtasks after
        // ticking so the async timer callback (and any reschedule) completes.
        mock.timers.tick(5000);
        await Promise.resolve();
        assert.strictEqual(me.voice.channelId, 'vc1', 'bot should have rejoined after 5s');
        assert.strictEqual(vp.getPresence('g1').channel_id, 'vc1');
    } finally {
        mock.timers.reset();
        vp.setVoiceClient(null);
        vp.clearPresence('g1');
        vp.stopVoicePresence();
    }
});

test('rejoin gives up and clears presence after the attempt cap', async () => {
    const { mock } = require('node:test');
    mock.timers.enable({ apis: ['setTimeout'] });
    const mockClient = { user: { id: 'bot1', presence: null, async setPresence() {} } };
    vp.setVoiceClient(mockClient);
    try {
        const me = makeBotMember({ channelId: null, fail: true }); // setChannel always throws
        const guild = { id: 'g1', members: { me }, channels: { cache: new Map() } };
        guild.channels.cache.set('vc1', makeVoiceChannel('vc1', 'Lounge'));
        vp.savePresence('g1', 'vc1', 'aura');

        vp.handleBotVoiceUpdate(
            { member: { id: 'bot1' }, guild, channelId: 'vc1' },
            { member: { id: 'bot1' }, guild, channelId: null },
        );

        // Attempts at 5s, 10s, 20s, 40s, 80s. After the 5th failure the
        // presence row should be dropped (no more rejoining a dead setup).
        // Flush microtasks after every tick so each async failure handler
        // (which reschedules) runs before the next tick.
        const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
        mock.timers.tick(5000);
        await flush();
        mock.timers.tick(10000);
        await flush();
        mock.timers.tick(20000);
        await flush();
        mock.timers.tick(40000);
        await flush();
        assert.strictEqual(vp.getPresence('g1').channel_id, 'vc1', 'still present before the last attempt');
        mock.timers.tick(80000);
        await flush();
        assert.strictEqual(vp.getPresence('g1'), null, 'presence cleared after the cap');
    } finally {
        mock.timers.reset();
        vp.setVoiceClient(null);
        vp.clearPresence('g1');
        vp.stopVoicePresence();
    }
});
