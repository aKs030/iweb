# Styles Token Workflow

## Source of truth

- `content/styles/tokens/tokens.json`
- `content/styles/tokens/tokens-dark.json`

## Token file responsibilities

- `tokens.css` (generated): canonical design tokens + theme selector overrides.
- `variables.css` (handwritten): legacy aliases + responsive remapping only.
- `root.css` (handwritten): runtime-computed tokens + global runtime rules only.

## Generate token CSS

- `npm run styles:generate` -> updates `content/styles/tokens.css` (includes base + light + dark blocks)
- `npm run dev` -> single modern dev workflow (preflight + token watcher + app)

## Theme switching

- Theme attribute is set on `<html>` via `data-theme` (`dark` or `light`).
- `tokens.css` contains base + light + dark overrides (`:root[data-theme='light']`, `:root[data-theme='dark']`).
- Menu toggle only updates `data-theme`; no stylesheet enable/disable needed.

## Utilities

- Utility source is generated via `npm run styles:generate`.
- Generated file: `content/styles/utilities.generated.css`.
- Prefer token-bound utilities (`.mt-*`, `.gap-*`, `.p-*`) over inline spacing.

## Quality gates

- `npm run qa`

## Team rule

- Avoid hardcoded colors, spacing, radii, shadows and z-index values in components.
- Use `var(--...)` so token updates from JSON apply project-wide.

## Breakpoints

- Breakpoint tokens are defined in `tokens.json` (`--bp-*`) for shared reference (docs/JS/tooling).
- Keep numeric `@media` queries in CSS for now; native CSS variables are not supported inside media queries.
- If you want tokenized media queries, introduce a dedicated CSS transform step (for example `postcss-custom-media`) and transpile `@media (--bp-*)`.
