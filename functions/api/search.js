/**
 * Cloudflare Pages Function - POST /api/search
 * Primary: Cloudflare AI Search (Hybrid Mode)
 * Fallback: Minimal static route safety net
 * @version 19.0.0 - Simplified & Modernized
 */

import { getCorsHeaders, handleOptions } from './_cors.js';
import {
  parsePositiveInteger,
  clamp,
  toQueryTerms,
  compileQueryRegexes,
} from './_search-query.js';
import { scoreSearchResult, getIntentPaths } from './_search-scoring.js';
import {
  toSearchResult,
  dedupeByBestScore,
  balanceByCategory,
} from './_search-results.js';
import { truncateText } from './_search-content.js';
import { SEARCH_SYSTEM_PROMPT, ROUTE_FALLBACK_PATHS } from './_search-data.js';

// Configuration
const SEARCH_TIMEOUT_MS = 4500;
const MAX_RESULTS_DEFAULT = 10;

// Minimal static fallback entries (computed once)
const FALLBACK_ENTRIES = ROUTE_FALLBACK_PATHS.map((path) => ({
  url: path,
  title:
    path === '/'
      ? 'Startseite'
      : path.substring(1).charAt(0).toUpperCase() + path.substring(2),
  description: `Bereich ${path}`,
  category: 'Seite',
}));

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
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

    const topK = clamp(
      parsePositiveInteger(body?.topK) || MAX_RESULTS_DEFAULT,
      1,
      20,
    );

    // 1. Run AI Search (Hybrid)
    let aiResults = [];
    let aiSummary = '';

    if (env.AI && env.RAG_ID) {
      const searchResponse = await withTimeout(
        env.AI.autorag(env.RAG_ID).aiSearch({
          query,
          max_num_results: Math.max(topK * 2, 15), // Fetch more for dedupe
          hybrid: true, // Use modern hybrid search
          system_prompt: SEARCH_SYSTEM_PROMPT,
        }),
        SEARCH_TIMEOUT_MS,
      );

      if (searchResponse?.data) {
        aiResults = searchResponse.data;
        aiSummary = searchResponse.response || '';
      }
    }

    // 2. Process & Score Results
    const queryTerms = toQueryTerms(query);
    const queryRegexes = compileQueryRegexes(queryTerms);
    const intentPaths = getIntentPaths(query);

    const scored = aiResults
      .map((item) => toSearchResult(item, query))
      .filter((r) => r.title && r.url)
      .map((r) =>
        scoreSearchResult(r, query, queryTerms, intentPaths, queryRegexes),
      );

    // 3. Fallback only if AI fails completely
    if (scored.length === 0) {
      const fallback = FALLBACK_ENTRIES.filter(
        (e) =>
          e.url.includes(query.toLowerCase()) ||
          e.title.toLowerCase().includes(query.toLowerCase()),
      ).slice(0, 5);

      scored.push(
        ...fallback.map((f) => ({
          ...f,
          highlightedDescription: f.description,
          score: 1,
          matchCount: 1,
        })),
      );
    }

    // 4. Final Polish
    const unique = dedupeByBestScore(scored).sort((a, b) => b.score - a.score);
    const balanced = balanceByCategory(unique, topK);

    return Response.json(
      {
        results: balanced,
        count: balanced.length,
        summary: truncateText(aiSummary, 200),
        aiChat: {
          message: aiSummary
            ? truncateText(aiSummary, 300)
            : `${balanced.length} Ergebnisse gefunden.`,
          suggestions: [], // Client handles suggestions
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
