// One-shot converter: turns src/dashboard/parts/*.js from global-sharing
// classic scripts into true ES modules.
//
// Preconditions (verified from analyzeParts and asserted here):
//   - every part parses as an ES module (strict mode)
//   - no unresolved external references, no implicit-global writes
//   - the import graph has no cycles
//   - every inline-handler name (index.html + generated HTML) resolves to
//     exactly one declaring part
//
// What it does per part:
//   - prepends `import { … } from './NN-name.mjs'` for cross-part references
//   - adds `export` to every top-level declaration other parts or inline
//     handlers need
//   - renames .js → .mjs
// Then writes 00-entry.mjs: side-effect imports of every part in order (so
// all top-level code still runs) plus a window bridge that attaches the
// functions inline HTML handlers call (module scope ≠ global scope).
//
// Usage: node scripts/convert-modules.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeParts } from './analyze-modules.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PARTS_DIR = path.join(ROOT, 'src', 'dashboard', 'parts');

// Identifiers that appear inside inline handler expressions but are not
// functions to attach to window (JS keywords, globals, `this`, member tails).
const RESERVED = new Set([
    'this', 'event', 'true', 'false', 'null', 'undefined', 'return', 'if',
    'else', 'function', 'var', 'new', 'window', 'document', 'localStorage',
    'sessionStorage', 'setTimeout', 'clearTimeout', 'confirm', 'prompt',
    'alert', 'Number', 'String', 'Boolean', 'parseInt', 'parseFloat', 'Math',
    'JSON', 'Date', 'encodeURIComponent', 'Array', 'Object', 'isNaN',
    'location', 'history', 'navigator',
]);

function collectPatternNames(node, set) {
    if (!node) return;
    switch (node.type) {
        case 'Identifier': set.add(node.name); break;
        case 'ObjectPattern': for (const p of node.properties) collectPatternNames(p.type === 'RestElement' ? p.argument : p.value, set); break;
        case 'ArrayPattern': for (const el of node.elements) collectPatternNames(el, set); break;
        case 'AssignmentPattern': collectPatternNames(node.left, set); break;
        case 'RestElement': collectPatternNames(node.argument, set); break;
        default: break;
    }
}

function fail(msg) {
    console.error('❌ ' + msg);
    process.exit(1);
}

const a = analyzeParts();

// ── gates ──
for (const p of a.parts) {
    if (!p.ast) fail(`${p.file} does not parse as ES module: ${p.error} (line ${p.line})`);
    if (p.implicitWrites.size) fail(`${p.file} has implicit-global writes (strict-mode crashes): ${[...p.implicitWrites].join(', ')}`);
}
for (const [f, missing] of a.missingByPart) fail(`${f} references names declared nowhere: ${missing.join(', ')}`);
if (a.cycles.length) fail(`import graph has cycles: ${a.cycles.map((c) => c.join(' -> ') + ' -> ' + c[0]).join(' | ')}`);
for (const p of a.parts) {
    if (p.file.endsWith('.mjs')) fail(`${p.file} is already a module — converter should run once on .js parts`);
}

const handlerNames = new Set([...a.genHandlerNames, ...a.handlerNames].filter((n) => !RESERVED.has(n)));
for (const n of handlerNames) {
    const decls = a.declaredBy.get(n) || [];
    if (decls.length !== 1) fail(`inline handler "${n}" resolves to ${decls.length} parts: ${decls.join(', ')}`);
}

// ── compute imports / exports ──
const importsByPart = new Map(); // file -> Map(sourceFile -> Set(names))
const exportsByPart = new Map(); // file -> Set(names)
for (const p of a.parts) {
    importsByPart.set(p.file, new Map());
    exportsByPart.set(p.file, new Set());
}
for (const e of a.edges) {
    exportsByPart.get(e.to).add(e.name);
    if (!importsByPart.get(e.from).has(e.to)) importsByPart.get(e.from).set(e.to, new Set());
    importsByPart.get(e.from).get(e.to).add(e.name);
}
for (const n of handlerNames) {
    const [declarer] = a.declaredBy.get(n);
    exportsByPart.get(declarer).add(n);
}

// ── rewrite each part ──
for (const p of a.parts) {
    const exportSet = exportsByPart.get(p.file);
    let code = p.code;

    // 1. add `export` to top-level declarations that are needed elsewhere.
    const edits = [];
    for (const stmt of p.ast.body) {
        const declared = new Set();
        if ((stmt.type === 'FunctionDeclaration' || stmt.type === 'ClassDeclaration') && stmt.id) declared.add(stmt.id.name);
        else if (stmt.type === 'VariableDeclaration') {
            for (const d of stmt.declarations) collectPatternNames(d.id, declared);
        }
        const wanted = [...declared].filter((n) => exportSet.has(n));
        if (wanted.length === 0) continue;
        if (stmt.type !== 'FunctionDeclaration' && stmt.type !== 'ClassDeclaration' && stmt.type !== 'VariableDeclaration') {
            fail(`${p.file}: export-needed name(s) ${wanted.join(',')} inside a non-exportable top-level statement`);
        }
        edits.push({ start: stmt.start, text: 'export ' });
    }
    edits.sort((x, y) => y.start - x.start);
    for (const e of edits) code = code.slice(0, e.start) + e.text + code.slice(e.start);

    // 2. prepend imports.
    const importLines = [];
    for (const [src, names] of [...importsByPart.get(p.file).entries()].sort()) {
        importLines.push(`import { ${[...names].sort().join(', ')} } from './${src.replace(/\.js$/, '.mjs')}';`);
    }
    if (importLines.length) code = importLines.join('\n') + '\n' + code;

    // 3. write .mjs, delete .js.
    const newName = p.file.replace(/\.js$/, '.mjs');
    fs.writeFileSync(path.join(PARTS_DIR, newName), code);
    fs.unlinkSync(path.join(PARTS_DIR, p.file));
    console.log(`  ✅ ${p.file} → ${newName} (${importLines.length} imports, ${exportSet.size} exports)`);
}

// ── entry module: side-effect imports in order + window bridge ──
const entry = [];
entry.push('// Entry point for the dashboard frontend.');
entry.push('// Loaded from index.html as <script type="module">.');
entry.push('//');
entry.push('// Side-effect imports run every part\'s top-level code in order.');
entry.push('// The window bridge then attaches the functions that inline HTML');
entry.push('// handlers call — module scope is not the global scope.');
entry.push('');
for (const f of a.files) {
    entry.push(`import './${f.replace(/\.js$/, '.mjs')}';`);
}
entry.push('');
const bridgeByPart = new Map(); // module base -> [names]
for (const n of [...handlerNames].sort()) {
    const [declarer] = a.declaredBy.get(n);
    const base = declarer.replace(/\.js$/, '.mjs');
    if (!bridgeByPart.has(base)) bridgeByPart.set(base, []);
    bridgeByPart.get(base).push(n);
}
for (const [base, names] of [...bridgeByPart.entries()].sort()) {
    entry.push(`import { ${names.join(', ')} } from './${base}';`);
}
entry.push('');
for (const [base, names] of [...bridgeByPart.entries()].sort()) {
    for (const n of names) entry.push(`window.${n} = ${n};`);
}
entry.push('');
fs.writeFileSync(path.join(PARTS_DIR, '00-entry.mjs'), entry.join('\n'));
console.log(`\n  ✅ wrote 00-entry.mjs (${a.files.length} parts, ${handlerNames.size} bridge names)`);
console.log('\nNext: point index.html at 00-entry.mjs, simplify the server route, update tests.');