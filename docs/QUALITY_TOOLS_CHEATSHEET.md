# Code Quality Tools - Cheatsheet

Schnellreferenz für alle Code-Quality-Tools.

## 🚀 Quick Commands

```bash
# Alles auf einmal
npm run quality              # Knip + Duplicates + Circular
npm run audit:full           # Security + Quality + Console

# Einzelne Tools
npm run knip                 # Unused code
npm run check:duplicates     # Duplicate code
npm run check:circular       # Circular dependencies
npm run check:complexity     # Code complexity
npm run check:console        # Console.log detection
```

## 📊 Tool-Übersicht

| Tool                | Zweck         | Command                    | Output         |
| ------------------- | ------------- | -------------------------- | -------------- |
| **Knip**            | Unused code   | `npm run knip`             | Console + JSON |
| **JSCPD**           | Duplicates    | `npm run check:duplicates` | Console        |
| **Madge**           | Circular deps | `npm run check:circular`   | Console        |
| **ES6-Plato**       | Complexity    | `npm run check:complexity` | HTML Report    |
| **Grep**            | Console.log   | `npm run check:console`    | Console        |
| **Cost-of-Modules** | Bundle impact | `npm run deps:cost`        | Console        |

## 🔍 Knip - Unused Code

### Basic Usage

```bash
npm run knip                    # Alle Checks
npm run knip:production         # Nur Production
npx knip --include files        # Nur Files
npx knip --include dependencies # Nur Dependencies
```

### Output verstehen

```
✓ 0 files
✓ 0 dependencies
✓ 0 exports
✓ 0 types
```

### Häufige Issues

- **Unused exports:** Export wird nirgends importiert
- **Unused files:** Datei wird nicht referenziert
- **Unused dependencies:** Package in package.json aber nicht genutzt

### Fix

```bash
# Dependencies entfernen
npm uninstall <package>

# Exports entfernen oder nutzen
# Files löschen oder zu entry-points hinzufügen
```

## 📋 JSCPD - Duplicate Code

### Basic Usage

```bash
npm run check:duplicates        # Standard (10 lines, 50 tokens)
npx jscpd content/ --min-lines 15  # Custom threshold
npx jscpd content/ --format javascript,typescript
```

### Output verstehen

```
Found 3 clones
Total lines: 45
Total tokens: 150
```

### Fix

- Gemeinsamen Code in Funktion extrahieren
- Utility-Module erstellen
- Komponenten wiederverwenden

## 🔄 Madge - Circular Dependencies

### Basic Usage

```bash
npm run check:circular          # Check
npm run deps:graph              # Visualize
npx madge --circular content/components/
```

### Output verstehen

```
✖ Found 1 circular dependency!
content/core/utils.js > content/core/events.js > content/core/utils.js
```

### Fix

- Gemeinsame Dependencies in separates Modul
- Dependency Injection nutzen
- Architektur überdenken

## 📊 ES6-Plato - Complexity

### Basic Usage

```bash
npm run check:complexity        # Generate report
open complexity-report/index.html
```

### Metriken

- **Cyclomatic Complexity:** < 10 (gut), > 20 (schlecht)
- **Maintainability Index:** > 65 (gut), < 40 (schlecht)
- **Lines of Code:** < 50 pro Funktion

### Fix

- Funktionen aufteilen
- Early returns nutzen
- Verschachtelung reduzieren

## 🔍 Console.log Detection

### Basic Usage

```bash
npm run check:console           # Check all
grep -r "console.log" content/ --include="*.js"
```

### Fix

```bash
# Alle console.log entfernen
find content/ -name "*.js" -exec sed -i '' '/console\.log/d' {} \;

# Oder manuell durch Logger ersetzen
import { logger } from './core/logger.js';
logger.debug('message');
```

## 📦 Cost of Modules

### Basic Usage

```bash
npm run deps:cost               # Show all
npx cost-of-modules --less 1MB # Filter
```

### Output verstehen

```
three: 500 KB
react: 120 KB
dompurify: 45 KB
```

### Fix

- Große Dependencies durch kleinere ersetzen
- Tree-shaking nutzen
- Dynamic imports für Code-Splitting

## 🎯 CI/CD Integration

### GitHub Actions Jobs

```yaml
# .github/workflows/ci.yml
jobs:
  code-quality:
    - Knip
    - JSCPD
    - Complexity
    - Console.log

  dependency-analysis:
    - Madge
    - Cost-of-Modules
```

### Artifacts

- `knip-report.json` - Knip results
- `dependency-graph.svg` - Dependency visualization
- `complexity-report/` - Complexity HTML report

## 🔧 Configuration Files

### knip.json

```json
{
  "entry": ["index.html", "content/main.js"],
  "ignoreDependencies": ["husky", "lint-staged"]
}
```

### .jscpdrc

```json
{
  "threshold": 0,
  "reporters": ["html", "console"],
  "ignore": ["node_modules", "dist"],
  "minLines": 10,
  "minTokens": 50
}
```

## 💡 Best Practices

### Vor jedem Commit

```bash
npm run check:console           # Console.log check
npm run lint:check              # Linting
```

### Vor jedem PR

```bash
npm run quality                 # Full quality check
npm run build                   # Build test
```

### Wöchentlich

```bash
npm run audit:full              # Security + Quality
npm run deps:check              # Update check
```

### Monatlich

```bash
npm run check:complexity        # Complexity review
npm run deps:cost               # Bundle review
```

## 🐛 Troubleshooting

### Knip findet zu viel

```json
// knip.json - Mehr entry-points
{
  "entry": ["pages/**/app.js", "workers/**/index.js"]
}
```

### JSCPD zu sensitiv

```bash
# Threshold erhöhen
jscpd --min-lines 20 --min-tokens 100
```

### Madge findet nichts

```bash
# Extensions angeben
madge --circular --extensions js,mjs content/
```

### Complexity-Report leer

```bash
# Pfade prüfen
es6-plato -r -d complexity-report content/**/*.js
```

## 📚 Weitere Infos

- [Knip Docs](https://github.com/webpro/knip)
- [JSCPD Docs](https://github.com/kucherenko/jscpd)
- [Madge Docs](https://github.com/pahen/madge)
- [Plato Docs](https://github.com/es-analysis/plato)

## 🎓 Tipps & Tricks

### Knip

- Regelmäßig ausführen (wöchentlich)
- False positives in Config ignorieren
- Entry-points sorgfältig definieren

### JSCPD

- Threshold an Projekt anpassen
- Nicht alle Duplicates sind schlecht
- Patterns können legitim sein

### Madge

- Circular deps früh erkennen
- Graph visualisieren für Verständnis
- Architektur-Probleme identifizieren

### Complexity

- Trends über Zeit beobachten
- Refactoring priorisieren
- Limits definieren und einhalten

---

**Setup:** `./scripts/setup-quality-tools.sh`  
**Docs:** `docs/CODE_QUALITY.md`  
**Dev Guide:** `DEVELOPMENT.md`
