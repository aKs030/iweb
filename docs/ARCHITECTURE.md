# Architektur-Übersicht

## Component Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Browser / DOM                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Web Components Layer                       │
├─────────────────────────────────────────────────────────────┤
│  <site-menu>          <site-footer>      <robot-companion>  │
│  ├─ SiteMenu.js       ├─ footer.js      ├─ Web Component   │
│  └─ Modules:          └─ Analytics      └─ Wrapper          │
│     ├─ MenuState                                             │
│     ├─ MenuRenderer                                          │
│     ├─ MenuEvents                                            │
│     └─ MenuAccessibility                                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Business Logic Layer                       │
├─────────────────────────────────────────────────────────────┤
│  RobotCompanion Class                                        │
│  ├─ RobotAnimation      (Visual effects)                    │
│  ├─ RobotChat           (Chat interface)                    │
│  ├─ RobotCollision      (Collision detection)               │
│  ├─ RobotIntelligence   (AI logic)                          │
│  └─ RobotGames          (Mini-games)                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Core Services                           │
├─────────────────────────────────────────────────────────────┤
│  ├─ logger.js           (Logging)                           │
│  ├─ signals.js          (Reactive primitives)               │
│  ├─ ui-store.js         (Shared UI state)                   │
│  ├─ theme-state.js      (Theme preference state)            │
│  ├─ load-manager.js     (Reactive loading state)            │
│  ├─ idle.js             (Idle scheduling helper)            │
│  ├─ runtime-env.js      (Runtime env detection)             │
│  ├─ sw-registration.js  (SW + online/offline lifecycle)    │
│  ├─ events.js           (Lifecycle/interop events)          │
│  ├─ cache.js            (Caching)                           │
│  ├─ fetch.js            (HTTP)                              │
│  ├─ utils.js            (DOM helpers)                       │
│  ├─ url-utils.js        (Shared URL normalization)          │
│  ├─ resource-hints-matrix.js (Route hint budgets)           │
│  ├─ schema-page-types.js (SEO route metadata)               │
│  ├─ schema-shared.js    (Schema shared helpers)             │
│  ├─ schema-media.js     (Schema media extraction)           │
│  ├─ content-extractors.js (Shared DOM extraction)           │
│  ├─ accessibility-manager.js (A11y)                         │
│  └─ types.js            (Type definitions)                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   External Services                          │
├─────────────────────────────────────────────────────────────┤
│  ├─ AIAgentService      (Workers AI, SSE, Tools, Memory)    │
│  ├─ Analytics           (Google Analytics)                  │
│  └─ LocalStorage        (Browser storage)                   │
└─────────────────────────────────────────────────────────────┘
```

## State Strategy

- Dauerhafter UI- und App-Zustand wird bevorzugt über Signals modelliert (`signals.js`, `ui-store.js`, `load-manager.js`).
- Theme-Präferenz und resultierendes Light/Dark-Theme werden ebenfalls signal-basiert geführt (`theme-state.js`) und bei expliziter Auswahl persistent gespeichert.
- Footer-Readiness und Footer-Expansion werden reaktiv über `footer-state.js` modelliert, statt über DOM-Custom-Events.
- Suche trennt jetzt UI und Datenpfad: `MenuSearch.js` steuert Interaktion/Rendering, `MenuSearchStore.js` hält Query-, Loading- und Result-State reaktiv.
- Route-/Intent-basiertes Speculative Loading wird über `resource-hints-matrix.js` budgetiert, damit Prefetch/Prerender je nach Bereich, Gerät und Netzwerk begrenzt bleiben.
- Idle-/Deferred-Work wird über `idle.js` vereinheitlicht, damit Timeout-Fallback und Cleanup nicht mehr pro Modul auseinanderlaufen.
- Service-Worker-Registrierung und Online/Offline-UI liegen in `sw-registration.js`, nicht mehr im App-Bootstrap.
- Strukturierte Daten bleiben über `schema.js` erreichbar, die Seitentyp-Metadaten, Shared-Text-Helfer, DOM-Content-Extractor und Medien-Extraktion leben aber getrennt in `schema-page-types.js`, `schema-shared.js`, `content-extractors.js` und `schema-media.js`.
- Lokale Host-/Dev-Erkennung wird zentral über `runtime-env.js` geführt statt pro Modul separat.
- Interne Link-Sanitization und kompakte URL-Darstellung laufen zentral über `url-utils.js` statt über lokale `new URL(...)`-Helfer.
- DOM-Events bleiben für einmalige Lifecycle-Hooks und lose Kopplung an browsernahe Integrationspunkte bestehen.
- Vendor- und interne Module werden über die zentrale Import-Map in `content/templates/base-head.html` als Bare Imports bzw. Aliase (`#core`, `#components`, `#config`, `#pages`) bereitgestellt; die Map wird per `scripts/sync-import-map.mjs` aus den Paketversionen synchronisiert.
- `npm run smoke:browser` deckt die neuen Pfade für Theme-Persistenz, Loader-Hide, Menu/Search/Robot, Footer-Hydration und BFCache in einem echten Chromium-Lauf ab.

