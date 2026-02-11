/**
 * Cloudflare Pages Function - POST /api/search
 * Modern AI Search using Service Binding - Optimized & Reduced
 * @version 5.0.0
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
 * Hilft dabei, generische Titel ("Initialisiere System") durch echte Inhalte zu ersetzen.
 */
const URL_MAPPINGS = {
  // Hauptseiten
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

  // Videos
  '/videos/tImMPQKiQVk': {
    title: 'Logo Animation (Software Style)',
    category: 'Video',
  },
  '/videos/z8W9UJbUSo4': {
    title: 'Lunar Surface — Astrophotography',
    category: 'Video',
  },
  '/videos/clbOHUT4w5o': { title: 'Future Bot Animation', category: 'Video' },
  '/videos/UorHOTKWtK4': { title: 'Neon Robot Animation', category: 'Video' },
  '/videos/1bL8bZd6cpY': {
    title: 'Motion Design: Neon Bot Experiment',
    category: 'Video',
  },
  '/videos/lpictttLoEk': {
    title: 'Motion Graphics Test | After Effects',
    category: 'Video',
  },
  '/videos/rXMLVt9vhxQ': { title: 'Logo Animation Test 1', category: 'Video' },
};

function improveResult(result) {
  const url = result.url || '';
  const path = normalizeUrl(url);

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
      deduplicated.push(improveResult(result));
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

    // Modern Method: Use Service Binding exclusively
    const binding = env.AI_SEARCH;
    if (!binding) {
      throw new Error('AI_SEARCH Service Binding not configured');
    }

    const serviceResponse = await binding.fetch(
      new Request('http://ai-search/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          limit: topK,
          topK: topK,
          index: env.AI_SEARCH_INDEX || 'suche',
          ragId: env.RAG_ID || 'suche',
        }),
      }),
    );

    if (!serviceResponse.ok) {
      throw new Error(`AI Search Worker returned ${serviceResponse.status}`);
    }

    const data = await serviceResponse.json();

    // Robust extraction of results
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
