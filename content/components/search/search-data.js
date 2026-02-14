/**
 * Search Data - Trending Searches, Quick Actions, Autocomplete
 * @version 1.0.0
 */

/**
 * Trending/Popular searches (can be dynamic via API later)
 */
export const TRENDING_SEARCHES = [
  { query: 'Projekte', icon: '💻', category: 'Projekte' },
  { query: 'Blog', icon: '📝', category: 'Blog' },
  { query: 'Galerie', icon: '🖼️', category: 'Gallery' },
  { query: 'Videos', icon: '🎬', category: 'Videos' },
  { query: 'Kontakt', icon: '📧', category: 'Contact' },
  { query: 'Three.js', icon: '🌍', category: 'Blog' },
];

/**
 * Quick Actions - Direct navigation commands
 */
export const QUICK_ACTIONS = [
  {
    trigger: ['home', 'startseite', 'start'],
    label: 'Zur Startseite',
    icon: '🏠',
    url: '/',
    description: 'Direkt zur Homepage',
  },
  {
    trigger: ['projekte', 'projects', 'portfolio'],
    label: 'Projekte öffnen',
    icon: '💻',
    url: '/pages/projekte',
    description: 'Alle Projekte anzeigen',
  },
  {
    trigger: ['blog', 'artikel', 'posts'],
    label: 'Blog öffnen',
    icon: '📝',
    url: '/pages/blog',
    description: 'Blog-Artikel lesen',
  },
  {
    trigger: ['galerie', 'gallery', 'bilder', 'photos', 'fotos'],
    label: 'Galerie öffnen',
    icon: '🖼️',
    url: '/pages/gallery',
    description: 'Fotogalerie ansehen',
  },
  {
    trigger: ['videos', 'filme'],
    label: 'Videos öffnen',
    icon: '🎬',
    url: '/pages/videos',
    description: 'Video-Portfolio',
  },
  {
    trigger: ['kontakt', 'contact', 'email'],
    label: 'Kontakt',
    icon: '📧',
    url: '/pages/contact',
    description: 'Kontaktformular öffnen',
  },
  {
    trigger: ['about', 'über', 'info'],
    label: 'Über mich',
    icon: 'ℹ️',
    url: '/pages/about',
    description: 'Mehr über mich erfahren',
  },
];

/**
 * Autocomplete suggestions based on common searches
 */
export const AUTOCOMPLETE_SUGGESTIONS = [
  'Projekte',
  'Blog',
  'Galerie',
  'Videos',
  'Kontakt',
  'Three.js',
  'React',
  'TypeScript',
  'Performance',
  'Web Components',
  'PWA',
  'CSS',
  'JavaScript',
  'Fotografie',
];

/**
 * Find matching quick action for query
 * @param {string} query - Search query
 * @returns {Object|null} Matching quick action or null
 */
export function findQuickAction(query) {
  const normalized = query.toLowerCase().trim();

  return (
    QUICK_ACTIONS.find((action) =>
      action.trigger.some((trigger) => trigger === normalized),
    ) || null
  );
}

/**
 * Get autocomplete suggestions for query
 * @param {string} query - Partial search query
 * @param {number} limit - Max number of suggestions
 * @returns {Array<string>} Matching suggestions
 */
export function getAutocompleteSuggestions(query, limit = 5) {
  if (!query || query.length < 2) return [];

  const normalized = query.toLowerCase();

  return AUTOCOMPLETE_SUGGESTIONS.filter((suggestion) =>
    suggestion.toLowerCase().includes(normalized),
  ).slice(0, limit);
}

/**
 * Calculate similarity score for "Did you mean?" suggestions
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {number} Similarity score (0-1)
 */
export function calculateSimilarity(a, b) {
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;

  if (longer.length === 0) return 1.0;

  const editDistance = levenshteinDistance(
    longer.toLowerCase(),
    shorter.toLowerCase(),
  );
  return (longer.length - editDistance) / longer.length;
}

/**
 * Levenshtein distance calculation
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {number} Edit distance
 */
function levenshteinDistance(a, b) {
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
 * Get "Did you mean?" suggestions
 * @param {string} query - Original query
 * @param {Array<string>} availableTerms - Available search terms
 * @param {number} threshold - Similarity threshold (0-1)
 * @returns {Array<string>} Suggested corrections
 */
export function getDidYouMeanSuggestions(
  query,
  availableTerms = AUTOCOMPLETE_SUGGESTIONS,
  threshold = 0.6,
) {
  if (!query || query.length < 3) return [];

  const suggestions = availableTerms
    .map((term) => ({
      term,
      similarity: calculateSimilarity(query, term),
    }))
    .filter((item) => item.similarity >= threshold && item.similarity < 1.0)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 3)
    .map((item) => item.term);

  return suggestions;
}
