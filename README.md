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
npm run dev           # Einziger moderner Dev-Workflow (preflight + token watch + app)
npm run lint          # ESLint check
npm run lint:fix      # ESLint mit auto-fix
npm run format        # Prettier check
npm run format:write  # Prettier mit write
npm run css:lint      # Stylelint für content/ + pages/
npm run css:audit     # Utility-Audit + Purge-Check
npm run css:minify    # Minify-Ausgabe nach content/styles/minified/
npm run tokens:generate:all  # tokens.css + tokens-dark.css erzeugen
npm run utilities:generate   # utilities.generated.css erzeugen
npm run structure:check      # Repo-Strukturprüfung
npm run check         # lint + format + css + ai-index + structure
npm run fix           # lint:fix + format:write
npm run clean         # lokale Cache/Artifacts löschen
npm run prepare       # Husky Hooks installieren/aktualisieren
npm run docs:check    # Markdown-Links & absolute lokale Pfade prüfen
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
- `pre-push`: `npm run check`

Details: [`.husky/README.md`](.husky/README.md)

## CI/CD

GitHub Workflows:

- [`.github/workflows/main.yml`](.github/workflows/main.yml) - Lint, Security & Preview Deployments

## Projektstruktur

```text
content/      Frontend-Code (Komponenten, Core, Styles, Assets)
pages/        Seiten-spezifische Entry-Points
functions/    Cloudflare Pages Functions + API-Endpunkte
docs/         Technische Dokumentation
scripts/      Repo-Wartung und Prüfskripte
.github/      CI/CD Workflows
```

Details und Regeln: [`docs/PROJECT_STRUCTURE.md`](docs/PROJECT_STRUCTURE.md)

## Dokumentation

- [`docs/README.md`](docs/README.md) - Dokumentationsindex
- [`docs/PROJECT_STRUCTURE.md`](docs/PROJECT_STRUCTURE.md) - Moderne Zielstruktur
- [`docs/CODE_QUALITY.md`](docs/CODE_QUALITY.md) - Qualitäts- und Hook-Workflow
- [`content/styles/README.md`](content/styles/README.md) - Token/Utility/CSS-Workflow
- [`CONTRIBUTING.md`](CONTRIBUTING.md) - Beitrag/Workflow
- [`SECURITY.md`](SECURITY.md) - Security Policy

## License

MIT. Siehe [`LICENSE`](LICENSE).
