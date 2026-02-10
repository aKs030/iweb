/**
 * Cloudflare Pages Function - POST /api/ai
 * Modern AI Chat/RAG with Service Binding (RPC)
 * @version 3.1.0
 */

const WORKER_URL =
  'https://ai-search-proxy.httpsgithubcomaks030website.workers.dev/api/ai';

export async function onRequestPost(context) {
  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  try {
    const { request, env } = context;

    // Safety check for body parsing
    let body = {};
    try {
      body = await request.json();
    } catch (e) {
      console.warn('Could not parse request JSON:', e.message);
    }

    const prompt = body.prompt || body.message || '';
    const systemInstruction = body.systemInstruction || '';

    let data = null;

    // 1. Try Service Binding (RPC or fallback fetch)
    // Check multiple possible binding names for resilience
    const binding = env.AI_SEARCH || env.SEARCH_SERVICE || env.SEARCH;

    if (binding) {
      try {
        if (typeof binding.chat === 'function') {
          console.log('AI Chat via binding RPC started');
          data = await binding.chat(prompt, {
            ragId: env.RAG_ID || 'ai-search-suche',
            maxResults: parseInt(env.MAX_SEARCH_RESULTS || '10'),
          });
        } else if (typeof binding.fetch === 'function') {
          console.log('AI Chat via binding fetch started');
          const response = await binding.fetch(request.clone());
          if (response.ok) {
            data = await response.json();
            console.log('Binding fetch successful');
          }
        }
      } catch (e) {
        console.error('Service binding chat error:', e);
      }
    }

    // 2. Fallback: Fetch to Worker
    if (!data || (!data.text && !data.response && !data.answer)) {
      try {
        console.log('Falling back to Worker chat fetch');
        // Use an 8-second timeout for the fallback fetch
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const response = await fetch(WORKER_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          data = await response.json();
          console.log('Worker chat fetch successful');
        } else {
          console.error(
            `Worker chat fetch failed with status: ${response.status}`,
          );
        }
      } catch (e) {
        console.error('Fallback worker chat fetch failed:', e.message);
      }
    }

    // 3. Last Resort: Direct Cloudflare Workers AI (if binding 'AI' exists)
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
          console.log('Direct Workers AI successful');
        }
      } catch (e) {
        console.error('Direct Workers AI failed:', e);
      }
    }

    // Standardize response for frontend (expects result.text)
    if (data) {
      if (!data.text) {
        data.text = data.response || data.answer || '';
      }
    } else {
      data = {
        text: 'Keine Antwort erhalten. Bitte versuchen Sie es später erneut.',
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
