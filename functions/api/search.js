/**
 * Cloudflare Pages Function - POST /api/search
 * AI Search using Cloudflare AI Search Beta via Workers Binding
 * Cloudflare-only mode with enhanced ranking and relevance filtering
 * @version 16.1.0
 */

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
} from './_search-utils.js';

const SEARCH_SYSTEM_PROMPT =
  'Du bist ein Suchassistent für abdulkerimsesli.de. Fasse die Suchergebnisse in 1-2 prägnanten Sätzen zusammen (max. 120 Zeichen). Fokussiere auf die wichtigsten Inhalte und vermeide generische Aussagen.';
const SECONDARY_MAX_RESULTS = 12;
const INTENT_MAX_RESULTS = 10;

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

    if (!env.AI || typeof env.AI.autorag !== 'function') {
      return new Response(
        JSON.stringify({
          error: 'Cloudflare AI Search binding not configured',
          message:
            'Set AI binding in Pages environment before using /api/search',
          results: [],
          count: 0,
        }),
        {
          status: 503,
          headers: {
            ...corsHeaders,
            'Cache-Control': 'no-store',
          },
        },
      );
    }

    const topK = clamp(
      parsePositiveInteger(body?.topK) ??
        parsePositiveInteger(env.MAX_SEARCH_RESULTS) ??
        10,
      1,
      25,
    );

    const candidateCount = clamp(Math.max(topK * 4, 20), 20, 60);
    const expandedQuery = expandQuery(query);
    const intentPaths = getIntentPaths(query);
    const ragId = env.RAG_ID || 'wispy-pond-1055';

    const secondaryPromises = [];
    const shouldRunPreciseQuery =
      expandedQuery !== query && intentPaths.length === 0;

    if (shouldRunPreciseQuery) {
      secondaryPromises.push(
        runAiSearch(
          env.AI,
          ragId,
          query,
          Math.min(candidateCount, SECONDARY_MAX_RESULTS),
          false,
        ).catch(() => null),
      );
    }

    if (intentPaths.length > 0) {
      secondaryPromises.push(
        runAiSearch(
          env.AI,
          ragId,
          `${query} ${intentPaths.join(' ')}`,
          Math.min(candidateCount, INTENT_MAX_RESULTS),
          false,
        ).catch(() => null),
      );
    }

    const [primarySearchData, ...secondarySearchData] = await Promise.all([
      runAiSearch(env.AI, ragId, expandedQuery, candidateCount, true),
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

    const balancedResults = balanceByCategory(filteredResults, topK);

    const results = balancedResults.map(
      ({ vectorScore: _vectorScore, matchCount: _matchCount, ...rest }) => rest,
    );

    const responseData = {
      results,
      summary: primarySearchData?.response
        ? String(primarySearchData.response).trim().substring(0, 150)
        : `${results.length} ${results.length === 1 ? 'Ergebnis' : 'Ergebnisse'} für "${query}"`,
      count: results.length,
      query,
      expandedQuery: expandedQuery !== query ? expandedQuery : undefined,
      source: 'cloudflare-ai-search',
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
