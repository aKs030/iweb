/**
 * Menu Configuration
 * Centralized configuration for easy customization
 */

export const MenuConfig = {
  // Paths
  CSS_URL: '/content/components/menu/menu.css',

  // Timing (aligned with menu.css transitions / JS behavior)
  ANIMATION_DURATION: 400,
  DEBOUNCE_DELAY: 100,
  ANNOUNCEMENT_DELAY: 100,
  OBSERVER_TIMEOUT: 3000,
  SEARCH_DEBOUNCE: 220,
  SEARCH_MIN_QUERY_LENGTH: 2,
  SEARCH_REQUEST_TIMEOUT: 6000,
  SEARCH_TOP_K: 12,

  // Breakpoints (must match menu.css media queries)
  MOBILE_BREAKPOINT: 900,
  TABLET_BREAKPOINT: 900,
  SUBTITLE_HIDE_BREAKPOINT: 1024,
  SMALL_BREAKPOINT: 480,

  // Features
  ENABLE_ANALYTICS: false,
  ENABLE_PERSISTENCE: false,
  ENABLE_DEBUG: false,

  // Title Mapping
  TITLE_MAP: {
    '/index.html': { title: 'menu.home', subtitle: 'menu.home_sub' },
    '/': { title: 'menu.home', subtitle: 'menu.home_sub' },
    '/gallery/': { title: 'menu.gallery', subtitle: 'menu.gallery_sub' },
    '/projekte/': { title: 'menu.projects', subtitle: 'menu.projects_sub' },
    '/videos/': { title: 'menu.videos', subtitle: 'menu.videos_sub' },
    '/blog/': { title: 'menu.blog', subtitle: 'menu.blog_sub' },
    '/about/': { title: 'menu.about', subtitle: 'menu.about_sub' },
    '/contact/': { title: 'menu.contact', subtitle: 'menu.contact_sub' },
  },

  // Fallback Titles
  FALLBACK_TITLES: {
    hero: { title: 'menu.home', subtitle: 'menu.home_sub' },
    features: { title: 'menu.projects', subtitle: 'menu.projects_sub' },
    section3: { title: 'menu.about', subtitle: 'menu.about_sub' },
    contact: { title: 'menu.contact', subtitle: 'menu.contact_sub' },
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
  ],

  // Performance
  MAX_LOG_ENTRIES: 20,
  ICON_CHECK_DELAY: 100,
  TITLE_TRANSITION_DELAY: 200,
};
