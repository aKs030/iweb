const fs = require('fs');
const _path = require('path');

function walk(dir, files = []) {
  const entries = fs.readdirSync(dir, {withFileTypes: true});
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (['node_modules', 'content/vendor', 'tests', '.git'].includes(e.name)) continue;
      walk(full, files);
    } else if (
      e.isFile() &&
      (full.endsWith('.js') ||
        full.endsWith('.html') ||
        full.endsWith('.ts') ||
        full.endsWith('.tsx') ||
        full.endsWith('.jsx'))
    ) {
      files.push(full);
    }
  }
  return files;
}

const root = process.cwd();
const files = walk(root);

const funcDeclRegex = /(?:^|\n)\s*function\s+([A-Za-z0-9_]+)\s*\(/g;

const declResults = [];
files.forEach(f => {
  const code = fs.readFileSync(f, 'utf8');
  let m;
  while ((m = funcDeclRegex.exec(code)) !== null) {
    const name = m[1];
    // Count occurrences across all files
    let count = 0;
    files.forEach(f2 => {
      const content = fs.readFileSync(f2, 'utf8');
      const re = new RegExp('\\b' + name + '\\b', 'g');
      const matches = content.match(re);
      if (matches) count += matches.length;
    });
    if (count <= 1) {
      const lines = code.split('\n');
      let lineNo = 1;
      for (let i = 0; i < lines.length; i++)
        if (lines[i].includes('function ' + name + '(')) {
          lineNo = i + 1;
          break;
        }
      const snippet = lines.slice(Math.max(0, lineNo - 3), Math.min(lines.length, lineNo + 2)).join('\n');
      declResults.push({name, file: f, line: lineNo, count, snippet});
    }
  }
});

console.warn(JSON.stringify(declResults, null, 2));
