/**
 * Cloudflare Pages Function - POST /api/search
 * Primary: Cloudflare AI Search (AutoRAG)
 * Secondary: deterministic route/app fallback for missing index coverage
 * @version 18.0.0
 */

import { ROUTES } from '../../content/config/routes-config.js';
import { getCorsHeaders, handleOptions } from './_cors.js';
import {
  expandQuery,
  parsePositiveInteger,
  clamp,
  toQueryTerms,
  compileQueryRegexes,
} from './_search-query.js';
import {
  isIntentPathMatch,
  getIntentPaths,
  scoreSearchResult,
} from './_search-scoring.js';
import {
  toSearchResult,
  dedupeByBestScore,
  balanceByCategory,
} from './_search-results.js';
import { highlightMatches, truncateText } from './_search-content.js';

import {
  SEARCH_SYSTEM_PROMPT,
  FAST_INTENT_PATHS,
  ROUTE_FALLBACK_PATHS,
  DEFAULT_NO_RESULT_SUGGESTIONS,
  INTENT_FALLBACK_SUGGESTIONS,
} from './_search-data.js';
import {
  buildBlogPath,
  buildProjectAppPath,
  loadBlogPosts,
  loadProjectApps,
} from './_sitemap-data.js';

const PRIMARY_SEARCH_TIMEOUT_MS = 4200;
const SECONDARY_SEARCH_TIMEOUT_MS = 1200;
const SECONDARY_MAX_RESULTS = 12;
const INTENT_MAX_RESULTS = 10;

const DYNAMIC_FALLBACK_CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_CHAT_SUGGESTIONS = 3;

let cachedDynamicFallbackEntries = [];
let cachedDynamicFallbackExpiresAt = 0;
let dynamicFallbackLoadPromise = null;

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
    url: buildProjectAppPath(name),
    title,
    category: 'Projekte',
    description,
    keywords: [name, title, description, ...tags],
  };
}

function toBlogFallbackEntry(post) {
  const id = String(post?.id || '').trim();
  if (!id) return null;

  const title = truncateText(
    post?.title || formatSlugTitle(id, 'Blog Artikel'),
    80,
  );
  const description =
    String(post?.description || '').trim() ||
    `${title} · Technischer Blogbeitrag mit Praxisbezug.`;
  const keywords = Array.isArray(post?.keywords)
    ? post.keywords.map((keyword) => String(keyword).trim()).filter(Boolean)
    : [];

  return {
    url: buildBlogPath(id),
    title,
    category: 'Blog',
    description,
    keywords: [id, title, description, ...keywords],
  };
}

async function loadDynamicFallbackEntries(context) {
  const now = Date.now();
  if (
    cachedDynamicFallbackEntries.length > 0 &&
    cachedDynamicFallbackExpiresAt > now
  ) {
    return cachedDynamicFallbackEntries;
  }

  if (dynamicFallbackLoadPromise) {
    return dynamicFallbackLoadPromise;
  }

  dynamicFallbackLoadPromise = (async () => {
    try {
      const [apps, blogPosts] = await Promise.all([
        loadProjectApps(context),
        loadBlogPosts(context),
      ]);
      const entries = [
        ...apps.map(toAppFallbackEntry),
        ...blogPosts.map(toBlogFallbackEntry),
      ].filter(Boolean);
      const deduped = [];
      const seen = new Set();
      for (const entry of entries) {
        if (seen.has(entry.url)) continue;
        seen.add(entry.url);
        deduped.push(entry);
      }

      if (deduped.length > 0) {
        cachedDynamicFallbackEntries = deduped;
        cachedDynamicFallbackExpiresAt =
          Date.now() + DYNAMIC_FALLBACK_CACHE_TTL_MS;
      }

      return cachedDynamicFallbackEntries;
    } catch {
      return cachedDynamicFallbackEntries;
    } finally {
      dynamicFallbackLoadPromise = null;
    }
  })();

  return dynamicFallbackLoadPromise;
}

