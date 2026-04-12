# Portfolio Website

[![CI/CD](https://github.com/aKs030/iweb/actions/workflows/main.yml/badge.svg)](https://github.com/aKs030/iweb/actions/workflows/main.yml)
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
npm run build         # Functions-Bundle lokal bauen
npm run sync          # Generierte Import-Map und Footer-Dateien aktualisieren
npm run clean         # Lokale Artefakte/Caches löschen
npm run clean:full    # zusätzlich .wrangler / lokale D1-Daten löschen
```

Optionaler Port:

```bash
npm run dev -- --port 8787
```

`npm run dev` zeigt beim Start automatisch die lokale URL, eine Netzwerk-URL falls verfügbar und führt lokale D1-Migrationen vor dem Start aus.

Der Repo-Workflow ist bewusst schlank gehalten: lokale Entwicklung, gezielte Generator-Synchronisierung und ein kleines Set an operativen Kommandos.

## CI/CD

GitHub Workflows:

- [`.github/workflows/main.yml`](.github/workflows/main.yml) - schlankes Preview-Deployment für Pull Requests

Preview-Deployments bleiben auf das Deployment reduziert. Der Robot-Agent begrenzt Memory-Recall über `ROBOT_CONTEXT_TIMEOUT_MS` standardmäßig auf `3500ms`, und Prompt-Memory-Persistenz läuft getrennt über `context.waitUntil(...)`, damit langsame Hintergrundschritte die Chat-Antwort nicht blockieren.

## Projektstruktur

```text
content/      Frontend-Code (Komponenten, Core, Styles, Media)
pages/        Seiten-spezifische Entry-Points
functions/    Cloudflare Pages Functions + API-Endpunkte
scripts/      Schlanke Dev- und Content-Utilities
.github/      CI/CD Workflows
```

## Root-Dateien

- `index.html`, `offline.html`, `sw.js` - zentrale Entry-Points
- `package.json`, `wrangler.jsonc`, `.env.example` - Projekt- und Laufzeitkonfiguration
- `_headers`, `_redirects` - Cloudflare Header- und Routing-Regeln
- `ai-index.json`, `llms.txt`, `llms-full.txt`, `person.jsonld`, `bio.md` - AI-Discovery und SEO

## Architektur

Frontend-Layer:

- `content/core` - generische Utilities und Runtime-Bausteine
- `content/components` - wiederverwendbare UI-Komponenten
- `content/styles` - globale Styles, Foundation und Utilities
- `pages/*` - Seiten-Entry-Points und Seitenspezifika

Cloudflare Functions:

- `functions/api` - API-Endpunkte
- `functions/sitemap*.js` - Sitemap-Generierung
- `functions/_shared` - gemeinsame Laufzeit-Helfer

## Deployment

- Pull Request -> Preview-Deploy über GitHub Actions
- `wrangler.jsonc` enthält das gemeinsame Setup für lokale Entwicklung und Preview
- Secrets gehören nicht ins Repo; lokal werden nur `.dev.vars`, `.env.local` oder `.env` verwendet

## Dokumentation

- [`functions/api/README.md`](functions/api/README.md) - API- und Functions-Überblick
- [`content/styles/README.md`](content/styles/README.md) - CSS-Foundation und Utility-Workflow
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
