# YouTube API Proxy Worker

Cloudflare Worker für sicheren YouTube Data API v3 Proxy mit Caching und Rate Limiting.

## 🎯 Features

- **API Key Protection**: Server-side API Key (nicht im Client)
- **Caching**: Cloudflare Cache API (1 Stunde TTL)
- **Rate Limiting**: 60 Requests/Minute pro IP
- **Endpoint Whitelist**: Nur erlaubte Endpoints
- **CORS Support**: Cross-Origin Resource Sharing
- **Error Handling**: Strukturierte Error-Responses

## 📡 API Endpoint

### GET /api/youtube/{endpoint}

Proxied YouTube Data API v3 Requests.

**Erlaubte Endpoints:**

- `search` - Video/Channel/Playlist Suche
- `videos` - Video Details
- `channels` - Channel Details
- `playlists` - Playlist Details

**Beispiele:**

```bash
# Video Suche
GET /api/youtube/search?part=snippet&q=react&type=video&maxResults=10

# Video Details
GET /api/youtube/videos?part=snippet,statistics&id=VIDEO_ID

# Channel Details
GET /api/youtube/channels?part=snippet,statistics&id=CHANNEL_ID
```

**Response:**

```json
{
  "kind": "youtube#searchListResponse",
  "items": [...],
  "pageInfo": {...}
}
```

**Error Response:**

```json
{
  "error": "Rate limit exceeded",
  "message": "Too many requests. Try again after 2025-01-30T12:00:00Z",
  "status": 429,
  "timestamp": "2025-01-30T11:59:00Z",
  "resetAt": "2025-01-30T12:00:00Z"
}
```

## 🏗️ Architektur

```
youtube-api-proxy/
├── index.js              # Worker entry point
└── utils/
    ├── cache.js          # Cache utilities
    └── rate-limit.js     # Rate limiting
```

## 🔧 Konfiguration

**Environment Variables:**

```toml
[env.youtube.vars]
CACHE_TTL = "3600"
RATE_LIMIT_PER_MINUTE = "60"
```

**Secrets:**

```bash
wrangler secret put YOUTUBE_API_KEY --env youtube
```

## 🚀 Deployment

```bash
# Deploy
wrangler deploy --env youtube

# Logs anzeigen
wrangler tail --env youtube

# Lokales Testing
wrangler dev --env youtube
```

## 🧪 Testing

```bash
# Video Suche
curl "https://abdulkerimsesli.de/api/youtube/search?part=snippet&q=react&type=video&maxResults=5"

# Video Details
curl "https://abdulkerimsesli.de/api/youtube/videos?part=snippet,statistics&id=dQw4w9WgXcQ"

# Rate Limit Test
for i in {1..65}; do
  curl "https://abdulkerimsesli.de/api/youtube/search?part=snippet&q=test"
done
```

## 📊 Caching

**Cache Strategy:**

- TTL: 1 Stunde (konfigurierbar)
- Cache Key: Vollständige YouTube API URL
- Cache Hit Header: `X-Cache: HIT`
- Cache Miss Header: `X-Cache: MISS`
- Cache Date Header: `X-Cache-Date`

**Cache Invalidierung:**

- Automatisch nach TTL
- Manuell über Cloudflare Dashboard

## 🔒 Security

**Implementierte Maßnahmen:**

- API Key als Secret (nicht im Code)
- Rate Limiting per IP (60 req/min)
- Endpoint Whitelist (nur erlaubte Endpoints)
- CORS-Konfiguration
- Error-Sanitization (keine API Key Leaks)

**Rate Limiting:**

- 60 Requests pro Minute pro IP
- In-Memory Counter (reset bei Worker-Restart)
- HTTP 429 bei Überschreitung
- `Retry-After` Header in Response

## 📈 Performance

**Metriken:**

- Cache Hit: < 10ms
- Cache Miss: ~200-500ms (YouTube API)
- Rate Limit Check: < 1ms

**Optimierungen:**

- Cloudflare Edge Caching
- In-Memory Rate Limiting
- Minimale Response-Transformation

## 🐛 Debugging

```bash
# Logs in Echtzeit
wrangler tail --env youtube

# Logs filtern
wrangler tail --env youtube --format pretty

# Cache Status prüfen
curl -I "https://abdulkerimsesli.de/api/youtube/search?part=snippet&q=test"
# Schau nach X-Cache Header
```

## 📝 Error Codes

| Status | Error               | Beschreibung                 |
| ------ | ------------------- | ---------------------------- |
| 400    | Invalid endpoint    | Falsches URL-Format          |
| 403    | Forbidden endpoint  | Endpoint nicht erlaubt       |
| 405    | Method not allowed  | Nur GET erlaubt              |
| 429    | Rate limit exceeded | Zu viele Requests            |
| 500    | Configuration error | API Key fehlt                |
| 502    | Proxy error         | YouTube API nicht erreichbar |

## 🔄 Migration

**Von alter Struktur:**

- Monolithischer Code → Modular (utils)
- Basis-Caching → Optimiertes Caching mit TTL
- Kein Rate Limiting → Rate Limiting per IP
- Keine Endpoint-Validierung → Whitelist

**API-Kompatibilität:**

- ✅ Keine Breaking Changes
- ✅ Response-Format unverändert
- ✅ Zusätzliche Headers (X-Cache, X-Cache-Date)
