/**
 * Menu Events Management
 * Handles all user interactions, URL changes, and scroll events.
 */
import { i18n } from '#core/i18n.js';
import { footerSignals } from '#footer/state.js';
import { createLogger } from '#core/logger.js';
import { TimerManager } from '#core/timer-manager.js';
import { resolvedTheme, setTheme } from '#core/theme-state.js';
import { withViewTransition } from '#core/view-transitions.js';
import {
  VIEW_TRANSITION_ROOT_CLASSES,
  VIEW_TRANSITION_TYPES,
  VIEW_TRANSITION_TIMINGS_MS,
} from '#core/view-transition-constants.js';
import {
  OVERLAY_MODES,
  prepareOverlayFocusChange,
} from '#core/overlay-manager.js';
import { isConnectedHTMLElement, resolveMenuHost } from './menu-dom-helpers.js';
import { selectActiveMenuHref } from './menu-active-link.js';

const log = createLogger('MenuEvents');

/**
 * @typedef {typeof import('./MenuConfig.js').MenuConfig} MenuComponentConfig
 */
/**
 * @typedef {Partial<MenuComponentConfig>} MenuComponentConfigInput
 */

function isVisibleElement(element) {
  if (!(element instanceof HTMLElement) || !element.isConnected) return false;
  const style = window.getComputedStyle(element);
  return (
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    element.getClientRects().length > 0
  );
}

export class MenuEvents {
  /**
   * @param {HTMLElement|ShadowRoot} container
   * @param {import('./MenuState.js').MenuState} state
   * @param {import('./MenuRenderer.js').MenuRenderer} renderer
   * @param {import('./MenuSearch.js').MenuSearch} menuSearch
   * @param {MenuComponentConfigInput} [config]
   * @param {HTMLElement|null} [host]
   */
  constructor(
    container,
    state,
    renderer,
    menuSearch,
    config = {},
    host = null,
  ) {
    this.container = container;
    this.host = resolveMenuHost(container, host);
    this.state = state;
    this.renderer = renderer;
    this.menuSearch = menuSearch;
    this.config = config;
    this.cleanupFns = [];
    this.sectionObserver = null;
    this.timers = new TimerManager('MenuEvents');
  }

  init() {
    this.setupToggle();
    this.setupLanguageToggle();
    this.setupThemeToggle();
    // Search is initialized separately
    this.setupNavigation();
    this.setupGlobalListeners();
    this.setupResizeHandler();
    this.fixSubpageLinks();
    this.setupScrollSpy();

    // Initial state sync
    this.handleUrlChange();
  }

  setupLanguageToggle() {
    const langToggle = this.container.querySelector('.lang-toggle');
    if (!langToggle) return;

    const handleLangClick = (e) => {
      e.preventDefault();
      try {
        i18n.toggleLanguage();
      } catch (err) {
        log.error('Failed to toggle language:', err);
      }
    };

    this.cleanupFns.push(
      this.addListener(langToggle, 'click', handleLangClick),
    );
  }

