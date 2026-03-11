# API Functions

Server-side logic powered by Cloudflare Pages Functions.

## Endpoints

| File                   | Description                                                       |
| ---------------------- | ----------------------------------------------------------------- |
| `ai-agent.js`          | Primary robot endpoint: SSE, tool-calling, image analysis, memory |
| `ai-agent-user.js`     | List/delete robot memory + user mapping in Cloudflare             |
| `admin/content-rag.js` | Protected sync/status endpoint for Jules content RAG              |
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
| `_content-rag.js`      | Build/sync/query the Vectorize corpus for blog posts, projects, about, and videos     |
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

Hybrid engine: Vectorize semantic search plus a KV-backed lexical fallback, intent analysis, metadata filtering, and result balancing.

## Content RAG Workflow

`ai-agent.js` now prefers a dedicated Vectorize corpus built from:

- `/pages/blog/posts/index.json` plus the referenced Markdown posts
- `/pages/projekte/apps-config.json`
- `/pages/about/index.html`
- YouTube channel uploads via `loadYouTubeVideos()`

Sync the corpus after content changes:

```bash
ADMIN_TOKEN=... npm run sync:content-rag -- --url=https://www.abdulkerimsesli.de
```

The sync is delta-aware: unchanged documents reuse their existing vectors, only changed documents are re-embedded, and removed documents have their stale chunk IDs deleted from Vectorize. Each sync also writes a compact lexical search index into KV, so query-time retrieval can merge Vectorize hits with deterministic keyword matches, rerank the combined candidates, and pass 1-2 preferred source links into the agent prompt.

Runtime retrieval is budgeted with `ROBOT_CONTEXT_TIMEOUT_MS` (default `3500`). Memory recall and RAG retrieval respect that limit on the request path, while prompt-memory persistence runs in `context.waitUntil(...)` so user responses stay fast without dropping long-running background writes.

Der Robot-Agent persistiert die zugewiesene User-ID zusätzlich als First-Party-Cookie (`jules_user_id`). Damit bleiben Cloudflare-Memories auch nach Reloads verfügbar, selbst wenn der Frontend-Runtime-State verloren geht; der Client spiegelt dieselbe ID außerdem in `localStorage`.

Create the metadata indexes once on Cloudflare before relying on Vectorize filters:

```bash
npx wrangler vectorize create-metadata-index jules-content-rag --property-name=sourceType --type=string
npx wrangler vectorize create-metadata-index jules-content-rag --property-name=category --type=string
```

Reusable setup shortcut:

```bash
ADMIN_TOKEN=... npm run setup:content-rag-index -- --url=https://www.abdulkerimsesli.de
```

Because Cloudflare only indexes metadata that was present after the metadata index existed, run one forced full resync after creating those indexes:

```bash
ADMIN_TOKEN=... npm run sync:content-rag -- --url=https://www.abdulkerimsesli.de --full
```

Status only:

```bash
ADMIN_TOKEN=... npm run sync:content-rag -- --status --url=https://www.abdulkerimsesli.de
```

Query-time retrieval inspection for evals/debugging:

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "https://www.abdulkerimsesli.de/api/admin/content-rag?query=Wer%20ist%20Abdulkerim%20Sesli"
```

Curated retrieval evaluation set:

```bash
ADMIN_TOKEN=... npm run eval:content-rag -- --url=https://www.abdulkerimsesli.de
```

GitHub Preview Deployments in [`.github/workflows/main.yml`](../../.github/workflows/main.yml) trigger this sync automatically after a successful Cloudflare deploy and then run the evaluation set when these repository secrets exist:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `ADMIN_TOKEN` (must match the `ADMIN_TOKEN` configured in Cloudflare Pages)

Pushes to `main`/`master` also run a production sync job. It first polls `GET /api/admin/content-rag` until the live Pages runtime reports the pushed `CF_PAGES_COMMIT_SHA`, then executes the sync and evaluation set. Optional GitHub variable:

- `PRODUCTION_SITE_URL` (default: `https://www.abdulkerimsesli.de`)

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
- `ROBOT_CONTEXT_TIMEOUT_MS` (default: `3500`)
- `ROBOT_MEMORY_TOP_K`
- `ROBOT_MEMORY_SCORE_THRESHOLD`
- `ROBOT_CONTENT_RAG_TOP_K` (default: `4`)
- `ROBOT_CONTENT_RAG_HYBRID_TOP_K` (default: `6`)
- `ROBOT_CONTENT_RAG_SCORE_THRESHOLD` (default: `0.25`)
- `ROBOT_CONTENT_RAG_LEXICAL_SCORE_THRESHOLD` (default: `0.18`)
- `ROBOT_MEMORY_RETENTION_DAYS` (default: `180`)
- `ROBOT_TOOL_TRUSTED_IDS` (CSV User-IDs mit erweiterten Tool-Rechten)
- `ROBOT_TOOL_ADMIN_IDS` (CSV User-IDs mit Admin-Rechten)
- `ROBOT_ENABLED_INTEGRATIONS` (CSV, z.B. `links,social,email,calendar` oder `none`)
