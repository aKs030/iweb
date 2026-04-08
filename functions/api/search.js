import { getCorsHeaders, handleOptions } from './_cors.js';
import {
  buildAiSearchRequest,
  clampResults,
  resolveAiSearchConfig,
} from './_ai-search-config.js';
import { jsonResponse } from './_response.js';
import {
  buildDeterministicMatches,
  buildSearchPayload,
  createEmptySearchPayload,
  createSearchErrorPayload,
  extractAiResult,
  loadDeterministicSearchDataset,
  resolveSearchInput,
  SEARCH_RESPONSE_CACHE_CONTROL,
  SEARCH_TIMEOUT_MS,
  SYSTEM_PROMPT,
  withSearchTimeout,
} from './_search-service.js';
import { mergeHeaders } from '../_shared/http-headers.js';

async function handleSearchRequest(context, body = null) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request, env);
  const {
    query,
    topK: requestedTopK,
    facet: requestedFacet,
  } = resolveSearchInput(request, body);

  if (!query) {
    return jsonResponse(createEmptySearchPayload(requestedFacet), {
      headers: corsHeaders,
    });
  }

  const aiSearchConfig = resolveAiSearchConfig(env);
  const topK = clampResults(
    requestedTopK,
    aiSearchConfig.maxResults,
    aiSearchConfig.maxResults,
  );
  const fetchTopK = Math.min(
    aiSearchConfig.maxResults,
    Math.max(topK, Math.min(topK * 2, topK + 8)),
  );

  const deterministicCandidates = await loadDeterministicSearchDataset(context);
  const results = buildDeterministicMatches(deterministicCandidates, query);
  let aiSummary = '';

  if (env.AI && env.RAG_ID) {
    try {
      const aiSearchRequest = buildAiSearchRequest({
        query,
        maxResults: fetchTopK,
        config: aiSearchConfig,
        systemPrompt: SYSTEM_PROMPT,
        stream: false,
        hybrid: true,
      });

      const searchResponse = await withSearchTimeout(
        env.AI.autorag(env.RAG_ID).aiSearch(aiSearchRequest),
        SEARCH_TIMEOUT_MS,
      );

      if (searchResponse?.data && Array.isArray(searchResponse.data)) {
        results.push(...searchResponse.data.map(extractAiResult));
      }

      aiSummary = String(searchResponse?.response || '');
    } catch (error) {
      console.error('AI search degraded to deterministic fallback:', error);
    }
  }

  return jsonResponse(
    buildSearchPayload({
      aiSummary,
      facet: requestedFacet,
      query,
      results,
      topK,
    }),
    {
      headers: mergeHeaders(corsHeaders, {
        'Cache-Control': SEARCH_RESPONSE_CACHE_CONTROL,
      }),
    },
  );
}

/**
 * @param {any} context
 */
export async function onRequestPost(context) {
  try {
    const body = await context.request.json().catch(() => ({}));
    return handleSearchRequest(context, body);
  } catch (error) {
    const corsHeaders = getCorsHeaders(context.request, context.env);
    console.error('Search error:', error);
    return jsonResponse(createSearchErrorPayload(), {
      status: 500,
      headers: corsHeaders,
    });
  }
}

export async function onRequestGet(context) {
  return handleSearchRequest(context);
}

export const onRequestOptions = handleOptions;
