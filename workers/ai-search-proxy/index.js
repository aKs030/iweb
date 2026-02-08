/**
 * AI Search & AI Proxy Worker
 * Support for Fetch API and modern RPC Service Bindings
 * @version 2.5.0
 */

import { WorkerEntrypoint } from 'cloudflare:workers';
import { searchHandler } from './handlers/search.js';
import { aiHandler } from './handlers/ai.js';
import {
  handleCORSPreflight,
  errorResponse,
} from '../shared/response-utils.js';

/**
 * Modern RPC Entrypoint for AI Search
 */
export class AISearch extends WorkerEntrypoint {
  /**
   * Universal search method via RPC
   * @param {string} query
   * @param {object} options
   */
  async search(query, options = {}) {
    const mode = options.mode || 'search';

    // Emulate a Request object for the existing handlers
    const url = new URL(`https://worker.local/api/${mode}`);
    const request = new Request(url.href, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, prompt: query, ...options }),
    });

    let response;
    if (mode === 'ai') {
      response = await aiHandler(request, this.env);
    } else {
      response = await searchHandler(request, this.env);
    }

    return await response.json();
  }
}

/**
 * Standard Fetch Entrypoint (backward compatibility & direct access)
 */
export default {
  async fetch(request, this_env) {
    if (request.method === 'OPTIONS') return handleCORSPreflight(request);

    const { pathname } = new URL(request.url);

    try {
      if (pathname === '/api/search')
        return await searchHandler(request, this_env);
      if (pathname === '/api/ai') return await aiHandler(request, this_env);
      return errorResponse('Not Found', undefined, 404, request);
    } catch (error) {
      if (this_env.ENVIRONMENT === 'development')
        console.error('Worker error:', error);
      return errorResponse('Worker error', error.message, 500, request);
    }
  },
};
