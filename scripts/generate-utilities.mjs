#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const OUT_FILE = path.join(ROOT_DIR, 'content/styles/utilities.generated.css');

const scale = [
  ['0', '--space-0'],
  ['1', '--space-1'],
  ['2', '--space-2'],
  ['3', '--space-3'],
  ['4', '--space-4'],
  ['5', '--space-5'],
  ['6', '--space-6'],
  ['8', '--space-8'],
  ['10', '--space-10'],
  ['12', '--space-12'],
  ['16', '--space-16'],
];

const spacingRules = [
  ['m', 'margin'],
  ['mt', 'margin-top'],
  ['mr', 'margin-right'],
  ['mb', 'margin-bottom'],
  ['ml', 'margin-left'],
  ['mx', ['margin-left', 'margin-right']],
  ['my', ['margin-top', 'margin-bottom']],
  ['p', 'padding'],
  ['pt', 'padding-top'],
  ['pr', 'padding-right'],
  ['pb', 'padding-bottom'],
  ['pl', 'padding-left'],
  ['px', ['padding-left', 'padding-right']],
  ['py', ['padding-top', 'padding-bottom']],
  ['gap', 'gap'],
];

const utilityLines = [
  '/* Auto-generated utility classes. Do not edit directly. */',
  '',
  '.pointer-events-none {',
  '  pointer-events: none;',
  '}',
  '',
  '.pointer-events-auto {',
  '  pointer-events: auto;',
  '}',
  '',
  '.grid-cols-2 {',
  '  grid-template-columns: repeat(2, minmax(0, 1fr));',
  '}',
  '',
];

for (const [prefix, prop] of spacingRules) {
  for (const [name, token] of scale) {
    utilityLines.push(`.${prefix}-${name} {`);
    if (Array.isArray(prop)) {
      prop.forEach((key) => utilityLines.push(`  ${key}: var(${token});`));
    } else {
      utilityLines.push(`  ${prop}: var(${token});`);
    }
    utilityLines.push('}');
    utilityLines.push('');
  }
}

await fs.mkdir(path.dirname(OUT_FILE), { recursive: true });
await fs.writeFile(OUT_FILE, `${utilityLines.join('\n').trimEnd()}\n`, 'utf8');

console.log(`generated ${path.relative(ROOT_DIR, OUT_FILE)}`);
