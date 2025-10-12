# Card Starfield Animation System

## Bidirektionale Partikel-Animation (v2.0)

Das Card-Animations-System verwendet Canvas-basierte Partikel-Animationen, die sich bidirektional verhalten:

### Forward Animation: Partikel → Cards
**Trigger:** Beim Scrollen zu Section 2 (`#features`)
- **Threshold:** 75% Sichtbarkeit (SNAP_THRESHOLD)
- **Duration:** 1400ms
- **Behavior:** 
  - Partikel formieren sich von random Positionen zu Card-Konturen
  - Cards materialisieren synchron mit blur → sharp Transition
  - CSS Animation: `cards-appear-with-starfield`
  - Easing: `cubic-bezier(0.22, 1, 0.36, 1)` (ease-out-expo)

### Reverse Animation: Cards → Partikel
**Trigger:** Beim Wegscrollen von Section 2
- **Threshold:** <85% Sichtbarkeit (REVERSE_THRESHOLD) 
- **Duration:** 800ms (schneller für snappier feel)
- **Behavior:**
  - Cards dematerialisieren mit sharp → blur Transition
  - Partikel bewegen sich von Card-Positionen zu random Positionen
  - CSS Animation: `cards-dematerialize`
  - Easing: `cubic-bezier(0.22, 1, 0.36, 1)` (gleiche Kurve)

## Technische Details

### Konfiguration
```javascript
const SNAP_THRESHOLD = 0.75;      // Forward bei 75% Sichtbarkeit
const REVERSE_THRESHOLD = 0.85;   // Reverse bei <85% (früher triggern!)
const ANIMATION_DURATION = 1400;  // Forward: 1.4s
const REVERSE_DURATION = 800;     // Reverse: 0.8s (faster)
```

### IntersectionObserver Thresholds
```javascript
[0, 0.1, 0.25, 0.5, 0.6, 0.65, 0.75, 0.85, 1]
```
- Precision Points bei 0.75 (Forward) und 0.85 (Reverse)
- Scroll Handler für zusätzliche Präzision

### Partikel-Count
- **Desktop:** 150 Partikel
- **Mobile:** 60 Partikel (Performance)

### State Management
```javascript
hasAnimated    // true nach Forward-Animation
isReversing    // true während Reverse-Animation läuft
```

### CSS Class States
- `cards-hidden` - Initial State
- `starfield-animating` - Während Animation (Forward oder Reverse)
- `cards-materializing` - Während Reverse (Cards verschwinden)
- `cards-visible` - Nach Forward-Animation (Cards komplett sichtbar)

## Workflow

### Scroll Down (zu Section 2)
1. Section wird sichtbar (ratio < 0.75)
2. Bei ratio >= 0.75: **Forward Animation triggert**
3. Canvas wird erstellt
4. 150/60 Partikel initialisiert (random → card positions)
5. Animation läuft 1400ms
6. State: `hasAnimated = true`, CSS: `cards-visible`

### Scroll Away (von Section 2 weg)
1. Section verlässt Viewport (ratio < 0.85)
2. **Reverse Animation triggert** (früher als Forward!)
3. CSS-Klasse: `cards-materializing` + `starfield-animating`
4. Canvas wird erstellt
5. Partikel initialisiert (card positions → random)
6. Animation läuft 800ms
7. State Reset: `hasAnimated = false`, CSS: `cards-hidden`

## Performance

### Optimierungen
- DPR-aware Canvas (max 2x für Performance)
- `desynchronized: true` Context für bessere Performance
- `will-change` auf `.features-cards`
- Throttled Scroll Handler (100ms)
- RequestAnimationFrame für smooth 60fps

### Mobile
- Reduzierte Partikel-Count (60 statt 150)
- `prefers-reduced-motion` Support (200ms fade-only)

## Debugging

```javascript
// Console Debugging
window.FeatureRotation.debug.getState()
// → { hasAnimated, isReversing, loaded, currentTemplate }

window.FeatureRotation.debug.forceAnimation()
// → Force Forward-Animation manuell

// Logger aktivieren
localStorage.setItem('iweb-debug', 'true')
```

## Synchronisation mit Three.js Earth

Das System ist inspiriert von `three-earth-system.js`:
- Gleiche Timing-Werte (1400ms TRANSITION_DURATION)
- Gleiche Easing Curves
- Ähnlicher Twinkle-Effekt (0.25 speed)
- Canvas-basiertes Rendering

## Browser Support

- **Minimum:** Canvas 2D, IntersectionObserver, RequestAnimationFrame
- **Fallback:** Bei fehlenden APIs → Direkte Card-Anzeige ohne Animation
