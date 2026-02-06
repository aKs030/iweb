/**
 * YouTube API Proxy Worker
 * Endpoint: GET /api/youtube/{endpoint}
 */

import { handleCORSPreflight } from '../shared/response-utils.js';
import { youtubeHandler } from './handlers/youtube.js';

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return handleCORSPreflight(request);
    return youtubeHandler(request, env);
  },
};
