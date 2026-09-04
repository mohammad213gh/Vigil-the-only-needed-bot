// Analyzer for converting src/dashboard/parts/*.js from global-sharing
// classic scripts into true ES modules (import/export boundaries).
//
// `analyzeParts()` is the single source of truth for the conversion — it
// reports, per part:
//   1. Does it parse as an ES module (strict mode)?  — gate for conversion
//   2. Which top-level names does it declare?
//   3. Which EXTERNAL names does it reference (scope-aware: locals inside
//      functions are excluded) — split into: resolved from another part
//      (import edge), browser global (skip), nowhere (missing)?
//   4. Implicit-global WRITES (assignments to names resolvable nowhere) —
//      these throw in strict mode.
//   5. Import-graph cycles.
// Plus: identifiers referenced by index.html inline event handlers and by
// generated HTML inside the parts (those must be attached to window via a
// bridge module).
//
// CLI:  node scripts/analyze-modules.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse } from 'acorn';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PARTS_DIR = path.join(ROOT, 'src', 'dashboard', 'parts');
const INDEX_HTML = path.join(ROOT, 'src', 'dashboard', 'index.html');

// Everything a browser provides at global scope (window.* usable bare).
const BROWSER_GLOBALS = new Set([
    'Object', 'Array', 'String', 'Number', 'Boolean', 'Symbol', 'BigInt', 'Math',
    'Date', 'RegExp', 'Error', 'TypeError', 'SyntaxError', 'ReferenceError',
    'RangeError', 'URIError', 'EvalError', 'Promise', 'Set', 'Map', 'WeakMap',
    'WeakSet', 'Proxy', 'Reflect', 'JSON', 'Intl', 'parseInt', 'parseFloat',
    'isNaN', 'isFinite', 'encodeURIComponent', 'decodeURIComponent', 'encodeURI',
    'decodeURI', 'structuredClone', 'queueMicrotask', 'globalThis',
    'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval',
    'requestAnimationFrame', 'cancelAnimationFrame', 'requestIdleCallback',
    'cancelIdleCallback',
    'window', 'document', 'navigator', 'location', 'history', 'screen',
    'localStorage', 'sessionStorage', 'devicePixelRatio', 'scrollTo',
    'getComputedStyle', 'matchMedia', 'alert', 'confirm', 'prompt', 'open',
    'atob', 'btoa', 'close', 'focus', 'blur', 'print', 'customElements',
    'crypto', 'performance', 'visualViewport',
    'fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'FormData', 'Blob',
    'File', 'FileReader', 'Image', 'Audio', 'URL', 'URLSearchParams', 'Headers',
    'Request', 'Response', 'AbortController', 'AbortSignal', 'TextEncoder',
    'TextDecoder', 'DOMParser', 'XMLSerializer', 'DataTransfer', 'Notification',
    'speechSynthesis', 'SpeechSynthesisUtterance',
    'Element', 'HTMLElement', 'HTMLCanvasElement', 'HTMLInputElement',
    'HTMLSelectElement', 'HTMLTextAreaElement', 'HTMLButtonElement',
    'HTMLFormElement', 'HTMLDivElement', 'HTMLSpanElement', 'HTMLImageElement',
    'HTMLAnchorElement', 'HTMLIFrameElement', 'SVGElement', 'Node', 'NodeList',
    'HTMLCollection', 'DOMRect', 'DOMTokenList', 'Event', 'MouseEvent',
    'KeyboardEvent', 'TouchEvent', 'PointerEvent', 'WheelEvent', 'DragEvent',
    'ClipboardEvent', 'FocusEvent', 'InputEvent', 'CustomEvent', 'StorageEvent',
    'MutationObserver', 'IntersectionObserver', 'ResizeObserver', 'CSS',
    'Attr', 'Comment', 'Text', 'DocumentFragment', 'Range', 'Selection',
    'DOMException', 'FontFace', 'CSSStyleDeclaration',
    'escape', 'unescape', 'ArrayBuffer', 'Uint8Array', 'Uint16Array',
    'Int32Array', 'Float32Array', 'DataView', 'console',
    'undefined', 'NaN', 'Infinity',
]);

