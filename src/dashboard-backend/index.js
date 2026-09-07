// ──────────────────── Dashboard backend entry ────────────────────
// Assembles the Express app: base middleware, then every part registered
// in the SAME ORDER the routes lived in the original monolith
// (src/dashboard.js) — the auth part first (session resolution, guards,
// tenant scoping), route groups next, and the frontend shell plus the
// error handler last, because both are catch-alls.
//
// The public API (createDashboard, setDashboardClient, addDashUser,
// removeDashUser, getDashUsers) is re-exported unchanged, so callers
// keep importing from src/dashboard.js as before.

const express = require('express');
const crypto = require('crypto');
const { logInfo } = require('../logError');
const core = require('./core');

const parts = [
    require('./parts/02-auth'),
    require('./parts/03-dash-admin'),
    require('./parts/04-servers'),
    require('./parts/05-moderation'),
    require('./parts/06-engagement'),
    require('./parts/07-voice'),
    require('./parts/08-automod'),
    require('./parts/09-tickets'),
    require('./parts/10-insights'),
    require('./parts/11-ops'),
];

function createDashboard() {
    const app = express();
    // Behind Railway/Discloud reverse proxies: makes req.ip and req.secure
    // reflect the real client (X-Forwarded-For / X-Forwarded-Proto).
    app.set('trust proxy', 1);
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Defense-in-depth CSP. No 'unsafe-inline' in script-src: the frontend
    // dispatches all events through a delegated listener reading data-fn /
    // data-args attributes (see dashboard/parts/00-entry.mjs), so inline event
    // handlers and injected <script> are both dead.
    app.use((req, res, next) => {
        res.setHeader(
            'Content-Security-Policy',
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://cdn.discordapp.com; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'"
        );
        next();
    });

    // Request ID + timing for observability
    app.use((req, res, next) => {
        const requestId = req.headers['x-request-id'] || crypto.randomUUID();
        req.requestId = requestId;
        res.setHeader('X-Request-ID', requestId);
        const start = process.hrtime.bigint();
        res.on('finish', () => {
            const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
            logInfo(`${req.method} ${req.path} ${res.statusCode} ${durationMs.toFixed(2)}ms`, 'http', { requestId, ip: req.ip, userAgent: req.headers['user-agent'] });
        });
        next();
    });

    // Shared context: the parts attach the auth guards here (02-auth) and
    // every later part consumes them from ctx.
    const ctx = {
        getClient: core.getClient,
        upload: core.upload,
        uploadsDir: core.uploadsDir,
    };

    for (const part of parts) {
        part.register(app, ctx);
    }

    return app;
}

module.exports = {
    createDashboard,
    setDashboardClient: core.setDashboardClient,
    addDashUser: core.addDashUser,
    removeDashUser: core.removeDashUser,
    getDashUsers: core.getDashUsers,
};
