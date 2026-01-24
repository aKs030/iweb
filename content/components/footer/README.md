# Modern Footer App System

## 📦 Architektur

Das Footer-System ist als modulare, objektorientierte App mit ES2024-Features aufgebaut.

### Komponenten

```
FooterApp.js (Haupt-App)
├── DOMCache          - Intelligentes DOM-Caching
├── ScrollManager     - Scroll-State-Management
├── GlobalCloseHandler - Event-Management mit AbortController
├── AnalyticsManager  - Google Analytics Integration
├── ConsentBannerManager - Cookie-Banner
├── CookieSettingsManager - Cookie-Einstellungen
├── FooterManager     - Footer-State-Management
├── ScrollHandler     - Intersection Observer für Auto-Expand
└── FooterLoader      - Haupt-Controller
```

## 🚀 Features

### Modern JavaScript (ES2024)

- ✅ Private Class Fields (`#property`)
- ✅ Optional Chaining (`?.`)
- ✅ Nullish Coalescing (`??`)
- ✅ AbortController für Event-Cleanup
- ✅ Modern Array Methods
- ✅ Class-based Architecture

### Performance

- ✅ Intelligentes DOM-Caching mit `isConnected`
- ✅ AbortController für automatisches Event-Cleanup
- ✅ Debounced Resize-Handler
- ✅ IntersectionObserver für Scroll-Detection
- ✅ RequestAnimationFrame für Animationen

### Accessibility

- ✅ ARIA-Attribute
- ✅ Keyboard-Navigation
- ✅ Focus-Trapping
- ✅ Screen-Reader-Announcements
- ✅ Inert-Attribute für versteckte Elemente

## 📖 Verwendung

### Basis-Integration

```javascript
import { initFooter } from '/content/components/footer/FooterApp.js';

// Footer initialisieren
await initFooter();
```

### HTML-Container

```html
<div
  id="footer-container"
  data-footer-src="/content/components/footer/footer.html"
></div>
```

## 🎨 Styling

Das Footer-System verwendet moderne CSS-Features:

- CSS Nesting
- View Transitions API
- Scroll-Driven Animations
- Container Queries (vorbereitet)
- Modern Color Functions

## 🔧 Konfiguration

```javascript
const CONFIG = {
  SCROLL_MARK_DURATION: 1000, // Scroll-Lock-Dauer
  RESIZE_DEBOUNCE: 120, // Resize-Debounce
  EXPAND_LOCK_MS: 800, // Expand-Lock
  COLLAPSE_DEBOUNCE_MS: 200, // Collapse-Debounce
  FOOTER_HTML_PATH: '/content/components/footer/footer.html',
};
```

## 📊 State Management

### Footer States

- `minimized` - Kompakte Ansicht (Standard)
- `expanded` - Erweiterte Ansicht mit Karten
- `cookie-settings` - Cookie-Einstellungen-Overlay

### Cookie States

- `accepted` - Alle Cookies akzeptiert
- `rejected` - Nur notwendige Cookies
- `null` - Noch keine Entscheidung

## 🎯 Events

### Dispatched Events

```javascript
// Footer geladen
document.addEventListener('footer:loaded', (e) => {
  console.log('Footer loaded at', e.detail.timestamp);
});

// 3D Showcase
document.addEventListener('three-earth:showcase', (e) => {
  console.log('Showcase duration:', e.detail.duration);
});
```

## 🧪 Testing

```javascript
// Footer-Instanz testen
const loader = new FooterLoader();
await loader.init();

// Scroll-Handler testen
globalThis.footerScrollHandler.toggleExpansion(true);

// Cookie-Settings öffnen
// Klick auf [data-cookie-trigger] Element
```

## 🔄 Migration von v2.0

Die alte `footer-app.js` ist jetzt ein Wrapper:

```javascript
// Alt (funktioniert weiterhin)
import { initFooter } from './footer-app.js';

// Neu (empfohlen)
import { initFooter } from './FooterApp.js';
```

## 📝 Best Practices

### 1. Event-Cleanup

```javascript
// ✅ Gut - AbortController
const controller = new AbortController();
element.addEventListener('click', handler, { signal: controller.signal });
controller.abort(); // Cleanup

// ❌ Schlecht - Manuelles Cleanup
element.addEventListener('click', handler);
element.removeEventListener('click', handler);
```

### 2. DOM-Caching

```javascript
// ✅ Gut - Cached
const element = dom.get('#my-element');

// ❌ Schlecht - Jedes Mal neu
const element = document.querySelector('#my-element');
```

### 3. Private Fields

```javascript
// ✅ Gut - Private
class MyClass {
  #privateField = 'secret';
}

// ❌ Schlecht - Public
class MyClass {
  _privateField = 'secret'; // Convention, aber nicht privat
}
```

## 🐛 Debugging

```javascript
// Logger aktivieren
localStorage.setItem('iweb-debug', 'true');

// Footer-State prüfen
console.log(globalThis.footerScrollHandler);

// DOM-Cache prüfen
console.log(dom.cache);
```

## 📦 Bundle Size

- **FooterApp.js**: ~15KB (minified)
- **footer.css**: ~12KB (minified)
- **Total**: ~27KB

## 🌐 Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 15+
- Mobile Browsers (iOS 15+, Android Chrome 90+)

### Progressive Enhancement

- View Transitions API (Chrome 111+)
- Scroll-Driven Animations (Chrome 115+)
- CSS Nesting (Chrome 112+)

## 📄 License

© 2025 Abdulkerim Sesli
