# Styles Foundation Workflow

## Source of truth

- `content/styles/foundation.css` - CSS variables, theme overrides and layout defaults.
- `content/styles/main.css` - app-shell base styles.
- `content/styles/pages/*.css` - route-specific page styles.
- `content/styles/overlays.css` - overlay-layer rules.
- `content/components/interactions/interactions.css` is linked directly on routes that need page CSS; avoid adding `@import` to route CSS files.

## Workflow

- `npm run dev` starts the local Cloudflare Pages server.
- Global CSS uses native cascade layers in this order: `foundation`, `base`, `components`, `pages`, `utilities`, `overrides`.
- Theme toggling only changes `data-theme` on `<html>`.

## Rules

- Keep shared utility classes in `main.css` small and only for repeated layout patterns.
- Prefer `var(--...)` from `foundation.css` instead of hardcoded component values.
- Page-local tokens in `content/styles/pages/*.css` use route prefixes such as `--home-*`, `--projects-*`, `--admin-*`.
- Prefer container queries for component layout changes in cards, contact surfaces, menu, HUD and robot chat. Keep media queries for viewport height, safe-area, page scroll and overlay anchoring.
- Blur budget: backdrop blur is capped at `20px` desktop, `14px` mobile and `12px` compact surfaces; decorative filter blur is capped at `72px`.
- Static `<img>` assets must include `width`, `height`, `decoding` and either `loading` or `fetchpriority="high"`.
