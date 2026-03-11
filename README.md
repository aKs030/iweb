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

Lokale URL: [http://localhost:8080](http://localhost:8080)

## Verfügbare Scripts

```bash
npm run dev           # Einziger moderner Dev-Workflow (preflight + token watch + app)
npm run qa            # Empfohlen: kompletter Qualitäts-Run (alles prüfen)
npm run qa:fix        # Empfohlen: auto-fix für ESLint + Stylelint + Prettier
npm run qa:all        # Fix + kompletter Check in einem Lauf
npm run styles:generate # Tokens + Utilities in einem Run erzeugen
npm run clean         # lokale Cache/Artifacts löschen
npm run prepare       # Husky Hooks installieren/aktualisieren
npm run docs:check    # Markdown-Links & absolute lokale Pfade prüfen
npm run ai-index:sync # AI-Index manuell synchronisieren
npm run cf:redirect:audit # Redirects analysieren
npm run cf:redirect:prune # Redirects bereinigen
```

Optionaler Port:

```bash
npm run dev -- --port 8787
```

`npm run dev` zeigt beim Start automatisch:

- lokale URL (`localhost`)
- Netzwerk-URL (LAN-IP), falls verfügbar

## Hooks

- `pre-commit`: `lint-staged` auf gestagten Dateien
- `pre-push`: `npm run qa`

## CI/CD

GitHub Workflows:

- [`.github/workflows/main.yml`](.github/workflows/main.yml) - Lint, Security & Preview Deployments

Preview-Deployments synchronisieren den Jules-Content-RAG nach dem Cloudflare-Deploy automatisch, wenn die GitHub-Secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` und `ADMIN_TOKEN` gesetzt sind.
Danach laeuft auf Preview und Production auch ein kleines Retrieval-Evaluations-Set gegen `/api/admin/content-rag?query=...`, damit Quellenlinks und Source-Typen nicht still regressieren.

Pushes auf `main`/`master` triggern zusaetzlich einen Production-RAG-Sync. Der Workflow wartet dabei auf der Live-Domain, bis das ausgerollte Cloudflare-Pages-Commit der aktuellen GitHub-SHA entspricht. Optional kann die Ziel-Domain ueber die GitHub-Variable `PRODUCTION_SITE_URL` ueberschrieben werden.

Falls du intent-basiertes Vectorize-Filtering fuer den Jules-Content-RAG aktivierst, richte die Metadata-Indexes reproduzierbar mit `npm run setup:content-rag-index -- --url=...` ein. Das Skript legt `sourceType` und `category` an und startet danach einen einmaligen Full-Resync, damit bestehende Vektoren neu indexiert werden.

Der Robot-Agent begrenzt Memory-Recall und RAG-Retrieval ueber `ROBOT_CONTEXT_TIMEOUT_MS` standardmaessig auf `3500ms`. Prompt-Memory-Persistenz laeuft getrennt ueber `context.waitUntil(...)`, damit langsame Vectorize-/KV-/Embedding-Aufrufe die Chat-Antwort nicht blockieren.

Fuer manuelle Retrieval-Checks:

```bash
ADMIN_TOKEN=... npm run eval:content-rag -- --url=https://www.abdulkerimsesli.de
```

Dependency-Automation ist bewusst getrennt: Renovate verwaltet npm-Paketupdates, Dependabot nur GitHub Actions. So entstehen keine doppelten Update-PRs.

## Projektstruktur

```text
content/      Frontend-Code (Komponenten, Core, Styles, Assets)
pages/        Seiten-spezifische Entry-Points
functions/    Cloudflare Pages Functions + API-Endpunkte
docs/         Technische Dokumentation
scripts/      Repo-Wartung und Prüfskripte
config/       Konfigurationsdateien (ESLint, Prettier, Stylelint)
.github/      CI/CD Workflows
```

Details: [`docs/DOCUMENTATION.md`](docs/DOCUMENTATION.md)

## Dokumentation

- [`docs/DOCUMENTATION.md`](docs/DOCUMENTATION.md) - Vollständige Projekt-Dokumentation
- [`content/styles/README.md`](content/styles/README.md) - CSS/Token/Utility-Workflow
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
