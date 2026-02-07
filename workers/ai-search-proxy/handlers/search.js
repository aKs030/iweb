/**
 * Search Handler – POST /api/search
 * Nutzt ausschließlich Cloudflare AI Search (env.AI.autorag)
 */

import { jsonResponse, errorResponse } from '../../shared/response-utils.js';
import { validateSearchRequest } from '../validation.js';

const AI_SEARCH_INSTANCE = 'suche';

function cleanTitle(rawTitle, description) {
  // Versuche, einen sinnvollen Titel zu extrahieren
  if (rawTitle && !rawTitle.startsWith('http')) return rawTitle;
  // Fallback: Suche nach 'title:' in der Description (YAML frontmatter)
  const match = description?.match(/title:\s*([^\n]+)/i);
  if (match) return match[1].trim();
  // Fallback: Erster Satz
  return description?.split('\n')[0]?.replace(/^[-#\s]+/, '')?.slice(0, 60) || '';
}

function cleanUrl(rawUrl) {
  // Entferne führende Slashes und doppelte Protokolle
  if (!rawUrl) return '/';
  let url = rawUrl.replace(/^\/+/, '/');
  url = url.replace(/^\/https?:\/\//, '/');
  return url;
}

function cleanDescription(desc) {
  // Entferne YAML-Frontmatter und Markdown-Reste
  if (!desc) return '';
  return desc
    .replace(/---[\s\S]*?---/g, '') // YAML-Block
    .replace(/description:/gi, '')
    .replace(/title:/gi, '')
    .replace(/\[.*?\]\(.*?\)/g, '') // Markdown-Links
    .replace(/#+/g, '')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

async function searchWithAI(query, maxResults, ai) {
  const response = await ai.autorag(AI_SEARCH_INSTANCE).search({
    query,
    max_num_results: maxResults,
  });
  return (response.data || []).map((item) => {
    const text = item.content?.map((c) => c.text).filter(Boolean).join(' ') || '';
    const title = cleanTitle(item.filename, text);
    const url = cleanUrl(item.attributes?.url || item.filename);
    const description = cleanDescription(text);
    return {
      id: item.file_id || '',
      title,
      description,
      url,
      category: item.attributes?.category || 'Seite',
      score: item.score || 0,
    };
  });
}

export async function searchHandler(request, env) {
  if (request.method !== 'POST') {
    return errorResponse('Method not allowed', 'Use POST.', 405, request);
  }
  try {
    const body = await request.json();
    const validation = validateSearchRequest(body);
    if (!validation.valid) {
      return errorResponse('Validation failed', validation.error, 400, request);
    }
    const { query, topK } = body;
    const maxResults = parseInt(env.MAX_SEARCH_RESULTS || '10', 10);
    const limit = Math.min(topK || 5, maxResults);
    if (!env.AI) {
      return errorResponse('Cloudflare AI Search binding missing', undefined, 500, request);
    }
    const results = await searchWithAI(query, limit, env.AI);
    return jsonResponse(
      { results, query, count: results.length, source: 'ai-search' },
      200,
      {},
      request,
    );
  } catch (error) {
    return errorResponse('Search failed', error.message, 500, request);
  }
}
