# Projekt-Dokumentation

Portfolio Website mit Cloudflare Pages, Vanilla JavaScript und Three.js.

## 📁 Projektstruktur

```text
content/      Frontend-Code (Komponenten, Core, Styles, Media)
pages/        Seiten-spezifische Entry-Points
functions/    Cloudflare Pages Functions + API-Endpunkte
docs/         Diese Dokumentation
scripts/      Build-, Audit- und Wartungsskripte
config/       Konfigurationsdateien (ESLint, Prettier, Stylelint, .env.example)
```

### Root-Verzeichnis

Die Root-Struktur folgt Web-Standards:

- **Entry Points**: index.html, offline.html, sw.js
- **AI Discovery**: ai-index.json, llms.txt, bio.md, person.jsonld
- **Configuration**: package.json, tsconfig.json, eslint.config.mjs
- **Tooling entry points**: prettier.config.mjs, eslint.config.mjs, .stylelintrc.cjs
- **Cloudflare**: \_headers, \_redirects, wrangler.jsonc
- **Documentation**: README.md, LICENSE, CONTRIBUTING.md

Alle Root-Dateien sind notwendig und folgen Tool-Konventionen.

## 🎨 CSS & Styles

### CSS Foundation

**Source of Truth**:

- `content/styles/foundation.css` - Globale Variablen, Themes, Layout-Basis
- `content/styles/utilities.css` - Kleine Utility-Klassen

### Regeln

1. **CSS-Variablen verwenden**: Keine Hard-coded Colors/Spacing
2. **Utilities nutzen**: Für häufige Patterns
3. **Komponenten-Styles**: In separaten .css Dateien
4. **Responsive**: Mobile-first mit Breakpoints

Details: `content/styles/README.md`

## 🔧 Development

### Setup

```bash
npm ci                   # Dependencies installieren
npm run dev              # Dev-Server starten (localhost:8787)
```

### Quality Assurance

```bash
npm run qa               # Kompletter QA-Run (fix + lint)
npm run lint             # Nur Linting
npm run fix              # Auto-fix für ESLint + Stylelint + Prettier
npm run lint:apps-config # Pflichtfelder in pages/projekte/apps-config.json prüfen
```

### Hooks

**Pre-commit**: `lint-staged` auf gestagten Dateien
**Pre-push**: `npm run lint` mit optionalem Override

## 🚀 Deployment

### Cloudflare Pages

**Automatisch**:

- Push zu `main` → Production Deploy
- Pull Request → Preview Deploy

**Konfiguration**:

- `wrangler.jsonc` - Cloudflare Config
- `_headers` - HTTP Headers (Caching, Security)
- `_redirects` - URL-Redirects
- `functions/` - Serverless Functions

### Environment Variables

**Lokal**: `.dev.vars` (gitignored)
**Production**: Cloudflare Dashboard

## 🤖 AI Discovery & SEO

### AI-Indexierung

- `ai-index.json` - Strukturierter Gesamtindex
- `llms.txt` / `llms-full.txt` - LLM-Context
- `person.jsonld` - Schema.org Person
- `bio.md` - Markdown-Biografie

### Sitemaps

Dynamisch generiert via Cloudflare Functions:

- `/sitemap.xml` - Haupt-Sitemap
- `/sitemap-index.xml` - Sitemap-Index
- `/sitemap-images.xml` - Bilder-Sitemap

**Generator**: `functions/sitemap.xml.js`

### robots.txt

Erlaubt explizit AI-Bots (GPTBot, Claude-Web, etc.)

## 📊 Code Quality

### Linting

- **ESLint**: JavaScript/JSDoc (eslint.config.mjs)
- **Stylelint**: CSS (.stylelintrc.cjs)
- **Prettier**: Formatierung (prettier.config.mjs)

### Git Hooks

Konfiguriert via Husky (`.husky/`):

- `pre-commit` - Lint staged files
- `pre-push` - Lint mit optionalem Override

## 🎯 Performance

### Zero-Build Architecture

Keine Build-Steps nötig:

- Native ES Modules
- Import Maps für Dependencies
- CSS ohne Preprocessor

### Optimierungen

- **Caching**: Via `_headers` (Cloudflare)
- **Compression**: Automatisch (Cloudflare)
- **Images**: WebP, optimierte Größen
- **Code Splitting**: Via dynamic imports
- **Service Worker**: PWA mit Offline-Support

## 🔍 Wichtige Scripts

### Development

```bash
npm run dev              # Dev-Server mit Wrangler
npm run dev -- --port 8787  # Custom Port
```

### Quality

```bash
npm run qa               # Fix + Lint
npm run fix              # Nur Auto-fix
npm run format           # Nur Prettier schreiben
```

### Maintenance

```bash
npm run clean            # Cache löschen
npm run clean:full       # Cache + .wrangler löschen
npm run content-rag:update # Jules Content-RAG aktualisieren
npm run content-rag:status # Jules Content-RAG Status prüfen
```

### Admin Dashboard

- `pages/admin.html` liefert das Markup der Admin-Seite.
- `pages/admin/admin-app.js` enthält die komplette Client-Logik als externes ES-Modul.

## 📦 Dependencies

### Production

- `three` - 3D Graphics (Earth Visualization)
- `react` + `react-dom` - UI Components
- `htm` - JSX-Alternative
- `lucide-react` - Icons

### Development

- `wrangler` - Cloudflare CLI
- `eslint` - JavaScript Linting
- `stylelint` - CSS Linting
- `prettier` - Code Formatting
- `husky` - Git Hooks

## 🏗️ Architektur

### Frontend Layers

```text
content/core/         Framework-Utilities, Event-System
content/components/   Wiederverwendbare UI-Komponenten
content/styles/       Globale Styles, Foundation, Utilities
pages/*/              Seiten-Entry und Page-Komponenten
```

### Regeln

- `content/core` kennt keine Seiten-Details
- `content/components` bleibt generisch und variablen-basiert
- `pages/*` darf komponieren, aber keine Core-Regeln brechen

### Cloudflare Functions

```text
functions/
├── api/              API-Endpunkte
├── sitemap.xml.js    Sitemap-Generator
└── _routes.json      Routing-Config
```

## 🔐 Security

- **CSP**: Content Security Policy via `_headers`
- **HTTPS**: Erzwungen via Cloudflare
- **Dependencies**: Automatische Updates via Renovate
- **Secrets**: Nie in Git committen (`.dev.vars` ist gitignored)

Security Policy: `SECURITY.md`

## 🤝 Contributing

Siehe `CONTRIBUTING.md` für:

- Code-Style Guidelines
- Commit-Konventionen
- Pull Request Process
- Testing Requirements

## 📝 Changelog

Alle Änderungen werden in `docs/CHANGELOG.md` dokumentiert.

## 📄 License

MIT License - Siehe `LICENSE`

---

**Last Updated**: 2026-03-07
**Maintained by**: Abdulkerim Sesli