function isGlobal(name) {
    return BROWSER_GLOBALS.has(name);
}

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

function unwrapExport(s) {
    // `export function/class/const …` wraps the declaration in an
    // ExportNamedDeclaration node — peel it so the inner declaration is seen.
    return (s.type === 'ExportNamedDeclaration' && s.declaration) ? s.declaration : s;
}

function topLevelDeclNames(ast) {
    const out = new Set();
    for (const s of ast.body) {
        const d = unwrapExport(s);
        if ((d.type === 'FunctionDeclaration' || d.type === 'ClassDeclaration') && d.id) out.add(d.id.name);
        else if (d.type === 'VariableDeclaration') {
            for (const dec of d.declarations) collectPatternNames(dec.id, out);
        }
    }
    return out;
}

// ── Scope-aware reference collection ────────────────────────────────────────
function collectRefs(ast) {
    const external = new Set();
    const implicitWrites = new Set();

    function hoistedFunctionScope(fnNode) {
        const s = new Set();
        for (const p of fnNode.params) collectPatternNames(p, s);
        hoistBody(fnNode.body, s);
        return s;
    }
    function hoistBody(node, set) {
        if (!node) return;
        if (node.type === 'BlockStatement') {
            for (const st of node.body) hoistBody(st, set);
        } else if (node.type === 'FunctionDeclaration') {
            if (node.id) set.add(node.id.name);
        } else if (node.type === 'VariableDeclaration') {
            if (node.kind === 'var') for (const d of node.declarations) collectPatternNames(d.id, set);
        } else if (node.type === 'IfStatement') {
            hoistBody(node.consequent, set); hoistBody(node.alternate, set);
        } else if (node.type === 'ForStatement') {
            hoistBody(node.init, set); hoistBody(node.body, set);
        } else if (node.type === 'ForInStatement' || node.type === 'ForOfStatement') {
            hoistBody(node.left, set); hoistBody(node.body, set);
        } else if (node.type === 'WhileStatement' || node.type === 'DoWhileStatement') {
            hoistBody(node.body, set);
        } else if (node.type === 'LabeledStatement') {
            hoistBody(node.body, set);
        } else if (node.type === 'TryStatement') {
            hoistBody(node.block, set);
            hoistBody(node.handler && node.handler.body, set);
            hoistBody(node.finalizer, set);
        } else if (node.type === 'SwitchStatement') {
            for (const c of node.cases) hoistBody(c, set);
        } else if (node.type === 'SwitchCase') {
            for (const st of node.consequent) hoistBody(st, set);
        } else if (node.type === 'WithStatement') {
            hoistBody(node.body, set);
        }
    }

    function resolve(name, stack) {
        for (let i = stack.length - 1; i >= 0; i--) if (stack[i].has(name)) return true;
        return isGlobal(name);
    }

    function walk(node, stack) {
        if (!node || typeof node.type !== 'string') return;
        switch (node.type) {
            case 'Identifier': {
                if (!resolve(node.name, stack)) external.add(node.name);
                return;
            }
            case 'MemberExpression':
                walk(node.object, stack);
                if (node.computed) walk(node.property, stack);
                return;
            case 'Property':
                if (node.computed) walk(node.key, stack);
                walk(node.value, stack);
                return;
            case 'MethodDefinition':
            case 'PropertyDefinition':
                if (node.computed) walk(node.key, stack);
                walk(node.value, stack);
                return;
            case 'FunctionDeclaration': {
                if (node.id) stack[stack.length - 1].add(node.id.name);
                const inner = hoistedFunctionScope(node);
                stack.push(inner);
                walk(node.body, stack);
                stack.pop();
                return;
            }
            case 'FunctionExpression':
            case 'ArrowFunctionExpression': {
                const inner = hoistedFunctionScope(node);
                if (node.type === 'FunctionExpression' && node.id) inner.add(node.id.name);
                stack.push(inner);
                walk(node.body, stack);
                stack.pop();
                return;
            }
            case 'ClassDeclaration':
            case 'ClassExpression': {
                if (node.type === 'ClassDeclaration' && node.id) stack[stack.length - 1].add(node.id.name);
                const inner = new Set();
                stack.push(inner);
                if (node.superClass) walk(node.superClass, stack);
                if (node.body) for (const el of node.body.body) walk(el, stack);
                stack.pop();
                return;
            }
            case 'VariableDeclaration': {
                if (node.kind !== 'var') {
                    for (const d of node.declarations) collectPatternNames(d.id, stack[stack.length - 1]);
                }
                for (const d of node.declarations) walk(d.init, stack);
                return;
            }
            case 'AssignmentExpression': {
                if (node.left.type === 'Identifier') {
                    if (!resolve(node.left.name, stack)) implicitWrites.add(node.left.name);
                } else {
                    walk(node.left, stack);
                }
                walk(node.right, stack);
                return;
            }
            case 'UpdateExpression': {
                if (node.argument.type === 'Identifier') {
                    if (!resolve(node.argument.name, stack)) implicitWrites.add(node.argument.name);
                } else {
                    walk(node.argument, stack);
                }
                return;
            }
            case 'BlockStatement': {
                const inner = new Set();
                stack.push(inner);
                for (const st of node.body) walk(st, stack);
                stack.pop();
                return;
            }
            case 'ForStatement': {
                walk(node.init, stack);
                walk(node.test, stack);
                walk(node.update, stack);
                walk(node.body, stack);
                return;
            }
            case 'ForInStatement':
            case 'ForOfStatement': {
                if (node.left.type !== 'VariableDeclaration') walk(node.left, stack);
                else if (node.left.kind !== 'var') collectPatternNames(node.left.declarations[0].id, stack[stack.length - 1]);
                walk(node.right, stack);
                walk(node.body, stack);
                return;
            }
            case 'IfStatement':
                walk(node.test, stack); walk(node.consequent, stack); walk(node.alternate, stack); return;
            case 'SwitchStatement': {
                walk(node.discriminant, stack);
                const inner = new Set();
                stack.push(inner);
                for (const c of node.cases) {
                    walk(c.test, stack);
                    for (const st of c.consequent) walk(st, stack);
                }
                stack.pop();
                return;
            }
            case 'TryStatement':
                walk(node.block, stack);
                if (node.handler) {
                    const inner = new Set();
                    stack.push(inner);
                    if (node.handler.param) collectPatternNames(node.handler.param, inner);
                    walk(node.handler.body, stack);
                    stack.pop();
                }
                walk(node.finalizer, stack);
                return;
            case 'WhileStatement':
            case 'DoWhileStatement':
                walk(node.test, stack); walk(node.body, stack); return;
            case 'LabeledStatement':
                walk(node.body, stack); return;
            case 'WithStatement':
                walk(node.object, stack); walk(node.body, stack); return;
            case 'BreakStatement':
            case 'ContinueStatement':
                return;
            case 'CallExpression':
            case 'NewExpression':
                walk(node.callee, stack);
                for (const a of node.arguments) walk(a, stack);
                return;
            case 'TemplateLiteral':
                for (const e of node.expressions) walk(e, stack);
                return;
            case 'TaggedTemplateExpression':
                walk(node.tag, stack); walk(node.quasi, stack); return;
            case 'ArrayExpression':
                for (const el of node.elements) walk(el, stack);
                return;
            case 'ObjectExpression':
                for (const p of node.properties) walk(p, stack);
                return;
            case 'SequenceExpression':
            case 'BinaryExpression':
            case 'LogicalExpression':
                walk(node.left, stack); walk(node.right, stack); return;
            case 'ConditionalExpression':
                walk(node.test, stack); walk(node.consequent, stack); walk(node.alternate, stack); return;
            case 'UnaryExpression':
                walk(node.argument, stack); return;
            case 'AwaitExpression':
            case 'YieldExpression':
                walk(node.argument, stack); return;
            case 'SpreadElement':
            case 'RestElement':
                walk(node.argument, stack); return;
            case 'AssignmentPattern':
                walk(node.right, stack); return;
            case 'ChainExpression':
                walk(node.expression, stack); return;
            case 'ImportDeclaration': {
                // Imported bindings are module-scope declarations.
                for (const spec of node.specifiers) collectPatternNames(spec.local, stack[0]);
                return;
            }
            case 'ExportNamedDeclaration':
                walk(node.declaration, stack);
                return;
            case 'ExportDefaultDeclaration':
                walk(node.declaration, stack);
                return;
            case 'MetaProperty':
                return;
            default:
                for (const key of Object.keys(node)) {
                    if (key === 'type' || key === 'start' || key === 'end' || key === 'loc' || key === 'range') continue;
                    const val = node[key];
                    if (Array.isArray(val)) for (const v of val) walk(v, stack);
                    else if (val && typeof val === 'object') walk(val, stack);
                }
        }
    }

    const moduleScope = new Set();
    // Pre-hoist ALL module-level declarations (functions, classes, let/const
    // anywhere at top level, plus var declarations nested inside top-level
    // control flow — e.g. `for (var x in ...)` at module top) so references
    // resolve regardless of statement order, exactly like one big script.
    for (const s of ast.body) {
        // Import specifiers are module-scoped bindings too.
        if (s.type === 'ImportDeclaration') {
            for (const spec of s.specifiers) collectPatternNames(spec.local, moduleScope);
        }
        const d = unwrapExport(s);
        if ((d.type === 'FunctionDeclaration' || d.type === 'ClassDeclaration') && d.id) moduleScope.add(d.id.name);
        if (d.type === 'VariableDeclaration') {
            for (const dec of d.declarations) collectPatternNames(dec.id, moduleScope);
        }
    }
    hoistBody({ type: 'BlockStatement', body: ast.body }, moduleScope);
    for (const s of ast.body) walk(s, [moduleScope]);
    return { external, implicitWrites };
}

