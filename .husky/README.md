# Husky Git Hooks

## Active Hooks

- `pre-commit` → lint-staged + `css:lint` + `css:audit` + `structure:check`
- `pre-push` → `npm run check` (includes lint/format/css/structure checks)

## Skip Hooks

```bash
git commit --no-verify -m "emergency fix"
git push --no-verify
```

## Reinstall

```bash
npm run prepare
```
