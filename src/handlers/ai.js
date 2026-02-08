/**
 * AI Handler - POST /api/ai
 * Groq API mit optionalem RAG via Cloudflare AI Search
 */

import { jsonResponse, errorResponse } from '../utils/response.js';
import { validateAIRequest } from '../utils/validation.js';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';
const DEFAULT_SYSTEM =
  'Du bist ein hilfreicher Assistent. Antworte prägnant und informativ auf Deutsch.';

/**
 * Ruft Groq API auf
 */
async function callGroqAPI(prompt, systemInstruction, apiKey) {
  const messages = [
    { role: 'system', content: systemInstruction },
    { role: 'user', content: prompt },
  ];

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages,
      temperature: 0.7,
      max_tokens: 2048,
      top_p: 0.95,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Groq API Error (${response.status}): ${text}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || 'Keine Antwort generiert';
}

/**
 * Erweitert Prompt mit RAG Context
 */
function augmentPromptWithRAG(prompt, sources) {
  if (!sources || sources.length === 0) {
    return prompt;
  }

  const context = sources
    .map((s, i) => `[${i + 1}] ${s.title} (${s.url}): ${s.description}`)
    .join('\n');

  return `Nutze folgende Website-Informationen als Kontext:\n\n${context}\n\nFrage: ${prompt}`;
}

/**
 * AI Handler
 */
export async function aiHandler(request, env) {
  // Nur POST erlauben
  if (request.method !== 'POST') {
    return errorResponse(
      'Method Not Allowed',
      'Nur POST Requests erlaubt',
      405,
      request,
    );
  }

  try {
    // Request Body parsen
    const body = await request.json();

    // Validierung
    const validation = validateAIRequest(body);
    if (!validation.valid) {
      return errorResponse('Validation Error', validation.error, 400, request);
    }

    const { prompt, systemInstruction, options = {} } = body;

    // Groq API Key prüfen
    if (!env.GROQ_API_KEY) {
      return errorResponse(
        'Configuration Error',
        'GROQ_API_KEY nicht konfiguriert',
        500,
        request,
      );
    }

    let sources = [];
    let finalPrompt = prompt;

    // Optional: RAG via Cloudflare AI Search
    if (options.useSearch) {
      if (!env.AI) {
        return errorResponse(
          'Configuration Error',
          'Cloudflare AI Binding fehlt für RAG',
          500,
          request,
        );
      }

      const maxResults = Math.min(options.topK || 3, 5);
      const searchQuery = options.searchQuery || prompt;
      const ragId = env.RAG_ID || 'suche';

      const aiResponse = await env.AI.autorag(ragId).search({
        query: searchQuery,
        max_num_results: maxResults,
      });

      sources = (aiResponse.data || []).map((item) => {
        const text =
          item.content
            ?.map((c) => c.text)
            .filter(Boolean)
            .join(' ') || '';
        return {
          id: item.file_id || '',
          title: item.filename || item.file_id || '',
          description: text.slice(0, 300),
          url: item.attributes?.url || `/${item.filename || ''}`,
        };
      });

      finalPrompt = augmentPromptWithRAG(prompt, sources);
    }

    // Groq API aufrufen
    const text = await callGroqAPI(
      finalPrompt,
      systemInstruction || DEFAULT_SYSTEM,
      env.GROQ_API_KEY,
    );

    return jsonResponse(
      {
        text,
        sources,
        usedRAG: sources.length > 0,
        model: GROQ_MODEL,
      },
      200,
      {},
      request,
    );
  } catch (error) {
    console.error('AI error:', error);
    return errorResponse('AI Request Failed', error.message, 500, request);
  }
}
