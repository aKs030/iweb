/**
 * Search Handler
 * Implements server-side full-text search with scoring algorithm
 */

import { jsonResponse, errorResponse } from '../../shared/response-utils.js';
import { validateSearchRequest } from '../utils/validation.js';
import { performSearch } from '../../shared/search-utils.js';

/**
 * Handles /api/search requests
 */
export async function searchHandler(request, env, searchIndex) {
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
    const maxResults = parseInt(env.MAX_SEARCH_RESULTS || '10', 10);
    const limitedTopK = Math.min(topK || 5, maxResults);

    const results = performSearch(query, limitedTopK, searchIndex, true);

    return jsonResponse({
      results,
      query,
      count: results.length,
    });
  } catch (error) {
    console.error('Search error:', error);
    return errorResponse('Search failed', error.message, 500);
  }
}
