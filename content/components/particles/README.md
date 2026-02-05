# Three.js Earth System - State Management

## Overview

The Three.js Earth system uses a centralized state manager (`three-earth-state.js`) instead of global variables. This improves testability, maintainability, and prevents namespace collisions.

## Migration from Global Variables

### Before (❌)

```javascript
globalThis.__projectCameraPresets = {
  myCustomPreset: {
    /* ... */
  },
};
globalThis.__FORCE_THREE_EARTH = true;
globalThis.__threeEarthCleanup();
```

### After (✅)

```javascript
import { threeEarthState } from '/content/components/particles/three-earth-state.js';

threeEarthState.setCameraPresets({
  myCustomPreset: {
    /* ... */
  },
});
threeEarthState.setForceEnable(true);
threeEarthState.executeCleanup();
```

## API Reference

### `threeEarthState`

Singleton instance providing centralized state management.

#### Methods

##### `setCameraPresets(presets: Object)`

Set custom camera presets for the Earth system.

```javascript
threeEarthState.setCameraPresets({
  projectView: {
    position: { x: 0, y: 2, z: 10 },
    target: { x: 0, y: 0, z: 0 },
  },
});
```

##### `getCameraPresets(): Object`

Get all camera presets (returns a copy).

```javascript
const presets = threeEarthState.getCameraPresets();
```

##### `setForceEnable(enable: boolean)`

Force enable Three.js even in test environments.

```javascript
threeEarthState.setForceEnable(true);
```

##### `isForceEnabled(): boolean`

Check if Three.js is force-enabled.

```javascript
if (threeEarthState.isForceEnabled()) {
  // Three.js will load even in test mode
}
```

##### `setCleanupFunction(fn: Function)`

Set the cleanup function (used internally by the system).

```javascript
threeEarthState.setCleanupFunction(() => {
  // cleanup logic
});
```

##### `getCleanupFunction(): Function|null`

Get the current cleanup function.

##### `executeCleanup(): boolean`

Execute the cleanup function if available. Returns `true` if cleanup was executed.

```javascript
const cleaned = threeEarthState.executeCleanup();
```

##### `subscribe(listener: Function): Function`

Subscribe to state changes. Returns an unsubscribe function.

```javascript
const unsubscribe = threeEarthState.subscribe((key, config) => {
  console.log(`State changed: ${key}`, config);
});

// Later...
unsubscribe();
```

##### `reset()`

Reset all state to defaults.

```javascript
threeEarthState.reset();
```

##### `getConfig(): Object`

Get the full configuration (read-only copy).

```javascript
const config = threeEarthState.getConfig();
console.log(config.forceEnable, config.cameraPresets);
```

## Usage Examples

### Custom Camera Presets

```javascript
import { threeEarthState } from '/content/components/particles/three-earth-state.js';

threeEarthState.setCameraPresets({
  projectsHero: {
    position: { x: 5, y: 3, z: 15 },
    fov: 45,
    target: { x: 0, y: 0, z: 0 },
  },
});
```

### Testing

```javascript
import { threeEarthState } from '/content/components/particles/three-earth-state.js';

beforeAll(() => threeEarthState.setForceEnable(true));
afterAll(() => threeEarthState.reset());
```

### State Changes

```javascript
const unsubscribe = threeEarthState.subscribe((key, config) => {
  console.log('State changed:', key);
});
```

## Benefits

- **No Global Namespace Pollution**: All state encapsulated in module
- **Better Testability**: Easy to mock and reset state
- **Type Safety**: Full JSDoc type definitions
- **Reactive**: Subscribe to state changes
- **Immutable Reads**: Getters return copies
- **Centralized**: Single source of truth
