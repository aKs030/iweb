/**
 * Cloudflare Pages Function - POST /api/ai
 * Modern AI Chat using Service Binding - Optimized & Reduced
 * @version 5.0.0
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

    // Modern Method: Use Service Binding exclusively
    const binding = env.AI_SEARCH;
    if (!binding) {
      throw new Error('AI_SEARCH Service Binding not configured');
    }

    const serviceResponse = await binding.fetch(
      new Request('http://ai-search/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          message: prompt,
          systemInstruction:
            systemInstruction ||
            'Du bist ein hilfreicher Assistent. Antworte auf Deutsch.',
          ragId: env.RAG_ID || 'suche',
          maxResults: parseInt(env.MAX_SEARCH_RESULTS || '10'),
          gatewayId: 'default',
        }),
      }),
    );

    if (!serviceResponse.ok) {
      throw new Error(`AI Worker returned ${serviceResponse.status}`);
    }

    const data = await serviceResponse.json();

    // Standardize response for frontend
    let responseText = '';
    if (typeof data === 'string') {
      responseText = data;
    } else {
      responseText = data.text || data.response || data.answer || '';
      if (!responseText && data.data) {
        responseText = data.data.text || data.data.response || '';
      }
    }

    if (!responseText && data.error) {
      responseText = `Fehler: ${data.error}`;
    }

    return new Response(
      JSON.stringify({
        text:
          responseText ||
          'Keine Antwort erhalten. Bitte versuchen Sie es später erneut.',
        model: data.model || 'ai-search-proxy',
      }),
      { headers: corsHeaders },
    );
  } catch (error) {
    console.error('AI API Error:', error);
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
