# Typewriter

Hero-Typewriter fuer rotierende Zitate und die Startseiten-Unterzeile.

## Public API

- `index.js`: einziger oeffentlicher Einstieg.
- Exporte: `initHeroSubtitle`, `stopHeroSubtitle`.

```js
import { initHeroSubtitle } from "#components/typewriter/index.js";
```

## Intern

- `TypeWriter.js`: Implementierung und Hero-Initialisierung.
- `typewriter.css`: feature-naher Style.

## Migration

- Neue Aufrufer importieren nicht direkt `TypeWriter.js`.
- Das Feature liest seine Zitate aus `content/data/typewriter-quotes.json`.
