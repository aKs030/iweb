# Cloudflare Workers

Edge-Worker für AI-Suche und RAG (Retrieval Augmented Generation) mit RPC-Support.

## Struktur

```
workers/
├── wrangler.toml                 # Deployment-Konfiguration
├── shared/
│   ├── response-utils.js         # JSON/Error Responses, CORS
│   └── search-utils.js           # Cloudflare AI Search Integration
└── ai-search-proxy/
    ├── index.js                  # Entry Point (Fetch + RPC)
    ├── validation.js             # Input-Validierung
    ├── handlers/
    │   ├── search.js             # POST /api/search Handler
    │   └── ai.js                 # POST /api/ai Handler
    └── services/
        └── groq.js               # Groq API Client
```

## Workers

### AI Search Proxy

| Endpoint      | Methode    | Beschreibung                               |
| ------------- | ---------- | ------------------------------------------ |
| `/api/search` | POST / RPC | Volltextsuche via Cloudflare AI Search     |
| `/api/ai`     | POST / RPC | Groq AI (Llama 3.3 70B) mit optionalem RAG |

Der Worker unterstützt sowohl die standardmäßige **Fetch API** als auch **Service Binding RPC** via `AISearch` Klasse.

**Secrets:** `GROQ_API_KEY` — [Kostenlos bei Groq](https://console.groq.com/keys)

## Deployment

```bash
# Secrets setzen
wrangler secret put GROQ_API_KEY

# AI Search Proxy deployen
wrangler deploy

# Logs
wrangler tail
```

## Lokale Entwicklung

```bash
wrangler dev              # AI Search Proxy
```

## Beispiele

### RPC (via Pages Functions)

```javascript
// In einer Pages Function via Service Binding "AI_SEARCH"
const results = await env.AI_SEARCH.search('Query', { mode: 'search' });
```

### HTTP

```bash
# Suche
curl -X POST https://abdulkerimsesli.de/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "react", "topK": 5}'

# AI mit RAG
curl -X POST https://abdulkerimsesli.de/api/ai \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Was sind deine Projekte?", "options": {"useSearch": true}}'
```
