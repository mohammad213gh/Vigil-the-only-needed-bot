const fs = require('fs');
const content = fs.readFileSync('src/dashboard/index.html', 'utf8');
const match = content.match(/<script>([\s\S]*)<\/script>/);
if (!match) { console.log('No script tag found'); process.exit(1); }

const script = match[1];
// Write to temp file for syntax check
fs.writeFileSync('/tmp/dash-check.js', script, 'utf8');
console.log('Script extracted, length:', script.length);
