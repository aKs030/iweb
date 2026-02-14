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
    // Using /ai-search endpoint which returns both search results AND AI-generated answer
    const searchResponse = await fetch(
      'https://api.cloudflare.com/client/v4/accounts/652ca9f4abc93203c1ecd059dc00d1da/autorag/rags/plain-mountain-d6d0/ai-search',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.AI_SEARCH_TOKEN}`,
        },
        body: JSON.stringify({
          query: query,
          max_num_results: parseInt(
            body.topK || env.MAX_SEARCH_RESULTS || '10',
          ),
          rewrite_query: true,
          stream: false,
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
    // Response structure: { success: true, result: { data: [...], response: "..." } }
    const results = (searchData.result?.data || []).map((item) => {
      // Extract URL from filename (e.g., "pages/blog/react.html" -> "/blog/react")
      let url = item.filename || '/';
      url = url
        .replace(/^pages/, '')
        .replace(/\.html$/, '')
        .replace(/\/index$/, '');
      if (!url.startsWith('/')) url = '/' + url;

      // Extract text content from content array
      const textContent = item.content
        ?.map((c) => c.text)
        .join(' ')
        .substring(0, 200);

      return {
        url: url,
        title: item.filename?.split('/').pop()?.replace('.html', '') || 'Seite',
        category: 'Seite',
        description: textContent || '',
        score: item.score || 0,
      };
    });

    return new Response(
      JSON.stringify({
        results: results,
        summary: searchData.result?.response || `Suchergebnisse für "${query}"`,
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
