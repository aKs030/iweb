#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const TOKENS_DIR = path.join(ROOT_DIR, 'content/styles/tokens');

const TARGETS = [
  {
    input: path.join(TOKENS_DIR, 'tokens.json'),
    mergeInput: path.join(TOKENS_DIR, 'tokens-dark.json'),
    output: path.join(ROOT_DIR, 'content/styles/tokens.css'),
  },
  {
    input: path.join(TOKENS_DIR, 'tokens-dark.json'),
    output: path.join(ROOT_DIR, 'content/styles/tokens-dark.css'),
  },
];

const args = new Set(process.argv.slice(2));
const shouldWatch = args.has('--watch');
const shouldGenerateAll = args.has('--all');
const onlyDark = args.has('--dark');

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
    };
  });
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

async function buildTarget(target) {
  const rawBase = await fs.readFile(target.input, 'utf8');
  const jsonBase = JSON.parse(rawBase);
  const baseBlocks = normalizeBlocks(jsonBase, target.input);

  const mergedBlocks = [...baseBlocks];
  const relSources = [path.relative(ROOT_DIR, target.input)];

  if (target.mergeInput) {
    const rawMerge = await fs.readFile(target.mergeInput, 'utf8');
    const jsonMerge = JSON.parse(rawMerge);
    const mergeBlocks = normalizeBlocks(jsonMerge, target.mergeInput);
    mergedBlocks.push(...mergeBlocks);
    relSources.push(path.relative(ROOT_DIR, target.mergeInput));
  }

  const css = renderCss(
    relSources.join(' + '),
    mergedBlocks,
    path.relative(ROOT_DIR, target.input),
  );

  await fs.mkdir(path.dirname(target.output), { recursive: true });
  await fs.writeFile(target.output, css, 'utf8');

  const relOut = path.relative(ROOT_DIR, target.output);
  return relOut;
}

function selectTargets() {
  if (onlyDark)
    return TARGETS.filter((target) =>
      target.input.endsWith('tokens-dark.json'),
    );
  if (shouldGenerateAll) return TARGETS;
  return TARGETS.filter((target) => target.input.endsWith('tokens.json'));
}

async function generateAll() {
  const targets = selectTargets();
  const outputs = await Promise.all(
    targets.map((target) => buildTarget(target)),
  );
  outputs.forEach((out) => {
    console.log(`generated ${out}`);
  });
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
  await generateAll();
  console.log('watching tokens/*.json ...');

  const rerun = debounce(async () => {
    try {
      await generateAll();
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
  await generateAll();
}
