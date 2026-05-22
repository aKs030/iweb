# Configuration Files

This directory groups runtime, SEO and media-related configuration.

## What Lives Here

- `env.config.js` - runtime IDs, base URLs and environment detection.
- `routes-config.js` - per-route SEO defaults and Open Graph fallback data.
- `media-urls.js` - shared media helpers and local-dev R2 resolution.
- `constants.js` - global non-media constants such as `BASE_URL`.

## Data Boundaries

- Canonical brand, locale and typewriter data live under `content/data/`.
- `pages/projekte/apps-config.json` is the source of truth for project app links and preview metadata.
- Runtime code should prefer shared helpers from `media-urls.js` over ad-hoc URL construction.
- `window.ENV` and `window.__ENV__` remain the supported browser-side injection points.

## Local Values

```bash
# .dev.vars
YOUTUBE_API_KEY=your_api_key_here
YOUTUBE_CHANNEL_ID=UCTGRherjM4iuIn86xxubuPg
```
