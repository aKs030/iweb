/**
 * Cloudflare Pages Function - POST /api/search
 * Modern AI Search with Service Binding (RPC) and Deduplication
 * @version 3.2.0
 */

const WORKER_URL =
  'https://ai-search-proxy.httpsgithubcomaks030website.workers.dev/api/search';

function normalizeUrl(url) {
  if (!url) return '';
  try {
    return (
      url
        .split(/[?#]/)[0]
        .replace(/\/index\.html$/, '/')
        .replace(/\/$/, '') || '/'
    );
  } catch {
    return url;
  }
}

function improveResult(result) {
  const url = result.url || '';
  let title = result.title || 'Seite';
  let category = result.category || 'Seite';
  let description = result.description || '';

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
      title = 'Startseite';
      category = 'Home';
    }
  }

  return { ...result, title, category, description };
}

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
  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  try {
    const { request, env } = context;

    // Read body as text first to be safe
    const bodyText = await request.text();
    let body = {};
    try {
      if (bodyText) {
        body = JSON.parse(bodyText);
      }
    } catch (e) {
      console.warn('Could not parse request JSON:', e.message);
    }

    const query = body.query || '';
    const topK = body.topK || parseInt(env.MAX_SEARCH_RESULTS || '10');

    if (!query) {
      return new Response(JSON.stringify({ results: [], count: 0 }), {
        headers: corsHeaders,
      });
    }

    let data = { results: [], count: 0 };

    // 1. Try Service Binding (RPC or fallback fetch)
    const binding = env.AI_SEARCH || env.SEARCH_SERVICE || env.SEARCH;

    if (binding) {
      try {
        if (typeof binding.search === 'function') {
          console.log(`Searching via binding RPC for: "${query}"`);
          const bindingData = await binding.search(query, {
            index: env.AI_SEARCH_INDEX || 'ai-search-suche',
            limit: topK,
            ragId: env.RAG_ID || 'ai-search-suche',
          });
          if (bindingData && Array.isArray(bindingData.results)) {
            data = bindingData;
          }
        } else if (typeof binding.fetch === 'function') {
          console.log(`Searching via binding fetch for: "${query}"`);
          const serviceRequest = new Request(request.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: bodyText,
          });
          const response = await binding.fetch(serviceRequest);
          if (response.ok) {
            data = await response.json();
          }
        }
      } catch (e) {
        console.error('Service binding search error:', e);
      }
    }

    // 2. Fallback to Worker Fetch
    if (!data.results || data.results.length === 0) {
      try {
        console.log(`Falling back to Worker fetch for: "${query}"`);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const response = await fetch(WORKER_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query,
            topK,
            index: env.AI_SEARCH_INDEX || 'ai-search-suche',
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const workerData = await response.json();
          if (workerData) {
            data = workerData;
          }
        }
      } catch (e) {
        console.error('Fallback worker fetch failed:', e.message);
      }
    }

    // Ensure results is always an array and deduplicated
    if (data) {
      if (Array.isArray(data.results)) {
        data.results = deduplicateResults(data.results);
        data.count = data.results.length;
      } else if (Array.isArray(data)) {
        data = {
          results: deduplicateResults(data),
          count: data.length,
        };
      } else if (!data.results) {
        data.results = [];
        data.count = 0;
      }
    }

    return new Response(JSON.stringify(data), {
      headers: corsHeaders,
    });
  } catch (error) {
    console.error('Search function error:', error);
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
