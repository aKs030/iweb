/**
 * Cloudflare Pages Function - POST /api/search
 * AI Search using Cloudflare AI Search Beta via Workers Binding
 * Enhanced with query expansion, fuzzy matching, relevance scoring, and caching
 * @version 11.0.0
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

    // Generate cache key with version to bust old cache
    const CACHE_VERSION = 'v6'; // Increment when search logic changes
    const topK = parseInt(body.topK || env.MAX_SEARCH_RESULTS || '10');
    const cacheKey = `${CACHE_VERSION}:${getCacheKey(query, topK)}`;

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
        'Du bist ein Assistent für die Website von Abdulkerim Sesli, einem Web-Entwickler und Fotografen aus Berlin. Antworte SEHR KURZ in maximal 1-2 Sätzen (max. 150 Zeichen). Sei präzise und fokussiere dich auf die Hauptinhalte.',
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

      // Extract text content from content array with smart truncation
      let textContent = item.content
        ?.map((c) => c.text)
        .join(' ')
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();

      // Clean up technical content and metadata
      if (textContent) {
        // Remove common navigation/menu patterns
        textContent = textContent
          .replace(/:menu\.[^\s]+/g, '') // Remove :menu.skip_mainmenu etc.
          .replace(/Zum Hauptinhalt springen/gi, '')
          .replace(/Nach oben/gi, '')
          .replace(/Startseite/gi, '')
          .replace(/Start/gi, '')
          .replace(/Weiter/gi, '')
          .replace(/Auf Wiedersehen!/gi, '')
          .replace(/--- description:/gi, '')
          .replace(/--- title:/gi, '')
          .replace(/image: https?:\/\/[^\s]+/gi, '')
          .replace(/@type[^}]+}/gi, '')
          .replace(/\{[^}]*@id[^}]*}/gi, '')
          .replace(/WebPage|BreadcrumbList|ListItem/gi, '')
          .replace(/© \d{4} Abdulkerim Sesli/gi, '')
          .replace(/Impressum|Datenschutz|Cookies/gi, '')
          .replace(/Wir nutzen Analytics/gi, '')
          .replace(/Akzeptieren|Ablehnen/gi, '')
          .replace(/\s+/g, ' ') // Normalize whitespace again
          .trim();

        // Remove leading special characters and cleanup
        textContent = textContent.replace(/^[:\-—,.\s]+/, '').trim();
      }

      // Smart truncation: don't cut words in half
      if (textContent && textContent.length > 200) {
        // Find a good breaking point (space, comma, period)
        let breakPoint = 200;
        const lastSpace = textContent.lastIndexOf(' ', 200);
        const lastComma = textContent.lastIndexOf(',', 200);
        const lastPeriod = textContent.lastIndexOf('.', 200);

        // Use the best breaking point
        breakPoint = Math.max(lastSpace, lastComma, lastPeriod);

        // If no good breaking point found or too far back, just use space
        if (breakPoint < 150) {
          breakPoint = lastSpace > 0 ? lastSpace : 200;
        }

        textContent = textContent.substring(0, breakPoint).trim();
      }

      // Final cleanup: if description still contains technical markers after cleaning, skip it
      if (
        textContent &&
        (textContent.includes('---') ||
          textContent.includes('@type') ||
          textContent.includes(':menu'))
      ) {
        textContent = '';
      }

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

    // Remove duplicates based on URL and normalize similar descriptions
    const uniqueResults = [];
    const seenUrls = new Set();
    const seenDescriptions = new Set();

    for (const result of results) {
      // Skip if URL already seen
      if (seenUrls.has(result.url)) {
        continue;
      }

      // Normalize description for comparison (first 50 chars)
      const descNormalized = result.description
        .substring(0, 50)
        .toLowerCase()
        .trim();

      // Skip if very similar description already exists for same category
      const descKey = `${result.category}:${descNormalized}`;
      if (seenDescriptions.has(descKey)) {
        continue;
      }

      seenUrls.add(result.url);
      seenDescriptions.add(descKey);
      uniqueResults.push(result);
    }

    // Calculate enhanced relevance scores and sort
    const scoredResults = uniqueResults
      .map((result) => ({
        ...result,
        score: calculateRelevanceScore(result, query),
      }))
      .sort((a, b) => b.score - a.score);

    // Limit results per category to avoid spam
    const categoryCount = {};
    const MAX_PER_CATEGORY = 3;
    const finalResults = scoredResults.filter((result) => {
      const cat = result.category || 'Seite';
      categoryCount[cat] = (categoryCount[cat] || 0) + 1;
      return categoryCount[cat] <= MAX_PER_CATEGORY;
    });

    const responseData = {
      results: finalResults,
      summary:
        (searchData.response || `Suchergebnisse für "${query}"`).substring(
          0,
          200,
        ) + '...',
      count: finalResults.length,
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
