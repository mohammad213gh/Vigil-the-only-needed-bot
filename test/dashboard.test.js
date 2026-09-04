const { test, after } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dashboard-test-'));
process.env.DATA_DIR = tmp;
process.env.UPLOADS_DIR = path.join(tmp, 'uploads');

const { createDashboard, setDashboardClient } = require('../src/dashboard');
const { closeDb } = require('../src/db');

after(async () => {
    closeDb();
    fs.rmSync(tmp, { recursive: true, force: true });
});

test('health endpoint completes without writing headers after the response', async () => {
    setDashboardClient({ guilds: { cache: new Map() } }, 'test-password');
    const app = createDashboard();
    const server = http.createServer(app);

    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    const response = await new Promise((resolve, reject) => {
        const req = http.get({ host: '127.0.0.1', port, path: '/health' }, res => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => resolve({ statusCode: res.statusCode, requestId: res.headers['x-request-id'], data }));
        });
        req.on('error', reject);
        req.setTimeout(5000, () => { req.destroy(); reject(new Error('Request timeout')); });
    });
    // Destroy all connections and close server
    server.closeAllConnections?.();
    await new Promise(resolve => server.close(resolve));

    assert.strictEqual(response.statusCode, 200);
    assert.ok(response.requestId);
    assert.ok(response.data.includes('"status":"ok"'));
    // Force exit to prevent hanging from intervals/timers in dashboard
    process.exit(0);
});
