/**
 * Hybrid Search API - Combines Vectorize + AI Search Beta
 * Uses Vectorize for precise semantic search
 * Uses AI Search Beta for RAG-powered summaries
 * @version 1.0.0
 */

import { getCorsHeaders, handleOptions } from './_cors.js';
import { getCacheKey, isCacheValid } from './_search-utils.js';

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

    // Check bindings
    if (!env.AI) {
      throw new Error('AI binding not configured');
    }

    // Fallback to AI Search Beta if Vectorize not available yet
    if (!env.VECTORIZE) {
      console.warn('VECTORIZE not configured, falling back to AI Search Beta');
      // Redirect to regular search
      const searchModule = await import('./search.js');
      return searchModule.onRequestPost(context);
    }

    // Cache check
    const CACHE_VERSION = 'v1-hybrid';
    const topK = parseInt(body.topK || env.MAX_SEARCH_RESULTS || '10');
    const cacheKey = `${CACHE_VERSION}:${getCacheKey(query, topK)}`;

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

    console.log('Hybrid search for:', query);

    // Step 1: Generate query embedding for Vectorize
    const embeddingResponse = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
      text: [query],
    });
    const queryEmbedding = embeddingResponse.data[0];

    // Step 2: Search Vectorize for semantic matches
    const vectorResults = await env.VECTORIZE.query(queryEmbedding, {
      topK: topK * 2, // Get more results for better filtering
      returnMetadata: true,
    });

    console.log('Vectorize results:', vectorResults.matches?.length || 0);

    // Step 3: Get AI summary from AI Search Beta (parallel)
    let aiSummary = '';
    try {
      const aiSearchData = await env.AI.autorag('wispy-pond-1055').aiSearch({
        query: query,
        max_num_results: 3,
        rewrite_query: true,
        stream: false,
        system_prompt:
          'Du bist ein Assistent für die Website von Abdulkerim Sesli. Antworte SEHR KURZ in maximal 1-2 Sätzen (max. 150 Zeichen).',
      });
      aiSummary = aiSearchData.response || '';
    } catch (aiError) {
      console.warn('AI Search Beta error:', aiError);
      aiSummary = `Suchergebnisse für "${query}"`;
    }

    // Step 4: Transform Vectorize results
    const results = (vectorResults.matches || [])
      .filter((match) => match.score > 0.7) // Only high-confidence matches
      .slice(0, topK)
      .map((match) => ({
        url: match.metadata.url,
        title: match.metadata.title,
        description: match.metadata.description || '',
        category: match.metadata.category || 'Seite',
        score: match.score,
        icon: getCategoryIcon(match.metadata.category),
      }));

    console.log('Final results:', results.length);

    const responseData = {
      results,
      summary: aiSummary.substring(0, 200) + '...',
      count: results.length,
      query,
      source: 'hybrid', // Indicates hybrid search
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
          { expirationTtl: 3600 },
        );
      } catch (cacheError) {
        console.warn('Cache write error:', cacheError);
      }
    }

    return new Response(JSON.stringify(responseData), {
      headers: {
        ...corsHeaders,
        'X-Cache': 'MISS',
        'X-Search-Source': 'hybrid',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Hybrid Search Error:', error);
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

function getCategoryIcon(category) {
  const icons = {
    Home: '🏠',
    Seite: '📄',
    Blog: '📝',
    Projekte: '💻',
    Videos: '🎬',
    Gallery: '🖼️',
    About: 'ℹ️',
    Contact: '📧',
  };
  return icons[category] || '🔍';
}

export const onRequestOptions = handleOptions;
