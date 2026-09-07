// Security tests for the dashboard: cookie flags, owner gating, fail-closed
// tenant scoping, session expiry (idle TTL + absolute cap), and access
// revocation. Complements test/dashboard.test.js (health) — this file
// exercises the guards that keep a leaked cookie or scoped user contained.
const { test, after } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Collection } = require('discord.js');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dashboard-auth-test-'));
process.env.DATA_DIR = tmp;
process.env.UPLOADS_DIR = path.join(tmp, 'uploads');
process.env.OWNER_ID = 'owner-user';

const { createDashboard, setDashboardClient, addDashUser, removeDashUser } = require('../src/dashboard');
const { sessions, generateSession, SESSION_TTL_MS } = require('../src/dashboard-backend/core');
const { getDb, closeDb } = require('../src/db');

function makeGuild(id, name) {
    return {
        id, name, memberCount: 10, premiumTier: 1, premiumSubscriptionCount: 0,
        iconURL: () => null,
        channels: { cache: new Collection() },
        roles: { cache: new Collection() },
        members: { cache: new Collection() },
    };
}
const guildA = makeGuild('guild-aaa', 'Granted Guild');
const guildB = makeGuild('guild-bbb', 'Secret Guild');
setDashboardClient({ guilds: { cache: new Collection([['guild-aaa', guildA], ['guild-bbb', guildB]]) }, user: null, ws: { ping: 1 } }, 'test-password');

const app = createDashboard();
const server = http.createServer(app);

function request(method, p, { body, headers } = {}) {
    return new Promise((resolve, reject) => {
        const data = body === undefined ? null : JSON.stringify(body);
        const req = http.request({
            host: '127.0.0.1', port: PORT, path: p, method,
            headers: {
                ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}),
                ...headers,
            },
        }, res => {
            let d = '';
            res.on('data', c => d += c);
            res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: d }));
        });
        req.on('error', reject);
        if (data) req.write(data);
        req.end();
    });
}

let PORT;

after(async () => {
    closeDb();
    server.closeAllConnections?.();
    await new Promise(resolve => server.close(resolve));
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
});

function cookieFrom(res) {
    return (res.headers['set-cookie'] || [''])[0].split(';')[0];
}

test('setup: server listening', async () => {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    PORT = server.address().port;
});

test('bad password returns 401 and sets no cookie', async () => {
    const res = await request('POST', '/api/login', { body: { password: 'wrong' } });
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.headers['set-cookie'], undefined);
});

test('password login sets HttpOnly, Strict SameSite cookie; Secure appears behind TLS proxy', async () => {
    const res = await request('POST', '/api/login', { body: { password: 'test-password' } });
    assert.strictEqual(res.status, 200);
    const cookie = (res.headers['set-cookie'] || [''])[0];
    assert.ok(cookie.includes('HttpOnly'), 'cookie must be HttpOnly');
    assert.ok(/SameSite=Strict/i.test(cookie), 'cookie must be SameSite=Strict');

    const tls = await request('POST', '/api/login', {
        body: { password: 'test-password' },
        headers: { 'x-forwarded-proto': 'https' },
    });
    const tlsCookie = (tls.headers['set-cookie'] || [''])[0];
    assert.ok(/Secure/i.test(tlsCookie), 'cookie must gain Secure when served over TLS');
});

test('authenticated request works with the session cookie', async () => {
    const login = await request('POST', '/api/login', { body: { password: 'test-password' } });
    const cookie = cookieFrom(login);
    const res = await request('GET', '/api/status', { headers: { Cookie: cookie } });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(JSON.parse(res.body).online, false); // mock client has no .user
});

test('password sessions are owner: dash users and bot customization allowed', async () => {
    const login = await request('POST', '/api/login', { body: { password: 'test-password' } });
    const cookie = cookieFrom(login);

    const users = await request('GET', '/api/dash/users', { headers: { Cookie: cookie } });
    assert.strictEqual(users.status, 200);

    const name = await request('POST', '/api/bot/name', { body: { name: 'x' }, headers: { Cookie: cookie } });
    assert.notStrictEqual(name.status, 403); // passes the owner gate (mock bot rejects later)
});

