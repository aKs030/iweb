/**
 * AI Search Proxy Worker
 * Endpoints: POST /api/search, POST /api/ai
 */

import { handleCORSPreflight, errorResponse } from './utils/response.js';
import { searchHandler } from './handlers/search.js';
import { aiHandler } from './handlers/ai.js';

export default {
  async fetch(request, env, ctx) {
    // CORS Preflight
    if (request.method === 'OPTIONS') {
      return handleCORSPreflight(request);
    }

    const { pathname } = new URL(request.url);

    try {
      // Route Handling
      if (pathname === '/api/search') {
        return await searchHandler(request, env);
      }

      if (pathname === '/api/ai') {
        return await aiHandler(request, env);
      }

      return errorResponse(
        'Not Found',
        'Endpoint nicht gefunden',
        404,
        request,
      );
    } catch (error) {
      console.error('Worker error:', error);
      return errorResponse(
        'Internal Server Error',
        error.message,
        500,
        request,
      );
    }
  },
};
