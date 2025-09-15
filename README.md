Update (Fonts): Inter wird lokal gehostet (`content/webentwicklung/fonts/`). Statische Gewichte wurden durch eine Variable Font (`InterVariable.woff2`) ersetzt. Preloads reduziert auf eine Datei. Optionaler Fallback `Inter-Regular.woff2`. Dadurch kann CSP vereinfacht auf `style-src 'self'; font-src 'self'` gesetzt werden.
### Fonts Workflow
Variable Font herunterladen (falls noch nicht vorhanden oder aktualisiert werden soll):
```bash
npm run fonts:inter
```
Dies lädt `InterVariable.woff2` und `Inter-Regular.woff2` nach `content/webentwicklung/fonts/` und legt/aktualisiert die OFL Lizenz `OFL.txt`.

Hinweis:
1. Script nur ausführen wenn Version aktualisiert werden soll
2. Anschließend Security Scan laufen lassen:
```bash
npm run security:scan
```
3. Änderungen committen (Font Dateien versionieren!)
4. CDN oder Caching: Fonts haben idealerweise lange Cache-Lifetime (immutable + hash möglich bei späterem Build-Setup)

`root.css` nutzt:
```css
@font-face {
	font-family: 'Inter';
	font-style: normal;
	font-weight: 100 900;
	font-display: swap;
	src: url('/content/webentwicklung/fonts/InterVariable.woff2') format('woff2-variations');
}
```
Fallback (nur falls benötigt):
```css
@font-face {
	font-family: 'InterFallback';
	font-weight: 400;
	font-style: normal;
	font-display: swap;
	src: url('/content/webentwicklung/fonts/Inter-Regular.woff2') format('woff2');
}
```
Empfehlung: In Komponenten `font-family: var(--font-inter);` beibehalten – keine Änderung nötig.
Fallback Strategie: Falls sehr alter Browser Variable Fonts nicht unterstützt, greift system stack bzw. optional `InterFallback` (nicht zwingend setzen um redundante Downloads zu vermeiden).
# Abdul aus Berlin - Portfolio Website

Ein modernes, performantes Portfolio von **Abdulkerim Sesli** - Webentwickler und Fotograf aus Berlin-Tegel.

## 🚀 Features

### 🎨 **Design & Animationen**
- **Glassmorphism Card Design** - Moderne Karten mit Backdrop-Filter und Shimmer-Effekten  
- **Snap-Scroll Animationen** - Smooth staggered entrance beim Scrollen
- **Performance Optimierung** - GPU-beschleunigte Animationen mit automatischer Qualitätsanpassung
- **Responsive Design** - Optimiert für alle Bildschirmgrößen

### ⚡ **Performance & Technologie** 
- **ES6 Module Architecture** - Modulare Struktur ohne Build-Tools
- **Intersection Observer** - Optimierte Scroll-Animationen
- **CSS Custom Properties** - Zentrale Design-Token in `root.css`
- **Lazy Loading** - Dynamisches Laden von HTML-Sektionen
- **Resource Hints** - DNS-Prefetch, Preconnect, Modulepreload für optimale Performance

### 🔍 **SEO & Accessibility**
- **Schema.org Markup** - Umfassendes strukturiertes JSON-LD
- **Open Graph Tags** - Optimiert für Social Media Sharing
- **Progressive Web App** - Manifest mit Shortcuts und Icons
- **ARIA Live Regions** - Screen Reader Announcements
- **Security Headers** - XSS-Protection, Content-Type-Options

### 🏗️ **Architektur**

