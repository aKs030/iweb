/**
 * Cloudflare Pages Function - POST /api/ai
 * Modern AI Chat/RAG with Service Binding (RPC)
 * @version 3.1.0
 */

const WORKER_URL = 'https://api.abdulkerimsesli.de/api/ai';

export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const body = await request.json();
    const prompt = body.prompt || body.message || '';

    let data = null;

    // 1. Try Service Binding (RPC)
    if (env.AI_SEARCH && typeof env.AI_SEARCH.chat === 'function') {
      try {
        data = await env.AI_SEARCH.chat(prompt, {
          ragId: env.RAG_ID || 'suche',
          maxResults: parseInt(env.MAX_SEARCH_RESULTS || '10'),
        });
      } catch (e) {
        console.error('AI_SEARCH binding chat error:', e);
      }
    }

    // 2. Fallback: Fetch to Worker
    if (!data || (!data.text && !data.response && !data.answer)) {
      const response = await fetch(WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        data = await response.json();
      }
    }

    // Standardize response for frontend (expects result.text)
    if (data) {
      if (!data.text) {
        data.text = data.response || data.answer || '';
      }
    } else {
      data = { text: 'Keine Antwort erhalten.' };
    }

    return new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('AI function error:', error);
    return new Response(
      JSON.stringify({
        error: 'AI request failed',
        message: error.message,
        text: 'Verbindung fehlgeschlagen.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}

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