## Type System Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    content/core/types.js                     │
│                  (Central Type Definitions)                  │
├─────────────────────────────────────────────────────────────┤
│  • ComponentConfig      • RobotState                         │
│  • MenuState            • RobotAnalytics                     │
│  • DOMCache             • PageContext                        │
│  • EventListenerRegistry • RobotMood                         │
│  • TimerRegistry        • ChatOption                         │
│  • KnowledgeBase        • SectionData                        │
└─────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
        ┌───────────────────┐   ┌───────────────────┐
        │   Components      │   │   Core Services   │
        ├───────────────────┤   ├───────────────────┤
        │ @ts-check         │   │ @ts-check         │
        │ import types      │   │ import types      │
        │ JSDoc annotations │   │ JSDoc annotations │
        └───────────────────┘   └───────────────────┘
                    │                   │
                    └─────────┬─────────┘
                              ▼
                    ┌───────────────────┐
                    │   VS Code         │
                    │   IntelliSense    │
                    │   Type Checking   │
                    └───────────────────┘
```

## Component Lifecycle

### Web Component Lifecycle

_New helpers_: Scroll/hash behaviour has been moved to shared utilities (`core/utils.js`) to avoid duplication across
`main.js`, menu logic and view-transitions. The footer element now exposes a small public API
(`open()`, `close()`) and companion helpers (`openFooter()`, `closeFooter()`) so other modules can
control it without event gymnastics.

### Web Component Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│                    Component Creation                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │   constructor()   │
                    │   - Initialize    │
                    │   - Set defaults  │
                    └───────────────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │ connectedCallback │
                    │   - Load data     │
                    │   - Render DOM    │
                    │   - Bind events   │
                    └───────────────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │   Active State    │
                    │   - Handle events │
                    │   - Update state  │
                    │   - Re-render     │
                    └───────────────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │disconnectedCallback│
                    │   - Cleanup       │
                    │   - Remove events │
                    │   - Clear timers  │
                    └───────────────────┘
```

## Data Flow

### Robot Companion Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                         User Input                           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │  RobotChat        │
                    │  - Validate       │
                    │  - Sanitize       │
                    └───────────────────┘
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
        ┌───────────────────┐   ┌───────────────────┐
        │ KnowledgeBase     │   │ AIAgentService    │
        │ (Local)           │   │ (AI + SSE)        │
        └───────────────────┘   └───────────────────┘
                    │                   │
                    └─────────┬─────────┘
                              ▼
                    ┌───────────────────┐
                    │ RobotIntelligence │
                    │ - Process         │
                    │ - Context         │
                    └───────────────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │  RobotChat        │
                    │  - Format         │
                    │  - Display        │
                    └───────────────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │  RobotAnalytics   │
                    │  - Track          │
                    │  - Store          │
                    └───────────────────┘
```

## Module Dependencies

```
RobotCompanion
├── AIAgentService (AI)
├── RobotGames (Games)
├── RobotAnimation (Visual)
│   └── DOM manipulation
├── RobotCollision (Physics)
│   └── IntersectionObserver
├── RobotChat (UI)
│   ├── DOM manipulation
│   ├── Event handling
│   └── Message formatting
└── RobotIntelligence (Logic)
    ├── Context detection
    ├── Response generation
    └── Knowledge base

Core Services (Shared)
├── logger.js
├── signals.js
├── ui-store.js
├── theme-state.js
├── load-manager.js
├── events.js
├── cache.js
├── fetch.js
├── utils.js
├── accessibility-manager.js
├── three-earth-manager.js
├── model-loader.js (Draco & Meshopt)
└── types.js
```

## File Structure

```
content/
├── components/
│   ├── footer/
│   │   ├── footer.js              (Web Component v3.0.0)
│   │   └── footer.css
│   ├── menu/
│   │   ├── SiteMenu.js            (Web Component)
│   │   ├── menu.css
│   │   └── modules/
│   │       ├── MenuState.js
│   │       ├── MenuRenderer.js
│   │       ├── MenuEvents.js
│   │       └── MenuAccessibility.js
│   └── robot-companion/
│       ├── robot-companion.js                    (Orchestrator)
│       ├── robot-companion-texts.js
│       ├── robot-companion.css
│       ├── README.md
│       ├── ai-agent-service.js
│       ├── robot-games.js
│       ├── runtime/
│       │   ├── robot-layout.js                  (Footer/viewport layout)
│       │   ├── robot-hydration.js               (Progressive hydration)
│       │   └── robot-page-context.js            (Context + morphing)
│       └── modules/
│           ├── robot-animation.js
│           ├── robot-chat.js
│           ├── robot-collision.js
│           ├── robot-intelligence.js
│           └── chat-history-store.js
├── core/
│   ├── types.js                   ⭐ EXTENDED (27 types)
│   ├── logger.js
│   ├── signals.js                 ⭐ NEW (reactive primitives)
│   ├── ui-store.js                ⭐ NEW (shared UI state)
│   ├── theme-state.js             ⭐ NEW (reactive theme state)
│   ├── load-manager.js            ⭐ UPDATED (signals + events bridge)
│   ├── events.js
│   ├── cache.js
│   ├── fetch.js
│   ├── utils.js
│   ├── accessibility-manager.js
│   ├── three-earth-manager.js
│   ├── idle.js                   ⭐ NEW (shared idle scheduler)
│   ├── url-utils.js              ⭐ NEW (shared URL helpers)
│   ├── content-extractors.js     ⭐ NEW (shared DOM content extraction)
│   └── model-loader.js            ⭐ NEW (Draco & Meshopt)
└── main.js

