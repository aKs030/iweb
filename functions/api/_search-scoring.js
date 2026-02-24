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

  // 2. Add Lexical Bonus (if words actually match)
  let termsMatched = 0;
  if (!queryRegexes) queryRegexes = compileQueryRegexes(queryTerms);

  const titleLower = (result.title || '').toLowerCase();

  for (const re of queryRegexes) {
    if (re.test(titleLower)) {
      score += 2;
      termsMatched++;
    }
  }

  if (queryTerms.length > 0 && termsMatched === queryTerms.length) {
    score += 3; // Full match bonus
  }

  // 3. Penalties for low quality
  if (looksLikeVideoId(result.title)) score -= 2;
  if (isLowQualitySnippet(result.description)) score -= 2;

  return {
    ...result,
    score,
    matchCount: termsMatched,
  };
}
