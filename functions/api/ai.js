/**
 * Cloudflare Pages Function - POST /api/ai
 * Nutzt nun direkt das AI_SEARCH Service Binding (RPC) für RAG
 * @version 2.5.0
 */

import { performAIQuery } from './search-utils.js';

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const prompt = body.prompt || body.query || '';

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: 'Missing prompt', status: 400 }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        },
      );
    }

    // Nutze das zentrale Utility für AI/RAG (via RPC Binding)
    const data = await performAIQuery(context.env, prompt);

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
    console.error('[api/ai] Error:', error);
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
