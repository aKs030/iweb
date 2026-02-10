/**
 * Cloudflare Pages Function - POST /api/ai
 * Modern AI Chat/RAG with Service Binding (RPC)
 * @version 3.2.0
 */

const CANONICAL_WORKER_URL = 'https://api.abdulkerimsesli.de/api/ai';
const FALLBACK_WORKER_URL =
  'https://ai-search-proxy.httpsgithubcomaks030website.workers.dev/api/ai';

export async function onRequestPost(context) {
  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  try {
    const { request, env } = context;

    // Read body as text first to be safe and allow multiple uses
    const bodyText = await request.text();
    let body = {};
    try {
      if (bodyText) {
        body = JSON.parse(bodyText);
      }
    } catch (e) {
      console.warn('Could not parse request JSON:', e.message);
    }

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

    let data = null;

    // 1. Try Service Binding (RPC or fallback fetch)
    const binding = env.AI_SEARCH || env.SEARCH_SERVICE || env.SEARCH;

    // Direct binding status logs
    if (env.VECTOR_INDEX) console.log('Vectorize binding available');
    if (env.BUCKET) console.log('R2 binding available');

    if (binding) {
      try {
        if (typeof binding.chat === 'function') {
          console.log('AI Chat via binding RPC started');
          data = await binding.chat(prompt, {
            ragId: env.RAG_ID || 'ai-search-suche',
            maxResults: parseInt(env.MAX_SEARCH_RESULTS || '10'),
            gatewayId: 'default',
            systemInstruction:
              systemInstruction ||
              'Du bist ein hilfreicher Assistent. Antworte auf Deutsch.',
          });
        } else if (typeof binding.fetch === 'function') {
          console.log('AI Chat via binding fetch started');
          // Create a new request to avoid any "body used" issues
          const serviceRequest = new Request(request.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: bodyText,
          });
          const response = await binding.fetch(serviceRequest);
          if (response.ok) {
            data = await response.json();
          }
        }
      } catch (e) {
        console.error('Service binding chat error:', e);
      }
    }

    // 2. Fallback: Fetch to Worker (Try Canonical then Fallback URL)
    if (!data || (!data.text && !data.response && !data.answer)) {
      const urlsToTry = [CANONICAL_WORKER_URL, FALLBACK_WORKER_URL];

      for (const url of urlsToTry) {
        try {
          console.log(`Falling back to Worker chat fetch: ${url}`);
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000);

          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...body,
              ragId: env.RAG_ID || 'ai-search-suche',
              maxResults: parseInt(env.MAX_SEARCH_RESULTS || '10'),
              gatewayId: 'default',
            }),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (response.ok) {
            data = await response.json();
            if (data && (data.text || data.response || data.answer)) {
              console.log(`Successfully received response from ${url}`);
              break;
            }
          } else {
            console.error(
              `Worker chat fetch failed for ${url} with status: ${response.status}`,
            );
          }
        } catch (e) {
          console.error(`Fetch failed for ${url}:`, e.message);
        }
      }
    }

    // 3. Last Resort: Direct Cloudflare Workers AI
    if ((!data || (!data.text && !data.response && !data.answer)) && env.AI) {
      try {
        console.log('Using direct Workers AI fallback');
        const aiResponse = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
          messages: [
            {
              role: 'system',
              content:
                systemInstruction ||
                'Du bist ein hilfreicher Assistent. Antworte auf Deutsch.',
            },
            { role: 'user', content: prompt },
          ],
        });
        if (aiResponse && (aiResponse.response || aiResponse.text)) {
          data = {
            text: aiResponse.response || aiResponse.text,
            model: 'llama-3-8b-direct',
          };
        }
      } catch (e) {
        console.error('Direct Workers AI failed:', e);
      }
    }

    // Standardize response for frontend
    if (data) {
      // If data is just a string (some models might return this)
      if (typeof data === 'string') {
        data = { text: data };
      }

      if (!data.text) {
        data.text = data.response || data.answer || '';
      }

      // Ensure we don't return an empty string if we got a data object
      if (!data.text && data.error) {
        data.text = `Fehler: ${data.error}`;
      }
    }

    if (!data || !data.text) {
      data = {
        text: 'Keine Antwort erhalten. Bitte versuchen Sie es später erneut.',
        error: 'All fallbacks failed',
      };
    }

    return new Response(JSON.stringify(data), {
      headers: corsHeaders,
    });
  } catch (error) {
    console.error('AI function error:', error);
    return new Response(
      JSON.stringify({
        error: 'AI request failed',
        message: error.message,
        text: 'Verbindung fehlgeschlagen.',
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