```
iweb-1/
├── content/webentwicklung/     # Core Web Components  
│   ├── main.js                 # App Entry Point + Section Loader + Global Init
│   ├── animations/
│   │   ├── enhanced-animation-engine.js  # Data-Attribut gesteuerte Engine
│   │   ├── snap-scroll-animations.js     # Karten + Header Scroll Animations (IO)
│   │   └── card-animation-utils.js       # Gemeinsame Karten Stagger Utilities
│   ├── root.css               # Design System Tokens
│   ├── utils/                 # Shared Utilities (Logger, Common Utils)
│   ├── menu/                  # Navigation System
│   ├── footer/                # Footer Components  
│   └── particles/             # Canvas Particle System
├── pages/                     # Section Components
│   ├── home/                  # Hero + TypeWriter
│   ├── card/                  # Feature Cards with Rotation System
│   └── about/                 # About Section
└── content/img/               # Assets & Icons
```

### 🎯 **Core Components**

#### **Section Loader** (`main.js`)
```javascript
// Lazy-loading via data-section-src attribute
<section data-section-src="/pages/about/about.html">
```

##### Section Loader Advanced Features (Prefetch, CustomEvents, Retry)

Seit Erweiterung (2025-09) verfügt der Section Loader über:

1. Prefetching: Ein zweiter IntersectionObserver mit `rootMargin: 600px` lädt den HTML-Inhalt vor, bevor die Section sichtbar wird. Der Inhalt landet im internen `PREFETCH_CACHE` (kein doppelter Netzwerktrafik beim späteren Rendern).
2. Einheitliche CustomEvents: Erlauben lose Kopplung zwischen Modulen.
3. User-Retry bei Fehlern: Automatisch eingefügter Button (Klasse `.section-retry`) ermöglicht erneutes Laden ohne Seitenreload.

Events (alle via `document.addEventListener` abonnierbar):
```
section:will-load   detail: { id, section, url }
section:prefetched  detail: { id, section, url }
section:loaded      detail: { id, section, state: 'loaded' }
section:error       detail: { id, section, state: 'error' }
```
Beispiel:
```js
document.addEventListener('section:prefetched', e => {
	console.debug('[Prefetched]', e.detail.id, e.detail.url);
});

document.addEventListener('section:loaded', e => {
	if (e.detail.id === 'about') {
		import('/pages/about/about.js').catch(console.warn);
	}
});
```

Retry API (optional manuell nutzbar):
```js
const s = document.getElementById('about');
window.SectionLoader.retry(s);
```

Fehler-UI Styling Klassen (falls überschreiben gewünscht):
```
.section-error-box {}
.section-retry {}
```

Hinweis: Prefetch greift nur für nicht mit `data-eager` markierte Sections.

#### **Snap-Scroll Animations** (`animations/snap-scroll-animations.js`)  
```javascript
// Intersection Observer (threshold 0.3)
// Staggered Card Entrance (Utility: animateContainerStagger)
// Debounced rescan() (120ms) bei dynamisch hinzugefügten Sektionen
```

#### **Feature Rotation System** (`karten-rotation.js`)
```javascript
// Template-basierte Content Rotation
// 5 Feature Templates mit smooth Transitions
// Animation Engine Integration
```

#### **Card Animation Utilities** (`card-animation-utils.js`)
```javascript
animateContainerStagger(container, {
	selector: '.card', stagger: 150, duration: 600,
	initialTranslate: 30, scaleFrom: 0.9
});
```

#### **Section Loader Retry**
Einmaliger Retry bei transienten Fetch-Fehlern (5xx oder offline) mit kleinem Backoff.

#### **Custom Events Übersicht**
Alle Eventnamen sind zentral in `utils/events.js` (Konstante `EVENTS`) definiert:
```javascript
import { EVENTS, fire, on } from './utils/events.js';

fire(EVENTS.HERO_LOADED);
const unsubscribe = on(EVENTS.HERO_TYPING_END, e => console.log(e.detail));
```

Aktuell definierte Events (Auszug):
`hero:loaded`, `hero:typingEnd`, `featuresTemplatesLoaded`, `featuresTemplatesError`, `template:mounted`, `features:change`, `snapSectionChange`, `cards:animated`, `section:loaded`

Damit werden Tippfehler vermieden und Autocomplete verbessert.

