/**
 * YouTube API Proxy Worker
 * Securely proxies YouTube Data API v3 requests
 *
 * Features:
 * - Server-side API key protection
 * - Cloudflare Cache API integration (1 hour TTL)
 * - Rate limiting per IP
 * - CORS support
 * - Error handling
 */

import { getCachedResponse, cacheResponse } from './utils/cache.js';
import { isRateLimited, getRateLimitInfo } from './utils/rate-limit.js';

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';
const ALLOWED_ENDPOINTS = ['search', 'videos', 'channels', 'playlists'];

/**
 * Creates JSON error response
 */
function errorResponse(error, message, status = 500) {
  return new Response(
    JSON.stringify({
      error,
      message,
      status,
      timestamp: new Date().toISOString(),
    }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    },
  );
}

/**
 * Validates endpoint is allowed
 */
function validateEndpoint(endpoint) {
  const baseEndpoint = endpoint.split('/')[0];
  return ALLOWED_ENDPOINTS.includes(baseEndpoint);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    // Only allow GET requests
    if (request.method !== 'GET') {
      return errorResponse(
        'Method not allowed',
        'Only GET requests are supported',
        405,
      );
    }

    // Validate API key
    const apiKey = env.YOUTUBE_API_KEY;
    if (!apiKey) {
      return errorResponse(
        'Configuration error',
        'YOUTUBE_API_KEY not configured',
        500,
      );
    }

    // Extract endpoint from path
    const pathMatch = url.pathname.match(/^\/api\/youtube\/(.+)$/);
    if (!pathMatch) {
      return errorResponse(
        'Invalid endpoint',
        'Path must be in format /api/youtube/{endpoint}',
        400,
      );
    }

    const endpoint = pathMatch[1];

    // Validate endpoint is allowed
    if (!validateEndpoint(endpoint)) {
      return errorResponse(
        'Forbidden endpoint',
        `Endpoint '${endpoint}' is not allowed`,
        403,
      );
    }

    // Rate limiting
    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
    const rateLimit = parseInt(env.RATE_LIMIT_PER_MINUTE || '60', 10);

    if (isRateLimited(clientIP, rateLimit)) {
      const info = getRateLimitInfo(clientIP);
      return new Response(
        JSON.stringify({
          error: 'Rate limit exceeded',
          message: `Too many requests. Try again after ${new Date(info.resetAt).toISOString()}`,
          resetAt: info.resetAt,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': Math.ceil((info.resetAt - Date.now()) / 1000),
            'X-RateLimit-Remaining': info.remaining,
          },
        },
      );
    }

    // Build YouTube API URL
    const youtubeUrl = new URL(`${YOUTUBE_API_BASE}/${endpoint}`);

    // Copy query parameters
    url.searchParams.forEach((value, key) => {
      youtubeUrl.searchParams.set(key, value);
    });

    // Add API key
    youtubeUrl.searchParams.set('key', apiKey);

    // Create cache key
    const cacheKey = new Request(youtubeUrl.toString());

    // Check cache
    const cachedResponse = await getCachedResponse(cacheKey);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Fetch from YouTube API
    try {
      const response = await fetch(youtubeUrl.toString());

      if (!response.ok) {
        const errorText = await response.text();
        return errorResponse(
          'YouTube API error',
          `YouTube API returned ${response.status}: ${errorText}`,
          response.status,
        );
      }

      // Cache successful response
      const cacheTTL = parseInt(env.CACHE_TTL || '3600', 10);
      return await cacheResponse(cacheKey, response, cacheTTL);
    } catch (error) {
      console.error('YouTube API fetch error:', error);
      return errorResponse(
        'Proxy error',
        `Failed to fetch from YouTube API: ${error.message}`,
        502,
      );
    }
  },
};
