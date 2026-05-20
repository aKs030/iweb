# Core Runtime Modules

This directory contains shared browser runtime modules used by pages, components, and app bootstrap code.

## Module Overview

- `logger.js`: Structured logging helpers (`createLogger`).
- `signals.js`: Zero-dependency reactive primitives (`signal`, `computed`, `effect`, `batch`).
- `runtime-env.js`: Shared host/runtime environment detection helpers.
- `events.js`: Lifecycle and interoperability events for DOM-facing boundaries.
- `load-manager.js`: UI-agnostic, signals-first loading lifecycle/state manager.
- `i18n.js`: Language manager with translation loading and page translation.
- `state/`: shared overlay/profile/theme state modules split into `ui-store.js`, `theme-state.js`, and `profile-state.js`.
- `utils/`: focused async, DOM, timer, text, sanitizing, URL, fetch, cache, and CSP helpers.
- `seo/`: SEO and structured-data helpers split into `content-extractors.js`, `schema*.js`, `canonical-manager.js`, and `resource-hints*.js`.
- `section-manager.js`: Dynamic section loading and active section tracking.
- `view-transitions/`: internal View Transition implementation split into `constants.js`, `core.js`, `navigation.js`, and `runtime-style.js`.
- `overlay/`: internal overlay registry and focus logic split into `core.js` and `focus.js`.
- `accessibility-manager.js`: Accessibility helpers and announcer utilities.
- `types.js`: JSDoc typedefs used across modules and components.

## Typical Usage

```javascript
import { createLogger } from "#core/logger.js";
import { AppLoadManager, loadSignals } from "#core/load-manager.js";
import { i18n } from "#core/i18n.js";

const log = createLogger("Example");

await i18n.init();
AppLoadManager.block("example-init");
AppLoadManager.updateLoader(0.25, "Initialisiere Beispiel");
AppLoadManager.unblock("example-init");
AppLoadManager.updateLoader(0.75, "Daten vorbereitet");
AppLoadManager.hideLoader(0);

console.log(loadSignals.progress.value);
log.info("Core initialized");
```

## Notes

- Core modules are ESM and browser-first.
- Keep internal imports within this folder consistent as `./module.js`.
- The browser import map now points `#core/*` aliases for the moved modules directly at the new subfolders.
- Public facades such as `view-transitions.js` and `overlay-manager.js` stay at the root because they are the stable entry points.
- Prefer signals for durable shared UI/app state and use DOM events for one-off lifecycle hooks or external integration points.
- `ui-store.js` exposes `subscribeKey(...)` and `select(...)` for fine-grained subscriptions without rebuilding full UI snapshots.
- `theme-state.js` persists explicit user preference in `localStorage` under `iweb-theme-preference`; `system` falls back to media-query resolution.
- Footer-specific orchestration now lives alongside the footer/menu components under `content/components/footer/` and `content/components/menu/`.
- `resource-hints.js` reads route/device/network budgets from `resource-hints-matrix.js`, so speculation and hover warmup stay bounded per section instead of using one global profile.
- `schema.js` keeps the public SEO API stable, while `schema-page-types.js` and `schema-media.js` isolate taxonomy and media extraction.
- `content-extractors.js` is the shared DOM extraction layer for head/SEO and schema text enrichment.
- `runtime-env.js` is the canonical place for local-dev host detection and should be preferred over ad-hoc hostname checks.
- Feature-specific runtime orchestration belongs to the owning feature, for example `ThreeEarthManager` now lives under `content/components/particles/`.
- Robot memory schema ownership lives under `content/components/robot-companion/memory/`.
- `i18n.tOrFallback(...)` is the preferred path for UI copy with explicit fallback text.
- `url-utils.js` should be preferred over ad-hoc `new URL(...)` parsing for internal navigation and compact URL rendering.
- `load-manager.js` exposes loader progress and readiness directly through signals.
- `#core/`, `#components/`, `#config/`, and `#pages/` are available via the global import map in `content/templates/global-head.html` when rendered in `base` mode.
- Prefer reusing existing helpers from `async-utils.js`, `dom-utils.js`, `timer-manager.js`, `text-utils.js`, `sanitization-utils.js`, `fetch.js`, `signals.js`, and `events.js` before adding new utilities.
