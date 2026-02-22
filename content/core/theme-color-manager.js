/**
 * Theme Color Manager - Central management for browser theme color
 * Ensures consistent transparent browser bar across all pages
 * @version 1.0.0
 */

const THEME_COLORS = {
  dark: 'rgba(3, 3, 3, 0.01)',
  light: 'rgba(30, 58, 138, 0.01)',
  // Fallback fully transparent hex (some browsers ignore rgba alpha)
  transparentHex: '#00000000',
};

/**
 * Get current theme color based on data-theme attribute
 * @returns {string} RGBA color value
 */
function getThemeColor() {
  const theme = document.documentElement.getAttribute('data-theme');
  return theme === 'light' ? THEME_COLORS.light : THEME_COLORS.dark;
}

/**
 * Update all theme-color meta tags
 */
function updateThemeColorMetas() {
  // Update all existing theme-color metas to avoid duplicates/conflicts
  const themeMetas = document.querySelectorAll('meta[name="theme-color"]');

  if (themeMetas.length === 0) {
    // Create a single fallback meta if none exists
    const meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    meta.id = 'meta-theme-color-fallback';
    meta.setAttribute('content', THEME_COLORS.transparentHex);
    document.head.appendChild(meta);
  } else {
    // Always set a conservative, fully-transparent hex value to maximize
    // compatibility across browsers (some ignore rgba alpha values).
    themeMetas.forEach((m) => {
      try {
        m.setAttribute('content', THEME_COLORS.transparentHex);
      } catch {
        /* ignore */
      }
    });
  }
}

/**
 * Initialize theme color management
 * Sets up observer for automatic updates on theme changes
 */
export function initThemeColorManager() {
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      updateThemeColorMetas(getThemeColor());
    });
  } else {
    updateThemeColorMetas(getThemeColor());
  }

  // Observe theme changes
  const observer = new MutationObserver(() => {
    updateThemeColorMetas(getThemeColor());
  });

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });

  // React to page-level changes (SPA navigation) to re-apply meta updates
  try {
    window.addEventListener('page:changed', () => {
      updateThemeColorMetas(getThemeColor());
    });
  } catch {
    // ignore in non-browser contexts
  }

  return observer;
}

/**
 * Manually update theme color (for external use)
 */
export function updateThemeColor() {
  updateThemeColorMetas(getThemeColor());
}
