/**
 * AI Search & AI Proxy Worker
 * Endpoints: POST /api/search, POST /api/ai
 */

import SEARCH_INDEX from './search-index.json' with { type: 'json' };
import { searchHandler } from './handlers/search.js';
import { aiHandler } from './handlers/ai.js';
import { handleCORSPreflight, errorResponse } from '../shared/response-utils.js';

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return handleCORSPreflight(request);

    const { pathname } = new URL(request.url);

    try {
      if (pathname === '/api/search') return await searchHandler(request, env, SEARCH_INDEX);
      if (pathname === '/api/ai') return await aiHandler(request, env, SEARCH_INDEX);
      return errorResponse('Not Found', undefined, 404, request);
    } catch (error) {
      if (env.ENVIRONMENT === 'development') console.error('Worker error:', error);
      return errorResponse('Worker error', error.message, 500, request);
    }
  },
};
