# 🎴 Card Rotation & Starfield Animation

Canvas-basierte Partikel-Animation für Card-Materialisierung mit **500 Partikeln** und strategischer Edge-Distribution für sichtbare Card-Konturen.

---

## ✨ Features

- ✅ **500 Partikel (Desktop) / 200 (Mobile)** - Dichte, sichtbare Card-Formation
- ✅ **Edge-Focus (60%)** - 300 Partikel bilden klare Card-Konturen
- ✅ **"Hold Shape then Materialize"** - Zweiphasige Reverse-Animation
- ✅ **60fps Performance** - Canvas GPU-optimiert mit DPR-Capping
- ✅ **Bidirektional** - Forward (Partikel → Card) & Reverse (Card → Partikel)
- ✅ **Accessibility** - Reduced Motion Support

---

## 🚀 Integration

Der SectionLoader aus `content/webentwicklung/main.js` lädt die Feature-Section automatisch nach `#features`. Das Modul initialisiert sich beim ersten Laden selbst (IIFE mit `window.FeatureRotation` Guard), ein manuelles Importieren ist nicht notwendig.

### HTML
```html
<section id="features" data-section-src="/pages/card/karten.html" data-eager="true"></section>
```

### CSS
```html
<link rel="stylesheet" href="/pages/card/karten-star-animation.css">
```

---

## ⚙️ Configuration

```javascript
// In karten-rotation.js
const STARFIELD_CONFIG = {
  PARTICLE_COUNT_DESKTOP: 500,
  PARTICLE_COUNT_MOBILE: 200,
  EDGE_PARTICLE_RATIO: 0.6,
  ANIMATION_DURATION: 1400,
  REVERSE_DURATION: 800,
  HOLD_PHASE_DURATION: 0.4,
  TWINKLE_SPEED: 0.25,
};
```

---

## 🎬 Animation Flow

### Forward Animation (Partikel → Card)
```
0ms ────────────────────────────────────────────→ 1400ms
     500 Partikel fliegen zusammen
     ├─ 300 Edge-Partikel → Card-Konturen (sichtbare Kanten)
     └─ 200 Fill-Partikel → Card-Füllung (innere Details)
     
     → Cards materialisieren AUS Partikel-Formation
```

### Reverse Animation (Card → Partikel)
```
0ms ────────── 320ms ──────────────────────────→ 800ms
    Cards fade    PEAK!              Dispersion
    (0-40%)      (40%)               (40-100%)
                   │
                   └─ 500 Partikel halten Card-Form
                      Edge-Kontur deutlich sichtbar!
                      → Dann explosionsartige Dispersion
```

---

## 📊 Partikel-Verteilung

### Strategische Edge-Distribution

```
┌─────────────────────────────┐
│ ●●●●●●●●●●●●●●●●●●●●●●●●●● │ ← Top Edge (75 Partikel, 10px Band)
│●                           ●│ ← Left/Right Edges (75 pro Seite)
│●  ● ● ● ●  ● ●  ●  ●  ●   ●│ ← Fill Partikel (200 total)
│●   ●  ●  ●   ●  ●  ●  ●   ●│
│●  ●  ●  ●  ●    ●  ●  ●   ●│
│●    ●  ●  ●  ●  ●   ●  ●  ●│
│ ●●●●●●●●●●●●●●●●●●●●●●●●●● │ ← Bottom Edge (75 Partikel)
└─────────────────────────────┘

Total: 500 Partikel
├─ 300 Edge-Partikel (60%) → Größe 1.2-2.2px → Sichtbare Kontur
└─ 200 Fill-Partikel (40%) → Größe 0.8-1.8px → Subtile Füllung
```

**Warum Edge-Focus?**
- Edge-Partikel bilden klare, sichtbare Card-Konturen
- Beim Auflösen sieht man die Card-Form deutlich "zerfallen"
- Weniger Partikel nötig für maximalen visuellen Impact

---

## 🎯 "Hold Shape then Materialize" Effekt

Die Reverse-Animation nutzt einen zweiphasigen Ansatz:

### Phase 1: HOLD (0-40% = 0-320ms)
- Cards blenden komplett aus
- **500 Partikel HALTEN Card-Form**
- Edge-Partikel bilden sichtbare Kontur
- **Peak-Moment bei 40%**: Card komplett aus Partikeln sichtbar!

### Phase 2: RELEASE (40-100% = 320-800ms)
- Partikel dispersieren explosionsartig (ease-in-cubic)
- Opacity fade-out (-50%)
- Größe wächst (+50% für "Stern"-Effekt)

---

## 🔧 Technische Details

### Partikel-System

```javascript
// Edge-Partikel-Logic (60% der Partikel)
const edge = Math.floor(Math.random() * 4); // Top/Right/Bottom/Left

switch (edge) {
  case 0: // Top Edge
    targetX = cardRelX + edgeOffset * cardRect.width;
    targetY = cardRelY + Math.random() * 10; // 10px Band
    break;
  // ... weitere Edges
}

// Größen-Differenzierung
const isEdgeParticle = i < edgeParticleCount;
const baseSize = isEdgeParticle ? 1.2 : 0.8;  // Edge 50% größer
const size = baseSize + Math.random() * 1.0;
```

