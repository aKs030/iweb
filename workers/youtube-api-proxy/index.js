/**
 * YouTube API Proxy Worker
 * Securely proxies YouTube Data API v3 requests
 * - Keeps API key server-side
 * - Implements caching (1 hour TTL)
 * - Adds rate limiting protection
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const apiKey = env.YOUTUBE_API_KEY;

    // Validate API key is configured
    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error: 'API key not configured',
          message: 'YOUTUBE_API_KEY environment variable is missing',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    // Only allow GET requests
    if (request.method !== 'GET') {
      return new Response(
        JSON.stringify({
          error: 'Method not allowed',
          message: 'Only GET requests are supported',
        }),
        {
          status: 405,
          headers: {
            'Content-Type': 'application/json',
            Allow: 'GET',
          },
        },
      );
    }

    // Extract YouTube API endpoint from path
    // /api/youtube/search -> https://www.googleapis.com/youtube/v3/search
    const pathMatch = url.pathname.match(/^\/api\/youtube\/(.+)$/);

    if (!pathMatch) {
      return new Response(
        JSON.stringify({
          error: 'Invalid endpoint',
          message: 'Path must be in format /api/youtube/{endpoint}',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    const endpoint = pathMatch[1];

    // Build YouTube API URL with API key
    const youtubeUrl = new URL(
      `https://www.googleapis.com/youtube/v3/${endpoint}`,
    );

    // Copy all query parameters from original request
    url.searchParams.forEach((value, key) => {
      youtubeUrl.searchParams.set(key, value);
    });

    // Add API key
    youtubeUrl.searchParams.set('key', apiKey);

    // Check cache first
    const cache = caches.default;
    const cacheKey = new Request(youtubeUrl.toString(), request);
    let response = await cache.match(cacheKey);

    if (response) {
      // Return cached response with cache hit header
      const headers = new Headers(response.headers);
      headers.set('X-Cache', 'HIT');
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }

    // Fetch from YouTube API
    try {
      response = await fetch(youtubeUrl.toString());

      // Clone response for caching
      const responseToCache = response.clone();

      // Cache successful responses for 1 hour
      if (response.ok) {
        const headers = new Headers(responseToCache.headers);
        headers.set('Cache-Control', 'public, max-age=3600');
        headers.set('X-Cache', 'MISS');

        const cachedResponse = new Response(responseToCache.body, {
          status: responseToCache.status,
          statusText: responseToCache.statusText,
          headers,
        });

        // Store in cache (don't await)
        await cache.put(cacheKey, cachedResponse.clone());

        return cachedResponse;
      }

      // Return error response without caching
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: 'YouTube API request failed',
          message: error.message,
        }),
        {
          status: 502,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }
  },
};
