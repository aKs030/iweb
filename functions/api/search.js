/**
 * Cloudflare Pages Function - POST /api/search
 * AI Search using Cloudflare AI Search Beta via Workers Binding
 * @version 10.1.0 - Enhanced AI Search Logic with Query Expansion & Caching
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

/**
 * Perform query expansion using simple heuristics or LLM if available
 * This helps with synonyms and context awareness.
 * @param {string} query - The original user query
 * @param {any} _env - The environment bindings (unused for now)
 * @returns {Promise<string>} Expanded query
 */
async function expandQuery(query, _env) {
  // Simple heuristic expansion first to avoid latency
  const lowerQuery = query.toLowerCase();
  let expanded = query;

  const synonyms = {
    bilder: 'Galerie Fotos Images',
    fotos: 'Galerie Bilder Images',
    code: 'Projekte Programmierung Software',
    dev: 'Developer Entwicklung',
    job: 'Karriere Arbeit',
    mail: 'Kontakt Email',
  };

  for (const [key, val] of Object.entries(synonyms)) {
    if (lowerQuery.includes(key)) {
      expanded += ` ${val}`;
    }
  }

  return expanded;
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

    // Cache Key Generation based on query
    // eslint-disable-next-line no-undef
    const cache = caches.default;
    const cacheKey = new Request(
      new URL(request.url).toString() + `?q=${encodeURIComponent(query)}`,
      request,
    );
    let response = await cache.match(cacheKey);

    if (response) {
      console.log('Serving from cache:', query);
      const data = await response.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'X-Cache': 'HIT' },
      });
    }

    // Check for AI binding
    if (!env.AI) {
      throw new Error('AI binding not configured');
    }

    console.log('Processing query:', query);
    const expandedQuery = await expandQuery(query, env);
    console.log('Expanded query:', expandedQuery);

    // Use Workers Binding to call AI Search Beta
    const searchData = await env.AI.autorag('wispy-pond-1055').aiSearch({
      query: expandedQuery,
      max_num_results: parseInt(body.topK || env.MAX_SEARCH_RESULTS || '10'),
      rewrite_query: true, // Let Cloudflare handle some rewriting too
      stream: false,
      system_prompt:
        'Du bist ein hilfreicher Assistent für die Portfolio-Website von Abdulkerim Sesli. Antworte SEHR KURZ in maximal 1-2 Sätzen. Wenn der Nutzer nach Projekten fragt, nenne konkrete Beispiele. Wenn er Kontakt sucht, weise auf das Kontaktformular hin. Sei präzise, freundlich und professionell.',
    });

    // Transform AI Search Beta response
    const results = (searchData.data || []).map((item) => {
      const normalized = normalizeResult(item);

      // Extract text content from content array
      const textContent = item.content
        ?.map((c) => c.text)
        .join(' ')
        .substring(0, 200);

      let score = item.score || 0;

      // Custom Scoring Boost
      // Boost matches in Title significantly
      if (
        normalized.title.toLowerCase().includes(query.toLowerCase()) ||
        normalized.url.includes(query.toLowerCase())
      ) {
        score += 0.2;
      }

      // Boost specific categories if query implies them
      if (
        query.toLowerCase().includes('projekt') &&
        normalized.category === 'Projekt'
      ) {
        score += 0.15;
      }

      return {
        ...normalized,
        description: textContent || '',
        score: score,
      };
    });

    // Re-sort based on boosted scores
    results.sort((a, b) => b.score - a.score);

    // Construct Response
    const responseData = {
      results: results,
      summary:
        (searchData.response || `Suchergebnisse für "${query}"`).substring(
          0,
          300,
        ) + (searchData.response?.length > 300 ? '...' : ''),
      count: results.length,
      query: query,
      expandedQuery: expandedQuery !== query ? expandedQuery : undefined,
    };

    response = new Response(JSON.stringify(responseData), {
      headers: {
        ...corsHeaders,
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        'X-Cache': 'MISS',
      },
    });

    // Cache the response
    context.waitUntil(cache.put(cacheKey, response.clone()));

    return response;
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
