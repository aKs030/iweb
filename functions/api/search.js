/**
 * Cloudflare Pages Function - POST /api/search
 * AI Search using Cloudflare AI Search Beta via Workers Binding
 * Enhanced with query expansion, fuzzy matching, and relevance scoring
 * @version 12.0.1
 */

import { getCorsHeaders, handleOptions } from './_cors.js';
import {
  expandQuery,
  calculateRelevanceScore,
  normalizeUrl,
  createSnippet,
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
      console.error('AI binding (env.AI) is missing');
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

    // Verify autorag method exists before calling
    if (typeof env.AI.autorag !== 'function') {
      const availableKeys = Object.keys(env.AI);
      console.error(
        'env.AI.autorag is not a function. env.AI keys:',
        availableKeys,
      );

      // Return 503 with details for debugging instead of generic 500
      return new Response(
        JSON.stringify({
          error: 'AI Search unavailable',
          message:
            'The AI Search method (autorag) is missing in this environment.',
          debug: {
            availableMethods: availableKeys,
            note: 'Please check wrangler.toml compatibility_date and AI binding.',
          },
          results: [],
          count: 0,
        }),
        { status: 503, headers: corsHeaders },
      );
    }

    let searchData;
    try {
      // Attempt search without summarization (generation) features first
      // to avoid model binding errors with text generation parameters
      searchData = await env.AI.autorag(ragId).aiSearch({
        query: expandedQuery,
        max_num_results: Math.max(topK, 15),
        // rewrite_query: true, // Disabled: likely triggers LLM call
        // system_prompt: '...', // Disabled: definitely triggers LLM call
      });
    } catch (aiError) {
      console.error('AI execution failed:', aiError);
      return new Response(
        JSON.stringify({
          error: 'AI Execution Failed',
          message: aiError.message,
          results: [],
          count: 0,
        }),
        { status: 503, headers: corsHeaders },
      );
    }

    // Transform AI Search Beta response to our format
    const results = (searchData.data || []).map((item) => {
      // Use helper to normalize URL
      const url = normalizeUrl(item.filename);

      // Extract text content from multiple possible sources
      let textContent = '';

      // Try content array first
      if (item.content && Array.isArray(item.content)) {
        textContent = item.content.map((c) => c.text || '').join(' ');
      }

      // Fallback to other possible fields
      if (!textContent && item.text) {
        textContent = item.text;
      }

      if (!textContent && item.description) {
        textContent = item.description;
      }

      // Create a smart snippet focused on the query
      // Use original query for highlighting to avoid synonym confusion
      const snippet = createSnippet(textContent, query, 160);

      // Determine category from URL with better mapping
      let category = 'Seite';
      if (url.includes('/projekte')) category = 'Projekte';
      else if (url.includes('/blog')) category = 'Blog';
      else if (url.includes('/gallery')) category = 'Galerie';
      else if (url.includes('/videos')) category = 'Videos';
      else if (url.includes('/about')) category = 'Über mich';
      else if (url.includes('/contact')) category = 'Kontakt';
      else if (url === '/') category = 'Home';

      // Improved title extraction with better fallbacks
      let title = item.filename?.split('/').pop()?.replace('.html', '') || '';

      // Smart title mapping based on URL patterns
      if (title === 'index' || title === '' || !title) {
        const segments = url.split('/').filter(Boolean);

        if (url === '/') {
          title = 'Startseite';
        } else if (segments.length === 1) {
          // Top-level pages: /projekte, /blog, etc.
          const titleMap = {
            projekte: 'Projekte Übersicht',
            blog: 'Blog Übersicht',
            gallery: 'Galerie',
            videos: 'Videos Übersicht',
            about: 'Über mich',
            contact: 'Kontakt',
          };
          title =
            titleMap[segments[0]] ||
            segments[0].charAt(0).toUpperCase() + segments[0].slice(1);
        } else if (segments.length >= 2) {
          // Sub-pages: /blog/threejs-performance, /videos/1bl8bzd6cpy
          const lastSegment = segments[segments.length - 1];
          // Convert kebab-case to Title Case
          title = lastSegment
            .split('-')
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
        }
      } else {
        // Convert existing title from kebab-case to Title Case
        title = title
          .split('-')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
      }

      return {
        url: url,
        title: title,
        category: category,
        description: snippet || 'Keine Beschreibung verfügbar',
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
      .map((result) => ({
        ...result,
        score: calculateRelevanceScore(result, query),
      }))
      .sort((a, b) => b.score - a.score);

    // Filter out low relevance results
    // Threshold 1.0 ensures we only keep results that:
    // 1. Have a text match (score boosted > 2.0)
    // 2. OR have a high vector similarity (> 0.6) which triggers static boosts (> 1.6)
    const RELEVANCE_THRESHOLD = 1.0;
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

    const responseData = {
      results: finalResults,
      summary: searchData.response
        ? searchData.response.trim().substring(0, 150)
        : `${finalResults.length} ${finalResults.length === 1 ? 'Ergebnis' : 'Ergebnisse'} für "${query}"`,
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
