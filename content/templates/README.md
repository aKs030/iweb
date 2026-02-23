# Templates

Gemeinsame HTML-Bausteine, die in Seiten eingebettet werden.

## Dateien

- `content/templates/base-head.html`: Importmap, globale Meta/Link-Tags und Core-Script-Injektion.
- `content/templates/base-loader.html`: Globaler Loader-Markup (`#app-loader`).

## Loader Nutzung (aktuell)

```javascript
import { AppLoadManager } from '/content/core/load-manager.js';
import { EVENTS } from '/content/core/events.js';

AppLoadManager.block('data-fetch');
AppLoadManager.updateLoader(0.4, 'Lade Daten...');

// ... async work

AppLoadManager.unblock('data-fetch');
AppLoadManager.hideLoader(200, { immediate: false });

document.addEventListener(EVENTS.LOADING_UNBLOCKED, () => {});
document.addEventListener(EVENTS.LOADING_HIDE, () => {});
document.addEventListener('loading:update', (event) => {
  // event.detail = { progress, message }
});
```

## Hinweise

- Der Loader wird über `content/core/load-manager.js` gesteuert.
- Event-Konstanten liegen in `content/core/events.js`.
- `base-head.html` lädt `head-inline.js` früh, danach `content/main.js`.
