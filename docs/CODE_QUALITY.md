# Code Quality

Aktuelle Quality-Checks im Projekt (Stand: Februar 2026).

## Lokale Commands

```bash
npm run lint          # ESLint mit auto-fix
npm run lint:check    # ESLint ohne fix
npm run format        # Prettier write
npm run format:check  # Prettier check
npm run check         # lint:check + format:check
npm run fix           # lint + format
```

## Husky Hooks

Hooks liegen in `/Users/abdo/iweb/.husky/`.

- `pre-commit`: `npm exec lint-staged` (nur staged Dateien)
- `pre-push`: `npm run check` (read-only)

Details: `/Users/abdo/iweb/.husky/README.md`

## CI-Checks

Datei: `/Users/abdo/iweb/.github/workflows/ci.yml`

Jobs:

- `verify`: ESLint + Prettier Check

## Workflow-Empfehlung

Vor PR:

1. `npm run fix`
2. `npm run check`

Beim Push:

1. `pre-push` läuft automatisch
2. CI muss grün sein
