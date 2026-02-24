/**
 * Menu Events Management
 * Handles all user interactions, URL changes, and scroll events.
 */
import { i18n } from '../../../core/i18n.js';
import { TimerManager } from '../../../core/utils.js';

export class MenuEvents {
  /**
   * @param {HTMLElement} container
   * @param {import('./MenuState.js').MenuState} state
   * @param {import('./MenuRenderer.js').MenuRenderer} renderer
   * @param {import('./MenuSearch.js').MenuSearch} menuSearch
   * @param {Object} config
   */
  constructor(container, state, renderer, menuSearch, config = {}) {
    this.container = container;
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
        console.error('Failed to toggle language:', err);
      }
    };

    this.cleanupFns.push(
      this.addListener(langToggle, 'click', handleLangClick),
    );
  }

  setupThemeToggle() {
    const themeToggle = this.container.querySelector('.theme-toggle');
    if (!themeToggle) return;

    // Detect current theme
    const getEffectiveTheme = () => {
      const saved = localStorage.getItem('theme');
      if (saved === 'light' || saved === 'dark') return saved;
      return window.matchMedia('(prefers-color-scheme: light)').matches
        ? 'light'
        : 'dark';
    };

    const applyTheme = (theme) => {
      const root = document.documentElement;
      if (theme === 'light') {
        root.setAttribute('data-theme', 'light');
      } else {
        root.removeAttribute('data-theme');
      }

      // Update theme-color meta tags
      import('/content/core/theme-color-manager.js').then(
        ({ updateThemeColor }) => {
          updateThemeColor();
        },
      );

      // Update apple status bar style if needed
      const appleStatusMeta = document.querySelector(
        'meta[name="apple-mobile-web-app-status-bar-style"]',
      );
      if (appleStatusMeta) {
        // We keep it black-translucent for the transparent look
        appleStatusMeta.setAttribute('content', 'black-translucent');
      }

      // Update toggle button state
      themeToggle.classList.toggle('is-light', theme === 'light');
    };

    // Apply initial theme
    const initialTheme = getEffectiveTheme();
    applyTheme(initialTheme);

    const handleThemeClick = (e) => {
      e.preventDefault();
      const current = getEffectiveTheme();
      const next = current === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem('theme', next);
      } catch {
        /* quota exceeded */
      }
      applyTheme(next);
    };

    // Listen for system preference changes
    const mql = window.matchMedia('(prefers-color-scheme: light)');
    const handleSystemChange = () => {
      const saved = localStorage.getItem('theme');
      if (!saved) {
        applyTheme(mql.matches ? 'light' : 'dark');
      }
    };

    this.cleanupFns.push(
      this.addListener(themeToggle, 'click', handleThemeClick),
    );

    try {
      mql.addEventListener('change', handleSystemChange);
      this.cleanupFns.push(() =>
        mql.removeEventListener('change', handleSystemChange),
      );
    } catch {
      /* older browsers */
    }
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
      this.state.setOpen(isOpen);
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
    return this.container.closest('.site-header');
  }

  getToggleElement() {
    return this.container.querySelector('.site-menu__toggle');
  }

  setupNavigation() {
    const links = this.container.querySelectorAll('.site-menu a[href]');

    links.forEach((link) => {
      const handleClick = (_e) => {
        const href = link.getAttribute('href');
        if (!href) return;

        this.menuSearch.closeSearchModeSilently();

        // Handle internal links
        if (href.startsWith('/') || href.startsWith('#')) {
          this.closeMenu();
        }
      };

      this.cleanupFns.push(this.addListener(link, 'click', handleClick));
    });
  }

  setupGlobalListeners() {
    const handleDocClick = (e) => {
      // SVG taps (e.g. <use> in icon buttons) are Element, not HTMLElement.
      // Using Element prevents false "outside click" detection on icon taps.
      const target = /** @type {Element|null} */ (
        e.target instanceof Element ? e.target : null
      );

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

      const isInside = target ? this.container.contains(target) : false;
      const isToggle = Boolean(target?.closest('.site-menu__toggle'));

      if (!isInside && !isToggle) {
        this.closeMenu();
      }
    };

    const handleEscape = (e) => {
      if (e.key !== 'Escape') return;

      if (this.menuSearch.isSearchOpen()) {
        this.menuSearch.closeSearchMode();
        return;
      }

      if (this.state.isOpen) {
        this.closeMenu();
        const toggle = this.getToggleElement();
        toggle?.focus();
      }
    };

    const onUrlChange = () => this.handleUrlChange();

    this.cleanupFns.push(
      this.addListener(document, 'click', handleDocClick),
      this.addListener(document, 'keydown', handleEscape),
      this.addListener(window, 'hashchange', onUrlChange),
      this.addListener(window, 'popstate', onUrlChange),
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
        // Prepend / to make it a root-relative link to home sections
        // UNLESS the hash exists on current page (rare for this site structure)
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

    const links = Array.from(
      this.container.querySelectorAll('.site-menu a[href]'),
    );

    let bestMatch = null;
    let matchScore = 0; // 3=Hash, 2=ExactPath, 1=Prefix

    links.forEach((link) => {
      const rawHref = link.getAttribute('href');
      if (!rawHref) return;

      // Normalize link href
      // e.g. "/projekte/" -> "/projekte", "/#contact" -> "/#contact"
      const linkPath = rawHref.split('#')[0].replace(/\/$/, '') || '/';
      const linkHash = rawHref.includes('#') ? '#' + rawHref.split('#')[1] : '';

      // Check 1: Exact Hash Match (Highest Priority)
      // Must match path AND hash
      if (linkHash && linkHash === currentHash && linkPath === currentPath) {
        if (matchScore < 3) {
          bestMatch = rawHref;
          matchScore = 3;
        }
        return;
      }

      // Check 2: Exact Path Match (ignoring hash on current page if link has no hash)
      if (!linkHash && linkPath === currentPath) {
        if (matchScore < 2) {
          bestMatch = rawHref;
          matchScore = 2;
        }
        return;
      }

      // Check 3: Prefix Match (Subpages)
      // e.g. current=/blog/post-1, link=/blog/
      // Only if we haven't found a better match
      if (matchScore < 1 && !linkHash && currentPath.startsWith(linkPath)) {
        // Verify it's a real segment match (/blog matches /blog/x, but /b does not match /blog)
        const nextChar = currentPath[linkPath.length];
        if (linkPath === '/' || nextChar === '/') {
          bestMatch = rawHref;
          matchScore = 1;
        }
      }
    });

    this.state.setActiveLink(bestMatch);
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

  closeMenu() {
    this.state.setOpen(false);
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
