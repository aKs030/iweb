/**
 * Search Scoring Utilities
 * Relevance scoring, vector combination, intent boosting.
 */
import { compileQueryRegexes } from './_search-query.js';
import { isLowQualitySnippet } from './_search-content.js';
import { looksLikeVideoId } from './_search-url.js';

const INTENT_BOOST_RULES = [
  {
    regex: /\b(blog|artikel|post|beitrag|beitraege)\b/i,
    path: '/blog',
    boost: 4,
  },
  {
    regex: /\b(projekt|projekte|app|apps|tool|game|spiel)\b/i,
    path: '/projekte',
    boost: 4,
  },
  {
    regex: /\b(galerie|bild|bilder|foto|fotos|photography)\b/i,
    path: '/gallery',
    boost: 4,
  },
  {
    regex: /\b(video|videos|youtube|clip|clips)\b/i,
    path: '/videos',
    boost: 4,
  },
  {
    regex: /\b(kontakt|contact|email|anfrage)\b/i,
    path: '/contact',
    boost: 4,
  },
  {
    regex: /\b(about|ueber|uber|über|profil|lebenslauf)\b/i,
    path: '/about',
    boost: 4,
  },
  {
    regex: /\b(datenschutz|privacy|dsgvo)\b/i,
    path: '/datenschutz',
    boost: 3,
  },
  {
    regex: /\b(impressum|legal|anbieterkennzeichnung)\b/i,
    path: '/impressum',
    boost: 3,
  },
];

/**
 * Calculate relevance score based on multiple factors
 * @param {Object} result - Search result object
 * @param {string} originalQuery - Original search query
 * @param {string[]} [queryTerms] - Optional pre-split query terms
 * @param {RegExp[]} [queryRegexes] - Optional pre-compiled regexes
 * @returns {number} Enhanced relevance score
 */
export function calculateRelevanceScore(
  result,
  originalQuery,
  queryTerms,
  queryRegexes,
) {
  let score = result.score || 0;
  let textMatchScore = 0;

  const queryLower = originalQuery.toLowerCase().trim();
  const titleLower = (result.title || '').toLowerCase();
  const urlLower = (result.url || '').toLowerCase();
  const descLower = (result.description || '').toLowerCase();

  // Word-boundary aware matching (stronger signal than substring)
  if (!queryTerms) {
    queryTerms = queryLower.split(/\s+/).filter((t) => t.length > 1);
  }

  if (!queryRegexes) {
    queryRegexes = compileQueryRegexes(queryTerms);
  }

  // Exact full query match
  if (titleLower.includes(queryLower)) textMatchScore += 12;
  if (urlLower.includes(queryLower)) textMatchScore += 6;
  if (descLower.includes(queryLower)) textMatchScore += 3;

  // Per-term matching with word-boundary bonus
  let termsMatched = 0;
  for (const re of queryRegexes) {
    if (re.test(titleLower)) {
      textMatchScore += 4;
      termsMatched++;
    } else if (re.test(urlLower)) {
      textMatchScore += 3;
      termsMatched++;
    } else if (re.test(descLower)) {
      textMatchScore += 2;
      termsMatched++;
    }
  }

  // Multi-term intersection bonus – all query terms found somewhere
  if (queryTerms.length > 1 && termsMatched === queryTerms.length) {
    textMatchScore += 5;
  }

  score += textMatchScore;

  // Only apply static boosts if there is a text match OR the vector score is decent
  if (textMatchScore > 0 || score > 0.6) {
    // Boost for shorter URLs (likely more important pages)
    const urlDepth = (result.url || '').split('/').length;
    score += Math.max(0, 5 - urlDepth);

    // Boost for specific categories
    const categoryBoosts = {
      projekte: 3,
      blog: 2,
      galerie: 2,
      videos: 2,
      home: 1,
    };

    const category = (result.category || '').toLowerCase();
    score += categoryBoosts[category] || 0;
  }

  return score;
}

/**
 * Calculate intent-based score bonus.
 * @param {string} query
 * @param {string} url
 * @returns {number}
 */
