# Copilot Instructions für iweb Portfolio

Deutsches Portfolio-Projekt mit ES6 Modulen, Zero-Build-Tooling und modernen Web APIs.

## Architektur-Prinzipien

**No Build Tools**: Native ES6 Modules, keine Transpiler/Bundler. Import-Pfade müssen `.js` Extension haben.

**German First**: Code-Kommentare, UI-Texte und Commit-Messages auf Deutsch. Variable/Funktion-Namen auf Englisch.

**Shared Utilities Pattern**: Alle Module importieren von `/content/webentwicklung/shared-utilities.js` statt eigener Utils (Oktober 2025 Refactoring eliminierte separates `/utils` Verzeichnis).

## Kritische Datenflüsse

### Section Loading Lifecycle (`main.js`)

```javascript
<section data-section-src="/pages/about/about.html" data-eager="true">
// → SectionLoader lädt HTML via fetch
// → Prefetch-Observer (rootMargin: 600px) cached Inhalt vorher
// → Events: section:will-load → section:prefetched → section:loaded
// → Bei Fehler: Automatischer Retry-Button via .section-retry
// → Nach load: Lazy-loaded Module via createLazyLoadObserver()
```

**Warum wichtig**: Sections laden asynchron. Komponenten-JavaScript muss auf `section:loaded` Event warten oder im `MAP` Array in `main.js` registriert werden.

### Animation System (`animations/enhanced-animation-engine.js`)

```javascript
// Data-Attribute API (declarative):
<div data-animation="slideInLeft" data-delay="300" data-duration="0.6" data-once>

// Nach DOM-Updates IMMER rescan triggern:
window.enhancedAnimationEngine.scan();
// oder via shared utility:
scheduleAnimationScan();
```

**Performance**: System nutzt IntersectionObserver mit device-spezifischen Thresholds (Mobile: 0.1, Desktop: 0.25). Animationen mit `data-once` werden via `WeakSet` getrackt.

### Three.js Earth System (`particles/three-earth-system.js`)

```javascript
// LOD-basiertes Textur-Loading:
// - LOD 1: Alle 4 Texturen (day/night/bump/normal)
// - LOD 2: Nur day + normal
// - LOD 3: Nur day
// - Fallback: Prozedurales Material

// Texturen in /content/img/earth/textures/
// earth_day.jpg (463KB), earth_night.jpg (255KB)
```

**Cleanup-Pattern**: Nutzt `shared-particle-system.js` für Cross-System Koordination. `TimerManager` für automatisches Cleanup bei unmount.

### Feature Rotation (`pages/card/karten-rotation.js`)

Templates aus `/pages/card/karten.html` werden fetch'd und DOM-gecacht. Intersection Observer mit cooldown (500ms) verhindert Animation-Spam. Templates rotieren via `shuffle()` aus shared-utilities.

## Code-Konventionen

### Shared Utilities Import (ZWINGEND)

```javascript
import {
  createLogger,
  getElementById,
  TimerManager,
  EVENTS,
  fire,
  on,
  throttle,
  debounce,
} from "./shared-utilities.js";

const log = createLogger("moduleName"); // Einheitliches Logging
```

**Warum**: 95% Reduktion von duplizierten Utils (Dez 2025). Alte `utils/` Directory wurde komplett entfernt.

### Event System

```javascript
// Zentrale Events via shared-utilities EVENTS Konstante:
fire(EVENTS.SECTION_LOADED, { id: "about" });
on(EVENTS.FEATURES_TEMPLATES_LOADED, handler);

// Custom Events für loose coupling:
document.addEventListener("section:loaded", (e) => {
  if (e.detail.id === "hero") initHero();
});
```

### Timer & Cleanup Pattern

```javascript
const timers = new TimerManager();
timers.setTimeout(() => {}, 500);
timers.setInterval(() => {}, 1000);

// Auto-cleanup bei Component unmount:
function cleanup() {
  timers.clearAll();
  observer?.disconnect();
}
```

### DOM Access mit Caching

