/**
 * Search Utilities - Query Expansion, Fuzzy Matching, Relevance Scoring
 * @version 1.0.0
 */

/**
 * Synonym mapping for German query expansion
 */
export const SYNONYMS = {
  bilder: ['galerie', 'photos', 'fotos', 'fotografie', 'gallery'],
  projekte: ['projects', 'arbeiten', 'portfolio', 'werke'],
  blog: ['artikel', 'posts', 'beiträge', 'articles'],
  videos: ['filme', 'clips', 'aufnahmen'],
  kontakt: ['contact', 'email', 'nachricht', 'anfrage'],
  über: ['about', 'info', 'information', 'profil'],
  suche: ['search', 'finden', 'suchen'],
  home: ['startseite', 'hauptseite', 'index'],
};

/**
 * Calculate Levenshtein distance for fuzzy matching
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {number} Edit distance
 */
export function levenshteinDistance(a, b) {
  const matrix = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1,
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Expand query with synonyms
 * @param {string} query - Original search query
 * @returns {string} Expanded query with synonyms
 */
export function expandQuery(query) {
  const words = query.toLowerCase().split(/\s+/);
  const expandedWords = new Set(words);

  words.forEach((word) => {
    // Direct synonym match
    if (SYNONYMS[word]) {
      SYNONYMS[word].forEach((syn) => expandedWords.add(syn));
    }

    // Fuzzy match against synonym keys (typo tolerance)
    Object.keys(SYNONYMS).forEach((key) => {
      const distance = levenshteinDistance(word, key);
      // Allow 1-2 character difference based on word length
      const threshold = word.length <= 4 ? 1 : 2;

      if (distance <= threshold && distance > 0) {
        expandedWords.add(key);
        SYNONYMS[key].forEach((syn) => expandedWords.add(syn));
      }
    });
  });

  return Array.from(expandedWords).join(' ');
}

/**
 * Calculate relevance score based on multiple factors
 * @param {Object} result - Search result object
 * @param {string} originalQuery - Original search query
 * @returns {number} Enhanced relevance score
 */
export function calculateRelevanceScore(result, originalQuery) {
  let score = result.score || 0;

  const queryLower = originalQuery.toLowerCase();
  const titleLower = (result.title || '').toLowerCase();
  const urlLower = (result.url || '').toLowerCase();
  const descLower = (result.description || '').toLowerCase();

  // Boost for exact title match
  if (titleLower.includes(queryLower)) {
    score += 10;
  }

  // Boost for URL match
  if (urlLower.includes(queryLower)) {
    score += 5;
  }

  // Boost for description match
  if (descLower.includes(queryLower)) {
    score += 2;
  }

  // Boost for shorter URLs (likely more important pages)
  const urlDepth = (result.url || '').split('/').length;
  score += Math.max(0, 5 - urlDepth);

  // Boost for specific categories
  const categoryBoosts = {
    projekte: 3,
    blog: 2,
    gallery: 2,
  };

  const category = (result.category || '').toLowerCase();
  score += categoryBoosts[category] || 0;

  return score;
}

/**
 * Generate cache key for search query
 * @param {string} query - Search query
 * @param {number} topK - Number of results
 * @returns {string} Cache key
 */
export function getCacheKey(query, topK = 10) {
  return `search:${query.toLowerCase().trim()}:${topK}`;
}

/**
 * Check if cache entry is still valid
 * @param {Object} cached - Cached data with timestamp
 * @param {number} maxAge - Max age in seconds (default: 1 hour)
 * @returns {boolean} True if cache is valid
 */
export function isCacheValid(cached, maxAge = 3600) {
  if (!cached || !cached.timestamp) return false;
  const age = Date.now() - cached.timestamp;
  return age < maxAge * 1000;
}
