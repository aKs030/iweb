# Code Quality

Aktuelle Quality-Checks im Projekt (Stand: Februar 2026).

## Lokale Commands

```bash
npm run lint          # ESLint check
npm run lint:fix      # ESLint mit auto-fix
npm run format        # Prettier check
npm run format:write  # Prettier write
npm run check         # lint + format + ai-index:check
npm run fix           # lint:fix + format:write
npm run docs:check    # Markdown-Links + lokale absolute Pfade prüfen
```

## Husky Hooks

Hooks liegen in [`.husky/`](../.husky/).

- `pre-commit`: `npm exec lint-staged` (nur staged Dateien)
- `pre-push`: `npm run check` (read-only)

Details: [`.husky/README.md`](../.husky/README.md)

## CI-Checks

Datei: [`.github/workflows/main.yml`](../.github/workflows/main.yml)

Jobs:

- `lint`: ESLint + Prettier Check (`npm run check`)
- `security`: CodeQL Analyse
- `preview`: Cloudflare Pages Preview (nur bei PRs)

## Workflow-Empfehlung

Vor PR:

1. `npm run fix`
2. `npm run check`

Beim Push:

1. `pre-push` läuft automatisch
2. CI muss grün sein
