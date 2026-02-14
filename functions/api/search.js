/**
 * Cloudflare Pages Function - POST /api/search
 * AI Search using Cloudflare AI Search Beta via Workers Binding
 * @version 8.0.0
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

    // Check for AI binding
    if (!env.AI) {
      throw new Error('AI binding not configured');
    }

    console.log('Using Cloudflare AI Search Beta for query:', query);

    // Use Workers Binding to call AI Search Beta
    // This is more secure and doesn't require API tokens
    const searchData = await env.AI.autorag('plain-mountain-d6d0').aiSearch({
      query: query,
      max_num_results: parseInt(body.topK || env.MAX_SEARCH_RESULTS || '10'),
      rewrite_query: true,
      stream: false,
    });

    // Transform AI Search Beta response to our format
    // Response structure: { object: "vector_store.search_results.page", data: [...], response: "..." }
    const results = (searchData.data || []).map((item) => {
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
        summary: searchData.response || `Suchergebnisse für "${query}"`,
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
