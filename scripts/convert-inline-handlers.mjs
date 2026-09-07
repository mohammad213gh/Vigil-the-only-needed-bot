// One-time codemod: converts inline event handlers in the dashboard frontend
// to data-fn / data-args attributes consumed by the delegated dispatcher in
// parts/00-entry.mjs (required because the CSP no longer allows 'unsafe-inline'
// in script-src).
//
//   onclick="fn('a', 1)"                  → data-fn="fn" data-args='["a",1]'
//   onclick="a();b()"                     → data-fn="_seq" data-args='[["a"],["b"]]'
//   onclick="fn(this)"                    → data-fn="fn" data-args='["@el"]'
//   onchange="fn(this.value)"             → data-fn="fn" data-args='["@value"]'
//   onerror="this.style.display='none'"   → data-fn="_hideSelf"
//
// In .mjs files the attribute lives inside a JS single-quoted string, so
// runtime values appear as ' + expr + ' junctions or ${expr} template holes.
// Those become data-args pieces emitted through the fnData() helper
// (JSON.stringify + quote escaping) at runtime. Values it cannot statically
// understand are LEFT UNTOUCHED and reported. Idempotent: attributes already
// containing data-fn are skipped.
//
// Run: node scripts/convert-inline-handlers.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILES = [
    'src/dashboard/index.html',
    'src/dashboard/login.html',
    ...fs.readdirSync(path.join(ROOT, 'src/dashboard/parts'))
        .filter((f) => f.endsWith('.mjs'))
        .sort()
        .map((f) => 'src/dashboard/parts/' + f),
];

const EV_ATTRS = ['onclick', 'onchange', 'oninput', 'onkeydown', 'onerror'];
const skipped = [];

// ── Tokenize an attribute value that lives inside a JS string in an .mjs file.
// Two source contexts exist:
//   jsq  — outer '…' string: \' is a literal quote, and a bare ' followed by +
//          opens a runtime junction ' + expr + '. A bare ' is ALWAYS a string
//          delimiter (junction boundary), never literal content.
//   tmpl — outer `…` template: quotes are literal, ${expr} are runtime holes.
// Returns a list of { t: 'lit' | 'expr', v } parts, or null when the value
// can't be parsed statically (caller leaves it untouched and reports it).
function tokenizeMjs(raw) {
    const parts = [];
    let lit = '';
    const pushLit = () => { if (lit) { parts.push({ t: 'lit', v: lit }); lit = ''; } };
    const pushExpr = (code) => parts.push({ t: 'expr', v: code.trim() });

    // Template-literal context: no junctions, ${…} holes, quotes are literal.
    if (raw.includes('${')) {
        let i = 0;
        while (i < raw.length) {
            if (raw[i] === '$' && raw[i + 1] === '{') {
                let depth = 1;
                let j = i + 2;
                let code = '';
                while (j < raw.length && depth > 0) {
                    if (raw[j] === '{') depth++;
                    else if (raw[j] === '}') depth--;
                    if (depth > 0) code += raw[j];
                    j++;
                }
                if (depth !== 0) return null;
                pushLit();
                pushExpr(code);
                i = j;
            } else {
                lit += raw[i];
                i++;
            }
        }
        pushLit();
        return parts;
    }

    // Single-quoted JS string context.
    let i = 0;
    while (i < raw.length) {
        if (raw[i] === '\\' && raw[i + 1] === "'") {
            lit += "'";
            i += 2;
            continue;
        }
        if (raw[i] === "'") {
            // Junction open: ' + expr + ' (whitespace-tolerant).
            let k = i + 1;
            while (k < raw.length && raw[k] === ' ') k++;
            if (raw[k] !== '+') return null; // bare ' not opening a junction
            k++; // the +
            while (k < raw.length && raw[k] === ' ') k++;
            let depth = 0;
            let code = '';
            let done = false;
            while (k < raw.length) {
                const c = raw[k];
                if (c === '(' || c === '[' || c === '{') depth++;
                else if (c === ')' || c === ']' || c === '}') depth--;
                else if (depth <= 0 && (c === "'" || c === '`' || c === '"')) return null; // exprs with quotes are hand-converted
                if (depth <= 0 && c === '+') {
                    let m = k + 1;
                    while (m < raw.length && raw[m] === ' ') m++;
                    if (raw[m] === "'") { i = m; done = true; break; }
                }
                code += c;
                k++;
            }
            if (!done) return null; // ran off the end
            pushLit();
            pushExpr(code);
            i++; // skip the junction-closing quote (a delimiter, not content)
            continue;
        }
        lit += raw[i];
        i++;
    }
    pushLit();
    return parts;
}

// Rebuild pseudo source: literals inline, exprs as «E:n» markers.
function partsToPseudo(parts) {
    return parts.map((p, n) => (p.t === 'lit' ? p.v : '\u00abE' + n + '\u00bb')).join('');
}

