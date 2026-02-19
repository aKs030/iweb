/**
 * Cloudflare Pages Function - POST /api/search
 * AI Search using Cloudflare AI Search Beta via Workers Binding
 * Hybrid AI + Local merge with description enrichment
 * @version 14.0.0
 */

import { getCorsHeaders, handleOptions } from './_cors.js';
import {
  expandQuery,
  calculateRelevanceScore,
  normalizeUrl,
  createSnippet,
  highlightMatches,
  isLowQualitySnippet,
} from './_search-utils.js';

/**
 * Local search index covering all pages and apps.
 * Used as fallback when env.AI is unavailable AND as enrichment source
 * to fill coverage gaps in the RAG index (e.g. ?app= routes).
 */
const LOCAL_SEARCH_DOCUMENTS = [
  // ── Pages ──
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

  // ── Blog Posts ──
  {
    url: '/blog/threejs-performance',
    title: 'Three.js Performance',
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
    title: 'CSS Container Queries',
    category: 'Blog',
    description:
      'Container Queries in CSS: responsive Komponenten ohne starre Viewport-Breakpoints.',
    keywords: ['css', 'container queries', 'responsive', 'ui'],
  },
  {
    url: '/blog/react-no-build',
    title: 'React ohne Build',
    category: 'Blog',
    description:
      'Wie React-Prototypen ohne Build-Step entwickelt werden können.',
    keywords: ['react', 'no build', 'javascript', 'frontend'],
  },
  {
    url: '/blog/modern-ui-design',
    title: 'Modern UI Design',
    category: 'Blog',
    description:
      'Gestaltungsprinzipien für moderne UI-Systeme und bessere Benutzerführung.',
    keywords: ['design', 'ui', 'ux', 'interface', 'modern'],
  },
  {
    url: '/blog/javascript-performance-patterns',
    title: 'JavaScript Performance Patterns',
    category: 'Blog',
    description:
      'Praktische JavaScript-Patterns für schnelle, stabile Frontend-Anwendungen.',
    keywords: ['javascript', 'performance', 'patterns', 'frontend'],
  },
  {
    url: '/blog/seo-technische-optimierung',
    title: 'SEO Technische Optimierung',
    category: 'Blog',
    description:
      'Technische SEO-Strategien für bessere Sichtbarkeit in Suchmaschinen.',
    keywords: [
      'seo',
      'google',
      'meta',
      'ranking',
      'suchmaschine',
      'optimierung',
    ],
  },
  {
    url: '/blog/typescript-advanced-patterns',
    title: 'TypeScript Advanced Patterns',
    category: 'Blog',
    description:
      'Fortgeschrittene TypeScript-Patterns für typsichere, skalierbare Projekte.',
    keywords: ['typescript', 'ts', 'types', 'generics', 'advanced', 'patterns'],
  },
  {
    url: '/blog/web-components-zukunft',
    title: 'Web Components Zukunft',
    category: 'Blog',
    description:
      'Web Components als zukunftssichere Lösung für wiederverwendbare UI-Bausteine.',
    keywords: ['web components', 'custom elements', 'shadow dom', 'html'],
  },
  {
    url: '/blog/visual-storytelling',
    title: 'Visual Storytelling',
    category: 'Blog',
    description:
      'Visuelles Storytelling im Web – mit Animationen, Scroll-Effekten und Design.',
    keywords: ['storytelling', 'visual', 'animation', 'scroll', 'design'],
  },

  // ── Projekte / Apps ──
  {
    url: '/projekte/?app=calculator',
    title: 'Taschenrechner',
    category: 'Projekte',
    description:
      'Moderner Taschenrechner mit erweiterten Funktionen. Grundrechenarten und wissenschaftliche Operationen.',
    keywords: ['calculator', 'taschenrechner', 'rechner', 'math', 'tool'],
  },
  {
    url: '/projekte/?app=color-changer',
    title: 'Color Changer',
    category: 'Projekte',
    description:
      'Dynamische Hintergrundfarben per Klick. Entdecke schöne Farbkombinationen und Gradienten.',
    keywords: ['farben', 'color', 'gradient', 'design', 'css'],
  },
  {
    url: '/projekte/?app=memory-game',
    title: 'Memory Spiel',
    category: 'Projekte',
    description:
      'Klassisches Memory-Spiel mit verschiedenen Schwierigkeitsgraden. Trainiere dein Gedächtnis!',
    keywords: ['memory', 'spiel', 'game', 'karten', 'gedächtnis'],
  },
  {
    url: '/projekte/?app=paint-app',
    title: 'Paint App',
    category: 'Projekte',
    description:
      'Einfaches Zeichenprogramm mit verschiedenen Farben und Pinselgrößen.',
    keywords: ['paint', 'zeichnen', 'canvas', 'malen', 'art'],
  },
  {
    url: '/projekte/?app=password-generator',
    title: 'Passwort Generator',
    category: 'Projekte',
    description:
      'Sicherer Passwort-Generator mit anpassbaren Optionen. Erstelle starke Passwörter für maximale Sicherheit.',
    keywords: ['passwort', 'password', 'security', 'generator', 'sicherheit'],
  },
  {
    url: '/projekte/?app=pong-game',
    title: 'Pong Spiel',
    category: 'Projekte',
    description:
      'Klassisches Pong-Spiel mit KI-Gegner, Physics Engine und Canvas-Rendering.',
    keywords: ['pong', 'spiel', 'game', 'arcade', 'retro', 'canvas'],
  },
  {
    url: '/projekte/?app=quiz-app',
    title: 'Quiz App',
    category: 'Projekte',
    description:
      'Interaktive Quiz-App mit verschiedenen Kategorien und Schwierigkeitsgraden.',
    keywords: ['quiz', 'wissen', 'trivia', 'fragen', 'game'],
  },
  {
    url: '/projekte/?app=schere-stein-papier',
    title: 'Schere Stein Papier',
    category: 'Projekte',
    description:
      'Der Klassiker gegen den Computer! Wähle Schere, Stein oder Papier und tritt gegen die KI an.',
    keywords: ['schere', 'stein', 'papier', 'spiel', 'game'],
  },
  {
    url: '/projekte/?app=snake-game',
    title: 'Snake Spiel',
    category: 'Projekte',
    description:
      'Klassisches Snake-Spiel mit Canvas, Game Loop und Kollisionserkennung.',
    keywords: ['snake', 'schlange', 'spiel', 'game', 'arcade', 'retro'],
  },
  {
    url: '/projekte/?app=tic-tac-toe',
    title: 'Tic Tac Toe',
    category: 'Projekte',
    description: 'Klassisches Tic-Tac-Toe Spiel für zwei Spieler.',
    keywords: ['tic-tac-toe', 'spiel', 'game', 'strategie'],
  },
  {
    url: '/projekte/?app=timer-app',
    title: 'Timer App',
    category: 'Projekte',
    description:
      'Vielseitige Timer-App mit Countdown, Stoppuhr und Pomodoro-Technik.',
    keywords: ['timer', 'countdown', 'stoppuhr', 'pomodoro', 'productivity'],
  },
  {
    url: '/projekte/?app=todo-liste',
    title: 'Todo Liste',
    category: 'Projekte',
    description:
      'Produktivitäts-Tool zum Verwalten von Aufgaben. Erstelle, bearbeite und organisiere deine To-Dos.',
    keywords: ['todo', 'aufgaben', 'tasks', 'planer', 'productivity'],
  },
  {
    url: '/projekte/?app=typing-speed-test',
    title: 'Typing Speed Test',
    category: 'Projekte',
    description: 'Teste deine Tippgeschwindigkeit (WPM) mit zufälligen Sätzen.',
    keywords: ['typing', 'tippen', 'wpm', 'speed', 'tastatur'],
  },
  {
    url: '/projekte/?app=weather-app',
    title: 'Wetter App',
    category: 'Projekte',
    description:
      'Moderne Wetter-App mit aktuellen Wetterdaten und 5-Tage-Vorhersage.',
    keywords: ['wetter', 'weather', 'forecast', 'temperatur', 'vorhersage'],
  },
  {
    url: '/projekte/?app=zahlen-raten',
    title: 'Zahlen Raten',
    category: 'Projekte',
    description:
      'Finde die geheime Zahl zwischen 1 und 100. Ein klassisches Ratespiel mit Hinweisen.',
    keywords: ['zahlen', 'raten', 'spiel', 'game', 'puzzle', 'logik'],
  },
];

