# API Functions

Server-side logic powered by Cloudflare Pages Functions.

## Endpoints

| File                   | Description                                                       |
| ---------------------- | ----------------------------------------------------------------- |
| `ai.js`                | Lightweight AI chat with RAG (Workers AI + AutoRAG)               |
| `ai-agent.js`          | Primary robot endpoint: SSE, tool-calling, image analysis, memory |
| `ai-agent-user.js`     | List/delete robot memory + user mapping in Cloudflare             |
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
| `_cleanup-patterns.js` | `CLEANUP_PATTERNS`, `HTML_ENTITIES`                                                   |
| `_search-url.js`       | `normalizeUrl()`, `canonicalizeUrlPath()`, `detectCategory()`, `extractTitle()`       |
| `_sitemap-data.js`     | Blog/project/R2 constants, data loaders                                               |
| `_sitemap-snapshot.js` | `saveSitemapSnapshot()`, `loadSitemapSnapshot()`, `respondWithSnapshotOr503()`        |
| `_text-utils.js`       | `normalizeText()`, `sanitizeDiscoveryText()`, `formatSlug()`                          |
| `_html-utils.js`       | `escapeHtml()`                                                                        |
| `_xml-utils.js`        | `escapeXml()`, `normalizePath()`, `resolveOrigin()`, `toISODate()`, `toAbsoluteUrl()` |
| `_youtube-utils.js`    | YouTube API helpers                                                                   |
| `_middleware.js`       | API rate-limiting middleware (auto-loaded)                                            |

## Search Architecture

Hybrid engine: AutoRAG semantic search with deterministic fallback scoring, intent analysis, and result balancing.

## Development

```bash
npm run qa
```

## Robot Cloudflare Config (Wrangler)

Der Robot-Agent liest seine Cloudflare-Konfiguration aus `wrangler.jsonc`:

- `ROBOT_CHAT_MODEL`
- `ROBOT_EMBEDDING_MODEL`
- `ROBOT_IMAGE_MODEL`
- `ROBOT_MAX_TOKENS`
- `ROBOT_MAX_HISTORY_TURNS`
- `ROBOT_MEMORY_TOP_K`
- `ROBOT_MEMORY_SCORE_THRESHOLD`
- `ROBOT_MEMORY_RETENTION_DAYS` (default: `180`)
- `ROBOT_TOOL_TRUSTED_IDS` (CSV User-IDs mit erweiterten Tool-Rechten)
- `ROBOT_TOOL_ADMIN_IDS` (CSV User-IDs mit Admin-Rechten)
- `ROBOT_ENABLED_INTEGRATIONS` (CSV, z.B. `links,social,email,calendar` oder `none`)
