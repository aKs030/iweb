/**
 * Cloudflare Pages Function - POST /api/search
 * AI Search using Cloudflare AI Search Beta via Workers Binding
 * Enhanced with query expansion, fuzzy matching, relevance scoring, and caching
 * @version 10.0.0
 */

import { getCorsHeaders, handleOptions } from './_cors.js';
import {
  expandQuery,
  calculateRelevanceScore,
  getCacheKey,
  isCacheValid,
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

    // Generate cache key
    const topK = parseInt(body.topK || env.MAX_SEARCH_RESULTS || '10');
    const cacheKey = getCacheKey(query, topK);

    // Try to get from cache (KV or in-memory fallback)
    if (env.SEARCH_CACHE) {
      try {
        const cached = await env.SEARCH_CACHE.get(cacheKey, 'json');
        if (cached && isCacheValid(cached, 3600)) {
          console.log('Cache hit for query:', query);
          return new Response(JSON.stringify(cached.data), {
            headers: {
              ...corsHeaders,
              'X-Cache': 'HIT',
              'Cache-Control': 'public, max-age=3600',
            },
          });
        }
      } catch (cacheError) {
        console.warn('Cache read error:', cacheError);
      }
    }

    // Expand query with synonyms and fuzzy matching
    const expandedQuery = expandQuery(query);
    console.log('Original query:', query);
    console.log('Expanded query:', expandedQuery);
    console.log('Using Cloudflare AI Search Beta');

    // Use Workers Binding to call AI Search Beta
    const searchData = await env.AI.autorag('wispy-pond-1055').aiSearch({
      query: expandedQuery,
      max_num_results: topK,
      rewrite_query: true,
      stream: false,
      system_prompt:
        'Du bist ein hilfreicher Assistent. Antworte SEHR KURZ in maximal 1-2 Sätzen (max. 150 Zeichen). Sei präzise und direkt.',
    });

    // Transform AI Search Beta response to our format
    const results = (searchData.data || []).map((item) => {
      // Extract URL from filename
      let url = item.filename || '/';

      // Remove domain if present
      url = url.replace(/^https?:\/\/(www\.)?abdulkerimsesli\.de/, '');

      // Ensure URL starts with /
      if (!url.startsWith('/')) url = '/' + url;

      // Remove trailing slash except for root
      if (url !== '/' && url.endsWith('/')) {
        url = url.slice(0, -1);
      }

      // Extract text content from content array
      const textContent = item.content
        ?.map((c) => c.text)
        .join(' ')
        .substring(0, 200);

      // Determine category from URL
      let category = 'Seite';
      if (url.includes('/projekte')) category = 'Projekte';
      else if (url.includes('/blog')) category = 'Blog';
      else if (url.includes('/gallery')) category = 'Gallery';
      else if (url.includes('/videos')) category = 'Videos';
      else if (url.includes('/about')) category = 'About';
      else if (url.includes('/contact')) category = 'Contact';

      return {
        url: url,
        title: item.filename?.split('/').pop()?.replace('.html', '') || 'Seite',
        category: category,
        description: textContent || '',
        score: item.score || 0,
      };
    });

    // Calculate enhanced relevance scores and sort
    const scoredResults = results
      .map((result) => ({
        ...result,
        score: calculateRelevanceScore(result, query),
      }))
      .sort((a, b) => b.score - a.score);

    const responseData = {
      results: scoredResults,
      summary:
        (searchData.response || `Suchergebnisse für "${query}"`).substring(
          0,
          200,
        ) + '...',
      count: scoredResults.length,
      query: query,
      expandedQuery: expandedQuery !== query ? expandedQuery : undefined,
    };

    // Cache the result
    if (env.SEARCH_CACHE) {
      try {
        await env.SEARCH_CACHE.put(
          cacheKey,
          JSON.stringify({
            data: responseData,
            timestamp: Date.now(),
          }),
          { expirationTtl: 3600 }, // 1 hour
        );
      } catch (cacheError) {
        console.warn('Cache write error:', cacheError);
      }
    }

    return new Response(JSON.stringify(responseData), {
      headers: {
        ...corsHeaders,
        'X-Cache': 'MISS',
        'Cache-Control': 'public, max-age=3600',
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
