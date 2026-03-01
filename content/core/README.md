# Core Runtime Modules

This directory contains shared browser runtime modules used by pages, components, and app bootstrap code.

## Module Overview

- `logger.js`: Structured logging helpers (`createLogger`).
- `events.js`: App event constants, emitter, and global event helpers.
- `load-manager.js`: Central app loading lifecycle and loader orchestration.
- `i18n.js`: Language manager with translation loading and page translation.
- `utils.js`: DOM helpers, observer helpers, timers, sanitizing, and shared helpers.
- `fetch.js` / `cache.js`: Request helpers with cache support.
- `section-manager.js`: Dynamic section loading and active section tracking.
- `schema.js` / `canonical-manager.js`: SEO structured data and canonical management.
- `theme-color-manager.js` / `pwa-manager.js` / `resource-hints.js`: Head and PWA runtime optimizations.
- `accessibility-manager.js`: Accessibility helpers and announcer utilities.
- `three-earth-manager.js`: Three.js Earth lifecycle, loading orchestration, and cleanup.
- `model-loader.js`: Compressed 3D model loader (Draco & Meshopt via GLTFLoader).
- `types.js`: JSDoc typedefs used across modules and components.

## Typical Usage

```javascript
import { createLogger } from '/content/core/logger.js';
import { AppLoadManager } from '/content/core/load-manager.js';
import { i18n } from '/content/core/i18n.js';
import { EVENTS, fire } from '/content/core/events.js';

const log = createLogger('Example');

await i18n.init();
fire(EVENTS.DOM_READY);
AppLoadManager.block('example-init');
AppLoadManager.unblock('example-init');
log.info('Core initialized');
```

## Notes

- Core modules are ESM and browser-first.
- Keep internal imports within this folder consistent as `./module.js`.
- Prefer reusing existing helpers from `utils.js`, `fetch.js`, and `events.js` before adding new utilities.