### Performance-Optimierungen

- **Canvas-basiert** statt DOM-Manipulation
- **GPU-optimiert**: `desynchronized: true`
- **DPR-Capping**: `Math.min(devicePixelRatio, 2)`
- **Single RAF-Loop**: Alle Partikel in einem Frame
- **Twinkle via Math.sin**: Keine separate Animation-Loops

### Expected Performance

```
Desktop (500 Partikel):
- Frame Time: ~8-12ms
- FPS: 55-60fps (smooth)
- Memory: ~2MB

Mobile (200 Partikel):
- Frame Time: ~12-16ms
- FPS: 40-60fps
- Memory: ~1MB
```

---

## 🧪 Testing

```bash
# Lokal testen
open index.html

# 1. Forward Animation
#    → Scroll zu Features Section
#    → Beobachte 500 Partikel Card-Konturen formen
#    → Achte auf sichtbare Edges

# 2. Reverse Animation
#    → Scroll weg von Section
#    → Bei 40% (Peak): Siehst du die Card aus Partikeln?
#    → Dann: Partikel dispersieren explosionsartig
```

### Performance Check (Chrome DevTools)
```javascript
// 1. F12 → Performance Tab
// 2. Record während Animation
// 3. Prüfe FPS (sollte 55-60fps sein)
// 4. Memory Timeline (sollte stabil bleiben)
```

---

## 📦 Files

```
pages/card/
├── karten-rotation.js          # Main Animation Logic (500 Partikel + Edge-System)
├── karten-star-animation.css   # CSS Animations (cards-appear, cards-dematerialize)
├── karten.html                 # Card Templates (template-features-2-5)
└── README.md                   # Diese Datei
```

---

## 🔔 Events

Auf das Mounten eines Templates hören (wird nach der Forward-Animation gefeuert):

```javascript
import { EVENTS, on } from '/content/webentwicklung/shared-utilities.js';

on(
  EVENTS.TEMPLATE_MOUNTED,
  (e) => {
    const { templateId } = e.detail || {};
    // eigene Logik, z. B. Analytics oder Nachladen
    console.debug('[Features] Template mounted:', templateId);
  },
  undefined,
  document.getElementById('features') // event target (section)
);
```

Verfügbare Events im Kontext der Features:
- `EVENTS.FEATURES_TEMPLATES_LOADED`
- `EVENTS.FEATURES_TEMPLATES_ERROR`
- `EVENTS.TEMPLATE_MOUNTED`
- `EVENTS.FEATURES_CHANGE`

---

## 🎨 Customization

### Partikel-Count anpassen

```javascript
PARTICLE_COUNT_DESKTOP: 800,
PARTICLE_COUNT_MOBILE: 300,
```

### Edge-Ratio ändern

```javascript
EDGE_PARTICLE_RATIO: 0.7,
EDGE_PARTICLE_RATIO: 0.5,
```

### Hold-Phase verlängern

```javascript
HOLD_PHASE_DURATION: 0.5,
REVERSE_DURATION: 1000,
```

### Glow-Effekt verstärken

```javascript
starfieldContext.shadowBlur = size * 4;
```

---

## ♿️ Accessibility

### Reduced Motion Support

```javascript
if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  // Direkt zu hidden-State, KEINE Partikel-Animation
  section.classList.remove('starfield-animating');
  section.classList.add('cards-hidden');
  // → Instant transition, 0ms Animation
}
```

### Screen Reader

```html
<div aria-live="polite" aria-atomic="true" class="sr-only">
  Feature: [Template ID]
</div>
```

---

## 🐛 Troubleshooting

### Partikel nicht sichtbar?
- ✅ Canvas DPR richtig gesetzt? (Check: `canvas.width` vs `canvas.style.width`)
- ✅ Z-Index korrekt? (Canvas sollte `z-index: 1001` haben)
- ✅ Section im Viewport? (IntersectionObserver threshold: 0.75)

### Performance-Probleme?
- ✅ DPR-Capping aktiv? (sollte max 2× sein)
- ✅ Zu viele Partikel für Device? (Mobile: 200 statt 500)
- ✅ Andere Animationen laufen parallel? (z.B. Three.js Earth)

### Animation triggert nicht?
- ✅ `hasAnimated` State korrekt? (Reset bei Reverse Complete)
- ✅ IntersectionObserver threshold erreicht? (75% Sichtbarkeit)
- ✅ Console Logs prüfen (`?debug=true` für verbose logging)

---

## 📚 Related Documentation

- `/content/webentwicklung/particles/three-earth-system.js` - Three.js Earth mit ähnlichem Partikel-Pattern
- `/content/webentwicklung/shared-utilities.js` - Shared Logger, TimerManager, Events
- `/.github/copilot-instructions.md` - Projekt-Architektur & Conventions

---

**Version**: 2.0 (Enhanced Particle System)  
**Last Updated**: 15. Oktober 2025  
**Author**: Portfolio System
---

