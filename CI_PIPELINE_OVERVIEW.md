# CI/CD Pipeline - Übersicht

Vollständige Dokumentation der erweiterten CI/CD-Pipeline.

## 🎯 Pipeline-Architektur

```
┌─────────────────────────────────────────────────────────────┐
│                     CI Pipeline (ci.yml)                     │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────┐                                                │
│  │   Lint   │  ESLint + Prettier + CSS Stats                │
│  └────┬─────┘                                                │
│       │                                                       │
│       ▼                                                       │
│  ┌──────────┐                                                │
│  │  Build   │  Vite Build + Bundle Analysis                 │
│  └──────────┘                                                │
│                                                               │
│  ┌──────────┐                                                │
│  │ Security │  npm audit + Outdated Check                   │
│  └──────────┘                                                │
│                                                               │
│  ┌──────────┐                                                │
│  │ Workers  │  Cloudflare Workers Validation                │
│  └──────────┘                                                │
│                                                               │
│  ┌──────────┐                                                │
│  │TypeCheck │  TypeScript Type Checking                     │
│  └──────────┘                                                │
│                                                               │
│  ┌──────────┐                                                │
│  │ Quality  │  Knip + JSCPD + Complexity + Console          │
│  └──────────┘                                                │
│                                                               │
│  ┌──────────┐                                                │
│  │   Deps   │  Madge + Cost-of-Modules                      │
│  └──────────┘                                                │
│                                                               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│          Weekly Quality Report (code-quality-report.yml)     │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  📅 Jeden Montag 9:00 UTC                                    │
│  📊 Generiert umfassenden Quality-Report                     │
│  📝 Erstellt GitHub Issue mit Ergebnissen                    │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## 📋 Jobs im Detail

### 1. Lint & Format Check

**Zweck:** Code-Style und Formatierung prüfen

**Checks:**

- ✅ ESLint (JavaScript Linting)
- ✅ Prettier (Code Formatting)
- ✅ CSS Stats (CSS-Datei-Größen)

**Trigger:** Push/PR auf main/develop

**Dauer:** ~30 Sekunden

### 2. Build & Bundle Analysis

**Zweck:** Production-Build testen und Bundle-Größe analysieren

**Checks:**

- ✅ Vite Build
- ✅ Bundle-Größe (JS/CSS)
- ✅ Build-Artefakte

**Artifacts:**

- `dist/` (7 Tage)

**Trigger:** Nach erfolgreichem Lint

**Dauer:** ~1-2 Minuten

### 3. Security Audit

**Zweck:** Sicherheitslücken und veraltete Dependencies finden

**Checks:**

- ✅ npm audit (moderate+)
- ✅ Outdated Dependencies

**Trigger:** Push/PR auf main/develop

**Dauer:** ~20 Sekunden

### 4. Cloudflare Workers Validation

**Zweck:** Worker-Syntax und Konfiguration prüfen

**Checks:**

- ✅ AI Search Proxy Syntax
- ✅ YouTube API Proxy Syntax
- ✅ wrangler.toml Validation

**Trigger:** Push/PR auf main/develop

**Dauer:** ~30 Sekunden

### 5. TypeScript Type Check

**Zweck:** Type-Safety prüfen (auch bei JS mit JSDoc)

**Checks:**

- ✅ TypeScript Compilation (noEmit)
- ✅ Type Definitions

**Trigger:** Push/PR auf main/develop

**Dauer:** ~30 Sekunden

### 6. Code Quality Analysis

**Zweck:** Code-Qualität umfassend analysieren

**Checks:**

- ✅ Knip (Unused Code)
- ✅ JSCPD (Duplicates)
- ✅ ES6-Plato (Complexity)
- ✅ Console.log Detection

**Artifacts:**

- `knip-report.json` (7 Tage)

**Trigger:** Push/PR auf main/develop

**Dauer:** ~1-2 Minuten

### 7. Dependency Analysis

**Zweck:** Dependencies analysieren und visualisieren

**Checks:**

- ✅ Madge (Circular Dependencies)
- ✅ Dependency Graph (SVG)
- ✅ Cost-of-Modules (Bundle Impact)

**Artifacts:**

- `dependency-graph.svg` (7 Tage)

**Trigger:** Push/PR auf main/develop

**Dauer:** ~1 Minute

## 📊 Weekly Quality Report

**Schedule:** Jeden Montag 9:00 UTC

**Generiert:**

- Knip Report (Markdown)
- Duplicate Code Report
- Complexity Report
- Circular Dependencies
- Bundle Size Analysis
- Security Audit

**Output:**

- GitHub Issue mit vollständigem Report
- Artifacts (30 Tage)

**Manuell auslösbar:** Ja (workflow_dispatch)

## 🎯 Trigger-Übersicht

| Event                   | Jobs          |
| ----------------------- | ------------- |
| **Push (main/develop)** | Alle 7 Jobs   |
| **Pull Request**        | Alle 7 Jobs   |
| **Schedule (Mo 9:00)**  | Weekly Report |
| **Manual**              | Weekly Report |

## 📦 Artifacts

| Name               | Inhalt        | Retention |
| ------------------ | ------------- | --------- |
| `dist`             | Build Output  | 7 Tage    |
| `knip-report`      | Knip JSON     | 7 Tage    |
| `dependency-graph` | Madge SVG     | 7 Tage    |
| `quality-report`   | Weekly Report | 30 Tage   |

## 🔧 Lokale Entwicklung

### Alle CI-Checks lokal ausführen

```bash
# 1. Lint & Format
npm run check

