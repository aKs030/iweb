# Husky Git Hooks

## Active Hooks

- `pre-commit` → `npx lint-staged`
- `pre-push` → `npm run qa` (full quality gate)

## Skip Hooks

```bash
git commit --no-verify -m "emergency fix"
git push --no-verify
```

## Reinstall

```bash
npm run prepare
```
