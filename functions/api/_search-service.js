import {
  buildBlogPath,
  buildProjectAppPath,
  loadBlogPosts,
  loadProjectApps,
} from './_sitemap-data.js';
import {
  buildFallbackDescription,
  chooseBestTitle,
  detectCategory,
  extractTitle,
  normalizeUrl,
} from './_search-url.js';
import { CLEANUP_PATTERNS, HTML_ENTITIES } from './_cleanup-patterns.js';
import { escapeHtml } from './_html-utils.js';
import {
  escapeRegExp,
  normalizeForMatch,
} from '../../content/core/text-utils.js';

export const SEARCH_TIMEOUT_MS = 30000;
export const SEARCH_RESPONSE_CACHE_CONTROL = 'public, max-age=300';
export const SYSTEM_PROMPT = `Du bist der Such-Assistent auf der Website von Abdulkerim Sesli.
Antworte auf Deutsch, professionell, präzise und lösungsorientiert in 2-4 Sätzen.
Binde Links als relative Pfade (z. B. [Galerie](/gallery/)) direkt im Fließtext per Markdown ein.
Verzichte auf Aufzählungslisten, Linkblöcke und Wiederholungen. Formuliere einladend.`;

const TECHNICAL_RESULT_PATHS = new Set([
  '/llms.txt',
  '/llms-full.txt',
  '/ai-index.json',
  '/person.jsonld',
  '/robots.txt',
  '/.well-known/openapi.json',
  '/.well-known/ai-plugin.json',
  '/pages/projekte/apps-config.json',
  '/pages/blog/posts/index.json',
]);
const TECHNICAL_RESULT_PREFIXES = ['/.well-known/', '/api/'];
const ALLOWED_RESULT_PREFIXES = [
  '/about',
  '/abdul-sesli',
  '/blog',
  '/projekte',
  '/gallery',
  '/videos',
  '/contact',
  '/ai-info',
];
const ALLOW_ROOT_RESULT = true;
const QUERY_STOPWORDS = new Set([
  'der',
  'die',
  'das',
  'den',
  'dem',
  'des',
  'ein',
  'eine',
  'einen',
  'einem',
  'einer',
  'und',
  'oder',
  'no',
  'mit',
  'zu',
  'zum',
  'zur',
  'von',
  'auf',
  'im',
  'in',
  'am',
  'an',
  'ist',
  'sind',
  'ich',
  'du',
  'mir',
  'mich',
  'zeige',
  'such',
  'suche',
  'finden',
  'finde',
  'wo',
  'was',
  'wie',
  'mehr',
  'infos',
  'info',
]);
const MAX_QUERY_TOKENS = 8;
const RESULT_DESCRIPTION_MAX_LENGTH = 220;
const AI_SUGGESTION_LIMIT = 6;
const DETERMINISTIC_SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;
const DETERMINISTIC_RESULT_BASE_SCORE = 0.35;
const SEARCH_FACETS = Object.freeze([
  'all',
  'blog',
  'projects',
  'videos',
  'pages',
]);
const STATIC_SEARCH_RESULTS = Object.freeze([
  {
    title: 'Startseite',
    url: '/',
    description:
      'Portfolio-Startseite mit 3D-Visualisierung, Projekten und AI-Funktionen.',
    category: 'Home',
    keywords: ['home', 'portfolio', '3d', 'ai', 'startseite'],
    score: 0.3,
  },
  {
    title: 'Über mich',
    url: '/about/',
    description:
      'Profil, Tech-Stack und beruflicher Hintergrund von Abdulkerim Sesli.',
    category: 'Über mich',
    keywords: ['about', 'profil', 'cv', 'skills', 'tech stack'],
    score: 0.32,
  },
  {
    title: 'Kontakt',
    url: '/contact/',
    description: 'Kontaktformular für Anfragen, Feedback und Zusammenarbeit.',
    category: 'Kontakt',
    keywords: ['kontakt', 'email', 'formular', 'anfrage'],
    score: 0.28,
  },
  {
    title: 'Journal',
    url: '/blog/',
    description: 'Technischer Blog zu Webentwicklung, Performance und AI.',
    category: 'Blog',
    keywords: ['blog', 'journal', 'artikel', 'webentwicklung', 'performance'],
    score: 0.31,
  },
  {
    title: 'Projekte',
    url: '/projekte/',
    description:
      'Übersicht interaktiver Web-Apps, Games, Tools und Experimente.',
    category: 'Projekte',
    keywords: ['projekte', 'apps', 'tools', 'games', 'portfolio'],
    score: 0.31,
  },
  {
    title: 'Videos',
    url: '/videos/',
    description: 'Video-Portfolio mit Tutorials, Motion und Demonstrationen.',
    category: 'Videos',
    keywords: ['videos', 'youtube', 'motion', 'tutorials'],
    score: 0.29,
  },
  {
    title: 'Galerie',
    url: '/gallery/',
    description: 'Fotogalerie mit kuratierten Stills und Serien.',
    category: 'Galerie',
    keywords: ['gallery', 'galerie', 'fotos', 'photography'],
    score: 0.29,
  },
]);
const SNIPPET_METADATA_LABELS = [
  'title',
  'description',
  'excerpt',
  'seoDescription',
  'image',
  'imageAlt',
  'thumbnail',
  'keywords',
  'category',
  'date',
  'file',
  'url',
  'readTime',
  'relatedHome',
  'relatedGallery',
  'relatedVideos',
];

