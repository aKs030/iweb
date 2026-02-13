/**
 * Cloudflare Pages Function - POST /api/search
 * Modern AI Search using Service Binding - Optimized & Reduced
 * @version 6.1.0
 */

import { getCorsHeaders, handleOptions } from './_cors.js';

function normalizeUrl(url) {
  if (!url) return '';
  try {
    // Handle relative and absolute URLs
    const base = 'https://abdulkerimsesli.de';
    const urlObj = new URL(url.startsWith('/') ? base + url : url);
    let path = urlObj.pathname;

    // Normalize: remove index.html, trailing slashes
    path = path.replace(/\/index\.html$/, '/').replace(/\/+$/, '') || '/';

    return path;
  } catch {
    // Robust fallback for unusual strings
    return (
      url
        .split(/[?#]/)[0]
        .replace(/^https?:\/\/(www\.)?abdulkerimsesli\.de/, '')
        .replace(/\/index\.html$/, '/')
        .replace(/\/$/, '') || '/'
    );
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

  return { ...result, title, category, description, url: path };
}

function deduplicateResults(results) {
  if (!Array.isArray(results)) return [];

  const pathMap = new Map();

  for (const result of results) {
    const path = normalizeUrl(result.url);
    const improved = improveResult(result);

    // If duplicate path, keep the one with higher score or already existing improved one
    if (
      !pathMap.has(path) ||
      (result.score || 0) > (pathMap.get(path).score || 0)
    ) {
      pathMap.set(path, improved);
    }
  }

  return Array.from(pathMap.values()).sort(
    (a, b) => (b.score || 0) - (a.score || 0),
  );
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request, env);

  try {
    const body = await request.json().catch(() => ({}));
    const query = body.query || '';
    const topK = parseInt(body.topK || env.MAX_SEARCH_RESULTS || '10');

    if (!query) {
      return new Response(JSON.stringify({ results: [], count: 0 }), {
        headers: corsHeaders,
      });
    }

    const binding = env.AI_SEARCH;
    if (!binding) {
      throw new Error('AI_SEARCH Service Binding not configured');
    }

    // Parallel fetch for results and AI summary (Modern RAG approach)
    const TIMEOUT_MS = 5000; // 5 second timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const [searchResponse, aiResponse] = await Promise.allSettled([
        binding.fetch(
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
            signal: controller.signal,
          }),
        ),
        binding.fetch(
          new Request('http://ai-search/api/ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: `Beantworte kurz die Suchanfrage: "${query}" basierend auf dem Portfolio von Abdulkerim.`,
              message: query,
              systemInstruction:
                "Du bist Abdulkerim's Portfolio-Assistent. Antworte extrem kurz (max 2 Sätze) auf Deutsch. Wenn die Frage nichts mit dem Portfolio zu tun hat, bleib höflich. Nutze Informationen über Projekte, Blog und Erfahrung.",
              ragId: env.RAG_ID || 'suche',
              maxResults: 5,
            }),
            signal: controller.signal,
          }),
        ),
      ]);

      clearTimeout(timeoutId);

      clearTimeout(timeoutId);

      // Handle Search Results
      let results = [];
      if (searchResponse.status === 'fulfilled' && searchResponse.value.ok) {
        const data = await searchResponse.value.json();
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
        }
      }

      // Handle AI Summary
      let summary = '';
      if (aiResponse.status === 'fulfilled' && aiResponse.value.ok) {
        const aiData = await aiResponse.value.json();
        summary = aiData.text || aiData.response || aiData.answer || '';
        if (!summary && aiData.data) summary = aiData.data.text || '';
      }

      const finalResults = deduplicateResults(results);

      return new Response(
        JSON.stringify({
          results: finalResults,
          summary: summary,
          count: finalResults.length,
          query: query,
        }),
        { headers: corsHeaders },
      );
    } catch (fetchError) {
      clearTimeout(timeoutId);
      throw fetchError;
    }
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