// Top-level statements that execute immediately at module evaluation.
function immediateStatements(ast) {
    return ast.body.filter((n) => {
        n = unwrapExport(n);
        if (n.type === 'ExpressionStatement') return true;
        if (n.type === 'VariableDeclaration') return n.declarations.some((d) => d.init);
        if (['ForStatement', 'ForInStatement', 'ForOfStatement', 'IfStatement',
            'SwitchStatement', 'BlockStatement', 'WhileStatement', 'DoWhileStatement',
            'LabeledStatement', 'WithStatement', 'TryStatement'].includes(n.type)) return true;
        return false;
    });
}

// Bare identifier references in a statement (for immediate-statement checks).
function stmtRefNames(stmt) {
    const out = new Set();
    (function walk(node) {
        if (!node || typeof node.type !== 'string') return;
        if (node.type === 'Identifier') { out.add(node.name); return; }
        if (node.type === 'MemberExpression') {
            walk(node.object);
            if (node.computed) walk(node.property);
            return;
        }
        if (node.type === 'Property') {
            if (node.computed) walk(node.key);
            walk(node.value);
            return;
        }
        for (const key of Object.keys(node)) {
            if (key === 'type' || key === 'start' || key === 'end' || key === 'loc' || key === 'range') continue;
            const val = node[key];
            if (Array.isArray(val)) for (const v of val) walk(v);
            else if (val && typeof val === 'object') walk(val);
        }
    })(stmt);
    return out;
}

