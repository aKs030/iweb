# Particles

Visuelle Particle- und Three.js-Earth-Systeme fuer die Startseite.

## Public API

- `index.js`: einziger oeffentlicher Einstieg.
- Exporte: `ThreeEarthManager`, `EARTH_PRIMARY_TEXTURE_URL`, `EARTH_SECONDARY_TEXTURE_URLS`.

```js
import { ThreeEarthManager } from "#components/particles/index.js";
```

## Intern

- `runtime/`: Laufzeit-Orchestrierung fuer das 3D-Earth-System.
- `earth/`: Kamera, Szene, Texturen, Karten und UI-nahe Earth-Module.
- `three-earth-system.js`: konkrete Three.js-Initialisierung.
- `three-earth.css`: feature-naher Style.

## Migration

- `ThreeEarthManager` gehoert zum Particles-Feature, nicht zu `content/core`.
- Verbrauchercode importiert keine `earth/*`-Details direkt.
- Falls alte Core-Imports auftauchen, zuerst auf `#components/particles/index.js` migrieren und danach Shims entfernen.
