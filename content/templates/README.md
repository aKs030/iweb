# Templates

Gemeinsame HTML-Bausteine, die in Seiten eingebettet werden.

## Dateien

- `content/templates/global-head.html` - zentrale Head-Vorlage für Vollseiten und Standalone-Renders.

## Loading State

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

- Loading-State läuft über `content/core/load-manager.js` und `loadSignals`.
- `global-head.html` liefert im `base`-Modus die Import-Map und die globale App-Shell.
- Footer-Hydration wird vom Head-Feature lazily nachgezogen.
