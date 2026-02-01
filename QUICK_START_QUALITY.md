# 🚀 Quick Start - Code Quality Tools

Schnellstart-Guide für die neuen Code-Quality-Tools.

## ⚡ 3-Minuten-Setup

```bash
# 1. Setup ausführen
./scripts/setup-quality-tools.sh

# 2. Ersten Check durchführen
npm run quality

# 3. Fertig! 🎉
```

## 📊 Verfügbare Commands

### 🎯 Haupt-Commands

```bash
npm run quality      # Alle Quality-Checks (Knip + JSCPD + Madge)
npm run audit:full   # Security + Quality + Console
```

### 🔍 Einzelne Tools

```bash
npm run knip                 # Unused code
npm run check:duplicates     # Duplicate code
npm run check:circular       # Circular dependencies
npm run check:complexity     # Code complexity
npm run check:console        # Console.log detection
```

### 📦 Dependencies

```bash
npm run deps:graph   # Dependency graph (SVG)
npm run deps:cost    # Bundle impact
npm run deps:check   # Outdated packages
```

## 🎨 Was wird geprüft?

```
┌─────────────────────────────────────────────────────────┐
│                    Code Quality Tools                    │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  🔍 Knip                                                 │
│     ├─ Unused dependencies                              │
│     ├─ Unused exports                                   │
│     ├─ Unused files                                     │
│     └─ Unused types                                     │
│                                                           │
│  📋 JSCPD                                                │
│     ├─ Duplicate code blocks                            │
│     ├─ Copy-paste detection                             │
│     └─ Code reuse analysis                              │
│                                                           │
│  🔄 Madge                                                │
│     ├─ Circular dependencies                            │
│     ├─ Dependency graph                                 │
│     └─ Module structure                                 │
│                                                           │
│  📊 ES6-Plato                                            │
│     ├─ Cyclomatic complexity                            │
│     ├─ Maintainability index                            │
│     └─ Lines of code                                    │
│                                                           │
│  🔍 Console.log Detection                                │
│     └─ Production console.log                           │
│                                                           │
│  📦 Cost-of-Modules                                      │
│     └─ Bundle impact analysis                           │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

## 🎯 Workflow

### Vor jedem Commit

```bash
npm run check:console   # Console.log check
npm run check           # Lint + Format
```

### Vor jedem PR

```bash
npm run quality         # Full quality check
npm run build           # Build test
```

### Wöchentlich

```bash
npm run audit:full      # Security + Quality
npm run deps:check      # Update check
```

## 📈 CI/CD Pipeline

```
Push/PR → GitHub Actions
    │
    ├─ Lint & Format ✓
    ├─ Build & Bundle ✓
    ├─ Security Audit ✓
    ├─ Workers Validation ✓
    ├─ Type Check ✓
    ├─ Code Quality ✓
    └─ Dependency Analysis ✓

Weekly (Mo 9:00 UTC)
    │
    └─ Quality Report → GitHub Issue
```

## 📚 Dokumentation

| Dokument                                                        | Zweck                  |
| --------------------------------------------------------------- | ---------------------- |
| [CODE_QUALITY.md](docs/CODE_QUALITY.md)                         | Detaillierte Tool-Docs |
| [QUALITY_TOOLS_CHEATSHEET.md](docs/QUALITY_TOOLS_CHEATSHEET.md) | Quick Reference        |
| [QUALITY_TOOLS_SETUP.md](docs/QUALITY_TOOLS_SETUP.md)           | Setup Guide            |
| [DEVELOPMENT.md](DEVELOPMENT.md)                                | Development Guide      |
| [CI_PIPELINE_OVERVIEW.md](CI_PIPELINE_OVERVIEW.md)              | CI/CD Docs             |

## 🎓 Beispiele

### Knip Output

```bash
$ npm run knip

✓ 0 files
✓ 0 dependencies
✓ 0 exports
✓ 0 types

✅ All good!
```

### JSCPD Output

```bash
$ npm run check:duplicates

Found 2 clones
Total lines: 30
Total tokens: 120

⚠️ Consider refactoring
```

### Madge Output

```bash
$ npm run check:circular

✖ Found 1 circular dependency!
content/core/utils.js > content/core/events.js > content/core/utils.js

❌ Fix circular dependency
```

### Complexity Output

```bash
$ npm run check:complexity

Report generated: complexity-report/index.html

📊 Open in browser to view
```

## 💡 Tipps

### Performance

- Tools laufen parallel in CI
- Lokale Checks sind schnell (~1-2 Min)
- Nutze `npm run quality` vor jedem PR

### Best Practices

- Complexity < 10 halten
- Duplicates vermeiden
- Circular deps auflösen
- Console.log entfernen

### Troubleshooting

- Knip findet zu viel? → Entry-points in knip.json erweitern
- JSCPD zu sensitiv? → Threshold erhöhen
- Madge findet nichts? → Extensions prüfen

## 🔗 Quick Links

- **Setup:** `./scripts/setup-quality-tools.sh`
- **Check:** `npm run quality`
- **Docs:** `docs/CODE_QUALITY.md`
- **CI:** `.github/workflows/ci.yml`

## ✅ Checkliste

- [ ] Setup-Script ausgeführt
- [ ] Graphviz installiert (`brew install graphviz`)
- [ ] Ersten Check durchgeführt (`npm run quality`)
- [ ] Dokumentation gelesen
- [ ] CI-Pipeline getestet

## 🎉 Fertig!

Du bist jetzt bereit, professionelle Code-Quality-Checks zu nutzen!

**Nächster Schritt:** `npm run quality`

---

**Fragen?** Siehe [CODE_QUALITY.md](docs/CODE_QUALITY.md)
