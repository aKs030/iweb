/**
 * Menu Configuration
 * Centralized configuration for easy customization
 */

// shared title objects (DRY and easier renaming)
const HOME_TITLE = { title: 'menu.home', subtitle: 'menu.home_sub' };
const CONTACT_TITLE = { title: 'menu.contact', subtitle: 'menu.contact_sub' };

export const MenuConfig = {
  // Paths
  CSS_URLS: [
    '/content/components/menu/menu.css',
    '/content/components/menu/menu-responsive.css',
    '/content/components/menu/menu-backdrop.css',
  ],
  SHADOW_CSS_URLS: [
    '/content/components/menu/menu.css',
    '/content/components/menu/menu-responsive.css',
  ],
  GLOBAL_CSS_URLS: ['/content/components/menu/menu-backdrop.css'],

  // Timing
  DEBOUNCE_DELAY: 100,
  ANNOUNCEMENT_DELAY: 100,
  SEARCH_DEBOUNCE: 220,
  SEARCH_MIN_QUERY_LENGTH: 2,
  SEARCH_REQUEST_TIMEOUT: 6000,
  SEARCH_TOP_K: 12,

  // Breakpoints (must match menu-responsive.css media queries)
  MOBILE_BREAKPOINT: 900,
  TABLET_BREAKPOINT: 900,

  // Title Mapping
  TITLE_MAP: {
    '/index.html': HOME_TITLE,
    '/': HOME_TITLE,
    '/gallery/': { title: 'menu.gallery', subtitle: 'menu.gallery_sub' },
    '/projekte/': { title: 'menu.projects', subtitle: 'menu.projects_sub' },
    '/videos/': { title: 'menu.videos', subtitle: 'menu.videos_sub' },
    '/blog/': { title: 'menu.blog', subtitle: 'menu.blog_sub' },
    '/about/': { title: 'menu.about', subtitle: 'menu.about_sub' },
    '/contact/': CONTACT_TITLE,
  },

  // Fallback Titles
  FALLBACK_TITLES: {
    hero: HOME_TITLE,
    features: { title: 'menu.projects', subtitle: 'menu.projects_sub' },
    section3: { title: 'menu.about', subtitle: 'menu.about_sub' },
    contact: CONTACT_TITLE,
    footer: CONTACT_TITLE,
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

  // Runtime
  ICON_CHECK_DELAY: 100,
};
