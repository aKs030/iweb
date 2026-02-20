# Portfolio Website

Modernes Portfolio auf Cloudflare Pages mit Vanilla JavaScript, Three.js und Cloudflare Functions.

## Quick Start

Voraussetzungen:

- Node.js `22.22.0`
- npm

Installation und Start:

```bash
npm install
npm run dev
```

Lokale URL: [http://localhost:8080](http://localhost:8080)

## Verfügbare Scripts

```bash
npm run dev           # Cloudflare Pages dev server (Port 8080)
npm run dev:sim       # Lokaler Node-Server (Smoke-Test/Simulation)
npm run lint          # ESLint mit auto-fix
npm run lint:check    # ESLint ohne fix
npm run format        # Prettier mit write
npm run format:check  # Prettier check
npm run check         # lint:check + format:check
npm run fix           # lint + format
npm run clean         # lokale Cache/Artifacts löschen
npm run prepare       # Husky Hooks installieren/aktualisieren
```

## Hooks

- `pre-commit`: `lint-staged` auf gestagten Dateien
- `pre-push`: `npm run check`

Details: `/Users/abdo/iweb/.husky/README.md`

## CI/CD

GitHub Workflows:

- `/Users/abdo/iweb/.github/workflows/ci.yml` - Lint/Format, Smoke-Test, Dependency Review
- `/Users/abdo/iweb/.github/workflows/preview.yml` - Cloudflare Preview Deployments für PRs
- `/Users/abdo/iweb/.github/workflows/codeql.yml` - CodeQL Analyse

## Projektstruktur

```text
content/     Frontend-Code (Komponenten, Core, Styles)
pages/       Seiteninhalte
functions/   Cloudflare Pages Functions
docs/        Projektdokumentation
```

## Dokumentation

- `/Users/abdo/iweb/docs/README.md` - Dokumentationsindex
- `/Users/abdo/iweb/docs/CODE_QUALITY.md` - Qualitäts- und Hook-Workflow
- `/Users/abdo/iweb/CONTRIBUTING.md` - Beitrag/Workflow
- `/Users/abdo/iweb/SECURITY.md` - Security Policy

## License

MIT. Siehe `/Users/abdo/iweb/LICENSE`.
