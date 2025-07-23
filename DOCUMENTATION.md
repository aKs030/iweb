### Wichtige Dev-Dependencies & Tools

| Paket/Tool         | Zweck / Beschreibung                               |
| ------------------ | -------------------------------------------------- |
| `eslint`           | Linting für JavaScript, Codequalität               |
| `prettier`         | Automatische Code-Formatierung                     |
| `stylelint`        | Linting für CSS                                    |
| `purgecss`         | Entfernt ungenutztes CSS                           |
| `terser`           | Minifiziert JavaScript                             |
| `lighthouse`       | Performance- und PWA-Analyse                       |
| `@lhci/cli`        | Lighthouse CI für automatisierte Performance-Tests |
| `audit-ci`         | Security Audit für Dependencies                    |
| `imagemin`/`sharp` | Bildoptimierung (jpg/png/webp/avif)                |
| `linkinator`       | Link-Checker für Webseiten                         |
| `express`          | Security-Header-Tests                              |
| `html-validate`    | HTML-Validierung                                   |
| `@percy/cli`       | Visuelle Regressionstests (optional)               |

_Weitere Tools siehe package.json_

## DOCUMENTATION.md

```markdown
# 📚 iweb Technische Dokumentation

## Inhaltsverzeichnis

1. [Architektur](#architektur)
2. [Module & Komponenten](#module--komponenten)
3. [Styling System](#styling-system)
4. [JavaScript Architecture](#javascript-architecture)
5. [Performance Optimierung](#performance-optimierung)
6. [Security Implementation](#security-implementation)
7. [PWA Features](#pwa-features)
8. [Cookie Management](#cookie-management)
9. [Build & Deployment](#build--deployment)
10. [Troubleshooting](#troubleshooting)

## Architektur

### Technologie-Stack

- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3
- **Build Tools**: Node.js, Express.js (Dev Server)
- **Testing**: Lighthouse CI, HTML Validator, Stylelint
- **CI/CD**: GitHub Actions
- **Analytics**: Google Analytics 4
- **Hosting**: Static Hosting (Cloudflare docs/pages empfohlen)

### Design Patterns

- **Module Pattern**: Gekapselte JavaScript-Module
- **Observer Pattern**: Event-basierte Kommunikation
- **Singleton Pattern**: Cookie Manager, Performance Monitor
- **Factory Pattern**: Dynamic Content Loading

### Verzeichnisstruktur
```

iweb/ ├── index.html # SPA Entry Point ├── css/ │ ├── \_global.css # CSS Custom Properties & Reset │
├── index.css # Homepage spezifisch │ ├── menu.css # Navigation System │ ├── cookies.css # Cookie
Banner Styles │ ├── footer.css # Footer Komponente │ ├── album.css # Galerie Styles │ └──
ubermich.css # About Page Styles ├── js/ │ ├── main-init.js # Zentrale Initialisierung │ ├──
docs/js/cookie-system.js # Cookie Consent Manager │ ├── menu.js # Navigation Controller │ ├──
scroll-dots.js # Scroll Navigation │ ├── templateLoader.js # Dynamic Content Loader │ ├──
intext.js # Content Animation System │ ├── performance-monitor.js # Performance Tracking │ └──
enhanced-error-handler.js # Error Management ├── docs/pages/ │ ├── komponente/ # Wiederverwendbare
Komponenten │ │ ├── menu.html # Navigation Template │ │ ├── footer.html # Footer Template │ │ ├──
cookie-banner.html # Cookie Banner │ │ └── ... │ └── ... # Weitere Seiten └── scripts/ # Build &
Development Scripts

````

## Module & Komponenten

### 1. Main Initialization (`main-init.js`)

**Zweck**: Zentrale Koordination aller Module

