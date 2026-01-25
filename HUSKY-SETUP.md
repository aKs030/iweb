# 🐶 Husky Pre-commit Hooks Setup

**Erstellt:** 25. Januar 2026  
**Status:** ✅ AKTIV

---

## 📋 Übersicht

Husky ist jetzt eingerichtet und führt automatische Code-Qualitätschecks vor jedem Commit und Push durch.

### Installierte Hooks

1. **pre-commit** - Läuft vor jedem Commit
2. **pre-push** - Läuft vor jedem Push
3. **commit-msg** - Validiert Commit-Nachrichten

---

## 🎯 Pre-commit Hook

**Datei:** `.husky/pre-commit`

### Was wird geprüft?

- ✅ **ESLint** - Automatisches Fixing von Linting-Fehlern
- ✅ **Prettier** - Automatische Code-Formatierung
- ✅ **Nur staged Files** - Schnell und effizient

### Ablauf

```bash
git add file.js
git commit -m "feat: add new feature"

# Husky führt automatisch aus:
# 1. ESLint --fix auf geänderte .js Dateien
# 2. Prettier --write auf alle geänderten Dateien
# 3. Automatisches git add der formatierten Dateien
```

### Konfiguration

```json
// package.json
"lint-staged": {
  "*.{js,ts}": [
    "eslint --fix",
    "prettier --write"
  ],
  "*.{css,md,json,html}": [
    "prettier --write"
  ]
}
```

---

## 🚀 Pre-push Hook

**Datei:** `.husky/pre-push`

### Was wird geprüft?

- ✅ **Vollständiger Lint-Check** - Alle JavaScript-Dateien
- ✅ **Format-Check** - Alle Dateien
- ✅ **Security Audit** - npm audit

### Ablauf

```bash
git push

# Husky führt automatisch aus:
# 1. npm run check (lint + format)
# 2. npm audit (security check)
# 3. Push wird nur durchgeführt wenn alles OK ist
```

### Warum Pre-push?

- Verhindert fehlerhafte Commits im Remote-Repository
- Stellt sicher, dass CI/CD Pipeline nicht fehlschlägt
- Schützt vor Security-Vulnerabilities

---

## 📝 Commit-msg Hook

**Datei:** `.husky/commit-msg`

### Was wird geprüft?

- ✅ **Conventional Commits Format**
- ✅ **Commit-Message Länge**
- ✅ **Gültige Commit-Typen**

### Format

```
type(scope): subject

Beispiele:
✅ feat(menu): add dark mode toggle
✅ fix(footer): resolve cookie banner positioning
✅ docs: update README with new features
✅ style(css): improve button spacing
✅ refactor(utils): simplify helper functions
✅ perf(three): optimize render loop
✅ test(menu): add unit tests
✅ build(deps): update dependencies
✅ ci: add GitHub Actions workflow
✅ chore: update .gitignore

❌ added new feature (kein Typ)
❌ fix bug (kein Scope, zu kurz)
❌ FEAT: new feature (Großbuchstaben)
```

### Gültige Typen

| Typ        | Beschreibung      | Beispiel                     |
| ---------- | ----------------- | ---------------------------- |
| `feat`     | Neues Feature     | `feat(menu): add search`     |
| `fix`      | Bugfix            | `fix(footer): cookie banner` |
| `docs`     | Dokumentation     | `docs: update README`        |
| `style`    | Code-Formatierung | `style: fix indentation`     |
| `refactor` | Code-Refactoring  | `refactor: simplify logic`   |
| `perf`     | Performance       | `perf: optimize images`      |
| `test`     | Tests             | `test: add unit tests`       |
| `build`    | Build-System      | `build: update webpack`      |
| `ci`       | CI/CD             | `ci: add GitHub Actions`     |
| `chore`    | Maintenance       | `chore: update deps`         |
| `revert`   | Revert Commit     | `revert: undo last commit`   |

---

## 🔧 Verwendung

### Normaler Workflow

```bash
# 1. Änderungen machen
vim content/main.js

# 2. Dateien stagen
git add content/main.js

# 3. Commit (pre-commit hook läuft automatisch)
git commit -m "feat(main): add new loader"

# 4. Push (pre-push hook läuft automatisch)
git push
```

### Hook überspringen (Notfall)

```bash
# Pre-commit überspringen
git commit --no-verify -m "emergency fix"

# Pre-push überspringen
git push --no-verify
```

⚠️ **Nur in Notfällen verwenden!**

---

## 🛠️ Troubleshooting

### Hook läuft nicht

```bash
# Husky neu initialisieren
npm run prepare

# Permissions prüfen
chmod +x .husky/pre-commit
chmod +x .husky/pre-push
chmod +x .husky/commit-msg
```

### Lint-staged Fehler

```bash
# Manuell ausführen
npx lint-staged

# Cache löschen
rm -rf node_modules/.cache
```

### Commit-msg Fehler

