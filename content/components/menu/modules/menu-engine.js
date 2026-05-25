/**
 * Menu Engine Module
 * Centralizes configurations, state, accessibility, performance, templates, DOM rendering, and event handling for the Site Menu.
 */

import { i18n } from "../../../core/i18n.js";
import { footerSignals } from "#footer/index.js";
import { createLogger } from "../../../core/logger.js";
import { computed, signal } from "../../../core/signals.js";
import { a11y } from "../../../core/accessibility-manager.js";
import {
  normalizePathname,
  TimerManager,
  addManagedEventListener,
} from "../../../core/utils/index.js";
import {
  OVERLAY_MODES,
  clearActiveOverlayMode,
  setActiveOverlayMode,
  uiStore,
} from "../../../core/state/ui-store.js";
import { resolvedTheme, setTheme } from "../../../core/state/theme-state.js";
import { withViewTransition } from "../../../core/view-transitions.js";
import {
  VIEW_TRANSITION_ROOT_CLASSES,
  VIEW_TRANSITION_TYPES,
  VIEW_TRANSITION_TIMINGS_MS,
} from "../../../core/view-transitions/index.js";
import { prepareOverlayFocusChange } from "../../../core/overlay-manager.js";

const log = createLogger("MenuEngine");

// ============================================================================
// 1. DOM HELPERS (formerly menu-dom-helpers.js)
// ============================================================================

/**
 * @param {Element|null} element
 * @returns {element is HTMLElement}
 */
export function isConnectedHTMLElement(element) {
  return element instanceof HTMLElement && element.isConnected;
}

/**
 * @param {HTMLElement|ShadowRoot} container
 * @param {HTMLElement|null} [host]
 * @returns {HTMLElement|null}
 */
export function resolveMenuHost(container, host = null) {
  const resolvedHost = host || (container instanceof ShadowRoot ? container.host : container);
  return resolvedHost instanceof HTMLElement ? resolvedHost : null;
}

// ============================================================================
// 2. ACTIVE LINK ROUTING (formerly menu-active-link.js)
// ============================================================================

function parseMenuHref(rawHref) {
  const href = String(rawHref || "").trim();
  if (!href) return null;

  const [pathPart, hashPart = ""] = href.split("#");
  return {
    rawHref: href,
    path: normalizePathname(pathPart),
    hash: hashPart ? `#${hashPart}` : "",
  };
}

function isPrefixPathMatch(currentPath, candidatePath) {
  if (!candidatePath) return false;
  if (candidatePath === "/") return true;
  if (!currentPath.startsWith(candidatePath)) return false;

  const boundaryChar = currentPath[candidatePath.length];
  return boundaryChar === "/" || boundaryChar === undefined;
}

function shouldReplaceCurrentMatch(current, next) {
  if (!current) return true;
  if (next.rank !== current.rank) return next.rank > current.rank;
  if (next.specificity !== current.specificity) {
    return next.specificity > current.specificity;
  }
  return false;
}

/**
 * Selects the href that should be marked active in the menu.
 * @param {Iterable<string|null|undefined>} hrefs
 * @param {{ currentPath: string, currentHash: string }} context
 * @returns {string|null}
 */
export function selectActiveMenuHref(hrefs, { currentPath: rawCurrentPath, currentHash }) {
  const currentPath = normalizePathname(rawCurrentPath);
  const hash = String(currentHash || "");
  let bestMatch = null;

  for (const rawHref of hrefs) {
    const parsed = parseMenuHref(rawHref);
    if (!parsed) continue;

    const specificity = parsed.path === "/" ? 0 : parsed.path.length;

    let candidate = null;

    if (parsed.hash && parsed.path === currentPath && parsed.hash === hash) {
      candidate = { href: parsed.rawHref, rank: 3, specificity };
    } else if (!parsed.hash && parsed.path === currentPath) {
      candidate = { href: parsed.rawHref, rank: 2, specificity };
    } else if (!parsed.hash && isPrefixPathMatch(currentPath, parsed.path)) {
      candidate = { href: parsed.rawHref, rank: 1, specificity };
    }

    if (candidate && shouldReplaceCurrentMatch(bestMatch, candidate)) {
      bestMatch = candidate;
    }
  }

  return bestMatch?.href || null;
}

// ============================================================================
// 3. MENU CONFIGURATION (formerly MenuConfig.js)
// ============================================================================

// shared title objects
const HOME_TITLE = { title: "menu.home", subtitle: "menu.home_sub" };
const CONTACT_TITLE = { title: "menu.contact", subtitle: "menu.contact_sub" };