test('scoped dash user sees only granted servers; ungranted server routes are 403', async () => {
    const { accessToken } = addDashUser('scoped-user-1', 'test');
    // Scope them to guild-aaa only
    getDb().prepare("INSERT OR REPLACE INTO dash_user_guilds (user_id, guild_id, granted_at) VALUES ('scoped-user-1', 'guild-aaa', 1)").run();

    const login = await request('POST', '/api/login', { body: { discordId: 'scoped-user-1', accessToken } });
    assert.strictEqual(login.status, 200);
    const cookie = cookieFrom(login);

    // Server list is filtered to the granted guild
    const servers = await request('GET', '/api/servers', { headers: { Cookie: cookie } });
    const list = JSON.parse(servers.body);
    assert.ok(Array.isArray(list) && list.length === 1);
    assert.strictEqual(list[0].id, 'guild-aaa');

    // Granted server passes the tenant guard (reaches the route logic)
    const granted = await request('GET', '/api/server/guild-aaa/roles', { headers: { Cookie: cookie } });
    assert.notStrictEqual(granted.status, 403);

    // Ungranted server is blocked fail-closed
    const blocked = await request('GET', '/api/server/guild-bbb/roles', { headers: { Cookie: cookie } });
    assert.strictEqual(blocked.status, 403);
    assert.strictEqual(JSON.parse(blocked.body).error, 'You do not have access to this server');

    // Owner-only routes are still off-limits for scoped users
    const users = await request('GET', '/api/dash/users', { headers: { Cookie: cookie } });
    assert.strictEqual(users.status, 403);
    const botname = await request('POST', '/api/bot/name', { body: { name: 'x' }, headers: { Cookie: cookie } });
    assert.strictEqual(botname.status, 403);
});

test('scoped user with zero grants sees no servers (fail-closed)', async () => {
    // addDashUser replaces the row and returns the fresh raw token
    const { accessToken } = addDashUser('scoped-user-2', 'test');
    const login = await request('POST', '/api/login', { body: { discordId: 'scoped-user-2', accessToken } });
    const cookie = cookieFrom(login);

    const servers = await request('GET', '/api/servers', { headers: { Cookie: cookie } });
    assert.deepStrictEqual(JSON.parse(servers.body), []);
});

test('expired session (idle TTL) is dropped and the request is unauthenticated', async () => {
    const login = await request('POST', '/api/login', { body: { password: 'test-password' } });
    const rawCookie = (login.headers['set-cookie'] || [''])[0];
    const token = rawCookie.split(';')[0].replace('session=', '');

    // Force the idle TTL to be in the past
    sessions.get(token).expiresAt = Date.now() - 1000;

    const res = await request('GET', '/api/status', { headers: { Cookie: 'session=' + token } });
    assert.strictEqual(res.status, 401);
    assert.ok(!sessions.has(token), 'expired session must be deleted');
});

test('session past the absolute cap is rejected even with a future expiry', async () => {
    const login = await request('POST', '/api/login', { body: { password: 'test-password' } });
    const rawCookie = (login.headers['set-cookie'] || [''])[0];
    const token = rawCookie.split(';')[0].replace('session=', '');

    // Sliding renewal keeps pushing expiresAt forward, but createdAt is capped
    const session = sessions.get(token);
    session.createdAt = Date.now() - (8 * 24 * 60 * 60 * 1000); // 8 days old, cap is 7
    session.expiresAt = Date.now() + 60 * 60 * 1000;            // still "fresh"

    const res = await request('GET', '/api/status', { headers: { Cookie: 'session=' + token } });
    assert.strictEqual(res.status, 401, 'absolute cap must win over sliding renewal');
});

test('revoking a dash user invalidates their live session immediately', async () => {
    const { accessToken } = addDashUser('revoke-me', 'test');
    const login = await request('POST', '/api/login', { body: { discordId: 'revoke-me', accessToken } });
    const cookie = cookieFrom(login);

    // Session works before revocation
    const before = await request('GET', '/api/status', { headers: { Cookie: cookie } });
    assert.strictEqual(before.status, 200);

    // Owner revokes the user (this also purges their sessions)
    assert.strictEqual(removeDashUser('revoke-me'), true);

    const after = await request('GET', '/api/status', { headers: { Cookie: cookie } });
    assert.strictEqual(after.status, 401, 'revoked user session must be dead immediately');
});

test('logout deletes the server-side session', async () => {
    // Seed the session directly — the file has already used the 10-login
    // per-minute budget, and the rate limiter would (correctly) block a
    // real login here.
    const token = generateSession();
    sessions.set(token, { method: 'password', expiresAt: Date.now() + SESSION_TTL_MS, createdAt: Date.now() });
    assert.ok(sessions.has(token));

    await request('POST', '/api/logout', { headers: { Cookie: 'session=' + token } });
    assert.ok(!sessions.has(token), 'logout must remove the session server-side');

    const res = await request('GET', '/api/status', { headers: { Cookie: 'session=' + token } });
    assert.strictEqual(res.status, 401);
});
