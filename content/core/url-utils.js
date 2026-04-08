import { BASE_URL } from '../config/constants.js';

const HTTP_PROTOCOLS = new Set(['http:', 'https:']);

function getDefaultBaseUrl() {
  return globalThis.location?.origin || BASE_URL;
}

function normalizeHostname(hostname) {
  return String(hostname || '')
    .trim()
    .toLowerCase();
}

function getTrustedInternalHosts(
  currentHostname = globalThis.location?.hostname,
) {
  const hosts = new Set();
  const pushHost = (value) => {
    const normalized = normalizeHostname(value);
    if (!normalized) return;
    hosts.add(normalized);
    if (normalized.startsWith('www.')) {
      hosts.add(normalized.replace(/^www\./, ''));
      return;
    }
    hosts.add(`www.${normalized}`);
  };

  pushHost(currentHostname);

  try {
    pushHost(new URL(BASE_URL).hostname);
  } catch {
    /* ignore invalid base url */
  }

  return hosts;
}

/**
 * Parse a URL-like value against a predictable base.
 *
 * @param {string} rawUrl
 * @param {{ base?: string }} [options]
 * @returns {URL|null}
 */
function parseUrl(rawUrl, options = {}) {
  const value = String(rawUrl || '').trim();
  if (!value) return null;

  try {
    return new URL(value, options.base || getDefaultBaseUrl());
  } catch {
    return null;
  }
}

/**
 * Normalize an absolute or relative http(s) URL to an absolute string.
 *
 * @param {string} rawUrl
 * @param {{ base?: string }} [options]
 * @returns {string}
 */
export function normalizeHttpUrl(rawUrl, options = {}) {
  const parsed = parseUrl(rawUrl, options);
  if (!parsed || !HTTP_PROTOCOLS.has(parsed.protocol)) return '';
  return parsed.toString();
}

/**
 * Convert an internal URL to a safe relative navigation target.
 *
 * @param {string} rawUrl
 * @param {{
 *   base?: string,
 *   allowedHosts?: Iterable<string>,
 * }} [options]
 * @returns {string}
 */
export function sanitizeInternalNavigationUrl(rawUrl, options = {}) {
  const parsed = parseUrl(rawUrl, options);
  if (!parsed || !HTTP_PROTOCOLS.has(parsed.protocol)) return '';

  const allowedHosts = new Set(
    Array.from(
      options.allowedHosts ||
        getTrustedInternalHosts(globalThis.location?.hostname),
      (host) => normalizeHostname(host),
    ),
  );

  if (!allowedHosts.has(normalizeHostname(parsed.hostname))) {
    return '';
  }

  return `${parsed.pathname}${parsed.search}${parsed.hash}` || '/';
}

/**
 * Format a URL for compact UI display without dropping query parameters.
 *
 * @param {string} rawUrl
 * @param {{
 *   base?: string,
 *   maxPathLength?: number,
 *   fallbackMaxLength?: number,
 * }} [options]
 * @returns {string}
 */
export function formatCompactUrlPath(rawUrl, options = {}) {
  const fallback = String(rawUrl || '').trim();
  if (!fallback) return '';

  const parsed = parseUrl(fallback, options);
  if (!parsed) {
    const fallbackMaxLength = Number(options.fallbackMaxLength || 46);
    return fallback.length > fallbackMaxLength
      ? `${fallback.slice(0, fallbackMaxLength - 3)}...`
      : fallback;
  }

  const basePath = parsed.pathname || '/';
  const maxPathLength = Number(options.maxPathLength || 44);
  const compactPath =
    basePath.length > maxPathLength
      ? `${basePath.slice(0, maxPathLength - 3).replace(/\/+$/g, '')}...`
      : basePath;

  return `${compactPath}${parsed.search}`;
}
