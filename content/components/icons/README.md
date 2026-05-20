# Icons

React/HTM Icon-Komponenten fuer Blog-, Gallery- und Projektoberflaechen.

## Public API

- `index.js`: einziger oeffentlicher Einstieg.
- Exporte: alle Icons aus `icons.js`.

```js
import { ArrowRight } from "#components/icons/index.js";
```

## Intern

- `icons.js`: Icon-Komponenten und `IconBase`.

## Migration

- Neue Aufrufer importieren nicht direkt `icons.js`.
- Wenn Icons stark anwachsen, nach Domaenen innerhalb dieses Features splitten und nur ueber `index.js` exportieren.
