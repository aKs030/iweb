# AI Search Proxy - Cloudflare Worker

Cloudflare Worker für AI-gestützte Suche und Groq API Proxy mit RAG Support.

## Features

- **AI Search**: Volltextsuche via Cloudflare AI Search (Workers AI)
- **AI Chat**: Groq API Proxy (Llama 3.3 70B) mit optionalem RAG
- **CORS**: Domain-restricted CORS für sichere API-Nutzung
- **Validation**: Input-Validierung für alle Endpoints

## Endpoints

### POST /api/search

Volltextsuche mit Cloudflare AI Search.

**Request:**

```json
{
  "query": "react hooks",
  "topK": 5
}
```

**Response:**

```json
{
  "results": [
    {
      "id": "...",
      "title": "React Hooks Tutorial",
      "description": "...",
      "url": "/blog/react-hooks",
      "category": "Blog",
      "score": 0.95
    }
  ],
  "query": "react hooks",
  "count": 5,
  "source": "cloudflare-ai-search"
}
```

### POST /api/ai

AI Chat mit Groq API und optionalem RAG.

**Request:**

```json
{
  "prompt": "Was sind deine React Projekte?",
  "systemInstruction": "Du bist ein Portfolio-Assistent",
  "options": {
    "useSearch": true,
    "searchQuery": "react projekte",
    "topK": 3
  }
}
```

**Response:**

```json
{
  "text": "Ich habe mehrere React Projekte...",
  "sources": [...],
  "usedRAG": true,
  "model": "llama-3.3-70b-versatile"
}
```

## Setup

### 1. Wrangler installieren

```bash
npm install
```

### 2. Cloudflare AI Search

Der AI Search Index ist bereits konfiguriert:

- **Index ID**: `suche`
- **Type**: Web Crawler
- **Source**: www.abdulkerimsesli.de
- **R2 Bucket**: ai-search-suche-748559

Der Worker nutzt automatisch diesen Index für Suche und RAG.

### 3. Secrets setzen

```bash
# Groq API Key (kostenlos bei https://console.groq.com/keys)
npm run secret:groq
```

### 4. Deployment

```bash
# Development
npm run dev

# Production
npm run deploy

# Logs anschauen
npm run tail
```

## Konfiguration

Alle Einstellungen in `wrangler.toml`:

```toml
[vars]
ENVIRONMENT = "production"
MAX_SEARCH_RESULTS = "10"
RAG_ID = "suche"
```

## CORS

Erlaubte Origins:

- `https://abdulkerimsesli.de`
- `https://www.abdulkerimsesli.de`
- `http://localhost:3000` (Development)

## Entwicklung

```bash
# Worker lokal starten
npm run dev

# Test Search
curl -X POST http://localhost:8787/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "react", "topK": 5}'

# Test AI
curl -X POST http://localhost:8787/api/ai \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Hallo", "options": {"useSearch": false}}'
```

## Struktur

```
.
├── wrangler.toml           # Cloudflare Worker Config
├── package.json            # Dependencies & Scripts
├── src/
│   ├── index.js           # Entry Point & Routing
│   ├── handlers/
│   │   ├── search.js      # Search Handler
│   │   └── ai.js          # AI Handler
│   └── utils/
│       ├── response.js    # Response Utilities
│       └── validation.js  # Input Validation
└── README.md
```

## Limits

- Query: max 500 Zeichen
- Prompt: max 10.000 Zeichen
- Search Results: max 50 (default 10)
- RAG Sources: max 5

## License

ISC
