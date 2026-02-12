# Code Quality Tools - Setup & Installation

Anleitung zur Installation und Nutzung der Code-Quality-Tools.

## 🚀 Quick Setup

Die meisten Tools sind bereits via `package.json` konfiguriert.

```bash
# 1. Dependencies installieren
npm install

# 2. Ersten Check durchführen
npm run quality
```

## 📦 Installierte Tools

### 1. Knip (devDependency)

**Zweck:** Findet ungenutzten Code, Dependencies und Exports

**Konfiguration:** `knip.json`

### 2. JSCPD (devDependency)

**Zweck:** Findet duplizierte Code-Blöcke

**Konfiguration:** via CLI Arguments in `package.json`

### 3. Madge (devDependency)

**Zweck:** Findet zirkuläre Dependencies und visualisiert Dependency-Graph

**Dependencies:** Benötigt Graphviz für SVG-Export (Optional)

```bash
# macOS
brew install graphviz

# Ubuntu/Debian
sudo apt-get install graphviz
```

## 📋 Verfügbare npm Scripts

### Quality Checks

```bash
npm run knip                  # Unused code detection
npm run knip:production       # Production dependencies only
npm run check:duplicates      # Duplicate code detection (JSCPD)
npm run check:circular        # Circular dependencies (Madge)
npm run check:console         # Console.log detection
npm run quality               # Knip + Duplicates + Circular
npm run audit:full            # Security + Quality + Console
```

### Dependency Analysis

```bash
npm run deps:graph            # Create dependency graph (Madge)
npm run deps:check            # Check for outdated packages
```

### Development & Linting

```bash
npm run lint                  # ESLint with auto-fix
npm run lint:check            # ESLint without fix
npm run format                # Prettier with auto-fix
npm run format:check          # Prettier without fix
npm run check                 # Lint + Format check
npm run fix                   # Lint + Format fix
```

## 🎯 CI/CD Integration

### GitHub Actions

**Workflows:**

1. `.github/workflows/ci.yml` - Main CI Pipeline

**Jobs in ci.yml:**

- `lint` - ESLint + Prettier
- `build` - Vite Build
- `security` - npm audit
- `code-quality` - Knip + JSCPD + Console

**Artifacts:**

- Build output (`dist/`)
- Dependency graph (SVG)

## 📊 Output & Reports

### Knip

```bash
npm run knip
# Output: Console + JSON
```

### JSCPD

```bash
npm run check:duplicates
# Output: Console
```

### Madge

```bash
npm run check:circular
# Output: Console

npm run deps:graph
# Output: dependency-graph.svg
```

### Console.log

```bash
npm run check:console
# Output: Console (Exit code 1 wenn gefunden)
```

## 🔍 Erste Schritte

### 1. Baseline erstellen

```bash
# Alle Checks durchführen
npm run quality
```

### 2. Issues beheben

```bash
# Knip: Unused dependencies entfernen
npm uninstall <package>

# JSCPD: Duplicates refactoren
# Madge: Circular dependencies auflösen
# Console: console.log entfernen
```

### 3. In Workflow integrieren

```bash
# Pre-commit
npm run check:console

# Pre-PR
npm run quality
```

## 🎓 Best Practices

### Entwicklung

- `npm run check:console` vor jedem Commit
- `npm run quality` vor jedem PR

### Code Review

- Knip-Report prüfen
- Circular Dependencies vermeiden

### Maintenance

- Dependencies regelmäßig aktualisieren
- Unused code entfernen
- Duplicates refactoren

## 🐛 Troubleshooting

### Knip findet zu viele false positives

```json
// knip.json - Entry-points erweitern
{
  "entry": ["index.html", "pages/**/app.js", "functions/**/*.js"]
}
```

### Madge: "Graphviz not found"

```bash
# Graphviz installieren
brew install graphviz  # macOS
sudo apt-get install graphviz  # Linux
```

### JSCPD zu sensitiv

```bash
# Threshold erhöhen (via package.json script edit)
jscpd --min-lines 20 --min-tokens 100
```

## 📚 Dokumentation

- **[CODE_QUALITY.md](CODE_QUALITY.md)** - Detaillierte Tool-Dokumentation
- **[QUALITY_TOOLS_CHEATSHEET.md](QUALITY_TOOLS_CHEATSHEET.md)** - Quick Reference
- **[DEVELOPMENT.md](../DEVELOPMENT.md)** - Development Guide
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - System Architecture

## 🔗 Externe Links

- [Knip Documentation](https://github.com/webpro/knip)
- [JSCPD Documentation](https://github.com/kucherenko/jscpd)
- [Madge Documentation](https://github.com/pahen/madge)

## ✅ Checkliste

- [ ] npm dependencies installiert
- [ ] Graphviz installiert (optional für Madge Graph)
- [ ] Ersten Quality-Check durchgeführt
- [ ] Dokumentation gelesen

---

**Quick Start:** `npm run quality`  
**Cheatsheet:** `docs/QUALITY_TOOLS_CHEATSHEET.md`
