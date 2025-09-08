# Enhanced Animation Engine

Hochperformantes, flexibles Animationssystem für On-Scroll- und Template-Animations.

## Features
- IntersectionObserver + MutationObserver
- Per-Element Threshold und globales `repeatOnScroll`
- `data-once` für Einmal-Animationen
- Idle-Batching, deduplizierte Beobachtung, zentrale Selektoren
- Robustes Dauer-Parsing (Sekunden/Millisekunden)

## Nutzung
- Engine laden (bereits in `index.html` eingebunden)
- Typische Attribute an Elementen:
  - `data-animation` oder `data-animate`: Typ (z. B. `slideInLeft`, `fadeInUp`, `scaleIn`)
  - `data-delay`: Verzögerung in ms (z. B. `300`)
  - `data-duration`: Dauer in s oder ms (z. B. `0.6`, `600`, `"600ms"`, `"0.6s"`)
  - `data-easing`: CSS easing (z. B. `ease-out`, `cubic-bezier(...)`)
  - `data-threshold`: Sichtbarkeits-Schwelle (0..1)
  - `data-reset`: `true`/`false` überschreibt globales Repeat-Verhalten
  - `data-once`: ohne Wert oder `true` = nur einmal animieren

Beispiel:
<div data-animation="slideInLeft" data-delay="200" data-once></div>

## API (global über `window.enhancedAnimationEngine`)
- `scan()` – DOM neu scannen
- `animateElementsIn(container, { force })` – Container-Inhalt animieren
- `resetElementsIn(container)` – Container-Inhalt zurücksetzen
- `resetSection(section)` – Section hart zurücksetzen (für Template-Wechsel)
- `handleTemplateChange(section)` – Template-Wechsel-Integration
- `setRepeatOnScroll(bool)` – Globales Wiederholungsverhalten

## Best Practices
- Dynamische Bereiche (z. B. Feature-Templates) nicht mit `data-once` markieren, damit Re-Animationen möglich sind.
- Statische Reveals (Hero, About) mit `data-once` versehen.
- Bei reduzierter Bewegung (prefers-reduced-motion) arbeitet die Engine im Schonmodus.

## Troubleshooting
- Keine Animation? Prüfe `data-animations="off"` am Vorfahren, Threshold, und `repeatOnScroll`/`data-reset`.
- Doppel-Animationen? Stelle sicher, dass keine alten CSS-Transitions (z. B. karten-animations.css) eingebunden sind.
