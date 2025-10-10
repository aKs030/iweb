# 🎴 Card Rotation & Starfield Animation

Canvas-basierte Partikel-Animation für Card-Materialisierung.

---

## Quick Start

### Integration
```javascript
import { init } from './pages/card/karten-rotation.js';
init(); // Auto-initializes when section visible
```

### HTML
```html
<section id="features" data-section-src="/pages/card/karten.html">
  <div class="features-cards"></div>
</section>
```

### CSS
```html
<link rel="stylesheet" href="/pages/card/karten-star-animation.css">
```

---

## Configuration

```javascript
// In karten-rotation.js
const STARFIELD_CONFIG = {
  PARTICLE_COUNT_DESKTOP: 150,
  PARTICLE_COUNT_MOBILE: 60,
  ANIMATION_DURATION: 1400,
  REVERSE_DURATION: 1000,
};
```

---

## Features

- ✅ Synchrone Animation (Partikel + Cards gleichzeitig)
- ✅ Bidirektional (Forward + Reverse)
- ✅ 60fps Performance
- ✅ Responsive (150/60 Partikel)
- ✅ Accessibility (prefers-reduced-motion)

---

## Performance

| Device | Particles | FPS |
|--------|-----------|-----|
| Desktop | 150 | 60fps |
| Mobile | 60 | 60fps |

---

## API

```javascript
init()              // Initialize system
destroy()           // Complete teardown
mountInitialCards() // Set initial state
```

---

**Docs:** `DOCUMENTATION.md` (Technical Reference)  
**Version:** 2.0.0  
**Status:** Production Ready
  