async function getFallbackEntries(context, includeDynamic = true) {
  if (!includeDynamic) {
    return ROUTE_FALLBACK_ENTRIES;
  }

  const dynamicEntries = await loadDynamicFallbackEntries(context);
  if (!dynamicEntries.length) {
    return ROUTE_FALLBACK_ENTRIES;
  }

  const merged = [...ROUTE_FALLBACK_ENTRIES];
  const seenUrls = new Set(merged.map((entry) => entry.url));

  for (const entry of dynamicEntries) {
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
  // Use 'hybrid: true' for modern vector search with keyword boosting if supported by binding
  const options = {
    query,
    max_num_results: maxNumResults,
    rewrite_query: rewriteQuery,
    stream: false,
    system_prompt: SEARCH_SYSTEM_PROMPT,
    // Enable hybrid search if supported by the binding (assumed 'modern' context)
    // Note: Cloudflare's aiSearch API behavior depends on the specific model/binding version.
    // Explicitly requesting hybrid search can improve relevance "without much fallback".
    hybrid: true,
  };

  return aiBinding.autorag(ragId).aiSearch(options);
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

function normalizeSuggestion(item) {
  const title = truncateText(item?.title, 56);
  let url = String(item?.url || '').trim();

  if (!title || !url) return null;

  if (!url.startsWith('/')) {
    try {
      const parsed = new URL(url);
      url = `${parsed.pathname}${parsed.search}`;
    } catch {
      url = `/${url.replace(/^\/+/, '')}`;
    }
  }

  return { title, url };
}

function addSuggestion(list, seenUrls, item) {
  const normalized = normalizeSuggestion(item);
  if (!normalized) return;
  if (seenUrls.has(normalized.url)) return;

  seenUrls.add(normalized.url);
  list.push(normalized);
}

function buildNoResultSuggestions({
  query,
  intentPaths,
  aiCandidates,
  fallbackEntries,
}) {
  const suggestions = [];
  const seenUrls = new Set();

  for (const path of intentPaths) {
    const fallbackFromIntent =
      fallbackEntries.find((entry) => entry.url === path) ||
      fallbackEntries.find((entry) => entry.url.startsWith(`${path}?`)) ||
      INTENT_FALLBACK_SUGGESTIONS[path];

    addSuggestion(suggestions, seenUrls, fallbackFromIntent);
  }

  for (const candidate of aiCandidates) {
    const semanticStrong = Number(candidate?.vectorScore || 0) >= 0.62;
    const lexicalStrong = Number(candidate?.matchCount || 0) > 0;
    if (!semanticStrong && !lexicalStrong) continue;

    addSuggestion(suggestions, seenUrls, candidate);
    if (suggestions.length >= MAX_CHAT_SUGGESTIONS) {
      break;
    }
  }

  const lexicalCandidates = buildFallbackResults(
    fallbackEntries,
    query,
    MAX_CHAT_SUGGESTIONS * 2,
    intentPaths,
  );

  for (const item of lexicalCandidates) {
    addSuggestion(suggestions, seenUrls, item);
    if (suggestions.length >= MAX_CHAT_SUGGESTIONS) {
      break;
    }
  }

  if (suggestions.length < MAX_CHAT_SUGGESTIONS) {
    for (const item of DEFAULT_NO_RESULT_SUGGESTIONS) {
      addSuggestion(suggestions, seenUrls, item);
      if (suggestions.length >= MAX_CHAT_SUGGESTIONS) {
        break;
      }
    }
  }

  return suggestions.slice(0, MAX_CHAT_SUGGESTIONS);
}

function buildSearchChatMessage(
  query,
  results,
  aiSummary = '',
  suggestions = [],
) {
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
    if (suggestions.length > 0) {
      const suggestionText = suggestions
        .slice(0, 2)
        .map((item) => `"${item.title}"`)
        .join(' oder ');

      return `Ich habe keine direkten Treffer fuer "${safeQuery}" gefunden. Schau dir als Vorschlag ${suggestionText} an oder formuliere die Suche etwas genauer.`;
    }

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

function buildSearchChatPayload(
  query,
  results,
  aiSummary,
  source,
  suggestions = [],
) {
  const normalizedSuggestions = suggestions
    .map((item) => normalizeSuggestion(item))
    .filter(Boolean)
    .slice(0, MAX_CHAT_SUGGESTIONS);

  const message = buildSearchChatMessage(
    query,
    results,
    aiSummary,
    normalizedSuggestions,
  );
  if (!message) return undefined;

  return {
    message,
    source: source || 'search',
    references: results.slice(0, 3).map((result) => ({
      title: result.title,
      url: result.url,
    })),
    suggestions: normalizedSuggestions,
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
      const noResultSuggestions =
        cleanFallback.length === 0
          ? buildNoResultSuggestions({
              query,
              intentPaths,
              aiCandidates: [],
              fallbackEntries: ROUTE_FALLBACK_ENTRIES,
            })
          : [];

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
            noResultSuggestions,
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
      const noResultSuggestions =
        cleanFallback.length === 0
          ? buildNoResultSuggestions({
              query,
              intentPaths,
              aiCandidates: [],
              fallbackEntries,
            })
          : [];

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
            noResultSuggestions,
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
    const queryRegexes = compileQueryRegexes(queryTerms);

    const scoredResults = allAiItems
      .map((item) => toSearchResult(item, query))
      .filter((result) => Boolean(result.url && result.title))
      .map((result) =>
        scoreSearchResult(result, query, queryTerms, intentPaths, queryRegexes),
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
    const noResultSuggestions =
      cleanResults.length === 0
        ? buildNoResultSuggestions({
            query,
            intentPaths,
            aiCandidates: uniqueResults,
            fallbackEntries,
          })
        : [];

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
        noResultSuggestions,
      ),
    };

    return new Response(JSON.stringify(responseData), {
      headers: {
        ...corsHeaders,
        'Cache-Control': 'public, max-age=300',
      },
    });
  } catch (error) {
    console.error('Search API error:', error);
    return new Response(
      JSON.stringify({
        error: 'Search failed',
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
