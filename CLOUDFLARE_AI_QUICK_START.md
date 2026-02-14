# Cloudflare AI Search - Quick Start Guide

## 🚀 Schnellstart (5 Schritte)

### 1️⃣ Vectorize Index erstellen

```bash
wrangler vectorize create suche --dimensions=768 --metric=cosine
```

Oder im Dashboard: **Vectorize** → **Create Index** → Name: `suche`, Dimensions: `768`, Metric: `cosine`

### 2️⃣ AI Search Worker erstellen

```bash
# Neues Verzeichnis
mkdir ai-search-worker
cd ai-search-worker

# Initialisieren
npm init -y
npm install wrangler
```

Erstelle `wrangler.toml`:

```toml
name = "ai-search-worker"
main = "src/index.js"
compatibility_date = "2024-01-01"

[[vectorize]]
binding = "VECTOR_INDEX"
index_name = "suche"

[ai]
binding = "AI"
```

Erstelle `src/index.js` (siehe CLOUDFLARE_AI_SEARCH_SETUP.md für vollständigen Code)

```bash
# Deployen
wrangler deploy
```

### 3️⃣ Bindings im Dashboard konfigurieren

**Workers & Pages** → **1web** → **Settings** → **Functions**

**Service Binding hinzufügen:**

- Variable name: `AI_SEARCH`
- Service: `ai-search-worker`
- Environment: Production + Preview

**Vectorize Binding hinzufügen:**

- Variable name: `VECTOR_INDEX`
- Vectorize index: `suche`
- Environment: Production + Preview

### 4️⃣ Content indexieren

Erstelle `scripts/index-content.js` mit deinen Seiten und führe aus:

```bash
node scripts/index-content.js
```

### 5️⃣ Testen

```bash
# Lokaler Test
npm run dev

# Production Deployment
git add .
git commit -m "Setup AI Search"
git push origin main
```

## 🎯 Minimale Worker-Implementierung

Falls du schnell starten willst, hier ist ein minimaler Worker:

**src/index.js:**

```javascript
export default {
  async fetch(request, env) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    try {
      // Search Endpoint
      if (url.pathname === '/api/search') {
        const { query, topK = 10 } = await request.json();

        const embedding = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
          text: query,
        });

        const matches = await env.VECTOR_INDEX.query(embedding.data[0], {
          topK,
          returnMetadata: true,
        });

        const results = matches.matches.map((m) => ({
          url: m.metadata?.url,
          title: m.metadata?.title,
          description: m.metadata?.description,
          category: m.metadata?.category,
          score: m.score,
        }));

        return new Response(
          JSON.stringify({ results, count: results.length }),
          { headers: corsHeaders },
        );
      }

      // AI Chat Endpoint
      if (url.pathname === '/api/ai') {
        const {
          message,
          systemInstruction,
          ragId,
          maxResults = 5,
        } = await request.json();

        const embedding = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
          text: message,
        });

        const matches = await env.VECTOR_INDEX.query(embedding.data[0], {
          topK: maxResults,
          returnMetadata: true,
          filter: ragId ? { rag_id: ragId } : undefined,
        });

        const context = matches.matches
          .map((m) => `${m.metadata?.title}: ${m.metadata?.description}`)
          .join('\n');

        const aiResponse = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
          messages: [
            {
              role: 'system',
              content: systemInstruction || 'Du bist ein Assistent.',
            },
            { role: 'system', content: `Kontext:\n${context}` },
            { role: 'user', content: message },
          ],
          max_tokens: 256,
        });

        return new Response(JSON.stringify({ text: aiResponse.response }), {
          headers: corsHeaders,
        });
      }

      return new Response(JSON.stringify({ error: 'Not Found' }), {
        status: 404,
        headers: corsHeaders,
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: corsHeaders,
      });
    }
  },
};
```

## 📊 Minimale Content-Indexierung

**scripts/index-content.js:**

```javascript
const WORKER_URL = 'https://ai-search-worker.[dein-subdomain].workers.dev';

const PAGES = [
  {
    url: '/',
    title: 'Startseite',
    description: 'Portfolio von Abdulkerim Sesli',
    category: 'Home',
    rag_id: 'suche',
  },
  // Füge weitere Seiten hinzu...
];

async function indexPage(page) {
  // 1. Generate embedding
  const embeddingRes = await fetch(`${WORKER_URL}/api/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: `${page.title} ${page.description}` }),
  });
  const { embedding } = await embeddingRes.json();

  // 2. Insert into Vectorize
  await fetch(`${WORKER_URL}/api/insert`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: page.url,
      values: embedding,
      metadata: page,
    }),
  });

  console.log(`✅ ${page.url}`);
}

async function main() {
  for (const page of PAGES) {
    await indexPage(page);
  }
  console.log('Fertig!');
}

main();
```

Füge zum Worker hinzu:

```javascript
// /api/embed
if (url.pathname === '/api/embed') {
  const { text } = await request.json();
  const embedding = await env.AI.run('@cf/baai/bge-base-en-v1.5', { text });
  return new Response(JSON.stringify({ embedding: embedding.data[0] }), {
    headers: corsHeaders,
  });
}

// /api/insert
if (url.pathname === '/api/insert') {
  const { id, values, metadata } = await request.json();
  await env.VECTOR_INDEX.insert([{ id, values, metadata }]);
  return new Response(JSON.stringify({ success: true }), {
    headers: corsHeaders,
  });
}
```

## ✅ Fertig!

Nach diesen Schritten sollte deine AI-Suche funktionieren:

```bash
# Test
curl -X POST https://1web.pages.dev/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "projekte", "topK": 5}'
```

## 🔗 Nächste Schritte

- Vollständige Anleitung: `CLOUDFLARE_AI_SEARCH_SETUP.md`
- Mehr Content indexieren
- AI-Antworten optimieren
- Monitoring einrichten
