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
