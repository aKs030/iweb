/**
 * TypeWriter Layout Optimization Guide
 * 
 * PROBLEM:
 * TypeWriter.js ruft getBoundingClientRect() 7+ mal direkt nach innerHTML-Änderungen.
 * Dies verursacht Forced Reflows (13ms laut Lighthouse).
 * 
 * LÖSUNGEN IMPLEMENTIERT:
 * 
 * 1. CSS-Reservierung (✅ bereits implementiert in index.html):
 *    - .typewriter-title erhält min-height: var(--box-h, 2.2em)
 *    - Verhindert Layout Shift beim Textumbruch
 * 
 * 2. Layout-Batching (benötigt Refactoring der minifizierten Datei):
 *    Die Funktion S(h) in TypeWriter.js sollte umgebaut werden:
 * 
 *    VORHER (mehrere Reads nach Writes):
 *    ```javascript
 *    t.innerHTML = ''; // WRITE
 *    const rect = h.getBoundingClientRect(); // READ -> Forced Reflow!
 *    t.style.width = e + 'px'; // WRITE
 *    const height = o.getBoundingClientRect().height; // READ -> Forced Reflow!
 *    ```
 * 
 *    NACHHER (gebatchte Reads):
 *    ```javascript
 *    // Erst alle Reads
 *    const parentRect = h.getBoundingClientRect();
 *    const computedStyle = getComputedStyle(h);
 *    
 *    // Dann alle Writes
 *    requestAnimationFrame(() => {
 *      t.innerHTML = '';
 *      t.style.width = calculatedWidth + 'px';
 *      // ... weitere Writes
 *    });
 *    ```
 * 
 * 3. Rect-Caching:
 *    Nutze RectCache aus layout-optimizer.js für wiederholte Messungen:
 *    ```javascript
 *    import { rectCache } from '../../utils/layout-optimizer.js';
 *    const rect = rectCache.get(element); // Cached für ein Frame
 *    ```
 * 
 * MESSWERTE VORHER:
 * - TypeWriter.js Reflows: 10ms + 33ms + 14ms = ~57ms gesamt
 * - 7 separate getBoundingClientRect() Calls
 * 
 * ERWARTETE VERBESSERUNG:
 * - Reduktion auf 1-2 batched Reads
 * - ~80% Reduktion der Reflow-Zeit
 * - Keine Layout Shifts mehr durch min-height Reservierung
 * 
 * NEXT STEPS FÜR PRODUKTIV:
 * 1. TypeWriter.js de-minifizieren (oder Source-Map nutzen)
 * 2. Layout-Batching implementieren
 * 3. Re-build mit npm run build:brotli
 * 4. Lighthouse erneut messen
 * 
 * @author Layout Performance Team
 * @date 2026-01-02
 */

// Export für spätere Verwendung
export const TYPEWRITER_OPTIMIZATION_NOTES = {
  reflows: {
    before: '~57ms total (7 calls)',
    target: '~10ms total (1-2 batched calls)',
    reduction: '80%'
  },
  cls: {
    before: 'Variable (abhängig von Textlänge)',
    after: '0 (min-height Reservierung)'
  },
  status: 'CSS fixes applied, JS refactoring needed'
};
