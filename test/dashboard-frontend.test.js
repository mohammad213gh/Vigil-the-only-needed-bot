'use strict';
// The dashboard frontend is served as true ES modules from
// src/dashboard/parts/ (index.html loads 00-entry.mjs). These tests:
//   1. assert every part + the entry parses as an ES module,
//   2. re-run the module analyzer to pin the graph contract (no unresolved
//      names, no cycles, no implicit-global writes),
//   3. actually EXECUTE the real module graph in Node (with jsdom globals)
//      and assert the boot sequence completes without throwing.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { parse } = require('acorn');
const { JSDOM, VirtualConsole } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const PARTS_DIR = path.join(ROOT, 'src', 'dashboard', 'parts');
const INDEX_HTML = path.join(ROOT, 'src', 'dashboard', 'index.html');

function partFiles() {
    return fs.readdirSync(PARTS_DIR).filter((f) => f.endsWith('.mjs')).sort();
}

test('every dashboard part and the entry parse as ES modules', () => {
    const files = partFiles();
    assert.ok(files.includes('00-entry.mjs'), 'entry module must exist');
    assert.ok(files.length >= 10, `expected the 10 parts + entry, got ${files.length}`);
    for (const f of files) {
        const code = fs.readFileSync(path.join(PARTS_DIR, f), 'utf8');
        assert.doesNotThrow(
            () => parse(code, { ecmaVersion: 2022, sourceType: 'module' }),
            `${f} must parse as an ES module`
        );
    }
});

test('module graph is clean: no unresolved names, no cycles, no implicit writes', async () => {
    const { analyzeParts } = await import('../scripts/analyze-modules.mjs');
    const a = analyzeParts();
    for (const p of a.parts) {
        assert.ok(p.ast, `${p.file} must parse: ${p.error || ''}`);
        assert.deepStrictEqual(
            [...(a.missingByPart.get(p.file) || [])],
            [],
            `${p.file} references names declared nowhere`
        );
        assert.deepStrictEqual([...p.implicitWrites], [], `${p.file} has implicit-global writes`);
    }
    assert.deepStrictEqual(a.cycles, [], 'import graph must have no cycles');
});

