import { getCorsHeaders, handleOptions } from './_cors.js';
import {
  buildAiSearchRequest,
  clampResults,
  resolveAiSearchConfig,
} from './_ai-search-config.js';
import {
  buildFallbackDescription,
  chooseBestTitle,
  detectCategory,
  extractTitle,
  normalizeUrl,
} from './_search-url.js';
import { CLEANUP_PATTERNS, HTML_ENTITIES } from './_cleanup-patterns.js';

// Configuration
const SEARCH_TIMEOUT_MS = 15000;
const SYSTEM_PROMPT = `Du bist der Such-Assistent auf der Website von Abdulkerim Sesli.
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
  '/blog',
  '/projekte',
  '/gallery',
  '/videos',
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

function withTimeout(promise, ms) {
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

  // Decode a small set of common entities first.
  for (const [entity, replacement] of Object.entries(HTML_ENTITIES)) {
    text = text.replaceAll(entity, replacement);
  }

  // Apply shared snippet cleanup patterns (UI artifacts, JSON-LD, frontmatter).
  text = CLEANUP_PATTERNS.reduce(
    (acc, [pattern, replacement]) => acc.replace(pattern, replacement),
    text,
  );

  // Remove full YAML frontmatter block.
  text = text.replace(/^\s*---\s*\n[\s\S]*?\n---\s*/m, ' ');

  // Remove inline frontmatter separators.
  text = text.replace(/\s+---\s+/g, ' ');

  // Drop metadata URL fields like "image: https://..."
  text = text.replace(
    /\b(?:image|thumbnail|file|url|source|loc)\s*:\s*https?:\/\/\S+/gi,
    ' ',
  );

  // Remove remaining bare URLs.
  text = text.replace(/https?:\/\/\S+/gi, ' ');

  // Remove metadata labels, keep human-readable value.
  const labelPattern = SNIPPET_METADATA_LABELS.join('|');
  text = text.replace(new RegExp(`\\b(?:${labelPattern})\\s*:`, 'gi'), ' ');

  // Strip markdown artifacts and normalize spacing.
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

function extractAiResult(item) {
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

function normalizeForMatch(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasMarkHighlight(value) {
  return /<mark>[\s\S]*?<\/mark>/i.test(String(value || '').trim());
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
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

  const matchedTerms = [];
  let score = 0;

  for (const rawToken of queryTokens) {
    const token = normalizeForMatch(rawToken);
    let tokenScore = 0;
    if (title.includes(token)) tokenScore += 24;
    if (category.includes(token)) tokenScore += 14;
    if (url.includes(token)) tokenScore += 12;
    if (description.includes(token)) tokenScore += 8;
    if (tokenScore > 0) matchedTerms.push(rawToken);
    score += tokenScore;
  }

  if (normalizedQuery) {
    if (title.includes(normalizedQuery)) score += 36;
    if (description.includes(normalizedQuery)) score += 14;
  }

  // Reward broader term coverage.
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
      description,
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

export async function onRequestPost(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request, env);

  try {
    const body = await request.json().catch(() => ({}));
    const query = String(body?.query || '').trim();

    if (!query) {
      return Response.json({ results: [], count: 0 }, { headers: corsHeaders });
    }

    const aiSearchConfig = resolveAiSearchConfig(env);
    const topK = clampResults(
      body?.topK,
      aiSearchConfig.maxResults,
      aiSearchConfig.maxResults,
    );
    const fetchTopK = Math.min(
      aiSearchConfig.maxResults,
      Math.max(topK, Math.min(topK * 2, topK + 8)),
    );

    if (!env.AI || !env.RAG_ID) {
      console.warn('AI or RAG_ID not configured');
      return Response.json(
        { error: 'AI Search is not configured', results: [] },
        { status: 503, headers: corsHeaders },
      );
    }

    // Run AI Search
    const aiSearchRequest = buildAiSearchRequest({
      query,
      maxResults: fetchTopK,
      config: aiSearchConfig,
      systemPrompt: SYSTEM_PROMPT,
      stream: false,
      hybrid: true,
    });

    const searchResponse = await withTimeout(
      env.AI.autorag(env.RAG_ID).aiSearch(aiSearchRequest),
      SEARCH_TIMEOUT_MS,
    );

    let results = [];
    if (searchResponse?.data && Array.isArray(searchResponse.data)) {
      results = searchResponse.data.map(extractAiResult);
    }

    // Deduplicate results based on URL
    const uniqueResultsMap = new Map();
    for (const res of results) {
      if (isTechnicalResult(res.url) || !isAllowlistedResult(res.url)) {
        continue;
      }

      const dedupeKey = normalizeResultPathForDedup(res.url);
      if (!dedupeKey) continue;

      if (!uniqueResultsMap.has(dedupeKey)) {
        uniqueResultsMap.set(dedupeKey, res);
      } else {
        const existing = uniqueResultsMap.get(dedupeKey);
        if (res.score > existing.score) {
          uniqueResultsMap.set(dedupeKey, res);
        }
      }
    }
    const uniqueResults = rerankSearchResults(
      Array.from(uniqueResultsMap.values()),
      query,
    )
      .filter((item) => hasMarkHighlight(item.highlightedDescription))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    const aiSummary = normalizeSearchSummary(searchResponse?.response || '');
    const aiMessage = aiSummary || buildFallbackAiMessage(uniqueResults.length);

    return Response.json(
      {
        results: uniqueResults,
        count: uniqueResults.length,
        summary: aiSummary,
        aiChat: {
          message: aiMessage || buildFallbackAiMessage(uniqueResults.length),
          suggestions: [],
        },
      },
      {
        headers: { ...corsHeaders, 'Cache-Control': 'public, max-age=300' },
      },
    );
  } catch (error) {
    console.error('Search error:', error);
    return Response.json(
      {
        error: 'Search failed',
        results: [],
        count: 0,
        summary: '',
        aiChat: {
          message:
            'Es gab leider ein technisches Problem bei der Suche. Bitte versuche es später erneut oder nutze die Navigation.',
          suggestions: [],
        },
      },
      { status: 500, headers: corsHeaders },
    );
  }
}

export const onRequestOptions = handleOptions;