export const MenuConfig = {
  CSS_URLS: [
    "/content/components/menu/styles/menu-base.css",
    "/content/components/menu/styles/menu-states.css",
    "/content/components/menu/styles/menu-mobile.css",
  ],
  DEFERRED_CSS_URLS: ["/content/components/menu/styles/menu-search.css"],
  SHADOW_CSS_URLS: [
    "/content/components/menu/styles/menu-base.css",
    "/content/components/menu/styles/menu-states.css",
    "/content/components/menu/styles/menu-mobile.css",
  ],
  DEFERRED_SHADOW_CSS_URLS: ["/content/components/menu/styles/menu-search.css"],

  DEBOUNCE_DELAY: 100,
  ANNOUNCEMENT_DELAY: 100,
  SEARCH_DEBOUNCE: 220,
  SEARCH_MIN_QUERY_LENGTH: 2,
  SEARCH_REQUEST_TIMEOUT: 6000,
  SEARCH_AI_REQUEST_TIMEOUT: 4500,
  SEARCH_TOP_K: 12,

  MOBILE_BREAKPOINT: 900,
  TABLET_BREAKPOINT: 900,

  TITLE_MAP: {
    "/index.html": HOME_TITLE,
    "/": HOME_TITLE,
    "/gallery/": { title: "menu.gallery", subtitle: "menu.gallery_sub" },
    "/projekte/": { title: "menu.projects", subtitle: "menu.projects_sub" },
    "/videos/": { title: "menu.videos", subtitle: "menu.videos_sub" },
    "/blog/": { title: "menu.blog", subtitle: "menu.blog_sub" },
    "/about/": { title: "menu.about", subtitle: "menu.about_sub" },
    "/contact/": CONTACT_TITLE,
  },

  FALLBACK_TITLES: {
    hero: HOME_TITLE,
    features: { title: "menu.projects", subtitle: "menu.projects_sub" },
    section3: { title: "menu.about", subtitle: "menu.about_sub" },
    contact: CONTACT_TITLE,
    footer: CONTACT_TITLE,
  },

  MENU_ITEMS: [
    { href: "/", icon: "house", fallback: "🏠", label: "menu.home" },
    { href: "/projekte/", icon: "projects", fallback: "📁", label: "menu.projects" },
    { href: "/gallery/", icon: "gallery", fallback: "📷", label: "menu.gallery" },
    { href: "/videos/", icon: "video", fallback: "🎬", label: "menu.videos" },
    { href: "/blog/", icon: "blog", fallback: "📝", label: "menu.blog" },
    { href: "/about/", icon: "user", fallback: "🧑", label: "menu.about" },
  ],

  ICON_CHECK_DELAY: 100,
};

// ============================================================================
// 4. MENU STATE MANAGEMENT (formerly MenuState.js)
// ============================================================================

export class MenuState {
  constructor() {
    this._openSignal = signal(false);
    this._activeLinkSignal = signal(null);
    this._titleSignal = signal(
      Object.freeze({
        title: "menu.home",
        subtitle: "",
      })
    );

    this.signals = Object.freeze({
      open: computed(() => this._openSignal.value),
      activeLink: computed(() => this._activeLinkSignal.value),
      title: computed(() => this._titleSignal.value),
    });

    this._subscriptions = new Map();
    this._overlayCleanup = uiStore.subscribeKey("activeOverlay", mode => {
      const isMenuOverlayOpen = mode === OVERLAY_MODES.MENU;
      if (this._openSignal.value === isMenuOverlayOpen) return;
      this._openSignal.value = isMenuOverlayOpen;
    });
  }

  get isOpen() {
    return this._openSignal.value;
  }

  get activeLink() {
    return this._activeLinkSignal.value;
  }

  get currentTitle() {
    return this._titleSignal.value.title;
  }

  get currentSubtitle() {
    return this._titleSignal.value.subtitle;
  }

  setOpen(value) {
    if (this.isOpen === value) return;
    this._openSignal.value = value;
    if (value) {
      setActiveOverlayMode(OVERLAY_MODES.MENU);
      return;
    }
    clearActiveOverlayMode(OVERLAY_MODES.MENU);
  }

  setActiveLink(link) {
    if (this.activeLink === link) return;
    this._activeLinkSignal.value = link;
  }

  setTitle(title, subtitle = "") {
    if (this.currentTitle === title && this.currentSubtitle === subtitle) return;
    this._titleSignal.value = Object.freeze({ title, subtitle });
  }

  on(event, callback) {
    if (typeof callback !== "function") return () => {};

    const source = this._resolveSignal(event);
    if (!source) return () => {};

    this.off(event, callback);

    let hasRun = false;
    const unsubscribe = source.subscribe(value => {
      if (!hasRun) {
        hasRun = true;
        return;
      }

      try {
        callback(value);
      } catch (err) {
        log.error(`Error in menu listener for ${event}:`, err);
      }
    });

    if (!this._subscriptions.has(event)) {
      this._subscriptions.set(event, new Map());
    }
    this._subscriptions.get(event).set(callback, unsubscribe);

    return unsubscribe;
  }

  off(event, callback) {
    const subscriptions = this._subscriptions.get(event);
    const unsubscribe = subscriptions?.get(callback);
    if (!unsubscribe) return;

    unsubscribe();
    subscriptions.delete(callback);

    if (subscriptions.size === 0) {
      this._subscriptions.delete(event);
    }
  }

  reset() {
    this._openSignal.value = false;
    this._activeLinkSignal.value = null;
    this._titleSignal.value = Object.freeze({
      title: "menu.home",
      subtitle: "",
    });
    clearActiveOverlayMode(OVERLAY_MODES.MENU);
    this._subscriptions.forEach(subscriptions => {
      subscriptions.forEach(unsubscribe => unsubscribe());
    });
    this._subscriptions.clear();
  }

  _resolveSignal(event) {
    switch (event) {
      case "openChange":
        return this.signals.open;
      case "activeLinkChange":
        return this.signals.activeLink;
      case "titleChange":
        return this.signals.title;
      default:
        return null;
    }
  }
}

// ============================================================================
// 5. MENU ACCESSIBILITY (formerly MenuAccessibility.js)
// ============================================================================

