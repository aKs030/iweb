/**
 * Search Utilities - Query Expansion, Fuzzy Matching, Relevance Scoring
 * @version 6.0.0 - Shared helpers for Cloudflare AI Search ranking
 */

import { CLEANUP_PATTERNS, HTML_ENTITIES } from './_cleanup-patterns.js';

/**
 * Synonym mapping for German query expansion
 * Erweitert für alle indexierten Seiten
 */
const SYNONYMS = {
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

const SYNONYM_KEYS = Object.keys(SYNONYMS);
const SYNONYM_KEYS_BY_INITIAL = new Map();
const SYNONYM_KEYS_BY_LENGTH = new Map();

SYNONYM_KEYS.forEach((key) => {
  const initial = key.charAt(0);
  if (!SYNONYM_KEYS_BY_INITIAL.has(initial)) {
    SYNONYM_KEYS_BY_INITIAL.set(initial, []);
  }
  SYNONYM_KEYS_BY_INITIAL.get(initial).push(key);

  const len = key.length;
  if (!SYNONYM_KEYS_BY_LENGTH.has(len)) {
    SYNONYM_KEYS_BY_LENGTH.set(len, []);
  }
  SYNONYM_KEYS_BY_LENGTH.get(len).push(key);
});

const QUERY_EXPANSION_CACHE = new Map();
const QUERY_EXPANSION_CACHE_MAX_ENTRIES = 200;
const MAX_FUZZY_COMPARISONS_PER_WORD = 40;

const TOP_LEVEL_TITLE_MAP = {
  projekte: 'Projekte Übersicht',
  blog: 'Blog Übersicht',
  gallery: 'Galerie',
  videos: 'Videos Übersicht',
  about: 'Über mich',
  contact: 'Kontakt',
};

const URL_DESCRIPTION_FALLBACKS = {
  '/': 'Startseite mit 3D-Visualisierung, Portfolio und AI-Funktionen.',
  '/about':
    'Profil, Tech-Stack und beruflicher Hintergrund von Abdulkerim Sesli.',
  '/contact': 'Kontaktseite mit E-Mail und Formular fuer Anfragen.',
  '/projekte': 'Uebersicht interaktiver Web-Apps, Spiele und Tools.',
  '/blog': 'Technischer Blog zu Webentwicklung, Performance und AI.',
  '/gallery': 'Fotogalerie mit optimierten Bildformaten und Serien.',
  '/videos': 'Video-Portfolio mit Tutorials und Demonstrationen.',
  '/datenschutz': 'Datenschutzinformationen gemaess DSGVO.',
  '/impressum': 'Rechtliche Anbieterkennzeichnung und Kontaktdaten.',
};

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
 * Calculate Levenshtein distance for fuzzy matching
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

function getFuzzyCandidateKeys(word, threshold) {
  const candidates = new Set();

  const byInitial = SYNONYM_KEYS_BY_INITIAL.get(word.charAt(0));
  if (byInitial?.length) {
    byInitial.forEach((key) => candidates.add(key));
  }

  const minLen = Math.max(1, word.length - threshold);
  const maxLen = word.length + threshold;
  for (let len = minLen; len <= maxLen; len++) {
    const byLength = SYNONYM_KEYS_BY_LENGTH.get(len);
    if (byLength?.length) {
      byLength.forEach((key) => candidates.add(key));
    }
  }

  return candidates.size > 0 ? Array.from(candidates) : SYNONYM_KEYS;
}

function setQueryExpansionCache(cacheKey, expandedQuery) {
  if (!cacheKey) return;

  if (QUERY_EXPANSION_CACHE.has(cacheKey)) {
    QUERY_EXPANSION_CACHE.delete(cacheKey);
  }

  if (QUERY_EXPANSION_CACHE.size >= QUERY_EXPANSION_CACHE_MAX_ENTRIES) {
    const oldestKey = QUERY_EXPANSION_CACHE.keys().next().value;
    if (oldestKey) {
      QUERY_EXPANSION_CACHE.delete(oldestKey);
    }
  }

  QUERY_EXPANSION_CACHE.set(cacheKey, expandedQuery);
}

/**
 * Expand query with synonyms
 * @param {string} query - Original search query
 * @returns {string} Expanded query with synonyms
 */
export function expandQuery(query) {
  const normalizedQuery = String(query || '')
    .toLowerCase()
    .trim();
  if (!normalizedQuery) return '';

  const cached = QUERY_EXPANSION_CACHE.get(normalizedQuery);
  if (cached) {
    QUERY_EXPANSION_CACHE.delete(normalizedQuery);
    QUERY_EXPANSION_CACHE.set(normalizedQuery, cached);
    return cached;
  }

  const words = normalizedQuery.split(/\s+/).filter(Boolean).slice(0, 10);
  const expandedWords = new Set(words);

  words.forEach((word) => {
    if (word.length < 2) return;

    // Direct synonym match
    const directSynonyms = SYNONYMS[word];
    if (directSynonyms) {
      directSynonyms.forEach((syn) => expandedWords.add(syn));
      return;
    }

    if (word.length < 3) return;

    // Fuzzy match against synonym keys (typo tolerance)
    const threshold = word.length <= 4 ? 1 : 2;
    const candidateKeys = getFuzzyCandidateKeys(word, threshold);
    let comparisons = 0;

    for (const key of candidateKeys) {
      if (key === word) continue;
      if (Math.abs(key.length - word.length) > threshold) continue;
      if (comparisons >= MAX_FUZZY_COMPARISONS_PER_WORD) break;

      comparisons += 1;
      const distance = levenshteinDistance(word, key);

      if (distance <= threshold && distance > 0) {
        expandedWords.add(key);
        SYNONYMS[key].forEach((syn) => expandedWords.add(syn));
      }
    }
  });

  const expandedQuery = Array.from(expandedWords).join(' ');
  setQueryExpansionCache(normalizedQuery, expandedQuery);
  return expandedQuery;
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

function humanizeSlug(value) {
  return String(value || '')
    .replace(/[_+]/g, '-')
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
    .trim();
}

function extractAppSlugFromUrl(url) {
  try {
    const parsed = new URL(String(url || ''), 'https://example.com');
    const app = parsed.searchParams.get('app');
    return app ? decodeURIComponent(app).trim() : '';
  } catch {
    return '';
  }
}

function canonicalizeUrlPath(path) {
  if (!path) return '/';

  let normalized = String(path).trim();
  if (!normalized.startsWith('/')) {
    normalized = '/' + normalized;
  }

  if (normalized.endsWith('/index.html')) {
    normalized = normalized.substring(0, normalized.length - 11);
  } else if (normalized.endsWith('.html')) {
    normalized = normalized.substring(0, normalized.length - 5);
  }

  if (normalized === '') {
    return '/';
  }

  if (normalized !== '/' && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }

  return normalized;
}

/**
 * Normalize URL to prevent duplicates
 * removes domain/protocol/noisy params but keeps canonical app deep-link query.
 * @param {string} url - Original URL
 * @returns {string} Normalized URL path
 */
export function normalizeUrl(url) {
  if (!url) return '/';

  let normalized = String(url).replace(/^https?:\/\/[^/]+/i, '');
  if (!normalized.startsWith('/')) {
    normalized = '/' + normalized;
  }

  const hashIndex = normalized.indexOf('#');
  if (hashIndex >= 0) {
    normalized = normalized.slice(0, hashIndex);
  }

  const [rawPath, rawQuery = ''] = normalized.split('?');
  const path = canonicalizeUrlPath(rawPath);
  const params = new URLSearchParams(rawQuery);
  const app = String(params.get('app') || '').trim();

  // Keep app deep-links as distinct canonical URLs.
  if (path === '/projekte' && app) {
    return `/projekte/?app=${encodeURIComponent(app)}`;
  }

  return path;
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

/**
 * Parse a positive integer or return null.
 * @param {unknown} value
 * @returns {number | null}
 */
export function parsePositiveInteger(value) {
  const normalized = String(value ?? '').trim();

  if (!/^\d+$/.test(normalized)) {
    return null;
  }

  const parsed = Number.parseInt(normalized, 10);
  return parsed > 0 ? parsed : null;
}

/**
 * Clamp a number into a fixed range.
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Convert query string into normalized terms.
 * @param {string} query
 * @returns {string[]}
 */
export function toQueryTerms(query) {
  return String(query)
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length > 1);
}

function toBasePath(url) {
  const [path] = String(url || '').split('?');
  return canonicalizeUrlPath(path);
}

/**
 * Infer high-level category from URL path.
 * @param {string} url
 * @returns {string}
 */
function detectCategory(url) {
  const path = toBasePath(url);
  if (path.includes('/projekte')) return 'Projekte';
  if (path.includes('/blog')) return 'Blog';
  if (path.includes('/gallery')) return 'Galerie';
  if (path.includes('/videos')) return 'Videos';
  if (path.includes('/about')) return 'Über mich';
  if (path.includes('/contact')) return 'Kontakt';
  if (path === '/') return 'Home';
  return 'Seite';
}

/**
 * Derive a human-readable title from filename/path.
 * @param {string} filename
 * @param {string} url
 * @returns {string}
 */
export function extractTitle(filename, url) {
  const appSlug = extractAppSlugFromUrl(url);
  if (appSlug) {
    return humanizeSlug(appSlug);
  }

  const title = filename?.split('/').pop()?.replace('.html', '') || '';

  if (title === 'index' || title === '' || !title) {
    const basePath = toBasePath(url);
    const segments = basePath.split('/').filter(Boolean);

    if (basePath === '/') {
      return 'Startseite';
    }

    if (segments.length === 1) {
      return (
        TOP_LEVEL_TITLE_MAP[segments[0]] ||
        segments[0].charAt(0).toUpperCase() + segments[0].slice(1)
      );
    }

    if (segments.length >= 2) {
      const lastSegment = segments[segments.length - 1];
      return lastSegment
        .split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    }
  }

  return title
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Extract textual content from AI search item candidates.
 * @param {object} item
 * @returns {string}
 */
function toTextContent(item) {
  if (Array.isArray(item?.content)) {
    const joined = item.content
      .map((c) => c?.text || '')
      .join(' ')
      .trim();
    if (joined) return joined;
  }

  if (typeof item?.text === 'string' && item.text.trim()) {
    return item.text;
  }

  if (typeof item?.description === 'string' && item.description.trim()) {
    return item.description;
  }

  return '';
}

/**
 * Check whether a token looks like an 11-char YouTube video ID.
 * @param {unknown} value
 * @returns {boolean}
 */
function looksLikeVideoId(value) {
  return /^[a-zA-Z0-9_-]{11}$/.test(String(value || '').trim());
}

/**
 * Pick the best result title from AI metadata and fallback heuristics.
 * @param {object} item
 * @param {string} fallbackTitle
 * @param {string} url
 * @returns {string}
 */
function chooseBestTitle(item, fallbackTitle, url) {
  const aiTitle =
    typeof item?.title === 'string' ? String(item.title).trim() : '';

  if (aiTitle && aiTitle.length > 2 && !looksLikeVideoId(aiTitle)) {
    return aiTitle;
  }

  const fallback = String(fallbackTitle || '').trim();
  if (url.includes('/videos/') && looksLikeVideoId(fallback)) {
    return `Video ${fallback}`;
  }

  return fallback || 'Unbenannt';
}

function buildFallbackDescription(url, title, category) {
  const appSlug = extractAppSlugFromUrl(url);
  if (appSlug) {
    return `${title} · Interaktive Projekt-App mit eigenem Funktionsumfang.`;
  }

  const basePath = toBasePath(url);
  return URL_DESCRIPTION_FALLBACKS[basePath] || `${title} · ${category}`;
}

/**
 * Normalize an AI item into the API search result schema.
 * @param {object} item
 * @param {string} query
 * @param {number} [snippetMaxLength=170]
 * @returns {{url: string, title: string, category: string, description: string, highlightedDescription: string, vectorScore: number}}
 */
export function toSearchResult(item, query, snippetMaxLength = 170) {
  let url = normalizeUrl(item?.filename);
  if (url === '/search' || url === '/api/search') {
    url = '/';
  }

  const textContent = toTextContent(item);
  const snippet = createSnippet(textContent, query, snippetMaxLength);
  const inferredTitle = extractTitle(item?.filename, url);
  const title = chooseBestTitle(item, inferredTitle, url);
  const category = detectCategory(url);
  let description = snippet || '';

  if (isLowQualitySnippet(description)) {
    description = buildFallbackDescription(url, title, category);
  }

  return {
    url,
    title,
    category,
    description,
    highlightedDescription: highlightMatches(description, query),
    vectorScore: Number(item?.score || 0),
  };
}

/**
 * Measure how many query terms appear in result text fields.
 * @param {{title: string, description: string, url: string}} result
 * @param {string[]} queryTerms
 * @returns {{matched: number, ratio: number}}
 */
function computeCoverageScore(result, queryTerms) {
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

function getIntentBoost(query, url) {
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
 * Score a normalized search result with lexical + semantic + intent signals.
 * @param {{title: string, description: string, url: string, vectorScore: number}} result
 * @param {string} query
 * @param {string[]} queryTerms
 * @param {string[]} intentPaths
 * @returns {{title: string, description: string, url: string, vectorScore: number, score: number, matchCount: number, category: string, highlightedDescription: string}}
 */
export function scoreSearchResult(result, query, queryTerms, intentPaths) {
  const vectorScaled = result.vectorScore * 12;
  const lexicalScore = calculateRelevanceScore(
    {
      ...result,
      score: vectorScaled,
    },
    query,
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

/**
 * Deduplicate results by URL, keeping the strongest candidate.
 * @param {Array<{url: string, score: number, description: string}>} results
 * @returns {Array}
 */
export function dedupeByBestScore(results) {
  const bestByUrl = new Map();

  for (const result of results) {
    const existing = bestByUrl.get(result.url);

    if (!existing) {
      bestByUrl.set(result.url, result);
      continue;
    }

    if (result.score > existing.score) {
      bestByUrl.set(result.url, result);
      continue;
    }

    if (result.score === existing.score) {
      const existingLowQuality = isLowQualitySnippet(existing.description);
      const currentLowQuality = isLowQualitySnippet(result.description);

      if (existingLowQuality && !currentLowQuality) {
        bestByUrl.set(result.url, result);
      }
    }
  }

  return [...bestByUrl.values()];
}

/**
 * Keep variety by limiting category saturation in the final result set.
 * @param {Array<{url: string, category: string}>} results
 * @param {number} topK
 * @returns {Array}
 */
export function balanceByCategory(results, topK) {
  const maxPerCategory = Math.max(2, Math.ceil(topK / 2));
  const categoryCount = {};
  const selected = [];
  const selectedUrls = new Set();

  for (const result of results) {
    const category = result.category || 'Seite';
    const count = categoryCount[category] || 0;
    if (count >= maxPerCategory) {
      continue;
    }

    categoryCount[category] = count + 1;
    selected.push(result);
    selectedUrls.add(result.url);

    if (selected.length >= topK) {
      return selected;
    }
  }

  for (const result of results) {
    if (selectedUrls.has(result.url)) {
      continue;
    }

    selected.push(result);
    if (selected.length >= topK) {
      break;
    }
  }

  return selected;
}
