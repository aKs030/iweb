# Global State Migration Guide

## Overview

This guide helps you migrate from the old global variable patterns to the new centralized `window.AKS` namespace.

## Why Migrate?

The old approach scattered global variables across `globalThis`, leading to:
- Namespace pollution
- Risk of conflicts with third-party libraries
- Difficult debugging and tracking
- No clear ownership of global state

The new `window.AKS` namespace provides:
- ✅ Single, organized location for all global state
- ✅ Reduced risk of naming conflicts
- ✅ Easier debugging (all globals in one place)
- ✅ Better documentation and discoverability
- ✅ Industry best practice

## Migration Timeline

- **Phase 1 (Current)**: Backward compatibility active, deprecation warnings shown
- **Phase 2 (Next Release)**: Old patterns still work but strongly discouraged
- **Phase 3 (Future Release)**: Old patterns removed, only `window.AKS` supported

## Migration Map

### Three.js Earth System

| Old Pattern | New Pattern | Status |
|-------------|-------------|--------|
| `globalThis.__threeEarthCleanup` | `window.AKS.threeEarthCleanup` | ⚠️ Deprecated |
| `globalThis.threeEarthSystem` | `window.AKS.threeEarthSystem` | ⚠️ Deprecated |
| `globalThis.__FORCE_THREE_EARTH` | `window.AKS.forceThreeEarth` | ⚠️ Deprecated |

### Core Systems

| Old Pattern | New Pattern | Status |
|-------------|-------------|--------|
| `globalThis.announce` | `window.AKS.announce` | ⚠️ Deprecated |
| `globalThis.SectionLoader` | `window.AKS.SectionLoader` | ⚠️ Deprecated |
| `globalThis.__main_delegated_remove` | `window.AKS.mainDelegatedRemove` | ⚠️ Deprecated |

### Robot Companion

| Old Pattern | New Pattern | Status |
|-------------|-------------|--------|
| `globalThis.robotCompanionTexts` | `window.AKS.robotCompanionTexts` | ⚠️ Deprecated |

### YouTube Integration

| Old Pattern | New Pattern | Status |
|-------------|-------------|--------|
| `globalThis.YOUTUBE_CHANNEL_ID` | `window.AKS.youtubeChannelId` | ⚠️ Deprecated |
| `globalThis.YOUTUBE_CHANNEL_HANDLE` | `window.AKS.youtubeChannelHandle` | ⚠️ Deprecated |

## Code Examples

### Before (Old Pattern)

```javascript
// Setting a value
globalThis.__threeEarthCleanup = cleanupFunction;

// Getting a value
const cleanup = globalThis.__threeEarthCleanup;

// Checking existence
if (globalThis.__threeEarthCleanup) {
  globalThis.__threeEarthCleanup();
}
```

### After (New Pattern)

```javascript
// Setting a value
window.AKS.threeEarthCleanup = cleanupFunction;

// Getting a value
const cleanup = window.AKS.threeEarthCleanup;

// Checking existence
if (window.AKS?.threeEarthCleanup) {
  window.AKS.threeEarthCleanup();
}
```

## Step-by-Step Migration

### 1. Find Old Patterns

Search your codebase for old patterns:

```bash
# Find all globalThis usage
grep -r "globalThis\." --include="*.js"

# Find specific deprecated patterns
grep -r "__threeEarthCleanup" --include="*.js"
grep -r "YOUTUBE_CHANNEL_ID" --include="*.js"
```

### 2. Replace with New Patterns

For each occurrence, replace:

```javascript
// Old
globalThis.__threeEarthCleanup = cleanup;

// New
window.AKS.threeEarthCleanup = cleanup;
```

### 3. Test Your Changes

```bash
# Run tests
npm test

# Run linter (will warn about deprecated patterns)
npm run lint:check

# Test in browser
npm run dev
```

### 4. Verify No Deprecation Warnings

Open browser console and check for warnings like:

```
[DEPRECATED] globalThis.__threeEarthCleanup is deprecated. 
Use window.AKS.threeEarthCleanup instead.
```

## Backward Compatibility

