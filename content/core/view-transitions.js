/**
 * View Transitions API - Progressive Enhancement
 *
 * Bietet eine saubere Utility-Funktion `withViewTransition()` zum Wrappen
 * beliebiger DOM-Mutationen in eine View Transition (Crossfade/Morph).
 *
 * Diese Datei enthält KEIN SPA-Routing. Navigation zwischen Unterseiten
 * wird komplett dem Browser überlassen (normaler MPA-Seitenaufruf).
 *
 * @version 3.1.0
 */

import { handleSamePageScroll } from './utils.js';

/**
 * Check if the View Transitions API is supported
 * @returns {boolean}
 */
export const isSupported = () =>
  typeof document.startViewTransition === 'function';

/**
 * Wrap a DOM mutation in a View Transition if supported.
 * Falls back to executing the callback directly if VT is not available.
 *
 * @param {() => void | Promise<void>} callback - DOM mutation function
 * @param {object} [options]
 * @param {string[]} [options.types] - Transition type hints (e.g. ['chat-open'])
 * @returns {Promise<void>}
 */
export async function withViewTransition(callback, options = {}) {
  if (!isSupported()) {
    await callback();
    return;
  }
  try {
    // Präferiert die Object-Form (Chrome 126+) für Typed-VTs,
    // Fallback auf Function-Form + manuelle types.
    let transition;
    const hasObjectForm = (() => {
      try {
        // Feature-detect: object form throws if not supported
        return typeof ViewTransition !== 'undefined';
      } catch {
        return false;
      }
    })();

    if (options.types?.length && hasObjectForm) {
      try {
        transition = document.startViewTransition({
          update: () => callback(),
          types: options.types,
        });
      } catch {
        // Object-Form nicht unterstützt, Fallback
        transition = document.startViewTransition(() => callback());
      }
    } else {
      transition = document.startViewTransition(() => callback());
    }

    // Fallback: types manuell setzen (Chrome 125)
    if (options.types && transition.types && !transition.types.size) {
      for (const t of options.types) transition.types.add(t);
    }

    await transition.finished;
  } catch {
    // VT fehlgeschlagen — Callback direkt ausführen (Progressive Enhancement)
    await callback();
  }
}

/**
 * Initialize View Transitions — nur Same-Page-Scroll-Handling.
 * Kein SPA-Swap, keine Interceptors für Seitennavigation.
 */
export function initViewTransitions() {
  // Same-page scroll-to-top bei Klick auf Home-Links
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href]');
    if (!link) return;

    try {
      const url = new URL(link.href, location.origin);
      if (url.origin !== location.origin) return;

      if (handleSamePageScroll(url.href)) {
        e.preventDefault();
      }
    } catch {
      // Ungültige URL — ignorieren
    }
  });
}
