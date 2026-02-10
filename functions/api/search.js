/**
 * Cloudflare Pages Function - POST /api/search
 * Optimized AI Search using NLWeb-Worker
 * @version 4.0.0
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
  // Blog Posts
  '/blog/react-no-build': {
    title: 'React ohne Build-Tools nutzen',
    category: 'Blog',
  },
  '/blog/modern-ui-design': {
    title: 'Modernes UI-Design: Mehr als nur Dark Mode',
    category: 'Blog',
  },
  '/blog/visual-storytelling': {
    title: 'Visuelles Storytelling in der Fotografie',
    category: 'Blog',
  },
  '/blog/threejs-performance': {
    title: 'Optimierung von Three.js für das Web',
    category: 'Blog',
  },
  '/blog/seo-technische-optimierung': {
    title: 'Technische SEO: Core Web Vitals',
    category: 'Blog',
  },
  '/blog/progressive-web-apps-2026': {
    title: 'Progressive Web Apps 2026',
    category: 'Blog',
  },
  '/blog/web-components-zukunft': {
    title: 'Web Components: Die Zukunft',
    category: 'Blog',
  },
  '/blog/css-container-queries': {
    title: 'CSS Container Queries',
    category: 'Blog',
  },
  '/blog/javascript-performance-patterns': {
    title: 'JS Performance Patterns',
    category: 'Blog',
  },
  '/blog/typescript-advanced-patterns': {
    title: 'TypeScript Advanced Patterns',
    category: 'Blog',
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

    // Call NLWeb-Worker directly (Modern & Single Source of Truth)
    const response = await fetch(`${workerUrl}/api/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiToken}`,
      },
      body: JSON.stringify({
        query,
        topK,
        index: env.AI_SEARCH_INDEX || 'suche',
        ragId: env.RAG_ID || 'suche',
        // Optional: Pass the new models from user config if the worker supports overrides
        models: {
          embedding: '@cf/qwen/qwen3-embedding-0.6b',
          reranking: '@cf/baai/bge-reranker-base',
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Worker responded with ${response.status}`);
    }

    let data = await response.json();

    // Ensure data format and apply improvements
    if (data && Array.isArray(data.results)) {
      data.results = deduplicateResults(data.results);
      data.count = data.results.length;
    }

    return new Response(JSON.stringify(data), { headers: corsHeaders });
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
