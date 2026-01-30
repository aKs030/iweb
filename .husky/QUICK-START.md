# 🚀 Husky Quick Start

## ✅ Was ist eingerichtet?

Husky führt automatisch Code-Qualitätschecks durch:

### Vor jedem Commit (pre-commit)

- ✅ ESLint --fix (automatische Fehlerkorrektur)
- ✅ Prettier --write (automatische Formatierung)
- ⚡ Nur auf geänderte Dateien

### Vor jedem Push (pre-push)

- ✅ Vollständiger Lint-Check
- ✅ Format-Check
- ✅ Security Audit

### Bei Commit-Messages (commit-msg)

- ✅ Conventional Commits Format
- ✅ Beispiel: `feat(menu): add search`

---

## 📝 Commit-Message Format

```bash
type(scope): subject

# Gültige Typen:
feat     # Neues Feature
fix      # Bugfix
docs     # Dokumentation
style    # Formatierung
refactor # Code-Refactoring
perf     # Performance
test     # Tests
build    # Build-System
ci       # CI/CD
chore    # Maintenance
```

### Beispiele

```bash
✅ feat(menu): add dark mode toggle
✅ fix(footer): resolve cookie banner positioning
✅ docs: update README with new features
✅ style(css): improve button spacing
✅ refactor(utils): simplify helper functions
✅ perf(three): optimize render loop
✅ test(menu): add unit tests
✅ chore(deps): update dependencies

❌ added new feature
❌ fix bug
❌ FEAT: new feature
```

---

## 🎯 Workflow

```bash
# 1. Änderungen machen
vim content/main.js

# 2. Dateien stagen
git add content/main.js

# 3. Commit (Hooks laufen automatisch)
git commit -m "feat(main): add new loader"
# → ESLint + Prettier laufen automatisch
# → Commit-Message wird validiert

# 4. Push (Hooks laufen automatisch)
git push
# → Vollständiger Check + Security Audit
```

---

## 🆘 Notfall: Hook überspringen

```bash
# Nur in Notfällen!
git commit --no-verify -m "emergency fix"
git push --no-verify
```

---

## 🔧 Troubleshooting

### Hook läuft nicht?

```bash
npm run prepare
chmod +x .husky/*
```

### Commit-Message Fehler?

```bash
# Richtig formatieren:
git commit --amend -m "feat(scope): correct message"
```

---

## 📚 Weitere Informationen

Für detaillierte Informationen zu Husky und Git Hooks, siehe:

- [Husky Documentation](https://typicode.github.io/husky/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [lint-staged](https://github.com/okonet/lint-staged)
