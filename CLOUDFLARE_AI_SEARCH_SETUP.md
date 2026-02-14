# Cloudflare AI Search - Komplette Neueinrichtung

## 📋 Übersicht

Dein Projekt verwendet Cloudflare AI für intelligente Suche mit RAG (Retrieval-Augmented Generation). Du benötigst:

1. **Vectorize Index** - Für Vektor-Suche
2. **AI Search Worker** - Separater Worker für AI-Operationen
3. **Service Binding** - Verbindung zwischen Pages und Worker
4. **Content Indexierung** - Deine Website-Inhalte als Vektoren

## 🎯 Schritt 1: Vectorize Index erstellen

### Wichtig: Vectorize V2 (neueste Version)

Cloudflare hat Vectorize V2 eingeführt. Stelle sicher, dass du Wrangler 3.71.0+ verwendest:

```bash
# Wrangler Version prüfen
wrangler --version

# Falls älter als 3.71.0, aktualisieren
npm install -g wrangler@latest

# Oder immer die neueste Version verwenden
npx wrangler@latest vectorize create suche --dimensions=768 --metric=cosine
```

### Via CLI (Empfohlen):

```bash
# Vectorize V2 Index erstellen
npx wrangler@latest vectorize create suche --dimensions=768 --metric=cosine
```

**Wichtig:**

- Name: `suche` (muss mit `AI_SEARCH_INDEX` in wrangler.toml übereinstimmen)
- Dimensions: `768` (Standard für Cloudflare @cf/baai/bge-base-en-v1.5 Embeddings)
- Metric: `cosine` (für Textähnlichkeit, Werte von -1 bis 1)

**Verfügbare Metriken:**

- `cosine` - Cosine Similarity (-1 = unterschiedlich, 1 = identisch, 0 = orthogonal)
- `euclidean` - Euklidische Distanz (0 = identisch, größer = unterschiedlicher)
- `dot-product` - Negatives Dot Product (größere negative Werte = ähnlicher)

### Via Cloudflare Dashboard (Alternative):

```
1. Gehe zu: https://dash.cloudflare.com
2. Wähle dein Account
3. Linke Sidebar → "Vectorize"
4. Klicke auf "Create Index"
```

**Index-Konfiguration:**

```
┌─────────────────────────────────────────────────┐
│ Index name:                                     │
│ ┌─────────────────────────────────────────────┐ │
│ │ suche                                       │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ Dimensions:                                     │
│ ┌─────────────────────────────────────────────┐ │
│ │ 768                                         │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ Metric:                                         │
│ ┌─────────────────────────────────────────────┐ │
│ │ cosine                          ▼           │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ [Create Index]                                  │
└─────────────────────────────────────────────────┘
```

### Via REST API (für Automatisierung):

```bash
# Mit curl
curl -X POST "https://api.cloudflare.com/client/v4/accounts/{account_id}/vectorize/v2/indexes" \
  -H "Authorization: Bearer {api_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "suche",
    "description": "AI Search Index für Portfolio",
    "config": {
      "dimensions": 768,
      "metric": "cosine"
    }
  }'
```

**Hinweis zu Legacy Vectorize V1:**
Falls du alte V1 Indexes hast, verwende `--deprecated-v1` Flag. V1 Indexes können ab Dezember 2024 nicht mehr erstellt werden.

## 🎯 Schritt 2: AI Search Worker erstellen

Du benötigst einen separaten Worker, der die AI-Operationen durchführt.

### 2.1 Worker-Verzeichnis erstellen

```bash
# Erstelle ein neues Verzeichnis für den Worker
mkdir -p ai-search-worker
cd ai-search-worker
```

### 2.2 Worker-Dateien erstellen

**wrangler.toml:**

```toml
name = "ai-search-worker"
main = "src/index.js"
compatibility_date = "2024-01-01"

# Vectorize Binding
[[vectorize]]
binding = "VECTOR_INDEX"
index_name = "suche"

# AI Binding
[ai]
binding = "AI"
```

**src/index.js:**

