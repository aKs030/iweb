#!/usr/bin/env node
/**
 * Repository structure sanity checks.
 * Keeps source, generated, and docs layout explicit.
 */
import { access, constants } from 'node:fs/promises';

/**
 * @param {string} relPath
 * @returns {Promise<boolean>}
 */
const exists = async (relPath) => {
  try {
    await access(relPath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
};

const REQUIRED_PATHS = [
  'content',
  'pages',
  'functions',
  'scripts',
  'docs',
  'content/styles',
  'content/styles/tokens',
  'content/components',
  'content/core',
  'styleguide/index.html',
];

const GENERATED_FILES = [
  'content/styles/tokens.css',
  'content/styles/utilities.generated.css',
];

const TEMP_ARTIFACTS = ['.playwright-cli'];

const missingRequired = [];
const missingGenerated = [];
const foundTempArtifacts = [];

for (const relPath of REQUIRED_PATHS) {
  if (!(await exists(relPath))) missingRequired.push(relPath);
}

for (const relPath of GENERATED_FILES) {
  if (!(await exists(relPath))) missingGenerated.push(relPath);
}

for (const relPath of TEMP_ARTIFACTS) {
  if (await exists(relPath)) foundTempArtifacts.push(relPath);
}

if (missingRequired.length) {
  console.error('structure:check failed');
  console.error('Missing required paths:');
  for (const path of missingRequired) console.error(`- ${path}`);
  process.exit(1);
}

if (missingGenerated.length) {
  console.warn('structure:check warning');
  console.warn('Generated CSS is missing (run token/utilities generators):');
  for (const path of missingGenerated) console.warn(`- ${path}`);
}

if (foundTempArtifacts.length) {
  console.warn('structure:check warning');
  console.warn('Temporary artifacts detected:');
  for (const path of foundTempArtifacts) console.warn(`- ${path}`);
}

console.log('structure:check passed');
process.exit(0);
