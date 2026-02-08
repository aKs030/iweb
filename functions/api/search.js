/**
 * Cloudflare Pages Function - POST /api/search
 * Nutzt nun direkt das AI_SEARCH Service Binding (RPC)
 * @version 2.5.0
 */

import { performSearch } from './search-utils.js';

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const query = body.query || '';
    const topK = body.topK || 20;

    if (!query) {
      return new Response(JSON.stringify({ results: [], count: 0, query: '' }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // Nutze das zentrale Utility für die Suche (via RPC Binding)
    const data = await performSearch(context.env, query, { topK });

    // CORS Headers
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  } catch (error) {
    console.error('[api/search] Error:', error);
    return new Response(
      JSON.stringify({
        error: 'Search failed',
        message: error.message,
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      },
    );
  }
}

// CORS Preflight
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}