```javascript
*Hinweis: Auszug, nicht alle Dateien gelistet.*

### NPM-Skripte & Tools

| Befehl                  | Zweck / Beschreibung                                 |
|-------------------------|-----------------------------------------------------|
| `npm run dev`           | Lokaler Entwicklungsserver starten                  |
| `npm run build`         | (Kein Build nötig, statische Seite)                 |
| `npm run validate-html` | HTML-Validierung aller Seiten                       |
| `npm run validate-css`  | CSS-Validierung mit Stylelint                       |
| `npm run lint`          | Linting & Auto-Fix für JS mit ESLint                |
| `npm run format`        | Code-Formatierung mit Prettier                      |
| `npm run test`          | HTML- & CSS-Validierung (Kombi)                     |
| `npm run lighthouse`    | Performance-Test mit Lighthouse                     |
| `npm run compress-images` | Bilder optimieren (jpg/png)                        |
| `npm run purge`         | Unbenutztes CSS entfernen (PurgeCSS)                |
| `npm run security-audit`| Security Audit der Dependencies                     |
| `npm run security-check`| Security Header Check (lokal)                       |
| `npm run check-links`   | Link-Checker für lokale Seite                       |
| `npm run pre-deploy`    | Alle Checks & Optimierungen vor Deployment          |
| `./deploy.sh production`| Deployment-Skript                                   |

**Wichtige Tools:** ESLint, Prettier, Stylelint, PurgeCSS, Terser, Lighthouse, Audit-CI, Imagemin, Sharp, Linkinator
class MainInitializer {
  constructor() {
    this.initModules = [];
    this.isInitialized = false;
    this.moduleTimings = new Map();
  }

  registerModule(name, initFunction, options = {}) {
    // Registriert Module mit Prioritäten und Dependencies
  }

  async initialize() {
    // Führt Module in korrekter Reihenfolge aus
  }
}
````

**Verwendung**:

```javascript
window.onWebsiteReady(
  'ModuleName',
  async () => {
    // Initialisierungscode
  },
  { priority: 'high', dependencies: ['OtherModule'] }
);
```

### 2. Cookie System (`docs/js/cookie-system.js`)

**Features**:

- DSGVO/CCPA Compliance
- Granulare Cookie-Kategorien
- Google Analytics Integration
- Persistent Storage
- Event-basierte Updates

**API**:

```javascript
// Cookie Banner anzeigen
window.CookieBanner.show();

// Consent prüfen
if (window.CookieBanner.hasConsent('analytics')) {
  // Analytics Code
}

// Consent setzen
window.CookieBanner.setConsent('marketing', true);

