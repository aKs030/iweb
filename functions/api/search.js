/**
 * Cloudflare Pages Function - POST /api/search
 * Optimized AI Search using NLWeb-Worker
 * @version 4.1.0
 */

function normalizeUrl(url) {
  if (!url) return '';
  try {
    return (
      url
        .split(/[?#]/)[0]
        .replace(/^https?:\/\/(www\.)?abdulkerimsesli\.de/, '')
        .replace(/\/index\.html$/, '/')
        .replace(/\/$/, '') || '/'
    );
  } catch {
    return url;
  }
}

/**
 * Statische Mappings für bessere Suchergebnisse
 */
const URL_MAPPINGS = {
  '/': {
    title: 'Startseite',
    category: 'Home',
    description: 'Willkommen auf dem Portfolio von Abdulkerim Sesli.',
  },
  '/projekte': {
    title: 'Projekte Übersicht',
    category: 'Projekte',
    description:
      'Entdecken Sie meine Webentwicklungsprojekte und Coding-Arbeiten.',
  },
  '/blog': {
    title: 'Blog Übersicht',
    category: 'Blog',
    description:
      'Technische Artikel über Webentwicklung, Design und Fotografie.',
  },
  '/gallery': {
    title: 'Fotogalerie',
    category: 'Galerie',
    description: 'Urban Photography und visuelles Storytelling aus Berlin.',
  },
  '/about': {
    title: 'Über mich',
    category: 'About',
    description:
      'Erfahren Sie mehr über meinen Werdegang und kontaktieren Sie mich.',
  },
  '/videos': {
    title: 'Videos Übersicht',
    category: 'Videos',
    description: 'Motion Design und Video-Produktionen.',
  },
};

function improveResult(result, path = null) {
  const url = result.url || '';
  if (!path) path = normalizeUrl(url);

  const mapping = URL_MAPPINGS[path];
  let title = result.title || 'Seite';
  let category = result.category || 'Seite';
  let description = result.description || '';

  const isGeneric =
    title.includes('Initialisiere System') ||
    title.includes('AKS | WEB') ||
    title.includes('Digital Creator Portfolio') ||
    title.includes('Abdulkerim') ||
    title === 'Suchergebnis' ||
    title === 'Seite' ||
    !title;

  if (mapping) {
    if (isGeneric) title = mapping.title;
    category = mapping.category;
    if (
      mapping.description &&
      (isGeneric || !description || description.length < 20)
    ) {
      description = mapping.description;
    }
  }

  if (
    description.includes('Initialisiere System') ||
    !description ||
    description.length < 10
  ) {
    description = 'Erfahren Sie mehr auf dieser Seite meines Portfolios.';
  }

  return { ...result, title, category, description };
}

function deduplicateResults(results) {
  if (!Array.isArray(results)) return [];
  const seen = new Set();
  const deduplicated = [];

  for (const result of results) {
    const path = normalizeUrl(result.url);
    if (!seen.has(path)) {
      seen.add(path);
      deduplicated.push(improveResult(result, path));
    }
  }

  return deduplicated;
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  try {
    const body = await request.json().catch(() => ({}));
    const query = body.query || '';
    const topK = parseInt(body.topK || env.MAX_SEARCH_RESULTS || '10');

    if (!query) {
      return new Response(JSON.stringify({ results: [], count: 0 }), {
        headers: corsHeaders,
      });
    }

    const workerUrl = env.AI_SEARCH_WORKER_URL;
    const apiToken = env.AI_SEARCH_TOKEN;

    // Wir versuchen zwei mögliche Endpunkte am Worker
    const endpoints = [`${workerUrl}/api/search`, workerUrl];
    let lastError = null;
    let data = null;

    for (const url of endpoints) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiToken}`,
          },
          body: JSON.stringify({
            query,
            limit: topK, // Standardmäßig limit statt topK für viele Worker
            topK: topK,
            index: env.AI_SEARCH_INDEX || 'suche',
            ragId: env.RAG_ID || 'suche',
            gatewayId: 'default',
            embeddingModel: '@cf/qwen/qwen3-embedding-0.6b',
            rerankingModel: '@cf/baai/bge-reranker-base',
          }),
        });

        if (response.ok) {
          data = await response.json();
          if (data) break;
        } else {
          lastError = `Worker ${url} returned ${response.status}`;
        }
      } catch (e) {
        lastError = e.message;
      }
    }

    if (!data) {
      throw new Error(lastError || 'Keine Daten vom Worker empfangen');
    }

    // Robuste Extraktion der Ergebnisse (handhabt verschiedene Formate)
    let results = [];
    if (Array.isArray(data.results)) {
      results = data.results;
    } else if (Array.isArray(data.matches)) {
      results = data.matches.map((m) => ({
        url: m.metadata?.url || m.url,
        title: m.metadata?.title || m.title,
        description: m.metadata?.description || m.description,
        category: m.metadata?.category || m.category,
        score: m.score,
      }));
    } else if (data.data && Array.isArray(data.data.results)) {
      results = data.data.results;
    } else if (Array.isArray(data)) {
      results = data;
    }

    const finalResults = deduplicateResults(results);

    return new Response(
      JSON.stringify({
        results: finalResults,
        count: finalResults.length,
        query: query,
      }),
      { headers: corsHeaders },
    );
  } catch (error) {
    console.error('Search Optimization Error:', error);
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
