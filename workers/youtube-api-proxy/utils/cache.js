/**
 * Cache Utilities for YouTube API Proxy
 * Handles Cloudflare Cache API operations
 */

/**
 * Gets cached response
 * @param {Request} request - Cache key request
 * @returns {Promise<Response|null>} Cached response or null
 */
export async function getCachedResponse(request) {
  const cache = caches.default;
  const response = await cache.match(request);

  if (response) {
    const headers = new Headers(response.headers);
    headers.set('X-Cache', 'HIT');
    headers.set('X-Cache-Date', response.headers.get('Date') || 'unknown');

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  return null;
}

/**
 * Stores response in cache
 * @param {Request} request - Cache key request
 * @param {Response} response - Response to cache
 * @param {number} ttl - Cache TTL in seconds
 */
export async function cacheResponse(request, response, ttl = 3600) {
  const cache = caches.default;
  const headers = new Headers(response.headers);

  headers.set('Cache-Control', `public, max-age=${ttl}`);
  headers.set('X-Cache', 'MISS');
  headers.set('X-Cache-Date', new Date().toUTCString());

  const cachedResponse = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });

  await cache.put(request, cachedResponse.clone());
  return cachedResponse;
}
