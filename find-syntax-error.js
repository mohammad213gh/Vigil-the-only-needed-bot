const fs = require('fs');
let content = fs.readFileSync('src/dashboard/index.html', 'utf8');

// Extract script
const match = content.match(/<script>([\s\S]*)<\/script>/);
if (!match) { console.log('NO SCRIPT FOUND'); process.exit(1); }

const script = match[1];
const lines = script.split('\n');

// Find exactly line 173 (0-indexed line 172)
for (let i = 170; i < Math.min(lines.length, 178); i++) {
  const line = lines[i];
  // Find the problematic '"\}) pattern
  const badMatch = line.match(/'\}\}\)/);
  if (badMatch) {
    console.log(`SYNTAX ERROR at L${i+1}: ${line}`);
    const idx = line.indexOf(badMatch[0]);
    console.log(`Context around error (chars ${Math.max(0,idx-30)}-${idx+30}):`);
    console.log(line.substring(Math.max(0, idx-30), idx+30));
    console.log(`Character codes: ${line.substring(idx-2, idx+5).split('').map(c => c.charCodeAt(0)).join(',')}`);
  }
  
  // Also check for standalone '"
  const quoteMatch = line.match(/'"/);
  if (quoteMatch && !line.match(/'\+"/)) {
    console.log(`POTENTIAL ISSUE at L${i+1}: ${line}`);
    const idx = line.indexOf(quoteMatch[0]);
    console.log(`Context: ...${line.substring(Math.max(0, idx-40), idx+20)}...`);
    console.log(`Chars: ${line.substring(idx-1, idx+3).split('').map(c => c.charCodeAt(0)).join(',')}`);
  }
}

// Also check for any issue with the .replace effect
// The original had: font-size:6px;color:var(--text-muted);">
// After replacement: font-size:7px;color:var(--text-muted);font-weight:500;">
// Check if the replacement actually happened
if (script.includes('font-size:6px;color:var(--text-muted);')) {
  console.log('\nUNCHANGED: font-size:6px still present - replacement failed!');
}
if (script.includes('font-size:7px;color:var(--text-muted);font-weight:500;')) {
  console.log('\nCHANGED: font-size:7px with font-weight found - replacement worked!');
}

// Check the bar chart end pattern
if (script.includes("</div>'\"}")) {
  console.log('\nBROKEN: Found </div>\'"}) pattern - this is likely the syntax error');
}
if (script.includes("</div>'}")) {
  console.log('\nCLEAN: Found </div>\'}) pattern - this is correct');
}
