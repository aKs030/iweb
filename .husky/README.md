# Husky Git Hooks

## Active Hooks

- `pre-commit` → lint-staged (ESLint + Prettier on staged files)
- `pre-push` → npm run check (ESLint + Prettier validation)

## Skip Hooks

```bash
git commit --no-verify -m "emergency fix"
git push --no-verify
```

## Reinstall

```bash
npm run prepare
```