docs/
├── MODERNIZATION.md               ⭐ NEW
└── ARCHITECTURE.md                ⭐ NEW (this file)

MODERNIZATION_SUMMARY.md           ⭐ NEW
```

## Type Safety Strategy

### JSDoc + @ts-check

```javascript
// @ts-check at top of file enables type checking

/**
 * Function with typed parameters and return
 * @param {string} text - Message text
 * @param {'user'|'bot'} type - Message type
 * @returns {void}
 */
function addMessage(text, type) {
  // VS Code will warn if wrong types are passed
}

/**
 * Using imported types
 * @param {import('#core/types.js').PageContext} context
 */
function trackSection(context) {
  // Type-safe with central definitions
}

/**
 * Complex object types
 * @type {import('#core/types.js').RobotAnalytics}
 */
const analytics = {
  sessions: 0,
  sectionsVisited: [],
  interactions: 0,
  lastVisit: new Date().toISOString(),
};
```

## Event System

Signals tragen langlebigen Zustandsfluss. Custom Events bleiben für einmalige
Lifecycle-Hooks und externe Integrationen bestehen.

```
┌─────────────────────────────────────────────────────────────┐
│                      Custom Events                           │
├─────────────────────────────────────────────────────────────┤
│  Component Events:                                           │
│  • menu:loaded          (SiteMenu ready)                     │
│  • robot:loaded         (RobotCompanion ready)               │
│  • robot:error          (RobotCompanion error)               │
│  • section:loaded       (Section loaded)                     │
│                                                              │
│  Core Events (EVENTS constant):                              │
│  • DOM_READY            (DOM ready)                          │
│  • CORE_INITIALIZED     (Core initialized)                   │
│  • MODULES_READY        (Modules ready)                      │
│  • HERO_LOADED          (Hero section loaded)                │
└─────────────────────────────────────────────────────────────┘
```

`content/core/load-manager.js` exposes `whenAppReady(...)` plus `loadSignals`/`subscribeLoadState(...)` for app readiness and loader progress inside the signal graph. New modules should not depend on removed loader DOM events.

## Performance Considerations

### Lazy Loading Strategy

```
Initial Load (Critical)
├── Core services
├── Main.js
└── SiteMenu (above fold)

Deferred Load (Non-critical)
├── SiteFooter (on scroll)
├── RobotCompanion (delayed 5s)
└── Section content (intersection observer)

On-Demand Load
├── AIAgentService (when chat opens)
├── RobotGames (when activated)
└── Analytics (after consent)
```

### Memory Management

```
Web Component Lifecycle
├── connectedCallback
│   ├── Create instances
│   ├── Bind events
│   └── Start timers
└── disconnectedCallback
    ├── Destroy instances
    ├── Remove events
    └── Clear timers

Automatic Cleanup
├── EventListenerRegistry
│   └── Tracks all listeners
├── TimerRegistry
│   └── Tracks timeouts/intervals
└── IntersectionObserver
    └── Disconnects on destroy
```

## Best Practices

### 1. Component Creation

```javascript
// ✅ Good - Web Component with types
// @ts-check
export class MyComponent extends HTMLElement {
  constructor() {
    super();
    /** @type {import('#core/types.js').ComponentConfig} */
    this.config = {};
  }

  connectedCallback() {
    this.init();
  }

  disconnectedCallback() {
    this.cleanup();
  }
}

customElements.define('my-component', MyComponent);
```

### 2. Type Annotations

```javascript
// ✅ Good - Full type safety
/**
 * @param {string} id - Element ID
 * @returns {HTMLElement|null}
 */
function getElement(id) {
  return document.getElementById(id);
}

// ❌ Bad - No types
function getElement(id) {
  return document.getElementById(id);
}
```

### 3. Module Organization

```javascript
// ✅ Good - Clear separation
export class MyModule {
  constructor(parent) {
    this.parent = parent;
  }

  init() {
    /* ... */
  }
  destroy() {
    /* ... */
  }
}

// ❌ Bad - Mixed concerns
export class MyModule {
  constructor() {
    this.init(); // Too early!
    this.render(); // Side effects in constructor
  }
}
```

## Migration Path

### Phase 1: Type Safety (✅ Complete)

- Add JSDoc to all components
- Create central type definitions
- Enable @ts-check

### Phase 2: Web Components (✅ Complete)

- Convert UI components to Web Components
- Implement lifecycle methods
- Add custom events

### Phase 3: Testing (✅ Complete)

- Unit tests for components (38/38 Passing)
- Test runner integration (Vitest)

### Phase 4: Optimization (✅ Complete)

- Bundle optimization (Code splitting, Minification)
- Performance monitoring (Core Web Vitals)
- Build Standardization (Vite)
