// Login rate-limit test — isolated in its own file because the limiter is
// process-global state with a 10-attempts-per-minute budget per IP, and
// other auth tests would consume it.
const { test, after } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dashboard-ratelimit-test-'));
process.env.DATA_DIR = tmp;
process.env.UPLOADS_DIR = path.join(tmp, 'uploads');

const { createDashboard, setDashboardClient } = require('../src/dashboard');
const { closeDb } = require('../src/db');

setDashboardClient({ guilds: { cache: new Map() } }, 'test-password');
const app = createDashboard();
const server = http.createServer(app);

let PORT;

after(async () => {
    closeDb();
    server.closeAllConnections?.();
    await new Promise(resolve => server.close(resolve));
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
});

function postLogin(password) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({ password });
        const req = http.request({
            host: '127.0.0.1', port: PORT, path: '/api/login', method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
        }, res => {
            let d = '';
            res.on('data', c => d += c);
            res.on('end', () => resolve({ status: res.statusCode, body: d }));
        });
        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

test('login rate limit: 10 attempts allowed, then 429 until the window passes', async () => {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    PORT = server.address().port;

    const statuses = [];
    for (let i = 0; i < 12; i++) {
        const res = await postLogin('definitely-wrong-' + i);
        statuses.push(res.status);
    }

    // Attempts 1–10 are processed (401 for bad credentials), 11–12 are blocked
    assert.deepStrictEqual(statuses.slice(0, 10), Array(10).fill(401));
    assert.strictEqual(statuses[10], 429);
    assert.strictEqual(statuses[11], 429);
    assert.ok(JSON.parse((await postLogin('definitely-wrong-x')).body).error.includes('Too many attempts'));
});
