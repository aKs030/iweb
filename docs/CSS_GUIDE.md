# CSS Architecture Guide

**Status:** Active  
**Last Updated:** February 27, 2026

## Current CSS Setup

### Source of truth

- `content/styles/tokens/tokens.json`
- `content/styles/tokens/tokens-dark.json`

### Generated files

- `content/styles/tokens.css` (single runtime token entry with base + light + dark blocks)
- `content/styles/utilities.generated.css`

### Runtime loading

Loaded in `content/templates/base-head.html`:

1. `tokens.css`
2. `root.css`
3. `main.css`
4. `animations.css`
5. `loader.css`

Theme switching is attribute-based on `<html data-theme="light|dark">`.

## Development Workflow

### Local development

```bash
npm run dev
```

This runs preflight generation (`tokens.css` + utilities), starts token watch mode, and runs `wrangler pages dev`.

### Token and utility generation

```bash
npm run styles:generate
npm run dev
```

### Quality gates

```bash
npm run qa
```

`npm run qa` enthält Lint, Format, Stylelint, Token-Check, CSS-Audit, AI-Index-Check und Struktur-Check.

## Authoring Rules

- Use `var(--...)` tokens for color, spacing, radius, shadows, and z-index.
- Avoid hardcoded design values in component/page CSS.
- Keep global styles in `content/styles/*`.
- Keep page-local styles in `pages/*`.
- Keep component styles reusable and token-based in `content/components/*`.

## Token Rules

- Edit only JSON token sources in `content/styles/tokens/`.
- Do not manually edit generated `tokens.css`.
- Dark/light overrides belong in selector blocks, not in duplicated files.

## Troubleshooting

### Token changes not visible

Run:

```bash
npm run styles:generate
```

### Theme not switching

- Verify `<html>` has `data-theme`.
- Verify `tokens.css` is loaded before component styles.

### CSS quality check fails

Run in sequence:

```bash
npm run qa:fix
npm run qa
```

## Related Docs

- `content/styles/README.md`
- `docs/PROJECT_STRUCTURE.md`
- `docs/CODE_QUALITY.md`
