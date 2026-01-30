/**
 * YouTube API Proxy Worker
 * Securely proxies YouTube Data API v3 requests
 *
 * Features:
 * - Server-side API key protection
 * - Cloudflare Cache API integration (1 hour TTL)
 * - Rate limiting per IP
 * - CORS support
 * - Error handling
 */

import { handleCORSPreflight } from '../shared/response-utils.js';
import { youtubeHandler } from './handlers/youtube.js';

export default {
  async fetch(request, env) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return handleCORSPreflight();
    }

    // Route to YouTube handler
    return await youtubeHandler(request, env);
  },
};
