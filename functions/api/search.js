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

// Configuration
const SEARCH_TIMEOUT_MS = 15000;
const SYSTEM_PROMPT = `Du bist der AI-Assistent der Website von Abdulkerim Sesli. Antworte auf Fragen professionell und auf Deutsch basierend auf den gefundenen Inhalten. Fasse die Inhalte kurz und informativ zusammen.`;
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
const ALLOWED_RESULT_PREFIXES = ['/about', '/blog', '/projekte'];
const ALLOW_ROOT_RESULT = true;

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), ms),
    ),
  ]);
}

function extractSnippet(item, maxLength = 180) {
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

  const raw = (mergedContent || fallbackText || '').replace(/\s+/g, ' ').trim();
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
  const description =
    (typeof attrs.description === 'string' ? attrs.description.trim() : '') ||
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
      maxResults: topK,
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

      if (!uniqueResultsMap.has(res.url)) {
        uniqueResultsMap.set(res.url, res);
      } else {
        const existing = uniqueResultsMap.get(res.url);
        if (res.score > existing.score) {
          uniqueResultsMap.set(res.url, res);
        }
      }
    }
    const uniqueResults = Array.from(uniqueResultsMap.values()).sort(
      (a, b) => b.score - a.score,
    );

    const aiSummary = searchResponse?.response || '';

    return Response.json(
      {
        results: uniqueResults,
        count: uniqueResults.length,
        summary: aiSummary,
        aiChat: {
          message:
            aiSummary ||
            (uniqueResults.length > 0
              ? `Hier sind ${uniqueResults.length} passende Ergebnisse gefunden.`
              : 'Keine passenden Inhalte gefunden.'),
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
      { error: 'Search failed', results: [] },
      { status: 500, headers: corsHeaders },
    );
  }
}

export const onRequestOptions = handleOptions;
