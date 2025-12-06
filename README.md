# iweb

Modernes Portfolio & Creative Development Platform von Abdulkerim Sesli.

## ✨ Features

- **Progressive Web App (PWA)** mit Offline-Support
- **Responsive Design** optimiert für alle Geräte
- **3D Earth Visualization** mit Three.js
- **TypeWriter-Effekt** für dynamische Texte
- **Accessibility-First** mit ARIA-Support und Screen Reader Optimierung
- **Performance-optimiert** mit Lazy Loading und Code Splitting

## 🚀 Quick Start

### Installation

```bash
# Installiere Dependencies
npm install
```

### Development Server

```bash
# Starte lokalen Entwicklungsserver
npm run dev
```

Öffne http://127.0.0.1:8081 im Browser.

### WebSocket Debugging

Für lokales WebSocket-Testing füge `?ws-test` zur URL hinzu:

```bash
open "http://127.0.0.1:8081/?ws-test"
```

Die WebSocket-Reconnect-Logik verwendet `content/shared/reconnecting-websocket.js`.

## 🛠️ Scripts

```bash
# Code formatieren
npm run format

# Entwicklungsserver starten
npm run dev

# Lokaler HTTP-Server
npm run serve

# Production Build
npm run build:prod
```

## 📦 Progressive Web App (PWA)

Die Website ist als PWA installierbar und bietet:

- **Offline-Funktionalität** durch Service Worker
- **App-Installation** auf Desktop und Mobile
- **Cache-Strategien**:
  - Cache-First für Bilder und Fonts
  - Network-First für HTML
  - Stale-While-Revalidate für CSS/JS

### Service Worker Management

```javascript
// Service Worker löschen (Development)
navigator.serviceWorker.getRegistrations().then((registrations) => {
  registrations.forEach((reg) => reg.unregister());
});
```

Siehe `sw.js` für Implementierungsdetails.

## 🔒 Sicherheit

Content Security Policy (CSP) Empfehlungen sind in `SECURITY-CSP.md` dokumentiert.

Empfohlene Security Headers:

- Content-Security-Policy
- X-Content-Type-Options
- X-Frame-Options
- Strict-Transport-Security

## 📁 Projektstruktur

```
iweb/
├── content/               # Shared Components & Utilities
│   ├── main.js           # Haupt-Entry-Point
│   ├── shared-utilities.js
│   ├── accessibility-manager.js
│   ├── menu/
│   ├── footer/
│   ├── particles/        # Three.js Earth System
│   └── TypeWriter/
├── pages/                # Seiten-spezifische Module
│   ├── home/
│   ├── about/
│   ├── fotos/            # 📸 React Photo Gallery
│   │   ├── gallery.html
│   │   └── gallery-app.js
│   └── projekte/
├── sw.js                 # Service Worker
├── offline.html          # Offline-Fallback-Seite
└── manifest.json         # PWA Manifest
```

## 🎨 Styling

CSS-Variablen sind in `content/root.css` zentralisiert:

- Dark/Light Mode Support
- Responsive Typography
- Design Tokens für Konsistenz

## 🧪 Code Quality

### Linting

```bash
# JavaScript linting
npx eslint .

# CSS linting
npx stylelint "**/*.css"
```

### Best Practices

- Verwende `createLogger()` aus `shared-utilities.js` für Logging
- Halte CSS-Variablen in `content/root.css`
- Service Worker Version-Bump bei Änderungen an `sw.js`
- Teste Offline-Funktionalität mit DevTools Network Throttling

## 📝 Recent Updates (Dezember 2025)

### ✅ React Photo Gallery hinzugefügt

- Neue React-basierte Photo Gallery unter `/pages/fotos/`
- Features: Filter, Suche, Zoom, Slideshow, Favoriten, Download/Share
- Nutzt lokale Utility-CSS (`/pages/fotos/gallery-styles.css`) statt Tailwind-CDN
- Vollständig responsive und PWA-kompatibel

### ✅ Console-Logs standardisiert

Alle `console.*` Aufrufe wurden durch das zentrale Logger-System ersetzt.

### ✅ Dependencies aktualisiert

- ESLint v8 → v9
- Concurrently v8 → v9
- Lint-staged v13 → v15
- Weitere Updates siehe `package.json`

### ✅ CSS optimiert

- Doppelte Selektoren entfernt
- about.css bereinigt
- CSS-Variablen konsolidiert

### ✅ PWA implementiert

Service Worker mit intelligenten Caching-Strategien hinzugefügt.

## 📚 Dokumentation

- **DEV.md** - Entwickler-Dokumentation und Debugging-Tipps
- **SECURITY-CSP.md** - Content Security Policy Richtlinien
- **manifest.json** - PWA-Konfiguration

## 🤝 Entwicklung

Entwickelt mit modernen Web-Standards:

- ES Modules
- CSS Custom Properties
- Intersection Observer API
- Service Worker API
- Web Components Patterns

## 📄 Lizenz

MIT

---

**Hinweis:** Diese Website verwendet keine externen Frameworks im Production-Build. React wird nur für die Projekte-Seite verwendet und ist als UMD-Build eingebunden.
