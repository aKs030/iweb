/**
 * Cloudflare Pages Function - POST /api/search
 * AI Search using Cloudflare AI Search Beta via Workers Binding
 * Enhanced with query expansion, fuzzy matching, and relevance scoring
 * @version 13.0.0 - Refactored to use centralized utils
 */

import { getCorsHeaders, handleOptions } from './_cors.js';
import {
  expandQuery,
  calculateRelevanceScore,
  normalizeUrl,
  createSnippet,
  extractCategory,
  extractTitle,
  extractContent,
} from './_search-utils.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request, env);

  try {
    const body = await request.json().catch(() => ({}));
    const query = body.query || '';

    if (!query) {
      return new Response(JSON.stringify({ results: [], count: 0 }), {
        headers: corsHeaders,
      });
    }

    // Check for AI binding
    if (!env.AI) {
      throw new Error('AI binding not configured');
    }

    const parsePositiveInteger = (value) => {
      const normalized = String(value ?? '').trim();

      if (!/^\d+$/.test(normalized)) {
        return null;
      }

      const parsed = Number.parseInt(normalized, 10);
      return parsed > 0 ? parsed : null;
    };

    const topK =
      parsePositiveInteger(body.topK) ??
      parsePositiveInteger(env.MAX_SEARCH_RESULTS) ??
      10;

    // Expand query with synonyms and fuzzy matching
    const expandedQuery = expandQuery(query);

    // Use Workers Binding to call AI Search Beta
    const ragId = env.RAG_ID || 'wispy-pond-1055';
    const startTime = Date.now();

    // Call AI Search Beta with strict config (matches working Chat API)
    const searchData = await env.AI.autorag(ragId).aiSearch({
      query: expandedQuery,
      max_num_results: Math.max(topK, 15),
      rewrite_query: false, // Disabled to prevent errors
      stream: false,
      // Removed system_prompt as it's not supported in all AI Search versions
    });

    const duration = Date.now() - startTime;

    // Handle empty or invalid response gracefully
    if (!searchData || !searchData.data || !Array.isArray(searchData.data)) {
      console.warn(
        `Search returned empty/invalid data for query: "${query}" (Time: ${duration}ms)`,
      );
      return new Response(
        JSON.stringify({
          results: [],
          summary: `Keine Ergebnisse für "${query}" gefunden.`,
          count: 0,
          query: query,
        }),
        {
          headers: corsHeaders,
        },
      );
    }

    // Transform AI Search Beta response to our format
    const results = searchData.data.map((item) => {
      // Use helper to normalize URL
      const url = normalizeUrl(item.filename);
      const title = extractTitle(item.filename);
      const category = extractCategory(url);

      // Extract full content using centralized helper
      // Use a larger limit for snippet generation to find best match
      const fullContent = extractContent(item, 5000);

      // Create a smart snippet focused on the query
      const snippet = createSnippet(fullContent, query, 160);

      return {
        url: url,
        title: title,
        category: category,
        description: snippet || 'Keine Beschreibung verfügbar',
        // Pass full content for accurate relevance scoring later
        fullContent: fullContent,
        score: item.score || 0,
      };
    });

    // Remove duplicates based on URL only (vereinfacht für bessere Abdeckung)
    const uniqueResults = [];
    const seenUrls = new Set();

    for (const result of results) {
      // Skip if URL already seen
      if (seenUrls.has(result.url)) {
        continue;
      }

      seenUrls.add(result.url);
      uniqueResults.push(result);
    }

    // Calculate enhanced relevance scores and sort
    const scoredResults = uniqueResults
      .map((result) => {
        // Use the full content we preserved for scoring
        const scoreObj = {
          ...result,
          description: result.fullContent || result.description,
        };
        const finalScore = calculateRelevanceScore(scoreObj, query);

        // Remove the heavy fullContent property before sending to client
        const { fullContent: _fullContent, ...cleanResult } = result;

        return {
          ...cleanResult,
          score: finalScore,
        };
      })
      .sort((a, b) => b.score - a.score);

    // Filter out low relevance results
    // Threshold 1.0 ensures we only keep results that:
    // 1. Have a text match (score boosted > 2.0)
    // 2. OR have a high vector similarity (> 0.6) which triggers static boosts (> 1.6)
    const RELEVANCE_THRESHOLD = 0.8; // Slightly lowered to allow more results
    const relevantResults = scoredResults.filter(
      (result) => result.score >= RELEVANCE_THRESHOLD,
    );

    // Limit results per category to avoid spam (erhöht für bessere Abdeckung)
    const categoryCount = {};
    const MAX_PER_CATEGORY = 5; // Erhöht von 3 auf 5
    const finalResults = relevantResults.filter((result) => {
      const cat = result.category || 'Seite';
      categoryCount[cat] = (categoryCount[cat] || 0) + 1;
      return categoryCount[cat] <= MAX_PER_CATEGORY;
    });

    const summaryText = searchData.response
      ? searchData.response.trim().substring(0, 150)
      : `${finalResults.length} ${finalResults.length === 1 ? 'Ergebnis' : 'Ergebnisse'} für "${query}"`;

    const responseData = {
      results: finalResults,
      summary: summaryText,
      count: finalResults.length,
      query: query,
      expandedQuery: expandedQuery !== query ? expandedQuery : undefined,
    };

    return new Response(JSON.stringify(responseData), {
      headers: {
        ...corsHeaders,
        'Cache-Control': 'public, max-age=300', // 5 minutes browser cache
      },
    });
  } catch (error) {
    console.error('Search API Error:', error);
    return new Response(
      JSON.stringify({
        error: 'Search failed',
        message: error.message,
        results: [],
      }),
      { status: 500, headers: corsHeaders },
    );
  }
}

export const onRequestOptions = handleOptions;
