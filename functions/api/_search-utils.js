/**
 * Search Utilities - Query Expansion, Fuzzy Matching, Relevance Scoring
 * @version 4.0.0 - Centralized Utilities
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
 * @param {Object} result - Search result object (normalized)
 * @param {string} originalQuery - Original search query
 * @returns {number} Enhanced relevance score
 */
export function calculateRelevanceScore(result, originalQuery) {
  let score = result.score || 0;
  let textMatchScore = 0;

  const queryLower = originalQuery.toLowerCase();
  // Split query into terms for partial matching
  const queryTerms = queryLower.split(/\s+/).filter((t) => t.length > 2);

  const titleLower = (result.title || '').toLowerCase();
  const urlLower = (result.url || '').toLowerCase();
  const descLower = (result.description || '').toLowerCase();

  // Boost for exact phrase match
  if (titleLower.includes(queryLower)) {
    textMatchScore += 10;
  } else if (urlLower.includes(queryLower)) {
    textMatchScore += 5;
  } else if (descLower.includes(queryLower)) {
    textMatchScore += 2;
  }

  // Boost for individual term matches
  queryTerms.forEach((term) => {
    if (titleLower.includes(term)) textMatchScore += 1.0;
    if (urlLower.includes(term)) textMatchScore += 0.5;
    if (descLower.includes(term)) textMatchScore += 0.2;
  });

  score += textMatchScore;

  // Only apply static boosts if there is a text match OR the vector score is decent
  // This prevents completely irrelevant pages from being boosted just because of their URL depth or category
  if (textMatchScore > 0 || score > 0.6) {
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
  }

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

  // Remove .html extension
  if (normalized.endsWith('.html')) {
    normalized = normalized.slice(0, -5);
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
 * Extract page title from filename
 * @param {string} filename - Original filename
 * @returns {string} Page title
 */
export function extractTitle(filename) {
  if (!filename) return 'Unbekannt';

  // Normalize URL first to handle clean paths consistently
  const url = normalizeUrl(filename);
  const segments = url.split('/').filter(Boolean);

  // 1. Root / Home
  if (url === '/' || segments.length === 0) {
    return 'Startseite';
  }

  // 2. Top-level pages with custom mapping
  if (segments.length === 1) {
    const key = segments[0].toLowerCase();
    const titleMap = {
      projekte: 'Projekte Übersicht',
      blog: 'Blog Übersicht',
      gallery: 'Galerie',
      videos: 'Videos Übersicht',
      about: 'Über mich',
      contact: 'Kontakt',
      impressum: 'Impressum',
      datenschutz: 'Datenschutz',
    };
    if (titleMap[key]) return titleMap[key];
  }

  // 3. Sub-pages or unmapped top-level pages
  const lastSegment = segments[segments.length - 1];

  // Convert kebab-case to Title Case
  return lastSegment
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Extract category from URL
 * @param {string} url - Normalized URL
 * @returns {string} Category name
 */
export function extractCategory(url) {
  if (!url) return 'Seite';
  if (url.includes('/projekte')) return 'Projekte';
  if (url.includes('/blog')) return 'Blog';
  if (url.includes('/gallery')) return 'Galerie';
  if (url.includes('/videos')) return 'Videos';
  if (url.includes('/about')) return 'Über mich';
  if (url.includes('/contact')) return 'Kontakt';
  if (url === '/' || url === '/index.html') return 'Home';
  return 'Seite';
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
  cleaned = cleaned.replace(/\{"[^"]+":\s*"[^"]+"\}/g, '');

  // 5. Remove Front Matter and Metadata artifacts
  cleaned = cleaned.replace(/^---[\s\S]*?---\s*/, '');
  cleaned = cleaned.replace(/title:\s*[^:]+:--- description:\s*/i, '');
  cleaned = cleaned.replace(/:--- description:\s*/gi, '');
  cleaned = cleaned.replace(
    /\b(layout|permalink|date|author):\s*[^ \n]+\s*/gi,
    '',
  );

  // 6. Remove specific site artifacts
  cleaned = cleaned.replace(/\[?Zum Hauptinhalt springen\]?(\([^)]*\))?/gi, '');
  cleaned = cleaned.replace(/menu\.skip_mainmenu\.skip_nav/gi, '');
  cleaned = cleaned.replace(/AKS \| WEB/g, '');
  cleaned = cleaned.replace(/© \d{4} Abdulkerim Sesli/gi, '');
  cleaned = cleaned.replace(/Initialisiere System(\.\.\.)?/gi, '');
  cleaned = cleaned.replace(/\d+%\s*\d+%/g, '');
  cleaned = cleaned.replace(
    /🍪\s*Wir nutzen Analytics[\s\S]*?Datenschutz/gi,
    '',
  );
  cleaned = cleaned.replace(
    /Soll ich dir was zeigen\?×\s*\?\s*Hauptmenü geschlossen/gi,
    '',
  );
  cleaned = cleaned.replace(/Willkommen auf der Seite!×\s*\?/gi, '');
  cleaned = cleaned.replace(/Scroll to explore • Click to view/gi, '');
  cleaned = cleaned.replace(
    /Premium Fotogalerie Professionelle Fotografie in höchster Qualität/gi,
    '',
  );
  cleaned = cleaned.replace(/Fotos Eindrücke/gi, '');
  cleaned = cleaned.replace(/Startseite Start/gi, '');
  cleaned = cleaned.replace(/Zitat vollständig:/gi, '');
  cleaned = cleaned.replace(
    /Eine interaktive 3D-Darstellung der Erde[\s\S]*?Kamera-Modi\./gi,
    '',
  );
  cleaned = cleaned.replace(/🌍 CSS-Modus/gi, '');
  cleaned = cleaned.replace(
    /Vielen herzlichen Dank, dass Sie sich die Zeit genommen haben[\s\S]*?nächsten Besuch!/gi,
    '',
  );
  cleaned = cleaned.replace(
    /Schön, dass du nachts hier bist – willkommen!/gi,
    '',
  );
  cleaned = cleaned.replace(
    /Habe Mut, dich deines eigenen Verstandes zu bedienen\./gi,
    '',
  );
  cleaned = cleaned.replace(/Weiter Kontakt Auf Wiedersehen!/gi, '');
  cleaned = cleaned.replace(/Nach oben Über mich/gi, '');

  // Remove JSON/JSON-LD artifacts
  cleaned = cleaned.replace(/```[\s\S]*?```/g, '');
  cleaned = cleaned.replace(/\{\s*"@context":[\s\S]*?\}/g, '');
  cleaned = cleaned.replace(/\[\s*\{\s*"@type":[\s\S]*?\}\s*\]/g, '');
  cleaned = cleaned.replace(/\}\s*,\s*\{\s*"@type":[\s\S]*?\}/g, '');
  cleaned = cleaned.replace(
    /(\}\s*\]\s*\}\s*,?\s*\{\s*"@type":\s*"[^"]+")/g,
    '',
  );
  cleaned = cleaned.replace(/```json\s*\}?(\s*\]\s*\}\s*,?)?/g, '');
  cleaned = cleaned.replace(/(\}\s*,\s*)?\{\s*"@type":[\s\S]*?\}/g, '');
  cleaned = cleaned.replace(/,\s*"url":\s*"[^"]+"[\s\S]*/, '');
  cleaned = cleaned.replace(/^\]\s*,\s*,?\s*"[^"]+":\s*"[^"]+"/g, '');
  cleaned = cleaned.replace(/,\s*,\s*"[^"]+":\s*"[^"]+"/g, '');
  cleaned = cleaned.replace(/,\s*"[^"]+":\s*"[^"]+"/g, '');
  cleaned = cleaned.replace(/\}\s*,\s*\{/g, '');
  cleaned = cleaned.replace(/,?\s*"[^"]+":\s*"[^"]+"/g, '');
  cleaned = cleaned.replace(/\{?\s*"[^"]+":\s*"[^"]+"\s*\}?/g, '');
  cleaned = cleaned.replace(/^,\s*/, '');
  cleaned = cleaned.replace(/©\s*\d{4}\s*Abdulkerim Sesli/gi, '');
  cleaned = cleaned.replace(/Kant\s*/gi, '');
  cleaned = cleaned.replace(/✨\s*AI OVERVIEW/gi, '');

  // 7. Normalize whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned;
}

/**
 * Extract and clean content from search result item
 * @param {Object} item - Search result item (raw)
 * @param {number} maxLength - Maximum content length
 * @returns {string} Cleaned content
 */
export function extractContent(item, maxLength = 400) {
  let fullContent = '';

  // Try content array first
  if (item.content && Array.isArray(item.content)) {
    fullContent = item.content.map((c) => c.text || '').join(' ');
  }

  // Fallback to other possible fields
  if (!fullContent && item.text) {
    fullContent = item.text;
  }

  if (!fullContent && item.description) {
    fullContent = item.description;
  }

  if (!fullContent) {
    return '';
  }

  // Use centralized cleaner
  const cleaned = cleanDescription(fullContent);

  // If content is short enough, return as is
  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  // Intelligent truncation
  const truncated = cleaned.substring(0, maxLength);
  const lastPeriod = truncated.lastIndexOf('.');
  const lastExclamation = truncated.lastIndexOf('!');
  const lastQuestion = truncated.lastIndexOf('?');

  const breakPoint = Math.max(lastPeriod, lastExclamation, lastQuestion);

  if (breakPoint > maxLength * 0.7) {
    return cleaned.substring(0, breakPoint + 1);
  }

  return truncated + '...';
}

/**
 * Creates a smart text snippet focused on the query terms
 * @param {string} content - Full text content
 * @param {string} query - Search query
 * @param {number} maxLength - Maximum length of the snippet (default: 160)
 * @returns {string} Context-aware snippet
 */
export function createSnippet(content, query, maxLength = 160) {
  if (!content || !query) return content ? content.substring(0, maxLength) : '';

  const cleanContent = cleanDescription(content);
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);

  if (words.length === 0) {
    return (
      cleanContent.substring(0, maxLength) +
      (cleanContent.length > maxLength ? '...' : '')
    );
  }

  let bestIndex = -1;
  const contentLower = cleanContent.toLowerCase();

  for (const word of words) {
    const index = contentLower.indexOf(word);
    if (index !== -1) {
      if (bestIndex === -1 || index < bestIndex) {
        bestIndex = index;
      }
    }
  }

  if (bestIndex !== -1) {
    const halfLength = Math.floor(maxLength / 2);
    let start = Math.max(0, bestIndex - halfLength);
    let end = start + maxLength;

    if (end > cleanContent.length) {
      end = cleanContent.length;
      start = Math.max(0, end - maxLength);
    }

    if (start > 0) {
      const spaceIndex = cleanContent.lastIndexOf(' ', start);
      if (spaceIndex !== -1 && start - spaceIndex < 20) {
        start = spaceIndex + 1;
      }
    }

    if (end < cleanContent.length) {
      const spaceIndex = cleanContent.indexOf(' ', end);
      if (spaceIndex !== -1 && spaceIndex - end < 20) {
        end = spaceIndex;
      }
    }

    let snippet = cleanContent.substring(start, end);
    if (start > 0) snippet = '...' + snippet;
    if (end < cleanContent.length) snippet = snippet + '...';
    return snippet;
  }

  return (
    cleanContent.substring(0, maxLength) +
    (cleanContent.length > maxLength ? '...' : '')
  );
}

/**
 * Escape characters for XML
 * @param {string} unsafe - String to escape
 * @returns {string} Escaped XML string
 */
export function escapeXml(unsafe) {
  if (!unsafe) return '';
  return unsafe.replace(/[<>&'"]/g, function (c) {
    switch (c) {
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '&':
        return '&amp;';
      case "'":
        return '&apos;';
      case '"':
        return '&quot;';
      default:
        return c;
    }
  });
}