export class MenuAccessibility {
  constructor(container, state, config = {}) {
    this.container = container;
    this.state = state;
    this.config = config;
    this._cleanupFns = [];
  }

  init() {
    this.setupAnnouncements();
  }

  setupAnnouncements() {
    const mobileBreakpoint = this.config.MOBILE_BREAKPOINT ?? this.config.TABLET_BREAKPOINT ?? 900;
    let hasSyncedInitialState = false;

    this._cleanupFns.push(
      this.state.signals.open.subscribe(isOpen => {
        if (!hasSyncedInitialState) {
          hasSyncedInitialState = true;
          return;
        }

        if (window.innerWidth <= mobileBreakpoint) {
          this.announce(isOpen ? "Hauptmenü geöffnet" : "Hauptmenü geschlossen");
        }
      })
    );
  }

  announce(message) {
    a11y?.announce(message, { priority: "polite" });
  }

  destroy() {
    this._cleanupFns.forEach(fn => fn());
    this._cleanupFns = [];
  }
}

// ============================================================================
// 6. MENU PERFORMANCE UTILITIES (formerly MenuPerformance.js)
// ============================================================================

export class MenuPerformance {
  constructor() {
    this.metrics = new Map();
  }

  startMeasure(name) {
    this.metrics.set(name, performance.now());
  }

  endMeasure(name) {
    const start = this.metrics.get(name);
    if (start) {
      const duration = performance.now() - start;
      this.metrics.delete(name);
      return duration;
    }
    return 0;
  }

  destroy() {
    this.metrics.clear();
  }
}

// ============================================================================
// 7. MENU HTML TEMPLATES (formerly MenuTemplate.js)
// ============================================================================

let menuTemplateInstanceCounter = 0;

export class MenuTemplate {
  constructor(config = {}) {
    this.config = config;
    this.ids = this.createDomIds();
  }

  createDomIds() {
    menuTemplateInstanceCounter += 1;
    const configuredPrefix = String(this.config?.DOM_ID_PREFIX || "").trim();
    const prefix = configuredPrefix || `site-menu-${menuTemplateInstanceCounter}`;

    return {
      navigation: `${prefix}-navigation`,
      title: `${prefix}-title`,
      subtitle: `${prefix}-subtitle`,
      searchInput: `${prefix}-search-input`,
      searchResults: `${prefix}-search-results`,
    };
  }

  getHTML() {
    return `
${this.getSkipLinks()}
${this.getSVGSprite()}
${this.getBrand()}
${this.getNavigation()}
${this.getSearchUI()}
${this.getToggleButton()}
`;
  }

  getSkipLinks() {
    return `
<div class="skip-links">
  <a href="#main-content" class="skip-link" data-i18n="menu.skip_main">${i18n.t("menu.skip_main")}</a>
  <a href="#${this.ids.navigation}" class="skip-link" data-i18n="menu.skip_nav">${i18n.t("menu.skip_nav")}</a>
</div>`;
  }

  getBrand() {
    return `
<div class="site-logo__container">
  <span id="${this.ids.title}" class="site-title"></span>
  <span id="${this.ids.subtitle}" class="site-subtitle"></span>
</div>`;
  }

