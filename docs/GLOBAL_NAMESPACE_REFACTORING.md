# Global Namespace Refactoring - Three.js Earth System

## Overview

This document describes the refactoring of the Three.js Earth system to eliminate `globalThis` usage and implement a proper module-based state management pattern.

## Problem Statement

The previous implementation used global variables:

**Three.js Earth System:**

- `globalThis.__projectCameraPresets` - Camera configuration
- `globalThis.__FORCE_THREE_EARTH` - Force enable flag
- `globalThis.__threeEarthCleanup` - Cleanup function reference

**Head Component System:**

- `globalThis.__HEAD_INLINE_READY` - Initialization synchronization
- `globalThis.SHARED_HEAD_LOADED` - Load state tracking

### Issues with Global Variables

1. **Namespace Pollution**: Risk of naming collisions as the application scales
2. **Testing Difficulty**: Hard to mock and reset state in tests
3. **Hidden Dependencies**: Unclear data flow and dependencies
4. **Type Safety**: No type checking for global variables
5. **Maintainability**: Difficult to track where globals are set/read

## Solution: Centralized State Manager

We've implemented a singleton state manager module that provides:

- ✅ Encapsulated state management
- ✅ Type-safe API with JSDoc
- ✅ Reactive state updates with subscriptions
- ✅ Immutable getters to prevent accidental mutations
- ✅ Easy testing and mocking
- ✅ Clear dependency graph

## Architecture

### New Module Structure

```
content/components/particles/
├── three-earth-state.js          # State manager (NEW)
├── three-earth-state.test.js     # Tests (NEW)
├── three-earth-system.js         # Main system (UPDATED)
├── shared-particle-system.js
└── README.md                      # Documentation (NEW)
```

### State Manager API

```javascript
import { threeEarthState } from '/content/components/particles/three-earth-state.js';

// Camera presets
threeEarthState.setCameraPresets({
  /* ... */
});
threeEarthState.getCameraPresets();

// Force enable
threeEarthState.setForceEnable(true);
threeEarthState.isForceEnabled();

// Cleanup
threeEarthState.setCleanupFunction(fn);
threeEarthState.executeCleanup();

// Reactive updates
const unsubscribe = threeEarthState.subscribe((key, config) => {
  console.log('State changed:', key);
});

// Reset for testing
threeEarthState.reset();
```

## Migration Guide

### For Developers

#### Before (❌)

```javascript
// Setting camera presets
globalThis.__projectCameraPresets = {
  myPreset: { position: { x: 0, y: 0, z: 10 } },
};

// Force enabling
globalThis.__FORCE_THREE_EARTH = true;

// Cleanup
if (globalThis.__threeEarthCleanup) {
  globalThis.__threeEarthCleanup();
}
```

#### After (✅)

```javascript
import { threeEarthState } from '/content/components/particles/three-earth-state.js';

// Setting camera presets
threeEarthState.setCameraPresets({
  myPreset: { position: { x: 0, y: 0, z: 10 } },
});

// Force enabling
threeEarthState.setForceEnable(true);

// Cleanup
threeEarthState.executeCleanup();
```

### For Testing

#### Before (❌)

```javascript
// Setup
globalThis.__FORCE_THREE_EARTH = true;

// Teardown - difficult to clean up
delete globalThis.__FORCE_THREE_EARTH;
delete globalThis.__projectCameraPresets;
delete globalThis.__threeEarthCleanup;
```

#### After (✅)

```javascript
import { threeEarthState } from '/content/components/particles/three-earth-state.js';

// Setup
beforeEach(() => {
  threeEarthState.setForceEnable(true);
});

// Teardown - clean and simple
afterEach(() => {
  threeEarthState.reset();
});
```

## Files Changed

### Three.js Earth System

1. **`content/components/particles/three-earth-state.js`** (NEW)
   - Centralized state manager
   - Singleton pattern
   - Type-safe API

2. **`content/components/particles/three-earth-system.js`** (UPDATED)
   - Removed `globalThis.__projectCameraPresets` usage
   - Removed `globalThis.__FORCE_THREE_EARTH` usage
   - Import and use `threeEarthState` module
   - Changed `globalThis.matchMedia` to `window.matchMedia` (standard API)
   - Changed `globalThis.devicePixelRatio` to `window.devicePixelRatio` (standard API)

3. **`content/core/three-earth-manager.js`** (UPDATED)
   - Removed `globalThis.__FORCE_THREE_EARTH` usage
   - Removed `globalThis.__threeEarthCleanup` usage
   - Import and use `threeEarthState` module
   - Changed `globalThis.requestIdleCallback` to `window.requestIdleCallback` (standard API)

4. **`content/core/types.js`** (UPDATED)
   - Deprecated `__FORCE_THREE_EARTH` in type definitions
   - Added deprecation notice

### Head Component System

5. **`content/components/head/head-state.js`** (NEW)
   - Centralized state manager for head initialization
   - Promise-based async coordination
   - Timeout handling

6. **`content/components/head/head-inline.js`** (UPDATED)
   - Removed `globalThis.__HEAD_INLINE_READY` usage
   - Import and use `headState` module
   - Call `headState.setInlineReady()`

7. **`content/components/head/head-manager.js`** (UPDATED)
   - Removed polling for `globalThis.__HEAD_INLINE_READY`
   - Removed `globalThis.SHARED_HEAD_LOADED` usage
   - Import and use `headState` module
   - Use `headState.waitForInlineReady()` with promise
   - Use `headState.isManagerLoaded()` for load state