function partCode(file) {
    return fs.readFileSync(path.join(PARTS_DIR, file), 'utf8');
}

export function analyzeParts() {
    const files = fs.readdirSync(PARTS_DIR).filter((f) => f.endsWith('.js') || f.endsWith('.mjs')).sort();
    if (files.length === 0) throw new Error('No parts found in ' + PARTS_DIR);

    const parts = files.map((f) => {
        const code = partCode(f);
        let ast;
        try {
            ast = parse(code, { ecmaVersion: 2022, sourceType: 'module' });
        } catch (err) {
            return { file: f, code, ast: null, error: err.message, line: err.loc && err.loc.line };
        }
        const declared = topLevelDeclNames(ast);
        const { external, implicitWrites } = collectRefs(ast);
        return { file: f, code, ast, declared, external, implicitWrites, parseError: null };
    });

    const declaredBy = new Map(); // name -> [files]
    for (const p of parts) {
        if (!p.ast) continue;
        for (const n of p.declared) {
            if (!declaredBy.has(n)) declaredBy.set(n, []);
            declaredBy.get(n).push(p.file);
        }
    }

    const edges = []; // { from, to, name }
    const byFrom = new Map();
    const missingByPart = new Map();
    for (const p of parts) {
        if (!p.ast) continue;
        const missing = [];
        for (const n of p.external) {
            const decls = declaredBy.get(n) || [];
            if (decls.length === 0) missing.push(n);
            else if (decls.length === 1 && decls[0] !== p.file) {
                edges.push({ from: p.file, to: decls[0], name: n });
            }
        }
        if (missing.length) missingByPart.set(p.file, missing);
    }
    for (const e of edges) {
        if (!byFrom.has(e.from)) byFrom.set(e.from, new Map());
        const m = byFrom.get(e.from);
        m.set(e.to, (m.get(e.to) || 0) + 1);
    }

    // Tarjan SCC — cycles in the import graph.
    const index = new Map();
    const lowlink = new Map();
    const stack = [];
    let nextIdx = 0;
    const cycles = [];
    function strongconnect(v) {
        index.set(v, nextIdx);
        lowlink.set(v, nextIdx);
        nextIdx += 1;
        stack.push(v);
        const tos = (byFrom.get(v) || new Map());
        for (const to of tos.keys()) {
            if (!index.has(to)) {
                strongconnect(to);
                lowlink.set(v, Math.min(lowlink.get(v), lowlink.get(to)));
            } else if (stack.includes(to)) {
                lowlink.set(v, Math.min(lowlink.get(v), index.get(to)));
            }
        }
        if (lowlink.get(v) === index.get(v)) {
            const comp = [];
            let w;
            do { w = stack.pop(); comp.push(w); } while (w !== v);
            if (comp.length > 1) cycles.push(comp);
        }
    }
    for (const f of files) if (!index.has(f)) strongconnect(f);

    // Handler functions referenced by generated HTML inside parts.
    const genHandlerNames = new Set();
    const genAttrRe = /\son(?:click|change|input|mouseover|mouseout|keyup|keydown|submit|load|focus|blur|contextmenu|dblclick|dragstart|dragover|drop|error)\s*=\s*"([A-Za-z_$][A-Za-z0-9_$]*)/g;
    for (const p of parts) {
        const code = partCode(p.file);
        let m;
        while ((m = genAttrRe.exec(code))) genHandlerNames.add(m[1]);
    }

    // Handler identifiers referenced by index.html inline attributes.
    const handlerNames = new Set();
    const html = fs.readFileSync(INDEX_HTML, 'utf8');
    const attrRe = /\son(?:click|change|input|mouseover|mouseout|keyup|keydown|submit|load|focus|blur|contextmenu|dblclick|dragstart|dragover|drop|error)\s*=\s*("([^"]*)"|'([^']*)')/gi;
    let m;
    while ((m = attrRe.exec(html))) {
        const value = (m[2] || m[3] || '').replace(/'[^']*'|"[^"]*"/g, '');
        for (const name of value.match(/(?<![.\w$])[A-Za-z_$][A-Za-z0-9_$]*/g) || []) handlerNames.add(name);
    }

    return { files, parts, declaredBy, edges, byFrom, cycles, genHandlerNames, handlerNames, missingByPart };
}

