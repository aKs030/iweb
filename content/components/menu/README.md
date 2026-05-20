# Menu

Site-Menue mit Suche, Overlay-Steuerung, Theme-/Sprachaktionen und responsive Navigation.

## Public API

- `index.js`: einziger oeffentlicher Einstieg.
- Exporte: `SiteMenu`, `openMenu`, `closeMenu`.

```js
import { openMenu } from "#menu/index.js";
```

## Intern

- `SiteMenu.js`: Web Component und Feature-Orchestrierung.
- `modules/`: Rendering, Suche, Events, State, Config und Accessibility.
- `styles/`: CSS-Teile fuer Basislayout, Suche, States, Mobile und Backdrop.

## Migration

- Neue JS-Aufrufer nutzen `#menu/index.js`.
- Module unter `modules/` bleiben interne Imports.
- Styles werden direkt ueber `styles/` gepflegt; keine dauerhafte CSS-Fassade.
