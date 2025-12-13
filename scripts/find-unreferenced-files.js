#!/usr/bin/env node
/* Find JS files under content/ and pages/ that are not referenced anywhere in the repo
   Heuristics: file path (relative) or basename must appear in other files (HTML import/script tags or JS imports)
*/
const fs = require('fs');
const path = require('path');
const glob = require('glob');

const root = process.cwd();
const files = glob.sync('**/*.js', {
  cwd: root,
  absolute: true,
  ignore: ['**/node_modules/**', '**/content/vendor/**', '**/tmp/**', '**/dist/**']
});

const candidates = [];

const allTextFiles = glob.sync('**/*.{js,ts,html,css}', {
  cwd: root,
  absolute: true,
  ignore: ['**/node_modules/**', '**/content/vendor/**', '**/tmp/**', '**/dist/**']
});
const texts = {};
allTextFiles.forEach(f => {
  texts[f] = fs.readFileSync(f, 'utf8');
});

files.forEach(f => {
  if (!(f.includes(path.sep + 'content' + path.sep) || f.includes(path.sep + 'pages' + path.sep))) return;
  const rel = path.relative(root, f);
  const basename = path.basename(f);
  let found = 0;
  for (const [file, content] of Object.entries(texts)) {
    if (file === f) continue;
    if (
      content.includes(rel) ||
      content.includes('/' + rel) ||
      content.includes(basename) ||
      content.includes(rel.replace(/\\.js$/, ''))
    ) {
      found++;
      break;
    }
  }
  if (found === 0) {
    candidates.push(rel);
  }
});

console.warn('Unreferenced candidates (heuristic):');
if (candidates.length === 0) console.warn(' - None');
candidates.forEach(c => console.warn(' -', c));

// write report
const out = {candidates};
if (!fs.existsSync(path.join(root, 'tmp'))) fs.mkdirSync(path.join(root, 'tmp'), {recursive: true});
fs.writeFileSync(path.join(root, 'tmp', 'unreferenced-report.json'), JSON.stringify(out, null, 2));
console.warn('\nWrote tmp/unreferenced-report.json');