// Debug Info
console.log(window.CookieBanner.debug());
```

### 3. Navigation System (`menu.js`)

**Features**:

- Responsive Mobile Menu
- Submenu Support
- ARIA Accessibility
- Theme Switcher Integration
- Search Functionality

**Struktur**:

```javascript
// Automatisches Laden bei DOMContentLoaded
// Menu wird aus /docs/pages/komponente/menu.html geladen
// Event Delegation für Performance
```

### 4. Performance Monitor (`performance-monitor-enhanced.js`)

**Metriken**:

- Core Web Vitals (LCP, FID, CLS)
- Custom Metrics (Template Load, Animation Duration)
- Memory Usage
- Network Performance

**API**:

```javascript
// Debug Helper (nur Development)
debugPerformance.summary(); // Aktuelle Performance-Übersicht
debugPerformance.metrics('LCP'); // Spezifische Metrik-Historie
debugPerformance.all(); // Alle gesammelten Metriken
```

### 5. Error Handler (`enhanced-error-handler.js`)

**Features**:

**Error Types**:

---

### Weitere Module & Utilities

#### `aria-live.js`

**Zweck:** Dynamische ARIA-Live-Regionen für Screenreader-Feedback (z.B. Formulare, Navigation).
**API:**

```javascript
window.ariaLive.announce('Nachricht', { politeness: 'polite' });
```

#### `form-enhancement.js`

**Zweck:** Verbesserte Formular-UX (z.B. Validierung, Auto-Focus, Fehleranzeigen). **API:**

```javascript
formEnhancer.initAll();
formEnhancer.validate(formElement);
```

#### `idb-min.js`

**Zweck:** Minimaler Wrapper für IndexedDB zur lokalen Datenspeicherung (z.B. Offline-Cache).
**API:**

```javascript
idb.set('key', value);
idb.get('key').then(val => ...);
```

#### `lazy-load.js`

**Zweck:** Lazy Loading für Bilder und andere Ressourcen mittels IntersectionObserver. **API:**

```javascript
lazyLoad.observeAll();
```

#### `share-dialog.js`

**Zweck:** Web Share API & Custom Share Dialog für Social Sharing. **API:**

```javascript
shareDialog.open({ url, title, text });
```

#### `i18n.js`

**Zweck:** Internationalisierung (i18n) und Übersetzungsfunktionen für mehrsprachige Inhalte.
**API:**

```javascript
i18n.t('key'); // Übersetzung holen
i18n.setLanguage('en');
```

## Styling System

### CSS Architecture

**Methodologie**: BEM-inspiriert mit Utility-First Elementen

```css
/* Global Variables (_global.css) */
:root {
  /* Farben */
  --color-bg: rgb(57 57 57);
  --color-accent: #3a85ff;

  /* Typography */
  --font-family-main: 'Poppins', sans-serif;
  --font-size-base: 1rem;

  /* Spacing mit clamp() */
  --spacing-sm: clamp(0.4rem, 1vw, 0.8rem);

  /* Transitions */
  --transition-speed: 0.35s;
  --transition-ease: cubic-bezier(0.4, 0, 0.2, 1);
}
```

### Responsive Design

**Breakpoints**:

- Mobile: < 600px
- Tablet: 600px - 1100px
- Desktop: > 1100px

**Mobile-First Approach**:

```css
/* Mobile Base Styles */
.element {
  font-size: 1rem;
}

/* Tablet */
@media (min-width: 600px) {
  .element {
    font-size: 1.1rem;
  }
}

/* Desktop */
@media (min-width: 1100px) {
  .element {
    font-size: 1.2rem;
  }
}
```

### Theme System

**Dark/Light Mode**:

```css
/* Automatic Theme Detection */
@media (prefers-color-scheme: dark) {
  :root {
    --color-bg: rgb(57 57 57);
    --color-text-main: #f5f5f5;
  }
}

/* Manual Theme Override */
html[data-theme='light'] {
  --color-bg: #f0f2f5;
  --color-text-main: #1c1e21;
}
```

## JavaScript Architecture

### Module Communication

**Event-Driven Architecture**:

```javascript
// Event Dispatch
document.dispatchEvent(
  new CustomEvent('sectionUpdate', {
    detail: { sectionId: 'section-hero' },
  })
);

// Event Listening
document.addEventListener('sectionUpdate', (event) => {
  const { sectionId } = event.detail;
  // Handle event
});
```

### Dynamic Content Loading

**Template System**:

```javascript
// Templates werden aus /docs/pages/index-card.html geladen
// IntersectionObserver für Lazy Loading
// Animation Queue für sequentielle Animationen
```

### State Management

**Local Storage**:

- Theme Preference
- Cookie Consent
- User Preferences

**Session Storage**:

- Temporary Form Data
- Navigation State

## Performance Optimierung

### Loading Strategies

1. **Critical CSS**: Inline im `<head>`
2. **Async JavaScript**: `defer` Attribute
3. **Lazy Loading**: Bilder mit IntersectionObserver
4. **Code Splitting**: Modulare JavaScript-Architektur

### Asset Optimization

```bash
# Bilder optimieren
npm run compress-images

# CSS purgen
npm run purge

