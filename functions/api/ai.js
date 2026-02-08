/**
 * Cloudflare Pages Function - POST /api/ai
 * Modern AI Chat/RAG with Service Binding (RPC)
 * @version 3.0.0
 */

// Neue Worker URL als Fallback
const WORKER_URL = 'https://api.abdulkerimsesli.de/api/ai';

export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const body = await request.json();

    let data;

    // 1. Priorität: Service Binding (RPC) - Modernste Option
    if (env.AI_SEARCH && typeof env.AI_SEARCH.chat === 'function') {
      data = await env.AI_SEARCH.chat(body.prompt || body.message, {
        ragId: env.RAG_ID || 'suche',
        maxResults: parseInt(env.MAX_SEARCH_RESULTS || '10'),
      });
    }
    // 2. Fallback: Direkter Fetch zum Worker
    else {
      const response = await fetch(WORKER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok)
        throw new Error(`Worker responded with ${response.status}`);
      data = await response.json();
    }

    // CORS Headers
    return new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  } catch (error) {
    console.error('AI error:', error);
    return new Response(
      JSON.stringify({
        error: 'AI request failed',
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