  setupThemeToggle() {
    const themeToggle = this.container.querySelector('.theme-toggle');
    if (!themeToggle) return;

    const applyTheme = (theme, { animate = false } = {}) => {
      const apply = () => {
        themeToggle.classList.toggle('is-light', theme === 'light');
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
      resolvedTheme.subscribe((theme) => {
        applyTheme(theme);
      }),
    );

    const handleThemeClick = (e) => {
      e.preventDefault();
      const nextTheme = resolvedTheme.value === 'dark' ? 'light' : 'dark';
      void withViewTransition(
        () => {
          setTheme(nextTheme);
        },
        {
          types: [VIEW_TRANSITION_TYPES.THEME_CHANGE],
          rootClasses: [VIEW_TRANSITION_ROOT_CLASSES.THEME_CHANGE],
          timeoutMs: VIEW_TRANSITION_TIMINGS_MS.THEME_TIMEOUT,
        },
      );
    };

    this.cleanupFns.push(
      this.addListener(themeToggle, 'click', handleThemeClick),
    );
  }

  setupToggle() {
    const toggle = this.container.querySelector('.site-menu__toggle');
    if (!toggle) return;

    const handleToggle = () => {
      if (this.menuSearch.isSearchOpen()) {
        this.menuSearch.closeSearchModeSilently();
        return;
      }

      const isOpen = !this.state.isOpen;
      if (isOpen) {
        // ensure footer is collapsed when main nav opens
        import('#footer/index.js').then(({ closeFooter }) => {
          try {
            closeFooter();
          } catch {}
        });
      }
      this.setMenuOpenWithTransition(isOpen);
    };

    this.cleanupFns.push(
      this.addListener(toggle, 'click', handleToggle),
      this.addListener(toggle, 'keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleToggle();
        }
      }),
    );
  }

  getHeaderElement() {
    const header = this.host?.closest?.('.site-header');
    return isConnectedHTMLElement(header) ? header : null;
  }

  getToggleElement() {
    const toggle = this.container.querySelector('.site-menu__toggle');
    return isConnectedHTMLElement(toggle) ? toggle : null;
  }

  getPrimaryFocusTarget() {
    return (
      this.container.querySelector('.site-menu a[href]') ||
      this.container.querySelector('.site-menu button:not([disabled])') ||
      this.getToggleElement()
    );
  }

  getFocusTrapRoots() {
    return [
      this.container.querySelector('.site-menu'),
      this.getToggleElement(),
    ].filter(isConnectedHTMLElement);
  }

  getRestoreFocusTarget() {
    const toggle = this.getToggleElement();
    if (isVisibleElement(toggle)) {
      return toggle;
    }

    const searchTrigger = this.container.querySelector('.search-trigger');
    if (isVisibleElement(searchTrigger)) {
      return searchTrigger;
    }

    return this.getPrimaryFocusTarget();
  }

  setupNavigation() {
    const links = this.container.querySelectorAll('.site-menu a[href]');

    links.forEach((link) => {
      const handleClick = (_e) => {
        const href = link.getAttribute('href');
        if (!href) return;

        this.menuSearch.closeSearchModeSilently();

        // Contact button: close the menu first, then open the footer panel.
        if (href === '#footer') {
          this.closeMenu();
          import('#footer/index.js')
            .then(({ openFooter }) => openFooter())
            .catch(() => {});
          return;
        }

        // Handle generic internal links
        if (href.startsWith('/') || href.startsWith('#')) {
          this.closeMenu();
        }
      };

      this.cleanupFns.push(this.addListener(link, 'click', handleClick));
    });
  }

  setupGlobalListeners() {
    const handleDocClick = (e) => {
      const target = /** @type {Element|null} */ (
        e.target instanceof Element ? e.target : null
      );
      const composedPath =
        typeof e.composedPath === 'function' ? e.composedPath() : [];

      if (this.menuSearch.isSearchOpen()) {
        const header = this.getHeaderElement();
        const isInsideHeader = Boolean(
          header && target && header.contains(target),
        );

        if (!isInsideHeader) {
          this.menuSearch.closeSearchModeSilently();
        }
      }

      if (!this.state.isOpen) return;

      const isInside = Boolean(
        (target && this.container.contains(target)) ||
        composedPath.includes(this.host) ||
        composedPath.includes(this.container),
      );
      const isToggleInPath = composedPath.some((node) => {
        return Boolean(
          node &&
          typeof node === 'object' &&
          'classList' in node &&
          node.classList?.contains?.('site-menu__toggle'),
        );
      });
      const isToggle = Boolean(
        target?.closest('.site-menu__toggle') || isToggleInPath,
      );

      if (!isInside && !isToggle) {
        this.closeMenu();
      }
    };

    const onUrlChange = () => this.handleUrlChange();

    this.cleanupFns.push(
      this.addListener(document, 'click', handleDocClick),
      this.addListener(window, 'hashchange', onUrlChange),
      this.addListener(window, 'popstate', onUrlChange),
      footerSignals.loaded.subscribe((isLoaded) => {
        if (!isLoaded) return;
        this.setupScrollSpy();
        this.handleUrlChange();
      }),
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

    this.cleanupFns.push(this.addListener(window, 'resize', handleResize));
  }

  /**
   * Ensures hash links on subpages point to root if needed,
   * or fully qualified paths.
   */
  fixSubpageLinks() {
    const path = window.location.pathname;
    const isHomePage = path === '/' || path === '/index.html';

    if (!isHomePage) {
      const links = this.container.querySelectorAll('.site-menu a[href^="#"]');
      links.forEach((link) => {
        const hash = link.getAttribute('href');
        if (hash === '#') return;

        // if the hash target exists on the current page, leave it alone so
        // the browser can jump locally. otherwise rewrite to root-relative
        // so it points at the homepage section.
        if (document.querySelector(hash)) {
          return;
        }

        link.setAttribute('href', `/${hash}`);
      });
    }
  }

  setupScrollSpy() {
    if (this.sectionObserver) this.sectionObserver.disconnect();

    // Logic: Trigger when section is 40% visible or takes up most of screen
    const options = {
      root: null,
      rootMargin: '-30% 0px -50% 0px',
      threshold: 0,
    };

    const callback = (entries) => {
      // Find the "most important" entry
      const visibleEntries = entries.filter((e) => e.isIntersecting);
      if (visibleEntries.length === 0) return;

      const entry = visibleEntries[0]; // Usually the first one that intersects based on margin

      if (entry.target.id) {
        this.updateTitleFromSection(entry.target.id);
      }
    };

    this.sectionObserver = new IntersectionObserver(callback, options);

    const sections = document.querySelectorAll('section[id], footer[id]');
    sections.forEach((s) => this.sectionObserver.observe(s));
  }

  handleUrlChange() {
    this.calculateAndSetActiveLink();
    this.updateTitleFromPathOrSection();
  }

  /**
   * Robust logic to determine which link should be active.
   * Priority:
   * 1. Exact Hash Match (e.g. /#projects)
   * 2. Exact Path Match (e.g. /gallery/)
   * 3. Prefix Match (e.g. /blog/article -> /blog/)
   */
  calculateAndSetActiveLink() {
    const currentPath = window.location.pathname.replace(/\/$/, '') || '/';
    const currentHash = window.location.hash;

    const hrefs = Array.from(
      this.container.querySelectorAll('.site-menu a[href]'),
      (link) => link.getAttribute('href'),
    );
    const activeHref = selectActiveMenuHref(hrefs, {
      currentPath,
      currentHash,
    });
    this.state.setActiveLink(activeHref);
  }

  updateTitleFromPathOrSection() {
    // 1. If Hash is present, check Section Info first
    const hash = window.location.hash;
    if (hash) {
      const sectionId = hash.substring(1);
      const info = this.extractSectionInfo(sectionId);
      if (info) {
        this.state.setTitle(info.title, info.subtitle);
        return;
      }
    }

    // 2. Fallback to Route/Path Info
    const path = window.location.pathname;
    const titleMap = this.config.TITLE_MAP || {};

    // Sort by length to find most specific match first
    const sortedKeys = Object.keys(titleMap).sort(
      (a, b) => b.length - a.length,
    );

    const matchedKey = sortedKeys.find((key) => {
      if (key === '/') return path === '/' || path === '/index.html';
      return path.startsWith(key);
    });

    if (matchedKey) {
      const val = titleMap[matchedKey];
      this.state.setTitle(val.title, val.subtitle || '');
    } else {
      // Default
      this.state.setTitle('menu.home', '');
    }
  }

  updateTitleFromSection(sectionId) {
    // treat footer hash as contact page
    if (sectionId === 'footer') {
      this.state.setTitle('menu.contact', 'menu.contact_sub');
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

    const titleEl = section.querySelector('.section-title, h2, h3');
    const subtitleEl = section.querySelector('.section-subtitle, p.subtitle');

    if (titleEl) {
      return {
        title: titleEl.textContent.trim(),
        subtitle: subtitleEl ? subtitleEl.textContent.trim() : '',
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

  /**
   * @param {boolean} isOpen
   */
  setMenuOpenWithTransition(isOpen) {
    if (this.state.isOpen === isOpen) return;

    void withViewTransition(
      () => {
        this.state.setOpen(isOpen);
      },
      {
        types: [
          isOpen
            ? VIEW_TRANSITION_TYPES.MENU_OPEN
            : VIEW_TRANSITION_TYPES.MENU_CLOSE,
        ],
        rootClasses: [VIEW_TRANSITION_ROOT_CLASSES.MENU],
        preserveLiveBackdropOnMobile: true,
        timeoutMs: VIEW_TRANSITION_TIMINGS_MS.MENU_TIMEOUT,
      },
    );
  }

  /**
   * Helper to add event listener and return cleanup function
   */
  addListener(target, event, handler, options = {}) {
    if (!target) return () => {};
    const passiveByDefault =
      event === 'touchstart' || event === 'touchmove' || event === 'wheel';
    const opts = { passive: passiveByDefault, ...options };
    target.addEventListener(event, handler, opts);
    return () => target.removeEventListener(event, handler, opts);
  }

  destroy() {
    if (this.timers) {
      this.timers.clearAll();
    }
    this.cleanupFns.forEach((fn) => fn());
    this.cleanupFns = [];
    if (this.sectionObserver) {
      this.sectionObserver.disconnect();
      this.sectionObserver = null;
    }
  }
}
