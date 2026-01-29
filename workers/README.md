# Cloudflare Workers

Modularisierte Worker-Struktur für optimale Performance und Wartbarkeit.

## 📁 Struktur

```
workers/
├── ai-search-proxy/          # AI Search & Gemini API Proxy
│   ├── index.js              # Main worker entry
│   ├── search-index.json     # Search index data
│   ├── handlers/
│   │   ├── search.js         # Search endpoint handler
│   │   └── gemini.js         # Gemini API handler
│   ├── services/
│   │   └── gemini.js         # Gemini API service
│   └── utils/
│       ├── response.js       # Response helpers
│       └── validation.js     # Request validation
│
└── youtube-api-proxy/        # YouTube API Proxy
    ├── index.js              # Main worker entry
    └── utils/
        ├── cache.js          # Cache utilities
        └── rate-limit.js     # Rate limiting
```

## 🚀 AI Search Proxy

**Endpoints:**

- `POST /api/search` - Full-text search mit Scoring
- `POST /api/gemini` - Gemini API mit RAG-Augmentation

**Features:**

- Server-side Volltextsuche mit Relevanz-Scoring
- RAG (Retrieval-Augmented Generation) für kontextbezogene Antworten
- Request-Validierung
- CORS-Support
- Strukturierte Error-Responses

**Deployment:**

```bash
wrangler deploy
wrangler secret put GEMINI_API_KEY
```

**Environment Variables:**

- `GEMINI_API_KEY` (secret) - Google Gemini API Key
- `RAG_ID` - RAG Index ID
- `CACHE_TTL` - Cache TTL in Sekunden (default: 3600)
- `MAX_SEARCH_RESULTS` - Max. Suchergebnisse (default: 10)

## 📺 YouTube API Proxy

**Endpoints:**

- `GET /api/youtube/{endpoint}` - YouTube Data API v3 Proxy

**Features:**

- Server-side API Key Protection
- Cloudflare Cache API (1 Stunde TTL)
- Rate Limiting (60 req/min per IP)
- Endpoint-Whitelist (search, videos, channels, playlists)
- CORS-Support

**Deployment:**

```bash
wrangler deploy --env youtube
wrangler secret put YOUTUBE_API_KEY --env youtube
```

**Environment Variables:**

- `YOUTUBE_API_KEY` (secret) - YouTube Data API v3 Key
- `CACHE_TTL` - Cache TTL in Sekunden (default: 3600)
- `RATE_LIMIT_PER_MINUTE` - Rate Limit (default: 60)

## 🔧 Entwicklung

**Lokales Testen:**

```bash
# AI Search Proxy
wrangler dev

# YouTube Proxy
wrangler dev --env youtube
```

**Logs anzeigen:**

```bash
wrangler tail
wrangler tail --env youtube
```

## 📊 Monitoring

**Wichtige Metriken:**

- Request Count
- Error Rate
- Cache Hit Rate
- Response Time
- Rate Limit Hits

**Cloudflare Dashboard:**

- Workers > Analytics
- Cache Analytics
- Security Events

## 🔒 Security

**Implementierte Maßnahmen:**

- API Keys als Secrets (nicht im Code)
- Rate Limiting per IP
- Endpoint-Whitelist
- Request-Validierung
- CORS-Konfiguration
- Error-Sanitization

## 🎯 Best Practices

1. **Modularisierung**: Jeder Worker ist in Handler, Services und Utils aufgeteilt
2. **Error Handling**: Strukturierte Error-Responses mit Status Codes
3. **Validation**: Input-Validierung vor Verarbeitung
4. **Caching**: Cloudflare Cache API für bessere Performance
5. **Rate Limiting**: Schutz vor Missbrauch
6. **Logging**: Console.error für Debugging

## 📝 Migration Notes

**Von alter Struktur:**

- `workers/throbbing-mode-6fe1-nlweb/` → `workers/ai-search-proxy/`
- Monolithischer Code → Modular aufgeteilt
- Keine Validierung → Request-Validierung
- Basis-Caching → Optimiertes Caching mit TTL

**Breaking Changes:**

- Keine - API-Kompatibilität bleibt erhalten
- Response-Format erweitert um zusätzliche Metadaten
