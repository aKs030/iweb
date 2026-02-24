import { getCorsHeaders, handleOptions } from './_cors.js';

// Configuration
const SEARCH_TIMEOUT_MS = 15000;
const MAX_RESULTS_DEFAULT = 10;
const SYSTEM_PROMPT = `Du bist der AI-Assistent der Website von Abdulkerim Sesli. Antworte auf Fragen professionell und auf Deutsch basierend auf den gefundenen Inhalten. Fasse die Inhalte kurz und informativ zusammen.`;

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), ms),
    ),
  ]);
}

function parsePositiveInteger(val) {
  const parsed = parseInt(val, 10);
  return isNaN(parsed) || parsed <= 0 ? null : parsed;
}

function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}

function extractAiResult(item) {
  const pathName = item.filename || '';
  let url = pathName.startsWith('/') ? pathName : '/' + pathName;
  // Clean up URL: remove .md, .mdx extensions
  url = url.replace(/\.mdx?$/, '');
  // if url is just /index, map to /
  if (url === '/index') url = '/';

  const attrs = item.attributes || {};
  const title =
    attrs.title ||
    pathName
      .split('/')
      .pop()
      .replace(/-/g, ' ')
      .replace(/\.mdx?$/, '') ||
    'Ergebnis';
  const description =
    attrs.description ||
    (item.content?.[0] ? item.content[0].text.substring(0, 150) + '...' : '');
  const category =
    attrs.category || (pathName.includes('blog') ? 'Blog' : 'Seite');

  return {
    title,
    url,
    description,
    category,
    score: item.score || 0,
  };
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request, env);

  try {
    const body = await request.json().catch(() => ({}));
    const query = String(body?.query || '').trim();

    if (!query) {
      return Response.json({ results: [], count: 0 }, { headers: corsHeaders });
    }

    const topK = clamp(
      parsePositiveInteger(body?.topK) || MAX_RESULTS_DEFAULT,
      1,
      20,
    );

    if (!env.AI || !env.RAG_ID) {
      console.warn('AI or RAG_ID not configured');
      return Response.json(
        { error: 'AI Search is not configured', results: [] },
        { status: 503, headers: corsHeaders },
      );
    }

    // Run AI Search
    const searchResponse = await withTimeout(
      env.AI.autorag(env.RAG_ID).aiSearch({
        query,
        max_num_results: topK, // Fetch all requested results
        hybrid: true,
        system_prompt: SYSTEM_PROMPT,
      }),
      SEARCH_TIMEOUT_MS,
    );

    let results = [];
    if (searchResponse?.data && Array.isArray(searchResponse.data)) {
      results = searchResponse.data.map(extractAiResult);
    }

    // Deduplicate results based on URL
    const uniqueResultsMap = new Map();
    for (const res of results) {
      if (!uniqueResultsMap.has(res.url)) {
        uniqueResultsMap.set(res.url, res);
      } else {
        const existing = uniqueResultsMap.get(res.url);
        if (res.score > existing.score) {
          uniqueResultsMap.set(res.url, res);
        }
      }
    }
    const uniqueResults = Array.from(uniqueResultsMap.values()).sort(
      (a, b) => b.score - a.score,
    );

    const aiSummary = searchResponse?.response || '';

    return Response.json(
      {
        results: uniqueResults,
        count: uniqueResults.length,
        summary: aiSummary,
        aiChat: {
          message:
            aiSummary ||
            (uniqueResults.length > 0
              ? `Hier sind ${uniqueResults.length} passende Ergebnisse gefunden.`
              : 'Keine passenden Inhalte gefunden.'),
          suggestions: [],
        },
      },
      {
        headers: { ...corsHeaders, 'Cache-Control': 'public, max-age=300' },
      },
    );
  } catch (error) {
    console.error('Search error:', error);
    return Response.json(
      { error: 'Search failed', results: [] },
      { status: 500, headers: corsHeaders },
    );
  }
}

export const onRequestOptions = handleOptions;
