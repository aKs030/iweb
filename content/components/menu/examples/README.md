# Menu System - Usage Examples

Praktische Beispiele für die Verwendung des neuen Menu Systems.

## Basic Usage

```javascript
import { initializeMenu } from './menu.js';

// Auto-initialisiert beim Laden
// Oder manuell:
await initializeMenu();
```

## Advanced Usage

### 1. State-Updates abonnieren

```javascript
import { MenuController } from './modules/MenuController.js';

const controller = new MenuController();
await controller.init();

// Menu öffnen/schließen tracken
controller.state.on('openChange', (isOpen) => {
  console.log('Menu is now:', isOpen ? 'open' : 'closed');
});

// Titel-Änderungen tracken
controller.state.on('titleChange', ({ title, subtitle }) => {
  console.log('Title changed to:', title, subtitle);
});
```

### 2. Programmatisches Steuern

```javascript
// Menu öffnen
controller.state.setOpen(true);

// Menu schließen
controller.state.setOpen(false);

// Titel ändern
controller.state.setTitle('Neuer Titel', 'Mit Untertitel');
```

### 3. Analytics Integration

```javascript
controller.state.on('openChange', (isOpen) => {
  // Google Analytics
  if (window.gtag) {
    window.gtag('event', 'menu_interaction', {
      action: isOpen ? 'open' : 'close'
    });
  }
  
  // Matomo
  if (window._paq) {
    window._paq.push(['trackEvent', 'Menu', isOpen ? 'Open' : 'Close']);
  }
});
```

### 4. LocalStorage Synchronisation

```javascript
// State speichern
controller.state.on('openChange', (isOpen) => {
  localStorage.setItem('menuState', JSON.stringify({ isOpen }));
});

// State laden
try {
  const saved = JSON.parse(localStorage.getItem('menuState'));
  if (saved?.isOpen) {
    controller.state.setOpen(true);
  }
} catch (e) {
  console.warn('Could not restore menu state:', e);
}
```

### 5. Keyboard Shortcuts

```javascript
// Cmd/Ctrl + M zum Öffnen/Schließen
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'm') {
    e.preventDefault();
    controller.state.setOpen(!controller.state.isOpen);
  }
});
```

### 6. Custom Animations

```javascript
controller.state.on('openChange', (isOpen) => {
  if (isOpen) {
    // Blur Hintergrund
    document.body.style.filter = 'blur(2px)';
    document.body.style.transition = 'filter 0.3s ease';
  } else {
    document.body.style.filter = 'none';
  }
});
```

### 7. Debug Mode

```javascript
import { enableDebugMode } from './examples/advanced-usage.js';

const controller = await enableDebugMode();

// In der Console:
window.menuDebug.open();
window.menuDebug.close();
window.menuDebug.setTitle('Test', 'Subtitle');
```

### 8. All-in-One mit Features

```javascript
import { initWithFeatures } from './examples/advanced-usage.js';

const controller = await initWithFeatures({
  analytics: true,           // Google Analytics Integration
  persistState: true,        // LocalStorage Sync
  keyboardShortcuts: true,   // Cmd/Ctrl + M
  debug: true,               // Debug Mode
});
```

## Verfügbare Events

| Event | Payload | Beschreibung |
|-------|---------|--------------|
| `openChange` | `boolean` | Menu wurde geöffnet/geschlossen |
| `titleChange` | `{ title, subtitle }` | Titel wurde geändert |
| `activeLinkChange` | `string` | Aktiver Link wurde geändert |

## State Properties

```javascript
controller.state.isOpen          // boolean
controller.state.activeLink      // string
controller.state.currentTitle    // string
controller.state.currentSubtitle // string
```

## Methods

```javascript
// State setzen
controller.state.setOpen(boolean)
controller.state.setTitle(title, subtitle)
controller.state.setActiveLink(link)

// Events
controller.state.on(event, callback)
controller.state.off(event, callback)
controller.state.emit(event, data)

// Cleanup
controller.destroy()
```

## Best Practices

### 1. Immer cleanup durchführen

```javascript
// Bei SPA Navigation
window.addEventListener('beforeunload', () => {
  controller.destroy();
});
```

### 2. Event Listener entfernen

```javascript
const handler = (isOpen) => console.log(isOpen);

// Registrieren
controller.state.on('openChange', handler);

// Entfernen
controller.state.off('openChange', handler);
```

### 3. Error Handling

```javascript
try {
  const controller = new MenuController();
  await controller.init();
} catch (error) {
  console.error('Menu initialization failed:', error);
  // Fallback UI anzeigen
}
```

### 4. Performance

```javascript
// Debounce bei häufigen Updates
let timeoutId;
controller.state.on('titleChange', ({ title }) => {
  clearTimeout(timeoutId);
  timeoutId = setTimeout(() => {
    // Expensive operation
    updateMetaTags(title);
  }, 300);
});
```

## TypeScript Support

```typescript
import { MenuController } from './modules/MenuController.js';
import type { MenuState } from './modules/MenuState.js';

const controller: MenuController = new MenuController();
await controller.init();

controller.state.on('openChange', (isOpen: boolean) => {
  console.log(isOpen);
});
```

## Testing

```javascript
import { MenuController } from './modules/MenuController.js';

describe('Menu System', () => {
  let controller;

  beforeEach(async () => {
    controller = new MenuController();
    await controller.init();
  });

  afterEach(() => {
    controller.destroy();
  });

  it('should open menu', () => {
    controller.state.setOpen(true);
    expect(controller.state.isOpen).toBe(true);
  });

  it('should emit events', (done) => {
    controller.state.on('openChange', (isOpen) => {
      expect(isOpen).toBe(true);
      done();
    });
    controller.state.setOpen(true);
  });
});
```

## Weitere Beispiele

Siehe `advanced-usage.js` für vollständige Implementierungen aller Beispiele.
