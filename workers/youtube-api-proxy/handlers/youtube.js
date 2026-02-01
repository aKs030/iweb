/**
 * YouTube API Handler
 * Handles YouTube API proxy requests with validation and caching
 */

import { jsonResponse, errorResponse } from '../../shared/response-utils.js';
import { getCachedResponse, cacheResponse } from '../utils/cache.js';
import { isRateLimited, getRateLimitInfo } from '../utils/rate-limit.js';

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';
const ALLOWED_ENDPOINTS = ['search', 'videos', 'channels', 'playlists'];

/**
 * Validates endpoint is allowed
 * @param {string} endpoint - Endpoint to validate
 * @returns {boolean} True if allowed
 */
function validateEndpoint(endpoint) {
  const baseEndpoint = endpoint.split('/')[0];
  return ALLOWED_ENDPOINTS.includes(baseEndpoint);
}

/**
 * Handles YouTube API proxy requests
 * @param {Request} request - Incoming request
 * @param {Object} env - Environment variables
 * @returns {Promise<Response>} API response
 */
export async function youtubeHandler(request, env) {
  const url = new URL(request.url);

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
      `Endpoint '${endpoint}' is not allowed. Allowed: ${ALLOWED_ENDPOINTS.join(', ')}`,
      403,
    );
  }

  // Rate limiting
  const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
  const rateLimit = parseInt(env.RATE_LIMIT_PER_MINUTE || '60', 10);

  if (isRateLimited(clientIP, rateLimit)) {
    const info = getRateLimitInfo(clientIP);
    return jsonResponse(
      {
        error: 'Rate limit exceeded',
        message: `Too many requests. Try again after ${new Date(info.resetAt).toISOString()}`,
        resetAt: info.resetAt,
      },
      429,
      {
        'Retry-After': Math.ceil((info.resetAt - Date.now()) / 1000).toString(),
        'X-RateLimit-Remaining': info.remaining.toString(),
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
    // Log error in development only
    if (
      typeof env?.ENVIRONMENT !== 'undefined' &&
      env.ENVIRONMENT === 'development'
    ) {
      console.error('YouTube API fetch error:', error);
    }
    return errorResponse(
      'Proxy error',
      `Failed to fetch from YouTube API: ${error.message}`,
      502,
    );
  }
}
