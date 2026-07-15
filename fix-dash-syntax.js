const fs = require('fs');
let content = fs.readFileSync('src/dashboard/index.html', 'utf8');

// Find ALL problematic patterns in the bar chart .map() callback

// Pattern 1: stray " after closing single quote in the map return
// Fix: replace '"}).join('')  with  '}).join('')
let count = 0;

// First, let's find where the problem is
const idx = content.indexOf("'\"}).join");
if (idx >= 0) {
  console.log("Found pattern '\"}) at index", idx);
  console.log("Context:", content.substring(idx - 20, idx + 30));
  
  // Replace all occurrences
  const before = content;
  content = content.replace(/'\"\}\)\.join/g, "'}).join");
  
  if (content !== before) {
    count++;
    console.log("Fixed: removed stray double quote");
  }
} else {
  console.log("Pattern '\"}) not found directly");
  
  // Try without escaping
  const idx2 = content.indexOf("'})");
  if (idx2 >= 0) {
    console.log("Found good pattern '}) at index", idx2);
  }
}

// Also check the showSrv function more broadly for issues
// Look for any broken string concatenation patterns
const problematicPatterns = [
  { find: /<\/div>'"}/g, replace: "</div>'}" },
  { find: /span><\/div>'"}./g, replace: "span></div>'})." },
];

for (const p of problematicPatterns) {
  const match = content.match(p.find);
  if (match) {
    console.log("Found pattern:", JSON.stringify(p.find), "- matches:", match.length);
    content = content.replace(p.find, p.replace);
    count++;
  }
}

console.log("Total fixes applied:", count);

// Write back
fs.writeFileSync('src/dashboard/index.html', content, 'utf8');

// Verify
const match = content.match(/<script>([\s\S]*)<\/script>/);
if (match) {
  fs.writeFileSync('dash-script.js', match[1]);
  console.log("Script extracted for verification");
}
console.log("Done");
