/**
 * Search Handler
 * Implements server-side full-text search with scoring algorithm
 * Uses Cloudflare D1 and Cache API
 */

import { jsonResponse, errorResponse } from '../../shared/response-utils.js';
import { validateSearchRequest } from '../utils/validation.js';
import { performSearch } from '../../shared/search-utils.js';

/**
 * Handles /api/search requests
 */
export async function searchHandler(request, env, ctx) {
  if (request.method !== 'POST') {
    return errorResponse('Method not allowed', 'Use POST.', 405);
  }

  try {
    const body = await request.json();
    const validation = validateSearchRequest(body);

    if (!validation.valid) {
      return errorResponse('Validation failed', validation.error, 400);
    }

    const { query, topK } = body;

    // Cache Strategy: Use Cache API with a synthetic GET request key
    // since we are using POST for search.
    const cache = caches.default;
    const cacheUrl = new URL(request.url);
    cacheUrl.searchParams.set('q', query);
    cacheUrl.searchParams.set('topK', String(topK));
    const cacheKey = new Request(cacheUrl.toString(), {
      method: 'GET',
    });

    // Check cache
    let response = await cache.match(cacheKey);
    if (response) {
      return response;
    }

    const maxResults = parseInt(env.MAX_SEARCH_RESULTS || '10', 10);
    const limitedTopK = Math.min(topK || 5, maxResults);

    // Perform search using D1
    const results = await performSearch(query, limitedTopK, env, true);

    response = jsonResponse({
      results,
      query,
      count: results.length,
    });

    // Set Cache-Control header (e.g., 5 minutes)
    // env.CACHE_TTL should be a string in seconds
    const ttl = parseInt(env.CACHE_TTL || '300', 10);
    response.headers.set('Cache-Control', `public, max-age=${ttl}`);

    // Store in cache
    if (ctx && ctx.waitUntil) {
      ctx.waitUntil(cache.put(cacheKey, response.clone()));
    }

    return response;
  } catch (error) {
    // Log error in development only
    if (
      typeof env?.ENVIRONMENT !== 'undefined' &&
      env.ENVIRONMENT === 'development'
    ) {
      console.error('Search error:', error);
    }
    return errorResponse('Search failed', error.message, 500);
  }
}
