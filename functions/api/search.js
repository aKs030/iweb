/**
 * Cloudflare Pages Function - POST /api/search
 * AI Search using Cloudflare AI Search Beta via Workers Binding
 * Enhanced with query expansion, fuzzy matching, and relevance scoring
 * @version 12.1.0
 */

import { getCorsHeaders, handleOptions } from './_cors.js';
import {
  expandQuery,
  calculateRelevanceScore,
  normalizeUrl,
  createSnippet,
} from './_search-utils.js';

/**
 * Local fallback index for development environments without AI binding.
 * Keeps local search useful when env.AI/autorag is unavailable.
 */
const LOCAL_SEARCH_DOCUMENTS = [
  {
    url: '/',
    title: 'Startseite',
    category: 'Home',
    description:
      'Portfolio von Abdulkerim Sesli mit 3D Earth Visualisierung, Projekten und Blog.',
    keywords: [
      'home',
      'startseite',
      'portfolio',
      'webentwicklung',
      'three.js',
      '3d',
      'pwa',
    ],
  },
  {
    url: '/projekte',
    title: 'Projekte Übersicht',
    category: 'Projekte',
    description:
      'Interaktive Webprojekte wie Games, Tools und kreative Frontend-Experimente.',
    keywords: ['projekte', 'portfolio', 'apps', 'javascript', 'tools', 'web'],
  },
  {
    url: '/blog',
    title: 'Blog Übersicht',
    category: 'Blog',
    description:
      'Blog mit Artikeln zu Performance, Three.js, CSS, React und moderner Webentwicklung.',
    keywords: [
      'blog',
      'artikel',
      'posts',
      'threejs',
      'react',
      'css',
      'performance',
    ],
  },
  {
    url: '/blog/threejs-performance',
    title: 'Threejs Performance',
    category: 'Blog',
    description:
      'Optimierungsstrategien für performante Three.js und WebGL Anwendungen.',
    keywords: ['threejs', 'three.js', 'webgl', 'performance', '3d'],
  },
  {
    url: '/blog/progressive-web-apps-2026',
    title: 'Progressive Web Apps 2026',
    category: 'Blog',
    description:
      'Trends und Praxiswissen zu Progressive Web Apps, Offline-Funktionen und Caching.',
    keywords: ['pwa', 'service worker', 'offline', 'performance', 'web apps'],
  },
  {
    url: '/blog/css-container-queries',
    title: 'Css Container Queries',
    category: 'Blog',
    description:
      'Container Queries in CSS: responsive Komponenten ohne starre Viewport-Breakpoints.',
    keywords: ['css', 'container queries', 'responsive', 'ui'],
  },
  {
    url: '/blog/react-no-build',
    title: 'React No Build',
    category: 'Blog',
    description:
      'Wie React-Prototypen ohne Build-Step entwickelt werden können.',
    keywords: ['react', 'no build', 'javascript', 'frontend'],
  },
  {
    url: '/blog/modern-ui-design',
    title: 'Modern Ui Design',
    category: 'Blog',
    description:
      'Gestaltungsprinzipien für moderne UI-Systeme und bessere Benutzerführung.',
    keywords: ['design', 'ui', 'ux', 'interface', 'modern'],
  },
  {
    url: '/blog/javascript-performance-patterns',
    title: 'Javascript Performance Patterns',
    category: 'Blog',
    description:
      'Praktische JavaScript-Patterns für schnelle, stabile Frontend-Anwendungen.',
    keywords: ['javascript', 'performance', 'patterns', 'frontend'],
  },
  {
    url: '/gallery',
    title: 'Galerie',
    category: 'Galerie',
    description:
      'Fotogalerie mit kuratierten Aufnahmen und interaktiver Darstellung.',
    keywords: ['galerie', 'bilder', 'fotos', 'fotografie', 'photos'],
  },
  {
    url: '/videos',
    title: 'Videos Übersicht',
    category: 'Videos',
    description:
      'Video-Bereich mit YouTube-Inhalten, Projektdemos und Highlights.',
    keywords: ['videos', 'youtube', 'clips', 'aufnahmen'],
  },
  {
    url: '/about',
    title: 'Über mich',
    category: 'Über mich',
    description:
      'Informationen über Abdulkerim Sesli, Skills, Tech Stack und Arbeitsweise.',
    keywords: ['about', 'über', 'profil', 'skills', 'tech stack'],
  },
  {
    url: '/contact',
    title: 'Kontakt',
    category: 'Kontakt',
    description:
      'Kontaktmöglichkeiten für Projektanfragen, Zusammenarbeit und Feedback.',
    keywords: ['kontakt', 'contact', 'email', 'formular', 'anfrage'],
  },
  {
    url: '/impressum',
    title: 'Impressum',
    category: 'Seite',
    description: 'Rechtliche Angaben und Anbieterkennzeichnung.',
    keywords: ['impressum', 'rechtlich', 'anbieterkennzeichnung'],
  },
  {
    url: '/datenschutz',
    title: 'Datenschutz',
    category: 'Seite',
    description:
      'Informationen zur Datenverarbeitung und Datenschutzrichtlinien.',
    keywords: ['datenschutz', 'privacy', 'cookies', 'tracking'],
  },
];

