// One-time migration for the data-fn conversion: wraps already-emitted bare
// data-args values in the JSON array the delegated dispatcher expects
// (JSON.parse(raw).map(resolveArg)).
//
// Pass 1 — escaped-delimiter values (jsq string context in .mjs sources):
//   data-args=\'"X"\'             → data-args=\'["X"]\'
//   data-args=\''+fnData(e)+'\'   → data-args=\'['+fnData(e)+']\'
// Pass 2 — raw-delimiter values (static HTML + template-literal context):
//   data-args='"X"'               → data-args='["X"]'
//   data-args='${fnData(e)}'      → data-args='[${fnData(e)}]'
// Values already starting with '[' (wrapped earlier, static _seq arrays) are
// left alone. Idempotent end state: every data-args value is a JSON array.
//
// Run: node scripts/migrate-data-args.mjs src/dashboard/parts/*.mjs src/dashboard/*.html
import fs from 'node:fs';

const FILES = process.argv.slice(2);
if (!FILES.length) {
    console.error('usage: node migrate-data-args.mjs <files...>');
    process.exit(1);
}

// Pass 1: value delimited by \' on both sides. Tempered dot so the value can't
// contain the \' sequence itself (bare ' IS allowed — junction quotes).
const ESC_RE = /data-args=\\'((?:(?!\\').)*)\\'/g;
// Pass 2: value delimited by raw ' on both sides (value must not contain ').
const RAW_RE = /data-args='((?:(?!\\').)*)'/g;

const wrap = (val) => '[' + val + ']';
const isArr = (val) => val.startsWith('[');

function migrate(src, counters) {
    src = src.replace(ESC_RE, (m, val) => {
        if (isArr(val)) return m;
        counters.esc++;
        return "data-args=\\'" + wrap(val) + "\\'";
    });
    src = src.replace(RAW_RE, (m, val) => {
        // Shape-gated: only genuine array-to-be values, never fragments of
        // escaped-delimiter attributes scanned from the inside.
        if (isArr(val) || !(val.includes('${fnData(') || !val.includes("'"))) return m;
        counters.raw++;
        return "data-args='" + wrap(val) + "'";
    });
    return src;
}

let total = { esc: 0, raw: 0 };
for (const f of FILES) {
    let src = fs.readFileSync(f, 'utf8');
    const counters = { esc: 0, raw: 0 };
    src = migrate(src, counters);
    if (counters.esc || counters.raw) fs.writeFileSync(f, src);
    console.log((counters.esc || counters.raw ? '✔' : '·') + ' ' + f + ': ' + counters.esc + ' escaped-delimited, ' + counters.raw + ' raw-delimited');
    total.esc += counters.esc;
    total.raw += counters.raw;
}
console.log('\nTotal wrapped: ' + (total.esc + total.raw) + ' (' + total.esc + ' escaped, ' + total.raw + ' raw)');
