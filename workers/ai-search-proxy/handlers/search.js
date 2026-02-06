/**
 * Search Handler – POST /api/search
 */

import { jsonResponse, errorResponse } from '../../shared/response-utils.js';
import { validateSearchRequest } from '../validation.js';
import { performSearch } from '../../shared/search-utils.js';

export async function searchHandler(request, env, searchIndex) {
  if (request.method !== 'POST') {
    return errorResponse('Method not allowed', 'Use POST.', 405, request);
  }

  try {
    const body = await request.json();
    const validation = validateSearchRequest(body);

    if (!validation.valid) {
      return errorResponse('Validation failed', validation.error, 400, request);
    }

    const { query, topK } = body;
    const maxResults = parseInt(env.MAX_SEARCH_RESULTS || '10', 10);
    const results = performSearch(
      query,
      Math.min(topK || 5, maxResults),
      searchIndex,
      true,
    );

    return jsonResponse(
      { results, query, count: results.length },
      200,
      {},
      request,
    );
  } catch (error) {
    if (env.ENVIRONMENT === 'development')
      console.error('Search error:', error);
    return errorResponse('Search failed', error.message, 500, request);
  }
}