const MARK_RE = /\u00abE(\d+)\u00bb/g;

// Split a JS argument list on top-level commas (naive but adequate — exprs
// are markers at this point so quotes/parens can't nest weirdly).
function splitArgs(s) {
    const out = [];
    let depth = 0;
    let cur = '';
    for (const c of s) {
        if (c === '(' || c === '[' || c === '{') depth++;
        if (c === ')' || c === ']' || c === '}') depth--;
        if (c === ',' && depth === 0) { out.push(cur.trim()); cur = ''; continue; }
        cur += c;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
}

// Convert one argument (pseudo source with markers) into a JSON producer.
// Returns { json } (literal) or { expr } (JS expr yielding a JSON value), or
// null when the argument can't be represented statically.
function argToJson(arg, parts) {
    const a = arg.trim();
    if (a === 'this') return { json: '@el' };
    if (a === 'this.value') return { json: '@value' };
    if (a === 'this.checked') return { json: '@checked' };
    if (a === 'this.dataset.tag' || a === 'this.dataset.uid') return { json: '@el' }; // handler reads dataset itself
    if (/^-?\d+(\.\d+)?$/.test(a)) return { json: Number(a) };
    if (a === 'true') return { json: true };
    if (a === 'false') return { json: false };
    const m = a.match(/^'(.*)'$/s);
    if (m && !MARK_RE.test(m[1])) {
        MARK_RE.lastIndex = 0;
        return { json: m[1] };
    }
    MARK_RE.lastIndex = 0;
    // Marker present: build a single JS expr. Lone ' literals are JS string
    // delimiters from the generated source (quoting around runtime values),
    // not data — drop them; fnData re-quotes via JSON.stringify.
    const segs = [];
    let mm;
    let last = 0;
    MARK_RE.lastIndex = 0;
    while ((mm = MARK_RE.exec(a)) !== null) {
        if (mm.index > last) segs.push({ lit: a.slice(last, mm.index) });
        segs.push({ expr: parts[Number(mm[1])].v });
        last = mm.index + mm[0].length;
    }
    MARK_RE.lastIndex = 0;
    if (last < a.length) segs.push({ lit: a.slice(last) });
    const meaningful = segs.filter((s) => s.expr || (s.lit && s.lit !== "'"));
    if (meaningful.length === 0) return null;
    if (meaningful.length === 1 && meaningful[0].expr) return { expr: meaningful[0].expr };
    if (meaningful.some((s) => s.lit && s.lit.includes("'"))) return null;
    return {
        expr: meaningful
            .map((s) => (s.expr ? '(' + s.expr + ')' : "'" + s.lit + "'"))
            .join('+'),
    };
}

// Parse a plain-JS attribute value (static HTML) into calls.
function parseHtmlCalls(body) {
    const stmts = body.split(';').map((s) => s.trim()).filter(Boolean);
    const calls = [];
    for (const st of stmts) {
        // Drop an `if(event.key==='Enter')` guard — dispatcher only fires keydown on Enter.
        const guard = st.match(/^if\(event\.key===?['"]Enter['"]\)(.*)$/);
        const inner = guard ? guard[1].trim() : st;
        const m = inner.match(/^([A-Za-z_$][\w$]*)\((.*)\)$/s);
        if (!m) return null;
        const args = [];
        if (m[2].trim()) {
            for (const a of splitArgs(m[2])) {
                const j = argToJson(a, []);
                if (!j) return null;
                args.push(j);
            }
        }
        calls.push({ fn: m[1], args });
    }
    return calls;
}

// Parse an mjs-context handler value into calls plus its string context.
function parseMjsCalls(raw) {
    if (/^this\.style\.display\s*=\s*\\?'none\\?'$/.test(raw.trim())) return { hideSelf: true };
    if (/^this\.classList\.toggle\s*\(\s*\\?'collapsed\\?'\s*\)$/.test(raw.trim())) {
        return { calls: [{ fn: 'toggleCollapsed', args: [{ json: '@el' }] }], ctx: 'jsq' };
    }
    const raw2 = raw.replace(/^if\(event\.key===?\\?'Enter\\?'\)/, '');
    const ctx = raw2.includes('${') ? 'tmpl' : 'jsq';
    const parts = tokenizeMjs(raw2);
    if (!parts) return null;
    const src = partsToPseudo(parts);
    const stmts = src.split(';').map((s) => s.trim()).filter(Boolean);
    const calls = [];
    for (const st of stmts) {
        const m = st.match(/^([A-Za-z_$][\w$]*)\((.*)\)$/s);
        if (!m) return null;
        const args = [];
        if (m[2].trim()) {
            for (const a of splitArgs(m[2])) {
                const j = argToJson(a, parts);
                if (!j) return null;
                args.push(j);
            }
        }
        calls.push({ fn: m[1], args });
    }
    return { calls, ctx };
}

// Escape a literal JSON text for the output context. The text becomes the
// VALUE of a single-quoted HTML attribute, then must also survive the JS
// string layer of the generated source.
//   jsq/tmpl: HTML-escape ' as &#39; (browser decodes it back before JSON
//             parsing), then make it source-safe (backslashes, and for
//             templates backticks + ${).
//   html:     static file — only ' needs escaping.
function escJson(text, ctx) {
    if (ctx === 'html') return text.replace(/'/g, '&#39;');
    let out = text.replace(/\\/g, '\\\\');
    if (ctx === 'tmpl') out = out.replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
    return out.replace(/'/g, '&#39;');
}

// Wrap a runtime fnData(expr) piece for the output string context. In a
// template literal the hole interpolates; in a '…' string the piece closes,
// concatenates, and reopens the string.
function exprPiece(expr, ctx) {
    if (ctx === 'tmpl') return '${fnData(' + expr + ')}';
    return "'+fnData(" + expr + ")+'";
}

// Build the replacement attributes for one handler call list. data-args is
// always a JSON ARRAY (the dispatcher parses it and maps resolveArg over it).
// The attr-delimiting quotes are source-escaped (\') in jsq context because
// the replacement is spliced inside a '…' JS string; raw elsewhere.
function buildAttrs(calls, ctx) {
    const q = ctx === 'jsq' ? "\\'" : "'";
    if (calls.length === 1) {
        const c = calls[0];
        if (c.args.length === 0) return 'data-fn="' + c.fn + '"';
        const pieces = c.args.map((a) => ('json' in a ? escJson(JSON.stringify(a.json), ctx) : exprPiece(a.expr, ctx)));
        return 'data-fn="' + c.fn + '" data-args=' + q + '[' + pieces.join(',') + ']' + q;
    }
    // Sequence: only produced from static HTML, always literal JSON.
    const seq = calls.map((c) => '[' + c.fn + (c.args.length ? ',' + c.args.map((a) => JSON.stringify(a.json)).join(',') : '') + ']');
    return 'data-fn="_seq" data-args=' + q + escJson('[' + seq.join(',') + ']', ctx) + q;
}

function convertFile(rel) {
    const fp = path.join(ROOT, rel);
    const isMjs = rel.endsWith('.mjs');
    let src = fs.readFileSync(fp, 'utf8');
    let converted = 0;

    for (const attr of EV_ATTRS) {
        // Collect all matches for this attribute first, then replace from the
        // end so earlier indices stay valid (no marker/infinite-loop tricks).
        const re = new RegExp('\\b' + attr + '="', 'g');
        const spans = [];
        let m;
        while ((m = re.exec(src)) !== null) {
            const start = m.index;
            const vStart = start + attr.length + 2; // after ="
            let end;
            if (isMjs) {
                // Value is delimited by the next unescaped '"' — inside a JS
                // single-quoted string a raw '"' doesn't need escaping, and a
                // '\"' sequence would render as a plain quote in the HTML.
                end = -1;
                for (let k = vStart; k < src.length; k++) {
                    if (src[k] === '"' && src[k - 1] !== '\\') { end = k; break; }
                }
                if (end === -1) break;
            } else {
                end = src.indexOf('"', vStart);
                if (end === -1) break;
            }
            spans.push({ start, vStart, end, raw: src.slice(vStart, end) });
            re.lastIndex = end + 1;
        }
        for (let i = spans.length - 1; i >= 0; i--) {
            const s = spans[i];
            if (s.raw.includes('data-fn')) continue; // already converted
            let replacement = null;
            if (isMjs) {
                const parsed = parseMjsCalls(s.raw);
                if (parsed && parsed.hideSelf) replacement = 'data-fn="_hideSelf"';
                else if (parsed && parsed.calls) {
                    try { replacement = buildAttrs(parsed.calls, parsed.ctx); } catch { replacement = null; }
                }
            } else {
                const calls = parseHtmlCalls(s.raw);
                if (calls) {
                    try { replacement = buildAttrs(calls, 'html'); } catch { replacement = null; }
                }
            }
            if (!replacement) {
                skipped.push(rel + ' [' + attr + ']: ' + s.raw.slice(0, 110).replace(/\n/g, ' '));
                continue;
            }
            src = src.slice(0, s.start) + replacement + src.slice(s.end + 1);
            converted++;
        }
    }

    fs.writeFileSync(fp, src);
    return converted;
}

let total = 0;
for (const f of FILES) {
    const n = convertFile(f);
    total += n;
    console.log((n > 0 ? '✔' : '·') + ' ' + f + ': ' + n + ' converted');
}
console.log('\nTotal converted: ' + total);
if (skipped.length) {
    console.log('\nSKIPPED (hand-convert these):');
    for (const s of skipped) console.log('  - ' + s);
}
