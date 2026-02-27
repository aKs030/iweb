#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';
import autoprefixer from 'autoprefixer';
import cssnano from 'cssnano';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const OUTPUT_ROOT = path.join(ROOT_DIR, 'content/styles/minified');

const SCAN_DIRS = ['content/styles', 'content/components', 'pages'];

async function walkCssFiles(dir, results = []) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (full.startsWith(OUTPUT_ROOT)) continue;
      await walkCssFiles(full, results);
      continue;
    }
    if (entry.isFile() && full.endsWith('.css')) results.push(full);
  }
  return results;
}

function toOutPath(inputPath) {
  const rel = path.relative(ROOT_DIR, inputPath);
  const outRel = rel.replace(/\.css$/i, '.min.css');
  return path.join(OUTPUT_ROOT, outRel);
}

async function minifyFile(inputPath) {
  const source = await fs.readFile(inputPath, 'utf8');
  const outputPath = toOutPath(inputPath);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  const result = await postcss([
    autoprefixer(),
    cssnano({ preset: 'default' }),
  ]).process(source, {
    from: inputPath,
    to: outputPath,
  });

  await fs.writeFile(outputPath, result.css, 'utf8');

  const relIn = path.relative(ROOT_DIR, inputPath);
  const relOut = path.relative(ROOT_DIR, outputPath);
  console.log(`minified ${relIn} -> ${relOut}`);
}

async function main() {
  const files = [];

  for (const relDir of SCAN_DIRS) {
    const absDir = path.join(ROOT_DIR, relDir);
    try {
      await fs.access(absDir);
      await walkCssFiles(absDir, files);
    } catch {
      // optional directory missing
    }
  }

  await Promise.all(files.map((file) => minifyFile(file)));
  console.log(`done (${files.length} files)`);
}

await main();
