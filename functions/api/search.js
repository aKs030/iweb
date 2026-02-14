/**
 * Cloudflare Pages Function - POST /api/search
 * Modern AI Search using Service Binding - Optimized & Reduced
 * @version 6.1.1
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

    // Try Vectorize + AI for intelligent search
    if (env.VECTOR_INDEX && env.AI) {
      try {
        console.log('Using Vectorize + AI for query:', query);

        // Generate embedding for the query using Cloudflare AI
        const embeddingResponse = await env.AI.run(
          '@cf/baai/bge-base-en-v1.5',
          {
            text: query,
          },
        );

        const queryVector = embeddingResponse.data[0];

        // Search in Vectorize
        const vectorResults = await env.VECTOR_INDEX.query(queryVector, {
          topK: topK,
          returnMetadata: true,
        });

        if (vectorResults.matches && vectorResults.matches.length > 0) {
          // Convert Vectorize results to our format
          const results = vectorResults.matches.map((match) => ({
            url: match.metadata?.url || '/',
            title: match.metadata?.title || 'Seite',
            category: match.metadata?.category || 'Seite',
            description: match.metadata?.description || '',
            score: match.score || 0,
          }));

          const improvedResults = deduplicateResults(results);

          // Generate AI summary
          let summary = `Suchergebnisse für "${query}"`;
          try {
            const summaryPrompt = `Basierend auf der Suchanfrage "${query}" wurden ${improvedResults.length} Ergebnisse gefunden. Erstelle eine kurze, hilfreiche Zusammenfassung (max. 2 Sätze) auf Deutsch.`;
            const summaryResponse = await env.AI.run(
              '@cf/meta/llama-3.1-8b-instruct',
              {
                messages: [
                  {
                    role: 'system',
                    content:
                      'Du bist ein hilfreicher Assistent. Antworte kurz und präzise auf Deutsch.',
                  },
                  { role: 'user', content: summaryPrompt },
                ],
              },
            );
            summary =
              summaryResponse?.response || `Suchergebnisse für "${query}"`;
          } catch (summaryError) {
            console.warn('AI summary generation failed:', summaryError.message);
          }

          return new Response(
            JSON.stringify({
              results: improvedResults,
              summary: summary,
              count: improvedResults.length,
              query: query,
            }),
            { headers: corsHeaders },
          );
        }
      } catch (error) {
        console.error('Vectorize search error:', error.message);
        // Fall through to static results
      }
    }

    // Fallback: Return static results if Vectorize is not available or empty
    console.log(
      'Using static fallback for query:',
      query,
      'Vectorize available:',
      !!env.VECTOR_INDEX,
    );

    const staticResults = [
      {
        url: '/',
        title: 'Startseite',
        category: 'Home',
        description: 'Willkommen auf dem Portfolio von Abdulkerim Sesli.',
        score: 1.0,
      },
      {
        url: '/projekte',
        title: 'Projekte',
        category: 'Projekte',
        description: 'Webentwicklungsprojekte und Coding-Arbeiten.',
        score: 0.9,
      },
      {
        url: '/blog',
        title: 'Blog',
        category: 'Blog',
        description: 'Technische Artikel über Webentwicklung und Design.',
        score: 0.8,
      },
      {
        url: '/gallery',
        title: 'Galerie',
        category: 'Galerie',
        description: 'Urban Photography aus Berlin.',
        score: 0.7,
      },
      {
        url: '/videos',
        title: 'Videos',
        category: 'Videos',
        description: 'Motion Design und Video-Produktionen.',
        score: 0.6,
      },
    ];

    // Filter results based on query
    const lowerQuery = query.toLowerCase();
    const filteredResults = staticResults.filter(
      (r) =>
        r.title.toLowerCase().includes(lowerQuery) ||
        r.description.toLowerCase().includes(lowerQuery) ||
        r.category.toLowerCase().includes(lowerQuery),
    );

    const results =
      filteredResults.length > 0 ? filteredResults : staticResults;
    const finalResults = deduplicateResults(results.slice(0, topK));

    return new Response(
      JSON.stringify({
        results: finalResults,
        summary: `Suchergebnisse für "${query}"`,
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

export const onRequestOptions = handleOptions;