  getSVGSprite() {
    return `
<svg aria-hidden="true" class="menu-icon-sprite" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <symbol id="icon-house" viewBox="0 0 576 512">
      <path fill="currentColor" d="M541 229.16 512 205.26V64a32 32 0 0 0-32-32h-64a32 32 0 0 0-32 32v24.6L314.52 43a35.93 35.93 0 0 0-45 0L35 229.16a16 16 0 0 0-2 22.59l21.4 25.76a16 16 0 0 0 22.59 2L96 264.86V456a32 32 0 0 0 32 32h128V344a16 16 0 0 1 16-16h64a16 16 0 0 1 16 16v144h128a32 32 0 0 0 32-32V264.86l19 14.65a16 16 0 0 0 22.59-2l21.4-25.76a16 16 0 0 0-2-22.59Z"/>
    </symbol>
    <symbol id="icon-projects" viewBox="0 0 512 512">
      <path fill="currentColor" d="M184 48H328c4.4 0 8 3.6 8 8V96H176V56c0-4.4 3.6-8 8-8zm-56 8V96H64C28.7 96 0 124.7 0 160V416c0 35.3 28.7 64 64 64H448c35.3 0 64-28.7 64-64V160c0-35.3-28.7-64-64-64H384V56c0-30.9-25.1-56-56-56H184c-30.9 0-56 25.1-56 56zM64 160H448V416H64V160zm64 80v32H256V240H128zm0 80v32H384V320H128z"/>
    </symbol>
    <symbol id="icon-gallery" viewBox="0 0 512 512">
      <path fill="currentColor" d="M149.1 64.8L138.7 96H64C28.7 96 0 124.7 0 160V416c0 35.3 28.7 64 64 64H448c35.3 0 64-28.7 64-64V160c0-35.3-28.7-64-64-64H373.3L362.9 64.8C356.4 45.2 338.1 32 317.4 32H194.6c-20.7 0-39 13.2-45.5 32.8zM256 192a96 96 0 1 1 0 192 96 96 0 1 1 0-192z"/>
    </symbol>
    <symbol id="icon-video" viewBox="0 0 576 512">
      <path fill="currentColor" d="M336.2 64H47.8C21.4 64 0 85.4 0 111.8v288.4C0 426.6 21.4 448 47.8 448h288.4c26.4 0 47.8-21.4 47.8-47.8V111.8c0-26.4-21.4-47.8-47.8-47.8zm189.4 37.7L416 177.3v157.4l109.6 75.5c21.2 14.6 50.4-.3 50.4-25.8V127.5c0-25.4-29.1-40.4-50.4-25.8z"/>
    </symbol>
    <symbol id="icon-blog" viewBox="0 0 512 512">
      <path fill="currentColor" d="M471.6 21.7c-21.9-21.9-57.3-21.9-79.2 0L362.3 51.7l97.9 97.9 30.1-30.1c21.9-21.9 21.9-57.3 0-79.2L471.6 21.7zm-299.2 220c-6.1 6.1-10.8 13.6-13.5 21.9l-29.6 88.8c-2.9 8.6-.6 18.1 5.8 24.6s15.9 8.7 24.6 5.8l88.8-29.6c8.2-2.7 15.7-7.4 21.9-13.5L437.7 172.3 339.7 74.3 172.4 241.7zM96 64C43 64 0 107 0 160V416c0 53 43 96 96 96H352c53 0 96-43 96-96V320c0-17.7-14.3-32-32-32s-32 14.3-32 32v96c0 17.7-14.3 32-32 32H96c-17.7 0-32-14.3-32-32V160c0-17.7 14.3-32 32-32h96c17.7 0 32-14.3 32-32s-14.3-32-32-32H96z"/>
    </symbol>
    <symbol id="icon-user" viewBox="0 0 448 512">
      <path fill="currentColor" d="M224 256A128 128 0 1 0 96 128a128 128 0 0 0 128 128Zm89.6 32h-11.7a174.64 174.64 0 0 1-155.8 0h-11.7A134.4 134.4 0 0 0 0 422.4 57.6 57.6 0 0 0 57.6 480h332.8A57.6 57.6 0 0 0 448 422.4 134.4 134.4 0 0 0 313.6 288Z"/>
    </symbol>
    <symbol id="icon-mail" viewBox="0 0 512 512">
      <path fill="currentColor" d="M48 64C21.5 64 0 85.5 0 112v288c0 26.5 21.5 48 48 48h416c26.5 0 48-21.5 48-48V112c0-26.5-21.5-48-48-48H48zM48 96h416c8.8 0 16 7.2 16 16v41.4L288 264.4c-11.3 8.5-26.7 8.5-38 0L32 153.4V112c0-8.8 7.2-16 16-16zm0 320v-222l176 132c22.5 16.9 53.5 16.9 76 0l176-132v222c0 8.8-7.2 16-16 16H64c-8.8 0-16-7.2-16-16z"/>
    </symbol>
    <symbol id="icon-search" viewBox="0 0 24 24">
      <circle cx="11" cy="11" r="8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="m21 21-4.35-4.35" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </symbol>
    <symbol id="icon-globe" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="2" y1="12" x2="22" y2="12" stroke="currentColor" stroke-width="2"/>
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" fill="none" stroke="currentColor" stroke-width="2"/>
    </symbol>
    <symbol id="icon-sun" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="5" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="12" y1="1" x2="12" y2="3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <line x1="12" y1="21" x2="12" y2="23" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <line x1="1" y1="12" x2="3" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <line x1="21" y1="12" x2="23" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </symbol>
    <symbol id="icon-moon" viewBox="0 0 24 24">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </symbol>
  </defs>
</svg>`;
  }

  getToggleButton() {
    return `
<button
  type="button"
  class="site-menu__toggle"
  aria-label="${i18n.t("menu.toggle")}"
  data-i18n-aria="menu.toggle"
  aria-controls="${this.ids.navigation}"
  aria-expanded="false"
>
  <div class="hamburger-container">
    <span class="hamburger-line hamburger-line--top"></span>
    <span class="hamburger-line hamburger-line--middle"></span>
    <span class="hamburger-line hamburger-line--bottom"></span>
  </div>
  <div class="menu-ripple" data-collision-ignore></div>
</button>`;
  }

