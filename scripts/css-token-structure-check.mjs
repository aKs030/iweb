#!/usr/bin/env node
/**
 * Guards the global token layering contract:
 * - tokens.css owns generated design tokens and theme selector blocks
 * - variables.css owns compatibility aliases + responsive remapping
 * - root.css owns runtime-computed tokens only
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');

const TOKENS_FILE = path.join(ROOT_DIR, 'content/styles/tokens.css');
const BRIDGE_FILE = path.join(ROOT_DIR, 'content/styles/variables.css');
const RUNTIME_FILE = path.join(ROOT_DIR, 'content/styles/root.css');

/**
 * @param {string} css
 * @param {string} fileLabel
 * @returns {Set<string>}
 */
const extractPrimaryRootVariables = (css, fileLabel) => {
  // Strip @media blocks to only match truly top-level :root declarations.
  // Responsive overrides (e.g. --menu-height inside @media) are intentional
  // and must not be flagged as duplicates.
  const topLevel = css.replace(/@media\b[^{]*\{[\s\S]*?\n\}/g, '');
  const rootMatch = topLevel.match(/:root\s*\{([\s\S]*?)\}/);
  if (!rootMatch) return new Set();

  const block = rootMatch[1];
  const names = new Set();
  for (const tokenMatch of block.matchAll(/--[a-z0-9-]+(?=\s*:)/gi)) {
    names.add(tokenMatch[0]);
  }
  return names;
};

/**
 * @param {Set<string>} a
 * @param {Set<string>} b
 * @returns {string[]}
 */
const intersection = (a, b) => {
  const out = [];
  for (const token of a) {
    if (b.has(token)) out.push(token);
  }
  return out.sort();
};

const [tokensCss, bridgeCss, runtimeCss] = await Promise.all([
  readFile(TOKENS_FILE, 'utf8'),
  readFile(BRIDGE_FILE, 'utf8'),
  readFile(RUNTIME_FILE, 'utf8'),
]);

const tokensRootVars = extractPrimaryRootVariables(tokensCss, 'tokens.css');
const bridgeRootVars = extractPrimaryRootVariables(bridgeCss, 'variables.css');
const runtimeRootVars = extractPrimaryRootVariables(runtimeCss, 'root.css');

const bridgeOverlapsTokens = intersection(bridgeRootVars, tokensRootVars);
const runtimeOverlapsTokens = intersection(runtimeRootVars, tokensRootVars);
const runtimeOverlapsBridge = intersection(runtimeRootVars, bridgeRootVars);

const hasThemeSelectorInRuntime =
  /:root\s*\[data-theme\s*=|:root\[data-theme\s*=/.test(runtimeCss);

const problems = [];

if (bridgeOverlapsTokens.length) {
  problems.push({
    title: 'variables.css duplicates generated base tokens',
    tokens: bridgeOverlapsTokens,
  });
}

if (runtimeOverlapsTokens.length) {
  problems.push({
    title: 'root.css duplicates generated base tokens',
    tokens: runtimeOverlapsTokens,
  });
}

if (runtimeOverlapsBridge.length) {
  problems.push({
    title: 'root.css duplicates compatibility aliases from variables.css',
    tokens: runtimeOverlapsBridge,
  });
}

if (hasThemeSelectorInRuntime) {
  problems.push({
    title:
      'root.css contains theme selector blocks; keep theme selectors in tokens.css only',
    tokens: [],
  });
}

if (problems.length) {
  console.error('css:tokens:check failed');
  for (const problem of problems) {
    console.error(`- ${problem.title}`);
    for (const token of problem.tokens) {
      console.error(`  - ${token}`);
    }
  }
  process.exit(1);
}

console.log('css:tokens:check passed');