function normalizeIntentQuery(query) {
  return String(query ?? '')
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchesIntentRule(rule, query, normalizedQuery) {
  return rule.regex.test(query) || rule.regex.test(normalizedQuery);
}

export function getIntentBoost(query, url) {
  let boost = 0;
  const normalizedQuery = normalizeIntentQuery(query);

  for (const rule of INTENT_BOOST_RULES) {
    if (
      matchesIntentRule(rule, query, normalizedQuery) &&
      url.includes(rule.path)
    ) {
      boost += rule.boost;
    }
  }

  return boost;
}

/**
 * Extract intent paths matched by the query.
 * @param {string} query
 * @returns {string[]}
 */
export function getIntentPaths(query) {
  const paths = new Set();
  const normalizedQuery = normalizeIntentQuery(query);

  for (const rule of INTENT_BOOST_RULES) {
    if (matchesIntentRule(rule, query, normalizedQuery)) {
      paths.add(rule.path);
    }
  }

  return [...paths];
}

/**
 * Whether a URL aligns with one of the matched intent paths.
 * @param {string} url
 * @param {string[]} intentPaths
 * @returns {boolean}
 */
export function isIntentPathMatch(url, intentPaths) {
  if (!url || intentPaths.length === 0) {
    return false;
  }

  return intentPaths.some((path) => {
    if (url === path) return true;
    if (url.startsWith(`${path}/`)) return true;
    if (url.startsWith(`${path}?`)) return true;
    return false;
  });
}

/**
 * Measure how many query terms appear in result text fields.
 * @param {{title: string, description: string, url: string}} result
 * @param {string[]} queryTerms
 * @returns {{matched: number, ratio: number}}
 */
export function computeCoverageScore(result, queryTerms) {
  if (queryTerms.length === 0) {
    return { matched: 0, ratio: 0 };
  }

  const haystack = `${result.title} ${result.description} ${result.url}`
    .toLowerCase()
    .trim();

  let matched = 0;
  for (const term of queryTerms) {
    if (haystack.includes(term)) {
      matched += 1;
    }
  }

  return { matched, ratio: matched / queryTerms.length };
}

/**
 * Score a normalized search result with lexical + semantic + intent signals.
 * @param {{title: string, description: string, url: string, vectorScore: number}} result
 * @param {string} query
 * @param {string[]} queryTerms
 * @param {string[]} intentPaths
 * @param {RegExp[]} [queryRegexes] - Optional pre-compiled regexes
 * @returns {{title: string, description: string, url: string, vectorScore: number, score: number, matchCount: number, category: string, highlightedDescription: string}}
 */
export function scoreSearchResult(
  result,
  query,
  queryTerms,
  intentPaths,
  queryRegexes,
) {
  const vectorScaled = result.vectorScore * 12;
  const lexicalScore = calculateRelevanceScore(
    {
      ...result,
      score: vectorScaled,
    },
    query,
    queryTerms,
    queryRegexes,
  );

  const coverage = computeCoverageScore(result, queryTerms);
  const queryLower = query.toLowerCase();
  const titleLower = result.title.toLowerCase();
  const combinedText =
    `${result.title} ${result.description} ${result.url}`.toLowerCase();

  let score = lexicalScore;
  score += coverage.ratio * 10;

  if (queryTerms.length > 1 && coverage.matched === queryTerms.length) {
    score += 6;
  }

  if (combinedText.includes(queryLower)) {
    score += 3;
  }

  if (titleLower.includes(queryLower)) {
    score += 5;
  }

  score += getIntentBoost(queryLower, result.url);

  if (
    looksLikeVideoId(result.title) &&
    !/\b(video|videos|youtube|clip)\b/i.test(queryLower)
  ) {
    score -= 2;
  }

  if (isLowQualitySnippet(result.description)) {
    score -= 2;
  }

  if (intentPaths.length > 0 && !isIntentPathMatch(result.url, intentPaths)) {
    score -= intentPaths.length === 1 ? 6 : 4;
  }

  return {
    ...result,
    score,
    matchCount: coverage.matched,
  };
}
