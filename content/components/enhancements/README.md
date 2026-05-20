# Enhancements

Progressive UI-Erweiterungen wie Section-Dots, Reveal-Effekte, Skill-Radar, Sucheingaben und kleine Interaktionen.

## Public API

- `index.js`: einziger oeffentlicher Einstieg.
- Export: `initEnhancements`.

```js
import { initEnhancements } from "#components/enhancements/index.js";
```

## Intern

- `enhancements.js`: Runtime-Initialisierung und Feature-Gruppen.
- `enhancements.css`: feature-naher Style fuer progressive UI-Erweiterungen.

## Migration

- Neue Aufrufer nutzen `index.js`.
- Einzelne Enhancement-Gruppen bleiben intern, bis sie gross genug fuer eigene Features sind.
