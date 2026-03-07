# Middleware Utilities

Modular utilities for Cloudflare Pages Middleware (`functions/_middleware.js`).

## Modules

### `csp-manager.js`

- `generateNonce()` — Cryptographic nonce for CSP

### `critical-css.js` ✨ NEW

- `preloadCriticalCss()` — Pre-load tokens.css + root.css from KV/ASSETS
- `CriticalCssInliner` — HTMLRewriter handler that:
  - Inlines tokens.css + root.css as `<style>` tags (eliminates 2 render-blocking requests)
  - Converts main.css + animations.css to async loading via media-swap pattern

### `edge-speculation.js` ✨ NEW

- `EdgeSpeculationRules` — Injects route-aware Speculation Rules before `</head>`
- `StaticSpeculationRemover` — Removes static baseline rules from the global head template
- Route → prefetch URL mapping for all pages

### `edge-cache.js` ✨ NEW

- `matchEdgeCache()` — Check Cloudflare Cache API for transformed HTML
- `storeInEdgeCache()` — Store response in Cache API (async, non-blocking)
- `buildCacheKey()` — Deterministic cache keys (strips query params)

### `early-hints.js`

- `buildResponseLinkHeaders()` — Pre-computed Link header values for HTTP response

### `template-injector.js`

- `loadTemplateFromURL()` — Fetch template content from ASSETS binding
- `SectionInjector` — HTMLRewriter handler for ESI-style section injection (KV-cached SWR)

### `streaming-handlers.js`

- `TemplateCommentHandler` — Injects the global head template via HTMLRewriter
- `NonceInjector` — Adds nonce to inline scripts/styles
- `SeoMetaHandler` — Injects SEO meta tags into `<head>`

### `route-seo.js`

- `buildRouteMeta()` — Builds SEO metadata per route (blog, project, video)

### `dev-utils.js`

- `isLocalhost()` — Check if running locally
- `normalizeLocalDevHeaders()` — Adjust headers for localhost dev

## Architecture

```
_middleware.js (v7.0 — Edge Streaming)
  │
  ├── edge-cache.js            → Cache API (skip pipeline on hit)
  ├── critical-css.js          → CSS inlining + async loading
  ├── edge-speculation.js      → Route-aware Speculation Rules
  ├── early-hints.js           → HTTP Link headers
  ├── csp-manager.js           → Security (nonce)
  ├── template-injector.js     → Template loading + ESI (KV-cached SWR)
  ├── streaming-handlers.js    → HTMLRewriter transforms
  ├── route-seo.js             → SEO meta generation
  └── dev-utils.js             → Dev environment
```

## Edge Streaming Pipeline (v7.0)

```
Browser Request
  │
  ├─→ [1] Edge HTML Cache check → if HIT: inject fresh nonce → respond (~0ms)
  │
  ├─→ [2] MISS: Parallel fetch (upstream + global-head template + route-meta + critical CSS)
  │
  ├─→ [3] HTMLRewriter pipeline (7 handlers, single pass):
  │        ① Section injection (hero/section3 from KV ~1ms)
  │        ② Template injection (global-head.html)
  │        ③ Critical CSS inlining (tokens.css + root.css as <style>)
  │        ④ Static speculation rules removal
  │        ⑤ Route-aware speculation rules injection
  │        ⑥ SEO meta injection
  │        ⑦ CSP nonce injection
  │
  ├─→ [4] Response headers: Link preload + Deploy-Version + Server-Timing
  │
  ├─→ [5] Stream to browser + async store in Edge Cache
  │
  └─→ [6] Browser: CSS already loading (Link headers) → FCP ~200-400ms faster

Deploy-Version Sync:
  Edge sends X-Deploy-Version → SW detects mismatch → purges stale cache
```

## KV Cache Keys

| Key Pattern                          | Content                                | TTL    |
| ------------------------------------ | -------------------------------------- | ------ |
| `template:{v}:global-head`           | Global head template (base/standalone) | 1h SWR |
| `section:{v}:/pages/home/hero`       | Hero Section HTML                      | 1h SWR |
| `section:{v}:/pages/home/section3`   | Section3 HTML                          | 1h SWR |
| `css:{v}:/content/styles/tokens.css` | Design Tokens CSS                      | 1h SWR |
| `css:{v}:/content/styles/root.css`   | Root Layout CSS                        | 1h SWR |
