#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PurgeCSS } from 'purgecss';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const OUT_FILE = path.join(
  ROOT_DIR,
  'content/styles/minified/utilities.purged.css',
);

const cssGlobs = [
  'content/styles/**/*.css',
  'content/components/**/*.css',
  'pages/**/*.css',
];

const contentGlobs = [
  'pages/**/*.html',
  'content/**/*.js',
  'content/**/*.mjs',
  'content/components/**/*.js',
];

const purge = new PurgeCSS();
const results = await purge.purge({
  css: cssGlobs,
  content: contentGlobs,
  rejected: true,
});

const banner =
  '/* PurgeCSS audit output. Generated via npm run css:audit. */\n\n';

const combined =
  banner +
  results
    .map((entry) => {
      const header = `/* Source: ${entry.file || 'inline'} */`;
      return `${header}\n${entry.css}\n`;
    })
    .join('\n');

await fs.mkdir(path.dirname(OUT_FILE), { recursive: true });
await fs.writeFile(OUT_FILE, combined, 'utf8');

console.log(`wrote ${path.relative(ROOT_DIR, OUT_FILE)}`);
