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

### **DNS & CDN Setup**
```dns
# Empfohlene DNS Prefetch Domains:
fonts.googleapis.com
fonts.gstatic.com
```

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
