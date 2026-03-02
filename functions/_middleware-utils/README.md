# Middleware Utilities

Modular utilities for Cloudflare Pages Middleware (`functions/_middleware.js`).

## Modules

### `csp-manager.js`

- `generateNonce()` — Cryptographic nonce for CSP

### `template-injector.js`

- `loadTemplateFromURL()` — Fetch template content from KV/origin
- `SectionInjector` — HTMLRewriter handler for ESI-style section injection

### `streaming-handlers.js`

- `TemplateCommentHandler` — Injects head/loader templates via HTMLRewriter
- `NonceInjector` — Adds nonce to inline scripts/styles
- `SeoMetaHandler` — Injects SEO meta tags into `<head>`

### `route-seo.js`

- `buildRouteMeta()` — Builds SEO metadata (title, description, OG tags) per route
- Internal helpers for blog, project, and video detail pages

### `dev-utils.js`

- `isLocalhost()` — Check if running locally
- `normalizeLocalDevHeaders()` — Adjust headers for localhost dev

## Architecture

```
_middleware.js
  ├── csp-manager.js        → Security (nonce)
  ├── template-injector.js   → Template loading + ESI
  ├── streaming-handlers.js  → HTMLRewriter transforms
  ├── route-seo.js           → SEO meta generation
  └── dev-utils.js           → Dev environment
```
