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
│  ├─ events.js           (Event bus)                         │
│  ├─ cache.js            (Caching)                           │
│  ├─ fetch.js            (HTTP)                              │
│  ├─ dom-utils.js        (DOM helpers)                       │
│  ├─ accessibility-manager.js (A11y)                         │
│  └─ types.js            (Type definitions)                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   External Services                          │
├─────────────────────────────────────────────────────────────┤
│  ├─ AIService           (Groq AI)                           │
│  ├─ Analytics           (Google Analytics)                  │
│  └─ LocalStorage        (Browser storage)                   │
└─────────────────────────────────────────────────────────────┘
```

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
        │ KnowledgeBase     │   │ AIService         │
        │ (Local)           │   │ (AI)              │
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
├── AIService (AI)
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
├── events.js
├── cache.js
├── fetch.js
├── dom-utils.js
├── accessibility-manager.js
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
│       ├── robot-companion.js                    (Core Class)
│       ├── robot-companion-web-component.js      (Web Component) ⭐ NEW
│       ├── robot-companion-texts.js
│       ├── robot-companion.css
│       ├── README.md                             ⭐ NEW
│       ├── example-usage.html                    ⭐ NEW
│       ├── ai-service.js
│       ├── robot-games.js
│       └── modules/
│           ├── robot-animation.js
│           ├── robot-chat.js
│           ├── robot-collision.js
│           └── robot-intelligence.js
├── core/
│   ├── types.js                   ⭐ EXTENDED (27 types)
│   ├── logger.js
│   ├── events.js
│   ├── cache.js
│   ├── fetch.js
│   ├── dom-utils.js
│   └── accessibility-manager.js
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
 * @param {import('/content/core/types.js').PageContext} context
 */
function trackSection(context) {
  // Type-safe with central definitions
}

/**
 * Complex object types
 * @type {import('/content/core/types.js').RobotAnalytics}
 */
const analytics = {
  sessions: 0,
  sectionsVisited: [],
  interactions: 0,
  lastVisit: new Date().toISOString(),
};
```

## Event System

```
┌─────────────────────────────────────────────────────────────┐
│                      Custom Events                           │
├─────────────────────────────────────────────────────────────┤
│  Component Events:                                           │
│  • menu:loaded          (SiteMenu ready)                     │
│  • footer:loaded        (SiteFooter ready)                   │
│  • robot:loaded         (RobotCompanion ready)               │
│  • robot:error          (RobotCompanion error)               │
│  • section:loaded       (Section loaded)                     │
│                                                              │
│  Core Events (EVENTS constant):                              │
│  • DOM_READY            (DOM ready)                          │
│  • CORE_INITIALIZED     (Core initialized)                   │
│  • MODULES_READY        (Modules ready)                      │
│  • HERO_LOADED          (Hero section loaded)                │
│  • LOADING_UNBLOCKED    (Loading complete)                   │
└─────────────────────────────────────────────────────────────┘
```

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
├── AIService (when chat opens)
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
    /** @type {import('/content/core/types.js').ComponentConfig} */
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
