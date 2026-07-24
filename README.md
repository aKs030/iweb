# Portfolio Website

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22.0.0-brightgreen)](https://nodejs.org/)
[![Cloudflare Pages](https://img.shields.io/badge/Cloudflare-Pages-orange)](https://pages.cloudflare.com/)

Modernes No-Build-Portfolio auf Cloudflare Pages mit JavaScript, React, Web Components, Three.js
und Cloudflare Functions.

## Quick Start

Voraussetzungen:

- Node.js `22+` (siehe `package.json` engines)
- npm

Start:

```bash
npm run dev
```

Lokale URL: [http://localhost:8787](http://localhost:8787)

`npm run dev` startet Cloudflare Pages lokal auf [http://localhost:8787](http://localhost:8787).

Weitere Projektbefehle:

```bash
npm run lint                 # JS-Checks ohne Dateiaenderungen
npm run lint:fix             # JS-Fixes anwenden
npm run check:format         # Formatierung pruefen
npm run format               # Formatierung anwenden
npm run check:budgets        # JS- und CSS-Groessenbudgets pruefen
npm run types                # Cloudflare-Binding-Typen aktualisieren
npm run types:check          # Generierte Binding-Typen verifizieren
npm run db:migrate:local     # D1-Migrationen lokal anwenden
```

## Projektstruktur

- `content/` - Frontend-Code (Komponenten, Core, Styles, Media)
- `pages/` - Seiten-spezifische Entry-Points
- `functions/` - Cloudflare Pages Functions + API-Endpunkte
- `migrations/` - versionierte D1-Schema-Migrationen
- `scripts/` - lokale und CI-Qualitaetspruefungen

## Root-Dateien

- `index.html` - zentraler Frontend-Entry-Point
- `sw.js` - kleiner Legacy-Cleanup fuer alte Service-Worker-Registrierungen
- `package.json`, `wrangler.jsonc`, `.env.example` - Projekt- und Laufzeitkonfiguration
- `_headers`, `_redirects` - Cloudflare Header- und Routing-Regeln
- `robots.txt`, `ai-index.json`, `llms.txt`, `person.jsonld`, `bio.md`, `.well-known/*` - AI-Discovery und SEO

## Architektur

- `content/core` - generische Utilities und Runtime-Bausteine
- `content/components` - wiederverwendbare UI-Komponenten
- `content/styles` - globale Styles, Foundation und Utilities
- `pages/*` - Seiten-Entry-Points und Seitenspezifika
- `functions/api` - API-Endpunkte
- `functions/sitemap*.js` - Sitemap-Generierung
- `functions/_shared` - gemeinsame Laufzeit-Helfer

## Deployment

- `wrangler.jsonc` enthält das gemeinsame Setup für lokale Entwicklung und Produktions-Bindings
- Secrets gehören nicht ins Repo; lokal werden nur `.dev.vars`, `.env.local` oder `.env` verwendet
- Vor einem Deployment werden D1-Migrationen mit `npm run db:migrate:remote` angewendet
- Kommentar-Turnstile wird mit `TURNSTILE_SITE_KEY` und dem Secret
  `TURNSTILE_SECRET_KEY` aktiviert

## Dokumentation

- [`CODING_CONVENTIONS.md`](CODING_CONVENTIONS.md) - kurze Projektregeln fuer Feature-Raender, Imports, Styles und Shims
- [`functions/api/README.md`](functions/api/README.md) - API- und Functions-Überblick
- [`content/styles/README.md`](content/styles/README.md) - CSS-Foundation und Utility-Workflow
- [`SECURITY.md`](SECURITY.md) - Security Policy

## AI Discovery & SEO

Diese Website ist optimiert für KI-Systeme, Suchmaschinen und Entwickler-Tools:

- **AI Index**: [`ai-index.json`](ai-index.json) - Strukturierter Gesamtindex
- **LLM Context**: [`llms.txt`](llms.txt)
- **Person Data**: [`person.jsonld`](person.jsonld) - Schema.org
- **API Docs**: [`.well-known/openapi.json`](.well-known/openapi.json)
- **Sitemaps**: Dynamisch generiert via Cloudflare Functions
  - [sitemap.xml](https://www.abdulkerimsesli.de/sitemap.xml)
  - [sitemap-index.xml](https://www.abdulkerimsesli.de/sitemap-index.xml)
- **AI Hub**: [AI profile hub](https://www.abdulkerimsesli.de/ai-info/)

## License

MIT. Siehe [`LICENSE`](LICENSE).
