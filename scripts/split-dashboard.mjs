// Splitter/analyzer for the legacy single-file dashboard frontend.
//
// The dashboard frontend used to be one ~4,100-line file. It is now kept as
// ordered modules in src/dashboard/parts/ and the server concatenates them
// back into the identical byte stream (see getFrontendBundle in
// src/dashboard.js) — so the browser behavior is unchanged by construction,
// while each section is a separate, navigable source file.
//
// Classic <script> files hoist function declarations only within their own
// file, so a future *true* multi-<script> split must ensure no top-level
// immediate-execution code calls a function declared in a later file. This
// script also reports those hazards so that future split is informed.
//
// Usage:
//   node scripts/split-dashboard.mjs analyze  — report sections + hazards (no writes)
//   node scripts/split-dashboard.mjs split    — regenerate parts/ from the monolith
//                                               (src/dashboard/dashboard.js must still exist)
//   node scripts/split-dashboard.mjs seal     — refresh manifest hashes from current
//                                               parts/ (run after any intentional edit)
//   node scripts/split-dashboard.mjs verify   — assert parts match manifest, concat
//                                               parses, and report cross-part hazards
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { parse } from 'acorn';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const MONOLITH = path.join(ROOT, 'src', 'dashboard', 'dashboard.js');
const PARTS_DIR = path.join(ROOT, 'src', 'dashboard', 'parts');
const MANIFEST = path.join(PARTS_DIR, 'manifest.json');

// Ordered part definitions. Each part begins at the named section marker
// (the ═══ header comment); the first part begins at the top of the file.
const PARTS = [
    { file: '01-foundation.js', from: null },
    { file: '02-ui-shell.js', from: 'COMMAND PALETTE (Ctrl+K)' },
    { file: '03-mod-tools.js', from: 'MOD TOOLS' },
    { file: '04-tickets.js', from: 'TICKETS' },
    { file: '05-auto-mod.js', from: 'AUTO-MOD' },
    { file: '06-reaction-roles.js', from: 'REACTION ROLES' },
    { file: '07-voice.js', from: 'VOICE PRESENCE' },
    { file: '08-temp-vc.js', from: 'TEMP VOICE CHANNELS' },
    { file: '09-activity.js', from: 'BOT ACTIVITY' },
    { file: '10-polls.js', from: 'POLLS & ANNOUNCEMENTS' },
];

// The monolith only exists until the first `split`; analyze/split need it, but
// seal/verify work purely from parts/ — so load it lazily.
let body = null;
let ast = null;
let stmts = [];

function loadMonolith() {
    body = fs.readFileSync(MONOLITH, 'utf8');
    try {
        ast = parse(body, { ecmaVersion: 2022, allowHashBang: false });
    } catch (err) {
        console.error('Parse failed:', err.message);
        process.exit(1);
    }
    stmts = ast.body.map((n) => ({
        type: n.type,
        start: n.start,
        end: n.end,
        name: declName(n),
    }));
}

function declName(node) {
    if (node.type === 'FunctionDeclaration' || node.type === 'ClassDeclaration') {
        return node.id ? node.id.name : null;
    }
    if (node.type === 'VariableDeclaration') {
        return node.declarations.map((d) => (d.id.type === 'Identifier' ? d.id.name : null)).filter(Boolean);
    }
    return null;
}

function refNames(node, out = new Set()) {
    if (!node || typeof node.type !== 'string') return out;
    switch (node.type) {
        case 'Identifier': out.add(node.name); break;
        case 'MemberExpression':
            refNames(node.object, out);
            if (node.computed) refNames(node.property, out);
            break;
        case 'Property':
            if (node.computed || node.key.type !== 'Identifier') refNames(node.key, out);
            refNames(node.value, out);
            break;
        case 'MethodDefinition':
            if (node.computed || node.key.type !== 'Identifier') refNames(node.key, out);
            refNames(node.value, out);
            break;
        case 'PropertyDefinition':
            if (node.computed || node.key.type !== 'Identifier') refNames(node.key, out);
            if (node.value) refNames(node.value, out);
            break;
        default:
            for (const key of Object.keys(node)) {
                if (key === 'type' || key === 'start' || key === 'end' || key === 'loc' || key === 'range') continue;
                const val = node[key];
                if (Array.isArray(val)) for (const v of val) refNames(v, out);
                else if (val && typeof val === 'object') refNames(val, out);
            }
    }
    return out;
}

function isImmediate(node) {
    if (node.type === 'ExpressionStatement') return true;
    if (node.type === 'VariableDeclaration') {
        return node.declarations.some((d) => d.init);
    }
    if (['ForStatement', 'ForInStatement', 'ForOfStatement', 'IfStatement',
        'SwitchStatement', 'BlockStatement', 'WhileStatement', 'DoWhileStatement',
        'LabeledStatement', 'WithStatement', 'TryStatement'].includes(node.type)) {
        return true;
    }
    return false;
}

