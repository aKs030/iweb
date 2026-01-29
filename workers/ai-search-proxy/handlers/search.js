/**
 * Search Handler
 * Implements server-side full-text search with scoring algorithm
 */

import { jsonResponse, errorResponse } from '../utils/response.js';
import { validateSearchRequest } from '../utils/validation.js';

/**
 * Performs full-text search on the index with relevance scoring
 * @param {string} query - Search query
 * @param {number} topK - Number of results to return
 * @param {Array} searchIndex - Search index data
 * @returns {Array} Sorted search results
 */
function performSearch(query, topK, searchIndex) {
  const q = String(query || '')
    .toLowerCase()
    .trim();
  if (!q) return [];

  const words = q.split(/\s+/).filter(Boolean);

  const results = searchIndex.map((item) => {
    let score = item.priority || 0;
    const title = (item.title || '').toLowerCase();
    const desc = (item.description || '').toLowerCase();

    // Exact title match - highest priority
    if (title === q) score += 1000;
    else if (title.startsWith(q)) score += 500;
    else if (title.includes(q)) score += 200;

    // Description match
    if (desc.includes(q)) score += 100;

    // Keyword matching
    (item.keywords || []).forEach((k) => {
      const kl = (k || '').toLowerCase();
      if (kl === q) score += 150;
      else if (kl.startsWith(q)) score += 80;
      else if (kl.includes(q)) score += 40;
    });

    // Multi-word matching
    words.forEach((w) => {
      if (title.includes(w)) score += 30;
      if (desc.includes(w)) score += 15;
      (item.keywords || []).forEach((k) => {
        if ((k || '').toLowerCase().includes(w)) score += 20;
      });
    });

    return { ...item, score };
  });

  return results
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      url: r.url,
      score: r.score, // Include score for debugging
    }));
}

/**
 * Handles /api/search requests
 */
export async function searchHandler(request, env, searchIndex) {
  if (request.method !== 'POST') {
    return errorResponse('Method not allowed. Use POST.', 405);
  }

  try {
    const body = await request.json();
    const validation = validateSearchRequest(body);

    if (!validation.valid) {
      return errorResponse(validation.error, 400);
    }

    const { query, topK } = body;
    const maxResults = parseInt(env.MAX_SEARCH_RESULTS || '10', 10);
    const limitedTopK = Math.min(topK || 5, maxResults);

    const results = performSearch(query, limitedTopK, searchIndex);

    return jsonResponse({
      results,
      query,
      count: results.length,
    });
  } catch (error) {
    console.error('Search error:', error);
    return errorResponse(`Search failed: ${error.message}`, 500);
  }
}
