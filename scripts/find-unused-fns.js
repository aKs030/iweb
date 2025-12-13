const fs = require('fs');
const _path = require('path');
const glob = require('glob');

const _root = process.cwd();
const files = glob.sync('**/*.js', {ignore: ['node_modules/**', 'content/vendor/**', 'tests/**', 'dist/**']});

const functionDecl = /(?:function)\s+([A-Za-z0-9_]+)\s*\(/g;
const exportFunc = /export\s+function\s+([A-Za-z0-9_]+)\s*\(/g;

const candidates = [];

files.forEach(file => {
  const code = fs.readFileSync(file, 'utf8');
  let m;
  const names = new Set();
  while ((m = functionDecl.exec(code))) {
    names.add(m[1]);
  }
  while ((m = exportFunc.exec(code))) {
    names.add(m[1]);
  }
  names.forEach(name => {
    // Count occurrences across all files
    let count = 0;
    files.forEach(f2 => {
      const content = fs.readFileSync(f2, 'utf8');
      const re = new RegExp('\\b' + name + '\\b', 'g');
      const matches = content.match(re);
      if (matches) count += matches.length;
    });
    if (count <= 1) {
      candidates.push({file, name, count});
    }
  });
});

// Deduplicate by name
const byName = {};
candidates.forEach(c => {
  if (!byName[c.name] || byName[c.name].count > c.count) byName[c.name] = c;
});

const result = Object.values(byName).sort((a, b) => a.name.localeCompare(b.name));
console.warn(JSON.stringify(result, null, 2));