```javascript
// getElementById() aus shared-utilities cached automatisch (Map mit 20 Slots):
const hero = getElementById("hero");
// NICHT: document.getElementById() direkt verwenden
```

### CSS Custom Properties

**ALLE** Custom Properties MÜSSEN in `/content/webentwicklung/root.css` definiert sein:

```bash
npm run check:css  # Validierung (CI-Check)
npm run consolidate:css  # Auto-Migration zu root.css
```

**Ausnahme**: `/content/webentwicklung/menu/dynamic-menu-tokens.css` (Menu-System-spezifische Tokens).

## Development Workflows

### Testing & Validation

```bash
npm run lint:js        # ESLint mit Auto-Fix
npm run lint:html      # HTML-Validate auf Git-tracked Files
npm run check:css      # CSS Consolidation Check
```

**CI Pipeline** (`.github/workflows/html-validation.yml`): Alle 3 Checks + Artifact Upload bei Failure (7-Tage Retention).

### Debugging

```javascript
// Logger Level via URL oder localStorage:
?debug=true
localStorage.setItem("iweb-debug", "true");
setGlobalLogLevel("debug");
```

**Animation Debug**: `data-animations="off"` am Parent deaktiviert alle Child-Animationen. `window.enhancedAnimationEngine` API für programmatische Kontrolle.

### Performance Profiling

Three.js LOD-System loggt Texture-Loading. Performance-Detection via:

```javascript
const isMobile = window.matchMedia("(max-width: 768px)").matches;
// System passt Thresholds/Quality automatisch an
```

## Häufige Patterns

### Neues Module erstellen

```javascript
import {
  createLogger,
  getElementById,
  TimerManager,
} from "./shared-utilities.js";

const log = createLogger("myModule");
const timers = new TimerManager();

export function init() {
  log.info("Initializing module");
  const container = getElementById("myContainer");
  if (!container) {
    log.warn("Container not found");
    return cleanup;
  }
  // ... module logic
  return cleanup;
}

function cleanup() {
  timers.clearAll();
  log.debug("Cleanup complete");
}
```

### Dynamic Content mit Animation

```javascript
async function loadContent(url) {
  const res = await fetch(url, { credentials: "same-origin" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();

  container.innerHTML = html;
  scheduleAnimationScan(); // WICHTIG: Rescan nach DOM-Änderung
}
```

### IntersectionObserver Setup

```javascript
import { createLazyLoadObserver } from "./shared-utilities.js";

const observer = createLazyLoadObserver(
  (element) => {
    log.debug("Element visible:", element.id);
    // lazy load logic
  },
  { threshold: 0.25, rootMargin: "50px" }
);

observer.observe(targetElement);
```

## Projektstruktur

```
content/webentwicklung/     # Core Components & Systems
  main.js                   # Entry Point + SectionLoader + Global Init
  shared-utilities.js       # ZENTRALE Utils (createLogger, TimerManager, Events)
  root.css                  # ALLE CSS Custom Properties
  animations/               # Enhanced Animation Engine + Theme System
  particles/                # Three.js Earth + Shared Particle System
  TypeWriter/               # TypeWriter Component
  footer/, menu/            # Layout Components

pages/                      # Section-spezifische Components
  home/, card/, about/      # Section HTML + JS + CSS
  components/               # Wiederverwendbare Section-Komponenten

scripts/                    # Build/Validation Scripts
  check-css-consolidation.js
  validate-html.js
```

## Browser Support & Fallbacks

**Minimum**: ES6 Modules, IntersectionObserver, MutationObserver, Canvas 2D

**Graceful Degradation**: Try/Catch um alle Feature-Detections. Bei fehlenden APIs: Direkt laden statt lazy loading.

**Three.js**: Automatischer Fallback zu prozeduralem Material wenn Texturen nicht laden (2s Timeout pro Texture).

## VSCode Integration

Terminal auto-approval für npm Scripts aktiviert (`.vscode/settings.json`). Multi-AI Support (Cline/Claude, Copilot/GPT-4, GitLens). Format-on-Save mit Prettier für HTML/CSS/JSON.