test('dashboard boots end-to-end from the real module graph without throwing', async () => {
    const html = fs.readFileSync(INDEX_HTML, 'utf8');
    assert.match(html, /<script type="module" src="\/static\/parts\/00-entry\.mjs"><\/script>/,
        'index.html must load the entry module');

    const virtualConsole = new VirtualConsole();
    const scriptErrors = [];
    virtualConsole.on('jsdomError', (err) => {
        const msg = String((err && (err.detail ? err.detail.stack || err.detail : err)) || err);
        if (msg && msg.indexOf('Not implemented') === -1 && msg.indexOf('Could not load') === -1) {
            scriptErrors.push('jsdomError: ' + msg);
        }
    });

    const dom = new JSDOM(html, {
        runScripts: 'dangerously',
        pretendToBeVisual: true,
        url: 'http://localhost/',
        virtualConsole,
    });
    const { window } = dom;

    // Install the browser APIs the modules reference as bare identifiers.
    // jsdom's timers must be the ones the modules capture so window.close()
    // stops the refresh interval / rAF loop afterwards.
    // NOTE: setTimeout/setInterval/clearTimeout/clearInterval/performance are
    // deliberately NOT copied from jsdom — jsdom's own internals resolve bare
    // setTimeout through globalThis (overriding it recurses), and its generated
    // Performance IDL recurses when detached. Node's own versions work fine
    // for module code.
    const GLOBALS = [
        'window', 'document', 'navigator', 'location', 'history', 'screen',
        'localStorage', 'sessionStorage', 'devicePixelRatio', 'getComputedStyle',
        'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame',
        'alert', 'confirm', 'prompt', 'open', 'atob', 'btoa',
        'URL', 'URLSearchParams', 'FormData', 'Blob', 'FileReader', 'Image',
        'Audio', 'Event', 'MouseEvent', 'KeyboardEvent', 'TouchEvent',
        'PointerEvent', 'WheelEvent', 'CustomEvent', 'MutationObserver',
        'TextEncoder', 'TextDecoder', 'DOMParser', 'DataTransfer', 'Node',
        'Element', 'HTMLElement', 'HTMLInputElement', 'HTMLSelectElement',
        'HTMLTextAreaElement', 'HTMLButtonElement', 'HTMLFormElement',
        'HTMLDivElement', 'HTMLSpanElement', 'HTMLImageElement',
        'HTMLCanvasElement', 'CSS', 'queueMicrotask', 'innerWidth', 'innerHeight',
    ];
    function installGlobal(k) {
        if (window[k] === undefined) return;
        try {
            Object.defineProperty(globalThis, k, { value: window[k], writable: true, configurable: true });
        } catch {
            // Some Node globals (e.g. navigator) are non-configurable getters —
            // keep Node's; the dashboard only probes them defensively.
            try { globalThis[k] = window[k]; } catch { /* skip */ }
        }
    }
    for (const k of GLOBALS) installGlobal(k);

    // Stubs for APIs jsdom lacks.
    const ctxStub = new Proxy({}, {
        get(t, p) {
            if (p === 'createRadialGradient' || p === 'createLinearGradient' || p === 'createPattern') {
                return () => ({ addColorStop() {} });
            }
            if (typeof p === 'symbol') return undefined;
            return () => {};
        },
        set() { return true; },
    });
    globalThis.HTMLCanvasElement.prototype.getContext = () => ctxStub;
    // observe() is a no-op: firing the callback synchronously can recurse in
    // lazy-image/reveal code, and the reveal effect isn't what we assert.
    globalThis.IntersectionObserver = function () {};
    globalThis.IntersectionObserver.prototype.observe = function () {};
    globalThis.IntersectionObserver.prototype.unobserve = function () {};
    globalThis.IntersectionObserver.prototype.disconnect = function () {};
    globalThis.IntersectionObserver.prototype.takeRecords = () => [];
    globalThis.ResizeObserver = function () {};
    globalThis.ResizeObserver.prototype.observe = function () {};
    globalThis.ResizeObserver.prototype.unobserve = function () {};
    globalThis.ResizeObserver.prototype.disconnect = function () {};
    // jsdom's window lacks a working matchMedia in some versions — the
    // dashboard probes it for prefers-reduced-motion, so stub it safely.
    if (typeof window.matchMedia !== 'function') {
        window.matchMedia = () => ({
            matches: false, media: '', addListener() {}, removeListener() {},
            addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; },
        });
    }
    installGlobal('matchMedia');

    window.__pageErrors = [];
    window.addEventListener('error', (e) => {
        window.__pageErrors.push('window.error: ' + String((e && (e.message || e.error)) || 'unknown'));
    });
    window.addEventListener('unhandledrejection', (e) => {
        window.__pageErrors.push('unhandledrejection: ' + String(e && e.reason));
    });

    // Every boot loader tolerates empty payloads (renders empty states);
    // /api/status must look authenticated so checkAuth() lets the boot run.
    const fetchStub = async (url) => {
        const u = String(url);
        const body = u.indexOf('/api/status') !== -1 ? {} : [];
        return { ok: true, status: 200, json: async () => body };
    };
    globalThis.fetch = fetchStub;
    window.fetch = fetchStub;

    const unhandled = [];
    const onUnhandled = (reason) => unhandled.push('process.unhandledRejection: ' + String(reason));
    process.on('unhandledRejection', onUnhandled);

    // The boot registers stRf's refresh interval (Node timer) which would keep
    // the test process alive — record the handles so we can clear them after.
    const realSetInterval = globalThis.setInterval;
    const intervalHandles = new Set();
    globalThis.setInterval = function (fn, ms, ...rest) {
        const handle = realSetInterval(fn, ms, ...rest);
        intervalHandles.add(handle);
        return handle;
    };

    try {
        // Import the REAL module graph (cache-busted so re-runs re-execute).
        const entryUrl = pathToFileURL(path.join(PARTS_DIR, '00-entry.mjs')).href + '?t=' + Date.now();
        await import(entryUrl);

        // Let the async boot chain and a few rAF frames settle.
        await new Promise((r) => setTimeout(r, 150));

        const errors = [...(window.__pageErrors || []), ...scriptErrors, ...unhandled];
        assert.deepStrictEqual(errors, [], 'dashboard boot threw uncaught errors');

        // applyCompactPref() runs first thing inside the boot callback and sets
        // --layout-dense on <html> — proof the auth check passed and the boot
        // sequence actually executed.
        const dense = window.document.documentElement.style.getPropertyValue('--layout-dense');
        assert.ok(dense, 'expected --layout-dense to be set (boot ran applyCompactPref)');
    } finally {
        globalThis.setInterval = realSetInterval;
        for (const h of intervalHandles) clearInterval(h);
        process.removeListener('unhandledRejection', onUnhandled);
        dom.window.close(); // stops jsdom timers (rAF loop) captured by the modules
    }
});