### Documentation

8. **`content/components/particles/README.md`** (NEW)
   - Complete API documentation for Three.js Earth state
   - Usage examples
   - Migration guide

9. **`content/components/head/README.md`** (NEW)
   - Complete API documentation for Head state
   - Usage examples
   - Migration guide

10. **`docs/GLOBAL_NAMESPACE_REFACTORING.md`** (NEW - this file)
    - Architecture overview
    - Migration guide
    - Rationale

11. **`content/main.js`** (UPDATED)
    - Removed obsolete `globalThis.threeEarthSystem` reference
    - Simplified BFCache handling

## Standard Browser APIs

Note: We still use standard browser APIs via `window` or `globalThis`:

- `window.matchMedia()` - Media query matching (standard)
- `window.devicePixelRatio` - Device pixel ratio (standard)
- `window.requestIdleCallback()` - Idle callback scheduling (standard)

These are **not** custom global variables and are part of the Web API standard.

## Benefits

### 1. Better Testability

```javascript
// Easy to test with clean state
describe('Three.js Earth', () => {
  beforeEach(() => {
    threeEarthState.reset();
  });

  it('should load with custom presets', () => {
    threeEarthState.setCameraPresets({ test: {} });
    // Test implementation
  });
});
```

### 2. Type Safety

```javascript
// Full JSDoc type definitions
/** @type {import('./three-earth-state.js').ThreeEarthConfig} */
const config = threeEarthState.getConfig();
```

### 3. Reactive Updates

```javascript
// Subscribe to state changes
threeEarthState.subscribe((key, config) => {
  if (key === 'cameraPresets') {
    updateUI(config.cameraPresets);
  }
});
```

### 4. Clear Dependencies

```javascript
// Explicit imports show dependencies
import { threeEarthState } from './three-earth-state.js';
// vs. hidden global variable usage
```

### 5. Immutability

```javascript
// Getters return copies
const presets = threeEarthState.getCameraPresets();
presets.test = 'modified'; // Doesn't affect internal state
```

## Performance Impact

- **Negligible**: State manager is a lightweight singleton
- **No runtime overhead**: Direct property access
- **Memory**: Minimal (~1KB for state manager)
- **Initialization**: Instant (no async operations)

## Backward Compatibility

### Breaking Changes

**Three.js Earth System:**

- ❌ `globalThis.__projectCameraPresets` - No longer supported
- ❌ `globalThis.__FORCE_THREE_EARTH` - No longer supported
- ❌ `globalThis.__threeEarthCleanup` - No longer supported

**Head Component System:**

- ❌ `globalThis.__HEAD_INLINE_READY` - No longer supported
- ❌ `globalThis.SHARED_HEAD_LOADED` - No longer supported

### Migration Path

1. Search codebase for global variable usage
2. Replace with state manager API calls
3. Update tests to use `threeEarthState.reset()`
4. Remove any global variable assignments

### Search Commands

```bash
# Find potential usage of removed variables
grep -r "__projectCameraPresets" .
grep -r "__FORCE_THREE_EARTH" .
grep -r "__threeEarthCleanup" .
grep -r "__HEAD_INLINE_READY" .
grep -r "SHARED_HEAD_LOADED" .
```

## Testing

### Run Unit Tests

```javascript
// In browser console or test runner
import { runner } from '/content/components/particles/three-earth-state.test.js';
await runner.run();
```

### Test Coverage

- ✅ Initialization
- ✅ Camera preset management
- ✅ Force enable flag
- ✅ Cleanup function handling
- ✅ State subscriptions
- ✅ State reset
- ✅ Immutability
- ✅ Error handling
- ✅ Edge cases

## Future Improvements

### Potential Enhancements

1. **Persistence**: Save state to localStorage
2. **Validation**: Schema validation for camera presets
3. **DevTools**: Browser extension for state inspection
4. **Middleware**: Add middleware pattern for state changes
5. **Time Travel**: Undo/redo functionality

### Example: Persistence

```javascript
class ThreeEarthStateManager {
  constructor() {
    // Load from localStorage
    this.loadFromStorage();
  }

  setCameraPresets(presets) {
    this.config.cameraPresets = { ...this.config.cameraPresets, ...presets };
    this.saveToStorage();
    this.notifyListeners('cameraPresets');
  }

  saveToStorage() {
    localStorage.setItem('threeEarthState', JSON.stringify(this.config));
  }

  loadFromStorage() {
    const saved = localStorage.getItem('threeEarthState');
    if (saved) {
      this.config = JSON.parse(saved);
    }
  }
}
```

## Related Documentation

- [Three.js Earth System README](../content/components/particles/README.md)
- [Architecture Documentation](./ARCHITECTURE.md)
- [Code Quality Guide](./CODE_QUALITY.md)

## Questions & Support

For questions about this refactoring:

1. Check the [README](../content/components/particles/README.md) for API usage
2. Review [`content/components/particles/README.md`](../content/components/particles/README.md) for examples
3. Consult the [Architecture docs](./ARCHITECTURE.md) for system design

## Conclusion

This refactoring eliminates fragile global variable dependencies and establishes a robust, testable, and maintainable state management pattern for the Three.js Earth system. The new architecture follows modern JavaScript best practices and provides a solid foundation for future enhancements.

**Status**: ✅ Complete
**Version**: 1.0.0
**Date**: 2026-02-05