function scoreLocalDocument(document, normalizedQuery, queryTerms) {
  const title = String(document.title || '').toLowerCase();
  const url = String(document.url || '').toLowerCase();
  const description = String(document.description || '').toLowerCase();
  const keywords = Array.isArray(document.keywords)
    ? document.keywords.join(' ').toLowerCase()
    : '';

  let score = 0;

  if (title.includes(normalizedQuery)) score += 14;
  if (url.includes(normalizedQuery)) score += 10;
  if (description.includes(normalizedQuery)) score += 7;
  if (keywords.includes(normalizedQuery)) score += 8;

  for (const term of queryTerms) {
    if (!term) continue;
    if (title.includes(term)) score += 5;
    if (url.includes(term)) score += 4;
    if (description.includes(term)) score += 3;
    if (keywords.includes(term)) score += 4;
  }

  return score;
}

function runLocalFallbackSearch(expandedQuery, originalQuery, topK) {
  const normalizedQuery = String(expandedQuery || '')
    .toLowerCase()
    .trim();
  const queryTerms = normalizedQuery.split(/\s+/).filter(Boolean);

  if (!normalizedQuery) {
    return [];
  }

  const maxResults = Number.isFinite(topK) && topK > 0 ? topK : 10;

  return LOCAL_SEARCH_DOCUMENTS.map((document) => {
    const baseScore = scoreLocalDocument(document, normalizedQuery, queryTerms);
    if (baseScore <= 0) return null;

    const description = createSnippet(
      `${document.description} ${(document.keywords || []).join(' ')}`.trim(),
      originalQuery,
      160,
    );

    const result = {
      url: document.url,
      title: document.title,
      category: document.category || 'Seite',
      description: description || document.description,
      score: baseScore,
    };

    return {
      ...result,
      score: calculateRelevanceScore(result, originalQuery),
    };
  })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);
}

