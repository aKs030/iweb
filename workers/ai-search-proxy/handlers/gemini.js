/**
 * AI Handler
 * Proxies requests to Groq API (free) with optional RAG augmentation
 * Previously used Google Gemini - now using Groq for free inference
 */

import { jsonResponse, errorResponse } from '../../shared/response-utils.js';
import { validateGeminiRequest } from '../utils/validation.js';
import { callGroqAPI } from '../services/groq.js';
import {
  performSearch,
  augmentPromptWithRAG,
} from '../../shared/search-utils.js';

/**
 * Handles /api/gemini requests (now using Groq)
 */
export async function geminiHandler(request, env, searchIndex) {
  if (request.method !== 'POST') {
    return errorResponse('Method not allowed', 'Use POST.', 405);
  }

  try {
    const body = await request.json();
    const validation = validateGeminiRequest(body);

    if (!validation.valid) {
      return errorResponse('Validation failed', validation.error, 400);
    }

    const { prompt, systemInstruction, options = {} } = body;

    // Check API key
    if (!env.GROQ_API_KEY) {
      return errorResponse(
        'Configuration error',
        'GROQ_API_KEY not configured',
        500,
      );
    }

    // Perform RAG search if requested
    let sources = [];
    let augmentedPrompt = prompt;

    if (options.useSearch) {
      const query = options.searchQuery || prompt;
      const topK = Math.min(options.topK || 3, 5);
      sources = performSearch(query, topK, searchIndex, false);
      augmentedPrompt = augmentPromptWithRAG(prompt, sources);
    }

    // Call Groq API (free, fast inference)
    const defaultSystemInstruction =
      'Du bist ein hilfreicher Assistent, antworte prägnant und informativ.';
    const text = await callGroqAPI(
      augmentedPrompt,
      systemInstruction || defaultSystemInstruction,
      env.GROQ_API_KEY,
    );

    return jsonResponse({
      text,
      sources,
      usedRAG: sources.length > 0,
      model: 'llama-3.3-70b-versatile', // Info about which model was used
    });
  } catch (error) {
    // Log error in development only
    if (
      typeof env?.ENVIRONMENT !== 'undefined' &&
      env.ENVIRONMENT === 'development'
    ) {
      console.error('AI API error:', error);
    }
    return errorResponse('AI request failed', error.message, 500);
  }
}