#### **Dynamisches Logging**
Log-Level via URL Parameter `?log=debug` oder `localStorage.LOG_LEVEL` steuerbar (`error|warn|info|debug`). Erlaubt gezieltes Debugging ohne Codeänderung.

## 🛠️ **Development**

### **Setup**
```bash
npm install
python3 -m http.server 8000  # Development Server
```

### **Linting & Validation**
```bash
npm run lint:js        # ESLint für JavaScript
npm run lint:html      # HTML-Validierung 
npm run check:css      # CSS Token Konsolidierung
```

### **Code-Konventionen**
- **ES6 Modules** mit expliziten Imports
- **Logger pro Modul** mit `createLogger()`
- **Error Handling** mit graceful degradation
- **Performance First** - Caching, Throttling, RequestAnimationFrame

## 📊 **Performance Metrics**

- **JavaScript Bundle**: ~131KB total (modular geladen)
- **CSS Bundle**: ~77KB total (critical path optimiert)
- **No Build Step** - Native ES6 Module Support
- **Lighthouse Score**: 90+ (Performance, Accessibility, SEO)

## 🌐 **Browser Support**

- **Modern ES6+ Features** - Chrome 91+, Firefox 89+, Safari 15+
- **Graceful Degradation** - Fallbacks für ältere Browser
- **Progressive Enhancement** - Basis-Funktionalität ohne JavaScript

## 🔧 **Deployment**

### **Production Optimierungen**
- ✅ Security Headers konfiguriert
- ✅ Resource Hints für CDN-Performance
- ✅ Manifest.json für PWA-Installation
- ✅ Robots.txt für SEO-Crawling
- ✅ Sitemap.xml mit Image-Referenzen

### 🔐 Security & Content Security Policy (CSP)

Diese Anwendung lädt Skripte und Module ausschließlich von der eigenen Origin. Für maximale Sicherheit sollten folgende HTTP Header serverseitig (nicht via `<meta>`) gesetzt werden:

Empfohlene Security Header:

```
Content-Security-Policy: \
	default-src 'self'; \
	script-src 'self'; \
	style-src 'self'; \
	font-src 'self' data:; \
	img-src 'self' data: blob:; \
	connect-src 'self' https://api.github.com; \
	frame-ancestors 'none'; \
	base-uri 'self'; \
	form-action 'self'; \
	object-src 'none'; \
	upgrade-insecure-requests; \
	frame-src 'none';
Referrer-Policy: strict-origin-when-cross-origin
X-Content-Type-Options: nosniff
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Resource-Policy: same-origin
Permissions-Policy: geolocation=(), microphone=(), camera=()
```

Hinweise:
* Inline Event-Handler (z.B. `onload=`) wurden entfernt – damit ist `'unsafe-inline'` nicht nötig.
* Externer FontAwesome Import wurde entfernt (`menu.css` Kommentar). Ersetze Icons zukünftig durch Inline-SVG oder lokales Sprite.
* Fonts bereits vollständig self-hosted: keine externen Font/Style Domains nötig.
* JSON-LD Skripte bleiben erlaubt, da `script-src 'self'` und keine Inline-Eventhandler genutzt werden.

Optionale Report-Only Einführungsphase:
```
Content-Security-Policy-Report-Only: default-src 'self'; report-to csp-endpoint;
Report-To: {"group":"csp-endpoint","max_age":10886400,"endpoints":[{"url":"https://example.com/csp-report"}]}
```

Nginx Beispiel:
```
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self' data:; img-src 'self' data: blob:; connect-src 'self' https://api.github.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'; upgrade-insecure-requests;" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
```

Apache (.htaccess):
```
<IfModule mod_headers.c>
	Header set Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self' data:; img-src 'self' data: blob:; connect-src 'self' https://api.github.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'; upgrade-insecure-requests;"
	Header set Referrer-Policy "strict-origin-when-cross-origin"
	Header set X-Content-Type-Options "nosniff"
	Header set Permissions-Policy "geolocation=(), microphone=(), camera=()"
</IfModule>
```

