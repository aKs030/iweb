/**
 * Cloudflare Pages Function - POST /api/search
 * AI Search using Cloudflare AI Search Beta via Workers Binding
 * @version 9.1.0 - Enhanced Result Normalization
 */

import { getCorsHeaders, handleOptions } from './_cors.js';

/**
 * Normalizes filenames/urls to user-friendly titles and categories
 * @param {object} item - The raw search result item
 * @returns {object} Normalized URL, Title, and Category
 */
function normalizeResult(item) {
  let url = item.filename || '/';

  // Clean URL: Remove domain
  url = url.replace(/^https?:\/\/(www\.)?abdulkerimsesli\.de/, '');

  // Ensure leading slash
  if (!url.startsWith('/')) url = '/' + url;

  // Remove specific file extensions and index.html
  url = url.replace(/\/index\.html$/, '/');
  url = url.replace(/\.html$/, '');

  // Remove trailing slash for consistency (unless root)
  if (url !== '/' && url.endsWith('/')) {
    url = url.slice(0, -1);
  }

  // Extract base name for title mapping
  const segments = url.split('/').filter(Boolean);
  const baseName = segments.length > 0 ? segments[segments.length - 1] : 'home';

  // Manual mappings for cleaner titles and categories
  const MAP = {
    home: { title: 'Home', category: 'Home' },
    projekte: { title: 'Projekte', category: 'Projekt' },
    blog: { title: 'Blog', category: 'Blog' },
    gallery: { title: 'Galerie', category: 'Galerie' },
    videos: { title: 'Videos', category: 'Video' },
    about: { title: 'Über mich', category: 'About' },
    contact: { title: 'Kontakt', category: 'Kontakt' },
    datenschutz: { title: 'Datenschutz', category: 'Rechtliches' },
    impressum: { title: 'Impressum', category: 'Rechtliches' },
  };

  const mapping = MAP[baseName.toLowerCase()] || {};

  // Fallback title logic: Capitalize first letter of base name
  const fallbackTitle =
    baseName.charAt(0).toUpperCase() + baseName.slice(1).replace(/-/g, ' ');

  // Determine category based on path segment if not mapped
  let category = mapping.category || 'Seite';
  if (!mapping.category && segments.length > 0) {
    const firstSegment = segments[0].toLowerCase();
    if (firstSegment === 'blog') category = 'Blog';
    else if (firstSegment === 'projekte') category = 'Projekt';
    else if (firstSegment === 'gallery') category = 'Galerie';
  }

  return {
    url: url || '/',
    title: mapping.title || fallbackTitle,
    category: category,
    score: item.score || 0,
  };
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request, env);

  try {
    const body = await request.json().catch(() => ({}));
    const query = body.query || '';

    if (!query) {
      return new Response(JSON.stringify({ results: [], count: 0 }), {
        headers: corsHeaders,
      });
    }

    // Check for AI binding
    if (!env.AI) {
      throw new Error('AI binding not configured');
    }

    console.log('Using Cloudflare AI Search Beta for query:', query);

    // Use Workers Binding to call AI Search Beta
    const searchData = await env.AI.autorag('wispy-pond-1055').aiSearch({
      query: query,
      max_num_results: parseInt(body.topK || env.MAX_SEARCH_RESULTS || '10'),
      rewrite_query: true,
      stream: false,
      system_prompt:
        'Du bist ein hilfreicher Assistent. Antworte SEHR KURZ in maximal 1-2 Sätzen (max. 150 Zeichen). Sei präzise und direkt.',
    });

    // Transform AI Search Beta response
    const results = (searchData.data || []).map((item) => {
      const normalized = normalizeResult(item);

      // Extract text content from content array
      const textContent = item.content
        ?.map((c) => c.text)
        .join(' ')
        .substring(0, 200);

      return {
        ...normalized,
        description: textContent || '',
      };
    });

    return new Response(
      JSON.stringify({
        results: results,
        summary:
          (searchData.response || `Suchergebnisse für "${query}"`).substring(
            0,
            200,
          ) + '...',
        count: results.length,
        query: query,
      }),
      { headers: corsHeaders },
    );
  } catch (error) {
    console.error('Search API Error:', error);
    return new Response(
      JSON.stringify({
        error: 'Search failed',
        message: error.message,
        results: [],
      }),
      { status: 500, headers: corsHeaders },
    );
  }
}

export const onRequestOptions = handleOptions;
