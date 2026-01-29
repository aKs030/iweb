/**
 * Gemini Handler
 * Proxies requests to Google Gemini API with optional RAG augmentation
 */

import { jsonResponse, errorResponse } from '../utils/response.js';
import { validateGeminiRequest } from '../utils/validation.js';
import { callGeminiAPI } from '../services/gemini.js';

/**
 * Performs search for RAG context
 */
function searchForContext(query, topK, searchIndex) {
  const q = String(query || '')
    .toLowerCase()
    .trim();
  if (!q) return [];

  const results = searchIndex
    .map((item) => {
      let score = 0;
      const title = (item.title || '').toLowerCase();
      const desc = (item.description || '').toLowerCase();

      if (title.includes(q)) score += 100;
      if (desc.includes(q)) score += 50;

      return { ...item, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return results.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    url: r.url,
  }));
}

/**
 * Augments prompt with RAG context
 */
function augmentPromptWithRAG(prompt, sources) {
  if (!sources.length) return prompt;

  const srcText = sources
    .map((s, i) => `[[${i + 1}] ${s.title} — ${s.url}]: ${s.description}`)
    .join('\n');

  return `Nutze die folgenden relevanten Informationen von der Website als Kontext (falls hilfreich):\n${srcText}\n\nFrage: ${prompt}`;
}

/**
 * Handles /api/gemini requests
 */
export async function geminiHandler(request, env, searchIndex) {
  if (request.method !== 'POST') {
    return errorResponse('Method not allowed. Use POST.', 405);
  }

  try {
    const body = await request.json();
    const validation = validateGeminiRequest(body);

    if (!validation.valid) {
      return errorResponse(validation.error, 400);
    }

    const { prompt, systemInstruction, options = {} } = body;

    // Check API key
    if (!env.GEMINI_API_KEY) {
      return errorResponse('GEMINI_API_KEY not configured', 500);
    }

    // Perform RAG search if requested
    let sources = [];
    let augmentedPrompt = prompt;

    if (options.useSearch) {
      const query = options.searchQuery || prompt;
      const topK = Math.min(options.topK || 3, 5);
      sources = searchForContext(query, topK, searchIndex);
      augmentedPrompt = augmentPromptWithRAG(prompt, sources);
    }

    // Call Gemini API
    const defaultSystemInstruction =
      'Du bist ein hilfreicher Assistent, antworte prägnant und informativ.';
    const text = await callGeminiAPI(
      augmentedPrompt,
      systemInstruction || defaultSystemInstruction,
      env.GEMINI_API_KEY,
    );

    return jsonResponse({
      text,
      sources,
      usedRAG: sources.length > 0,
    });
  } catch (error) {
    console.error('Gemini error:', error);
    return errorResponse(`Gemini request failed: ${error.message}`, 500);
  }
}