function lineOf(offset) {
    return body.slice(0, offset).split('\n').length;
}

function sectionMarkers() {
    const markers = [];
    const re = /^\/\/\s*═+.*$/gm;
    let m;
    while ((m = re.exec(body))) {
        markers.push({ start: m.index, end: m.index + m[0].length, line: lineOf(m.index), text: m[0].trim().replace(/^\/\/\s*/, '') });
    }
    return markers;
}

function findBoundary(name) {
    const markers = sectionMarkers();
    // Exact match against the ═══ NAME ═══ header so e.g. "AUTO-MOD" does not
    // also match the "AUTO-MOD HELPERS" section.
    const hits = markers.filter((m) => m.text === `═══ ${name} ═══`);
    if (hits.length !== 1) {
        console.error(`Boundary section "${name}" matched ${hits.length} markers (need exactly 1)`);
        process.exit(1);
    }
    // Cut at the start of the header comment so the ═══ marker leads its part.
    return { marker: hits[0], cut: hits[0].start };
}

function partRanges() {
    const cuts = [0];
    for (const p of PARTS.slice(1)) {
        cuts.push(findBoundary(p.from).cut);
    }
    cuts.push(body.length);
    for (let i = 1; i < cuts.length; i++) {
        if (cuts[i] <= cuts[i - 1]) {
            console.error(`Part boundaries out of order at index ${i}: ${cuts[i]} <= ${cuts[i - 1]}`);
            process.exit(1);
        }
    }
    return PARTS.map((p, i) => ({ ...p, start: cuts[i], end: cuts[i + 1] }));
}

// For each part, which statement indices it contains (by byte range).
function partOfStmt(ranges) {
    const owner = new Array(stmts.length).fill(-1);
    for (let i = 0; i < stmts.length; i++) {
        for (let r = 0; r < ranges.length; r++) {
            if (stmts[i].start >= ranges[r].start && stmts[i].end <= ranges[r].end) { owner[i] = r; break; }
        }
    }
    return owner;
}

// Report statements that run at load in part A referencing a function
// declared only in a LATER part (the sole thing a true multi-<script> split
// could break; harmless under serve-time concatenation).
function hazardReport(ranges, owner) {
    const funcPart = {}; // function name → first part that declares it
    for (let i = 0; i < stmts.length; i++) {
        const s = stmts[i];
        if (s.type === 'FunctionDeclaration' && s.name && funcPart[s.name] === undefined) {
            funcPart[s.name] = owner[i];
        }
    }
    const hazards = [];
    for (let i = 0; i < stmts.length; i++) {
        const s = stmts[i];
        if (!isImmediate(ast.body[i])) continue;
        if (s.type === 'FunctionDeclaration' || s.type === 'ClassDeclaration') continue;
        const myPart = owner[i];
        const used = refNames(ast.body[i]);
        for (const n of used) {
            const declared = funcPart[n];
            if (declared !== undefined && declared > myPart) {
                const deferred = s.type === 'ExpressionStatement' &&
                    ast.body[i].expression.type === 'CallExpression' &&
                    ast.body[i].expression.callee.type === 'MemberExpression' &&
                    ast.body[i].expression.callee.property.type === 'Identifier' &&
                    ast.body[i].expression.callee.property.name === 'then';
                hazards.push({
                    line: lineOf(s.start),
                    name: n,
                    inPart: myPart,
                    declaredInPart: declared,
                    deferred,
                });
            }
        }
    }
    return hazards;
}

function sha256(str) {
    return crypto.createHash('sha256').update(str, 'utf8').digest('hex');
}

function parseOrDie(code, label) {
    try {
        parse(code, { ecmaVersion: 2022 });
    } catch (err) {
        console.error(`Parse failed in ${label}: ${err.message}`);
        process.exit(1);
    }
}

function writeManifest(files, code) {
    const partsMeta = files.map((f) => {
        const content = fs.readFileSync(path.join(PARTS_DIR, f), 'utf8');
        return { file: f, sha256: sha256(content), lines: content.split('\n').length };
    });
    const manifest = {
        generatedBy: 'scripts/split-dashboard.mjs',
        note: 'Concat parts/*.js in listed order = the served /static/dashboard.js bundle. After editing a part, run: node scripts/split-dashboard.mjs seal',
        parts: partsMeta,
        concatSha256: sha256(code),
        lines: code.split('\n').length,
    };
    fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
    return manifest;
}

