# Portfolio Website

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

- [`.github/workflows/main.yml`](.github/workflows/main.yml) - Lint, Security & Preview Deployments
- [`.github/workflows/workflow-lint.yml`](.github/workflows/workflow-lint.yml) - Workflow Validation

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
