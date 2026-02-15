/**
 * Search Utilities - Query Expansion, Fuzzy Matching, Relevance Scoring
 * @version 3.0.0
 */

/**
 * Synonym mapping for German query expansion
 * Erweitert für alle indexierten Seiten
 */
export const SYNONYMS = {
  bilder: ['galerie', 'photos', 'fotos', 'fotografie', 'gallery', 'images'],
  galerie: ['bilder', 'photos', 'fotos', 'gallery', 'images'],
  projekte: ['projects', 'arbeiten', 'portfolio', 'werke', 'projekt'],
  blog: [
    'artikel',
    'posts',
    'beiträge',
    'articles',
    'threejs',
    'performance',
    'storytelling',
    'design',
    'react',
  ],
  videos: ['filme', 'clips', 'aufnahmen', 'video'],
  kontakt: ['contact', 'email', 'nachricht', 'anfrage', 'formular'],
  über: ['about', 'info', 'information', 'profil', 'ich'],
  suche: ['search', 'finden', 'suchen'],
  home: ['startseite', 'hauptseite', 'index', 'start'],
  threejs: ['three.js', '3d', 'webgl', 'performance', 'optimization'],
  storytelling: ['visual', 'design', 'erzählen', 'story'],
  react: ['javascript', 'js', 'frontend', 'no-build'],
  ui: ['design', 'interface', 'modern', 'benutzeroberfläche'],
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

  // Boost for specific categories (angepasst an deutsche Kategorien)
  const categoryBoosts = {
    projekte: 3,
    blog: 2,
    galerie: 2,
    videos: 2,
    home: 1,
  };

  const category = (result.category || '').toLowerCase();
  score += categoryBoosts[category] || 0;

  return score;
}

/**
 * Normalize URL to prevent duplicates
 * removes domain, protocol, trailing slashes, index.html, and ensures leading slash
 * @param {string} url - Original URL
 * @returns {string} Normalized URL path
 */
export function normalizeUrl(url) {
  if (!url) return '/';

  // Remove protocol and domain
  let normalized = url.replace(/^https?:\/\/[^/]+/, '');

  // Remove query parameters and hash
  normalized = normalized.split(/[?#]/)[0];

  // Ensure leading slash
  if (!normalized.startsWith('/')) {
    normalized = '/' + normalized;
  }

  // Remove /index.html suffix
  if (normalized.endsWith('/index.html')) {
    normalized = normalized.substring(0, normalized.length - 11);
  }

  // Remove trailing slash (unless root)
  if (normalized !== '/' && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }

  // Handle empty string resulting from stripping index.html from root
  if (normalized === '') {
    normalized = '/';
  }

  return normalized;
}

/**
 * Clean description text by removing HTML tags and metadata artifacts
 * @param {string} text - Raw text content
 * @returns {string} Cleaned plain text
 */
export function cleanDescription(text) {
  if (!text) return '';

  let cleaned = text;

  // 1. Remove script and style blocks content
  cleaned = cleaned.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, '');
  cleaned = cleaned.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gim, '');

  // 2. Remove HTML tags
  cleaned = cleaned.replace(/<[^>]+>/g, ' ');

  // 3. Decode common HTML entities
  const entities = {
    '&nbsp;': ' ',
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&copy;': '(c)',
  };
  cleaned = cleaned.replace(/&[a-z0-9#]+;/gi, (match) => entities[match] || '');

  // 4. Remove metadata JSON-like structures often indexed by mistake
  // Matches {"key": "value"} patterns that might appear in text
  cleaned = cleaned.replace(/\{"[^"]+":\s*"[^"]+"\}/g, '');

  // 5. Remove Front Matter and Metadata artifacts
  // Remove standard Jekyll/Hugo front matter (between --- and ---)
  cleaned = cleaned.replace(/^---[\s\S]*?---\s*/, '');

  // Remove the specific pattern reported by user ":--- description:"
  // and potentially surrounding metadata if it looks like key-value pairs
  // This regex tries to catch lines looking like "key: value" around the description
  cleaned = cleaned.replace(/title:\s*[^:]+:--- description:\s*/i, '');

  // Also just remove ":--- description:" if it remains
  cleaned = cleaned.replace(/:--- description:\s*/gi, '');

  // Remove other common front matter keys if they appear as artifacts
  cleaned = cleaned.replace(
    /\b(layout|permalink|date|author):\s*[^ \n]+\s*/gi,
    '',
  );

  // 6. Remove specific site artifacts reported by users
  // Remove "Skip to main content" links (flexible match)
  cleaned = cleaned.replace(/\[?Zum Hauptinhalt springen\]?(\([^)]*\))?/gi, '');
  cleaned = cleaned.replace(/menu\.skip_mainmenu\.skip_nav/gi, '');

  // Remove site brand/title artifacts
  cleaned = cleaned.replace(/AKS \| WEB/g, '');
  cleaned = cleaned.replace(/© \d{4} Abdulkerim Sesli/gi, '');

  // Remove loading screen text
  cleaned = cleaned.replace(/Initialisiere System(\.\.\.)?/gi, '');
  cleaned = cleaned.replace(/\d+%\s*\d+%/g, ''); // Matches "0% 0%"

  // Remove specific UI artifacts (Cookie banner, Chat, Menu, Scroll hints)
  cleaned = cleaned.replace(/🍪\s*Wir nutzen Analytics[\s\S]*?Datenschutz/gi, '');
  cleaned = cleaned.replace(/Soll ich dir was zeigen\?×\s*\?\s*Hauptmenü geschlossen/gi, '');
  cleaned = cleaned.replace(/Scroll to explore • Click to view/gi, '');
  cleaned = cleaned.replace(/Premium Fotogalerie Professionelle Fotografie in höchster Qualität/gi, '');
  cleaned = cleaned.replace(/Fotos Eindrücke/gi, '');

  // Remove persistent 3D Earth overlay description that leaks into many pages
  cleaned = cleaned.replace(/Eine interaktive 3D-Darstellung der Erde[\s\S]*?Kamera-Modi\./gi, '');
  cleaned = cleaned.replace(/🌍 CSS-Modus/gi, '');

  // Remove raw JSON/JSON-LD blocks that might have been indexed
  // Matches any markdown code blocks
  cleaned = cleaned.replace(/```[\s\S]*?```/g, '');
  // Matches raw JSON-LD structure starting with @context
  cleaned = cleaned.replace(/\{\s*"@context":[\s\S]*?\}/g, '');
  // Matches partial JSON array fragments often found in search snippets
  cleaned = cleaned.replace(/\[\s*\{\s*"@type":[\s\S]*?\}\s*\]/g, '');
  cleaned = cleaned.replace(/\}\s*,\s*\{\s*"@type":[\s\S]*?\}/g, '');
  // Matches hanging JSON closing braces often left after truncation
  cleaned = cleaned.replace(/(\}\s*\]\s*\}\s*,?\s*\{\s*"@type":\s*"[^"]+")/g, '');
  // Clean remaining JSON syntax characters if they appear in isolation or clusters
  cleaned = cleaned.replace(/```json\s*\}?(\s*\]\s*\}\s*,?)?/g, '');
  cleaned = cleaned.replace(/(\}\s*,\s*)?\{\s*"@type":[\s\S]*?\}/g, '');
  // Remove trailing JSON artifacts like `url": "..."` or closing braces
  cleaned = cleaned.replace(/,\s*"url":\s*"[^"]+"[\s\S]*/, '');

  // 7. Normalize whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned;
}
