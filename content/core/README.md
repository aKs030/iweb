# Core Utilities

This directory contains core utility modules used throughout the application.

## Event Utilities (`event-utils.js`)

Helper functions for adding event listeners with proper passive handling to improve scroll performance.

### Usage Examples

#### Single Event Listener

```javascript
import { addPassiveListener } from '/content/core/event-utils.js';

// Automatically adds passive: true for touch/scroll events
const cleanup = addPassiveListener(element, 'touchstart', (e) => {
  console.log('Touch started');
});

// Call cleanup when done
cleanup();
```

#### Multiple Event Listeners

```javascript
import { addPassiveListeners } from '/content/core/event-utils.js';

const cleanup = addPassiveListeners(
  element,
  ['touchstart', 'touchmove', 'touchend'],
  handleTouch,
);

// Cleanup all listeners at once
cleanup();
```

#### Check Passive Support

```javascript
import { supportsPassive } from '/content/core/event-utils.js';

if (supportsPassive()) {
  console.log('Browser supports passive event listeners');
}
```

### Why Use Passive Listeners?

Passive event listeners improve scroll performance by telling the browser that the event handler won't call `preventDefault()`. This allows the browser to start scrolling immediately without waiting for JavaScript.

**Events that default to passive:**

- `touchstart`
- `touchmove`
- `touchend`
- `touchcancel`
- `wheel`
- `mousewheel`

### When NOT to Use Passive

If you need to call `preventDefault()` in your handler, explicitly set `passive: false`:

```javascript
addPassiveListener(
  element,
  'touchstart',
  (e) => {
    e.preventDefault(); // This won't work with passive: true
  },
  { passive: false },
);
```

## Other Core Modules

- `logger.js` - Logging utilities
- `cache.js` - Caching utilities
- `utils.js` - General utility functions
- `fetch.js` - Enhanced fetch utilities
- `html-sanitizer.js` - HTML sanitization
- And more...
