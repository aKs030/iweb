/**
 * Edge HTML Cache — Cloudflare Cache API for transformed HTML responses
 *
 * Caches the fully-transformed HTML output (after HTMLRewriter) in
 * Cloudflare's Cache API. Subsequent requests for the same URL skip
 * the entire middleware pipeline (KV reads, HTMLRewriter, CSP nonce).
 *
 * Cache is automatically purged on deploy (Cloudflare Pages behavior).
 *
 * IMPORTANT: CSP nonce must be handled specially — cached responses
 * get a fresh nonce injected via a lightweight HTMLRewriter pass.
 *
 * @version 1.0.0
 */

// Cache TTL for HTML responses (edge-side, not browser-side)
const EDGE_HTML_TTL_S = 300; // 5 minutes
const EDGE_CACHE_KEY_VERSION = '20260407-1';
const CACHE_KEY_QUERY_ALLOWLIST = new Set(['menuShadow']);

/**
 * Pages that should NOT be cached (dynamic per-request content).
 */
const UNCACHEABLE_PATTERNS = ['/api/', '/contact'];
const UNCACHEABLE_EXACT_PATHS = new Set(['/']);

/**
 * Check if a URL path is cacheable.
 * @param {string} pathname
 * @returns {boolean}
 */
function isCacheablePath(pathname) {
  if (UNCACHEABLE_EXACT_PATHS.has(pathname)) return false;
  return !UNCACHEABLE_PATTERNS.some((p) => pathname.startsWith(p));
}

/**
 * Normalize the coarse language variant that affects edge-rendered HTML.
 * Only English currently changes markup (`<html lang="en">`).
 *
 * @param {string | null} acceptLanguage
 * @returns {string}
 */
function normalizeLanguageVariant(acceptLanguage) {
  return String(acceptLanguage || '')
    .trim()
    .toLowerCase()
    .startsWith('en')
    ? 'en'
    : 'default';
}

/**
 * Copy query params that influence the generated HTML into the cache key.
 *
 * @param {URL} sourceUrl
 * @param {URL} cacheUrl
 */
function copyCacheRelevantQueryParams(sourceUrl, cacheUrl) {
  for (const paramName of CACHE_KEY_QUERY_ALLOWLIST) {
    const values = sourceUrl.searchParams
      .getAll(paramName)
      .filter((value) => value !== '')
      .sort();

    for (const value of values) {
      cacheUrl.searchParams.append(paramName, value);
    }
  }
}

/**
 * Build a deterministic cache key from the request URL.
 * Keeps only HTML-relevant variants to avoid cache fragmentation while still
 * separating different edge-rendered outputs.
 *
 * @param {Request} request
 * @returns {Request} Cache key as Request object
 */
export function buildCacheKey(request) {
  const requestUrl = new URL(request.url);
  const cacheUrl = new URL(requestUrl.origin + requestUrl.pathname);

  copyCacheRelevantQueryParams(requestUrl, cacheUrl);
  cacheUrl.searchParams.set('__cv', EDGE_CACHE_KEY_VERSION);
  cacheUrl.searchParams.set(
    '__hl',
    normalizeLanguageVariant(request.headers.get('Accept-Language')),
  );

  return new Request(cacheUrl.href, { method: 'GET' });
}

/**
 * Try to serve from Cloudflare Cache API.
 *
 * @param {Request} request
 * @returns {Promise<Response|null>} Cached response or null
 */
export async function matchEdgeCache(request) {
  if (request.method !== 'GET') return null;

  const url = new URL(request.url);
  if (!isCacheablePath(url.pathname)) return null;

  try {
    const cache = caches.default;
    const key = buildCacheKey(request);
    const cached = await cache.match(key);

    if (cached) {
      if (cached.status !== 200 || cached.body === null) {
        return null;
      }

      // Add cache-hit indicator
      const headers = new Headers(cached.headers);
      headers.set('X-Edge-Cache', 'HIT');
      return new Response(cached.body, {
        status: cached.status,
        statusText: cached.statusText,
        headers,
      });
    }
  } catch {
    // Cache API unavailable (e.g. local dev) — continue to pipeline
  }

  return null;
}

/**
 * Store a transformed HTML response in the Cloudflare Cache API.
 * Called via `context.waitUntil()` to avoid blocking the response.
 *
 * The response is stored WITHOUT a CSP nonce — it gets injected
 * per-request in the cache-hit path if needed.
 *
 * @param {Request} request
 * @param {Response} response - The transformed response to cache
 * @param {any} ctx - For waitUntil
 */
export function storeInEdgeCache(request, response, ctx) {
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (!isCacheablePath(url.pathname)) return;
  if (response.status !== 200 || !response.body) return;

  try {
    const cache = caches.default;
    const key = buildCacheKey(request);

    // Clone and add cache-control for edge TTL
    const headers = new Headers(response.headers);
    headers.set('Cache-Control', `public, s-maxage=${EDGE_HTML_TTL_S}`);
    headers.set('X-Edge-Cache', 'MISS');

    const cacheableResponse = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });

    ctx.waitUntil(cache.put(key, cacheableResponse));
  } catch {
    // Silently ignore cache storage failures
  }
}
