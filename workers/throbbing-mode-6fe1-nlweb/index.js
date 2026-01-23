// Worker: /api/search and /api/gemini (proxy + RAG augmentation)
// Expects env.GEMINI_API_KEY to be set (use `wrangler secret put GEMINI_API_KEY`)

import SEARCH_INDEX from './search-index.json' assert { type: 'json' };

const MODEL = 'gemini-2.5-flash-preview-09-2025';
const GL_BASE = (key) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;

// Simple full-text server-side search (adapted from client logic)
function serverSearch(query, topK = 5) {
  const q = String(query || '')
    .toLowerCase()
    .trim();
  if (!q) return [];
  const words = q.split(/\s+/).filter(Boolean);

  const results = SEARCH_INDEX.map((item) => {
    let score = item.priority || 0;
    const title = (item.title || '').toLowerCase();
    const desc = (item.description || '').toLowerCase();

    if (title === q) score += 1000;
    else if (title.startsWith(q)) score += 500;
    else if (title.includes(q)) score += 200;

    if (desc.includes(q)) score += 100;

    (item.keywords || []).forEach((k) => {
      const kl = (k || '').toLowerCase();
      if (kl === q) score += 150;
      else if (kl.startsWith(q)) score += 80;
      else if (kl.includes(q)) score += 40;
    });

    words.forEach((w) => {
      if (title.includes(w)) score += 30;
      if (desc.includes(w)) score += 15;
      (item.keywords || []).forEach((k) => {
        if ((k || '').toLowerCase().includes(w)) score += 20;
      });
    });

    return { ...item, score };
  });

  return results
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      url: r.url,
    }));
}

async function callGemini(prompt, systemInstruction, apiKey) {
  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    systemInstruction: { parts: [{ text: systemInstruction || '' }] },
  };

  const resp = await fetch(GL_BASE(apiKey), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Gemini request failed: ${resp.status} ${txt}`);
  }
  const json = await resp.json();
  const text = json.text || json.candidates?.[0]?.content?.parts?.[0]?.text;
  return text;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/search' && request.method === 'POST') {
      try {
        const { query, topK } = await request.json();
        const res = serverSearch(query, topK || 5);
        return new Response(JSON.stringify({ results: res }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: String(e) }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    if (url.pathname === '/api/gemini' && request.method === 'POST') {
      try {
        const body = await request.json();
        const prompt = String(body.prompt || '');
        const systemInstruction = String(body.systemInstruction || '');
        const options = body.options || {};

        // Optionally perform an internal search and augment the prompt
        let sources = [];
        if (options.useSearch) {
          const query = options.searchQuery || prompt;
          sources = serverSearch(query, options.topK || 3);
        }

        let augmented = prompt;
        if (sources.length) {
          const srcText = sources
            .map(
              (s, i) => `[[${i + 1}] ${s.title} — ${s.url}]: ${s.description}`,
            )
            .join('\n');
          augmented = `Nutze die folgenden relevanten Informationen von der Website als Kontext (falls hilfreich):\n${srcText}\n\nFrage: ${prompt}`;
        }

        const apiKey = env.GEMINI_API_KEY;
        if (!apiKey) {
          return new Response(
            JSON.stringify({
              error: 'GEMINI_API_KEY not configured on Worker environment',
            }),
            { status: 500, headers: { 'Content-Type': 'application/json' } },
          );
        }

        const text = await callGemini(
          augmented,
          systemInstruction ||
            'Du bist ein hilfreicher Assistent, antworte prägnant.',
          apiKey,
        );

        return new Response(JSON.stringify({ text, sources }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: String(e) }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response('Not Found', { status: 404 });
  },
};
