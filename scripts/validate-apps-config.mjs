import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { GITHUB_CONFIG } from '../pages/projekte/config/github.config.js';
import { PROJECT_CATEGORIES } from '../pages/projekte/config/project-categories.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const APPS_CONFIG_PATH = path.join(ROOT_DIR, 'pages/projekte/apps-config.json');

const VALID_CATEGORIES = new Set(
  Object.keys(PROJECT_CATEGORIES).filter((key) => key !== 'default'),
);

const PREVIEW_IMAGE_EXTENSIONS = new Set([
  '.svg',
  '.webp',
  '.png',
  '.jpg',
  '.jpeg',
]);

/**
 * @param {unknown} value
 */
function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * @param {unknown} value
 */
function isStringArray(value) {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((entry) => isNonEmptyString(entry))
  );
}

/**
 * @param {string} value
 */
function isIsoDateTime(value) {
  if (!isNonEmptyString(value)) return false;
  return !Number.isNaN(Date.parse(value));
}

/**
 * @param {string} value
 */
function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * @param {string} appName
 * @param {unknown} value
 */
function validatePreviewUrl(appName, value) {
  if (!isNonEmptyString(value)) return false;

  try {
    const url = new URL(value);
    const extension = path.posix.extname(url.pathname).toLowerCase();
    return (
      url.origin === 'https://img.abdulkerimsesli.de' &&
      PREVIEW_IMAGE_EXTENSIONS.has(extension) &&
      new RegExp(`^/app/${escapeRegex(appName)}\\.[a-z0-9]+$`, 'i').test(
        url.pathname,
      ) &&
      isNonEmptyString(url.searchParams.get('v'))
    );
  } catch {
    return false;
  }
}

/**
 * @param {string} name
 * @param {unknown} value
 * @param {string[]} errors
 * @param {string} label
 */
function validateRequiredString(name, value, errors, label) {
  if (!isNonEmptyString(value)) {
    errors.push(`${label} must be a non-empty string`);
  }
}

/**
 * @param {string} appName
 * @param {Record<string, unknown>} app
 * @param {string[]} errors
 */
function validateCaseStudy(appName, app, errors) {
  if (!('caseStudy' in app) || app.caseStudy == null) return;

  const caseStudy = /** @type {Record<string, unknown>} */ (app.caseStudy);
  const fields = ['problem', 'solution', 'results'];

  fields.forEach((field) => {
    if (!isNonEmptyString(caseStudy[field])) {
      errors.push(`${appName}.caseStudy.${field} must be a non-empty string`);
    }
  });

  if (!isStringArray(caseStudy.techStack)) {
    errors.push(
      `${appName}.caseStudy.techStack must be a non-empty string array`,
    );
  }
}

/**
 * @param {Record<string, unknown>} config
 */
function validateAppsConfig(config) {
  /** @type {string[]} */
  const errors = [];

  if (!Array.isArray(config.apps) || config.apps.length === 0) {
    errors.push('apps must be a non-empty array');
    return errors;
  }

  if (!isIsoDateTime(/** @type {unknown} */ (config.lastUpdated))) {
    errors.push('lastUpdated must be a valid ISO date string');
  }

  if (config.source !== 'canonical-apps-config') {
    errors.push('source must equal "canonical-apps-config"');
  }

  const seenNames = new Set();
  const seenAppPaths = new Set();
  const seenGitHubPaths = new Set();

  config.apps.forEach((rawApp, index) => {
    const label = `apps[${index}]`;
    const app = /** @type {Record<string, unknown>} */ (rawApp || {});
    const appName = String(app.name || '').trim();

    validateRequiredString(appName, app.name, errors, `${label}.name`);
    validateRequiredString(appName, app.title, errors, `${label}.title`);
    validateRequiredString(
      appName,
      app.description,
      errors,
      `${label}.description`,
    );
    validateRequiredString(appName, app.version, errors, `${label}.version`);
    validateRequiredString(appName, app.category, errors, `${label}.category`);
    validateRequiredString(appName, app.appPath, errors, `${label}.appPath`);
    validateRequiredString(
      appName,
      app.githubPath,
      errors,
      `${label}.githubPath`,
    );

    if (!isStringArray(app.tags)) {
      errors.push(`${label}.tags must be a non-empty string array`);
    }

    if (!/^[a-z0-9-]+$/.test(appName)) {
      errors.push(`${label}.name must match /^[a-z0-9-]+$/`);
    }

    if (seenNames.has(appName)) {
      errors.push(`${label}.name duplicates "${appName}"`);
    } else {
      seenNames.add(appName);
    }

    const category = String(app.category || '').trim();
    if (category && !VALID_CATEGORIES.has(category)) {
      errors.push(
        `${label}.category must be one of: ${[...VALID_CATEGORIES].join(', ')}`,
      );
    }

    const expectedAppPath = `/api/project-apps/${appName}/index.html`;
    if (app.appPath !== expectedAppPath) {
      errors.push(`${label}.appPath must equal "${expectedAppPath}"`);
    }

    const appPath = String(app.appPath || '');
    if (seenAppPaths.has(appPath)) {
      errors.push(`${label}.appPath duplicates "${appPath}"`);
    } else if (appPath) {
      seenAppPaths.add(appPath);
    }

    const expectedGitHubPath = `${GITHUB_CONFIG.repoBase}/${GITHUB_CONFIG.appsPath}/${appName}`;
    if (app.githubPath !== expectedGitHubPath) {
      errors.push(`${label}.githubPath must equal "${expectedGitHubPath}"`);
    }

    const githubPath = String(app.githubPath || '');
    if (seenGitHubPaths.has(githubPath)) {
      errors.push(`${label}.githubPath duplicates "${githubPath}"`);
    } else if (githubPath) {
      seenGitHubPaths.add(githubPath);
    }

    const previewMediaDisabled =
      app.previewMedia === null || app.previewMedia === false;
    const hasPreviewUrl = 'previewUrl' in app;
    const hasPreviewAlt = 'previewAlt' in app;

    if (previewMediaDisabled) {
      if (hasPreviewUrl || hasPreviewAlt) {
        errors.push(
          `${label} must not define previewUrl/previewAlt when previewMedia is null or false`,
        );
      }
    } else {
      if (!validatePreviewUrl(appName, app.previewUrl)) {
        errors.push(
          `${label}.previewUrl must point to https://img.abdulkerimsesli.de/app/${appName}.*?v=...`,
        );
      }
      if (!isNonEmptyString(app.previewAlt)) {
        errors.push(`${label}.previewAlt must be a non-empty string`);
      }
    }

    validateCaseStudy(label, app, errors);
  });

  return errors;
}

async function main() {
  const source = await fs.readFile(APPS_CONFIG_PATH, 'utf8');
  const config = JSON.parse(source);
  const errors = validateAppsConfig(config);

  if (errors.length > 0) {
    console.error('apps-config validation failed:\n');
    errors.forEach((error) => console.error(`- ${error}`));
    process.exitCode = 1;
    return;
  }

  console.log(
    `apps-config validation passed (${config.apps.length} apps checked)`,
  );
}

await main();
