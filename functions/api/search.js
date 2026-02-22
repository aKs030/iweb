/**
 * Cloudflare Pages Function - POST /api/search
 * Primary: Cloudflare AI Search (AutoRAG)
 * Secondary: deterministic route/app fallback for missing index coverage
 * @version 17.0.0
 */

import { ROUTES } from '../../content/config/routes-config.js';
import { getCorsHeaders, handleOptions } from './_cors.js';
import {
  expandQuery,
  parsePositiveInteger,
  clamp,
  toQueryTerms,
  getIntentPaths,
  isIntentPathMatch,
  toSearchResult,
  scoreSearchResult,
  dedupeByBestScore,
  balanceByCategory,
  highlightMatches,
} from './_search-utils.js';

const SEARCH_SYSTEM_PROMPT =
  'Du bist ein Suchassistent fuer abdulkerimsesli.de. Fasse Suchergebnisse in 1-2 praegnanten Saetzen zusammen (max. 120 Zeichen). Fokus auf konkrete Inhalte, keine generischen Aussagen.';

const PRIMARY_SEARCH_TIMEOUT_MS = 4200;
const SECONDARY_SEARCH_TIMEOUT_MS = 1200;
const SECONDARY_MAX_RESULTS = 12;
const INTENT_MAX_RESULTS = 10;
const FAST_INTENT_PATHS = new Set([
  '/about',
  '/contact',
  '/datenschutz',
  '/impressum',
]);

const ROUTE_FALLBACK_PATHS = [
  '/',
  '/about/',
  '/contact/',
  '/datenschutz/',
  '/impressum/',
  '/projekte/',
  '/blog/',
  '/gallery/',
  '/videos/',
  '/abdul-sesli/',
];
const PROJECT_APPS_PATH = '/pages/projekte/apps-config.json';
const APP_FALLBACK_CACHE_TTL_MS = 5 * 60 * 1000;
let cachedAppFallbackEntries = [];
let cachedAppFallbackExpiresAt = 0;
let appFallbackLoadPromise = null;

function normalizeRoutePath(path) {
  if (!path || path === '/') return '/';
  return path.endsWith('/') ? path.slice(0, -1) : path;
}

function toRouteMeta(path) {
  if (path === '/') {
    return ROUTES.default || {};
  }

  const key = path.endsWith('/') ? path : `${path}/`;
  return ROUTES[key] || {};
}

function cleanRouteTitle(rawTitle, fallback = 'Seite') {
  const raw = String(rawTitle || '').trim();
  if (!raw) return fallback;

  const primary = raw.split('|')[0].trim();
  return primary || raw || fallback;
}

function detectCategoryFromUrl(url) {
  if (url.includes('/projekte')) return 'Projekte';
  if (url.includes('/blog')) return 'Blog';
  if (url.includes('/gallery')) return 'Galerie';
  if (url.includes('/videos')) return 'Videos';
  if (url.includes('/about')) return 'Ueber mich';
  if (url.includes('/contact')) return 'Kontakt';
  if (url === '/') return 'Home';
  return 'Seite';
}

function buildRouteFallbackEntries() {
  return ROUTE_FALLBACK_PATHS.map((path) => {
    const meta = toRouteMeta(path);
    const url = normalizeRoutePath(path);
    const title = cleanRouteTitle(
      meta.title,
      url === '/' ? 'Startseite' : 'Seite',
    );
    const description =
      String(meta.description || '').trim() ||
      `${title} · ${detectCategoryFromUrl(url)}`;

    return {
      url,
      title,
      category: detectCategoryFromUrl(url),
      description,
      keywords: [url, title, description],
    };
  });
}

const ROUTE_FALLBACK_ENTRIES = buildRouteFallbackEntries();

