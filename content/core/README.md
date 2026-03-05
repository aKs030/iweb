# Core Runtime Modules

This directory contains shared browser runtime modules used by pages, components, and app bootstrap code.

## Module Overview

- `logger.js`: Structured logging helpers (`createLogger`).
- `signals.js`: Zero-dependency reactive primitives (`signal`, `computed`, `effect`, `batch`).
- `ui-store.js`: Shared UI state built on top of signals.
- `theme-state.js`: Reactive theme preference + resolved theme synchronization.
- `footer-state.js`: Reactive footer readiness/expanded state shared across modules.
- `idle.js`: Shared idle scheduling/cancellation helper with timeout fallback.
- `runtime-env.js`: Shared host/runtime environment detection helpers.
- `events.js`: Lifecycle and interoperability events for DOM-facing boundaries.
- `load-manager.js`: UI-agnostic, signals-first loading lifecycle/state manager.
- `i18n.js`: Language manager with translation loading and page translation.
- `utils.js`: DOM helpers, observer helpers, timers, sanitizing, and shared helpers.
- `url-utils.js`: Shared URL parsing, normalization, and safe internal-link helpers.
- `content-extractors.js`: Shared heading/image/video extraction for SEO and schema.
- `fetch.js` / `cache.js`: Request helpers with cache support.
- `section-manager.js`: Dynamic section loading and active section tracking.
- `schema.js` / `schema-page-types.js` / `schema-media.js` / `schema-shared.js` / `canonical-manager.js`: SEO structured data, page-type mapping, shared schema helpers, media extraction, and canonical management.
- `pwa-manager.js` / `sw-registration.js` / `resource-hints.js` / `resource-hints-matrix.js`: Head, offline lifecycle, and route-aware runtime optimizations.
- `accessibility-manager.js`: Accessibility helpers and announcer utilities.
- `three-earth-manager.js`: Three.js Earth lifecycle, loading orchestration, and cleanup.
- `model-loader.js`: Compressed 3D model loader (Draco & Meshopt via GLTFLoader).
- `types.js`: JSDoc typedefs used across modules and components.

## Typical Usage

```javascript
import { createLogger } from '#core/logger.js';
import {
  AppLoadManager,
  loadSignals,
  subscribeLoadState,
  whenAppReady,
} from '#core/load-manager.js';
import { i18n } from '#core/i18n.js';

const log = createLogger('Example');

await i18n.init();
AppLoadManager.block('example-init');
AppLoadManager.updateLoader(0.25, 'Initialisiere Beispiel');
AppLoadManager.unblock('example-init');
AppLoadManager.updateLoader(0.75, 'Daten vorbereitet');
AppLoadManager.hideLoader(0);

const stop = subscribeLoadState((state) => {
  if (!state.blocked && state.done) {
    log.info('App ready', state);
  }
});

await whenAppReady({ timeout: 5000 });

console.log(loadSignals.progress.value);
log.info('Core initialized');
```

## Notes

- Core modules are ESM and browser-first.
- Keep internal imports within this folder consistent as `./module.js`.
- Prefer signals for durable shared UI/app state and use DOM events for one-off lifecycle hooks or external integration points.
- `ui-store.js` exposes `subscribeKey(...)` and `select(...)` for fine-grained subscriptions without rebuilding full UI snapshots.
- `theme-state.js` persists explicit user preference in `localStorage` under `iweb-theme-preference`; `system` falls back to media-query resolution.
- `footer-state.js` exposes `footerSignals`, `subscribeFooterState(...)`, and `whenFooterReady(...)` for footer orchestration without DOM events.
- `resource-hints.js` reads route/device/network budgets from `resource-hints-matrix.js`, so speculation and hover warmup stay bounded per section instead of using one global profile.
- `idle.js` is the preferred way to combine `requestIdleCallback` with deterministic timeout fallback and cleanup.
- `schema.js` keeps the public SEO API stable, while `schema-page-types.js`, `schema-shared.js`, and `schema-media.js` isolate taxonomy, shared text helpers, and media extraction.
- `content-extractors.js` is the shared DOM extraction layer for head/SEO and schema text enrichment.
- `sw-registration.js` owns service-worker registration and online/offline indicator lifecycle so `main.js` stays focused on app bootstrap.
- `runtime-env.js` is the canonical place for local-dev host detection and should be preferred over ad-hoc hostname checks.
- `i18n.tOrFallback(...)` is the preferred path for UI copy with explicit fallback text.
- `url-utils.js` should be preferred over ad-hoc `new URL(...)` parsing for internal navigation and compact URL rendering.
- `npm run smoke:browser` starts a local dev server and verifies theme persistence, loader completion, menu/search/robot interplay, footer hydration, and the BFCache restore path in Chromium.
- `load-manager.js` exposes `whenAppReady(...)` for async coordination; loader progress and readiness are consumed directly through signals.
- `#core/`, `#components/`, `#config/`, and `#pages/` are available via the global import map in `content/templates/base-head.html`.
- Prefer reusing existing helpers from `utils.js`, `fetch.js`, `signals.js`, and `events.js` before adding new utilities.
