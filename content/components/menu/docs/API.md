# Menu System API Reference

## MenuController

Main orchestrator for the menu system.

### Constructor

```javascript
new MenuController(config?: object)
```

### Methods

#### `async init()`

Initialize the menu system.

```javascript
const controller = new MenuController();
await controller.init();
```

#### `destroy()`

Cleanup and destroy the menu system.

```javascript
controller.destroy();
```

#### `getStats()`

Get current statistics.

```javascript
const stats = controller.getStats();
// {
//   initialized: true,
//   state: { isOpen: false, title: 'Home', subtitle: '' },
//   cache: { elements: 5, computed: 2, total: 7 },
//   device: { isMobile: false, isTouch: false, ... }
// }
```

### Properties

- `state: MenuState` - State manager
- `renderer: MenuRenderer` - DOM renderer
- `events: MenuEvents` - Event handler
- `accessibility: MenuAccessibility` - A11y manager
- `performance: MenuPerformance` - Performance utilities
- `cache: MenuCache` - Cache system
- `config: object` - Configuration

---

## MenuState

State management with event system.

### Properties

- `isOpen: boolean` - Menu open state
- `activeLink: string` - Currently active link
- `currentTitle: string` - Current title
- `currentSubtitle: string` - Current subtitle

### Methods

#### `setOpen(value: boolean)`

Set menu open state.

```javascript
state.setOpen(true); // Open menu
state.setOpen(false); // Close menu
```

#### `setTitle(title: string, subtitle?: string)`

Set menu title and subtitle.

```javascript
state.setTitle('Home', 'Welcome');
```

#### `setActiveLink(link: string)`

Set active navigation link.

```javascript
state.setActiveLink('/about/');
```

#### `on(event: string, callback: function)`

Subscribe to state changes.

```javascript
state.on('openChange', (isOpen) => {
  console.log('Menu is', isOpen ? 'open' : 'closed');
});
```

#### `off(event: string, callback: function)`

Unsubscribe from state changes.

```javascript
const handler = (isOpen) => console.log(isOpen);
state.on('openChange', handler);
state.off('openChange', handler);
```

#### `emit(event: string, data: any)`

Emit custom event.

```javascript
state.emit('customEvent', { data: 'value' });
```

#### `reset()`

Reset state to defaults.

```javascript
state.reset();
```

### Events

| Event              | Payload             | Description         |
| ------------------ | ------------------- | ------------------- |
| `openChange`       | `boolean`           | Menu opened/closed  |
| `titleChange`      | `{title, subtitle}` | Title changed       |
| `activeLinkChange` | `string`            | Active link changed |

---

## MenuTheme

Theme management system.

### Constructor

```javascript
new MenuTheme(config?: object)
```

### Methods

#### `register(name: string, variables: object)`

Register a new theme.

```javascript
theme.register('custom', {
  '--dynamic-menu-header-bg': 'rgba(255, 0, 0, 0.9)',
  '--dynamic-menu-accent-blue': '#00ff00',
});
```

#### `apply(themeName: string): boolean`

Apply a theme.

```javascript
theme.apply('dark');
theme.apply('light');
theme.apply('custom');
```

#### `get(themeName: string): object`

Get theme variables.

```javascript
const darkTheme = theme.get('dark');
```

#### `getCurrent(): string`

Get current theme name.

```javascript
const current = theme.getCurrent(); // 'dark'
```

#### `getAll(): string[]`

Get all theme names.

```javascript
const themes = theme.getAll(); // ['default', 'light', 'dark', 'colorful']
```

#### `remove(themeName: string)`

Remove a theme.

```javascript
theme.remove('custom');
```

#### `detectSystemTheme(): string`

Detect system theme preference.

```javascript
const systemTheme = theme.detectSystemTheme(); // 'dark' or 'light'
```

#### `applySystemTheme()`

Apply system theme.

```javascript
theme.applySystemTheme();
```

#### `watchSystemTheme()`

Watch for system theme changes.

```javascript
theme.watchSystemTheme();
```

### Built-in Themes

- `default` - Current dark theme
- `light` - Light theme
- `dark` - Enhanced dark theme
- `colorful` - Gradient theme

---

## MenuKeyboard

Keyboard shortcuts manager.

### Constructor

```javascript
new MenuKeyboard(state: MenuState, config?: object)
```

### Methods

#### `init()`

Initialize keyboard shortcuts.

```javascript
keyboard.init();
```

#### `register(keys: string | string[], callback: function)`

Register keyboard shortcut.

```javascript
keyboard.register('Alt+n', () => {
  console.log('Alt+N pressed');
});

keyboard.register(['Meta+s', 'Control+s'], () => {
  console.log('Save shortcut');
});
```

#### `unregister(keys: string | string[])`

Unregister keyboard shortcut.

```javascript
keyboard.unregister('Alt+n');
```

#### `enable()`

Enable keyboard shortcuts.

```javascript
keyboard.enable();
```

#### `disable()`

Disable keyboard shortcuts.

```javascript
keyboard.disable();
```

#### `destroy()`

Cleanup keyboard shortcuts.

```javascript
keyboard.destroy();
```

### Default Shortcuts

| Shortcut       | Action      |
| -------------- | ----------- |
| `Cmd/Ctrl + M` | Toggle menu |
| `Escape`       | Close menu  |
| `Cmd/Ctrl + K` | Open search |

