/**
 * @param {string} name
 * @param {string[]} [argv]
 * @returns {string}
 */
export function getFlagValue(name, argv = process.argv.slice(2)) {
  const exactIndex = argv.findIndex((arg) => arg === name);
  if (exactIndex !== -1) {
    const next = argv[exactIndex + 1];
    if (next && !next.startsWith('--')) return next;
  }

  const prefix = `${name}=`;
  const arg = argv.find((entry) => entry.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : '';
}

/**
 * @param {string} name
 * @param {string[]} [argv]
 */
export function isFlagEnabled(name, argv = process.argv.slice(2)) {
  return argv.includes(name);
}

/**
 * @param {any} value
 * @param {number} fallback
 * @param {{ min?: number, max?: number }} [options]
 */
export function parseInteger(
  value,
  fallback,
  { min = 0, max = Number.MAX_SAFE_INTEGER } = {},
) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

/**
 * @param {number} ms
 */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * @param {string[]} envKeys
 */
function getEnvValue(envKeys) {
  for (const key of envKeys) {
    const value = String(process.env[key] || '').trim();
    if (value) return value;
  }

  return '';
}

/**
 * @param {{ argv?: string[], flagName?: string, envKeys?: string[], defaultValue?: string }} [options]
 */
export function resolveUrlValue({
  argv = process.argv.slice(2),
  flagName = '--url',
  envKeys = [],
  defaultValue = '',
} = {}) {
  const value =
    getFlagValue(flagName, argv) || getEnvValue(envKeys) || defaultValue;

  return String(value || '').trim();
}

/**
 * @param {{ argv?: string[], flagName?: string, envKeys?: string[], defaultValue?: string }} [options]
 */
export function resolveUrl(options = {}) {
  return new URL(resolveUrlValue(options));
}

/**
 * @param {string | URL} url
 * @param {RequestInit} [options]
 */
export async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => null);
  return {
    response,
    payload,
  };
}

/**
 * @param {string | URL} url
 * @param {{ timeoutMs?: number }} [options]
 */
export async function isReachable(url, { timeoutMs = 3000 } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
    });
    return response.status > 0;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
