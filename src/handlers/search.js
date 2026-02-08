/**
 * Search Handler - POST /api/search
 * Nutzt Cloudflare AI Search (Workers AI)
 */

import { jsonResponse, errorResponse } from '../utils/response.js';
import { validateSearchRequest } from '../utils/validation.js';

/**
 * Bereinigt Titel aus Cloudflare AI Response
 */
function cleanTitle(rawTitle, description) {
  if (rawTitle && !rawTitle.startsWith('http')) {
    return rawTitle;
  }

  // Versuche Titel aus Description zu extrahieren
  const match = description?.match(/title:\s*([^\n]+)/i);
  if (match) {
    return match[1].trim();
  }

  // Fallback: Erster Satz
  const firstLine = description?.split('\n')[0]?.replace(/^[-#\s]+/, '');
  return firstLine?.slice(0, 60) || 'Ohne Titel';
}

/**
 * Bereinigt URL
 */
function cleanUrl(rawUrl) {
  if (!rawUrl) return '/';

  let url = rawUrl.replace(/^\/+/, '/');
  url = url.replace(/^\/https?:\/\//, '/');

  return url;
}

/**
 * Bereinigt Description
 */
function cleanDescription(desc) {
  if (!desc) return '';

  return desc
    .replace(/---[\s\S]*?---/g, '') // YAML Frontmatter
    .replace(/description:/gi, '')
    .replace(/title:/gi, '')
    .replace(/\[.*?\]\(.*?\)/g, '') // Markdown Links
    .replace(/#+/g, '') // Markdown Headers
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

/**
 * Search Handler
 */
export async function searchHandler(request, env) {
  // Nur POST erlauben
  if (request.method !== 'POST') {
    return errorResponse(
      'Method Not Allowed',
      'Nur POST Requests erlaubt',
      405,
      request,
    );
  }

  try {
    // Request Body parsen
    const body = await request.json();

    // Validierung
    const validation = validateSearchRequest(body);
    if (!validation.valid) {
      return errorResponse('Validation Error', validation.error, 400, request);
    }

    const { query, topK = 5 } = body;

    // AI Binding prüfen
    if (!env.AI) {
      return errorResponse(
        'Configuration Error',
        'Cloudflare AI Binding fehlt',
        500,
        request,
      );
    }

    // Max Results aus Env
    const maxResults = parseInt(env.MAX_SEARCH_RESULTS || '10', 10);
    const limit = Math.min(topK, maxResults);

    // Cloudflare AI Search
    const ragId = env.RAG_ID || 'suche';
    const response = await env.AI.autorag(ragId).search({
      query,
      max_num_results: limit,
    });

    // Results verarbeiten
    const results = (response.data || []).map((item) => {
      const text =
        item.content
          ?.map((c) => c.text)
          .filter(Boolean)
          .join(' ') || '';

      return {
        id: item.file_id || '',
        title: cleanTitle(item.filename, text),
        description: cleanDescription(text),
        url: cleanUrl(item.attributes?.url || item.filename),
        category: item.attributes?.category || 'Seite',
        score: item.score || 0,
      };
    });

    return jsonResponse(
      {
        results,
        query,
        count: results.length,
        source: 'cloudflare-ai-search',
      },
      200,
      {},
      request,
    );
  } catch (error) {
    console.error('Search error:', error);
    return errorResponse('Search Failed', error.message, 500, request);
  }
}
