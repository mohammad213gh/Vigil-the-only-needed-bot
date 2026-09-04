'use strict';
// The dashboard frontend is kept as ordered modules in src/dashboard/parts/
// (scripts/split-dashboard.mjs) and served concatenated by src/dashboard.js.
// These tests pin that contract and — more importantly — actually execute the
// real frontend in a DOM and assert the boot sequence runs clean, which no
// other test in this suite does.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { parse } = require('acorn');
const { JSDOM, VirtualConsole } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const PARTS_DIR = path.join(ROOT, 'src', 'dashboard', 'parts');
const INDEX_HTML = path.join(ROOT, 'src', 'dashboard', 'index.html');

// Mirrors getFrontendBundle() in src/dashboard.js — the exact bytes served
// for /static/dashboard.js.
function buildBundle() {
    const files = fs.readdirSync(PARTS_DIR).filter((f) => f.endsWith('.js')).sort();
    return {
        files,
        code: files.map((f) => fs.readFileSync(path.join(PARTS_DIR, f), 'utf8')).join(''),
    };
}

test('dashboard parts: manifest order + bundle integrity', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(PARTS_DIR, 'manifest.json'), 'utf8'));
    const { files, code } = buildBundle();
    assert.deepStrictEqual(
        files,
        manifest.parts.map((p) => p.file),
        'parts/ file list drifted from manifest — run: npm run seal:dashboard'
    );
    assert.doesNotThrow(() => parse(code, { ecmaVersion: 2022 }), 'concatenated bundle must parse');
    const sha = crypto.createHash('sha256').update(code, 'utf8').digest('hex');
    assert.strictEqual(
        sha,
        manifest.concatSha256,
        'bundle bytes changed without re-sealing — run: npm run seal:dashboard'
    );
});

// Minimal stand-ins for browser APIs jsdom lacks. The dashboard uses a 2d
// canvas, IntersectionObserver (scroll reveal), ResizeObserver, matchMedia,
// fetch and EventSource at load/boot time.
const BROWSER_STUBS = `
(function () {
    var ctxStub = new Proxy({}, {
        get: function (t, p) {
            if (p === 'createRadialGradient' || p === 'createLinearGradient' || p === 'createPattern') {
                return function () { return { addColorStop: function () {} }; };
            }
            if (typeof p === 'symbol') return undefined;
            return function () {};
        },
        set: function () { return true; }
    });
    HTMLCanvasElement.prototype.getContext = function () { return ctxStub; };
    window.IntersectionObserver = function (cb) { this.cb = cb; };
    window.IntersectionObserver.prototype.observe = function (el) { if (el && this.cb) this.cb([{ isIntersecting: true, target: el }], this); };
    window.IntersectionObserver.prototype.unobserve = function () {};
    window.IntersectionObserver.prototype.disconnect = function () {};
    window.IntersectionObserver.prototype.takeRecords = function () { return []; };
    window.ResizeObserver = function () {};
    window.ResizeObserver.prototype.observe = function () {};
    window.ResizeObserver.prototype.unobserve = function () {};
    window.ResizeObserver.prototype.disconnect = function () {};
    if (!window.matchMedia) {
        window.matchMedia = function (mq) {
            return { matches: false, media: mq, addListener: function () {}, removeListener: function () {}, addEventListener: function () {}, removeEventListener: function () {} };
        };
    }
    window.__pageErrors = [];
    window.addEventListener('error', function (e) {
        window.__pageErrors.push('window.error: ' + String((e && (e.message || e.error)) || 'unknown'));
    });
    window.addEventListener('unhandledrejection', function (e) {
        window.__pageErrors.push('unhandledrejection: ' + String(e && e.reason));
    });
    // Every boot loader tolerates empty payloads by rendering its empty state;
    // /api/status must look authenticated so checkAuth() lets the boot proceed.
    window.fetch = async function (url) {
        var u = String(url);
        var body = u.indexOf('/api/status') !== -1 ? {} : [];
        return { ok: true, status: 200, json: async function () { return body; } };
    };
})();
`;

function addScript(window, text) {
    const s = window.document.createElement('script');
    s.textContent = text; // textContent avoids HTML script-data tokenization entirely
    window.document.body.appendChild(s);
}

test('dashboard boots end-to-end in a DOM without throwing', async () => {
    const html = fs.readFileSync(INDEX_HTML, 'utf8');
    const { code } = buildBundle();

    // Strip the src script tag so nothing runs during HTML parse; scripts are
    // appended afterwards as textContent (identical classic-script semantics,
    // no HTML-tokenizer mangling of the bundle's string literals).
    const doc = html.replace('<script src="/static/dashboard.js"></script>', '');
    assert.notStrictEqual(doc, html, 'expected to find the dashboard script tag in index.html');

    const virtualConsole = new VirtualConsole();
    const scriptErrors = [];
    virtualConsole.on('jsdomError', (err) => {
        // jsdom reports uncaught script exceptions AND "Not implemented: …"
        // noise here. Only real script failures should fail the test.
        const msg = String((err && (err.detail ? err.detail.stack || err.detail : err)) || err);
        if (msg && msg.indexOf('Not implemented') === -1 && msg.indexOf('Could not load') === -1) {
            scriptErrors.push('jsdomError: ' + msg);
        }
    });

    const dom = new JSDOM(doc, {
        runScripts: 'dangerously',
        pretendToBeVisual: true,
        url: 'http://localhost/',
        virtualConsole,
    });
    const { window } = dom;

    try {
        addScript(window, BROWSER_STUBS);
        addScript(window, code);

        // Let the async boot chain (all stubbed fetches) and a few rAF frames settle.
        await new Promise((r) => setTimeout(r, 150));

        const errors = [...(window.__pageErrors || []), ...scriptErrors];
        assert.deepStrictEqual(errors, [], 'dashboard boot threw uncaught errors');

        // applyCompactPref() runs first thing inside the boot callback and sets
        // --layout-dense on <html> — its presence proves the auth check passed
        // and the boot sequence actually executed.
        const dense = window.document.documentElement.style.getPropertyValue('--layout-dense');
        assert.ok(dense, 'expected --layout-dense to be set (boot ran applyCompactPref)');

        // cfg is populated by loadCfg() mid-boot; top-level let/const from the
        // bundle live in the global lexical environment, visible to eval.
        const cfgType = window.eval('typeof cfg');
        assert.strictEqual(cfgType, 'object', 'expected loadCfg() to have run and set cfg');
    } finally {
        dom.window.close();
    }
});
