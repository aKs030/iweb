# Worker Architecture

## 🏗️ Architektur-Übersicht

```
┌─────────────────────────────────────────────────────────────┐
│                    Cloudflare Edge Network                   │
│                                                              │
│  ┌──────────────────┐         ┌──────────────────┐         │
│  │  AI Search Proxy │         │ YouTube API Proxy│         │
│  │                  │         │                  │         │
│  │  /api/search     │         │  /api/youtube/*  │         │
│  │  /api/ai         │         │                  │         │
│  └────────┬─────────┘         └────────┬─────────┘         │
│           │                            │                    │
│           └────────────┬───────────────┘                    │
│                        │                                    │
│                        ▼                                    │
│              ┌──────────────────┐                          │
│              │  Shared Utilities │                          │
│              │                  │                          │
│              │  • response-utils│                          │
│              │  • search-utils  │                          │
│              └──────────────────┘                          │
└─────────────────────────────────────────────────────────────┘
                        │
                        ▼
        ┌───────────────┴───────────────┐
        │                               │
        ▼                               ▼
┌──────────────┐              ┌──────────────┐
│  Groq API    │              │ YouTube API  │
│  (Free AI)   │              │  (Google)    │
└──────────────┘              └──────────────┘
```

## 📦 Modul-Struktur

### Shared Layer (Wiederverwendbar)

```
workers/shared/
├── response-utils.js
│   ├── jsonResponse()          # JSON mit CORS
│   ├── errorResponse()         # Strukturierte Errors
│   └── handleCORSPreflight()   # CORS Preflight
│
└── search-utils.js
    ├── performSearch()         # Full-Text Search
    └── augmentPromptWithRAG()  # RAG Context Injection
```

### AI Search Proxy (Hauptworker)

```
workers/ai-search-proxy/
├── index.js                    # Entry Point + Routing
│   ├── fetch()                # Request Handler
│   └── scheduled()            # Cron Jobs
│
├── handlers/
│   ├── search.js              # Search Endpoint
│   │   └── searchHandler()   # POST /api/search
│   │
│   └── ai.js                  # AI Endpoint
│       └── aiHandler()       # POST /api/ai
│
├── services/
│   └── groq.js                # Groq API Client
│       └── callGroqAPI()     # API Call
│
├── utils/
│   └── validation.js          # Request Validation
│       ├── validateSearchRequest()
│       └── validateAIRequest()
│
└── search-index.json          # Search Index Data
```

### YouTube API Proxy

```
workers/youtube-api-proxy/
├── index.js                    # Entry Point + Routing
│   └── fetch()                # Request Handler
│
├── handlers/
│   └── youtube.js             # YouTube Endpoint
│       └── youtubeHandler()  # GET /api/youtube/*
│
└── utils/
    ├── cache.js               # Cloudflare Cache API
    │   ├── getCachedResponse()
    │   └── cacheResponse()
    │
    └── rate-limit.js          # In-Memory Rate Limiting
        ├── isRateLimited()
        └── getRateLimitInfo()
```

## 🔄 Request Flow

### Search Request

```
Client
  │
  ├─→ POST /api/search
  │   {"query": "react", "topK": 5}
  │
  ▼
AI Search Proxy (index.js)
  │
  ├─→ searchHandler()
  │   │
  │   ├─→ validateSearchRequest()  [validation.js]
  │   │
  │   ├─→ performSearch()          [shared/search-utils.js]
  │   │   ├─ Scoring Algorithm
  │   │   ├─ Keyword Matching
  │   │   └─ Relevance Sorting
  │   │
  │   └─→ jsonResponse()           [shared/response-utils.js]
  │
  ▼
Client
  {"results": [...], "count": 5}
```

### AI Request with RAG

```
Client
  │
  ├─→ POST /api/ai
  │   {"prompt": "Was sind deine Projekte?", "options": {"useSearch": true}}
  │
  ▼
AI Search Proxy (index.js)
  │
  ├─→ aiHandler()
  │   │
  │   ├─→ validateAIRequest()      [validation.js]
  │   │
  │   ├─→ performSearch()          [shared/search-utils.js]
  │   │   └─ Find relevant context
  │   │
  │   ├─→ augmentPromptWithRAG()   [shared/search-utils.js]
  │   │   └─ Inject context into prompt
  │   │
  │   ├─→ callGroqAPI()            [services/groq.js]
  │   │   └─ Groq API Request
  │   │
  │   └─→ jsonResponse()           [shared/response-utils.js]
  │
  ▼
Client
  {"text": "...", "sources": [...], "usedRAG": true}
```

