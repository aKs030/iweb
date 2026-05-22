# Styles Foundation Workflow

## Source of truth

- `content/styles/foundation.css` - CSS variables, theme overrides and layout defaults.
- `content/styles/utilities.css` - small reusable utility helpers.
- `content/styles/main.css` - app-shell base styles.
- `content/styles/overlays.css` - overlay-layer rules.

## Workflow

- `npm run dev` starts the local Cloudflare Pages server.
- Global CSS uses native cascade layers: `foundation`, `base`, `utilities`, `components`, `animations`.
- Theme toggling only changes `data-theme` on `<html>`.

## Rules

- Keep utilities small and only for repeated layout patterns.
- Prefer `var(--...)` from `foundation.css` instead of hardcoded component values.
- Keep numeric `@media` queries for now; document shared breakpoint semantics in code comments or constants.
