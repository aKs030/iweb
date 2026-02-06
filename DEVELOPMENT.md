# Development Guide

Entwickler-Dokumentation für das Projekt.

## 🚀 Quick Start

```bash
# Installation
npm install

# Development Server (Node.js)
npm run dev
```

## 📋 Verfügbare Commands

### Development

```bash
npm run dev              # Node.js Dev Server (Port 8080)
```

### Code Quality

```bash
npm run lint             # ESLint mit Auto-Fix
npm run lint:check       # ESLint ohne Fix
npm run format           # Prettier mit Auto-Fix
npm run format:check     # Prettier ohne Fix
npm run check            # Lint + Format Check
npm run fix              # Lint + Format Fix
```

### Code Analysis

```bash
npm run knip                  # Unused code detection
npm run knip:production       # Nur Production Dependencies
npm run check:duplicates      # Duplicate code detection
npm run check:circular        # Circular dependencies
npm run check:console         # Console.log detection
npm run quality               # Alle Quality-Checks
npm run audit:full            # Quality + Console
```

### Dependencies

```bash
npm run deps:graph       # Dependency-Graph erstellen
npm run deps:check       # Outdated Dependencies
```

### CSS Analysis

```bash
npm run css:check        # CSS Stats anzeigen
```

### Validation

```bash
npm run check:typescript  # TypeScript Type Check
npm run check:html        # HTML-Validierung
npm run quality:full      # Alle Checks (Quality + TS + HTML)
```

## 🔧 Git Hooks

### Pre-Commit

Automatisch vor jedem Commit:

- ESLint auf geänderte JS-Dateien
- Prettier auf geänderte Dateien

### Pre-Push

Automatisch vor jedem Push:

- Lint Check
- Format Check

## 🧪 Code Quality Tools

### 1. Knip - Unused Code

```bash
npm run knip
```

Findet:

- Ungenutzte Dependencies
- Ungenutzte Exports
- Ungenutzte Dateien
- Ungenutzte Types

### 2. JSCPD - Duplicates

```bash
npm run check:duplicates
```

Findet duplizierte Code-Blöcke (>10 Zeilen, >50 Tokens).

### 3. Madge - Circular Dependencies

```bash
npm run check:circular
npm run deps:graph
```

Findet zirkuläre Dependencies und erstellt Dependency-Graph.

### 4. Console.log Detection

```bash
npm run check:console
```

Findet vergessene console.log Statements.

## 📊 CI/CD Pipeline

### Unified CI Job

Ein einzelner CI-Job führt alle Checks sequenziell aus:

1. **Lint** — ESLint + Prettier
2. **Format Check** — Code-Formatierung
3. **TypeScript** — Type Check
4. **HTML Validation** — html-validate
5. **Security** — npm audit
6. **Workers Validation** — Cloudflare Workers Syntax
7. **Code Quality** — Knip + JSCPD + Console.log + Circular Dependencies

## 🎯 Best Practices

### Vor jedem Commit

```bash
npm run check           # Lint + Format Check
npm run check:console   # Console.log Check
```

### Vor jedem PR

```bash
npm run quality         # Alle Quality-Checks
npm run check           # Lint + Format Check
```

### Wöchentlich

```bash
npm run audit:full      # Security + Quality Audit
npm run deps:check      # Dependencies aktualisieren
```

## 📁 Projekt-Struktur

```
.
├── content/              # Frontend Code
│   ├── components/      # Web Components
│   ├── core/            # Core Utilities
│   ├── config/          # Configuration
│   └── styles/          # CSS Architecture
│
├── pages/               # Page Content
│   ├── home/           # Homepage
│   ├── projekte/       # Projects
│   ├── gallery/        # Photo Gallery
│   ├── blog/           # Blog
│   └── videos/         # Video Gallery
│
├── workers/             # Cloudflare Workers
│   ├── ai-search-proxy/
│   └── youtube-api-proxy/
│
├── docs/                # Documentation
│   ├── ARCHITECTURE.md
│   ├── CODE_QUALITY.md
│   ├── CSS_GUIDE.md
│   └── IMAGE_OPTIMIZATION.md
│
└── .github/             # CI/CD
    └── workflows/
        ├── ci.yml
        └── code-quality-report.yml
```

## 🔍 Debugging

### Dev Server

```bash
# Standard Port (8080)
npm run dev

# Server-Optionen siehe server.js
```

### Worker Issues

```bash
# Worker Logs anzeigen
wrangler tail

# Worker mit Debug
wrangler dev --log-level debug
```

## 🌐 Environment Variables

```bash
# .env.example kopieren
cp .env.example .env

# Secrets für Workers
wrangler secret put GROQ_API_KEY
wrangler secret put YOUTUBE_API_KEY --env youtube
```

## 📚 Weitere Dokumentation

- [Architecture](docs/ARCHITECTURE.md) - System-Architektur
- [Code Quality](docs/CODE_QUALITY.md) - Quality-Tools
- [CSS Guide](docs/CSS_GUIDE.md) - CSS-Architektur
- [Image Optimization](docs/IMAGE_OPTIMIZATION.md) - Bildoptimierung
- [Workers](workers/README.md) - Cloudflare Workers

## 🤝 Contributing

1. Branch erstellen: `git checkout -b feature/xyz`
2. Changes committen: `git commit -m "feat: xyz"`
3. Quality-Checks: `npm run quality`
4. Push: `git push origin feature/xyz`
5. Pull Request erstellen

## 💡 Tipps

### Performance

- Lazy Loading für Bilder nutzen
- Service Worker für Offline-Support

### Code Quality

- Regelmäßig `npm run quality` ausführen
- Duplicates vermeiden
- Console.log vor Commit entfernen

### Dependencies

- Nur notwendige Dependencies installieren
- Regelmäßig `npm run deps:check` ausführen
- Security Audits beachten

---

**Letzte Aktualisierung:** Februar 2026