  getNavigation() {
    const menuItems = this.config?.MENU_ITEMS || [];

    const items = menuItems
      .map(
        item => `
    <li class="menu-nav-item">
      <a href="${item.href}"${item.attrs ? " " + item.attrs : ""}>
        <span class="nav-icon-wrapper">
             <svg class="nav-icon" aria-hidden="true">
               <use href="#icon-${item.icon}"></use>
             </svg>
             <span class="icon-fallback icon-fallback--hidden">${item.fallback}</span>
        </span>
        <span data-i18n="${item.label}">${i18n.t(item.label)}</span>
      </a>
    </li>`
      )
      .join("");

    return `
<nav
  id="${this.ids.navigation}"
  class="site-menu"
  aria-label="${i18n.t("menu.main_nav")}"
  aria-hidden="true"
  data-i18n-aria="menu.main_nav"
>
  <ul class="site-menu__list">
    ${items}
    <li class="menu-utility-separator" aria-hidden="true">
      <span class="menu-utility-separator__line"></span>
    </li>
    <li class="menu-utility-item menu-utility-item--search">
      <button
        type="button"
        class="search-trigger"
        aria-label="${i18n.t("menu.search_label")}"
        data-i18n-aria="menu.search_label"
        title="${i18n.t("menu.search_tooltip")}"
        data-i18n-title="menu.search_tooltip"
        aria-expanded="false"
        aria-controls="${this.ids.searchResults}"
      >
        <span class="icon-container">
            <svg class="nav-icon search-icon" aria-hidden="true">
            <use href="#icon-search"></use>
            </svg>
        </span>
        <span class="icon-fallback icon-fallback--hidden">🔍</span>
      </button>
    </li>
    <li class="menu-utility-item menu-utility-item--contact">
      <button
        type="button"
        class="contact-trigger"
        data-footer-trigger
        aria-expanded="false"
        aria-label="${i18n.t("menu.contact")}"
        data-i18n-aria="menu.contact"
        title="${i18n.t("menu.contact")}"
        data-i18n-title="menu.contact"
      >
        <span class="icon-container">
          <svg class="nav-icon contact-icon" aria-hidden="true">
            <use href="#icon-mail"></use>
          </svg>
        </span>
        <span class="icon-fallback icon-fallback--hidden">✉️</span>
      </button>
    </li>
    <li class="menu-utility-item menu-utility-item--theme">
      <button
        type="button"
        class="theme-toggle"
        aria-label="${i18n.t("menu.theme_toggle")}"
        data-i18n-aria="menu.theme_toggle"
        title="${i18n.t("menu.theme_toggle")}"
        data-i18n-title="menu.theme_toggle"
      >
        <svg class="nav-icon theme-icon theme-icon--sun" aria-hidden="true">
          <use href="#icon-sun"></use>
        </svg>
        <svg class="nav-icon theme-icon theme-icon--moon" aria-hidden="true">
          <use href="#icon-moon"></use>
        </svg>
      </button>
    </li>
    <li class="menu-utility-item menu-utility-item--lang">
      <button
        type="button"
        class="lang-toggle"
        aria-label="${i18n.t("menu.lang_toggle")}"
        data-i18n-aria="menu.lang_toggle"
        title="${i18n.t("menu.lang_toggle")}"
        data-i18n-title="menu.lang_toggle"
      >
        <svg class="nav-icon" aria-hidden="true">
          <use href="#icon-globe"></use>
        </svg>
        <span class="lang-text">DE</span>
      </button>
    </li>
  </ul>
</nav>`;
  }

  getSearchUI() {
    return `
<div class="menu-search" aria-hidden="true">
  <div class="menu-search__panel">
    <div
      class="menu-search__bar"
      role="combobox"
      aria-expanded="false"
      aria-haspopup="listbox"
      aria-controls="${this.ids.searchResults}"
    >
      <span class="menu-search__icon" aria-hidden="true">
        <svg class="nav-icon"><use href="#icon-search"></use></svg>
      </span>
      <input
        id="${this.ids.searchInput}"
        type="text"
        class="menu-search__input"
        aria-label="${i18n.t("menu.search_input_label")}"
        data-i18n-aria="menu.search_input_label"
        aria-autocomplete="list"
        aria-controls="${this.ids.searchResults}"
        aria-expanded="false"
        role="searchbox"
        placeholder="${i18n.t("menu.search_placeholder")}"
        data-i18n-placeholder="menu.search_placeholder"
        autocomplete="off"
        autocorrect="off"
        autocapitalize="off"
        spellcheck="false"
      />
      <button type="button" class="menu-search__clear" aria-label="Suche leeren">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div id="${this.ids.searchResults}" class="menu-search__results" role="listbox" aria-live="polite"></div>
  </div>
</div>`;
  }
}

// ============================================================================
// 8. MENU DOM RENDERING (formerly MenuRenderer.js)
// ============================================================================

export class MenuRenderer {
  constructor(state, config = {}) {
    this.state = state;
    this.config = config;
    this.template = new MenuTemplate(config);
    this.container = null;
    this.iconTimeout = null;
    this._i18nUnsub = null;
    this._stateCleanupFns = [];
  }

  render(container) {
    this.container = container;
    container.replaceChildren(...this.parseTemplate(this.template.getHTML()));
    this.setupStateSubscriptions();

    const currentLang = /** @type {any} */ (i18n).getCurrentLanguage
      ? /** @type {any} */ (i18n).getCurrentLanguage()
      : "de";
    this.updateLanguage(currentLang);
  }

  parseTemplate(html) {
    const parsed = new DOMParser().parseFromString(html, "text/html");
    return Array.from(parsed.body.childNodes);
  }

  initializeIcons() {
    const delay = this.config.ICON_CHECK_DELAY || 100;
    this.iconTimeout = setTimeout(() => {
      this.iconTimeout = null;
      if (!this.container) return;

      const icons = this.container.querySelectorAll(".nav-icon use");
      icons.forEach(use => {
        const href = use.getAttribute("href");
        if (!href) return;

        const targetId = href.substring(1);
        const target = this.container.querySelector(`#${targetId}`);
        const svg = use.closest("svg");
        const fallback = svg?.closest("a, button")?.querySelector(".icon-fallback");

        if (!target && fallback) {
          if (svg instanceof SVGElement) {
            svg.setAttribute("hidden", "");
          }
          fallback.classList.remove("icon-fallback--hidden");
        }
      });
    }, delay);
  }

