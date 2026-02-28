# Code Quality

Aktuelle Quality-Checks im Projekt (Stand: Februar 2026).

## Lokale Commands

```bash
npm run qa          # Vollständiger Quality Gate Run
npm run qa:fix      # Auto-Fixes (ESLint + Stylelint + Prettier)
npm run qa:all      # Fix + vollständiger Check in einem Lauf
npm run styles:generate # Tokens + Utilities erzeugen
npm run docs:check    # Markdown-Links + lokale absolute Pfade prüfen
```

## Husky Hooks

Hooks liegen in [`.husky/`](../.husky/).

- `pre-commit`: `npx lint-staged`
- `pre-push`: `npm run qa` (read-only)

## CI-Checks

Datei: [`.github/workflows/main.yml`](../.github/workflows/main.yml)

Jobs:

- `lint`: Voller Qualitätslauf (`npm run qa`)
- `security`: CodeQL Analyse
- `preview`: Cloudflare Pages Preview + Qualitätslauf (nur bei PRs)

## Workflow-Empfehlung

Vor PR:

1. `npm run qa:fix`
2. `npm run qa`

Beim Push:

1. `pre-push` läuft automatisch
2. CI muss grün sein
