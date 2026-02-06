# Cloudflare Workers

Zwei Edge-Worker für AI-Suche und YouTube-Proxy mit geteilten Utilities.

## Struktur

```
workers/
├── wrangler.toml                 # Deployment-Konfiguration
├── shared/
│   ├── response-utils.js         # JSON/Error Responses, CORS
│   └── search-utils.js           # Search Engine + RAG
├── ai-search-proxy/
│   ├── index.js                  # Entry Point
│   ├── search-index.json         # Suchindex-Daten
│   ├── validation.js             # Input-Validierung
│   ├── handlers/
│   │   ├── search.js             # POST /api/search
│   │   └── ai.js                 # POST /api/ai
│   └── services/
│       └── groq.js               # Groq API Client
└── youtube-api-proxy/
    ├── index.js                  # Entry Point
    └── handlers/
        └── youtube.js            # GET /api/youtube/*
```

## Workers

### AI Search Proxy

| Endpoint      | Methode | Beschreibung                               |
| ------------- | ------- | ------------------------------------------ |
| `/api/search` | POST    | Volltextsuche mit Relevanz-Scoring         |
| `/api/ai`     | POST    | Groq AI (Llama 3.3 70B) mit optionalem RAG |

**Secrets:** `GROQ_API_KEY` — [Kostenlos bei Groq](https://console.groq.com/keys)

### YouTube API Proxy

| Endpoint                  | Methode | Beschreibung              |
| ------------------------- | ------- | ------------------------- |
| `/api/youtube/{endpoint}` | GET     | YouTube Data API v3 Proxy |

Erlaubte Endpoints: `search`, `videos`, `channels`, `playlists`, `playlistItems`

Caching via Cloudflare Cache API (1h TTL).

**Secrets:** `YOUTUBE_API_KEY`

## Deployment

```bash
# Secrets setzen
wrangler secret put GROQ_API_KEY
wrangler secret put YOUTUBE_API_KEY --env youtube

# AI Search Proxy deployen
wrangler deploy

# YouTube Proxy deployen
wrangler deploy --env youtube

# Logs
wrangler tail
wrangler tail --env youtube
```

## Lokale Entwicklung

```bash
wrangler dev              # AI Search Proxy
wrangler dev --env youtube # YouTube Proxy
```

## Beispiele

```bash
# Suche
curl -X POST https://abdulkerimsesli.de/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "react", "topK": 5}'

# AI mit RAG
curl -X POST https://abdulkerimsesli.de/api/ai \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Was sind deine Projekte?", "options": {"useSearch": true}}'

# YouTube
curl "https://abdulkerimsesli.de/api/youtube/search?part=snippet&q=react&maxResults=5"
```
