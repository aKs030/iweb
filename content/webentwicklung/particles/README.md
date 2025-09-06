# Particles System - 2D Canvas

Optimiertes 2D-Canvas-Partikelsystem für iweb.

## Nutzung
```js
import { initParticles } from './particle-system.js';
const stop = initParticles({ getElement, throttle, checkReducedMotion });
```

## Features
- **Spatial Grid**: Optimierte Nachbarschaftssuche
- **Dynamic FPS**: Automatische Partikel-Anpassung (20-140 FPS)
- **Gradient Support**: Lineare und radiale Verläufe
- **Responsive**: Device Pixel Ratio Support
- **Accessibility**: Prefers-reduced-motion Unterstützung

## Data-Attribute
- `data-particle-gradient="linear|radial"` - Gradient-Modus
- `data-particle-alpha-scale="0.2..2"` - Alpha-Verstärkung
- `data-particle-color` / `data-particle-opacity` - CSS Variablen

## CSS Variablen
- `--particle-color` - RGBA Wert für Partikel & Linien
- `--particle-opacity` - Grund-Opacity des Canvas

## Performance
- **Scroll-Anpassung**: Intensität reduziert sich mit Scroll-Position
- **FPS-Monitoring**: Automatische Partikel-Reduzierung bei niedrigen FPS
- **Memory-Optimiert**: Spatial Grid für effiziente Kollisionserkennung
- **RAF-Optimiert**: RequestAnimationFrame mit Throttling

## 3D Sterne System

### Basis-Funktionen (stars-utils.js)
```js
import { 
  makeStarPositions,
  animateStarPositions,
  getStarStats,
  create3DStarScene,
  create3DStarSceneWithLoader,
  setupScrollFadeIn
} from './stars-utils.js';

// Grundlegende Sterne-Generierung
const stars = makeStarPositions({ count: 600, shape: 'sphere', spread: 10 });

// 3D-Szene mit Kamera-Animation beim Scrollen
const scene = create3DStarSceneWithLoader('canvas-container', {
  starCount: 600,
  cameraDistance: 15,
  enableCameraAnimation: true
});

// Fade-In-Animationen
setupScrollFadeIn('[data-aos], .fade-in');
```

### 3D Features
- **Kamera-Animation**: Kamera fliegt um 3D-Sterne beim Scrollen
- **Fade-In-Animationen**: Intersection Observer basierte Animationen
- **Automatisches Three.js Loading**: CDN-basiertes Laden mit Fallback
- **Performance-Optimierung**: RequestAnimationFrame mit FPS-Monitoring
- **Responsive Design**: Automatische Größenanpassung

### Verfügbare Funktionen
1. `makeStarPositions()` - Stern-Positionen generieren
2. `animateStarPositions()` - Stern-Animation
3. `getStarStats()` - Statistiken und Debugging
4. `create3DStarScene()` - 3D-Szene mit Three.js
5. `create3DStarSceneWithLoader()` - Auto-Loading Version
6. `setupScrollFadeIn()` - Fade-In-System
7. `setupScrollParallax()` - Parallax-Effekte
8. `updateVisibleElements()` - Element-Updates
9. `resetStarPositions()` - Position-Reset
10. `shuffleArray()` - Array-Utilities

## Integration

Das System ist darauf ausgelegt, sowohl 2D-Partikel als auch 3D-Sterne gleichzeitig zu verwenden:

1. **2D-Partikel**: Für Hintergrund-Animationen
2. **3D-Sterne**: Für immersive Scroll-Effekte
3. **Fade-In-System**: Für Content-Animationen

## Cleanup

Beide Systeme bieten Stop/Cleanup-Funktionen für ordnungsgemäße Ressourcenverwaltung.

## Demo & Tests

Das System ist in `main.js` bereits vollständig integriert und wird automatisch geladen.

### Verwendung im iweb-Projekt
```js
// In main.js bereits integriert:
import { init3DStarsSimple } from './particles/stars-utils.js';

// Automatische Initialisierung mit Fallbacks
await init3DStarsSimple();
```

Das System lädt automatisch Three.js und initialisiert beide Partikelsysteme mit robusten Fallback-Mechanismen.
