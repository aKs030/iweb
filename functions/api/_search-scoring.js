/**
 * Search Scoring Utilities
 * Simplified scoring relying on Cloudflare AI Vector Score.
 */
import { compileQueryRegexes } from './_search-query.js';
import { isLowQualitySnippet } from './_search-content.js';
import { looksLikeVideoId } from './_search-url.js';

/**
 * Basic intent detection for fast-path routing only.
 * Reduced set of essential paths.
 */
const INTENT_PATHS = [
  '/blog',
  '/projekte',
  '/gallery',
  '/videos',
  '/contact',
  '/about',
];

export function getIntentPaths(query) {
  const q = String(query || '').toLowerCase();
  // Simple substring check is enough for basic routing hints
  return INTENT_PATHS.filter((path) => q.includes(path.substring(1)));
}

export function isIntentPathMatch(url, intentPaths) {
  if (!url || intentPaths.length === 0) return false;
  return intentPaths.some((path) => url.startsWith(path));
}

/**
 * Calculate basic relevance score based on lexical matches.
 * Used by RAG (ai.js) and Search API.
 * @param {Object} result - Item with title, url, description
 * @param {string} query - Search query
 * @param {string[]} [queryTerms]
 * @param {RegExp[]} [queryRegexes]
 * @returns {number} Lexical score component
 */
export function calculateRelevanceScore(
  result,
  query,
  queryTerms,
  queryRegexes,
) {
  let score = 0;
  let termsMatched = 0;

  if (!queryRegexes) {
    if (!queryTerms) {
      // Basic fallback if no pre-computed terms provided
      // Use query splitting from _search-query logic essentially
      const cleanQuery = String(query || '')
        .toLowerCase()
        .trim();
      queryTerms = cleanQuery.split(/\s+/).filter((t) => t.length > 1);
    }
    queryRegexes = compileQueryRegexes(queryTerms);
  }

  const titleLower = (result.title || '').toLowerCase();

  for (const re of queryRegexes) {
    if (re.test(titleLower)) {
      score += 2;
      termsMatched++;
    }
  }

  if (
    queryTerms &&
    queryTerms.length > 0 &&
    termsMatched === queryTerms.length
  ) {
    score += 3; // Full match bonus
  }

  return score;
}

/**
 * Score a normalized search result.
 * Primarily uses the AI-provided vectorScore.
 * Adds minor boosting for direct lexical matches.
 */
export function scoreSearchResult(
  result,
  query,
  queryTerms,
  intentPaths,
  queryRegexes,
) {
  // 1. Start with Vector Score (0.0 - 1.0) scaled up
  let score = (result.vectorScore || 0) * 10;

  // 2. Add Lexical Bonus (using shared logic)
  score += calculateRelevanceScore(result, query, queryTerms, queryRegexes);

  // 3. Penalties for low quality
  if (looksLikeVideoId(result.title)) score -= 2;
  if (isLowQualitySnippet(result.description)) score -= 2;

  // 4. Calculate terms matched for reporting (optional, but good for filtering)
  // We re-calculate or assume high relevance if vector score is high.
  // Ideally calculateRelevanceScore should return matchCount too, but to keep signature simple for ai.js
  // we just use the score. For search.js we can infer matchCount or re-run logic if critical.
  // For now, let's just approximate matchCount based on score boost to keep API contract.
  let matchCount = 0;
  if (score > (result.vectorScore || 0) * 10) {
    matchCount = 1; // At least one match if score increased
  }

  return {
    ...result,
    score,
    matchCount,
  };
}
