# Portfolio Website

Modernes Portfolio auf Cloudflare Pages mit Vanilla JavaScript, Three.js und Cloudflare Functions.

## Quick Start

Voraussetzungen:

- Node.js `22.22.0` (siehe `.node-version`)
- npm

Installation und Start:

```bash
npm ci
npm run dev
```

Lokale URL: [http://localhost:8080](http://localhost:8080)

## Verfügbare Scripts

```bash
npm run dev           # Cloudflare Pages dev server (Port 8080)
npm run dev:sim       # Lokaler Node-Server (Simulation)
npm run lint          # ESLint mit auto-fix
npm run lint:check    # ESLint ohne fix
npm run format        # Prettier mit write
npm run format:check  # Prettier check
npm run check         # lint:check + format:check
npm run fix           # lint + format
npm run clean         # lokale Cache/Artifacts löschen
npm run prepare       # Husky Hooks installieren/aktualisieren
npm run docs:check    # Markdown-Links & absolute lokale Pfade prüfen
```

## Hooks

- `pre-commit`: `lint-staged` auf gestagten Dateien
- `pre-push`: `npm run check`

Details: [`.husky/README.md`](.husky/README.md)

## CI/CD

GitHub Workflows:

- [`.github/workflows/ci.yml`](.github/workflows/ci.yml) - Lint/Format
- [`.github/workflows/preview.yml`](.github/workflows/preview.yml) - Cloudflare Preview Deployments für PRs
- [`.github/workflows/codeql.yml`](.github/workflows/codeql.yml) - CodeQL Analyse

## Projektstruktur

```text
content/      Frontend-Code (Komponenten, Core, Styles, Assets)
pages/        Seiten-spezifische Entry-Points
functions/    Cloudflare Pages Functions + API-Endpunkte
docs/         Technische Dokumentation
scripts/      Repo-Wartung und Prüfskripte
.github/      CI/CD Workflows
```

## Dokumentation

- [`docs/README.md`](docs/README.md) - Dokumentationsindex
- [`docs/CODE_QUALITY.md`](docs/CODE_QUALITY.md) - Qualitäts- und Hook-Workflow
- [`CONTRIBUTING.md`](CONTRIBUTING.md) - Beitrag/Workflow
- [`SECURITY.md`](SECURITY.md) - Security Policy

## License

MIT. Siehe [`LICENSE`](LICENSE).
