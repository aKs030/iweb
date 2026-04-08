/**
 * Menu Configuration
 * Centralized configuration for easy customization
 */

/**
 * @typedef {import('../../../core/types.js').CssUrlList} CssUrlList
 */

/**
 * @typedef {Object} MenuTitleEntry
 * @property {string} title
 * @property {string} subtitle
 */

/**
 * @typedef {Record<string, MenuTitleEntry>} MenuTitleMap
 */

/**
 * @typedef {Object} MenuItemConfig
 * @property {string} href
 * @property {string} icon
 * @property {string} fallback
 * @property {string} label
 * @property {string} [attrs]
 */

/**
 * @typedef {Object} MenuComponentConfig
 * @property {CssUrlList} CSS_URLS
 * @property {CssUrlList} SHADOW_CSS_URLS
 * @property {CssUrlList} GLOBAL_CSS_URLS
 * @property {number} DEBOUNCE_DELAY
 * @property {number} ANNOUNCEMENT_DELAY
 * @property {number} SEARCH_DEBOUNCE
 * @property {number} SEARCH_MIN_QUERY_LENGTH
 * @property {number} SEARCH_REQUEST_TIMEOUT
 * @property {number} SEARCH_AI_REQUEST_TIMEOUT
 * @property {number} SEARCH_TOP_K
 * @property {number} [SEARCH_CACHE_TTL_MS]
 * @property {number} [SEARCH_CACHE_MAX_ENTRIES]
 * @property {number} MOBILE_BREAKPOINT
 * @property {number} TABLET_BREAKPOINT
 * @property {MenuTitleMap} TITLE_MAP
 * @property {MenuTitleMap} FALLBACK_TITLES
 * @property {MenuItemConfig[]} MENU_ITEMS
 * @property {number} ICON_CHECK_DELAY
 * @property {string} [DOM_ID_PREFIX]
 */

// shared title objects (DRY and easier renaming)
/** @type {MenuTitleEntry} */
const HOME_TITLE = { title: 'menu.home', subtitle: 'menu.home_sub' };
/** @type {MenuTitleEntry} */
const CONTACT_TITLE = { title: 'menu.contact', subtitle: 'menu.contact_sub' };

/** @type {MenuComponentConfig} */
export const MenuConfig = {
  // Paths
  CSS_URLS: [
    '/content/components/menu/menu-base.css',
    '/content/components/menu/menu-search.css',
    '/content/components/menu/menu-states.css',
    '/content/components/menu/menu-mobile.css',
    '/content/components/menu/menu-backdrop.css',
  ],
  SHADOW_CSS_URLS: [
    '/content/components/menu/menu-base.css',
    '/content/components/menu/menu-search.css',
    '/content/components/menu/menu-states.css',
    '/content/components/menu/menu-mobile.css',
  ],
  GLOBAL_CSS_URLS: ['/content/components/menu/menu-backdrop.css'],

  // Timing
  DEBOUNCE_DELAY: 100,
  ANNOUNCEMENT_DELAY: 100,
  SEARCH_DEBOUNCE: 220,
  SEARCH_MIN_QUERY_LENGTH: 2,
  SEARCH_REQUEST_TIMEOUT: 6000,
  SEARCH_AI_REQUEST_TIMEOUT: 4500,
  SEARCH_TOP_K: 12,

  // Breakpoints (must match menu-mobile.css media queries)
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
