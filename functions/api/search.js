/**
 * Cloudflare Pages Function - POST /api/search
 * Modern AI Search with Service Binding (RPC) and Deduplication
 * @version 3.0.0
 */

// Neue Worker URL als Fallback
const WORKER_URL = 'https://api.abdulkerimsesli.de/api/search';

/**
 * Normalisiert eine URL für die Deduplizierung
 */
function normalizeUrl(url) {
  if (!url) return '';
  return (
    url
      .split(/[?#]/)[0] // Entferne Query & Fragmente
      .replace(/\/index\.html$/, '/') // Normalisiere index.html
      .replace(/\/$/, '') || '/'
  ); // Entferne Trailing Slash, '/' für Root
}

/**
 * Verbessert Titel basierend auf URL
 */
function improveResult(result) {
  const url = result.url || '';
  let title = result.title;
  let category = result.category || 'Seite';

  // Extrahiere Seitennamen aus URL
  if (url.includes('/blog/')) {
    const slug = url.split('/blog/')[1]?.replace(/\/$/, '');
    if (slug && slug !== 'index.html') {
      title = `Blog: ${slug.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}`;
      category = 'Blog';
    }
  } else if (url.includes('/projekte/')) {
    const slug = url.split('/projekte/')[1]?.replace(/\/$/, '');
    if (slug && slug !== 'index.html') {
      title = `Projekt: ${slug.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}`;
      category = 'Projekt';
    } else {
      title = 'Projekte Übersicht';
      category = 'Projekte';
    }
  } else if (url.includes('/videos/')) {
    const slug = url.split('/videos/')[1]?.replace(/\/$/, '');
    if (slug && slug !== 'index.html') {
      title = `Video: ${slug.toUpperCase()}`;
      category = 'Video';
    } else {
      title = 'Videos Übersicht';
      category = 'Videos';
    }
  } else if (url.includes('/gallery/')) {
    title = 'Fotogalerie';
    category = 'Galerie';
  } else if (url.includes('/about/')) {
    title = 'Über mich';
    category = 'About';
  } else if (url.endsWith('/') || url.endsWith('/index.html')) {
    const parts = url.replace(/\/$/, '').split('/');
    if (parts.length <= 4) {
      // http(s)://domain.tld/
      title = 'Startseite';
      category = 'Home';
    }
  }

  return { ...result, title, category };
}

/**
 * Dedupliziert Ergebnisse basierend auf normalisierter URL
 */
function deduplicateResults(results) {
  const seen = new Set();
  const deduplicated = [];

  for (const result of results) {
    const key = normalizeUrl(result.url);
    if (!seen.has(key)) {
      seen.add(key);
      deduplicated.push(improveResult(result));
    }
  }

  return deduplicated;
}

export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const body = await request.json();
    const query = body.query || '';
    const topK = body.topK || parseInt(env.MAX_SEARCH_RESULTS || '10');

    let data;

    // 1. Priorität: Service Binding (RPC) - Modernste Option
    if (env.AI_SEARCH && typeof env.AI_SEARCH.search === 'function') {
      data = await env.AI_SEARCH.search(query, {
        index: env.AI_SEARCH_INDEX || 'suche',
        limit: topK,
        ragId: env.RAG_ID || 'suche',
      });
    }
    // 2. Fallback: Direkter Fetch zum Worker
    else {
      const response = await fetch(WORKER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          topK,
          index: env.AI_SEARCH_INDEX || 'suche',
        }),
      });

      if (!response.ok)
        throw new Error(`Worker responded with ${response.status}`);
      data = await response.json();
    }

    // Dedupliziere und verbessere Ergebnisse
    if (data && data.results && Array.isArray(data.results)) {
      data.results = deduplicateResults(data.results);
      data.count = data.results.length;
    }

    // Response mit CORS
    return new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  } catch (error) {
    console.error('Search error:', error);
    return new Response(
      JSON.stringify({
        error: 'Search failed',
        message: error.message,
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      },
    );
  }
}

// CORS Preflight
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}
