# Portfolio Website

[![CI/CD](https://github.com/aKs030/iweb/actions/workflows/main.yml/badge.svg)](https://github.com/aKs030/iweb/actions/workflows/main.yml)
[![CodeQL](https://github.com/aKs030/iweb/actions/workflows/codeql.yml/badge.svg)](https://github.com/aKs030/iweb/actions/workflows/codeql.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22.0.0-brightgreen)](https://nodejs.org/)
[![Lighthouse](https://img.shields.io/badge/lighthouse-95%2B-brightgreen)](https://www.abdulkerimsesli.de)
[![Cloudflare Pages](https://img.shields.io/badge/Cloudflare-Pages-orange)](https://pages.cloudflare.com/)

Modernes Portfolio auf Cloudflare Pages mit Vanilla JavaScript, Three.js und Cloudflare Functions.

## Quick Start

Voraussetzungen:

- Node.js `22+` (siehe `package.json` engines)
- npm

Installation und Start:

```bash
npm ci
npm run dev
```

Lokale URL: [http://localhost:8787](http://localhost:8787)

## Verfügbare Scripts

```bash
npm run dev           # Lokalen Cloudflare-Pages-Server starten
npm run qa            # Empfohlen: kompletter Qualitäts-Run (alles prüfen)
npm run fix           # Auto-fix für ESLint + Stylelint + Prettier
npm run format        # Nur Prettier schreiben
npm run sync:import-map # Import-Map-Artefakte aus package.json synchronisieren
npm run lint:apps-config # Projekt-Apps-Konfiguration prüfen
npm run clean:artifacts # Caches, output, coverage und lokale Artefakte löschen
npm run clean         # lokale Cache/Artifacts löschen
npm run clean:full    # zusätzlich .wrangler / lokale D1-Daten löschen
npm run prepare       # Husky Hooks installieren/aktualisieren
npm run content-rag:update # Jules Content-RAG aktualisieren
npm run content-rag:status # Jules Content-RAG Status prüfen
```

Optionaler Port:

```bash
npm run dev -- --port 8787
```

### Linting-Policy (modern)

- `npm run lint:es`
  - ESLint prüft nur JS/MJS/CJS-Dateien.
  - CSS-Dateien werden absichtlich ignoriert (`*.css` wird in ESLint `ignorePatterns` ausgeschlossen).
  - Mit `--no-warn-ignored` in `package.json` unterdrückt es irrelevante Warnungen.
- `npm run lint:css`
  - Stylelint prüft alle CSS-Dateien (`**/*.css`).
- `npm run lint` (oder `npm run qa`)
  - Vollständiger Qualitäts-Run: ESLint + Stylelint + Prettier + Import-Map + Apps-Config-Check.

`npm run dev` zeigt beim Start automatisch:

- lokale URL (`localhost`)
- Netzwerk-URL (LAN-IP), falls verfügbar

## Hooks

- `pre-commit`: `lint-staged` auf gestagten Dateien
- `pre-push`: `npm run lint` mit optionalem Override bei Fehlern

## CI/CD

GitHub Workflows:

- [`.github/workflows/main.yml`](.github/workflows/main.yml) - Lint, Security & Preview Deployments

Preview-Deployments bleiben auf das Deployment reduziert. Content-RAG-Updates laufen bewusst nur noch manuell fuer die Live-Domain.

Falls du intent-basiertes Vectorize-Filtering fuer den Jules-Content-RAG aktivierst, richte die Metadata-Indexes reproduzierbar mit `npm run setup:content-rag-index -- --url=...` ein. Das Skript legt `sourceType` und `category` an und startet danach ein einmaliges Full-Update, damit bestehende Vektoren neu indexiert werden.

Der Robot-Agent begrenzt Memory-Recall und RAG-Retrieval ueber `ROBOT_CONTEXT_TIMEOUT_MS` standardmaessig auf `3500ms`. Prompt-Memory-Persistenz laeuft getrennt ueber `context.waitUntil(...)`, damit langsame Vectorize-/KV-/Embedding-Aufrufe die Chat-Antwort nicht blockieren.

Fuer manuelle Live-Updates:

```bash
ADMIN_TOKEN=... npm run content-rag:update -- --url=https://www.abdulkerimsesli.de
```

Lokal laden die Admin-/RAG-Skripte `ADMIN_TOKEN` und weitere Variablen automatisch aus `.dev.vars`, `.env.local` oder `.env`, falls sie nicht bereits in der Shell gesetzt sind. Die Import-Map wird über `npm run sync:import-map` aus `package.json` synchronisiert und per `npm run lint` auf Drift geprüft. Media-Referenzen und AI-Index bleiben bewusst manuell gepflegt.

Dependency-Automation ist bewusst getrennt: Renovate verwaltet npm-Paketupdates, Dependabot nur GitHub Actions. So entstehen keine doppelten Update-PRs.

## Projektstruktur

```text
content/      Frontend-Code (Komponenten, Core, Styles, Media)
pages/        Seiten-spezifische Entry-Points
functions/    Cloudflare Pages Functions + API-Endpunkte
docs/         Technische Dokumentation
scripts/      Repo-Wartung und Prüfskripte
config/       Konfigurationsdateien (ESLint, Prettier, Stylelint)
.github/      CI/CD Workflows
```

Details: [`docs/DOCUMENTATION.md`](docs/DOCUMENTATION.md)

Root-Entry-Points fuer Editor und CLI:

- `prettier.config.mjs`
- `eslint.config.mjs`
- `.stylelintrc.cjs`

Admin-Dashboard:

- `pages/admin.html` enthaelt die Struktur
- `pages/admin/admin-app.js` enthaelt die Client-Logik

## Dokumentation

- [`docs/DOCUMENTATION.md`](docs/DOCUMENTATION.md) - Vollständige Projekt-Dokumentation
- [`content/styles/README.md`](content/styles/README.md) - CSS-Foundation und Utility-Workflow
- [`CONTRIBUTING.md`](CONTRIBUTING.md) - Beitrag/Workflow
- [`SECURITY.md`](SECURITY.md) - Security Policy

## AI Discovery & SEO

Diese Website ist optimiert für KI-Systeme, Suchmaschinen und Entwickler-Tools:

- **AI Index**: [`ai-index.json`](ai-index.json) - Strukturierter Gesamtindex
- **LLM Context**: [`llms.txt`](llms.txt) & [`llms-full.txt`](llms-full.txt)
- **Person Data**: [`person.jsonld`](person.jsonld) - Schema.org
- **API Docs**: [`.well-known/openapi.json`](.well-known/openapi.json)
- **Sitemaps**: Dynamisch generiert via Cloudflare Functions
  - [sitemap.xml](https://www.abdulkerimsesli.de/sitemap.xml)
  - [sitemap-index.xml](https://www.abdulkerimsesli.de/sitemap-index.xml)
- **AI Hub**: [AI profile hub](https://www.abdulkerimsesli.de/ai-info/)

## License

MIT. Siehe [`LICENSE`](LICENSE).
