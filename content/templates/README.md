# Loader System v2.0

## Features

- Animiertes Hintergrund-Grid
- Schwebende Gradient-Orbs
- Doppelte Spinner-Ringe
- Logo mit Pulse-Effekt & Scanline
- Enhanced Progress Bar mit Glow
- Loading Dots Animation
- Timeout-Warnung (8s)
- Performance-Hint (3s)
- Responsive & Accessible
- Reduced Motion Support

## Verwendung

```javascript
import {
  showLoader,
  updateLoader,
  hideLoader,
} from '/content/core/global-loader.js';

// Anzeigen
showLoader('Lade Daten...');

// Aktualisieren
updateLoader(0.5, 'Verarbeite...'); // 50%

// Verstecken
hideLoader();
```

## Optionen

```javascript
showLoader('Laden...', {
  initialProgress: 0.1,
  showWarning: true,
});

hideLoader(500, { immediate: false });
```

## Events

```javascript
import { EVENTS } from '/content/core/global-loader.js';

document.addEventListener(EVENTS.LOADING_SHOW, () => {});
document.addEventListener(EVENTS.LOADING_UPDATE, (e) => {});
document.addEventListener(EVENTS.LOADING_HIDE, () => {});
document.addEventListener(EVENTS.LOADING_TIMEOUT, () => {});
```

## CSS-Variablen

```css
:root {
  --loader-bg: #030303;
  --loader-text: #e0e0e0;
  --loader-accent: #00f3ff;
  --loader-accent-secondary: #7000ff;
}
```

## Dateien

- `content/templates/base-loader.html` - HTML-Template
- `content/styles/loader.css` - Styles
- `content/core/global-loader.js` - Logik