  setupStateSubscriptions() {
    this._stateCleanupFns.forEach(cleanup => cleanup());
    this._stateCleanupFns = [];

    this._stateCleanupFns.push(
      this.state.signals.open.subscribe(isOpen => {
        const toggle = this.container.querySelector(".site-menu__toggle");
        const menu = this.container.querySelector(".site-menu");

        if (menu) {
          menu.classList.toggle("open", isOpen);
          menu.setAttribute("aria-hidden", String(!isOpen));
        }
        if (toggle) toggle.classList.toggle("active", isOpen);
        if (toggle) toggle.setAttribute("aria-expanded", String(isOpen));
      })
    );

    this._stateCleanupFns.push(
      this.state.signals.activeLink.subscribe(activeHref => {
        this.updateActiveLink(activeHref);
      })
    );

    this._stateCleanupFns.push(
      this.state.signals.title.subscribe(({ title, subtitle }) => {
        this.updateTitle(title, subtitle);
      })
    );

    this._i18nUnsub = i18n.subscribe(lang => {
      this.updateLanguage(lang);
    });
  }

  updateActiveLink(activeHref) {
    if (!this.container) return;

    const links = this.container.querySelectorAll(".site-menu a");
    links.forEach(link => {
      const href = link.getAttribute("href");
      const isActive = href === activeHref;

      if (isActive) {
        link.classList.add("active");
        link.setAttribute("aria-current", "page");
      } else {
        link.classList.remove("active");
        link.removeAttribute("aria-current");
      }
    });
  }

  updateLanguage(lang) {
    if (typeof lang !== "string") return;
    if (!this.container) return;

    const langText = this.container.querySelector(".lang-text");
    if (langText) {
      langText.textContent = lang.toUpperCase();
    }

    const textElements = this.container.querySelectorAll("[data-i18n]");
    textElements.forEach(el => {
      const key = el.getAttribute("data-i18n");
      if (key) {
        el.textContent = i18n.t(key);
      }
    });

    const ariaElements = this.container.querySelectorAll("[data-i18n-aria]");
    ariaElements.forEach(el => {
      const key = el.getAttribute("data-i18n-aria");
      if (key) {
        el.setAttribute("aria-label", i18n.t(key));
      }
    });

    const titleElements = this.container.querySelectorAll("[data-i18n-title]");
    titleElements.forEach(el => {
      const key = el.getAttribute("data-i18n-title");
      if (key) {
        el.setAttribute("title", i18n.t(key));
      }
    });

    const placeholderElements = this.container.querySelectorAll("[data-i18n-placeholder]");
    placeholderElements.forEach(el => {
      const key = el.getAttribute("data-i18n-placeholder");
      if (key) {
        el.setAttribute("placeholder", i18n.t(key));
      }
    });

    if (this.state) {
      this.updateTitle(this.state.currentTitle, this.state.currentSubtitle);
    }
  }

  updateTitle(title, subtitle = "") {
    if (!this.container) return;

    const siteTitleEl = this.container.querySelector(".site-title");
    const siteSubtitleEl = this.container.querySelector(".site-subtitle");

    if (!siteTitleEl) return;

    const translatedTitle = i18n.t(title);
    let translatedSubtitle = i18n.t(subtitle);

    if (translatedTitle === translatedSubtitle) {
      translatedSubtitle = "";
    }

    if (
      siteTitleEl.textContent === translatedTitle &&
      (!siteSubtitleEl || siteSubtitleEl.textContent === translatedSubtitle)
    ) {
      if (siteSubtitleEl) {
        if (translatedSubtitle) siteSubtitleEl.classList.add("show");
        else siteSubtitleEl.classList.remove("show");
      }
      return;
    }

    siteTitleEl.textContent = translatedTitle;

    if (siteSubtitleEl) {
      siteSubtitleEl.textContent = translatedSubtitle;
      siteSubtitleEl.classList.toggle("show", Boolean(translatedSubtitle));
    }
  }

  destroy() {
    if (this.iconTimeout) {
      clearTimeout(this.iconTimeout);
      this.iconTimeout = null;
    }
    this._stateCleanupFns.forEach(cleanup => cleanup());
    this._stateCleanupFns = [];
    if (typeof this._i18nUnsub === "function") {
      this._i18nUnsub();
      this._i18nUnsub = null;
    }
    this.container = null;
  }
}

// ============================================================================
// 9. MENU INTERACTION EVENTS (formerly MenuEvents.js)
// ============================================================================

function isVisibleElement(element) {
  if (!(element instanceof HTMLElement) || !element.isConnected) return false;
  const style = window.getComputedStyle(element);
  return (
    style.display !== "none" && style.visibility !== "hidden" && element.getClientRects().length > 0
  );
}

export class MenuEvents {
  constructor(container, state, renderer, menuSearch, config = {}, host = null) {
    this.container = container;
    this.host = resolveMenuHost(container, host);
    this.state = state;
    this.renderer = renderer;
    this.menuSearch = menuSearch;
    this.config = config;
    this.cleanupFns = [];
    this.sectionObserver = null;
    this.timers = new TimerManager("MenuEvents");
  }

  init() {
    this.setupToggle();
    this.setupLanguageToggle();
    this.setupThemeToggle();
    this.setupNavigation();
    this.setupGlobalListeners();
    this.setupResizeHandler();
    this.fixSubpageLinks();
    this.setupScrollSpy();
    this.handleUrlChange();
  }

  setupLanguageToggle() {
    const langToggle = this.container.querySelector(".lang-toggle");
    if (!langToggle) return;

    const handleLangClick = e => {
      e.preventDefault();
      try {
        i18n.toggleLanguage();
      } catch (err) {
        log.error("Failed to toggle language:", err);
      }
    };

    this.cleanupFns.push(this.addListener(langToggle, "click", handleLangClick));
  }