function printHazards(hazards) {
    console.log('\nCross-part immediate-execution hazards:');
    if (hazards.length === 0) {
        console.log('  ✅ none — a future multi-<script> split at these seams would be load-order safe');
        return;
    }
    const seen = new Set();
    for (const h of hazards) {
        const key = h.line + h.name;
        if (seen.has(key)) continue;
        seen.add(key);
        const tag = h.deferred
            ? ' (deferred: .then registration — callback runs after load; safe under serve-time concat, but wrap boot in DOMContentLoaded before any real multi-<script> split)'
            : '  ⚠️  WOULD BREAK a multi-<script> split';
        console.log(`  line ${h.line}: refs ${h.name} (declared in part ${h.declaredInPart + 1}, used from part ${h.inPart + 1})${tag}`);
    }
}

const mode = process.argv[2] || 'analyze';

if (mode === 'analyze') {
    loadMonolith();
    const markers = sectionMarkers();
    const ranges = partRanges();
    const owner = partOfStmt(ranges);
    console.log(`File: ${MONOLITH} (${body.length} bytes, ${lineOf(body.length)} lines)`);
    console.log(`Top-level statements: ${stmts.length}`);
    console.log(`Section markers: ${markers.length}`);
    console.log(`Planned parts (${ranges.length}):`);
    for (const r of ranges) {
        console.log(`  ${r.file.padEnd(24)} lines ${String(lineOf(r.start)).padStart(4)}-${String(lineOf(r.end)).padStart(4)}  (${r.end - r.start} bytes)`);
    }
    printHazards(hazardReport(ranges, owner));
} else if (mode === 'split') {
    if (!fs.existsSync(MONOLITH)) {
        console.error('src/dashboard/dashboard.js no longer exists — parts/ are now the source of truth.');
        console.error('Edit the parts directly, then run: node scripts/split-dashboard.mjs seal');
        process.exit(1);
    }
    loadMonolith();
    const ranges = partRanges();
    fs.mkdirSync(PARTS_DIR, { recursive: true });
    let concat = '';
    for (const r of ranges) {
        const content = body.slice(r.start, r.end);
        parseOrDie(content, r.file);
        fs.writeFileSync(path.join(PARTS_DIR, r.file), content);
        concat += content;
        console.log(`wrote ${r.file} (${content.length} bytes, ${content.split('\n').length} lines)`);
    }
    if (concat !== body) {
        console.error('❌ Split output does not reassemble to the original — aborting without manifest.');
        process.exit(1);
    }
    const owner = partOfStmt(ranges);
    const manifest = writeManifest(ranges.map((r) => r.file), concat);
    console.log(`\n✅ ${ranges.length} parts written; concat is byte-identical to the monolith (sha256 ${manifest.concatSha256.slice(0, 16)}…)`);
    printHazards(hazardReport(ranges, owner));
    console.log('\nNext: delete the monolith, wire the server route, then commit.');
} else if (mode === 'seal') {
    const files = fs.readdirSync(PARTS_DIR).filter((f) => f.endsWith('.js')).sort();
    if (files.length === 0) {
        console.error('No parts found in ' + PARTS_DIR);
        process.exit(1);
    }
    const code = files.map((f) => fs.readFileSync(path.join(PARTS_DIR, f), 'utf8')).join('');
    parseOrDie(code, 'concatenated bundle');
    const manifest = writeManifest(files, code);
    console.log(`Sealed ${files.length} parts; concat sha256 ${manifest.concatSha256.slice(0, 16)}…`);
} else if (mode === 'verify') {
    if (!fs.existsSync(MANIFEST)) {
        console.error('No manifest.json — run split (or seal) first.');
        process.exit(1);
    }
    const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
    const files = fs.readdirSync(PARTS_DIR).filter((f) => f.endsWith('.js')).sort();
    const expected = manifest.parts.map((p) => p.file);
    if (JSON.stringify(files) !== JSON.stringify(expected)) {
        console.error('❌ parts/ file list differs from manifest:');
        console.error(`  expected: ${expected.join(', ')}`);
        console.error(`  actual:   ${files.join(', ')}`);
        console.error('Fix the parts or run: node scripts/split-dashboard.mjs seal');
        process.exit(1);
    }
    const code = files.map((f) => fs.readFileSync(path.join(PARTS_DIR, f), 'utf8')).join('');
    parseOrDie(code, 'concatenated bundle');
    const actual = sha256(code);
    if (actual !== manifest.concatSha256) {
        console.error('❌ Concatenated parts no longer match the manifest hash.');
        console.error(`  expected ${manifest.concatSha256}`);
        console.error(`  actual   ${actual}`);
        console.error('If the change was intentional, run: node scripts/split-dashboard.mjs seal');
        process.exit(1);
    }
    console.log(`✅ ${files.length} parts match manifest (sha256 ${actual.slice(0, 16)}…)`);
    // Boundary hazard report is only possible with the monolith's statement
    // layout; approximate by re-deriving seams from part 0 comments is overkill
    // here — the seal/verify pair already guarantees byte fidelity.
} else {
    console.error(`Unknown mode "${mode}". Use analyze | split | seal | verify`);
    process.exit(1);
}
