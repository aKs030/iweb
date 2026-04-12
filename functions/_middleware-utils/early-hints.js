/**
 * Link-Header Preload Utilities
 *
 * Sends critical CSS, JS, and preconnect hints as HTTP Link headers
 * so the browser can start fetching resources while still receiving
 * the HTML response body — improving FCP by eliminating idle time.
 *
 * @version 1.0.0
 */

import { R2_PUBLIC_ORIGIN } from '../../content/config/media-urls.js';

// ---------------------------------------------------------------------------
// Critical resources to signal via Link headers
// ---------------------------------------------------------------------------

/**
 * Resources the browser should start fetching immediately on header receipt.
 * Order matters — CSS first (render-blocking), then modulepreload (parser hint).
 */
const CRITICAL_RESOURCES = [
  // Critical CSS — foundation.css is already streamed inline by middleware
  { href: '/content/styles/main.css', rel: 'preload', as: 'style' },
  { href: '/content/styles/animations.css', rel: 'preload', as: 'style' },

  // Critical JS modules — start parsing before HTML fully loaded
  { href: '/content/main.js', rel: 'modulepreload' },
  { href: '/content/components/head/head-inline.js', rel: 'modulepreload' },
  { href: '/content/components/menu/index.js', rel: 'modulepreload' },

  // Third-party preconnect — start DNS + TLS handshake early
  { href: 'https://cdn.jsdelivr.net', rel: 'preconnect', crossorigin: true },
  { href: 'https://esm.sh', rel: 'preconnect', crossorigin: true },
  {
    href: R2_PUBLIC_ORIGIN,
    rel: 'preconnect',
    crossorigin: true,
  },
];

const STANDALONE_SHELL_EXCLUSIONS = new Set([
  '/content/styles/main.css',
  '/content/styles/animations.css',
  '/content/main.js',
  '/content/components/head/head-inline.js',
  '/content/components/menu/index.js',
]);

function normalizePathname(pathname = '/') {
  if (!pathname) return '/';
  return pathname.endsWith('/') && pathname !== '/'
    ? pathname.slice(0, -1)
    : pathname;
}

function isStandaloneShellPath(pathname = '/') {
  const normalized = normalizePathname(pathname);
  return (
    normalized === '/ai-info' ||
    normalized.startsWith('/pages/ai-info')
  );
}

function getCriticalResourcesForPath(pathname = '/') {
  if (!isStandaloneShellPath(pathname)) {
    return CRITICAL_RESOURCES;
  }

  return CRITICAL_RESOURCES.filter(
    ({ href }) => !STANDALONE_SHELL_EXCLUSIONS.has(href),
  );
}

/**
 * Format a single resource entry as an HTTP Link header value.
 * @param {{ href: string, rel: string, as?: string, crossorigin?: boolean }} r
 * @returns {string}
 */
function formatLinkValue(r) {
  let link = `<${r.href}>; rel=${r.rel}`;
  if (r.as) link += `; as=${r.as}`;
  if (r.crossorigin) link += '; crossorigin';
  return link;
}

/**
 * Build individual Link header values for the HTML response.
 * Each entry is appended separately via `headers.append('Link', ...)`.
 *
 * @returns {string[]} Array of formatted Link header values
 */
export function buildResponseLinkHeaders(pathname = '/') {
  return getCriticalResourcesForPath(pathname).map(formatLinkValue);
}
