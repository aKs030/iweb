# Configuration Files

This directory centralizes runtime and SEO configuration.

## Environment Config

`env.config.js` resolves runtime IDs and environment values:

- GTM / GA4 / Google Ads IDs
- Base URL (production vs localhost)
- YouTube channel + optional API key
- Environment detection (`isDev`, `isPreview`, `isProd`)

Runtime values can be injected via `window.ENV` or `window.__ENV__`.

### Local Variables

```bash
# .dev.vars
YOUTUBE_API_KEY=your_api_key_here
YOUTUBE_CHANNEL_ID=UCTGRherjM4iuIn86xxubuPg
```

## Route Meta

`routes-config.js` defines per-route SEO defaults:

- title / description (DE + EN)
- semantic page type
- default Open Graph image

## Brand Data

`brand-data.json` stores canonical brand identity and schema fields:

- name / legalName / alternateName
- social profiles (`sameAs`)
- language, occupation and contact points

`brand-data-loader.js` normalizes this payload for JSON-LD usage.

## Shared Constants

`constants.js` is the source for URLs and reusable asset helpers:

- `BASE_URL`, `BASE_URL_DEV`
- R2 paths (`R2_PUBLIC_BASE_URL`, `R2_ICONS_BASE_URL`, `R2_BLOG_BASE_URL`)
- asset URL helpers (`iconUrl`, `ogImageUrl`)

## Static Site Assets

Static site-level assets are exported from `constants.js` (for example `FAVICON_512`).
