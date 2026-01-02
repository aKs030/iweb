#!/usr/bin/env node
// Check staged files for forbidden paths, exit 1 if any are present
const { execSync } = require('child_process');
const out = execSync('git diff --name-only --cached', { encoding: 'utf8' });
const files = out.split('\n').filter(Boolean);
const forbidden = [
  /^node_modules\//,
  /^content\/config\/videos-part-.*\.js$/,
  /^content\/config\/.*\.local\.js$/,
];
let found = [];
for (const f of files) {
  for (const re of forbidden) {
    if (re.test(f)) found.push(f);
  }
}
if (found.length) {
  console.error('ERROR: The following staged files are forbidden to commit:');
  found.forEach((f) => console.error(' - ' + f));
  console.error('\nPlease remove them from the commit or update .gitignore if appropriate.');
  process.exit(1);
}
console.log('check-staged: OK');