During the migration period, **both patterns work**:

```javascript
// Old pattern (shows deprecation warning)
globalThis.__threeEarthCleanup = cleanup;

// New pattern (no warning)
window.AKS.threeEarthCleanup = cleanup;

// Both point to the same value!
console.log(globalThis.__threeEarthCleanup === window.AKS.threeEarthCleanup);
// → true
```

**Important**: Deprecation warnings are shown **only once per path** to avoid console spam.

## ESLint Integration

The project's ESLint configuration will warn you about deprecated patterns:

```javascript
// ❌ ESLint warning
const cleanup = globalThis.__threeEarthCleanup;
// → Use window.AKS.threeEarthCleanup instead

// ✅ No warning
const cleanup = window.AKS.threeEarthCleanup;
```

## Common Pitfalls

### 1. Forgetting Optional Chaining

```javascript
// ❌ May throw error if AKS not initialized
if (window.AKS.threeEarthCleanup) { }

// ✅ Safe with optional chaining
if (window.AKS?.threeEarthCleanup) { }
```

### 2. Mixing Old and New Patterns

```javascript
// ❌ Inconsistent - confusing for maintainers
window.AKS.threeEarthCleanup = cleanup;
const value = globalThis.__threeEarthCleanup;

// ✅ Consistent - use new pattern everywhere
window.AKS.threeEarthCleanup = cleanup;
const value = window.AKS.threeEarthCleanup;
```

### 3. Not Checking Initialization

```javascript
// ❌ May fail if AKS not initialized
window.AKS.threeEarthCleanup = cleanup;

// ✅ Safe initialization check
if (typeof window !== 'undefined' && window.AKS) {
  window.AKS.threeEarthCleanup = cleanup;
}
```

## Testing Your Migration

### Unit Tests

```javascript
import { describe, it, expect } from 'vitest';

describe('Global State Migration', () => {
  it('should use window.AKS instead of globalThis', () => {
    // Set value using new pattern
    window.AKS.testValue = 'test';
    
    // Verify it's accessible
    expect(window.AKS.testValue).toBe('test');
    
    // Verify backward compatibility (if still active)
    expect(globalThis.testValue).toBe('test');
  });
});
```

### Manual Testing

1. Open browser console
2. Check for deprecation warnings
3. Verify functionality works
4. Test edge cases (page reload, navigation, etc.)

## Need Help?

If you encounter issues during migration:

1. Check the [CHANGELOG.md](../CHANGELOG.md) for breaking changes
2. Review the [global-state.js](../content/utils/global-state.js) implementation
3. Run tests: `npm test`
4. Check ESLint warnings: `npm run lint:check`

## Complete Example

Here's a complete before/after example:

### Before

```javascript
// main.js (old pattern)
import { initThreeEarth } from './three-earth-system.js';

// Initialize Three.js Earth
const cleanup = await initThreeEarth();
globalThis.__threeEarthCleanup = cleanup;

// Later, in cleanup
if (globalThis.__threeEarthCleanup) {
  globalThis.__threeEarthCleanup();
  globalThis.__threeEarthCleanup = null;
}
```

### After

```javascript
// main.js (new pattern)
import { initThreeEarth } from './three-earth-system.js';
import { setupBackwardCompatibility } from './utils/global-state.js';

// Setup backward compatibility (during migration period)
setupBackwardCompatibility();

// Initialize Three.js Earth
const cleanup = await initThreeEarth();
window.AKS.threeEarthCleanup = cleanup;

// Later, in cleanup
if (window.AKS?.threeEarthCleanup) {
  window.AKS.threeEarthCleanup();
  window.AKS.threeEarthCleanup = null;
}
```

## Summary

✅ **Do**:
- Use `window.AKS` for all new code
- Migrate existing code gradually
- Test thoroughly after migration
- Use optional chaining (`?.`)

❌ **Don't**:
- Mix old and new patterns
- Ignore deprecation warnings
- Skip testing after migration
- Assume backward compatibility will last forever

---

**Last Updated**: 2026-01-24  
**Status**: Backward compatibility active  
**Next Review**: Next major release