# 2. Build
npm run build

# 3. Security
npm audit

# 4. Workers
node -c workers/ai-search-proxy/index.js
node -c workers/youtube-api-proxy/index.js

# 5. Type Check
npx tsc --noEmit

# 6. Code Quality
npm run quality

# 7. Dependencies
npm run check:circular
npm run deps:cost
```

### Schnell-Check vor Commit

```bash
npm run check           # Lint + Format
npm run check:console   # Console.log
```

### Vollständiger Check vor PR

```bash
npm run audit:full      # Security + Quality + Console
npm run build           # Build Test
```

## 📈 Performance-Metriken

### Durchschnittliche Laufzeiten

| Job          | Dauer  | Parallel  |
| ------------ | ------ | --------- |
| Lint         | 30s    | Ja        |
| Build        | 1-2min | Nach Lint |
| Security     | 20s    | Ja        |
| Workers      | 30s    | Ja        |
| Type Check   | 30s    | Ja        |
| Quality      | 1-2min | Ja        |
| Dependencies | 1min   | Ja        |

**Gesamt:** ~2-3 Minuten (parallel)

## 🎓 Best Practices

### Entwickler

1. **Vor Commit:** `npm run check:console`
2. **Vor Push:** `npm run check`
3. **Vor PR:** `npm run quality`

### Code Review

1. CI-Status prüfen (alle Jobs grün)
2. Artifacts reviewen (Bundle-Größe, Knip-Report)
3. Quality-Metriken beachten

### Maintenance

1. **Täglich:** CI-Status monitoren
2. **Wöchentlich:** Quality-Report reviewen
3. **Monatlich:** Dependencies aktualisieren

## 🐛 Troubleshooting

### Job schlägt fehl

```bash
# Lokal reproduzieren
npm run <script-name>

# Logs prüfen
# GitHub Actions → Job → Step Details
```

### Artifacts fehlen

```bash
# Upload-Bedingung prüfen
if: always()  # Immer hochladen
if: success() # Nur bei Erfolg
```

### Timeout

```bash
# Timeout erhöhen (in ci.yml)
timeout-minutes: 10
```

### Cache-Probleme

```bash
# Cache invalidieren
# GitHub Actions → Caches → Delete
```

## 📚 Dokumentation

### Setup & Installation

- **[QUALITY_TOOLS_SETUP.md](docs/QUALITY_TOOLS_SETUP.md)** - Installation Guide
- **[setup-quality-tools.sh](scripts/setup-quality-tools.sh)** - Setup Script

### Nutzung

- **[CODE_QUALITY.md](docs/CODE_QUALITY.md)** - Detaillierte Tool-Docs
- **[QUALITY_TOOLS_CHEATSHEET.md](docs/QUALITY_TOOLS_CHEATSHEET.md)** - Quick Reference
- **[DEVELOPMENT.md](DEVELOPMENT.md)** - Development Guide

### Workflows

- **[ci.yml](.github/workflows/ci.yml)** - Main CI Pipeline
- **[code-quality-report.yml](.github/workflows/code-quality-report.yml)** - Weekly Report

## 🔗 Externe Tools

| Tool                | Zweck         | Docs                                                     |
| ------------------- | ------------- | -------------------------------------------------------- |
| **Knip**            | Unused Code   | [GitHub](https://github.com/webpro/knip)                 |
| **JSCPD**           | Duplicates    | [GitHub](https://github.com/kucherenko/jscpd)            |
| **Madge**           | Circular Deps | [GitHub](https://github.com/pahen/madge)                 |
| **ES6-Plato**       | Complexity    | [GitHub](https://github.com/es-analysis/plato)           |
| **Cost-of-Modules** | Bundle Impact | [GitHub](https://github.com/siddharthkp/cost-of-modules) |

## ✅ Checkliste

### Setup

- [x] CI-Pipeline erweitert (7 Jobs)
- [x] Weekly Quality Report hinzugefügt
- [x] npm Scripts erstellt
- [x] Setup-Script erstellt
- [x] Dokumentation erstellt
- [x] .gitignore aktualisiert

### Nächste Schritte

- [ ] Setup-Script ausführen
- [ ] Ersten Quality-Check durchführen
- [ ] CI-Pipeline testen (Push)
- [ ] Weekly Report konfigurieren
- [ ] Team informieren

## 💡 Erweiterungsmöglichkeiten

### Weitere Jobs

- **Lighthouse CI** - Performance-Monitoring
- **Visual Regression** - Screenshot-Tests
- **E2E Tests** - Playwright/Cypress
- **Deployment** - Auto-Deploy zu Cloudflare

### Weitere Tools

- **SonarQube** - Code Quality Platform
- **Snyk** - Security Scanning
- **Bundlephobia** - Bundle Size Tracking
- **Depcheck** - Dependency Checker

### Notifications

- **Slack** - CI-Status Notifications
- **Discord** - Quality-Reports
- **Email** - Failed Build Alerts

---

**Erstellt:** Februar 2026
**Version:** 1.0
**Autor:** Abdulkerim Sesli
