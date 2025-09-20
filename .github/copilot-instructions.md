# Copilot Instructions für iweb Portfolio

## Projekt-Architektur

Diese ist eine modulare, performante deutsche Portfolio-Website mit dynamischem Komponentensystem. Die Architektur basiert auf ES6 Modulen ohne Build-Tools und nutzt moderne Web APIs für Animationen und Interaktionen.

## Kernkomponenten & Datenflussmuster

### 1. Section Loader System (`/content/webentwicklung/main.js`)
- **Pattern**: Lazy-loading von HTML-Abschnitten via `data-section-src` Attribut
- **Integration**: Sections werden automatisch geladen wenn `SectionLoader.scan()` aufgerufen wird
- **Beispiel**: `<section data-section-src="/pages/home/hero.html" data-eager="true">`

### 2. Enhanced Animation Engine (`/content/webentwicklung/animations/`)
- **Pattern**: Data-attribute-gesteuerte Animationen mit IntersectionObserver
- **Konfiguration**: 
  - `data-animation="slideInLeft"` - Animationstyp
  - `data-delay="300"` - Verzögerung in ms
  - `data-duration="0.6"` - Dauer in s oder ms
  - `data-once` - Einmalige Animation
  - `data-reset="false"` - Überschreibt globales repeatOnScroll
- **Deaktivierung**: `data-animations="off"` am Vorfahren-Element
- **API**: `window.enhancedAnimationEngine.scan()` nach DOM-Änderungen

### 3. Feature Rotation System (`/pages/card/karten-rotation.js`)
- **Pattern**: Template-basierte Inhalts-Rotation mit Intersection-Observer
- **Templates**: Werden aus `/pages/card/karten.html` geladen und im DOM gecacht
- **Konfiguration**: `data-features-src`, `data-anim-in`, `data-anim-out` am Section-Element
- **Event**: `featuresTemplatesLoaded` wenn Templates verfügbar sind

### 4. Particle System (`/content/webentwicklung/particles/`)
- **Pattern**: Canvas-basierte Partikel mit data-attribute Konfiguration
- **Config**: `data-particle-*` Attribute am `.global-particle-background` Element
- **Performance**: Automatische Qualitätsanpassung

## Code-Konventionen

### Module-Struktur
```javascript
// Immer zuerst utilities, dann spezifische Module
import { getElementById, throttle } from '../utils/common-utils.js';
import { createLogger } from '../utils/logger.js';

// Logger pro Modul mit eindeutigem Namen
const log = createLogger('moduleName');
```

### Error Handling & Accessibility
- **Fail-safe Pattern**: `try/catch` mit graceful degradation
- **Accessibility**: ARIA live regions für Announcements via `window.announce()`

### DOM Manipulation
- **Caching**: `getElementById()` mit integriertem Caching nutzen
- **Performance**: `WeakSet` für bereits verarbeitete Elemente
- **Batch Updates**: `requestAnimationFrame` für DOM-Änderungen

## Build & Deployment

### npm Scripts
- `npm run lint:js` - ESLint für JavaScript
- `npm run lint:html` - HTML-Validation aller Git-tracked HTML-Dateien
- `npm run check:css` - CSS Custom Properties Konsolidierung prüfen
- `npm run consolidate:css` - CSS Tokens nach root.css verschieben

### GitHub Workflows
- **HTML Validation**: Automatische Validierung bei PR/Push
- **CSS Consolidation**: Prüft ob CSS Custom Properties außerhalb von `root.css` existieren
- **ESLint**: Code Quality checks

### Critical Patterns

#### Performance Optimierung
- Module verwenden `TimerManager` für cleanup
- Canvas-Operationen mit `DPR` (Device Pixel Ratio) skalieren  
- Intersection Observer mit optimierten Thresholds

#### CSS Custom Properties
- **Zentral**: Alle Custom Properties in `/content/webentwicklung/root.css`
- **Validation**: Script überprüft ausgelagerte Properties automatisch

#### Template Loading
```javascript
// Standard Pattern für dynamische Inhalte
async function loadTemplate(url) {
  const res = await fetch(url, { credentials: 'same-origin' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.text();
}
```

## Wichtige Dateipfade

- **Root CSS**: `/content/webentwicklung/root.css` - Alle CSS Custom Properties
- **Main Entry**: `/content/webentwicklung/main.js` - App-Initialisierung
- **Utils**: `/content/webentwicklung/utils/` - Geteilte Funktionen
- **Components**: `/content/webentwicklung/[component]/` - Komponentenlogik
- **Pages**: `/pages/[section]/` - Section-spezifische Assets

## Debugging

### Logger System
```javascript
import { createLogger, setGlobalLogLevel } from './utils/logger.js';
setGlobalLogLevel('debug'); // 'error', 'warn', 'info', 'debug'
const log = createLogger('componentName');
log.debug('Debug message', { data });
```

### Animation Debug
- `data-animations="off"` zum Deaktivieren von Animationen
- Browser DevTools Animation Panel für CSS-Animation debugging
- `window.enhancedAnimationEngine` API für programmatische Kontrolle

## Browser Support

- **ES6 Modules**: Native ES Module Support erforderlich
- **Modern APIs**: IntersectionObserver, MutationObserver, Canvas 2D
- **Fallbacks**: Graceful degradation bei fehlender API-Unterstützung