### YouTube Request

```
Client
  │
  ├─→ GET /api/youtube/videos?part=snippet&id=VIDEO_ID
  │
  ▼
YouTube API Proxy (index.js)
  │
  ├─→ youtubeHandler()
  │   │
  │   ├─→ Validate Endpoint
  │   │
  │   ├─→ isRateLimited()          [utils/rate-limit.js]
  │   │   └─ Check IP rate limit
  │   │
  │   ├─→ getCachedResponse()      [utils/cache.js]
  │   │   └─ Check Cloudflare Cache
  │   │
  │   ├─→ fetch(YouTube API)
  │   │   └─ Proxy request with API key
  │   │
  │   ├─→ cacheResponse()          [utils/cache.js]
  │   │   └─ Store in Cloudflare Cache
  │   │
  │   └─→ jsonResponse()           [shared/response-utils.js]
  │
  ▼
Client
  {"items": [...], "X-Cache": "HIT"}
```

## 🎯 Design Patterns

### 1. Handler Pattern

Jeder Endpoint hat einen dedizierten Handler:

- Klare Verantwortlichkeiten
- Einfach zu testen
- Wiederverwendbar

### 2. Service Layer

Externe API-Calls in Services:

- Abstraktion von API-Details
- Einfach austauschbar (z.B. Groq → OpenAI)
- Zentrale Fehlerbehandlung

### 3. Shared Utilities

Gemeinsame Funktionen in shared/:

- DRY (Don't Repeat Yourself)
- Konsistente Implementierung
- Single Source of Truth

### 4. Validation Layer

Input-Validierung vor Verarbeitung:

- Sicherheit
- Frühe Fehlerkennung
- Klare Error-Messages

## 🔒 Security Layers

```
┌─────────────────────────────────────┐
│  1. Cloudflare Edge (DDoS, WAF)     │
├─────────────────────────────────────┤
│  2. Rate Limiting (per IP)          │
├─────────────────────────────────────┤
│  3. Endpoint Whitelist              │
├─────────────────────────────────────┤
│  4. Input Validation                │
├─────────────────────────────────────┤
│  5. API Key Protection (Secrets)    │
├─────────────────────────────────────┤
│  6. CORS Configuration              │
└─────────────────────────────────────┘
```

## 📊 Caching Strategy

### Search API (5 Minuten)

```
Browser Cache: 5 min
Edge Cache: 10 min (stale-while-revalidate)
Reason: Suchergebnisse ändern sich selten
```

### AI API (Kein Cache)

```
Browser Cache: none
Edge Cache: none
Reason: Jede Antwort ist einzigartig
```

### YouTube API (1 Stunde)

```
Browser Cache: 1 hour
Edge Cache: 2 hours (stale-while-revalidate)
Cloudflare Cache: 1 hour
Reason: Video-Metadaten ändern sich selten
```

## 🚀 Performance Optimizations

### 1. Code Splitting

- Shared utilities reduzieren Bundle-Size
- Lazy Loading von Services
- Tree-shaking friendly

### 2. Caching

- Cloudflare Cache API für YouTube
- Edge Caching für Search
- Stale-while-revalidate für bessere UX

### 3. Rate Limiting

- In-Memory für schnelle Checks
- Per-IP Tracking
- Graceful Degradation

### 4. Error Handling

- Strukturierte Errors
- Keine Sensitive Data Leaks
- Logging für Debugging

## 📈 Monitoring Points

### Performance

- Response Time (p50, p95, p99)
- Cache Hit Rate
- Worker CPU Time
- Request Volume

### Errors

- Error Rate by Endpoint
- Validation Failures
- API Failures (Groq, YouTube)
- Rate Limit Hits

### Security

- CORS Violations
- Invalid Endpoints
- Rate Limit Triggers
- API Key Usage

## 🔄 Future Architecture

### Phase 1: Current (✅ Completed)

- Modular worker structure
- Shared utilities
- Basic caching

### Phase 2: Enhanced (Planned)

- Cloudflare Vectorize (semantic search)
- Durable Objects (persistent rate limiting)
- Analytics Dashboard

### Phase 3: Advanced (Future)

- Request Batching
- GraphQL API
- WebSocket Support
- Multi-region deployment
