/**
 * AI Search & Gemini Proxy Worker
 * Handles /api/search and /api/gemini endpoints with RAG augmentation
 *
 * Features:
 * - Server-side full-text search with scoring
 * - Gemini API proxy with RAG context injection
 * - Response caching
 * - Error handling and validation
 */

import SEARCH_INDEX from './search-index.json' assert { type: 'json' };
import { searchHandler } from './handlers/search.js';
import { geminiHandler } from './handlers/gemini.js';
import { corsHeaders, errorResponse } from './utils/response.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Add CORS headers for all responses
    const headers = { ...corsHeaders };

    // Handle OPTIONS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers });
    }

    try {
      // Route to appropriate handler
      if (url.pathname === '/api/search') {
        return await searchHandler(request, env, SEARCH_INDEX);
      }

      if (url.pathname === '/api/gemini') {
        return await geminiHandler(request, env, SEARCH_INDEX);
      }

      return errorResponse('Not Found', 404);
    } catch (error) {
      console.error('Worker error:', error);
      return errorResponse(error.message, 500);
    }
  },

  // Scheduled handler for cache warming or maintenance
  async scheduled(event, env, ctx) {
    console.log('Scheduled task triggered at:', new Date(event.scheduledTime));
    // Add any scheduled maintenance tasks here
  },
};