  setupThemeToggle() {
    const themeToggle = this.container.querySelector(".theme-toggle");
    if (!themeToggle) return;

    const applyTheme = (theme, { animate = false } = {}) => {
      const apply = () => {
        themeToggle.classList.toggle("is-light", theme === "light");
      };

      if (!animate) {
        apply();
        return;
      }

      void withViewTransition(apply, {
        types: [VIEW_TRANSITION_TYPES.THEME_CHANGE],
        rootClasses: [VIEW_TRANSITION_ROOT_CLASSES.THEME_CHANGE],
        timeoutMs: VIEW_TRANSITION_TIMINGS_MS.THEME_TIMEOUT,
      });
    };

    this.cleanupFns.push(
      resolvedTheme.subscribe(theme => {
        applyTheme(theme);
      })
    );

    const handleThemeClick = e => {
      e.preventDefault();
      const nextTheme = resolvedTheme.value === "dark" ? "light" : "dark";
      void withViewTransition(
        () => {
          setTheme(nextTheme);
        },
        {
          types: [VIEW_TRANSITION_TYPES.THEME_CHANGE],
          rootClasses: [VIEW_TRANSITION_ROOT_CLASSES.THEME_CHANGE],
          timeoutMs: VIEW_TRANSITION_TIMINGS_MS.THEME_TIMEOUT,
        }
      );
    };

    this.cleanupFns.push(this.addListener(themeToggle, "click", handleThemeClick));
  }

