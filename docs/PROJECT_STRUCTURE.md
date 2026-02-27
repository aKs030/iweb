# Project Structure (Modern)

Ziel: klare Trennung zwischen Source, Generated Assets und Tooling, damit Änderungen konsistent und wartbar bleiben.

## Top-Level Layout

```text
content/    Frontend Source (components, core, styles, templates, assets)
pages/      Seiten-Module und page-spezifische Styles/Logik
functions/  Cloudflare Pages Functions und API-Endpunkte
scripts/    Build-, Audit- und Wartungsskripte
docs/       Architektur- und Prozessdokumentation
styleguide/ Visuelle Token-/Utility-Demo
```

## Frontend Schichten

```text
content/core/         Framework-nahe Utilities, Event-System, Infrastruktur
content/components/   Wiederverwendbare UI-Komponenten
content/styles/       Globale Styles, Tokens und Utilities
pages/*/              Seiten-Entry und seitengebundene Komponenten
```

Regel:

- `content/core` kennt keine Seiten-Details.
- `content/components` bleibt generisch und token-basiert.
- `pages/*` darf komponieren, aber keine globalen Core-Regeln brechen.

## Token- und CSS-Pipeline

Source of truth:

- `content/styles/tokens/tokens.json`
- `content/styles/tokens/tokens-dark.json`

Generated:

- `content/styles/tokens.css`
- `content/styles/utilities.generated.css`

Wichtige Scripts:

- `npm run styles:generate`
- `npm run qa`

## Struktur-Sicherungen

- `npm run qa` enthält den kompletten Quality Gate Lauf inkl. Strukturprüfung.
- Husky + CI laufen weiterhin vor Push/Deploy.

## Repo-Hygiene

- Temporäre Tool-Artefakte (z. B. `.playwright-cli/`) sind ignoriert.
- Doku bleibt in `docs/` zentral versioniert.
