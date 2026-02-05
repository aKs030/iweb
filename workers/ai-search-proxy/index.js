/**
 * AI Search & AI Proxy Worker
 * Handles /api/search and /api/ai endpoints with RAG augmentation
 *
 * Features:
 * - Server-side full-text search with scoring
 * - AI API proxy (Groq) with RAG context injection
 * - Response caching
 * - Error handling and validation
 */

import SEARCH_INDEX from './search-index.json' with { type: 'json' };
import { searchHandler } from './handlers/search.js';
import { aiHandler } from './handlers/ai.js';
import {
  handleCORSPreflight,
  errorResponse,
} from '../shared/response-utils.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Handle OPTIONS preflight requests
    if (request.method === 'OPTIONS') {
      return handleCORSPreflight();
    }

    try {
      // Route to appropriate handler
      if (url.pathname === '/api/search') {
        return await searchHandler(request, env, SEARCH_INDEX);
      }

      // AI endpoint
      if (url.pathname === '/api/ai') {
        return await aiHandler(request, env, SEARCH_INDEX);
      }

      // Legacy endpoint - redirect to /api/ai (deprecated)
      if (url.pathname === '/api/gemini') {
        return await aiHandler(request, env, SEARCH_INDEX);
      }

      return errorResponse('Not Found', undefined, 404);
    } catch (error) {
      // Log error in development only
      if (
        typeof env?.ENVIRONMENT !== 'undefined' &&
        env.ENVIRONMENT === 'development'
      ) {
        console.error('Worker error:', error);
      }
      return errorResponse('Worker error', error.message, 500);
    }
  },

  // Scheduled handler for cache warming or maintenance
  async scheduled(event, env, ctx) {
    console.log('Scheduled task triggered at:', new Date(event.scheduledTime));
    // Add any scheduled maintenance tasks here
  },
};
