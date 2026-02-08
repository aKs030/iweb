/**
 * Cloudflare Pages Function - POST /api/search
 * Proxy zu Cloudflare AI Search Worker mit Deduplizierung
 */

const WORKER_URL =
  'https://ai-search-proxy.httpsgithubcomaks030website.workers.dev/api/search';

/**
 * Dedupliziert Ergebnisse basierend auf URL
 */
function deduplicateResults(results) {
  const seen = new Set();
  const deduplicated = [];

  for (const result of results) {
    // Normalisiere URL (entferne trailing slash)
    const normalizedUrl = result.url.replace(/\/$/, '');

    if (!seen.has(normalizedUrl)) {
      seen.add(normalizedUrl);
      deduplicated.push(result);
    }
  }

  return deduplicated;
}

/**
 * Verbessert Titel basierend auf URL
 */
function improveTitle(result) {
  const url = result.url;

  // Extrahiere Seitennamen aus URL
  if (url.includes('/blog/')) {
    const slug = url.split('/blog/')[1]?.replace(/\/$/, '');
    if (slug) {
      return {
        ...result,
        title: `Blog: ${slug.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}`,
        category: 'Blog',
      };
    }
  }

  if (url.includes('/projekte/')) {
    const slug = url.split('/projekte/')[1]?.replace(/\/$/, '');
    if (slug) {
      return {
        ...result,
        title: `Projekt: ${slug.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}`,
        category: 'Projekt',
      };
    }
    return { ...result, title: 'Projekte Übersicht', category: 'Projekte' };
  }

  if (url.includes('/videos/')) {
    const slug = url.split('/videos/')[1]?.replace(/\/$/, '');
    if (slug) {
      return {
        ...result,
        title: `Video: ${slug.toUpperCase()}`,
        category: 'Video',
      };
    }
    return { ...result, title: 'Videos Übersicht', category: 'Videos' };
  }

  if (url.includes('/gallery/')) {
    return { ...result, title: 'Fotogalerie', category: 'Galerie' };
  }

  if (url.includes('/about/')) {
    return { ...result, title: 'Über mich', category: 'About' };
  }

  if (url.endsWith('/') && url.split('/').length === 4) {
    return { ...result, title: 'Startseite', category: 'Home' };
  }

  return result;
}

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();

    // Proxy zum Worker
    const response = await fetch(WORKER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    // Dedupliziere und verbessere Ergebnisse
    if (data.results && Array.isArray(data.results)) {
      let improved = data.results.map(improveTitle);
      improved = deduplicateResults(improved);
      data.results = improved;
      data.count = improved.length;
    }

    // CORS Headers
    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  } catch (error) {
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
