# Middleware Utilities

Modular utilities for Cloudflare Pages Middleware (`functions/_middleware.js`).

## Modules

### `csp-manager.js`

- `generateNonce()` — Cryptographic nonce for CSP

### `critical-css.js` ✨ NEW

- `preloadCriticalCss()` — Pre-load foundation.css + split menu CSS from KV/ASSETS
- `CriticalCssInliner` — HTMLRewriter handler that:
  - Inlines foundation.css + menu-base/search/states/mobile as `<style>` tags
  - Converts main.css + animations.css + menu-backdrop.css to async loading via media-swap pattern

### `edge-speculation.js` ✨ NEW

- `EdgeSpeculationRules` — Injects route-aware Speculation Rules before `</head>`
- `StaticSpeculationRemover` — Removes static baseline rules from the global head template
- Route → prefetch URL mapping for all pages

### `edge-cache.js` ✨ NEW

- `matchEdgeCache()` — Check Cloudflare Cache API for transformed HTML
- `storeInEdgeCache()` — Store response in Cache API (async, non-blocking)
- `buildCacheKey()` — Deterministic cache keys (preserves HTML-relevant query params + language variant)

### `request-policy.js` ✨ NEW

- `prepareDocumentUpstreamRequest()` — strips conditional headers only for rewritten document requests
- `resolveRequestRedirect()` — centralizes favicon, canonical host, and legacy project redirects

### `template-cache.js` ✨ NEW

- `DEPLOY_VERSION` — shared middleware/template version marker
- `KV_KEYS` — versioned template cache keys
- `applyBuildVersion()` — replaces `{{DEPLOY_VERSION}}` placeholders
- `loadTemplateWithCache()` — SWR template fetch from KV/ASSETS

### `html-transform.js` ✨ NEW

- `createHtmlSecurityContext()` — shared CSP/nonce context for cache hits and fresh HTML
- `createHtmlRewriter()` — builds the full HTMLRewriter pipeline in one place
- `buildCacheHitHtmlResponse()` — refreshes nonce/CSP on cached HTML
- `buildFinalHtmlResponse()` — applies final response headers, Link hints, and Server-Timing

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

## Related Shared Utilities

### `../_shared/asset-proxy.js`

- Shared cache/path/header helpers for `functions/api/project-apps/[[path]].js` and `functions/r2-proxy/[[path]].js`
- Handles encoded path normalization, conditional `304` responses, and Cache API hits/misses without duplicate proxy code

### `../_shared/media-assets.js` ✨ NEW

- Shared media extension patterns for gallery, sitemap, and proxy routes
- Canonical content-type maps for `project-apps` and `r2-proxy`
- `inferGalleryAssetType()` for consistent image/video classification

## Architecture

```
_middleware.js (v7.1 — Edge Streaming)
  │
  ├── request-policy.js        → Redirects + HTML request shaping
  ├── template-cache.js        → Versioned template KV cache
  ├── html-transform.js        → HTMLRewriter + final HTML headers
  ├── edge-cache.js            → Cache API (skip pipeline on hit)
  ├── critical-css.js          → CSS inlining + async loading
  ├── edge-speculation.js      → Route-aware Speculation Rules
  ├── early-hints.js           → HTTP Link headers
  ├── csp-manager.js           → Security (nonce)
  ├── template-injector.js     → Section ESI injection (KV-cached SWR)
  ├── streaming-handlers.js    → HTMLRewriter transforms
  ├── route-seo.js             → SEO meta generation
  └── dev-utils.js             → Dev environment
```

## Edge Streaming Pipeline (v7.1)

```
Browser Request
  │
  ├─→ [1] Edge HTML Cache check → if HIT: inject fresh nonce → respond (~0ms)
  │        Cache key varies only on HTML-relevant query params + language
  │
  ├─→ [2] MISS: Parallel fetch (upstream + global-head template + route-meta + critical CSS)
  │
  ├─→ [3] HTMLRewriter pipeline (7 handlers, single pass):
  │        ① Section injection (hero/section3 from KV ~1ms)
  │        ② Template injection (global-head.html)
  │        ③ Critical CSS inlining (foundation.css + split menu CSS as <style>)
  │        ④ Static speculation rules removal
  │        ⑤ Route-aware speculation rules injection
  │        ⑥ SEO meta injection
  │        ⑦ CSP nonce injection
  │
  ├─→ [4] Response headers: Link preload + Deploy-Version + Server-Timing
  │        Stale entity headers (ETag/Last-Modified) are stripped on rewritten HTML
  │
  ├─→ [5] Stream to browser + async store in Edge Cache
  │
  └─→ [6] Browser: CSS already loading (Link headers) → FCP ~200-400ms faster

Deploy-Version Sync:
  Edge sends X-Deploy-Version → SW detects mismatch → purges stale cache
```

## KV Cache Keys

| Key Pattern                                          | Content                                | TTL    |
| ---------------------------------------------------- | -------------------------------------- | ------ |
| `template:{v}:global-head`                           | Global head template (base/standalone) | 1h SWR |
| `section:{v}:/pages/home/hero`                       | Hero Section HTML                      | 1h SWR |
| `section:{v}:/pages/home/section3`                   | Section3 HTML                          | 1h SWR |
| `css:{v}:/content/styles/foundation.css`             | Core Style Foundation                  | 1h SWR |
| `css:{v}:/content/components/menu/menu-base.css`     | Menu shell base CSS                    | 1h SWR |
| `css:{v}:/content/components/menu/menu-search.css`   | Menu search layout CSS                 | 1h SWR |
| `css:{v}:/content/components/menu/menu-states.css`   | Menu interaction/state CSS             | 1h SWR |
| `css:{v}:/content/components/menu/menu-mobile.css`   | Menu mobile shell CSS                  | 1h SWR |
| `css:{v}:/content/components/menu/menu-backdrop.css` | Menu overlay backdrop CSS              | 1h SWR |
