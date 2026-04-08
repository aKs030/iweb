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

The media-bearing fields in `brand-data.json`, `person.jsonld`,
`manifest.json`, `content/templates/global-head.html`,
`pages/about/index.html`, `index.html`, `pages/videos/index.html`,
`pages/blog/posts/index.json`, `pages/blog/posts/*.md`,
`pages/projekte/apps-config.json`, and `pages/projekte/index.html` are
maintained manually from `media-urls.js`.

`pages/projekte/apps-config.json` remains the canonical project-app config for
`appPath`, `githubPath`, `previewUrl`, and `previewAlt`, and is checked by
`scripts/validate-apps-config.mjs` during repo linting.

## Shared Constants

`media-urls.js` is the canonical source for shared media URLs and local-dev R2
resolution:

- `BASE_URL`, `BASE_URL_DEV`
- public R2 builders (`buildR2Url`, `buildProjectPreviewUrl`)
- local runtime resolvers (`resolveR2Url`, `resolveProjectPreviewUrl`)
- direct media URLs (`FAVICON_ICO_URL`, `FAVICON_512_URL`, `OG_HOME_IMAGE_URL`)

## Static Site Media

Static site-level media URLs are exported from `constants.js` (for example `FAVICON_512`).

Project preview media URLs live in `pages/projekte/apps-config.json` as
`previewUrl` and `previewAlt`, and project links live there as `appPath` and
`githubPath`. Runtime code should still use the shared helpers in `media-urls.js`,
so local `/r2-proxy` handling and preview fallbacks stay consistent even when
config data is incomplete.

Project apps are loaded on the same origin through
`functions/api/project-apps/[[path]].js`, so the frontend no longer depends on
third-party app hosting URLs at runtime.

`pages/blog/posts/index.json` is derived from the blog markdown frontmatter,
while image URLs in the markdown files remain aligned with `media-urls.js`.
