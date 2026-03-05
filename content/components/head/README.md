# Head Component State Management

## Overview

The Head component system uses a centralized state manager (`head-state.js`) to coordinate initialization between `head-inline.js` and `head-manager.js`.

`head-inline.js` is now a thin bootstrap entry and delegates side-effect groups into focused modules:

- `analytics-bootstrap.js`: GTM/GA4 consent defaults and script injection.
- `core-assets-bootstrap.js`: critical styles, resource hints, fonts, and deferred runtime assets.
- `footer-hydration.js`: menu/footer shell injection and footer lazy hydration.

## Migration from Global Variables

### Before (❌)

```javascript
// head-inline.js
globalThis.__HEAD_INLINE_READY = true;

// head-manager.js
if (!globalThis.__HEAD_INLINE_READY) {
  await new Promise((resolve) => {
    const checkInterval = setInterval(() => {
      if (globalThis.__HEAD_INLINE_READY) {
        clearInterval(checkInterval);
        resolve();
      }
    }, 50);
  });
}
```

### After (✅)

```javascript
// head-inline.js
import { headState } from './head-state.js';
headState.setInlineReady();

// head-manager.js
import { headState } from './head-state.js';
await headState.waitForInlineReady(5000);
```

## API Reference

### `headState`

Singleton instance for head component state management.

#### Methods

##### `setInlineReady()`

Mark head-inline as ready and notify all waiting listeners.

```javascript
headState.setInlineReady();
```

##### `isInlineReady(): boolean`

Check if head-inline is ready.

```javascript
if (headState.isInlineReady()) {
  // Proceed
}
```

##### `waitForInlineReady(timeout?: number): Promise<void>`

Wait for head-inline to be ready with optional timeout (default: 5000ms).

```javascript
await headState.waitForInlineReady(5000);
```

##### `onReady(listener: Function): Function`

Subscribe to ready state. Returns unsubscribe function.

```javascript
const unsubscribe = headState.onReady(() => {
  console.log('Head inline is ready!');
});
```

##### `setManagerLoaded()`

Mark head-manager as loaded.

##### `isManagerLoaded(): boolean`

Check if head-manager is loaded.

##### `reset()`

Reset state (for testing).

```javascript
headState.reset();
```

## Usage Examples

### Waiting for Initialization

```javascript
import { headState } from '#components/head/head-state.js';

// Wait with timeout
await headState.waitForInlineReady(5000);

// Or subscribe to ready event
headState.onReady(() => {
  console.log('Ready to proceed!');
});
```

### Testing

```javascript
import { headState } from '#components/head/head-state.js';

beforeEach(() => {
  headState.reset();
});

test('should wait for inline ready', async () => {
  const promise = headState.waitForInlineReady(1000);
  headState.setInlineReady();
  await promise; // Resolves immediately
});
```

## Benefits

- **No Global Namespace Pollution**: State encapsulated in module
- **Promise-based**: Clean async/await syntax
- **Timeout Handling**: Automatic timeout with fallback
- **Type Safety**: Full JSDoc type definitions
- **Testable**: Easy to mock and reset
- **Reactive**: Subscribe to state changes
