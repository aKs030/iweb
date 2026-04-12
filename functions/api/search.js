import { createLogger } from '../../content/core/logger.js';

const log = createLogger('search');
import { getCorsHeaders, handleOptions } from './_cors.js';
import { jsonResponse } from './_response.js';
import {
  buildDeterministicMatches,
  buildSearchPayload,
  createEmptySearchPayload,
  createSearchErrorPayload,
  loadDeterministicSearchDataset,
  resolveSearchInput,
  SEARCH_RESPONSE_CACHE_CONTROL,
} from './_search-service.js';
import { mergeHeaders } from '../_shared/http-headers.js';

const DEFAULT_MAX_SEARCH_RESULTS = 10;

function clampResults(value, fallback = DEFAULT_MAX_SEARCH_RESULTS) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  const candidate = Number.isFinite(parsed)
    ? parsed
    : Number.parseInt(String(fallback), 10);
  return Math.min(20, Math.max(1, candidate || DEFAULT_MAX_SEARCH_RESULTS));
}

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

  const topK = clampResults(requestedTopK, env?.MAX_SEARCH_RESULTS);

  const deterministicCandidates = await loadDeterministicSearchDataset(context);
  const results = buildDeterministicMatches(deterministicCandidates, query);

  return jsonResponse(
    buildSearchPayload({
      aiSummary: '',
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
    log.error('Search error:', error);
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
