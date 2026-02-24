/**
 * Search Query Utilities
 * Parsing, expansion, and regex compilation.
 */

// ----------------------------------------------------------------------------
// PARSING & NORMALIZATION
// ----------------------------------------------------------------------------

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

/**
 * Compile regexes for query terms to avoid recompilation in loops.
 * @param {string[]} queryTerms
 * @returns {RegExp[]}
 */
export function compileQueryRegexes(queryTerms) {
  if (!queryTerms || queryTerms.length === 0) return [];

  const boundaryRe = (term) =>
    new RegExp(
      `(^|[\\s/\\-_.])${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
      'i',
    );

  return queryTerms.map(boundaryRe);
}

// ----------------------------------------------------------------------------
// SYNONYM EXPANSION
// ----------------------------------------------------------------------------

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
