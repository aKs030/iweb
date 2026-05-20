# Footer

Lazy-hydrierter Site-Footer mit Cookie-Aktionen, Legal-Links und kompaktem Footer-Shell.

## Public API

- `index.js`: einziger oeffentlicher Einstieg fuer Footer-Aufrufer.
- Exporte: `ensureFooterAndTrigger`, `openFooter`, `closeFooter`, `footerSignals`, `subscribeFooterState`.

```js
import { openFooter, subscribeFooterState } from "#footer/index.js";
```

## Intern

- `footer-hydration.js`: Shell-Erzeugung, Intent-/Idle-Hydration und Trigger-Weiterleitung.
- `footer.js`: Web Component und vollstaendige Footer-Interaktion.
- `state.js`: Feature-interner Zustand; nach aussen nur ueber `index.js`.
- `modules/`: interne Footer-Helfer, z. B. Cookie-Verwaltung.
- `footer.css`, `legal-pages.css`: feature-nahe Styles.

## Migration

- Verbrauchercode importiert nicht mehr `#footer/state.js`.
- Direkte Imports auf `footer.js` nur innerhalb des Features.
- `index.js` laedt `footer.js` lazy, damit der Head-Bootstrap schlank bleibt.
