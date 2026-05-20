# Templates

Gemeinsame HTML-Bausteine, die in Seiten eingebettet werden.

## Dateien

- `content/templates/global-head.html`: zentrale Head-Vorlage für alle Vollseiten; rendert per `mode="base"` oder `mode="standalone"`.

## Loading-State Nutzung

```javascript
import { AppLoadManager, loadSignals } from "#core/load-manager.js";

AppLoadManager.block("data-fetch");
AppLoadManager.updateLoader(0.4, "Lade Daten...");

// ... async work

AppLoadManager.unblock("data-fetch");
AppLoadManager.hideLoader(200);

console.log(loadSignals.blocked.value);
```

## Hinweise

- Loading-State wird über `content/core/load-manager.js` gesteuert.
- Das Loading-System ist UI-agnostisch und verwendet Signals als Primärzustand.
- `loadSignals` ist der Primärpfad für App-Readiness und Loader-Fortschritt.
- `global-head.html` stellt im `base`-Modus direkt die Import-Map für Vendor-Pakete und interne Aliase (`#core`, `#components`, `#config`, `#pages`) bereit.
- Das Footer-Web-Component wird nicht mehr im kritischen Pfad geladen, sondern vom Head-Feature per Intent-/Viewport-/Idle-Hydration nachgezogen.
- Event-Konstanten liegen in `content/core/events.js`.
- `global-head.html` liefert im `base`-Modus die globale App-Shell; `content/components/head/index.js` und `content/main.js` werden weiter darüber initialisiert.