```javascript
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS Headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Route: /api/search
      if (url.pathname === '/api/search' && request.method === 'POST') {
        const body = await request.json();
        const { query, limit = 10, topK = 10 } = body;

        if (!query) {
          return new Response(JSON.stringify({ results: [], count: 0 }), {
            headers: corsHeaders,
          });
        }

        // 1. Generate embedding for query
        const embedding = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
          text: query,
        });

        // 2. Query vector index
        const matches = await env.VECTOR_INDEX.query(embedding.data[0], {
          topK: Math.min(topK, 20),
          returnMetadata: true,
        });

        // 3. Format results
        const results = matches.matches.map((match) => ({
          url: match.metadata?.url || '',
          title: match.metadata?.title || 'Seite',
          description: match.metadata?.description || '',
          category: match.metadata?.category || 'Seite',
          score: match.score,
        }));

        return new Response(
          JSON.stringify({ results, count: results.length }),
          { headers: corsHeaders },
        );
      }

      // Route: /api/ai
      if (url.pathname === '/api/ai' && request.method === 'POST') {
        const body = await request.json();
        const {
          prompt,
          message,
          systemInstruction,
          ragId,
          maxResults = 5,
        } = body;

        const userMessage = message || prompt;

        if (!userMessage) {
          return new Response(
            JSON.stringify({ text: 'Keine Nachricht erhalten.' }),
            { headers: corsHeaders },
          );
        }

        // 1. Generate embedding for RAG context
        const embedding = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
          text: userMessage,
        });

        // 2. Get relevant context from vector index
        const matches = await env.VECTOR_INDEX.query(embedding.data[0], {
          topK: maxResults,
          returnMetadata: true,
          filter: ragId ? { rag_id: ragId } : undefined,
        });

        // 3. Build context from matches
        const context = matches.matches
          .map(
            (m) =>
              `${m.metadata?.title || ''}: ${m.metadata?.description || ''}`,
          )
          .join('\n');

        // 4. Generate AI response with context
        const messages = [
          {
            role: 'system',
            content: systemInstruction || 'Du bist ein hilfreicher Assistent.',
          },
          {
            role: 'system',
            content: `Kontext aus dem Portfolio:\n${context}`,
          },
          {
            role: 'user',
            content: userMessage,
          },
        ];

        const aiResponse = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
          messages,
          max_tokens: 256,
        });

        return new Response(
          JSON.stringify({ text: aiResponse.response || '' }),
          { headers: corsHeaders },
        );
      }

      return new Response(JSON.stringify({ error: 'Not Found' }), {
        status: 404,
        headers: corsHeaders,
      });
    } catch (error) {
      console.error('Worker Error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: corsHeaders,
      });
    }
  },
};
```

**package.json:**

```json
{
  "name": "ai-search-worker",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy"
  },
  "devDependencies": {
    "wrangler": "^3.114.17"
  }
}
```

### 2.3 Worker deployen

```bash
# Im ai-search-worker Verzeichnis
npm install
wrangler deploy
```

**Notiere die Worker-URL:** `https://ai-search-worker.[dein-subdomain].workers.dev`

## 🎯 Schritt 3: Service Binding konfigurieren

Jetzt verbindest du dein Pages-Projekt mit dem Worker.

### Via Cloudflare Dashboard:

```
1. Gehe zu: Workers & Pages → 1web
2. Klicke auf "Settings"
3. Scrolle zu "Functions"
4. Finde "Service bindings"
5. Klicke auf "Add binding"
```

**Binding-Konfiguration:**

```
┌─────────────────────────────────────────────────┐
│ Variable name:                                  │
│ ┌─────────────────────────────────────────────┐ │
│ │ AI_SEARCH                                   │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ Service:                                        │
│ ┌─────────────────────────────────────────────┐ │
│ │ ai-search-worker              ▼             │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ Environment:                                    │
│ ☑ Production  ☑ Preview                        │
│                                                 │
│ [Add binding]                                   │
└─────────────────────────────────────────────────┘
```

### Via wrangler.toml (in deinem 1web Projekt):

Füge zu deiner `wrangler.toml` hinzu:

```toml
# Service Bindings
[[services]]
binding = "AI_SEARCH"
service = "ai-search-worker"
environment = "production"
```

## 🎯 Schritt 4: VECTOR_INDEX Binding hinzufügen

Dein Pages-Projekt benötigt auch direkten Zugriff auf den Vectorize Index.

### Via Dashboard:

```
1. Workers & Pages → 1web → Settings
2. Scrolle zu "Functions"
3. Finde "Vectorize bindings"
4. Klicke auf "Add binding"
```

**Binding-Konfiguration:**

```
┌─────────
                                                │
│ Environment:                                    │
│ ☑ Production  ☑ Preview                        │
│                                                 │
│ [Add binding]                                   │
└─────────────────────────────────────────────────┘
```

### Via wrangler.toml:

```toml
# Vectorize Binding
[[vectorize]]
binding = "VECTOR_INDEX"
index_name = "suche"
```

## 🎯 Schritt 5: Content indexieren

Jetzt musst du deine Website-Inhalte in den Vectorize Index laden.

### 5.1 Indexierungs-Script erstellen

Erstelle `scripts/index-content.js`:

