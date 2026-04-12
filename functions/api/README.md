# API Functions

Server-side logic powered by Cloudflare Pages Functions.

## Endpoints

| File                   | Description                                                       |
| ---------------------- | ----------------------------------------------------------------- |
| `ai-agent.js`          | Primary robot endpoint: SSE, tool-calling, image analysis, memory |
| `ai-agent-user.js`     | List/delete robot memory + user mapping in Cloudflare             |
| `search.js`            | Deterministische Suche über statische Inhalte und Sitemaps        |
| `contact.js`           | Contact form handler (email via Resend API)                       |
| `gallery-items.js`     | Gallery media listing (R2 storage)                                |
| `feed.xml.js`          | RSS/Atom feed generator                                           |
| `youtube/[[path]].js`  | YouTube Data API v3 proxy                                         |

## Shared Utilities

| File                   | Exports                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------- |
| `_cors.js`             | `getCorsHeaders()`, `handleOptions()`                                                 |
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

Deterministische Suche über Blogposts, Projekte, statische Seiten und Sitemap-Daten. Die Ergebnisliste wird lokal aufgebaut und ohne zusätzlichen Retrieval-Layer ergänzt.

Der Robot-Agent arbeitet identifier-basiert: Memories werden über die stabile User-ID aufgelöst. Die Identität läuft name-basiert über `?name=` und verzichtet auf lokale Persistenz (keine Cookies, kein Local/Session Storage für Chat-IDs). Profil- und Memory-Operationen für das Chatfenster laufen zusätzlich über `POST /api/ai-agent-user`.

## Development

```bash
npm run dev
npm run build
npm run sync
npm run clean:full
```

`npm run dev` runs the local Pages server via the shared Wrangler wrapper, applies local D1 migrations first, and uses the real `GALLERY_BUCKET` via Wrangler's `remote: true` binding, so local `r2-proxy` and gallery reads stay much closer to production without a route-specific live-mode hack.

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
- `ROBOT_ENABLED_INTEGRATIONS` (CSV, z.B. `links,social,email,calendar` oder `none`)
