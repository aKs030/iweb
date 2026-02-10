/**
 * Cloudflare Pages Function - POST /api/search
 * Modern AI Search with Service Binding (RPC) and Deduplication
 * @version 3.2.0
 */

const CANONICAL_WORKER_URL = 'https://api.abdulkerimsesli.de/api/search';
const FALLBACK_WORKER_URL =
  'https://ai-search-proxy.httpsgithubcomaks030website.workers.dev/api/search';

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

  // 1. Check for specific URL mappings first (highest priority)
  const mapping = URL_MAPPINGS[path];

  let title = result.title || 'Seite';
  let category = result.category || 'Seite';
  let description = result.description || '';

  // Wenn der Titel generisch ist oder den Lade-Text enthält, versuchen wir ihn zu verbessern
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
      (isGeneric ||
        !description ||
        description.includes('Initialisiere System') ||
        description.includes('Erfahren Sie mehr auf dieser Seite'))
    ) {
      description = mapping.description;
    }
  } else {
    // Dynamische Verbesserung basierend auf URL-Struktur (Fallback)
    if (url.includes('/blog/')) {
      const slug = url.split('/blog/')[1]?.replace(/\/$/, '');
      if (slug && slug !== 'index.html') {
        if (isGeneric)
          title = `Blog: ${slug.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}`;
        category = 'Blog';
      }
    } else if (url.includes('/projekte/')) {
      const slug = url.split('/projekte/')[1]?.replace(/\/$/, '');
      if (slug && slug !== 'index.html') {
        if (isGeneric)
          title = `Projekt: ${slug.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}`;
        category = 'Projekt';
      } else {
        title = 'Projekte Übersicht';
        category = 'Projekte';
      }
    } else if (url.includes('/videos/')) {
      const slug = url.split('/videos/')[1]?.replace(/\/$/, '');
      if (slug && slug !== 'index.html') {
        if (isGeneric) title = `Video: ${slug.toUpperCase()}`;
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
    } else if (path === '' || path === '/') {
      title = 'Startseite';
      category = 'Home';
    }
  }

  // Final cleanup: Remove the loader text or generic description
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
    const topK = parseInt(body.topK || env.MAX_SEARCH_RESULTS || '10');

    if (!query) {
      return new Response(JSON.stringify({ results: [], count: 0 }), {
        headers: corsHeaders,
      });
    }

    let data = { results: [], count: 0 };

    // 1. Try Service Binding (RPC or fallback fetch)
    const binding = env.AI_SEARCH || env.SEARCH_SERVICE || env.SEARCH;

    // Log presence of direct bindings for debug
    if (env.VECTOR_INDEX) console.log('Direct Vectorize binding detected');
    if (env.BUCKET) console.log('Direct R2 binding detected');

    // 1a. Try Direct Vectorize Search if enabled and bindings available
    if (
      env.VECTOR_INDEX &&
      env.AI &&
      (!data.results || data.results.length === 0)
    ) {
      try {
        console.log(`Direct Vectorize search for: "${query}"`);
        // Generate embedding for the query
        const embeddingResponse = await env.AI.run(
          '@cf/baai/bge-small-en-v1.5',
          { text: [query] },
        );
        const vector = embeddingResponse.data[0];

        if (vector) {
          const vectorMatches = await env.VECTOR_INDEX.query(vector, {
            topK: topK,
            returnMetadata: 'all',
          });

          if (vectorMatches && vectorMatches.matches) {
            data.results = vectorMatches.matches.map((match) => ({
              title: match.metadata?.title || 'Suchergebnis',
              url: match.metadata?.url || '',
              category: match.metadata?.category || 'Seite',
              description: match.metadata?.description || '',
              score: match.score,
            }));
            data.count = data.results.length;
            console.log(
              `Direct Vectorize search returned ${data.count} results`,
            );
          }
        }
      } catch (e) {
        console.error('Direct Vectorize search error:', e.message);
      }
    }

    if (binding && (!data.results || data.results.length === 0)) {
      try {
        if (typeof binding.search === 'function') {
          console.log(`Searching via binding RPC for: "${query}"`);
          const bindingData = await binding.search(query, {
            index: env.AI_SEARCH_INDEX || 'suche',
            limit: topK,
            ragId: env.RAG_ID || 'suche',
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

    // 2. Fallback to Worker Fetch (Try Canonical then Fallback URL)
    if (!data.results || data.results.length === 0) {
      const urlsToTry = [CANONICAL_WORKER_URL, FALLBACK_WORKER_URL];

      for (const url of urlsToTry) {
        try {
          console.log(`Falling back to Worker fetch: ${url} for: "${query}"`);
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 8000);

          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              query,
              topK,
              index: env.AI_SEARCH_INDEX || 'suche',
            }),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (response.ok) {
            const workerData = await response.json();
            if (workerData && Array.isArray(workerData.results)) {
              data = workerData;
              console.log(`Successfully received search results from ${url}`);
              break;
            }
          } else {
            console.error(
              `Worker fetch failed for ${url} with status: ${response.status}`,
            );
          }
        } catch (e) {
          console.error(`Fallback fetch failed for ${url}:`, e.message);
        }
      }
    }

    // Ensure results is always an array and deduplicated
    if (data) {
      // Handle cases where data might be a JSON string
      if (typeof data === 'string') {
        try {
          data = JSON.parse(data);
        } catch {
          data = { results: [], count: 0 };
        }
      }

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
