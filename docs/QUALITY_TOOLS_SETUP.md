# Code Quality Tools - Setup & Installation

Komplette Anleitung zur Installation und Nutzung aller Code-Quality-Tools.

## 🚀 Quick Setup

```bash
# 1. Setup-Script ausführen
./scripts/setup-quality-tools.sh

# 2. Ersten Check durchführen
npm run quality

# 3. Dokumentation lesen
cat docs/CODE_QUALITY.md
```

## 📦 Installierte Tools

### 1. Knip (bereits installiert)

**Zweck:** Findet ungenutzten Code, Dependencies und Exports

**Installation:**

```bash
# Bereits in package.json als devDependency
npm install
```

**Konfiguration:** `knip.json`

### 2. JSCPD

**Zweck:** Findet duplizierte Code-Blöcke

**Installation:**

```bash
# Global (empfohlen)
npm install -g jscpd

# Oder via npx
npx jscpd --version
```

**Konfiguration:** Optional `.jscpdrc`

### 3. Madge

**Zweck:** Findet zirkuläre Dependencies und visualisiert Dependency-Graph

**Installation:**

```bash
# Global (empfohlen)
npm install -g madge

# Oder via npx
npx madge --version
```

**Dependencies:** Benötigt Graphviz für SVG-Export

```bash
# macOS
brew install graphviz

# Ubuntu/Debian
sudo apt-get install graphviz

# Windows
choco install graphviz
```

### 4. ES6-Plato

**Zweck:** Analysiert Code-Komplexität und Maintainability

**Installation:**

```bash
# Global (empfohlen)
npm install -g es6-plato

# Oder via npx
npx es6-plato --version
```

### 5. Cost of Modules

**Zweck:** Zeigt Bundle-Impact von Dependencies

**Installation:**

```bash
# Global (empfohlen)
npm install -g cost-of-modules

# Oder via npx
npx cost-of-modules
```

## 🔧 Manuelle Installation

Falls das Setup-Script nicht funktioniert:

```bash
# 1. Globale Tools installieren
npm install -g jscpd madge es6-plato cost-of-modules

# 2. Graphviz installieren (für Madge)
brew install graphviz  # macOS

# 3. Verzeichnisse erstellen
mkdir -p reports/{knip,complexity,duplicates,dependencies}

# 4. .gitignore aktualisieren
echo "reports/" >> .gitignore
echo "complexity-report/" >> .gitignore
echo "dependency-graph.svg" >> .gitignore
echo "knip-report.json" >> .gitignore

# 5. Test
npm run quality
```

## 📋 Verfügbare npm Scripts

### Quality Checks

```bash
npm run knip                  # Unused code detection
npm run knip:production       # Production dependencies only
npm run check:duplicates      # Duplicate code detection
npm run check:circular        # Circular dependencies
npm run check:complexity      # Code complexity analysis
npm run check:console         # Console.log detection
npm run quality               # All quality checks
npm run audit:full            # Security + Quality + Console
```

### Dependency Analysis

```bash
npm run deps:graph            # Create dependency graph
npm run deps:cost             # Bundle impact analysis
npm run deps:check            # Check for outdated packages
```

### Development

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
2. `.github/workflows/code-quality-report.yml` - Weekly Quality Report

**Jobs in ci.yml:**

- `lint` - ESLint + Prettier
- `build` - Vite Build + Bundle Analysis
- `security` - npm audit
- `workers-validation` - Cloudflare Workers
- `type-check` - TypeScript
- `code-quality` - Knip + JSCPD + Complexity + Console
- `dependency-analysis` - Madge + Cost-of-Modules

**Artifacts:**

- Build output (`dist/`)
- Knip report (JSON)
- Dependency graph (SVG)
- Complexity report (HTML)

### Weekly Report

Automatischer Quality-Report jeden Montag um 9:00 UTC:

- Knip Analysis
- Duplicate Code
- Complexity Metrics
- Circular Dependencies
- Bundle Size
- Security Audit

Report wird als GitHub Issue erstellt.

## 📊 Output & Reports

### Knip

```bash
npm run knip
# Output: Console + knip-report.json
```

### JSCPD

```bash
npm run check:duplicates
# Output: Console + jscpd-report/ (optional)
```

### Madge

```bash
npm run check:circular
# Output: Console

npm run deps:graph
# Output: dependency-graph.svg
```

### ES6-Plato

```bash
npm run check:complexity
# Output: complexity-report/index.html
```

### Console.log

```bash
npm run check:console
# Output: Console (Exit code 1 wenn gefunden)
```

## 🔍 Erste Schritte

### 1. Setup ausführen

```bash
./scripts/setup-quality-tools.sh
```

### 2. Baseline erstellen

```bash
# Alle Checks durchführen
npm run quality

# Reports speichern
npm run check:complexity
npm run deps:graph
```

### 3. Issues beheben

```bash
# Knip: Unused dependencies entfernen
npm uninstall <package>

# JSCPD: Duplicates refactoren
# Madge: Circular dependencies auflösen
# Complexity: Funktionen aufteilen
# Console: console.log entfernen
```

### 4. In Workflow integrieren

```bash
# Pre-commit
npm run check:console

# Pre-PR
npm run quality

# Weekly
npm run audit:full
```

## 🎓 Best Practices

### Entwicklung

- `npm run check:console` vor jedem Commit
- `npm run quality` vor jedem PR
- `npm run audit:full` wöchentlich

### Code Review

- Knip-Report prüfen
- Complexity-Metriken beachten
- Circular Dependencies vermeiden

### Maintenance

- Dependencies regelmäßig aktualisieren
- Unused code entfernen
- Duplicates refactoren
- Complexity reduzieren

## 🐛 Troubleshooting

### "Command not found"

```bash
# Globale Installation prüfen
npm list -g jscpd madge es6-plato cost-of-modules

# Oder npx nutzen
npx jscpd --version
```

### Knip findet zu viele false positives

```json
// knip.json - Entry-points erweitern
{
  "entry": ["index.html", "pages/**/app.js", "workers/**/index.js"]
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
# Threshold erhöhen
jscpd --min-lines 20 --min-tokens 100
```

### Complexity-Report leer

```bash
# Pfade explizit angeben
es6-plato -r -d complexity-report content/**/*.js pages/**/*.js
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
- [ES6-Plato Documentation](https://github.com/es-analysis/plato)
- [Cost-of-Modules](https://github.com/siddharthkp/cost-of-modules)

## ✅ Checkliste

- [ ] Setup-Script ausgeführt
- [ ] Alle Tools installiert
- [ ] Graphviz installiert (für Madge)
- [ ] Ersten Quality-Check durchgeführt
- [ ] Reports generiert
- [ ] .gitignore aktualisiert
- [ ] CI/CD läuft
- [ ] Dokumentation gelesen

## 💡 Nächste Schritte

1. **Baseline erstellen:** Alle Reports generieren
2. **Issues priorisieren:** Kritische Probleme zuerst
3. **Workflow etablieren:** Pre-commit/PR-Checks
4. **Team informieren:** Dokumentation teilen
5. **Monitoring:** Weekly Reports beachten

---

**Setup:** `./scripts/setup-quality-tools.sh`  
**Quick Start:** `npm run quality`  
**Cheatsheet:** `docs/QUALITY_TOOLS_CHEATSHEET.md`
