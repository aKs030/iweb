/**
 * Cloudflare Pages Function - POST /api/ai
 * Optimized AI Chat using NLWeb-Worker
 * @version 4.1.0
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

    // Wir versuchen zwei mögliche Endpunkte am Worker
    const endpoints = [`${workerUrl}/api/ai`, workerUrl];
    let lastError = null;
    let data = null;

    for (const url of endpoints) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiToken}`,
          },
          body: JSON.stringify({
            prompt,
            message: prompt,
            systemInstruction:
              systemInstruction ||
              'Du bist ein hilfreicher Assistent. Antworte auf Deutsch.',
            ragId: env.RAG_ID || 'suche',
            maxResults: parseInt(env.MAX_SEARCH_RESULTS || '10'),
            limit: parseInt(env.MAX_SEARCH_RESULTS || '10'),
            gatewayId: 'default',
            model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
          }),
        });

        if (response.ok) {
          data = await response.json();
          if (data) break;
        } else {
          lastError = `Worker ${url} returned ${response.status}`;
        }
      } catch (e) {
        lastError = e.message;
      }
    }

    if (!data) {
      throw new Error(lastError || 'Keine Antwort vom Worker empfangen');
    }

    // Robuste Standardisierung der Antwort für das Frontend
    let responseText = '';
    if (typeof data === 'string') {
      responseText = data;
    } else {
      responseText = data.text || data.response || data.answer || '';
      if (!responseText && data.data) {
        responseText = data.data.text || data.data.response || '';
      }
    }

    if (!responseText) {
      responseText =
        'Keine Antwort erhalten. Bitte versuchen Sie es später erneut.';
    }

    return new Response(
      JSON.stringify({
        text: responseText,
        model: data.model || 'llama-3.3',
      }),
      { headers: corsHeaders },
    );
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