export async function onRequestPost(context) {
  const request = context.request;
  const env = context.env || {};
  const corsHeaders = getCorsHeaders(request, env);

  try {
    const body = await request.json().catch(() => ({}));
    const query = body.query || '';

    if (!query) {
      return new Response(JSON.stringify({ results: [], count: 0 }), {
        headers: corsHeaders,
      });
    }

    const parsePositiveInteger = (value) => {
      const normalized = String(value ?? '').trim();

      if (!/^\d+$/.test(normalized)) {
        return null;
      }

      const parsed = Number.parseInt(normalized, 10);
      return parsed > 0 ? parsed : null;
    };

    const topK =
      parsePositiveInteger(body.topK) ??
      parsePositiveInteger(env.MAX_SEARCH_RESULTS) ??
      10;

    // Expand query with synonyms and fuzzy matching
    const expandedQuery = expandQuery(query);

    // Local fallback for environments without AI binding (e.g. node dev server)
    if (!env.AI || typeof env.AI.autorag !== 'function') {
      const fallbackResults = runLocalFallbackSearch(
        expandedQuery,
        query,
        topK,
      );

      return new Response(
        JSON.stringify({
          results: fallbackResults,
          summary:
            fallbackResults.length > 0
              ? `${fallbackResults.length} ${fallbackResults.length === 1 ? 'Ergebnis' : 'Ergebnisse'} für "${query}" (lokale Suche)`
              : `Keine lokalen Treffer für "${query}"`,
          count: fallbackResults.length,
          query,
          expandedQuery: expandedQuery !== query ? expandedQuery : undefined,
          source: 'local-fallback',
        }),
        {
          headers: {
            ...corsHeaders,
            'Cache-Control': 'no-store',
          },
        },
      );
    }

    // Use Workers Binding to call AI Search Beta
    const ragId = env.RAG_ID || 'wispy-pond-1055';

    const searchData = await env.AI.autorag(ragId).aiSearch({
      query: expandedQuery,
      max_num_results: Math.max(topK, 15), // Mindestens 15 für bessere Abdeckung
      rewrite_query: true,
      stream: false,
      system_prompt:
        'Du bist ein Suchassistent für abdulkerimsesli.de. Fasse die Suchergebnisse in 1-2 prägnanten Sätzen zusammen (max. 120 Zeichen). Fokussiere auf die wichtigsten Inhalte und vermeide generische Aussagen.',
    });

    // Transform AI Search Beta response to our format
    const results = (searchData.data || []).map((item) => {
      // Use helper to normalize URL and avoid dead search-self links
      let url = normalizeUrl(item.filename);
      if (url === '/search' || url === '/api/search') {
        url = '/';
      }

      // Extract text content from multiple possible sources
      let textContent = '';

      // Try content array first
      if (item.content && Array.isArray(item.content)) {
        textContent = item.content.map((c) => c.text || '').join(' ');
      }

      // Fallback to other possible fields
      if (!textContent && item.text) {
        textContent = item.text;
      }

      if (!textContent && item.description) {
        textContent = item.description;
      }

      // Create a smart snippet focused on the query
      // Use original query for highlighting to avoid synonym confusion
      const snippet = createSnippet(textContent, query, 160);

      // Determine category from URL with better mapping
      let category = 'Seite';
      if (url.includes('/projekte')) category = 'Projekte';
      else if (url.includes('/blog')) category = 'Blog';
      else if (url.includes('/gallery')) category = 'Galerie';
      else if (url.includes('/videos')) category = 'Videos';
      else if (url.includes('/about')) category = 'Über mich';
      else if (url.includes('/contact')) category = 'Kontakt';
      else if (url === '/') category = 'Home';

      // Improved title extraction with better fallbacks
      let title = item.filename?.split('/').pop()?.replace('.html', '') || '';

      // Smart title mapping based on URL patterns
      if (title === 'index' || title === '' || !title) {
        const segments = url.split('/').filter(Boolean);

        if (url === '/') {
          title = 'Startseite';
        } else if (segments.length === 1) {
          // Top-level pages: /projekte, /blog, etc.
          const titleMap = {
            projekte: 'Projekte Übersicht',
            blog: 'Blog Übersicht',
            gallery: 'Galerie',
            videos: 'Videos Übersicht',
            about: 'Über mich',
            contact: 'Kontakt',
          };
          title =
            titleMap[segments[0]] ||
            segments[0].charAt(0).toUpperCase() + segments[0].slice(1);
        } else if (segments.length >= 2) {
          // Sub-pages: /blog/threejs-performance, /videos/1bl8bzd6cpy
          const lastSegment = segments[segments.length - 1];
          // Convert kebab-case to Title Case
          title = lastSegment
            .split('-')
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
        }
      } else {
        // Convert existing title from kebab-case to Title Case
        title = title
          .split('-')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
      }

      return {
        url: url,
        title: title,
        category: category,
        description: snippet || 'Keine Beschreibung verfügbar',
        score: item.score || 0,
      };
    });

    // Remove duplicates based on URL only (vereinfacht für bessere Abdeckung)
    const uniqueResults = [];
    const seenUrls = new Set();

    for (const result of results) {
      // Skip if URL already seen
      if (seenUrls.has(result.url)) {
        continue;
      }

      seenUrls.add(result.url);
      uniqueResults.push(result);
    }

    // Calculate enhanced relevance scores and sort
    const scoredResults = uniqueResults
      .map((result) => ({
        ...result,
        score: calculateRelevanceScore(result, query),
      }))
      .sort((a, b) => b.score - a.score);

    // Filter out low relevance results
    // Threshold 1.0 ensures we only keep results that:
    // 1. Have a text match (score boosted > 2.0)
    // 2. OR have a high vector similarity (> 0.6) which triggers static boosts (> 1.6)
    const RELEVANCE_THRESHOLD = 1.0;
    const relevantResults = scoredResults.filter(
      (result) => result.score >= RELEVANCE_THRESHOLD,
    );

    // Limit results per category to avoid spam (erhöht für bessere Abdeckung)
    const categoryCount = {};
    const MAX_PER_CATEGORY = 5; // Erhöht von 3 auf 5
    const finalResults = relevantResults.filter((result) => {
      const cat = result.category || 'Seite';
      categoryCount[cat] = (categoryCount[cat] || 0) + 1;
      return categoryCount[cat] <= MAX_PER_CATEGORY;
    });

    const responseData = {
      results: finalResults,
      summary: searchData.response
        ? searchData.response.trim().substring(0, 150)
        : `${finalResults.length} ${finalResults.length === 1 ? 'Ergebnis' : 'Ergebnisse'} für "${query}"`,
      count: finalResults.length,
      query: query,
      expandedQuery: expandedQuery !== query ? expandedQuery : undefined,
    };

    return new Response(JSON.stringify(responseData), {
      headers: {
        ...corsHeaders,
        'Cache-Control': 'public, max-age=300', // 5 minutes browser cache
      },
    });
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