---

## MenuPersistence

State persistence to localStorage.

### Constructor

```javascript
new MenuPersistence(state: MenuState, config?: object)
```

### Methods

#### `init()`

Initialize persistence.

```javascript
persistence.init();
```

#### `save()`

Save current state.

```javascript
persistence.save();
```

#### `restore()`

Restore saved state.

```javascript
persistence.restore();
```

#### `clear()`

Clear saved state.

```javascript
persistence.clear();
```

#### `isStorageAvailable(): boolean`

Check if localStorage is available.

```javascript
if (persistence.isStorageAvailable()) {
  persistence.init();
}
```

---

## MenuAnalytics

Analytics integration.

### Constructor

```javascript
new MenuAnalytics(state: MenuState, config?: object)
```

### Methods

#### `init()`

Initialize analytics tracking.

```javascript
analytics.init();
```

#### `trackEvent(eventName: string, data: object)`

Track custom event.

```javascript
analytics.trackEvent('custom_action', {
  category: 'menu',
  value: 123,
});
```

#### `trackTiming(category: string, variable: string, time: number)`

Track timing.

```javascript
analytics.trackTiming('menu', 'init_time', 45);
```

### Supported Platforms

- Google Analytics 4 (gtag)
- Matomo (\_paq)
- Custom analytics (window.analytics)

---

## MenuPerformance

Performance utilities.

### Methods

#### `debounce(fn: function, delay: number): function`

Create debounced function.

```javascript
const debouncedFn = perf.debounce(() => {
  console.log('Debounced');
}, 300);
```

#### `throttle(fn: function, limit: number): function`

Create throttled function.

```javascript
const throttledFn = perf.throttle(() => {
  console.log('Throttled');
}, 100);
```

#### `animate(callback: function): number`

Request animation frame.

```javascript
perf.animate(() => {
  // Animation code
});
```

#### `startMeasure(name: string)`

Start performance measurement.

```javascript
perf.startMeasure('operation');
```

#### `endMeasure(name: string): number`

End measurement and get duration.

```javascript
const duration = perf.endMeasure('operation');
console.log(`Took ${duration}ms`);
```

#### `getDeviceCapabilities(): object`

Get device information.

```javascript
const caps = perf.getDeviceCapabilities();
// {
//   isMobile: false,
//   isTouch: false,
//   hasHover: true,
//   connection: '4g',
//   memory: 8,
//   cores: 8
// }
```

#### `prefersReducedMotion(): boolean`

Check if user prefers reduced motion.

```javascript
if (perf.prefersReducedMotion()) {
  // Disable animations
}
```

---

## MenuCache

Caching system.

### Methods

#### `setElement(key: string, element: HTMLElement)`

Cache DOM element.

```javascript
cache.setElement('header', headerEl);
```

#### `getElement(key: string): HTMLElement`

Get cached element.

```javascript
const header = cache.getElement('header');
```

#### `setComputed(key: string, value: any, ttl?: number)`

Cache computed value with TTL.

```javascript
cache.setComputed('width', 1200, 5000); // 5s TTL
```

#### `getComputed(key: string): any`

Get cached computed value.

```javascript
const width = cache.getComputed('width');
```

#### `getOrCompute(key: string, computeFn: function, ttl?: number): any`

Get cached or compute new value.

```javascript
const value = cache.getOrCompute(
  'expensive',
  () => {
    return expensiveCalculation();
  },
  10000,
);
```

#### `invalidate(key: string)`

Invalidate cache entry.

```javascript
cache.invalidate('width');
```

#### `clear()`

Clear all cache.

```javascript
cache.clear();
```

#### `getStats(): object`

Get cache statistics.

```javascript
const stats = cache.getStats();
// { elements: 5, computed: 2, total: 7 }
```

---

## MenuConfig

Configuration object.

### Default Configuration

```javascript
{
  CSS_URL: '/content/components/menu/menu.css',
  ANIMATION_DURATION: 400,
  DEBOUNCE_DELAY: 150,
  OBSERVER_TIMEOUT: 3000,
  MOBILE_BREAKPOINT: 768,
  TABLET_BREAKPOINT: 900,
  ENABLE_ANALYTICS: false,
  ENABLE_PERSISTENCE: false,
  ENABLE_DEBUG: false,
  TITLE_MAP: { ... },
  FALLBACK_TITLES: { ... },
  MENU_ITEMS: [ ... ],
  MAX_LOG_ENTRIES: 20,
  ICON_CHECK_DELAY: 100,
  TITLE_TRANSITION_DELAY: 200,
}
```

### Usage

```javascript
import { createConfig } from './modules/MenuConfig.js';

const config = createConfig({
  ENABLE_ANALYTICS: true,
  ENABLE_DEBUG: true,
  ANIMATION_DURATION: 300,
});
```

---

## Global API

### window.menuController

Global controller instance.

```javascript
window.menuController.state.setOpen(true);
window.menuController.getStats();
```

### window.menuCleanup()

Cleanup function.

```javascript
window.menuCleanup();
```

---

## TypeScript Support

```typescript
import type {
  MenuController,
  MenuState,
  MenuTheme,
  MenuConfig,
} from './modules/index.js';

const controller: MenuController = new MenuController();
const state: MenuState = controller.state;
```
