# Core Runtime Modules

Shared browser runtime modules used by pages, components and bootstrap code.

## Key Modules

- `logger.js` - structured logging helpers.
- `signals.js` - reactive primitives for shared UI/runtime state.
- `runtime-env.js` and `events.js` - environment detection and DOM-facing lifecycle events.
- `load-manager.js` and `i18n.js` - loader state and translation flow.
- `state/`, `utils/`, `seo/`, `overlay/`, `view-transitions/` - focused internal submodules.
- `section-manager.js`, `accessibility-manager.js`, `types.js` - feature orchestration and shared typedefs.

## Usage

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

log.info("Core initialized");
```

## Notes

- Core modules are ESM and browser-first.
- Keep imports relative within this folder and use the public facades at the root only for stable entry points.
- Prefer signals for shared state, DOM events for one-off lifecycle hooks, and existing helpers before adding new utilities.
- `runtime-env.js` is the canonical host-detection helper.
- `i18n.tOrFallback(...)`, `url-utils.js` and `load-manager.js` are the preferred shared paths for copy, URL handling and loader state.
