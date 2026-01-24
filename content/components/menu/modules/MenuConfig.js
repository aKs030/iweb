/**
 * Menu Configuration
 * Centralized configuration for easy customization
 */

export const MenuConfig = {
  // Paths
  CSS_URL: '/content/components/menu/menu.css',
  
  // Timing
  ANIMATION_DURATION: 400,
  DEBOUNCE_DELAY: 150,
  OBSERVER_TIMEOUT: 3000,
  
  // Breakpoints
  MOBILE_BREAKPOINT: 768,
  TABLET_BREAKPOINT: 900,
  
  // Features
  ENABLE_ANALYTICS: false,
  ENABLE_PERSISTENCE: false,
  ENABLE_DEBUG: false,
  
  // Title Mapping
  TITLE_MAP: {
    '/index.html': 'Startseite',
    '/': 'Startseite',
    '/gallery/': 'Fotos',
    '/projekte/': 'Projekte',
    '/videos/': 'Videos',
    '/blog/': 'Blog',
    '/about/': 'Über mich',
  },
  
  // Fallback Titles
  FALLBACK_TITLES: {
    hero: { title: 'Startseite', subtitle: '' },
    features: { title: 'Projekte', subtitle: 'Meine Arbeiten' },
    section3: { title: 'Über mich', subtitle: 'Lerne mich kennen' },
    contact: { title: 'Kontakt', subtitle: 'Schreiben Sie mir' },
  },
  
  // Menu Items Configuration
  MENU_ITEMS: [
    { href: '/', icon: 'house', fallback: '🏠', label: 'Startseite' },
    { href: '/projekte/', icon: 'projects', fallback: '📁', label: 'Projekte' },
    { href: '/gallery/', icon: 'gallery', fallback: '📷', label: 'Fotos' },
    { href: '/videos/', icon: 'video', fallback: '🎬', label: 'Videos' },
    { href: '/blog/', icon: 'blog', fallback: '📝', label: 'Blog' },
    { href: '/about/', icon: 'user', fallback: '🧑', label: 'Über mich' },
    { 
      href: '#site-footer', 
      icon: 'mail', 
      fallback: '✉️', 
      label: 'Kontakt',
      attrs: 'data-footer-trigger aria-expanded="false"'
    },
  ],
  
  // Performance
  MAX_LOG_ENTRIES: 20,
  ICON_CHECK_DELAY: 100,
  TITLE_TRANSITION_DELAY: 200,
};

// Merge with custom config
export function createConfig(customConfig = {}) {
  return {
    ...MenuConfig,
    ...customConfig,
    TITLE_MAP: { ...MenuConfig.TITLE_MAP, ...customConfig.TITLE_MAP },
    FALLBACK_TITLES: { ...MenuConfig.FALLBACK_TITLES, ...customConfig.FALLBACK_TITLES },
  };
}
