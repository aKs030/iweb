/**
 * Search Utilities - Query Expansion, Fuzzy Matching, Relevance Scoring
 * @version 5.2.0 - Refactored with separate modules
 */

import { normalizeText, sanitizeDiscoveryText } from './_text-utils.js';
import { escapeXml } from './_xml-utils.js';
import { CLEANUP_PATTERNS, HTML_ENTITIES } from './_cleanup-patterns.js';

export { normalizeText, sanitizeDiscoveryText, escapeXml };

/**
 * Synonym mapping for German query expansion
 * Erweitert für alle indexierten Seiten
 */
export const SYNONYMS = {
  // --- Pages ---
  bilder: ['galerie', 'photos', 'fotos', 'fotografie', 'gallery', 'images'],
  galerie: ['bilder', 'photos', 'fotos', 'gallery', 'images'],
  projekte: ['projects', 'arbeiten', 'portfolio', 'werke', 'projekt', 'apps'],
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
  videos: ['filme', 'clips', 'aufnahmen', 'video', 'youtube'],
  kontakt: ['contact', 'email', 'nachricht', 'anfrage', 'formular'],
  über: ['about', 'info', 'information', 'profil', 'ich'],
  suche: ['search', 'finden', 'suchen'],
  home: ['startseite', 'hauptseite', 'index', 'start'],

  // --- Blog Topics ---
  threejs: ['three.js', '3d', 'webgl', 'performance', 'optimization'],
  storytelling: ['visual', 'design', 'erzählen', 'story'],
  react: ['javascript', 'js', 'frontend', 'no-build'],
  ui: ['design', 'interface', 'modern', 'benutzeroberfläche'],
  seo: [
    'suchmaschinenoptimierung',
    'search engine',
    'google',
    'meta',
    'ranking',
  ],
  typescript: ['ts', 'typen', 'types', 'typed', 'javascript'],
  'web-components': ['webcomponents', 'custom elements', 'shadow dom', 'slots'],
  css: ['styles', 'stylesheet', 'container queries', 'responsive', 'layout'],
  pwa: ['progressive web app', 'service worker', 'offline', 'manifest'],
  performance: [
    'schnell',
    'fast',
    'optimierung',
    'optimization',
    'speed',
    'ladezeit',
  ],

  // --- Project Apps ---
  calculator: ['taschenrechner', 'rechner', 'math', 'berechnung'],
  taschenrechner: ['calculator', 'rechner', 'math'],
  memory: ['memory-game', 'gedächtnis', 'kartenspiel', 'karten'],
  snake: ['snake-game', 'schlange', 'arcade', 'retro'],
  pong: ['pong-game', 'ping-pong', 'arcade', 'retro'],
  quiz: ['quiz-app', 'wissen', 'trivia', 'fragen'],
  todo: ['todo-liste', 'aufgaben', 'tasks', 'planer', 'to-do'],
  timer: ['timer-app', 'countdown', 'stoppuhr', 'pomodoro'],
  passwort: ['password-generator', 'password', 'sicherheit', 'security'],
  wetter: ['weather-app', 'weather', 'forecast', 'vorhersage', 'temperatur'],
  zeichnen: ['paint-app', 'paint', 'malen', 'canvas', 'drawing'],
  farben: ['color-changer', 'colors', 'farbwechsler', 'gradient'],
  tippen: ['typing-speed-test', 'typing', 'geschwindigkeit', 'wpm', 'tastatur'],
  spiel: ['game', 'spiele', 'games', 'spielen', 'arcade'],
  game: ['spiel', 'spiele', 'games', 'spielen'],
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
  let textMatchScore = 0;

  const queryLower = originalQuery.toLowerCase().trim();
  const titleLower = (result.title || '').toLowerCase();
  const urlLower = (result.url || '').toLowerCase();
  const descLower = (result.description || '').toLowerCase();

  // Word-boundary aware matching (stronger signal than substring)
  const queryTerms = queryLower.split(/\s+/).filter((t) => t.length > 1);
  const boundaryRe = (term) =>
    new RegExp(
      `(^|[\\s/\\-_.])${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
      'i',
    );

  // Exact full query match
  if (titleLower.includes(queryLower)) textMatchScore += 12;
  if (urlLower.includes(queryLower)) textMatchScore += 6;
  if (descLower.includes(queryLower)) textMatchScore += 3;

  // Per-term matching with word-boundary bonus
  let termsMatched = 0;
  for (const term of queryTerms) {
    const re = boundaryRe(term);
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
 * Detect whether a snippet is too low quality to display.
 * Returns true when the text is empty, too short, or consists mostly of
 * non-word characters / known placeholder strings.
 * @param {string} text - The snippet to evaluate
 * @param {number} [minLength=12] - Minimum meaningful length
 * @returns {boolean} true if the snippet should be replaced with a fallback
 */
export function isLowQualitySnippet(text, minLength = 12) {
  if (!text) return true;
  const trimmed = text.trim();
  if (trimmed.length < minLength) return true;

  // Mostly non-word characters (JSON debris, punctuation soup)
  const wordChars = trimmed.replace(/[^a-zA-ZäöüÄÖÜß]/g, '');
  if (wordChars.length < 6) return true;

  // Looks like an anchor-only remnant, e.g. "(#main-content)"
  if (/^\(?#[a-z-]+\)?$/i.test(trimmed)) return true;

  // Contains JSON-LD / structured-data debris
  if (/@type|@context|ListItem|"position"|```json/i.test(trimmed)) return true;

  // Known placeholder strings
  const PLACEHOLDERS = ['keine beschreibung', 'css-modus', 'no description'];
  const lower = trimmed.toLowerCase();
  return PLACEHOLDERS.some((p) => lower.includes(p) && trimmed.length < 40);
}

