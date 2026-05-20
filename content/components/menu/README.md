# Menu

Site-Menue mit Suche, Overlay-Steuerung, Theme-/Sprachaktionen und responsive Navigation.

## Public API

- `index.js`: einziger oeffentlicher Einstieg.
- `index.js` registriert das Custom Element fuer die globale App-Shell.

```html
<script type="module" src="/content/components/menu/index.js"></script>
```

## Intern

- `SiteMenu.js`: Web Component und Feature-Orchestrierung.
- `modules/`: Rendering, Suche, Events, State, Config und Accessibility.
- `styles/`: CSS-Teile fuer Basislayout, Suche, States und Mobile.

## Migration

- Externe Steuerung laeuft ueber das registrierte `<site-menu>` Element.
- Module unter `modules/` bleiben interne Imports.
- Styles werden direkt ueber `styles/` gepflegt; keine dauerhafte CSS-Fassade.
