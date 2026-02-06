/**
 * YouTube API Handler
 * Proxies YouTube Data API v3 with Cloudflare Cache API
 */

import { jsonResponse, errorResponse } from '../../shared/response-utils.js';

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';
const ALLOWED_ENDPOINTS = new Set(['search', 'videos', 'channels', 'playlists', 'playlistItems']);

/**
 * @param {Request} request
 * @param {Object} env
 */
export async function youtubeHandler(request, env) {
  if (request.method !== 'GET') {
    return errorResponse('Method not allowed', 'Only GET requests are supported', 405, request);
  }

  const apiKey = env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return errorResponse('Configuration error', 'YOUTUBE_API_KEY not configured', 500, request);
  }

  // Extract & validate endpoint
  const url = new URL(request.url);
  const match = url.pathname.match(/^\/api\/youtube\/(.+)$/);
  if (!match) {
    return errorResponse('Invalid endpoint', 'Path must be /api/youtube/{endpoint}', 400, request);
  }

  const endpoint = match[1].split('/')[0];
  if (!ALLOWED_ENDPOINTS.has(endpoint)) {
    return errorResponse('Forbidden endpoint', `Allowed: ${[...ALLOWED_ENDPOINTS].join(', ')}`, 403, request);
  }

  // Build YouTube API URL
  const youtubeUrl = new URL(`${YOUTUBE_API_BASE}/${match[1]}`);
  url.searchParams.forEach((v, k) => youtubeUrl.searchParams.set(k, v));
  youtubeUrl.searchParams.set('key', apiKey);

  // Cloudflare Cache API
  const cache = caches.default;
  const cacheKey = new Request(youtubeUrl.toString());
  const cached = await cache.match(cacheKey);

  if (cached) {
    const headers = new Headers(cached.headers);
    headers.set('X-Cache', 'HIT');
    return new Response(cached.body, { status: cached.status, headers });
  }

  // Fetch from YouTube
  try {
    const res = await fetch(youtubeUrl.toString());

    if (!res.ok) {
      const text = await res.text();
      return errorResponse('YouTube API error', `${res.status}: ${text}`, res.status, request);
    }

    const ttl = parseInt(env.CACHE_TTL || '3600', 10);
    const headers = new Headers(res.headers);
    headers.set('Cache-Control', `public, max-age=${ttl}`);
    headers.set('X-Cache', 'MISS');

    const response = new Response(res.body, { status: res.status, headers });
    await cache.put(cacheKey, response.clone());
    return response;
  } catch (error) {
    if (env.ENVIRONMENT === 'development') console.error('YouTube fetch error:', error);
    return errorResponse('Proxy error', error.message, 502, request);
  }
}