  setupToggle() {
    const toggle = this.container.querySelector(".site-menu__toggle");
    if (!toggle) return;

    const handleToggle = () => {
      if (this.menuSearch.isSearchOpen()) {
        this.menuSearch.closeSearchModeSilently();
        return;
      }

      const isOpen = !this.state.isOpen;
      if (isOpen) {
        import("#footer/index.js").then(({ closeFooter }) => {
          try {
            closeFooter();
          } catch {
            // ignore
          }
        });
      }
      this.setMenuOpenWithTransition(isOpen);
    };

    this.cleanupFns.push(
      this.addListener(toggle, "click", handleToggle),
      this.addListener(toggle, "keydown", e => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleToggle();
        }
      })
    );
  }

  getHeaderElement() {
    const header = this.host?.closest?.(".site-header");
    return isConnectedHTMLElement(header) ? header : null;
  }

  getToggleElement() {
    const toggle = this.container.querySelector(".site-menu__toggle");
    return isConnectedHTMLElement(toggle) ? toggle : null;
  }

  getPrimaryFocusTarget() {
    return (
      this.container.querySelector(".site-menu a[href]") ||
      this.container.querySelector(".site-menu button:not([disabled])") ||
      this.getToggleElement()
    );
  }

  getFocusTrapRoots() {
    return [this.container.querySelector(".site-menu"), this.getToggleElement()].filter(
      isConnectedHTMLElement
    );
  }

  getRestoreFocusTarget() {
    const toggle = this.getToggleElement();
    if (isVisibleElement(toggle)) {
      return toggle;
    }

    const searchTrigger = this.container.querySelector(".search-trigger");
    if (isVisibleElement(searchTrigger)) {
      return searchTrigger;
    }

    return this.getPrimaryFocusTarget();
  }

  setupNavigation() {
    const links = this.container.querySelectorAll(".site-menu a[href]");

    links.forEach(link => {
      const handleClick = _e => {
        const href = link.getAttribute("href");
        if (!href) return;

        this.menuSearch.closeSearchModeSilently();

        if (href === "#footer") {
          this.closeMenu();
          import("#footer/index.js").then(({ openFooter }) => openFooter()).catch(() => {});
          return;
        }

        if (href.startsWith("/") || href.startsWith("#")) {
          this.closeMenu();
        }
      };

      this.cleanupFns.push(this.addListener(link, "click", handleClick));
    });
  }

  setupGlobalListeners() {
    const handleDocClick = e => {
      const target = /** @type {Element|null} */ (e.target instanceof Element ? e.target : null);
      const composedPath = typeof e.composedPath === "function" ? e.composedPath() : [];

      if (this.menuSearch.isSearchOpen()) {
        const header = this.getHeaderElement();
        const isInsideHeader = Boolean(header && target && header.contains(target));

        if (!isInsideHeader) {
          this.menuSearch.closeSearchModeSilently();
        }
      }

      if (!this.state.isOpen) return;

      const isInside = Boolean(
        (target && this.container.contains(target)) ||
        composedPath.includes(this.host) ||
        composedPath.includes(this.container)
      );
      const isToggleInPath = composedPath.some(node => {
        return Boolean(
          node &&
          typeof node === "object" &&
          "classList" in node &&
          node.classList?.contains?.("site-menu__toggle")
        );
      });
      const isToggle = Boolean(target?.closest(".site-menu__toggle") || isToggleInPath);

      if (!isInside && !isToggle) {
        this.closeMenu();
      }
    };

    const onUrlChange = () => this.handleUrlChange();

    this.cleanupFns.push(
      this.addListener(document, "click", handleDocClick),
      this.addListener(window, "hashchange", onUrlChange),
      this.addListener(window, "popstate", onUrlChange),
      footerSignals.loaded.subscribe(isLoaded => {
        if (!isLoaded) return;
        this.setupScrollSpy();
        this.handleUrlChange();
      })
    );
  }

  setupResizeHandler() {
    const menuCollapseBreakpoint =
      this.config.MOBILE_BREAKPOINT ?? this.config.TABLET_BREAKPOINT ?? 900;
    const resizeDebounce = this.config.DEBOUNCE_DELAY ?? 100;

    let timeoutId;
    const handleResize = () => {
      this.timers.clearTimeout(timeoutId);
      timeoutId = this.timers.setTimeout(() => {
        if (window.innerWidth > menuCollapseBreakpoint && this.state.isOpen) {
          this.closeMenu();
        }
      }, resizeDebounce);
    };

    this.cleanupFns.push(this.addListener(window, "resize", handleResize));
  }

  fixSubpageLinks() {
    const path = window.location.pathname;
    const isHomePage = path === "/" || path === "/index.html";

    if (!isHomePage) {
      const links = this.container.querySelectorAll('.site-menu a[href^="#"]');
      links.forEach(link => {
        const hash = link.getAttribute("href");
        if (hash === "#") return;

        if (document.querySelector(hash)) {
          return;
        }

        link.setAttribute("href", `/${hash}`);
      });
    }
  }

  setupScrollSpy() {
    if (this.sectionObserver) this.sectionObserver.disconnect();

    const options = {
      root: null,
      rootMargin: "-30% 0px -50% 0px",
      threshold: 0,
    };

    const callback = entries => {
      const visibleEntries = entries.filter(e => e.isIntersecting);
      if (visibleEntries.length === 0) return;

      const entry = visibleEntries[0];

      if (entry.target.id) {
        this.updateTitleFromSection(entry.target.id);
      }
    };

    this.sectionObserver = new IntersectionObserver(callback, options);

    const sections = document.querySelectorAll("section[id], footer[id]");
    sections.forEach(s => this.sectionObserver.observe(s));
  }

  handleUrlChange() {
    this.calculateAndSetActiveLink();
    this.updateTitleFromPathOrSection();
  }

  calculateAndSetActiveLink() {
    const currentPath = window.location.pathname.replace(/\/$/, "") || "/";
    const currentHash = window.location.hash;

    const hrefs = Array.from(this.container.querySelectorAll(".site-menu a[href]"), link =>
      link.getAttribute("href")
    );
    const activeHref = selectActiveMenuHref(hrefs, {
      currentPath,
      currentHash,
    });
    this.state.setActiveLink(activeHref);
  }

  updateTitleFromPathOrSection() {
    const hash = window.location.hash;
    if (hash) {
      const sectionId = hash.substring(1);
      const info = this.extractSectionInfo(sectionId);
      if (info) {
        this.state.setTitle(info.title, info.subtitle);
        return;
      }
    }

    const path = window.location.pathname;
    const titleMap = this.config.TITLE_MAP || {};

    const sortedKeys = Object.keys(titleMap).sort((a, b) => b.length - a.length);

    const matchedKey = sortedKeys.find(key => {
      if (key === "/") return path === "/" || path === "/index.html";
      return path.startsWith(key);
    });

    if (matchedKey) {
      const val = titleMap[matchedKey];
      this.state.setTitle(val.title, val.subtitle || "");
    } else {
      this.state.setTitle("menu.home", "");
    }
  }

  updateTitleFromSection(sectionId) {
    if (sectionId === "footer") {
      this.state.setTitle("menu.contact", "menu.contact_sub");
      return;
    }

    const info = this.extractSectionInfo(sectionId);
    if (info) {
      this.state.setTitle(info.title, info.subtitle);
    }
  }

  extractSectionInfo(sectionId) {
    const fallbackTitles = this.config.FALLBACK_TITLES || {};
    if (fallbackTitles[sectionId]) return fallbackTitles[sectionId];

    const section = document.getElementById(sectionId);
    if (!section) return null;

    const titleEl = section.querySelector(".section-title, h2, h3");
    const subtitleEl = section.querySelector(".section-subtitle, p.subtitle");

    if (titleEl) {
      return {
        title: titleEl.textContent.trim(),
        subtitle: subtitleEl ? subtitleEl.textContent.trim() : "",
      };
    }
    return null;
  }

  closeMenu(options = {}) {
    const { restoreFocus = false } = options;
    prepareOverlayFocusChange(this.state.isOpen ? OVERLAY_MODES.MENU : null, {
      restoreFocus,
    });
    this.setMenuOpenWithTransition(false);
  }

  setMenuOpenWithTransition(isOpen) {
    if (this.state.isOpen === isOpen) return;

    void withViewTransition(
      () => {
        this.state.setOpen(isOpen);
      },
      {
        types: [isOpen ? VIEW_TRANSITION_TYPES.MENU_OPEN : VIEW_TRANSITION_TYPES.MENU_CLOSE],
        rootClasses: [VIEW_TRANSITION_ROOT_CLASSES.MENU],
        preserveLiveBackdropOnMobile: true,
        timeoutMs: VIEW_TRANSITION_TIMINGS_MS.MENU_TIMEOUT,
      }
    );
  }

  addListener(target, event, handler, options = {}) {
    return addManagedEventListener(target, event, handler, options);
  }

  destroy() {
    if (this.timers) {
      this.timers.clearAll();
    }
    this.cleanupFns.forEach(fn => fn());
    this.cleanupFns = [];
    if (this.sectionObserver) {
      this.sectionObserver.disconnect();
      this.sectionObserver = null;
    }
  }
}
