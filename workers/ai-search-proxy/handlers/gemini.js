/**
 * AI Handler
 * Proxies requests to Groq API (free) with optional RAG augmentation
 * Previously used Google Gemini - now using Groq for free inference
 */

import { jsonResponse, errorResponse } from '../utils/response.js';
import { validateGeminiRequest } from '../utils/validation.js';
import { callGroqAPI } from '../services/groq.js';

/**
 * Performs search for RAG context (using same algorithm as search handler)
 */
function searchForContext(query, topK, searchIndex) {
  const q = String(query || '')
    .toLowerCase()
    .trim();
  if (!q) return [];

  const words = q.split(/\s+/).filter(Boolean);

  const results = searchIndex.map((item) => {
    let score = item.priority || 0;
    const title = (item.title || '').toLowerCase();
    const desc = (item.description || '').toLowerCase();

    // Exact title match - highest priority
    if (title === q) score += 1000;
    else if (title.startsWith(q)) score += 500;
    else if (title.includes(q)) score += 200;

    // Description match
    if (desc.includes(q)) score += 100;

    // Keyword matching
    (item.keywords || []).forEach((k) => {
      const kl = (k || '').toLowerCase();
      if (kl === q) score += 150;
      else if (kl.startsWith(q)) score += 80;
      else if (kl.includes(q)) score += 40;
    });

    // Multi-word matching
    words.forEach((w) => {
      if (title.includes(w)) score += 30;
      if (desc.includes(w)) score += 15;
      (item.keywords || []).forEach((k) => {
        if ((k || '').toLowerCase().includes(w)) score += 20;
      });
    });

    return { ...item, score };
  });

  return results
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((r) => ({
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
 * Handles /api/gemini requests (now using Groq)
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
    if (!env.GROQ_API_KEY) {
      return errorResponse('GROQ_API_KEY not configured', 500);
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
    console.error('AI API error:', error);
    return errorResponse(`AI request failed: ${error.message}`, 500);
  }
}
