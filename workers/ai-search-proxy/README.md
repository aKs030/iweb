# AI Search & Gemini Proxy Worker

Cloudflare Worker für Server-side Search und Gemini API mit RAG-Augmentation.

## 🎯 Features

- **Full-Text Search**: Server-side Suche mit Relevanz-Scoring
- **RAG Integration**: Retrieval-Augmented Generation für kontextbezogene Antworten
- **Gemini API Proxy**: Sichere API-Key-Verwaltung
- **Request Validation**: Input-Validierung und Sanitization
- **CORS Support**: Cross-Origin Resource Sharing
- **Error Handling**: Strukturierte Error-Responses

## 📡 API Endpoints

### POST /api/search

Führt eine Volltextsuche im Index durch.

**Request:**

```json
{
  "query": "react performance",
  "topK": 5
}
```

**Response:**

```json
{
  "results": [
    {
      "id": "blog-react-performance",
      "title": "React Performance Optimization",
      "description": "Best practices for React performance",
      "url": "/blog/react-performance/",
      "score": 850
    }
  ],
  "query": "react performance",
  "count": 1
}
```

### POST /api/gemini

Proxied Gemini API mit optionaler RAG-Augmentation.

**Request:**

```json
{
  "prompt": "Wie optimiere ich React Performance?",
  "systemInstruction": "Du bist ein React-Experte",
  "options": {
    "useSearch": true,
    "searchQuery": "react performance",
    "topK": 3
  }
}
```

**Response:**

```json
{
  "text": "Hier sind die wichtigsten Tipps...",
  "sources": [
    {
      "id": "blog-react-performance",
      "title": "React Performance Optimization",
      "description": "...",
      "url": "/blog/react-performance/"
    }
  ],
  "usedRAG": true
}
```

## 🏗️ Architektur

```
ai-search-proxy/
├── index.js              # Worker entry point
├── search-index.json     # Search index data
├── handlers/
│   ├── search.js         # Search endpoint logic
│   └── gemini.js         # Gemini API logic
├── services/
│   └── gemini.js         # Gemini API client
└── utils/
    ├── response.js       # Response helpers
    └── validation.js     # Request validation
```

## 🔧 Konfiguration

**Environment Variables:**

```toml
[vars]
RAG_ID = "throbbing-mode-6fe1"
CACHE_TTL = "3600"
MAX_SEARCH_RESULTS = "10"
```

**Secrets:**

```bash
wrangler secret put GEMINI_API_KEY
```

## 🚀 Deployment

```bash
# Deploy
wrangler deploy

# Logs anzeigen
wrangler tail

# Lokales Testing
wrangler dev
```

## 🧪 Testing

```bash
# Search endpoint
curl -X POST https://abdulkerimsesli.de/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "react", "topK": 5}'

# Gemini endpoint
curl -X POST https://abdulkerimsesli.de/api/gemini \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Was ist React?",
    "options": {"useSearch": true}
  }'
```

## 📊 Search Scoring Algorithm

Der Scoring-Algorithmus bewertet Treffer nach Relevanz:

- **Exact title match**: +1000
- **Title starts with query**: +500
- **Title contains query**: +200
- **Description contains query**: +100
- **Exact keyword match**: +150
- **Keyword starts with query**: +80
- **Keyword contains query**: +40
- **Multi-word matches**: +15-30 per word

## 🔒 Security

- API Keys als Secrets (nicht im Code)
- Request-Validierung (max. 500 chars für Search, 10k für Gemini)
- CORS-Konfiguration
- Error-Sanitization
- Rate Limiting (über Cloudflare)

## 📈 Performance

- Search: < 10ms (in-memory)
- Gemini API: ~500-2000ms (abhängig von Prompt-Länge)
- RAG-Augmentation: +5-10ms
- Caching: Cloudflare Edge Cache

## 🐛 Debugging

```bash
# Logs in Echtzeit
wrangler tail

# Logs filtern
wrangler tail --format pretty

# Logs für bestimmte Zeit
wrangler tail --since 1h
```

## 📝 Migration von alter Struktur

**Änderungen:**

- `workers/throbbing-mode-6fe1-nlweb/` → `workers/ai-search-proxy/`
- Monolithischer Code → Modular (handlers, services, utils)
- Keine Validierung → Request-Validierung
- Basis-Error-Handling → Strukturierte Errors

**API-Kompatibilität:**

- ✅ Keine Breaking Changes
- ✅ Response-Format erweitert (zusätzliche Metadaten)
- ✅ Bestehende Clients funktionieren weiterhin
