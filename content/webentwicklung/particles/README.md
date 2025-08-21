# Particle System

Ausgelagerte Partikel-Hintergrund Implementierung.

## Nutzung

```js
import { initParticles } from '../utils/particle-system.js';
const stop = initParticles({ getElement, throttle, checkReducedMotion });
```

Rückgabe ist eine Stop/Cleanup Funktion.

## Data-Attribute
- `data-particle-gradient="linear|radial"` Umschaltung Gradient-Modus
- `data-particle-alpha-scale="0.2..2"` Verstärkung/Abschwächung Füll-Alpha
- (indirekt) `data-particle-color` / `data-particle-opacity` -> werden in anderem Code in CSS Variablen überführt

## CSS Variablen
- `--particle-color` rgba Wert für Partikel & Linien
- `--particle-opacity` Grund-Opacity des Canvas

## Adaptive Faktoren
- Scrollposition reduziert Intensität nach unten hin
- Dichte (Anzahl pro Bucket) moduliert Linien- und Füll-Alpha
- FPS Fenster (20 Samples) passt Partikelanzahl dynamisch an (20..140)

## API (intern vorbereitet)
Aktuell werden Convenience-Setter vorbereitet (setColor, setGradientMode, setAlphaScale) – Rückgabewert der Fabrik ist noch nur Stop. Auf Wunsch kann die API extern exponiert werden.

## Cleanup
Stop-Funktion beendet Loop und Observer.

## Erweiterungen Ideen
- Custom Radial Center via `data-particle-center="0.5,0.4"`
- Conic / Mehrfarb-Gradient
- Exponierte Live-Stats Overlay
