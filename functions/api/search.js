/**
 * Cloudflare Pages Function - POST /api/search
 * AI Search using Cloudflare AI Search Beta via Workers Binding
 * Enhanced with query expansion, fuzzy matching, and relevance scoring
 * @version 12.0.0
 */

import { getCorsHeaders, handleOptions } from './_cors.js';
import {
  expandQuery,
  calculateRelevanceScore,
  normalizeUrl,
  cleanDescription,
  createSnippet,
  levenshteinDistance,
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

    const topK = parseInt(body.topK || env.MAX_SEARCH_RESULTS || '10');

    // Expand query with synonyms and fuzzy matching
    const expandedQuery = expandQuery(query);

    // Use Workers Binding to call AI Search Beta
    const ragId = env.RAG_ID || 'wispy-pond-1055';
    const searchData = await env.AI.autorag(ragId).aiSearch({
      query: expandedQuery,
      max_num_results: Math.max(topK, 15), // Mindestens 15 für bessere Abdeckung
      rewrite_query: true,
      stream: false,
      system_prompt:
        'Du bist ein Suchassistent für abdulkerimsesli.de. Fasse die Suchergebnisse in 1-2 prägnanten Sätzen zusammen (max. 120 Zeichen). Fokussiere auf die wichtigsten Inhalte und vermeide generische Aussagen.',
    });

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

    // Strictly filter out items that don't contain any of the ORIGINAL query tokens
    // (allow a small fuzzy/tolerance check against title/url segments). This prevents
    // returning posts that only matched expanded/synonym queries but are unrelated.
    function matchesOriginalQuery(result, originalQuery) {
      if (!originalQuery) return true;

      const queryWords = originalQuery
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 2);

      if (queryWords.length === 0) return true;

      const title = (result.title || '').toLowerCase();
      const url = (result.url || '').toLowerCase();
      const desc = (result.description || '').toLowerCase();

      // direct token match
      const directMatch = queryWords.some(
        (w) => title.includes(w) || url.includes(w) || desc.includes(w),
      );
      if (directMatch) return true;

      // fuzzy match against title words / url segments (small threshold)
      const titleWords = title.split(/[\s\-_/]+/).filter(Boolean);
      const urlSegments = url.split('/').filter(Boolean);
      const thresholdFor = (word) => (word.length <= 4 ? 1 : 2);

      const fuzzyInArray = (arr) =>
        queryWords.some((q) =>
          arr.some((t) => levenshteinDistance(q, t) <= thresholdFor(q)),
        );

      if (fuzzyInArray(titleWords) || fuzzyInArray(urlSegments)) return true;

      return false;
    }

    const filteredResults = uniqueResults.filter((r) =>
      matchesOriginalQuery(r, query),
    );

    // If filtering removed everything, fall back to the unfiltered set to avoid empty results
    const resultsToScore =
      filteredResults.length > 0 ? filteredResults : uniqueResults;

    // Calculate enhanced relevance scores and sort
    const scoredResults = resultsToScore
      .map((result) => ({
        ...result,
        score: calculateRelevanceScore(result, query),
      }))
      .sort((a, b) => b.score - a.score);

    // Limit results per category to avoid spam (erhöht für bessere Abdeckung)
    const categoryCount = {};
    const MAX_PER_CATEGORY = 5; // Erhöht von 3 auf 5
    const finalResults = scoredResults.filter((result) => {
      const cat = result.category || 'Seite';
      categoryCount[cat] = (categoryCount[cat] || 0) + 1;
      return categoryCount[cat] <= MAX_PER_CATEGORY;
    });

    // Build category counts and expose only categories with >0 results
    const categoryCounts = finalResults.reduce((acc, r) => {
      const c = r.category || 'Seite';
      acc[c] = (acc[c] || 0) + 1;
      return acc;
    }, {});

    const responseData = {
      results: finalResults,
      categories: categoryCounts,
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
