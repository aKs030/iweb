# Interactions

Wiederverwendbare Nutzerinteraktionen fuer Likes und Kommentare.

## Public API

- `index.js`: einziger oeffentlicher Einstieg.
- Exporte: `LikeButton`, `CommentSection`.

```js
import { LikeButton } from "#components/interactions/index.js";
```

## Intern

- `LikeButton.js`: Like-UI und API-Integration.
- `CommentSection.js`: Kommentar-UI und API-Integration.
- `interactions.css`: feature-naher Style.

## Migration

- Neue Aufrufer verwenden nur `index.js`.
- API-spezifische Fetch-Logik bleibt beim jeweiligen Interaktionsmodul.
