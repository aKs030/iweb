/**
 * AI Handler – POST /api/ai
 * Groq API proxy with optional RAG augmentation
 */

import { jsonResponse, errorResponse } from '../../shared/response-utils.js';
import { validateAIRequest } from '../validation.js';
import { callGroqAPI, MODEL } from '../services/groq.js';
import { performSearch, augmentPromptWithRAG } from '../../shared/search-utils.js';

const DEFAULT_SYSTEM = 'Du bist ein hilfreicher Assistent, antworte prägnant und informativ.';

export async function aiHandler(request, env, searchIndex) {
  if (request.method !== 'POST') {
    return errorResponse('Method not allowed', 'Use POST.', 405, request);
  }

  try {
    const body = await request.json();
    const validation = validateAIRequest(body);
    if (!validation.valid) return errorResponse('Validation failed', validation.error, 400, request);

    const { prompt, systemInstruction, options = {} } = body;

    if (!env.GROQ_API_KEY) {
      return errorResponse('Configuration error', 'GROQ_API_KEY not configured', 500, request);
    }

    // Optional RAG augmentation
    let sources = [];
    let finalPrompt = prompt;

    if (options.useSearch) {
      sources = performSearch(options.searchQuery || prompt, Math.min(options.topK || 3, 5), searchIndex, false);
      finalPrompt = augmentPromptWithRAG(prompt, sources);
    }

    const text = await callGroqAPI(finalPrompt, systemInstruction || DEFAULT_SYSTEM, env.GROQ_API_KEY);

    return jsonResponse(
      { text, sources, usedRAG: sources.length > 0, model: MODEL },
      200, {}, request,
    );
  } catch (error) {
    if (env.ENVIRONMENT === 'development') console.error('AI error:', error);
    return errorResponse('AI request failed', error.message, 500, request);
  }
}