Vercel / Netlify (headers Datei):
```
/*
	Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self' data:; img-src 'self' data: blob:; connect-src 'self' https://api.github.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'; upgrade-insecure-requests;
	Referrer-Policy: strict-origin-when-cross-origin
	X-Content-Type-Options: nosniff
	Permissions-Policy: geolocation=(), microphone=(), camera=()
```

Weitere Härtung (optional):
* Strict-Transport-Security: `max-age=63072000; includeSubDomains; preload`
* Entferne oder verschleiere `Server` Header
* Trusted Types bei komplexeren DOM-Sanitization Anforderungen

TODO: Icons vollständig auf Inline-SVG migrieren.
\
Update (Icons): FontAwesome wurde durch ein minimales Inline SVG Sprite (im `index.html`) ersetzt. Navigation nutzt jetzt `<svg class="nav-icon"><use href="#icon-*"></use></svg>` und ist damit vollständig CSP-konform ohne externe style/font Quellen.
\
<!-- entfernt: duplizierter Font Update Hinweis -->

### Strikte CSP (nach Font Self-Hosting)
```
Content-Security-Policy: \
	default-src 'self'; \
	script-src 'self'; \
	style-src 'self'; \
	font-src 'self' data:; \
	img-src 'self' data: blob:; \
	connect-src 'self' https://api.github.com; \
	frame-ancestors 'none'; \
	base-uri 'self'; \
	form-action 'self'; \
	object-src 'none'; \
	upgrade-insecure-requests
```

Optional Trusted Types Vorbereitung (erst aktivieren wenn geprüft):
```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data: blob:; connect-src 'self' https://api.github.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'; require-trusted-types-for 'script'; trusted-types default; upgrade-insecure-requests
```

### **DNS & CDN Setup**
```dns
# Empfohlene DNS Prefetch Domains:
# (Nicht mehr nötig nach Self-Hosting der Fonts)
; none
```

## 🔍 Automatisierte Security-Prüfung

Ein Skript `scripts/security-scan.js` prüft den Codebestand auf unsichere oder verbotene Patterns.

Aktuell geprüfte Punkte:
| Kategorie | Beschreibung | Ergebnis bei Fund |
|-----------|--------------|-------------------|
| Inline Event Handler | Attribute wie `onclick=` | Build schlägt fehl |
| Verbotene Meta Security Header | `<meta http-equiv="Content-Security-Policy">` etc. | Build schlägt fehl |
| Externe CDN Referenzen | fonts.googleapis.com, cdnjs, jsdelivr, unpkg | Build schlägt fehl |
| Inline `<script>` Blöcke | Nicht leere Skripte ohne `src` (außer JSON-LD) | Build schlägt fehl |
| `@import` in CSS | Externe CSS-Ladekette | Build schlägt fehl |
| `eval(` Aufrufe | Dynamische Codeausführung | Build schlägt fehl |
| Inline `style=""` Attribute | Style Attribut im Markup | Warnung (kein Fail) |

| Fehlende Assets | Link/Script/Img verweist auf nicht existierende Datei | Build schlägt fehl |

JSON Ausgabe (für CI Analyse):
```bash
npm run security:scan -- --json > security-report.json
```
Ergebnis enthält `summary.violations`, `summary.hardViolations`.

## 🛡️ Server Security Header Deployment
Vorlagen:
- `security/security-headers.conf` (Nginx Include)
- `security/_headers` (Netlify/Vercel kompatibel)

## 🧪 CSP Reporting Endpoint (optional)
```
Report-To: {"group":"csp-endpoint","max_age":10886400,"endpoints":[{"url":"https://report.example.com/csp"}]}
Content-Security-Policy-Report-Only: default-src 'self'; report-to csp-endpoint
```
Nach Stabilisierung wieder entfernen.

## 🔐 Trusted Types (geplant)
Aktuell keine riskanten DOM-Injektionen. Aktivierung später möglich:
`require-trusted-types-for 'script'; trusted-types default;`

