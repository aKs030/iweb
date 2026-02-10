/**
 * Cloudflare Pages Function - POST /api/ai
 * Optimized AI Chat using NLWeb-Worker
 * @version 4.0.0
 */

export async function onRequestPost(context) {
  const { request, env } = context;
  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  try {
    const body = await request.json().catch(() => ({}));
    const prompt = body.prompt || body.message || '';
    const systemInstruction = body.systemInstruction || '';

    if (!prompt) {
      return new Response(
        JSON.stringify({
          text: 'Kein Prompt empfangen.',
          error: 'Empty prompt',
        }),
        { status: 400, headers: corsHeaders },
      );
    }

    const workerUrl = env.AI_SEARCH_WORKER_URL;
    const apiToken = env.AI_SEARCH_TOKEN;

    // Call NLWeb-Worker directly
    const response = await fetch(`${workerUrl}/api/ai`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiToken}`,
      },
      body: JSON.stringify({
        prompt,
        systemInstruction:
          systemInstruction ||
          'Du bist ein hilfreicher Assistent. Antworte auf Deutsch.',
        ragId: env.RAG_ID || 'suche',
        maxResults: parseInt(env.MAX_SEARCH_RESULTS || '10'),
        // Model specification from user config
        model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
      }),
    });

    if (!response.ok) {
      throw new Error(`Worker responded with ${response.status}`);
    }

    let data = await response.json();

    // Standardize response for frontend
    if (data) {
      if (typeof data === 'string') {
        data = { text: data };
      }
      if (!data.text) {
        data.text = data.response || data.answer || '';
      }
    }

    if (!data || !data.text) {
      data = {
        text: 'Keine Antwort erhalten. Bitte versuchen Sie es später erneut.',
      };
    }

    return new Response(JSON.stringify(data), { headers: corsHeaders });
  } catch (error) {
    console.error('AI Optimization Error:', error);
    return new Response(
      JSON.stringify({
        error: 'AI request failed',
        message: error.message,
        text: 'Verbindung zum KI-Dienst fehlgeschlagen.',
      }),
      { status: 500, headers: corsHeaders },
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
