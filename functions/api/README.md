# API Functions

Server-side logic powered by Cloudflare Pages Functions.

## Endpoints

| File                   | Description                                         |
| ---------------------- | --------------------------------------------------- |
| `ai.js`                | Lightweight AI chat with RAG (Workers AI + AutoRAG) |
| `ai-agent.js`          | Agentic AI with SSE streaming, tool-calling, memory |
| `workers-assistant.js` | Workers code-generation assistant                   |
| `search.js`            | Hybrid search (AutoRAG + deterministic fallback)    |
| `contact.js`           | Contact form handler (email via MailChannels)       |
| `gallery-items.js`     | Gallery media listing (R2 storage)                  |
| `feed.xml.js`          | RSS/Atom feed generator                             |
| `youtube/[[path]].js`  | YouTube Data API v3 proxy                           |

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
