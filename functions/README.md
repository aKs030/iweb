# Cloudflare Pages Functions

API endpoints for the portfolio website using Cloudflare Pages Functions.

## 📁 Structure

```
functions/
├── api/
│   ├── search.js       # AI-powered search endpoint
│   └── ai.js           # AI chat endpoint
└── _middleware.js      # Request middleware
```

## 🔧 API Endpoints

### POST /api/search

AI-powered search with RAG (Retrieval-Augmented Generation).

**Request:**

```json
{
  "query": "Three.js projects",
  "topK": 10
}
```

**Response:**

```json
{
  "results": [
    {
      "url": "/projekte",
      "title": "Projekte Übersicht",
      "description": "Entdecken Sie meine Webentwicklungsprojekte",
      "category": "Projekte",
      "score": 0.95
    }
  ],
  "summary": "Ich habe mehrere Three.js Projekte...",
  "count": 5,
  "query": "Three.js projects"
}
```

**Features:**

- Cloudflare AI integration via Service Binding
- RAG-based search with context
- Result deduplication and normalization
- AI-generated summaries
- URL mapping for better results

### POST /api/ai

Direct AI chat endpoint.

**Request:**

```json
{
  "prompt": "Tell me about your projects",
  "message": "What projects do you have?",
  "systemInstruction": "You are a portfolio assistant...",
  "ragId": "suche",
  "maxResults": 5
}
```

**Response:**

```json
{
  "text": "I have several web development projects...",
  "response": "...",
  "answer": "..."
}
```

## 🔐 Environment Variables

Required environment variables (set in Cloudflare Pages):

```bash
# AI Search Configuration
AI_SEARCH_INDEX=suche
RAG_ID=suche
MAX_SEARCH_RESULTS=10
```

## 🔗 Service Bindings

The API uses Cloudflare Service Bindings for secure communication:

```toml
# wrangler.toml (or Pages settings)
[[services]]
binding = "AI_SEARCH"
service = "ai-search-worker"
```

## 🚀 Development

### Local Testing

```bash
# Start dev server with functions
npm run dev

# Test search endpoint
curl -X POST http://localhost:8080/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "Three.js", "topK": 5}'
```

### Middleware

The `_middleware.js` handles:

- Template injection for HTML pages
- Request/response processing
- Error handling

## 📊 Performance

- **Caching:** Results cached via Cloudflare CDN
- **Parallel Requests:** Search and AI summary fetched in parallel
- **Error Handling:** Graceful fallbacks for failed requests
- **CORS:** Configured for cross-origin requests

## 🔍 Search Features

### URL Normalization

Automatically normalizes URLs:

- Removes `index.html`
- Removes trailing slashes
- Handles relative and absolute URLs

### Result Improvement

Static mappings for better results:

- Main pages (home, projects, blog, etc.)
- Blog posts
- Video pages

### Deduplication

Removes duplicate results based on normalized URLs.

## 🛠️ Deployment

Automatic deployment via Cloudflare Pages:

```bash
# Manual deployment
npm run build
npm run deploy
```

## 📚 Documentation

- [Cloudflare Pages Functions](https://developers.cloudflare.com/pages/functions/)
- [Cloudflare AI](https://developers.cloudflare.com/workers-ai/)
- [Service Bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/)

## 🔧 Troubleshooting

### Check Logs

```bash
# View deployment logs
wrangler pages deployment tail

# View function logs
wrangler pages deployment tail --project-name=your-project
```

### Common Issues

**Service Binding not found:**

- Ensure `AI_SEARCH` binding is configured in Pages settings
- Check that the bound service is deployed

**Empty search results:**

- Verify `AI_SEARCH_INDEX` and `RAG_ID` are set correctly
- Check that the AI search service has indexed content

**CORS errors:**

- Verify CORS headers in function responses
- Check that origin is allowed

---

**Last Updated:** February 2026  
**Version:** 6.0.0
