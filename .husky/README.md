# 🐶 Husky Git Hooks

Automatische Code-Qualitätschecks für dieses Projekt.

## 🎯 Hooks

### pre-commit

Läuft vor jedem Commit:

- ESLint --fix (nur staged files)
- Prettier --write (nur staged files)

### pre-push

Läuft vor jedem Push:

- npm run check (lint + format)
- npm audit (security)

### commit-msg

Validiert Commit-Messages:

- Format: `type(scope): subject`
- Beispiel: `feat(menu): add dark mode`

## 📝 Gültige Commit-Typen

- `feat` - Neues Feature
- `fix` - Bugfix
- `docs` - Dokumentation
- `style` - Formatierung
- `refactor` - Code-Refactoring
- `perf` - Performance
- `test` - Tests
- `build` - Build-System
- `ci` - CI/CD
- `chore` - Maintenance

## 🚀 Verwendung

```bash
# Normal committen
git commit -m "feat(menu): add search"

# Hook überspringen (Notfall)
git commit --no-verify -m "emergency fix"
```

## 📚 Weitere Informationen

Siehe [QUICK-START.md](QUICK-START.md) für eine detaillierte Anleitung.
