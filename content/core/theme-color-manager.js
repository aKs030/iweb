/**
 * Theme Color Manager
 * Keeps browser chrome fully transparent on all pages via theme-color meta.
 * Uses #00000000 (fully-transparent hex) for maximum cross-browser compat —
 * some browsers ignore rgba alpha, hex alpha is universally understood.
 *
 * @version 1.1.0
 */

/** Fully-transparent hex works in Chrome, Safari, Firefox and PWA contexts. */
const TRANSPARENT = '#00000000';

/** Ensure all theme-color metas carry the transparent value. */
function applyTransparentThemeColor() {
  const metas = document.querySelectorAll('meta[name="theme-color"]');
  if (metas.length === 0) {
    const meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    meta.id = 'meta-theme-color-fallback';
    meta.setAttribute('content', TRANSPARENT);
    document.head.appendChild(meta);
  } else {
    metas.forEach((m) => {
      try {
        m.setAttribute('content', TRANSPARENT);
      } catch {
        /* read-only meta in some contexts — ignore */
      }
    });
  }
}

/**
 * Initialize theme color management.
 * Returns the MutationObserver so callers can disconnect it if needed.
 * @returns {MutationObserver}
 */
export function initThemeColorManager() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyTransparentThemeColor, {
      once: true,
    });
  } else {
    applyTransparentThemeColor();
  }

  // Re-apply after theme toggle (data-theme attribute change)
  const observer = new MutationObserver(applyTransparentThemeColor);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });

  // Re-apply after SPA page swaps
  window.addEventListener('page:changed', applyTransparentThemeColor);

  return observer;
}

/** Public alias for external callers (e.g. view-transitions). */
export const updateThemeColor = applyTransparentThemeColor;