## 🌩 Service Worker
`sw.js` implementiert:
- Precache Kern (HTML/CSS/JS Basis)
- Cache-First Fonts
- Stale-While-Revalidate Bilder & Core Assets
Registrierung in `main.js` (nach window load). Deaktivierbar via DevTools > Application > Unregister.

## 🎯 Critical CSS (optional)
Noch nicht inline extrahiert. Erst nach Messung (Lighthouse FCP/LCP). Ansatz:
- `critical.css` → inline im `<head>`
- restliche Styles lazily nachladen

## 🔤 Fonts Workflow
Aktueller Abruf:
```bash
npm run fonts:inter
```
Lädt `InterVariable.woff2` & Fallback, Lizenz in `OFL.txt`. Subsetting optional (Tool: glyphhanger / pyftsubset) – noch kein Build-Step integriert.

Kommando lokal ausführen:
```bash
npm run security:scan
```

CI Integration: Workflow `.github/workflows/security-scan.yml` bricht bei Verstößen ab und kommentiert bei Pull Requests.

Erweiterung: Neue Regeln können im Skript durch zusätzliche Regex-Prüfungen ergänzt werden (`patterns`). Für Ausnahmen (bewusst erlaubt) kann künftig eine Whitelist-Logik ergänzt werden (noch nicht nötig, da Projekt Clean Code anstrebt).

Ziel: Garantie, dass CSP ohne `'unsafe-inline'` oder externe Domains dauerhaft stabil bleibt.

## 👨‍💻 **Entwickler**

**Abdulkerim Sesli** - Abdul aus Berlin/Tegel  
- 🌐 **Website**: [abdulkerimsesli.de](https://abdulkerimsesli.de)
- 📧 **E-Mail**: hello@abdulkerimsesli.de
- 💼 **GitHub**: [@aKs030](https://github.com/aKs030)

---

## 📝 **Lizenz**

© 2025 Abdulkerim Sesli. Alle Rechte vorbehalten.

**Built with ❤️ in Berlin-Tegel**

---

## ♻️ Änderungen & Wartung (Cleanup Log)

### Entfernte / Konsolidierte Module
- `particle-config.js` wurde entfernt (Datei ist nun leer) – frühere konfigurierbare Partikelparameter waren ungenutzt und führten zu totem Code. Das Partikelsystem nutzt aktuell feste Logik in `particle-system.js`. Bei künftigem Bedarf kann eine neue, fokussierte Config-Lösung reintroduziert werden.
- Doppelter `typewriterConfig` Export eliminiert – einzig gültige Konfiguration liegt jetzt in `pages/home/hero-data.js` und wird dynamisch von `TypeWriter.js` geladen.
- Unbenutzte Exporte (`HeroAPI`, `getHeroConfig`, Default-Exports einiger Utility-Module) entfernt um Tree-Shaking-/Lesbarkeitspotenzial zu erhöhen.

### Motion / Accessibility Vereinheitlichung
- Animation-System vereinfacht: Alle Animationen verwenden jetzt standardisierte Performance-Modi ohne komplexe Motion-Preference-Abfragen
- Einheitliche Animation-Verarbeitung durch das Enhanced Animation Engine System ohne separate Motion-Detection

### Standard Performance Mode
- Alle Animationen verwenden jetzt den Standard-Performance-Modus für konsistente Benutzerfreundlichkeit
- Vereinfachte Animation-Pipeline ohne separate reduced-motion Pfade

### Rationale
Diese Bereinigungen reduzieren:
- kognitiven Overhead (weniger unklare Exporte)
- potentiellen Wartungsaufwand bei späteren Refactors
- Risiko verwaister APIs nach zukünftigen Feature-Änderungen.

Wenn du historische Implementierungen rekonstruieren willst, kannst du frühere Commits vor dem Cleanup durchsuchen (Git Log nach *particle-config*).
