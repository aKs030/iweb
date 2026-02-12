# Development Guide

Entwickler-Dokumentation für das Projekt.

## 🚀 Quick Start

```bash
# Installation
npm install

# Development Server (Vite)
npm run dev
```

## 📋 Verfügbare Commands

### Development

```bash
npm run dev              # Vite Dev Server (Port 5173)
npm run preview          # Build & Local Cloudflare Preview
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
npm run css:check             # CSS Stats anzeigen
```

## 🔧 Git Hooks

### Pre-Commit

Automatisch vor jedem Commit:

- ESLint auf geänderte JS-Dateien
- Prettier auf geänderte Dateien

## 📁 Projekt-Struktur

```
.
├── content/              # Frontend Code (Assets, Components, Styles)
├── public/               # Static Assets (kopiert nach dist/)
│   ├── robots.txt
│   ├── _headers
│   └── ...
├── pages/                # HTML Entry Points
├── functions/            # Cloudflare Pages Functions (API & Middleware)
│   ├── api/
│   └── _middleware.js
└── dist/                 # Build Output (nicht einchecken)
```

## 🔍 Debugging

### Dev Server

```bash
npm run dev
```

### Cloudflare Functions (Local)

```bash
npm run preview
```
Dies baut das Projekt und startet `wrangler pages dev`, um die Production-Umgebung inklusive Functions zu simulieren.

## 🤝 Contributing

1. Branch erstellen: `git checkout -b feature/xyz`
2. Changes committen: `git commit -m "feat: xyz"`
3. Quality-Checks: `npm run check`
4. Push: `git push origin feature/xyz`
5. Pull Request erstellen

---

**Letzte Aktualisierung:** Februar 2026
