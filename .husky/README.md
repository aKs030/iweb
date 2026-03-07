# Husky Git Hooks

Automatisierte Qualitätssicherung für das Projekt.

## 🎯 Verfügbare Hooks

### pre-commit

Führt lint-staged auf geänderten Dateien aus (ESLint, Stylelint, Prettier).

```bash
# Manuell testen
npx lint-staged
```

### commit-msg

Validiert Conventional Commits Format: `<type>(scope?): <description>`

**Types:** feat, fix, docs, style, refactor, perf, test, build, ci, chore

```bash
# Beispiele
git commit -m "feat: add search"
git commit -m "fix(auth): resolve timeout"
```

### pre-push

1. Löscht Caches
2. Führt Auto-Fixes aus
3. Führt QA-Checks aus
4. Fragt bei Fehlern nach

```bash
# Manuell testen
npm run qa
```

### post-merge

Aktualisiert Dependencies und löscht Caches nach Merge.

### post-checkout

Aktualisiert Dependencies und löscht Caches nach Branch-Wechsel.

## 🚀 Wichtige Commands

```bash
# Auto-Fix
npm run fix

# Linting
npm run lint

# Alle Checks
npm run check

# QA (fix + lint + check)
npm run qa

# Caches löschen
npm run clean

# Tests
npm test
```

## 🔧 Hook überspringen

```bash
# Commit ohne Hooks
git commit --no-verify -m "message"

# Push ohne Hooks
git push --no-verify
```

## 📊 Übersicht

| Hook          | Trigger       | Auto-Fix | Blockiert   | Dauer   |
| ------------- | ------------- | -------- | ----------- | ------- |
| pre-commit    | Commit        | ✅       | ✅          | ~2-5s   |
| commit-msg    | Commit        | ❌       | ✅          | <1s     |
| pre-push      | Push          | ✅       | ⚠️ Optional | ~10-30s |
| post-merge    | Merge         | ✅       | ❌          | ~5-60s  |
| post-checkout | Branch Switch | ✅       | ❌          | ~5-60s  |

## � Troubleshooting

```bash
# Husky neu installieren
npm run prepare

# Permissions setzen
chmod +x .husky/*

# Dependencies aktualisieren
npm ci
```
