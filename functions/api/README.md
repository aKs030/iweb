# API Functions

Server-side logic powered by Cloudflare Pages Functions.

## Endpoints

| File                   | Description                                                       |
| ---------------------- | ----------------------------------------------------------------- |
| `ai-agent.js`          | Primary robot endpoint: SSE, tool-calling, image analysis, memory |
| `ai-agent-user.js`     | List/delete robot memory + user mapping in Cloudflare             |
| `admin/content-rag.js` | Protected update/status endpoint for Jules content RAG            |
| `workers-assistant.js` | Workers code-generation assistant                                 |
| `search.js`            | Hybrid search (AutoRAG + deterministic fallback)                  |
| `contact.js`           | Contact form handler (email via MailChannels)                     |
| `gallery-items.js`     | Gallery media listing (R2 storage)                                |
| `feed.xml.js`          | RSS/Atom feed generator                                           |
| `youtube/[[path]].js`  | YouTube Data API v3 proxy                                         |

## Shared Utilities

| File                   | Exports                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------- |
| `_cors.js`             | `getCorsHeaders()`, `handleOptions()`                                                 |
| `_ai-search-config.js` | `resolveAiSearchConfig()`, `buildAiSearchRequest()`, `clampResults()`                 |
| `_content-rag.js`      | Build/update/query the Vectorize corpus for blog posts, projects, about, and videos   |
| `_cleanup-patterns.js` | `CLEANUP_PATTERNS`, `HTML_ENTITIES`                                                   |
| `_gallery-service.js`  | Gallery listing/cache service over the R2 bucket                                      |
| `_rate-limit.js`       | Shared window-based rate limiter for middleware and contact handling                  |
| `_request-utils.js`    | Request helpers such as client IP resolution                                          |
| `_search-url.js`       | `normalizeUrl()`, `canonicalizeUrlPath()`, `detectCategory()`, `extractTitle()`       |
| `_sitemap-data.js`     | Blog/project/R2 constants, data loaders                                               |
| `_sitemap-snapshot.js` | `saveSitemapSnapshot()`, `loadSitemapSnapshot()`, `respondWithSnapshotOr503()`        |
| `_response.js`         | `jsonResponse()`, `errorJsonResponse()`                                               |
| `_text-utils.js`       | `normalizeText()`, `sanitizeDiscoveryText()`, `formatSlug()`                          |
| `_html-utils.js`       | `escapeHtml()`                                                                        |
| `_xml-utils.js`        | `escapeXml()`, `normalizePath()`, `resolveOrigin()`, `toISODate()`, `toAbsoluteUrl()` |
| `_youtube-utils.js`    | YouTube API helpers                                                                   |
| `_middleware.js`       | API rate-limiting middleware (auto-loaded)                                            |

## Related Shared Utilities

- `functions/_shared/asset-proxy-route.js` — generic proxy route factory for `project-apps` and `r2-proxy`
- `functions/_shared/gallery-media.js` — gallery metadata enrichment, blur placeholders, and image dimension probing
- `functions/_shared/http-headers.js` — shared cache-control constants, Accept presets, and header merging
- `functions/_shared/media-assets.js` — canonical media extension rules and content-type maps

## Search Architecture

Hybrid engine: Vectorize semantic search plus a KV-backed lexical fallback, intent analysis, metadata filtering, and result balancing.

## Content RAG Workflow

`ai-agent.js` now prefers a dedicated Vectorize corpus built from:

- `/pages/blog/posts/index.json` plus the referenced Markdown posts
- `/pages/projekte/apps-config.json`
- `/pages/about/index.html`
- YouTube channel uploads via `loadYouTubeVideos()`

Update the corpus after content changes:

```bash
ADMIN_TOKEN=... npm run content-rag:update -- --url=https://www.abdulkerimsesli.de
```

The update is delta-aware: unchanged documents reuse their existing vectors, only changed documents are re-embedded, and removed documents have their stale chunk IDs deleted from Vectorize. Each update also writes a compact lexical search index into KV, so query-time retrieval can merge Vectorize hits with deterministic keyword matches, rerank the combined candidates, and pass 1-2 preferred source links into the agent prompt.

Runtime retrieval is budgeted with `ROBOT_CONTEXT_TIMEOUT_MS` (default `3500`). Memory recall and RAG retrieval respect that limit on the request path, while prompt-memory persistence runs in `context.waitUntil(...)` so user responses stay fast without dropping long-running background writes.

Der Robot-Agent arbeitet identifier-basiert: Memories werden über die stabile User-ID aufgelöst. Die Identität läuft name-basiert über `?name=` und verzichtet auf lokale Persistenz (keine Cookies, kein Local/Session Storage für Chat-IDs). Profil- und Memory-Operationen für das Chatfenster laufen zusätzlich über `POST /api/ai-agent-user`.

Create the metadata indexes once on Cloudflare before relying on Vectorize filters:

```bash
npx wrangler vectorize create-metadata-index jules-content-rag --property-name=sourceType --type=string
npx wrangler vectorize create-metadata-index jules-content-rag --property-name=category --type=string
```

Reusable setup shortcut:

```bash
ADMIN_TOKEN=... npm run setup:content-rag-index -- --url=https://www.abdulkerimsesli.de
```

Because Cloudflare only indexes metadata that was present after the metadata index existed, run one forced full update after creating those indexes:

```bash
ADMIN_TOKEN=... npm run content-rag:update -- --url=https://www.abdulkerimsesli.de --full
```

Status only:

```bash
ADMIN_TOKEN=... npm run content-rag:status -- --url=https://www.abdulkerimsesli.de
```

GitHub Preview Deployments in [`.github/workflows/main.yml`](../../.github/workflows/main.yml) stay limited to preview deploys. Content-RAG updates are intentionally manual for the live domain. Preview deploys continue to require these repository secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

## Development

```bash
npm run qa
npm run types:wrangler
npm run build:functions
npm run cloudflare:drift
npm run dev:server
npm run clean:dev
```

`npm run dev:server` now uses the real `GALLERY_BUCKET` via Wrangler's `remote: true` binding, so local `r2-proxy` and gallery reads stay much closer to production without a route-specific live-mode hack.

## Robot Cloudflare Config (Wrangler)

Der Robot-Agent liest seine Cloudflare-Konfiguration aus `wrangler.jsonc`:

- `ROBOT_CHAT_MODEL`
- `ROBOT_EMBEDDING_MODEL`
- `ROBOT_IMAGE_MODEL`
- `ROBOT_MAX_TOKENS`
- `ROBOT_MAX_HISTORY_TURNS`
- `ROBOT_CONTEXT_TIMEOUT_MS` (default: `3500`)
- `ROBOT_MEMORY_TOP_K`
- `ROBOT_MEMORY_SCORE_THRESHOLD`
- `ROBOT_MEMORY_RETENTION_DAYS` (default: `180`)
- `ROBOT_TOOL_TRUSTED_IDS` (CSV User-IDs mit erweiterten Tool-Rechten)
- `ROBOT_TOOL_ADMIN_IDS` (CSV User-IDs mit Admin-Rechten)
- `ROBOT_ENABLED_INTEGRATIONS` (CSV, z.B. `links,social,email,calendar` oder `none`)
