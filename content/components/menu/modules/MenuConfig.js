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
    '/index.html': 'menu.home',
    '/': 'menu.home',
    '/gallery/': 'menu.gallery',
    '/projekte/': 'menu.projects',
    '/videos/': 'menu.videos',
    '/blog/': 'menu.blog',
    '/about/': 'menu.about',
  },

  // Fallback Titles
  FALLBACK_TITLES: {
    hero: { title: 'menu.home', subtitle: '' },
    features: { title: 'menu.projects', subtitle: 'footer.work.projects' },
    section3: { title: 'menu.about', subtitle: 'footer.about.title' },
    contact: { title: 'menu.contact', subtitle: 'menu.contact_subtitle' },
  },

  // Menu Items Configuration
  MENU_ITEMS: [
    { href: '/', icon: 'house', fallback: '🏠', label: 'menu.home' },
    {
      href: '/projekte/',
      icon: 'projects',
      fallback: '📁',
      label: 'menu.projects',
    },
    {
      href: '/gallery/',
      icon: 'gallery',
      fallback: '📷',
      label: 'menu.gallery',
    },
    { href: '/videos/', icon: 'video', fallback: '🎬', label: 'menu.videos' },
    { href: '/blog/', icon: 'blog', fallback: '📝', label: 'menu.blog' },
    { href: '/about/', icon: 'user', fallback: '🧑', label: 'menu.about' },
    {
      href: '#site-footer',
      icon: 'mail',
      fallback: '✉️',
      label: 'menu.contact',
      attrs: 'data-footer-trigger aria-expanded="false"',
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
    FALLBACK_TITLES: {
      ...MenuConfig.FALLBACK_TITLES,
      ...customConfig.FALLBACK_TITLES,
    },
  };
}
