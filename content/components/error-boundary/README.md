# Error Boundary

Kleine React Error-Boundary-Fabrik fuer Seiten-Apps.

## Public API

- `index.js`: einziger oeffentlicher Einstieg.
- Export: `createErrorBoundary`.

```js
import { createErrorBoundary } from "#components/error-boundary/index.js";
```

## Intern

Dieses Feature ist bewusst ein einzelnes Modul und hat keine internen Unterordner.

## Migration

- Alte Imports von `#components/ErrorBoundary.js` sind entfernt.
- Bei weiterer Error-UI zuerst hier erweitern, nicht pro Seite duplizieren.
