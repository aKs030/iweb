# Husky Git Hooks

## Hooks

| Hook | Was passiert |
|------|-------------|
| `pre-commit` | `lint-staged` → ESLint --fix + Prettier --write (nur staged files) |
| `pre-push` | `npm run check` + `npm audit` |

## Commit-Typen

`feat` `fix` `docs` `style` `refactor` `perf` `test` `build` `ci` `chore`

```bash
git commit -m "feat(menu): add search"
git commit --no-verify -m "emergency fix"   # Hook überspringen
```

## Troubleshooting

```bash
npm run prepare        # Hooks neu installieren
chmod +x .husky/*      # Ausführbar machen
```
