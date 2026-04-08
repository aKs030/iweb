import fs from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_ENV_FILES = ['.dev.vars', '.env.local', '.env'];
const ENV_ASSIGNMENT_PATTERN =
  /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/;

/**
 * @param {string | null | undefined} rawValue
 */
function normalizeEnvValue(rawValue) {
  const trimmed = String(rawValue || '').trim();
  if (!trimmed) return '';

  const quote = trimmed[0];
  if (
    (quote === '"' || quote === "'") &&
    trimmed.endsWith(quote) &&
    trimmed.length >= 2
  ) {
    const inner = trimmed.slice(1, -1);
    if (quote === '"') {
      return inner
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\"/g, '"');
    }
    return inner.replace(/\\'/g, "'");
  }

  return trimmed.replace(/\s+#.*$/, '').trim();
}

/**
 * @param {string | null | undefined} source
 * @returns {Array<{ key: string, value: string }>}
 */
function parseEnvSource(source) {
  /** @type {Array<{ key: string, value: string }>} */
  const entries = [];
  String(source || '')
    .split(/\r?\n/)
    .forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;

      const match = line.match(ENV_ASSIGNMENT_PATTERN);
      if (!match) return;

      entries.push({
        key: match[1],
        value: normalizeEnvValue(match[2]),
      });
    });

  return entries;
}

/**
 * @param {{ cwd?: string, files?: string[], override?: boolean }} [options]
 */
export async function loadLocalEnv(options = {}) {
  const cwd = path.resolve(options.cwd || process.cwd());
  const files = Array.isArray(options.files)
    ? options.files
    : DEFAULT_ENV_FILES;
  const override = options.override === true;
  const loadedFiles = [];
  /** @type {string[]} */
  const loadedKeys = [];

  for (const relativeFile of files) {
    const absoluteFile = path.join(cwd, relativeFile);

    let entries;
    try {
      const source = await fs.readFile(absoluteFile, 'utf8');
      entries = parseEnvSource(source);
    } catch (error) {
      if (error && /** @type {any} */ (error).code === 'ENOENT') continue;
      throw error;
    }

    let fileLoaded = false;

    entries.forEach(({ key, value }) => {
      if (!override && process.env[key] !== undefined) return;
      process.env[key] = value;
      loadedKeys.push(key);
      fileLoaded = true;
    });

    if (fileLoaded) {
      loadedFiles.push(relativeFile);
    }
  }

  return {
    cwd,
    loadedFiles,
    loadedKeys,
  };
}