# JavaScript minifizieren
```

### Caching Strategy

**Service Worker**:

- Network First: HTML, API Calls
- Cache First: CSS, JS, Fonts
- Stale While Revalidate: Images

### Performance Budget

| Metrik      | Ziel    | Max   |
| ----------- | ------- | ----- |
| FCP         | < 1.8s  | 2.5s  |
| LCP         | < 2.5s  | 4.0s  |
| CLS         | < 0.1   | 0.25  |
| TBT         | < 200ms | 300ms |
| Bundle Size | < 200KB | 300KB |

## Security Implementation

### Content Security Policy

```javascript
// Einheitliche CSP-Konfiguration (siehe .htaccess, _headers, index.html)
const CSP = {
  'default-src': ["'self'"],
  'script-src': ["'self'", 'https://cdn.jsdelivr.net', 'https://www.googletagmanager.com'],
  'style-src': [
    "'self'",
    'https://fonts.googleapis.com',
    'https://cdn.jsdelivr.net',
    'https://cdnjs.cloudflare.com',
  ],
  'img-src': ["'self'", 'data:', 'https:'],
  'font-src': [
    "'self'",
    'https://fonts.gstatic.com',
    'https://cdn.jsdelivr.net',
    'https://cdnjs.cloudflare.com',
  ],
  'connect-src': [
    "'self'",
    'https://www.google-analytics.com',
    'https://region1.google-analytics.com',
    'https://ipapi.co',
    'https://api.abdulkerimsesli.de',
  ],
  'frame-ancestors': ["'self'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
  'object-src': ["'none'"],
};
```

### Security Headers

```javascript
// Express Server Configuration (aktuelle Header)
app.use((req, res, next) => {
  res.set({
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'Content-Security-Policy':
      "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net https://www.googletagmanager.com; style-src 'self' https://fonts.googleapis.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; img-src 'self' data: https:; font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; connect-src 'self' https://www.google-analytics.com https://region1.google-analytics.com https://ipapi.co https://api.abdulkerimsesli.de; frame-ancestors 'self'; base-uri 'self'; form-action 'self'; object-src 'none'; base-uri 'self';",
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
    'X-XSS-Protection': '0',
    'X-Permitted-Cross-Domain-Policies': 'none',
    'Cross-Origin-Embedder-Policy': 'require-corp',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
  });
  next();
});
```

### Input Validation

```javascript
// Client-side Validation
function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

// Sanitization
function sanitizeInput(input) {
  return input.trim().replace(/[<>]/g, '');
}
```

## PWA Features

### Service Worker

**Lifecycle**:

1. Registration
2. Installation (Cache static docs)
3. Activation (Clean old caches)
4. Fetch (Implement cache strategies)

**Update Strategy**:

```javascript
// Skip waiting on user action
self.addEventListener('message', (event) => {
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
```

### App Manifest

```json
{
  "name": "Abdulkerim - Persönliche Website",
  "short_name": "Abdulkerim",
  "start_url": "/",
  "display": "standalone",
  "theme_color": "#393939",
  "background_color": "#393939",
  "icons": [
    {
      "src": "/img/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    }
  ]
}
```

### Offline Support

- Offline Page: `/docs/pages/komponente/offline.html`
- Cached docs: Core CSS/JS files
- Network-First für dynamische Inhalte

## Cookie Management

### Cookie Categories

1. **Necessary**: Session, CSRF, Theme
2. **Analytics**: Google Analytics
3. **Marketing**: (Prepared for future)
4. **Social**: (Prepared for future)

### Consent Flow

```
User Visit → Check Consent → Show Banner (if needed)
    ↓              ↓                    ↓
Analytics    Store Decision      User Interaction
    ↓              ↓                    ↓
GA Config    LocalStorage        Accept/Reject/Customize
```

### GDPR Compliance

- Explicit Consent Required
- Granular Control
- Easy Withdrawal
- Consent Expiry (1 year)
- No Pre-checked Boxes

## Build & Deployment

### Development Workflow

```bash
# 1. Development
npm run dev

# 2. Testing
npm test
npm run lighthouse

# 3. Build
npm run build

# 4. Deploy
./deploy.sh production
```

### CI/CD Pipeline

**GitHub Actions**:

1. Trigger: Push to `main`
2. Jobs:
   - Quality Assurance (HTML/CSS validation)
   - Security Scan
   - Lighthouse CI
   - Deployment (if all pass)

### Deployment Checklist

- [ ] Run all tests
- [ ] Check Lighthouse scores
- [ ] Validate Security Headers
- [ ] Test on multiple devices
- [ ] Verify SSL certificate
- [ ] Update sitemap.xml
- [ ] Check robots.txt
- [ ] Monitor error logs

## Troubleshooting

### Common Issues

**1. Service Worker nicht aktiv**

```javascript
// Lösung: Cache leeren und neu registrieren
navigator.serviceWorker.getRegistrations().then(function (registrations) {
  for (let registration of registrations) {
    registration.unregister();
  }
});
```

**2. Cookie Banner wird nicht angezeigt**

```javascript
// Debug-Modus aktivieren
window.CookieBanner.debug();
// Consent zurücksetzen
window.CookieBanner.reset();
```

**3. Performance-Probleme**

```javascript
// Performance-Daten analysieren
window.debugPerformance.summary();
// Speicher bereinigen
window.websiteErrorHandler.performMemoryCleanup();
```

**4. Menu reagiert nicht**

- Prüfe ob `/docs/pages/komponente/menu.html` geladen wurde
- Console auf Fehler prüfen
- Event Listener Status überprüfen

### Debug Mode

**Aktivierung**:

```javascript
// URL Parameter
?debug=true

// Oder in Console
localStorage.setItem('debug', 'true');
```

**Debug Features**:

- Erweiterte Console Logs
- Performance Timings
- Error Stack Traces
- Cookie System Debug Info

### Browser Compatibility

**Minimum Requirements**:

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

**Polyfills**:

- IntersectionObserver (für ältere Browser)
- Custom Elements (falls Web Components genutzt)

### Performance Debugging

```javascript
// Measure specific operations
performance.mark('myOperation-start');
// ... operation code ...
performance.mark('myOperation-end');
performance.measure('myOperation', 'myOperation-start', 'myOperation-end');

// Get measurements
const measures = performance.getEntriesByType('measure');
console.table(measures);
```

## Best Practices

### Code Style

1. **JavaScript**:
   - Use ES6+ features
   - Async/Await over Promises
   - Const > Let > Var

2. **CSS**:
   - Mobile-first
   - Use CSS Custom Properties
   - Avoid !important

3. **HTML**:
   - Semantic markup
   - ARIA labels where needed
   - Valid structure

### Git Workflow

```bash
# Feature Branch
git checkout -b feature/new-feature

# Commit with conventional commits
git commit -m "feat: add new gallery feature"
git commit -m "fix: resolve menu toggle issue"
git commit -m "docs: update README"

# Merge via PR
```

### Testing Strategy

1. **Unit Tests**: Individual functions
2. **Integration Tests**: Module interactions
3. **E2E Tests**: User flows
4. **Performance Tests**: Lighthouse CI
5. **Accessibility Tests**: aXe, WAVE

#### Beispiel: Einfacher Unit-Test (Jest)

```js
// sum.js
export function sum(a, b) {
  return a + b;
}

// sum.test.js
import { sum } from './sum';
test('addiert zwei Zahlen', () => {
  expect(sum(2, 3)).toBe(5);
});
```

_Hinweis: Für größere Projekte empfiehlt sich der Einsatz von Jest, Vitest oder Mocha für
automatisierte Tests. Integrationstests und E2E-Tests können mit Playwright oder Cypress umgesetzt
werden._

---

Letzte Aktualisierung: Juli 2025 Version: 1.0.0

```

```
