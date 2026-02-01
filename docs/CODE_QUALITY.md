# Code Quality Tools

Übersicht über alle Code-Quality-Tools im Projekt.

## 🔍 Verfügbare Tools

### 1. **Knip** - Unused Code Detection

Findet ungenutzten Code, Dependencies und Exports.

```bash
# Alle ungenutzten Ressourcen finden
npm run knip

# Nur Production-Dependencies prüfen
npm run knip:production
```

**Was wird geprüft:**

- ✅ Ungenutzte Dependencies in package.json
- ✅ Ungenutzte Exports in Modulen
- ✅ Ungenutzte Dateien
- ✅ Ungenutzte Types

### 2. **JSCPD** - Duplicate Code Detection

Findet duplizierte Code-Blöcke.

```bash
# Duplikate finden
npm run check:duplicates
```

**Konfiguration:**

- Mindestens 10 Zeilen
- Mindestens 50 Tokens
- Nur JavaScript-Dateien

### 3. **Madge** - Circular Dependencies

Findet zirkuläre Dependencies.

```bash
# Circular Dependencies prüfen
npm run check:circular

# Dependency-Graph erstellen
npm run deps:graph
```

**Output:** `dependency-graph.svg`

### 4. **ES6-Plato** - Code Complexity

Analysiert Code-Komplexität (Cyclomatic Complexity, Maintainability).

```bash
# Komplexität analysieren
npm run check:complexity
```

**Output:** `complexity-report/index.html`

### 5. **Console.log Detection**

Findet vergessene console.log Statements.

```bash
# Console.log finden
npm run check:console
```

### 6. **Cost of Modules**

Zeigt Bundle-Impact von Dependencies.

```bash
# Bundle-Impact analysieren
npm run deps:cost
```

## 🚀 Kombinierte Checks

### Vollständiger Quality-Check

```bash
# Alle Quality-Checks ausführen
npm run quality
```

Führt aus:

1. Knip (unused code)
2. JSCPD (duplicates)
3. Madge (circular deps)

### Vollständiger Audit

```bash
# Security + Quality + Console-Check
npm run audit:full
```

## 📊 CI/CD Integration

Alle Tools laufen automatisch in der CI-Pipeline:

- **code-quality** Job: Knip, JSCPD, Complexity, Console-Check
- **dependency-analysis** Job: Madge, Cost-of-Modules

## 🎯 Best Practices

### Knip

**Ignorieren von Dependencies:**

```json
// knip.json
{
  "ignoreDependencies": ["husky", "lint-staged"]
}
```

### JSCPD

**Threshold anpassen:**

```bash
jscpd --min-lines 15 --min-tokens 100
```

### Madge

**Nur bestimmte Ordner:**

```bash
madge --circular content/components/
```

## 🔧 Lokale Entwicklung

### Pre-Commit Hook

Automatische Checks vor jedem Commit:

```bash
# .husky/pre-commit
npm run lint:check
npm run format:check
npm run check:console
```

### VS Code Integration

Empfohlene Extensions:

- **ESLint** - Linting
- **Prettier** - Formatting
- **SonarLint** - Code Quality
- **Import Cost** - Bundle Size

## 📈 Metriken

### Code Complexity Limits

- **Cyclomatic Complexity:** < 10
- **Maintainability Index:** > 65
- **Lines per Function:** < 50

### Bundle Size Limits

- **Main Bundle:** < 200 KB
- **Vendor Bundle:** < 500 KB
- **CSS Bundle:** < 50 KB

## 🐛 Troubleshooting

### Knip findet zu viele false positives

```json
// knip.json - Entry-Points hinzufügen
{
  "entry": ["pages/**/app.js", "workers/**/index.js"]
}
```

### JSCPD zu sensitiv

```bash
# Threshold erhöhen
jscpd --min-lines 20 --min-tokens 100
```

### Madge findet keine Circular Dependencies

```bash
# Mit Extensions
madge --circular --extensions js,mjs content/
```

## 📚 Weitere Ressourcen

- [Knip Documentation](https://github.com/webpro/knip)
- [JSCPD Documentation](https://github.com/kucherenko/jscpd)
- [Madge Documentation](https://github.com/pahen/madge)
- [ES6-Plato Documentation](https://github.com/es-analysis/plato)

## 🎓 Tipps

1. **Regelmäßig ausführen:** `npm run quality` vor jedem PR
2. **CI-Reports prüfen:** Artifacts in GitHub Actions
3. **Trends beobachten:** Complexity über Zeit tracken
4. **Refactoring:** Bei hoher Complexity refactoren
5. **Dependencies aufräumen:** Ungenutzte Dependencies entfernen

---

**Letzte Aktualisierung:** Februar 2026