/**
 * Build a lookup map from the local index for fast URL → document access.
 * @returns {Map<string, Object>}
 */
function buildLocalLookup() {
  const map = new Map();
  for (const doc of LOCAL_SEARCH_DOCUMENTS) {
    map.set(doc.url, doc);
  }
  return map;
}

const LOCAL_LOOKUP = buildLocalLookup();

// ── Local scoring ──────────────────────────────────────────────────────────

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

    const snippet = createSnippet(
      `${document.description} ${(document.keywords || []).join(' ')}`.trim(),
      originalQuery,
      160,
    );
    const description = snippet || document.description;
    const highlightedDescription = highlightMatches(description, originalQuery);

    const result = {
      url: document.url,
      title: document.title,
      category: document.category || 'Seite',
      description,
      highlightedDescription,
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

// ── Enrichment helpers ─────────────────────────────────────────────────────

/**
 * Enrich an AI result with data from the local index when the AI snippet
 * is low quality or the title is a generic slug.
 * @param {Object} result - The AI-produced search result
 * @returns {Object} Enriched result
 */
function enrichFromLocalIndex(result) {
  const localDoc = LOCAL_LOOKUP.get(result.url);
  if (!localDoc) return result;

  const enriched = { ...result };

  // Replace low-quality descriptions with hand-written ones
  if (isLowQualitySnippet(result.description)) {
    enriched.description = localDoc.description;
    enriched.highlightedDescription = localDoc.description;
  }

  // Replace generic kebab-case titles
  if (localDoc.title && localDoc.title !== result.title) {
    const isGenericTitle =
      !result.title ||
      result.title === 'Index' ||
      result.title.includes('-') ||
      result.title.length < 3;
    if (isGenericTitle) {
      enriched.title = localDoc.title;
    }
  }

  // Use local category if missing
  if (
    (!enriched.category || enriched.category === 'Seite') &&
    localDoc.category
  ) {
    enriched.category = localDoc.category;
  }

  return enriched;
}

/**
 * Merge AI results with local results to fill coverage gaps.
 * Local results for URLs not already present in AI results are appended
 * with a slight score penalty so AI results rank first when quality is equal.
 * @param {Object[]} aiResults - Processed AI search results
 * @param {Object[]} localResults - Local fallback search results
 * @returns {Object[]} Merged and de-duplicated results
 */
function mergeWithLocalResults(aiResults, localResults) {
  const seenUrls = new Set(aiResults.map((r) => r.url));
  const merged = [...aiResults];

  for (const local of localResults) {
    if (seenUrls.has(local.url)) continue;
    seenUrls.add(local.url);
    // Slight penalty so AI results stay on top when scores are close
    merged.push({ ...local, score: local.score * 0.85, source: 'local' });
  }

  return merged;
}

// ── Category detection ─────────────────────────────────────────────────────

function detectCategory(url) {
  if (url.includes('/projekte')) return 'Projekte';
  if (url.includes('/blog')) return 'Blog';
  if (url.includes('/gallery')) return 'Galerie';
  if (url.includes('/videos')) return 'Videos';
  if (url.includes('/about')) return 'Über mich';
  if (url.includes('/contact')) return 'Kontakt';
  if (url === '/') return 'Home';
  return 'Seite';
}

// ── Title extraction ───────────────────────────────────────────────────────

const TOP_LEVEL_TITLE_MAP = {
  projekte: 'Projekte Übersicht',
  blog: 'Blog Übersicht',
  gallery: 'Galerie',
  videos: 'Videos Übersicht',
  about: 'Über mich',
  contact: 'Kontakt',
};

function extractTitle(filename, url) {
  const title = filename?.split('/').pop()?.replace('.html', '') || '';

  if (title === 'index' || title === '' || !title) {
    const segments = url.split('/').filter(Boolean);

    if (url === '/') {
      return 'Startseite';
    }

    if (segments.length === 1) {
      return (
        TOP_LEVEL_TITLE_MAP[segments[0]] ||
        segments[0].charAt(0).toUpperCase() + segments[0].slice(1)
      );
    }

    if (segments.length >= 2) {
      const lastSegment = segments[segments.length - 1];
      return lastSegment
        .split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    }
  }

  // Convert existing kebab-case to Title Case
  return title
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// ── Main handler ───────────────────────────────────────────────────────────

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

    // Expand query with synonyms
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

    // ── AI Search (Cloudflare AutoRAG) ──────────────────────────────────

    const ragId = env.RAG_ID || 'wispy-pond-1055';

    const searchData = await env.AI.autorag(ragId).aiSearch({
      query: expandedQuery,
      max_num_results: Math.max(topK, 15),
      rewrite_query: true,
      stream: false,
      system_prompt:
        'Du bist ein Suchassistent für abdulkerimsesli.de. Fasse die Suchergebnisse in 1-2 prägnanten Sätzen zusammen (max. 120 Zeichen). Fokussiere auf die wichtigsten Inhalte und vermeide generische Aussagen.',
    });

    // Transform AI response to our format
    const aiResults = (searchData.data || []).map((item) => {
      let url = normalizeUrl(item.filename);
      if (url === '/search' || url === '/api/search') {
        url = '/';
      }

      // Extract text content from multiple possible sources
      let textContent = '';
      if (item.content && Array.isArray(item.content)) {
        textContent = item.content.map((c) => c.text || '').join(' ');
      }
      if (!textContent && item.text) {
        textContent = item.text;
      }
      if (!textContent && item.description) {
        textContent = item.description;
      }

      // Smart snippet focused on the original query
      const snippet = createSnippet(textContent, query, 160);
      const description = snippet || '';
      const highlightedDescription = highlightMatches(
        description || 'Keine Beschreibung verfügbar',
        query,
      );

      return {
        url,
        title: extractTitle(item.filename, url),
        category: detectCategory(url),
        description,
        highlightedDescription,
        score: item.score || 0,
      };
    });

    // ── Deduplicate AI results ──────────────────────────────────────────

    const uniqueAiResults = [];
    const seenUrls = new Set();

    for (const result of aiResults) {
      if (seenUrls.has(result.url)) continue;
      seenUrls.add(result.url);
      uniqueAiResults.push(result);
    }

    // ── Hybrid merge: AI + local results ────────────────────────────────

    const localResults = runLocalFallbackSearch(expandedQuery, query, topK);
    const mergedResults = mergeWithLocalResults(uniqueAiResults, localResults);

    // ── Enrich from local index (fix bad descriptions / titles) ─────────

    const enrichedResults = mergedResults.map((result) => {
      const enriched = enrichFromLocalIndex(result);

      // Re-highlight after enrichment
      if (enriched.description !== result.description) {
        enriched.highlightedDescription = highlightMatches(
          enriched.description,
          query,
        );
      }

      return enriched;
    });

    // ── Score, sort, filter ─────────────────────────────────────────────

    const scoredResults = enrichedResults
      .map((result) => ({
        ...result,
        score: calculateRelevanceScore(result, query),
      }))
      .sort((a, b) => b.score - a.score);

    // Threshold 1.0 ensures only meaningful matches survive
    const RELEVANCE_THRESHOLD = 1.0;
    const relevantResults = scoredResults.filter(
      (result) => result.score >= RELEVANCE_THRESHOLD,
    );

    // Limit per category to avoid spam
    const categoryCount = {};
    const MAX_PER_CATEGORY = 5;
    const finalResults = relevantResults.filter((result) => {
      const cat = result.category || 'Seite';
      categoryCount[cat] = (categoryCount[cat] || 0) + 1;
      return categoryCount[cat] <= MAX_PER_CATEGORY;
    });

    // Remove internal fields before response
    const cleanResults = finalResults.map(
      ({ source: _source, ...rest }) => rest,
    );

    const responseData = {
      results: cleanResults,
      summary: searchData.response
        ? searchData.response.trim().substring(0, 150)
        : `${cleanResults.length} ${cleanResults.length === 1 ? 'Ergebnis' : 'Ergebnisse'} für "${query}"`,
      count: cleanResults.length,
      query: query,
      expandedQuery: expandedQuery !== query ? expandedQuery : undefined,
    };

    return new Response(JSON.stringify(responseData), {
      headers: {
        ...corsHeaders,
        'Cache-Control': 'public, max-age=300',
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
