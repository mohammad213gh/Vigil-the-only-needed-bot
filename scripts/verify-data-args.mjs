// Verification: every data-args value in the dashboard source must be either
// static valid JSON (an array) or a correctly shaped runtime value — wrapped
// in [ … ], every element a fnData(...) piece. Exits non-zero on any failure
// so CI can run it.
import fs from 'node:fs';

const files = [
    ...fs.readdirSync('src/dashboard/parts').filter((f) => f.endsWith('.mjs')).map((f) => 'src/dashboard/parts/' + f),
    'src/dashboard/index.html',
    'src/dashboard/login.html',
];

let ok = 0;
let bad = 0;
const fail = (file, val, why) => { bad++; console.log('BAD  ' + file + ' → ' + val.slice(0, 90) + '  (' + why + ')'); };

// Split an attribute value's inner text on top-level commas. Paren-aware and
// quote-aware: commas inside JSON strings ("…" with \\” escapes in the jsq
// layer) don't split.
function splitTop(inner) {
    const out = [];
    let depth = 0;
    let inStr = false;
    let cur = '';
    for (let i = 0; i < inner.length; i++) {
        const c = inner[i];
        if (c === '\\' && i + 1 < inner.length) { cur += c + inner[i + 1]; i++; continue; }
        if (c === '"') inStr = !inStr;
        if (c === '(' || c === '[') depth++;
        else if (c === ')' || c === ']') depth--;
        else if (c === ',' && depth === 0 && !inStr) { out.push(cur); cur = ''; continue; }
        cur += c;
    }
    out.push(cur);
    return out;
}

function balancedParens(s) {
    let depth = 0;
    for (const c of s) {
        if (c === '(') depth++;
        else if (c === ')') depth--;
        if (depth < 0) return false;
    }
    return depth === 0;
}

// Source JS-string layer unescape: \' \" \\ → ' " \
const unescapeJs = (s) => s.replace(/\\(['"\\])/g, '$1');

for (const file of files) {
    const src = fs.readFileSync(file, 'utf8');
    // data-args= followed by \'…\' (escaped delimiter — junctions may contain
    // bare ' quotes inside) or '…' (raw delimiter — template context / static
    // HTML). Raw values may legitimately contain ' emitted by fnData (always
    // followed by ']' or ',' in compact JSON); the attribute terminator is a '
    // followed by '>' or whitespace.
    const re = /data-args=\\'((?:(?!\\')[\s\S])*)\\'|data-args='((?:(?!'(?=[>\s]))[\s\S])*)'/g;
    let m;
    while ((m = re.exec(src)) !== null) {
        const escaped2 = m[1] !== undefined;
        const rawVal = escaped2 ? m[1] : m[2];
        // Whole-value junction template (e.g. tkPill's data-args='+args+'): the
        // entire array JSON comes from a call-site expression at render time.
        if (escaped2 && /^'\+[A-Za-z_$][\w$]*\+'$/.test(rawVal)) { ok++; continue; }
        if (!rawVal.startsWith('[') || !rawVal.endsWith(']')) { fail(file, rawVal, 'not array-wrapped'); continue; }
        const inner = rawVal.slice(1, -1);
        const isRuntime = escaped2 ? inner.includes('fnData(') : inner.includes('${');

        if (!isRuntime) {
            const jsonText = escaped2 ? unescapeJs(rawVal) : rawVal.replace(/&#39;/g, "'");
            try { JSON.parse(jsonText); ok++; } catch { fail(file, rawVal, 'invalid static JSON'); }
            continue;
        }

        const pieces = splitTop(inner);
        let pieceOk = true;
        // One element: either a fnData junction, a nested array (a _seq step
        // whose elements are JSON literals and/or fnData junctions), or a
        // static JSON literal.
        function checkElement(p) {
            if (p.startsWith('[') && p.endsWith(']')) {
                for (const e of splitTop(p.slice(1, -1))) checkElement(e);
                return;
            }
            const body = escaped2
                ? (p.match(/^'\+fnData\(([\s\S]*)\)\+'$/) || [])[1]
                : (p.match(/^\$\{fnData\(([\s\S]*)\)\}$/) || [])[1];
            if (body !== undefined) {
                if (!balancedParens(body)) pieceOk = false;
                return;
            }
            const jsonText = escaped2 ? unescapeJs(p) : p;
            try { JSON.parse(jsonText); } catch { pieceOk = false; }
        }
        for (const p of pieces) {
            checkElement(p);
            if (!pieceOk) break;
        }
        if (pieceOk && pieces.length) ok++;
        else fail(file, rawVal, 'malformed runtime element');
    }
}

console.log('\nOK: ' + ok + '  BAD: ' + bad);
process.exit(bad ? 1 : 0);