/**
 * Clean description text by removing HTML tags and metadata artifacts
 * @param {string} text - Raw text content
 * @returns {string} Cleaned plain text
 */
export function cleanDescription(text) {
  if (!text) return '';

  let cleaned = text;

  for (const [pattern, replacement] of CLEANUP_PATTERNS) {
    cleaned = cleaned.replace(pattern, replacement);
  }

  // Decode HTML entities
  cleaned = cleaned.replace(/&[a-z0-9#]+;/gi, (m) => HTML_ENTITIES[m] || '');

  // Normalize whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned;
}

/**
 * Wrap matching query terms in <mark> tags for highlight rendering.
 * Only operates on plain-text content (no nested HTML expected).
 * @param {string} text - Plain text to highlight
 * @param {string} query - Original search query
 * @returns {string} Text with <mark> wrapped matches
 */
export function highlightMatches(text, query) {
  if (!text || !query) return text || '';

  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 1)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

  if (terms.length === 0) return text;

  const pattern = new RegExp(`(${terms.join('|')})`, 'gi');
  return text.replace(pattern, '<mark>$1</mark>');
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

  // If no valid query words, return start of content
  if (words.length === 0) {
    return (
      cleanContent.substring(0, maxLength) +
      (cleanContent.length > maxLength ? '...' : '')
    );
  }

  // Find the first occurrence of any query word
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

  // If match found, center the window around it
  if (bestIndex !== -1) {
    const halfLength = Math.floor(maxLength / 2);
    let start = Math.max(0, bestIndex - halfLength);
    let end = start + maxLength;

    // Adjust if window goes beyond end
    if (end > cleanContent.length) {
      end = cleanContent.length;
      start = Math.max(0, end - maxLength);
    }

    // Try to align start to a word boundary
    if (start > 0) {
      const spaceIndex = cleanContent.lastIndexOf(' ', start);
      if (spaceIndex !== -1 && start - spaceIndex < 20) {
        start = spaceIndex + 1;
      }
    }

    // Try to align end to a word boundary
    if (end < cleanContent.length) {
      const spaceIndex = cleanContent.indexOf(' ', end);
      if (spaceIndex !== -1 && spaceIndex - end < 20) {
        end = spaceIndex;
      }
    }

    let snippet = cleanContent.substring(start, end);

    // Add ellipsis if needed
    if (start > 0) snippet = '...' + snippet;
    if (end < cleanContent.length) snippet = snippet + '...';

    return snippet;
  }

  // Fallback: Return start of content if no match found
  return (
    cleanContent.substring(0, maxLength) +
    (cleanContent.length > maxLength ? '...' : '')
  );
}
