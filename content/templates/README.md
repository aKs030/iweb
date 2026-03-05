# Templates

Gemeinsame HTML-Bausteine, die in Seiten eingebettet werden.

## Dateien

- `content/templates/base-head.html`: Importmap, globale Meta/Link-Tags und Core-Script-Injektion.

## Loading-State Nutzung

```javascript
import {
  AppLoadManager,
  loadSignals,
  subscribeLoadState,
  whenAppReady,
} from '#core/load-manager.js';

AppLoadManager.block('data-fetch');
AppLoadManager.updateLoader(0.4, 'Lade Daten...');

// ... async work

AppLoadManager.unblock('data-fetch');
AppLoadManager.hideLoader(200);

const unsubscribe = subscribeLoadState((state) => {
  console.log(state.progress, state.message, state.pending);
});

await whenAppReady({ timeout: 5000 });

console.log(loadSignals.blocked.value);
```

## Hinweise

- Loading-State wird über `content/core/load-manager.js` gesteuert.
- Das Loading-System ist UI-agnostisch und verwendet Signals als Primärzustand.
- `whenAppReady(...)`, `loadSignals` und `subscribeLoadState(...)` sind der Primärpfad für App-Readiness und Loader-Fortschritt.
- `base-head.html` stellt per Import-Map Bare Imports für Vendor-Pakete und interne Aliase (`#core`, `#components`, `#config`, `#pages`) bereit.
- Die Import-Map wird aus `scripts/sync-import-map.mjs` synchronisiert; Änderungen an Vendor-Versionen laufen über `npm run importmap:sync` bzw. `npm run check:importmap`.
- Das Footer-Web-Component wird nicht mehr im kritischen Pfad geladen, sondern von `head-inline.js` per Intent-/Viewport-/Idle-Hydration nachgezogen.
- Event-Konstanten liegen in `content/core/events.js`.
- `base-head.html` lädt `head-inline.js` früh, danach `content/main.js`.