const IS_MAIN = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

function main() {
    const { files, parts, declaredBy, edges, byFrom, cycles, genHandlerNames, handlerNames } = analyzeParts();

    console.log('=== ESM (strict-mode) parse gate ===');
    let parseOk = true;
    for (const p of parts) {
        if (p.ast) console.log(`  ✅ ${p.file} parses as ES module`);
        else { console.log(`  ❌ ${p.file}: ${p.error} (line ${p.line})`); parseOk = false; }
    }

    console.log('\n=== Per-part summary ===');
    for (const p of parts) {
        if (!p.ast) continue;
        const missing = [];
        const resolved = [];
        for (const n of p.external) {
            const decls = declaredBy.get(n) || [];
            if (decls.length === 0) missing.push(n);
            else if (decls.length > 1) resolved.push(`${n} (multiple: ${decls.join(',')})`);
            else { resolved.push(n); }
        }
        const imm = immediateStatements(p.ast);
        if (imm.length) {
            for (const s of imm) {
                const nms = [...stmtRefNames(s)].filter((n) => p.external.has(n));
                if (nms.length) {
                    const code = partCode(p.file);
                    const line = code.slice(0, s.start).split('\n').length;
                    console.log(`      ⚠️ immediate stmt line ${line} refs external: ${nms.join(', ')}`);
                }
            }
        }
        console.log(`  ${p.file}: declared=${p.declared.size} external=${p.external.length} ` +
            `resolved=${resolved.length} missing=${missing.length} implicitWrites=${p.implicitWrites.size}`);
        if (missing.length) console.log(`      ❌ unresolved anywhere: ${missing.join(', ')}`);
        if (p.implicitWrites.size) console.log(`      ⚠️ implicit writes (strict-mode crash): ${[...p.implicitWrites].join(', ')}`);
    }

    console.log('\n=== Import edges (part → part) ===');
    const namesByEdge = new Map();
    for (const e of edges) {
        const k = e.from + '→' + e.to;
        if (!namesByEdge.has(k)) namesByEdge.set(k, []);
        namesByEdge.get(k).push(e.name);
    }
    for (const [k, names] of [...namesByEdge.entries()].sort()) {
        console.log(`  ${k}: ${names.sort().join(', ')}`);
    }

    console.log('\n=== Cycle check ===');
    if (cycles.length === 0) console.log('  ✅ no cycles');
    else for (const c of cycles) console.log(`  ❌ cycle: ${c.join(' -> ')} -> ${c[0]}`);

    const reserved = new Set(['this', 'event', 'true', 'false', 'null', 'undefined', 'return', 'if', 'else', 'function', 'var', 'new', 'window', 'document', 'localStorage', 'setTimeout', 'clearTimeout', 'confirm', 'prompt', 'alert', 'Number', 'String', 'Boolean', 'parseInt', 'parseFloat', 'Math', 'JSON', 'Date', 'encodeURIComponent', 'Array', 'Object', 'isNaN', 'location', 'history', 'navigator']);

    console.log('\n=== generated-HTML inline-handler references (parts) ===');
    console.log(`  ${genHandlerNames.size} handler functions referenced by generated HTML`);
    for (const n of [...genHandlerNames].sort()) {
        const decls = declaredBy.get(n) || [];
        const tag = decls.length === 1 ? '✅' : decls.length === 0 ? '❌ NOT DECLARED' : '⚠️ MULTIPLE';
        if (decls.length === 0 && !reserved.has(n)) console.log(`  ❌ ${n}  NOT DECLARED ANYWHERE`);
    }
    console.log(`  (${[...genHandlerNames].filter((n) => declaredBy.has(n)).length} resolve to a part; ` +
        `${[...genHandlerNames].filter((n) => !declaredBy.has(n) && !reserved.has(n)).length} genuinely missing)`);

    console.log('\n=== index.html inline-handler references ===');
    const needWindow = [...handlerNames].filter((n) => !reserved.has(n));
    console.log(`  ${needWindow.length} identifiers referenced by inline handlers`);
    for (const n of needWindow) {
        const decls = declaredBy.get(n) || [];
        const tag = decls.length === 1 ? '✅' : decls.length === 0 ? '❌ NOT DECLARED' : '⚠️ MULTIPLE';
        console.log(`  ${tag} ${n}  ${decls.length ? '→ ' + decls.join(', ') : ''}`);
    }
}

if (IS_MAIN) main();