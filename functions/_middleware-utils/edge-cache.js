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
const EDGE_CACHE_KEY_VERSION = '20260307-1';

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
 * Build a deterministic cache key from the request URL.
 * Strips query params to avoid cache fragmentation.
 *
 * @param {URL} url
 * @returns {Request} Cache key as Request object
 */
export function buildCacheKey(url) {
  const cacheUrl = new URL(url.href);
  cacheUrl.search = '';
  cacheUrl.searchParams.set('__cv', EDGE_CACHE_KEY_VERSION);

  return new Request(cacheUrl.href, { method: 'GET' });
}

/**
 * Try to serve from Cloudflare Cache API.
 *
 * @param {URL} url
 * @returns {Promise<Response|null>} Cached response or null
 */
export async function matchEdgeCache(url) {
  if (!isCacheablePath(url.pathname)) return null;

  try {
    const cache = caches.default;
    const key = buildCacheKey(url);
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
 * @param {URL} url
 * @param {Response} response - The transformed response to cache
 * @param {ExecutionContext} ctx - For waitUntil
 */
export function storeInEdgeCache(url, response, ctx) {
  if (!isCacheablePath(url.pathname)) return;
  if (response.status !== 200 || !response.body) return;

  try {
    const cache = caches.default;
    const key = buildCacheKey(url);

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