let deterministicSearchCache = null;
let deterministicSearchCacheExpiresAt = 0;
let deterministicSearchCachePromise = null;

function getSearchableKeywordText(item) {
  const keywords = Array.isArray(item?.keywords)
    ? item.keywords
    : typeof item?.keywords === 'string'
      ? item.keywords.split(',')
      : [];

  return keywords
    .map((keyword) => String(keyword || '').trim())
    .filter(Boolean)
    .join(' ');
}

export function withSearchTimeout(promise, ms = SEARCH_TIMEOUT_MS) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), ms),
    ),
  ]);
}

function cleanSnippetText(rawText) {
  let text = String(rawText || '');
  if (!text) return '';

  for (const [entity, replacement] of Object.entries(HTML_ENTITIES)) {
    text = text.replaceAll(entity, replacement);
  }

  text = CLEANUP_PATTERNS.reduce(
    (acc, [pattern, replacement]) => acc.replace(pattern, replacement),
    text,
  );
  text = text.replace(/^\s*---\s*\n[\s\S]*?\n---\s*/m, ' ');
  text = text.replace(/\s+---\s+/g, ' ');
  text = text.replace(
    /\b(?:image|thumbnail|file|url|source|loc)\s*:\s*https?:\/\/\S+/gi,
    ' ',
  );
  text = text.replace(/https?:\/\/\S+/gi, ' ');

  const labelPattern = SNIPPET_METADATA_LABELS.join('|');
  text = text.replace(new RegExp(`\\b(?:${labelPattern})\\s*:`, 'gi'), ' ');
  text = text.replace(/[`*_#]+/g, ' ');
  text = text.replace(/\(\s*[^)]{40,}\)/g, ' ');
  text = text.replace(/\(\s*[^)]*$/g, ' ');
  text = text.replace(/\(\s*\)/g, ' ');
  text = text.replace(/\s+/g, ' ').trim();
  text = text.replace(/^[-,;:.!?|/\\\s]+/, '').trim();

  return text;
}

function trimSnippetLength(raw, maxLength = RESULT_DESCRIPTION_MAX_LENGTH) {
  if (!raw) return '';
  if (raw.length <= maxLength) return raw;

  const truncated = raw.slice(0, maxLength);
  const lastSentenceBreak = Math.max(
    truncated.lastIndexOf('.'),
    truncated.lastIndexOf('!'),
    truncated.lastIndexOf('?'),
  );

  if (lastSentenceBreak > maxLength * 0.7) {
    return truncated.slice(0, lastSentenceBreak + 1).trim();
  }

  return `${truncated.trim()}...`;
}

function extractSnippet(item, maxLength = RESULT_DESCRIPTION_MAX_LENGTH) {
  const mergedContent = Array.isArray(item?.content)
    ? item.content
        .map((chunk) =>
          typeof chunk?.text === 'string' ? chunk.text.trim() : '',
        )
        .filter(Boolean)
        .join(' ')
    : '';

  const fallbackText =
    typeof item?.text === 'string'
      ? item.text
      : typeof item?.description === 'string'
        ? item.description
        : '';

  const raw = cleanSnippetText(mergedContent || fallbackText || '');
  return trimSnippetLength(raw, maxLength);
}

export function extractAiResult(item) {
  const rawPath =
    typeof item?.filename === 'string'
      ? item.filename
      : typeof item?.metadata?.filename === 'string'
        ? item.metadata.filename
        : typeof item?.url === 'string'
          ? item.url
          : '';

  const attrs =
    item?.attributes && typeof item.attributes === 'object'
      ? item.attributes
      : {};

  const url = normalizeUrl(rawPath);
  const fallbackTitle = extractTitle(rawPath, url);
  const title = chooseBestTitle(
    { title: attrs.title || item?.title },
    fallbackTitle,
    url,
  );
  const category =
    typeof attrs.category === 'string' && attrs.category.trim()
      ? attrs.category.trim()
      : detectCategory(url);
  const attrsDescription = trimSnippetLength(
    cleanSnippetText(
      typeof attrs.description === 'string' ? attrs.description : '',
    ),
    RESULT_DESCRIPTION_MAX_LENGTH,
  );
  const description =
    attrsDescription ||
    extractSnippet(item) ||
    buildFallbackDescription(url, title, category);
  const score = Number.isFinite(item?.score) ? Number(item.score) : 0;

  return {
    title,
    url,
    description,
    category,
    score,
  };
}

function hasMarkHighlight(value) {
  return /<mark>[\s\S]*?<\/mark>/i.test(String(value || '').trim());
}

function tokenizeQuery(query) {
  const rawTokens = String(query || '')
    .split(/[^0-9A-Za-zÀ-ÖØ-öø-ÿ]+/g)
    .map((token) => token.trim())
    .filter(Boolean);

  const deduped = [];
  const seen = new Set();
  for (const token of rawTokens) {
    const normalized = normalizeForMatch(token);
    if (normalized.length < 2) continue;
    if (QUERY_STOPWORDS.has(normalized)) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    deduped.push(token);
    if (deduped.length >= MAX_QUERY_TOKENS) break;
  }
  return deduped;
}

function computeKeywordScore(result, queryTokens, normalizedQuery) {
  const title = normalizeForMatch(result?.title || '');
  const category = normalizeForMatch(result?.category || '');
  const url = normalizeForMatch(result?.url || '');
  const description = normalizeForMatch(result?.description || '');
  const keywords = normalizeForMatch(getSearchableKeywordText(result));

  const matchedTerms = [];
  let score = 0;

  for (const rawToken of queryTokens) {
    const token = normalizeForMatch(rawToken);
    let tokenScore = 0;
    if (title.includes(token)) tokenScore += 24;
    if (category.includes(token)) tokenScore += 14;
    if (url.includes(token)) tokenScore += 12;
    if (description.includes(token)) tokenScore += 8;
    if (keywords.includes(token)) tokenScore += 18;
    if (tokenScore > 0) matchedTerms.push(rawToken);
    score += tokenScore;
  }

  if (normalizedQuery) {
    if (title.includes(normalizedQuery)) score += 36;
    if (description.includes(normalizedQuery)) score += 14;
    if (keywords.includes(normalizedQuery)) score += 20;
  }

  score += Math.min(matchedTerms.length * 5, 25);

  return {
    score,
    matchedTerms,
  };
}

function buildHighlightedDescription(description, queryTokens) {
  const source = trimSnippetLength(
    cleanSnippetText(description || ''),
    RESULT_DESCRIPTION_MAX_LENGTH * 2,
  );
  if (!source) return '';
  if (!Array.isArray(queryTokens) || queryTokens.length === 0) return '';

  const normalizedSource = normalizeForMatch(source);
  let firstIndex = -1;
  for (const token of queryTokens) {
    const idx = normalizedSource.indexOf(normalizeForMatch(token));
    if (idx >= 0 && (firstIndex < 0 || idx < firstIndex)) {
      firstIndex = idx;
    }
  }

  let snippet;
  if (firstIndex >= 0 && source.length > RESULT_DESCRIPTION_MAX_LENGTH) {
    const windowSize = RESULT_DESCRIPTION_MAX_LENGTH;
    const start = Math.max(0, firstIndex - Math.floor(windowSize * 0.35));
    const end = Math.min(source.length, start + windowSize);
    const prefix = start > 0 ? '... ' : '';
    const suffix = end < source.length ? ' ...' : '';
    snippet = `${prefix}${source.slice(start, end).trim()}${suffix}`;
  } else {
    snippet = trimSnippetLength(source, RESULT_DESCRIPTION_MAX_LENGTH);
  }

  const escaped = escapeHtml(snippet);
  const safeTokens = queryTokens
    .map((token) => token.trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .slice(0, MAX_QUERY_TOKENS);
  if (safeTokens.length === 0) return '';

  const regex = new RegExp(
    `(${safeTokens.map((token) => escapeRegExp(token)).join('|')})`,
    'gi',
  );
  const highlighted = escaped.replace(regex, '<mark>$1</mark>');

  return highlighted === escaped ? '' : highlighted;
}

function rerankSearchResults(results, query) {
  const queryTokens = tokenizeQuery(query);
  const normalizedQuery = normalizeForMatch(query).replace(/\s+/g, ' ').trim();

  return (Array.isArray(results) ? results : []).map((item) => {
    const semanticScore = Number.isFinite(item?.score) ? Number(item.score) : 0;
    const keyword = computeKeywordScore(item, queryTokens, normalizedQuery);
    const blendedScore = semanticScore * 100 + keyword.score;
    const description = trimSnippetLength(
      cleanSnippetText(item?.description || ''),
      RESULT_DESCRIPTION_MAX_LENGTH,
    );
    const highlightedDescription = buildHighlightedDescription(
      [description, item?.title || '', getSearchableKeywordText(item)]
        .filter(Boolean)
        .join(' '),
      queryTokens,
    );

    return {
      ...item,
      score: blendedScore,
      highlightedDescription,
      description,
    };
  });
}

function isTechnicalResult(url) {
  const normalized = normalizeUrl(url).toLowerCase();
  if (TECHNICAL_RESULT_PATHS.has(normalized)) {
    return true;
  }

  return TECHNICAL_RESULT_PREFIXES.some((prefix) =>
    normalized.startsWith(prefix),
  );
}

function isAllowlistedResult(url) {
  const normalized = normalizeUrl(url).toLowerCase();
  if (ALLOW_ROOT_RESULT && normalized === '/') {
    return true;
  }

  return ALLOWED_RESULT_PREFIXES.some(
    (prefix) =>
      normalized === prefix ||
      normalized.startsWith(`${prefix}/`) ||
      normalized.startsWith(`${prefix}?`),
  );
}

function normalizeResultPathForDedup(rawUrl) {
  const normalized = normalizeUrl(rawUrl);
  if (!normalized) return '';
  if (normalized === '/') return normalized;
  return normalized.replace(/\/+$/, '');
}

function normalizeSearchSummary(summary) {
  const text = String(summary || '')
    .replace(/\r/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return '';
  return trimSnippetLength(text, 320);
}

function buildFallbackAiMessage(resultsCount) {
  if (resultsCount <= 0) {
    return 'Keine passenden Inhalte gefunden.';
  }
  return `Ich habe ${resultsCount} passende Seiten gefunden.`;
}

function normalizeSummaryLinkPath(rawUrl) {
  const normalized = normalizeUrl(rawUrl);
  if (!normalized || normalized === '/') return normalized || '/';
  if (/[?#]/.test(normalized) || /\.[a-z0-9]+$/i.test(normalized)) {
    return normalized;
  }
  return `${normalized}/`;
}

function buildSuggestionEntry(item) {
  const title = String(item?.title || '')
    .replace(/\s+/g, ' ')
    .trim();
  const normalizedUrl = normalizeUrl(item?.url);
  if (!title || !normalizedUrl) return null;
  if (isTechnicalResult(normalizedUrl) || !isAllowlistedResult(normalizedUrl)) {
    return null;
  }
  return {
    title: trimSnippetLength(title, 90),
    url: normalizeSummaryLinkPath(normalizedUrl),
  };
}

function buildDeterministicResult(item) {
  return {
    title: String(item?.title || '').trim(),
    url: String(item?.url || '').trim(),
    description: trimSnippetLength(cleanSnippetText(item?.description || '')),
    category: String(item?.category || '').trim() || detectCategory(item?.url),
    keywords: Array.isArray(item?.keywords) ? item.keywords : [],
    score:
      Number.isFinite(item?.score) && Number(item.score) > 0
        ? Number(item.score)
        : DETERMINISTIC_RESULT_BASE_SCORE,
  };
}

function createEmptyFacetCounts() {
  return {
    all: 0,
    blog: 0,
    projects: 0,
    videos: 0,
    pages: 0,
  };
}

function normalizeSearchFacet(rawFacet) {
  const value = String(rawFacet || '')
    .trim()
    .toLowerCase();
  if (value === 'project' || value === 'projekte') return 'projects';
  if (value === 'video') return 'videos';
  if (value === 'page' || value === 'seiten') return 'pages';
  return SEARCH_FACETS.includes(value) ? value : 'all';
}

function getResultFacet(result) {
  const category = normalizeForMatch(result?.category || '');
  const url = normalizeUrl(result?.url).toLowerCase();

  if (category === 'blog' || url.startsWith('/blog/')) {
    return 'blog';
  }
  if (
    category === 'projekte' ||
    url === '/projekte/' ||
    url.startsWith('/projekte/')
  ) {
    return 'projects';
  }
  if (
    category === 'videos' ||
    url === '/videos/' ||
    url.startsWith('/videos/')
  ) {
    return 'videos';
  }
  return 'pages';
}

function buildFacetCounts(results) {
  const counts = createEmptyFacetCounts();
  const items = Array.isArray(results) ? results : [];

  for (const result of items) {
    const facet = getResultFacet(result);
    counts.all += 1;
    if (facet in counts) {
      counts[facet] += 1;
    }
  }

  return counts;
}

function filterResultsByFacet(results, facet) {
  const normalizedFacet = normalizeSearchFacet(facet);
  const items = Array.isArray(results) ? results : [];
  if (normalizedFacet === 'all') return items;
  return items.filter((result) => getResultFacet(result) === normalizedFacet);
}

function serializeFacetCounts(counts = {}) {
  return SEARCH_FACETS.map((key) => ({
    key,
    count: Math.max(0, Number.parseInt(String(counts?.[key] || 0), 10) || 0),
  }));
}

function buildAiSuggestions(
  query,
  results,
  facet = 'all',
  maxSuggestions = AI_SUGGESTION_LIMIT,
) {
  const limit = Math.max(
    1,
    Number.parseInt(String(maxSuggestions || 0), 10) || 0,
  );
  const suggestions = [];
  const seenUrls = new Set();

  const pushSuggestion = (candidate) => {
    if (suggestions.length >= limit) return;
    const entry = buildSuggestionEntry(candidate);
    if (!entry) return;
    const dedupeKey = entry.url.toLowerCase();
    if (seenUrls.has(dedupeKey)) return;
    seenUrls.add(dedupeKey);
    suggestions.push(entry);
  };

  for (const result of Array.isArray(results) ? results : []) {
    pushSuggestion(result);
    if (suggestions.length >= limit) break;
  }

  if (suggestions.length >= limit) {
    return suggestions;
  }

  const fallbackSeed = STATIC_SEARCH_RESULTS.map((item) =>
    buildDeterministicResult(item),
  );
  const rankedFallback = rerankSearchResults(fallbackSeed, query).sort(
    (a, b) => b.score - a.score,
  );
  const facetedFallback = filterResultsByFacet(rankedFallback, facet);
  const fallbackCandidates =
    facetedFallback.length > 0 ? facetedFallback : rankedFallback;

  for (const candidate of fallbackCandidates) {
    pushSuggestion(candidate);
    if (suggestions.length >= limit) break;
  }

  return suggestions;
}

function buildAllowedResultPathSet(results) {
  return new Set(
    (Array.isArray(results) ? results : [])
      .map((item) => normalizeUrl(item?.url))
      .filter(Boolean),
  );
}

function sanitizeAiSummary(summary, allowedPaths) {
  let removedLinks = false;
  const sanitized = String(summary || '').replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_match, label, rawUrl) => {
      const normalized = normalizeUrl(rawUrl);
      if (allowedPaths.has(normalized)) {
        return `[${label}](${normalizeSummaryLinkPath(normalized)})`;
      }
      removedLinks = true;
      return label;
    },
  );

  return {
    text: normalizeSearchSummary(sanitized),
    removedLinks,
  };
}

function buildGroundedSummary(query, results) {
  const items = Array.isArray(results) ? results.filter(Boolean) : [];
  const compactQuery = String(query || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (items.length === 0) return '';

  const first = items[0];
  const second = items[1];
  const firstLink = `[${first.title}](${normalizeSummaryLinkPath(first.url)})`;

  if (!second) {
    return compactQuery
      ? `Zu "${compactQuery}" passt am ehesten ${firstLink}.`
      : `Am relevantesten ist ${firstLink}.`;
  }

  const secondLink = `[${second.title}](${normalizeSummaryLinkPath(second.url)})`;
  return compactQuery
    ? `Zu "${compactQuery}" sind besonders ${firstLink} und ${secondLink} relevant.`
    : `Besonders relevant sind ${firstLink} und ${secondLink}.`;
}

export async function loadDeterministicSearchDataset(context) {
  const now = Date.now();
  if (deterministicSearchCache && now < deterministicSearchCacheExpiresAt) {
    return deterministicSearchCache;
  }
  if (deterministicSearchCachePromise) {
    return deterministicSearchCachePromise;
  }

  deterministicSearchCachePromise = (async () => {
    const [blogPosts, projectApps] = await Promise.all([
      loadBlogPosts(context).catch(() => []),
      loadProjectApps(context).catch(() => []),
    ]);

    const dataset = [
      ...STATIC_SEARCH_RESULTS,
      ...blogPosts.map((post) =>
        buildDeterministicResult({
          title: post.title,
          url: buildBlogPath(post.id),
          description: post.description,
          category: 'Blog',
          keywords: post.keywords || [],
          score: 0.38,
        }),
      ),
      ...projectApps.map((project) =>
        buildDeterministicResult({
          title: project.title,
          url: buildProjectAppPath(project.name),
          description: project.description,
          category: 'Projekte',
          keywords: [],
          score: 0.34,
        }),
      ),
    ].filter((item) => item.title && item.url);

    deterministicSearchCache = dataset;
    deterministicSearchCacheExpiresAt =
      Date.now() + DETERMINISTIC_SEARCH_CACHE_TTL_MS;

    return dataset;
  })().finally(() => {
    deterministicSearchCachePromise = null;
  });

  return deterministicSearchCachePromise;
}

export function buildDeterministicMatches(candidates, query) {
  const queryTokens = tokenizeQuery(query);
  const normalizedQuery = normalizeForMatch(query).replace(/\s+/g, ' ').trim();

  return (Array.isArray(candidates) ? candidates : [])
    .map((candidate) => {
      const keyword = computeKeywordScore(
        candidate,
        queryTokens,
        normalizedQuery,
      );
      return {
        ...candidate,
        score: Math.max(
          Number(candidate.score) || 0,
          DETERMINISTIC_RESULT_BASE_SCORE,
        ),
        _keywordScore: keyword.score,
      };
    })
    .filter((candidate) => candidate._keywordScore > 0)
    .map(({ _keywordScore, ...candidate }) => candidate);
}

export function resolveSearchInput(request, body = null) {
  const url = new URL(request.url);
  return {
    query: String(
      body?.query ??
        url.searchParams.get('q') ??
        url.searchParams.get('query') ??
        '',
    ).trim(),
    topK:
      body?.topK ??
      url.searchParams.get('topK') ??
      url.searchParams.get('limit'),
    facet:
      body?.facet ??
      url.searchParams.get('facet') ??
      url.searchParams.get('tab'),
  };
}

export function createEmptySearchPayload(facet = 'all') {
  const activeFacet = normalizeSearchFacet(facet);
  return {
    results: [],
    count: 0,
    facet: activeFacet,
    facets: serializeFacetCounts(createEmptyFacetCounts()),
    summary: '',
    aiChat: {
      message: '',
      suggestions: buildAiSuggestions('', [], activeFacet, 4),
    },
  };
}

export function buildSearchPayload({
  aiSummary = '',
  facet = 'all',
  query = '',
  results = [],
  topK = 10,
}) {
  const activeFacet = normalizeSearchFacet(facet);
  const uniqueResultsMap = new Map();

  for (const res of Array.isArray(results) ? results : []) {
    if (!res?.url) continue;
    if (isTechnicalResult(res.url) || !isAllowlistedResult(res.url)) {
      continue;
    }

    const dedupeKey = normalizeResultPathForDedup(res.url);
    if (!dedupeKey) continue;

    if (!uniqueResultsMap.has(dedupeKey)) {
      uniqueResultsMap.set(dedupeKey, res);
      continue;
    }

    const existing = uniqueResultsMap.get(dedupeKey);
    if ((res.score || 0) > (existing?.score || 0)) {
      uniqueResultsMap.set(dedupeKey, res);
    }
  }

  const rerankedResults = rerankSearchResults(
    Array.from(uniqueResultsMap.values()),
    query,
  ).sort((a, b) => b.score - a.score);
  const facetCounts = buildFacetCounts(rerankedResults);
  const facetedResults = filterResultsByFacet(rerankedResults, activeFacet);
  const highlightedResults = facetedResults.filter((item) =>
    hasMarkHighlight(item.highlightedDescription),
  );
  const uniqueResults = (
    highlightedResults.length > 0 ? highlightedResults : facetedResults
  ).slice(0, topK);

  const allowedPaths = buildAllowedResultPathSet(uniqueResults);
  const sanitizedSummary = sanitizeAiSummary(aiSummary, allowedPaths);
  const groundedSummary = buildGroundedSummary(query, uniqueResults);
  const summary =
    sanitizedSummary.text && !sanitizedSummary.removedLinks
      ? sanitizedSummary.text
      : groundedSummary;

  return {
    results: uniqueResults,
    count: uniqueResults.length,
    facet: activeFacet,
    facets: serializeFacetCounts(facetCounts),
    summary,
    aiChat: {
      message: summary || buildFallbackAiMessage(uniqueResults.length),
      suggestions: buildAiSuggestions(query, facetedResults, activeFacet),
    },
  };
}

export function createSearchErrorPayload() {
  return {
    error: 'Search failed',
    results: [],
    count: 0,
    facet: 'all',
    facets: serializeFacetCounts(createEmptyFacetCounts()),
    summary: '',
    aiChat: {
      message:
        'Es gab leider ein technisches Problem bei der Suche. Bitte versuche es später erneut oder nutze die Navigation.',
      suggestions: buildAiSuggestions('', [], 'all', 4),
    },
  };
}
