# Templates

Gemeinsame HTML-Bausteine, die in Seiten eingebettet werden.

## Dateien

- `content/templates/global-head.html`: zentrale Head-Vorlage für alle Vollseiten; rendert per `mode="base"` oder `mode="standalone"`.

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
- `global-head.html` stellt im `base`-Modus per Import-Map Bare Imports für Vendor-Pakete und interne Aliase (`#core`, `#components`, `#config`, `#pages`) bereit.
- Die Import-Map wird aus `scripts/sync-import-map.mjs` synchronisiert; Änderungen an Vendor-Versionen und Footer-Artefakten laufen gesammelt über `npm run sync`.
- Das Footer-Web-Component wird nicht mehr im kritischen Pfad geladen, sondern von `head-inline.js` per Intent-/Viewport-/Idle-Hydration nachgezogen.
- Event-Konstanten liegen in `content/core/events.js`.
- `global-head.html` liefert im `base`-Modus die globale App-Shell; `head-inline.js` und `content/main.js` werden weiter darüber initialisiert.
