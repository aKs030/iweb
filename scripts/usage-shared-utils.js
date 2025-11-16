/* eslint-env node */
/* eslint-disable no-console */
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const file = path.join(__dirname, '..', 'content', 'webentwicklung', 'shared-utilities.js');
const src = fs.readFileSync(file, 'utf-8');

// find exported symbols
const exportRegex = /export (?:function|class|const)\s+([A-Za-z0-9_]+)/g;
const exports = new Set();
let m;
while ((m = exportRegex.exec(src)) !== null) {
  exports.add(m[1]);
}

console.log('Found exports:', [...exports].join(', '));

const results = [];
for (const sym of exports) {
  try {
    const out = execSync(`git grep -n -- "\\b${sym}\\b" || true`).toString().trim();
    const lines = out.split('\n').filter(Boolean);
    // filter out occurrences in this file itself
    const other = lines.filter((l) => !l.startsWith(file + ':'));
    results.push({ sym, count: other.length, examples: other.slice(0, 3) });
  } catch (e) {
    results.push({ sym, count: 0, examples: [] });
  }
}

console.log('Usage summary (count = references outside shared-utilities):');
results
  .sort((a, b) => a.count - b.count)
  .forEach((r) => {
    console.log(r.sym.padEnd(30), r.count);
    if (r.examples.length) r.examples.forEach((e) => console.log('   ', e));
  });
