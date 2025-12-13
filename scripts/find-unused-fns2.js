const fs = require('fs');
const _path = require('path');

function walk(dir, files = []) {
  const entries = fs.readdirSync(dir, {withFileTypes: true});
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (['node_modules','content/vendor','tests','.git'].includes(e.name)) continue;
      walk(full, files);
    } else if (e.isFile() && (full.endsWith('.js') || full.endsWith('.html') || full.endsWith('.ts') || full.endsWith('.tsx') || full.endsWith('.jsx'))) {
      files.push(full);
    }
  }
  return files;
}

const root = process.cwd();
const files = walk(root);
const exportRegex = /export\s+function\s+([A-Za-z0-9_]+)\s*\(/g;

const names = new Set();
files.forEach(f => {
  const code = fs.readFileSync(f,'utf8');
  let m;
  while ((m = exportRegex.exec(code)) !== null) names.add(m[1]);
});

const results = [];
names.forEach(name => {
  let count = 0;
  files.forEach(f => {
    const content = fs.readFileSync(f,'utf8');
    const re = new RegExp('\\b' + name + '\\b','g');
    const matches = content.match(re);
    if (matches) count += matches.length;
  });
  if (count <= 1) results.push({name, count});
});

results.sort((a,b) => a.name.localeCompare(b.name));
console.warn(JSON.stringify(results, null, 2));
