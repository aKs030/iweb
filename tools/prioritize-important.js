#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const reportFile = path.join(repoRoot, 'IMPORTANT_REPORT.md');

if (!fs.existsSync(reportFile)) {
  console.error('IMPORTANT_REPORT.md not found. Run tools/scan-important.js first.');
  process.exit(1);
}

const text = fs.readFileSync(reportFile, 'utf8');

// Extract the review section
const reviewStart = text.indexOf('## review');
if (reviewStart === -1) {
  console.log('No review section found.');
  process.exit(0);
}
const reviewText = text.slice(reviewStart);

const entryRegex = /- \*\*([^:]+):(\d+)\*\* — ([^\n]+)/g;
let m;
const entries = [];
while ((m = entryRegex.exec(reviewText)) !== null) {
  const file = m[1].trim();
  const line = parseInt(m[2], 10);
  const snippet = m[3].trim();
  // capture following code block (```) if exists
  const after = reviewText.slice(m.index + m[0].length);
  const codeMatch = after.match(/```\n([\s\S]*?)\n```/);
  const context = codeMatch ? codeMatch[1].trim() : '';
  entries.push({file, line, snippet, context});
}

// Group by file
const byFile = entries.reduce((acc,e)=>{ acc[e.file] = acc[e.file]||[]; acc[e.file].push(e); return acc; }, {});

// Scoring heuristic: lower risk -> higher priority for auto-removal
function riskScore(entry) {
  const s = (entry.snippet + ' ' + entry.context).toLowerCase();
  // safe patterns: animation/transition none or very small durations
  if (/animation:\s*none|transition:\s*none|animation-duration:\s*0(?:\.0+)?ms/.test(s)) return 10;
  // print-only or prefers-reduced-motion contexts: medium (likely intentional)
  if (/@media\s*\(prefers-reduced-motion|@media\s*\(print\)/.test(s)) return 4;
  // visually-hidden/clip — do not auto-remove
  if (/visually-hidden|clip:\s*rect\(0 0 0 0\)/.test(s)) return 0;
  // tiny spacing adjustments - low-medium risk
  if (/margin|padding|gap|font-size|min-height/.test(s)) return 5;
  // menu / font-weight / color critical: high risk
  if (/font-family|font-weight|color|text-shadow/.test(s)) return 1;
  // default conservative
  return 3;
}

const fileScores = Object.keys(byFile).map(file => {
  const items = byFile[file];
  const score = items.reduce((sum,e)=> sum + riskScore(e), 0) / items.length;
  return {file, count: items.length, score, items};
});

// sort by score desc (higher score = safer to auto-handle)
fileScores.sort((a,b)=> b.score - a.score || b.count - a.count);

const top = fileScores.slice(0, 12);

console.log('\nPrioritized Top review candidates (higher score = safer to auto-handle)\n');
for (const f of top) {
  console.log(`- ${f.file} — ${f.count} hits — score ${f.score.toFixed(1)}`);
  const sample = f.items.slice(0,2).map(it => `  • line ${it.line}: ${it.snippet}`).join('\n');
  console.log(sample + '\n');
}

console.log('\nSuggested action: For files with score >=7, consider automatic removal (create PRs). For score 4-6, create a manual small PR per file and review. For score <=3, manual review required and do not auto-change.');
process.exit(0);