```javascript
// Dieses Script lädt deine Website-Inhalte in Vectorize
// Führe es lokal aus: node scripts/index-content.js

const PAGES = [
  {
    url: '/',
    title: 'Startseite',
    description:
      'Portfolio von Abdulkerim Sesli - Web Developer & Photographer',
    category: 'Home',
    rag_id: 'suche',
  },
  {
    url: '/projekte',
    title: 'Projekte',
    description:
      'Webentwicklungsprojekte mit React, Three.js und modernen Technologien',
    category: 'Projekte',
    rag_id: 'suche',
  },
  {
    url: '/blog',
    title: 'Blog',
    description:
      'Technische Artikel über Webentwicklung, Performance und Design',
    category: 'Blog',
    rag_id: 'suche',
  },
  {
    url: '/gallery',
    title: 'Galerie',
    description: 'Urban Photography aus Berlin - Visuelles Storytelling',
    category: 'Galerie',
    rag_id: 'suche',
  },
  {
    url: '/videos',
    title: 'Videos',
    description: 'Motion Design und Video-Produktionen',
    category: 'Videos',
    rag_id: 'suche',
  },
  {
    url: '/about',
    title: 'Über mich',
    description: 'Web Developer, Photographer und Digital Creator aus Berlin',
    category: 'About',
    rag_id: 'suche',
  },
  // Füge weitere Seiten hinzu...
];

async function indexContent() {
  const WORKER_URL = 'https://ai-search-worker.[dein-subdomain].workers.dev';

  console.log('Starte Indexierung...');

  for (const page of PAGES) {
    try {
      // 1. Generate embedding
      const embeddingResponse = await fetch(`${WORKER_URL}/api/embed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `${page.title} ${page.description}`,
        }),
      });

      const { embedding } = await embeddingResponse.json();

      // 2. Insert into Vectorize
      const insertResponse = await fetch(`${WORKER_URL}/api/insert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: page.url,
          values: embedding,
          metadata: page,
        }),
      });

      console.log(`✅ Indexed: ${page.url}`);
    } catch (error) {
      console.error(`❌ Failed: ${page.url}`, error.message);
    }
  }

  console.log('Indexierung abgeschlossen!');
}

indexContent();
```

### 5.2 Embed & Insert Endpoints zum Worker hinzufügen

Füge zu `ai-search-worker/src/index.js` hinzu:

```javascript
// Route: /api/embed
if (url.pathname === '/api/embed' && request.method === 'POST') {
  const body = await request.json();
  const { text } = body;

  const embedding = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
    text,
  });

  return new Response(JSON.stringify({ embedding: embedding.data[0] }), {
    headers: corsHeaders,
  });
}

// Route: /api/insert
if (url.pathname === '/api/insert' && request.method === 'POST') {
  const body = await request.json();
  const { id, values, metadata } = body;

  await env.VECTOR_INDEX.insert([
    {
      id,
      values,
      metadata,
    },
  ]);

  return new Response(JSON.stringify({ success: true, id }), {
    headers: corsHeaders,
  });
}
```

### 5.3 Indexierung ausführen

```bash
# Worker neu deployen mit neuen Endpoints
cd ai-search-worker
wrangler deploy

# Indexierungs-Script ausführen
cd ..
node scripts/index-content.js
```

## 🎯 Schritt 6: Testen

### 6.1 Lokaler Test

```bash
# In deinem 1web Projekt
npm run dev

# Öffne: http://localhost:8080
# Teste die Suche
```

### 6.2 Production Test

```bash
# Deploy zu Cloudflare
git add .
git commit -m "Configure AI Search"
git push origin main

# Warte auf Deployment
# Teste auf: https://1web.pages.dev
```

### 6.3 API Test (direkt)

```bash
# Test Search API
curl -X POST https://1web.pages.dev/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "projekte", "topK": 5}'

# Test AI API
curl -X POST https://1web.pages.dev/api/ai \
  -H "Content-Type: application/json" \
  -d '{"message": "Was sind deine Projekte?", "ragId": "suche"}'
```

## ✅ Checkliste

- [ ] Vectorize Index "suche" erstellt (768 dimensions, cosine)
- [ ] AI Search Worker erstellt und deployed
- [ ] Service Binding "AI_SEARCH" konfiguriert
- [ ] Vectorize Binding "VECTOR_INDEX" konfiguriert
- [ ] Content indexiert (alle Seiten)
- [ ] Lokaler Test erfolgreich
- [ ] Production Test erfolgreich
- [ ] API Endpoints funktionieren

## 🐛 Troubleshooting

### "VECTOR_INDEX binding is missing"

**Lösung:** Füge Vectorize Binding in Pages Settings hinzu (Schritt 4)

### "AI_SEARCH Service Binding not configured"

**Lösung:** Füge Service Binding in Pages Settings hinzu (Schritt 3)

### "Empty search results"

**Lösung:**

- Prüfe ob Content indexiert wurde
- Teste Worker direkt: `https://ai-search-worker.[subdomain].workers.dev/api/search`
- Prüfe Vectorize Index im Dashboard

### "Worker not found"

**Lösung:**

- Stelle sicher, dass Worker deployed ist: `wrangler deploy`
- Prüfe Worker-Name in Service Binding

## 📚 Weitere Ressourcen

- [Cloudflare Vectorize Docs](https://developers.cloudflare.com/vectorize/)
- [Cloudflare Workers AI](https://developers.cloudflare.com/workers-ai/)
- [Service Bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/)