function formatSlugTitle(value, fallback = 'Projekt App') {
  const raw = String(value || '').trim();
  if (!raw) return fallback;

  return raw
    .replace(/[_+]/g, '-')
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function toAppFallbackEntry(app) {
  const name = String(app?.name || '').trim();
  if (!name) return null;

  const title = formatSlugTitle(app?.title || name);
  const description =
    String(app?.description || '').trim() ||
    `${title} · Interaktive Projekt-App mit eigenem Funktionsumfang.`;
  const tags = Array.isArray(app?.tags)
    ? app.tags.map((tag) => String(tag).trim()).filter(Boolean)
    : [];

  return {
    url: `/projekte/?app=${encodeURIComponent(name)}`,
    title,
    category: 'Projekte',
    description,
    keywords: [name, title, description, ...tags],
  };
}

async function loadAppFallbackEntries(context) {
  const now = Date.now();
  if (cachedAppFallbackEntries.length > 0 && cachedAppFallbackExpiresAt > now) {
    return cachedAppFallbackEntries;
  }

  if (appFallbackLoadPromise) {
    return appFallbackLoadPromise;
  }

  appFallbackLoadPromise = (async () => {
    try {
      if (!context.env?.ASSETS) {
        return cachedAppFallbackEntries;
      }

      const response = await context.env.ASSETS.fetch(
        new URL(PROJECT_APPS_PATH, context.request.url),
      );

      if (!response.ok) {
        return cachedAppFallbackEntries;
      }

      const payload = await response.json();
      const apps = Array.isArray(payload?.apps) ? payload.apps : [];
      const entries = apps.map(toAppFallbackEntry).filter(Boolean);

      if (entries.length > 0) {
        cachedAppFallbackEntries = entries;
        cachedAppFallbackExpiresAt = Date.now() + APP_FALLBACK_CACHE_TTL_MS;
      }

      return cachedAppFallbackEntries;
    } catch {
      return cachedAppFallbackEntries;
    } finally {
      appFallbackLoadPromise = null;
    }
  })();

  return appFallbackLoadPromise;
}

async function getFallbackEntries(context, includeApps = true) {
  if (!includeApps) {
    return ROUTE_FALLBACK_ENTRIES;
  }

  const appEntries = await loadAppFallbackEntries(context);
  if (!appEntries.length) {
    return ROUTE_FALLBACK_ENTRIES;
  }

  const merged = [...ROUTE_FALLBACK_ENTRIES];
  const seenUrls = new Set(merged.map((entry) => entry.url));

  for (const entry of appEntries) {
    if (seenUrls.has(entry.url)) continue;
    seenUrls.add(entry.url);
    merged.push(entry);
  }

  return merged;
}

function withTimeout(promise, timeoutMs, timeoutValue = null) {
  let timeoutId;

  const timeoutPromise = new Promise((resolve) => {
    timeoutId = setTimeout(() => resolve(timeoutValue), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

async function runAiSearch(
  aiBinding,
  ragId,
  query,
  maxNumResults,
  rewriteQuery,
) {
  return aiBinding.autorag(ragId).aiSearch({
    query,
    max_num_results: maxNumResults,
    rewrite_query: rewriteQuery,
    stream: false,
    system_prompt: SEARCH_SYSTEM_PROMPT,
  });
}

function scoreFallbackEntry(entry, queryLower, queryTerms, intentPaths) {
  const haystack =
    `${entry.title} ${entry.description} ${entry.url} ${(entry.keywords || []).join(' ')}`
      .toLowerCase()
      .trim();

  let score = 0;

  if (queryLower && haystack.includes(queryLower)) {
    score += 14;
  }

  for (const term of queryTerms) {
    if (!term) continue;
    if (haystack.includes(term)) {
      score += term.length >= 5 ? 4 : 3;
    }
  }

  if (
    queryTerms.length > 1 &&
    queryTerms.every((term) => haystack.includes(term))
  ) {
    score += 6;
  }

  if (intentPaths.length > 0 && isIntentPathMatch(entry.url, intentPaths)) {
    score += 12;
  }

  if (intentPaths.length === 1) {
    const primaryIntentPath = intentPaths[0];

    if (entry.url === primaryIntentPath) {
      score += 8;
    }

    if (
      entry.url.includes('?app=') &&
      primaryIntentPath === '/projekte' &&
      !/\b(app|apps|tool|game|spiel|weather|wetter|todo|quiz|snake|memory|timer|typing|calculator|passwort|password|color|paint|pong)\b/i.test(
        queryLower,
      )
    ) {
      score -= 2;
    }
  }

  if (
    entry.url.startsWith('/projekte/?app=') &&
    /\b(app|apps|tool|game|spiel|projekt|projekte)\b/i.test(queryLower)
  ) {
    score += 2;
  }

  return score;
}

function buildFallbackResults(
  fallbackEntries,
  query,
  topK,
  intentPaths,
  excludeUrls = new Set(),
) {
  const queryLower = String(query || '')
    .toLowerCase()
    .trim();
  const queryTerms = toQueryTerms(queryLower);
  let candidateEntries = fallbackEntries.filter(
    (entry) => !excludeUrls.has(entry.url),
  );

  // For single-intent queries, keep fallback strict to the intended path.
  if (intentPaths.length === 1) {
    const strictIntentEntries = candidateEntries.filter((entry) =>
      isIntentPathMatch(entry.url, intentPaths),
    );

    if (strictIntentEntries.length > 0) {
      candidateEntries = strictIntentEntries;
    }
  }

  let scored = candidateEntries
    .map((entry) => ({
      ...entry,
      score: scoreFallbackEntry(entry, queryLower, queryTerms, intentPaths),
      source: 'route-fallback',
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0 && intentPaths.length === 1) {
    scored = fallbackEntries
      .filter(
        (entry) =>
          !excludeUrls.has(entry.url) &&
          isIntentPathMatch(entry.url, intentPaths),
      )
      .map((entry) => ({
        ...entry,
        score: 10,
        source: 'route-fallback',
      }))
      .sort((a, b) => b.score - a.score);
  }

  return scored.slice(0, topK).map((entry) => ({
    url: entry.url,
    title: entry.title,
    category: entry.category,
    description: entry.description,
    highlightedDescription: highlightMatches(entry.description, query),
    score: entry.score,
    source: entry.source,
  }));
}

function mergeResults(aiResults, fallbackResults, topK) {
  const merged = [];
  const seenUrls = new Set();

  for (const result of aiResults) {
    if (seenUrls.has(result.url)) continue;
    seenUrls.add(result.url);
    merged.push(result);
  }

  for (const fallback of fallbackResults) {
    if (seenUrls.has(fallback.url)) continue;
    seenUrls.add(fallback.url);
    merged.push(fallback);
  }

  return merged
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
    .slice(0, topK);
}

function toPlainText(value) {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncateText(value, maxLength = 220) {
  const text = toPlainText(value);
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 1).trim()}...`;
}

function buildSearchChatMessage(query, results, aiSummary = '') {
  const summaryCandidate = truncateText(aiSummary, 240);

  if (
    summaryCandidate &&
    !/^\d+\s+Ergebnis(?:se)?\s+fuer\s+"/i.test(summaryCandidate)
  ) {
    return summaryCandidate;
  }

  const safeQuery = truncateText(query, 80) || 'deine Suche';
  const topTitles = results
    .slice(0, 3)
    .map((item) => truncateText(item?.title, 48))
    .filter(Boolean);

  if (results.length === 0) {
    return `Ich habe aktuell keine direkten Treffer fuer "${safeQuery}" gefunden. Versuche einen praeziseren Begriff.`;
  }

  if (results.length === 1) {
    return `Zu "${safeQuery}" passt besonders "${topTitles[0] || 'dieser Inhalt'}".`;
  }

  if (topTitles.length >= 2) {
    return `Zu "${safeQuery}" passen ${results.length} Treffer, unter anderem "${topTitles[0]}" und "${topTitles[1]}".`;
  }

  return `Ich habe ${results.length} passende Treffer fuer "${safeQuery}" gefunden.`;
}

function buildSearchChatPayload(query, results, aiSummary, source) {
  const message = buildSearchChatMessage(query, results, aiSummary);
  if (!message) return undefined;

  return {
    message,
    source: source || 'search',
    references: results.slice(0, 3).map((result) => ({
      title: result.title,
      url: result.url,
    })),
  };
}

export async function onRequestPost(context) {
  const request = context.request;
  const env = context.env || {};
  const corsHeaders = getCorsHeaders(request, env);

  try {
    const body = await request.json().catch(() => ({}));
    const query = String(body?.query || '').trim();

    if (!query) {
      return new Response(JSON.stringify({ results: [], count: 0 }), {
        headers: corsHeaders,
      });
    }

    const topK = clamp(
      parsePositiveInteger(body?.topK) ??
        parsePositiveInteger(env.MAX_SEARCH_RESULTS) ??
        10,
      1,
      25,
    );

    const intentPaths = getIntentPaths(query);
    const quickTerms = toQueryTerms(query);

    // Fast-path for clear navigation intents to avoid unnecessary AI latency.
    if (
      intentPaths.length === 1 &&
      FAST_INTENT_PATHS.has(intentPaths[0]) &&
      quickTerms.length <= 4
    ) {
      const fallbackOnly = buildFallbackResults(
        ROUTE_FALLBACK_ENTRIES,
        query,
        topK,
        intentPaths,
      );
      const cleanFallback = fallbackOnly.map(
        ({ score: _score, source: _source, ...rest }) => rest,
      );

      return new Response(
        JSON.stringify({
          results: cleanFallback,
          count: cleanFallback.length,
          query,
          source: 'route-fallback-fast',
          summary: `${cleanFallback.length} ${cleanFallback.length === 1 ? 'Ergebnis' : 'Ergebnisse'} fuer "${query}"`,
          aiChat: buildSearchChatPayload(
            query,
            cleanFallback,
            '',
            'route-fallback-fast',
          ),
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Cache-Control': 'public, max-age=300',
          },
        },
      );
    }

    if (!env.AI || typeof env.AI.autorag !== 'function') {
      const fallbackEntries = await getFallbackEntries(context, true);
      const fallbackOnly = buildFallbackResults(
        fallbackEntries,
        query,
        topK,
        intentPaths,
      );
      const cleanFallback = fallbackOnly.map(
        ({ score: _score, source: _source, ...rest }) => rest,
      );

      return new Response(
        JSON.stringify({
          results: cleanFallback,
          count: cleanFallback.length,
          query,
          source: 'route-fallback-only',
          summary: `${cleanFallback.length} ${cleanFallback.length === 1 ? 'Ergebnis' : 'Ergebnisse'} fuer "${query}"`,
          aiChat: buildSearchChatPayload(
            query,
            cleanFallback,
            '',
            'route-fallback-only',
          ),
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Cache-Control': 'public, max-age=300',
          },
        },
      );
    }

    const candidateCount = clamp(Math.max(topK * 3, 15), 15, 36);
    const expandedQuery = expandQuery(query);
    const ragId = env.RAG_ID || 'wispy-pond-1055';
    const fallbackEntriesPromise = getFallbackEntries(context, true);

    const secondaryPromises = [];
    const shouldRunPreciseQuery =
      expandedQuery !== query && intentPaths.length === 0;

    if (shouldRunPreciseQuery) {
      secondaryPromises.push(
        withTimeout(
          runAiSearch(
            env.AI,
            ragId,
            query,
            Math.min(candidateCount, SECONDARY_MAX_RESULTS),
            false,
          ).catch(() => null),
          SECONDARY_SEARCH_TIMEOUT_MS,
          null,
        ),
      );
    }

    if (intentPaths.length > 0) {
      secondaryPromises.push(
        withTimeout(
          runAiSearch(
            env.AI,
            ragId,
            `${query} ${intentPaths.join(' ')}`,
            Math.min(candidateCount, INTENT_MAX_RESULTS),
            false,
          ).catch(() => null),
          SECONDARY_SEARCH_TIMEOUT_MS,
          null,
        ),
      );
    }

    const [primarySearchData, ...secondarySearchData] = await Promise.all([
      withTimeout(
        runAiSearch(env.AI, ragId, expandedQuery, candidateCount, true).catch(
          () => null,
        ),
        PRIMARY_SEARCH_TIMEOUT_MS,
        null,
      ),
      ...secondaryPromises,
    ]);

    const additionalItems = secondarySearchData.flatMap(
      (result) => result?.data || [],
    );
    const allAiItems = [...(primarySearchData?.data || []), ...additionalItems];

    const queryTerms = toQueryTerms(query);
    const scoredResults = allAiItems
      .map((item) => toSearchResult(item, query))
      .filter((result) => Boolean(result.url && result.title))
      .map((result) =>
        scoreSearchResult(result, query, queryTerms, intentPaths),
      );

    const uniqueResults = dedupeByBestScore(scoredResults).sort(
      (a, b) => b.score - a.score,
    );

    const bestScore = uniqueResults[0]?.score ?? 0;
    const minAcceptScore = Math.max(4, bestScore * 0.25);

    let filteredResults = uniqueResults.filter((result) => {
      if (result.matchCount > 0) {
        return true;
      }

      const semanticThreshold = queryTerms.length <= 1 ? 0.72 : 0.78;
      const scoreBuffer = queryTerms.length <= 1 ? 3 : 5;

      return (
        result.vectorScore >= semanticThreshold &&
        result.score >= minAcceptScore + scoreBuffer
      );
    });

    if (filteredResults.length === 0) {
      filteredResults = uniqueResults.filter((result) => result.matchCount > 0);
    }

    if (intentPaths.length > 0) {
      const alignedResults = filteredResults.filter((result) =>
        isIntentPathMatch(result.url, intentPaths),
      );

      if (alignedResults.length > 0) {
        if (intentPaths.length === 1) {
          filteredResults = alignedResults;
        } else {
          const nonAlignedResults = filteredResults.filter(
            (result) => !isIntentPathMatch(result.url, intentPaths),
          );
          const remainingSlots = Math.max(0, topK - alignedResults.length);
          filteredResults = [
            ...alignedResults,
            ...nonAlignedResults.slice(0, remainingSlots),
          ];
        }
      } else if (intentPaths.length === 1) {
        filteredResults = [];
      }
    }

    const balancedResults = balanceByCategory(filteredResults, topK).map(
      ({ vectorScore: _vectorScore, matchCount: _matchCount, ...rest }) => ({
        ...rest,
        source: 'ai',
      }),
    );

    const fallbackEntries = await fallbackEntriesPromise;
    const fallbackResults = buildFallbackResults(
      fallbackEntries,
      query,
      topK,
      intentPaths,
      new Set(balancedResults.map((result) => result.url)),
    );

    const mergedResults = mergeResults(balancedResults, fallbackResults, topK);
    const usedFallback = mergedResults.some(
      (result) => result.source === 'route-fallback',
    );
    const aiSummary = primarySearchData?.response
      ? truncateText(primarySearchData.response, 240)
      : '';

    const cleanResults = mergedResults.map(
      ({ score: _score, source: _source, ...rest }) => rest,
    );

    const responseData = {
      results: cleanResults,
      summary: aiSummary
        ? aiSummary.substring(0, 150)
        : `${cleanResults.length} ${cleanResults.length === 1 ? 'Ergebnis' : 'Ergebnisse'} fuer "${query}"`,
      count: cleanResults.length,
      query,
      expandedQuery: expandedQuery !== query ? expandedQuery : undefined,
      source: usedFallback
        ? 'cloudflare-ai-search+fallback'
        : 'cloudflare-ai-search',
      aiChat: buildSearchChatPayload(
        query,
        cleanResults,
        aiSummary,
        usedFallback ? 'cloudflare-ai-search+fallback' : 'cloudflare-ai-search',
      ),
    };

    return new Response(JSON.stringify(responseData), {
      headers: {
        ...corsHeaders,
        'Cache-Control': 'public, max-age=300',
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: 'Search failed',
        message: error.message,
        results: [],
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Cache-Control': 'no-store',
        },
      },
    );
  }
}

export const onRequestOptions = handleOptions;