```bash
# Commit-Message Format prüfen
cat .git/COMMIT_EDITMSG

# Richtig formatieren
git commit --amend -m "feat(scope): correct message"
```

---

## 📊 Performance

### Pre-commit (schnell)

- **Nur staged Files** werden geprüft
- **Durchschnitt:** 1-3 Sekunden
- **Optimiert** mit lint-staged

### Pre-push (gründlich)

- **Alle Files** werden geprüft
- **Durchschnitt:** 5-10 Sekunden
- **Verhindert** fehlerhafte Pushes

---

## 🎨 Anpassungen

### Pre-commit anpassen

```bash
# .husky/pre-commit bearbeiten
vim .husky/pre-commit

# Beispiel: Tests hinzufügen
echo "npm run test" >> .husky/pre-commit
```

### Lint-staged anpassen

```json
// package.json
"lint-staged": {
  "*.{js,ts}": [
    "eslint --fix",
    "prettier --write",
    "git add"  // Optional: automatisches add
  ],
  "*.css": [
    "stylelint --fix",  // Optional: CSS Linting
    "prettier --write"
  ]
}
```

### Commit-msg anpassen

```bash
# .husky/commit-msg bearbeiten
vim .husky/commit-msg

# Beispiel: Ticket-Nummer erzwingen
# Format: feat(scope): subject [TICKET-123]
```

---

## 🔄 CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/ci.yml
name: CI

on: [push, pull_request]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run check
      - run: npm audit
```

### Vorteile

- ✅ Hooks laufen lokal (schnell)
- ✅ CI/CD als Backup (sicher)
- ✅ Doppelte Absicherung

---

## 📚 Best Practices

### Do's ✅

- ✅ Kleine, atomare Commits
- ✅ Aussagekräftige Commit-Messages
- ✅ Hooks regelmäßig testen
- ✅ Team-Konventionen einhalten

### Don'ts ❌

- ❌ Hooks nicht überspringen (außer Notfall)
- ❌ Keine riesigen Commits
- ❌ Keine vagen Commit-Messages
- ❌ Keine ungetesteten Änderungen pushen

---

## 🎯 Vorteile

### Für dich

- ✅ **Automatische Code-Qualität** - Kein manuelles Linting/Formatting
- ✅ **Konsistenter Code-Style** - Immer gleiche Formatierung
- ✅ **Frühe Fehler-Erkennung** - Vor dem Push
- ✅ **Zeit-Ersparnis** - Automatisierung

### Für das Team

- ✅ **Einheitliche Standards** - Alle halten sich daran
- ✅ **Bessere Code-Reviews** - Fokus auf Logik, nicht Style
- ✅ **Weniger Merge-Konflikte** - Konsistente Formatierung
- ✅ **Höhere Code-Qualität** - Automatische Checks

---

## 🔍 Monitoring

### Hook-Logs anzeigen

```bash
# Git Hook Output
git commit -v

# Detaillierte Logs
GIT_TRACE=1 git commit -m "test"
```

### Statistiken

```bash
# Anzahl der Commits
git rev-list --count HEAD

# Commits mit Conventional Format
git log --oneline | grep -E "^[a-f0-9]+ (feat|fix|docs)"
```

---

## 🚀 Nächste Schritte

### Empfohlen

1. **Commitizen installieren** - Interaktive Commit-Messages

   ```bash
   npm install -D commitizen cz-conventional-changelog
   ```

2. **Commitlint hinzufügen** - Erweiterte Commit-Validierung

   ```bash
   npm install -D @commitlint/cli @commitlint/config-conventional
   ```

3. **Changelog generieren** - Automatisch aus Commits
   ```bash
   npm install -D standard-version
   ```

### Optional

4. **Pre-commit Tests** - Unit-Tests vor Commit
5. **Branch-Name Validierung** - Feature/fix/hotfix Branches
6. **Ticket-Nummer Validierung** - JIRA/GitHub Issues

---

## 📖 Ressourcen

### Dokumentation

- [Husky Docs](https://typicode.github.io/husky/)
- [lint-staged](https://github.com/okonet/lint-staged)
- [Conventional Commits](https://www.conventionalcommits.org/)

### Tools

- [Commitizen](https://github.com/commitizen/cz-cli)
- [Commitlint](https://commitlint.js.org/)
- [Standard Version](https://github.com/conventional-changelog/standard-version)

---

## ✅ Checkliste

### Setup abgeschlossen

- ✅ Husky installiert
- ✅ Pre-commit Hook konfiguriert
- ✅ Pre-push Hook konfiguriert
- ✅ Commit-msg Hook konfiguriert
- ✅ lint-staged konfiguriert
- ✅ Permissions gesetzt
- ✅ Dokumentation erstellt

### Nächste Schritte

- [ ] Team informieren
- [ ] Workflow testen
- [ ] CI/CD anpassen
- [ ] Commitizen installieren (optional)

---

**Erstellt mit:** Kiro AI  
**Letzte Aktualisierung:** 25. Januar 2026
