/**
 * Cloudflare Pages Function - POST /api/search
 * AI Search using Cloudflare AI Search Beta
 * @version 7.0.0
 */

import { getCorsHeaders, handleOptions } from './_cors.js';

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

    // Check for AI Search Beta token
    if (!env.AI_SEARCH_TOKEN) {
      throw new Error('AI_SEARCH_TOKEN not configured');
    }

    console.log('Using Cloudflare AI Search Beta for query:', query);

    // Call Cloudflare AI Search Beta API
    const searchResponse = await fetch(
      'https://api.cloudflare.com/client/v4/accounts/652ca9f4abc93203c1ecd059dc00d1da/ai-search/plain-mountain-d6d0/search',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.AI_SEARCH_TOKEN}`,
        },
        body: JSON.stringify({
          query: query,
          max_results: parseInt(body.topK || env.MAX_SEARCH_RESULTS || '10'),
        }),
      },
    );

    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      console.error('AI Search Beta error:', errorText);
      throw new Error(`AI Search Beta error: ${searchResponse.status}`);
    }

    const searchData = await searchResponse.json();

    // Transform AI Search Beta response to our format
    const results = (searchData.result?.results || []).map((item) => ({
      url: item.url || '/',
      title: item.title || 'Seite',
      category: item.category || 'Seite',
      description: item.description || item.snippet || '',
      score: item.score || 0,
    }));

    return new Response(
      JSON.stringify({
        results: results,
        summary: searchData.result?.answer || `Suchergebnisse für "${query}"`,
        count: results.length,
        query: query,
      }),
      { headers: corsHeaders },
    );
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
