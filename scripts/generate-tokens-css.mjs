#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const TOKENS_DIR = path.join(ROOT_DIR, 'content/styles/tokens');
const INPUTS = [
  path.join(TOKENS_DIR, 'tokens.json'),
  path.join(TOKENS_DIR, 'tokens-dark.json'),
];
const OUTPUT = path.join(ROOT_DIR, 'content/styles/tokens.css');

const args = new Set(process.argv.slice(2));
const shouldWatch = args.has('--watch');
const unsupportedArgs = [...args].filter((arg) => arg !== '--watch');
if (unsupportedArgs.length) {
  throw new Error(
    `Unsupported argument(s): ${unsupportedArgs.join(', ')}. Use only "--watch".`,
  );
}

function toCssValue(value) {
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
}

function normalizeBlocks(json, inputPath) {
  const blocks = Array.isArray(json?.blocks) ? json.blocks : [];
  if (blocks.length === 0) {
    throw new Error(`No "blocks" found in ${path.basename(inputPath)}`);
  }

  return blocks.map((block, index) => {
    const selector = String(block?.selector || '').trim();
    const tokens = block?.tokens;

    if (!selector) {
      throw new Error(
        `Missing selector for block #${index + 1} in ${path.basename(inputPath)}`,
      );
    }

    if (!tokens || typeof tokens !== 'object' || Array.isArray(tokens)) {
      throw new Error(
        `Invalid tokens object for block #${index + 1} in ${path.basename(inputPath)}`,
      );
    }

    const entries = Object.entries(tokens);
    if (entries.length === 0) {
      throw new Error(
        `Empty tokens in block #${index + 1} of ${path.basename(inputPath)}`,
      );
    }

    return {
      selector,
      entries,
      inputPath,
    };
  });
}

function mergeBlocksBySelector(blocks) {
  const merged = new Map();

  for (const block of blocks) {
    const relInput = path.relative(ROOT_DIR, block.inputPath);
    if (!merged.has(block.selector)) {
      merged.set(block.selector, {
        selector: block.selector,
        entries: [],
        seenNames: new Map(),
      });
    }

    const mergedBlock = merged.get(block.selector);
    for (const [name, value] of block.entries) {
      if (mergedBlock.seenNames.has(name)) {
        const previousSource = mergedBlock.seenNames.get(name);
        throw new Error(
          `Duplicate token "${name}" in selector "${block.selector}" across ${previousSource} and ${relInput}`,
        );
      }
      mergedBlock.seenNames.set(name, relInput);
      mergedBlock.entries.push([name, value]);
    }
  }

  return [...merged.values()].map(({ selector, entries }) => ({
    selector,
    entries,
  }));
}

function renderCss(sourceLabel, blocks, relPathForErrors) {
  const relInput = String(sourceLabel || relPathForErrors);

  const lines = [
    `/* Auto-generated from ${relInput}. Do not edit directly. */`,
    '',
  ];

  for (const block of blocks) {
    lines.push(`${block.selector} {`);
    for (const [name, rawValue] of block.entries) {
      if (!name.startsWith('--')) {
        throw new Error(
          `Token name "${name}" must start with -- in ${relPathForErrors}`,
        );
      }
      lines.push(`  ${name}: ${toCssValue(rawValue)};`);
    }
    lines.push('}');
    lines.push('');
  }

  return `${lines.join('\n').trimEnd()}\n`;
}

async function generateCss() {
  const allBlocks = [];
  const relSources = [];

  for (const input of INPUTS) {
    const raw = await fs.readFile(input, 'utf8');
    const json = JSON.parse(raw);
    const blocks = normalizeBlocks(json, input);
    allBlocks.push(...blocks);
    relSources.push(path.relative(ROOT_DIR, input));
  }

  const mergedBlocks = mergeBlocksBySelector(allBlocks);
  const css = renderCss(relSources.join(' + '), mergedBlocks, relSources[0]);

  await fs.mkdir(path.dirname(OUTPUT), { recursive: true });
  await fs.writeFile(OUTPUT, css, 'utf8');
  console.log(`generated ${path.relative(ROOT_DIR, OUTPUT)}`);
}

function debounce(fn, ms = 120) {
  let timer = null;
  return () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void fn();
    }, ms);
  };
}

if (shouldWatch) {
  await generateCss();
  console.log('watching tokens/*.json ...');

  const rerun = debounce(async () => {
    try {
      await generateCss();
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
    }
  });

  const watcher = fs.watch(TOKENS_DIR, { persistent: true });
  for await (const event of watcher) {
    if (!event?.filename || !String(event.filename).endsWith('.json')) continue;
    rerun();
  }
} else {
  await generateCss();
}
