# Styles Foundation Workflow

## Source of truth

- `content/styles/foundation.css`
- `content/styles/utilities.css`

## File responsibilities

- `foundation.css`: globale CSS-Variablen, Theme-Overrides, Safe-Area/Layout-Grundlagen und Runtime-Defaults.
- `utilities.css`: kleine handgepflegte Utility-Sammlung fuer wiederkehrende Layout-Helfer.
- `main.css`: globale Komponenten-, Utility- und Basis-Styles fuer die App-Shell.
- `overlays.css`: globale Overlay-Regeln in der `components`-Layer.

## Workflow

- `npm run dev` -> starts the local Cloudflare Pages development server
- `npm run sync` -> refreshes generated frontend artifacts when dependencies or templates change
- Global CSS now uses native cascade layers (`foundation`, `base`, `utilities`, `components`, `animations`) instead of generation or selector-order coupling.

## Theme switching

- Theme attribute is set on `<html>` via `data-theme` (`dark` or `light`).
- `foundation.css` contains base + light + dark overrides (`:root[data-theme='light']`, `:root[data-theme='dark']`).
- Menu toggle only updates `data-theme`; no stylesheet enable/disable needed.

## Utilities

- Keep utilities intentionally small and only for repeated layout patterns.
- Prefer semantic component classes first; add utility classes only when reuse is obvious.

## Team rule

- Avoid hardcoded colors, spacing, radii, shadows and z-index values in components.
- Use `var(--...)` from `foundation.css` for consistent theming and spacing.

## Breakpoints

- Keep numeric `@media` queries in CSS for now; native CSS variables are not supported inside media queries.
- If shared breakpoint semantics become complex, prefer documenting them in CSS comments or JS constants instead of adding a generation layer again.
