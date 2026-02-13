/**
 * Menu Events Management
 * Handles all user interactions, URL changes, and scroll events.
 */
export class MenuEvents {
  /**
   * @param {HTMLElement} container
   * @param {import('./MenuState.js').MenuState} state
   * @param {import('./MenuRenderer.js').MenuRenderer} renderer
   * @param {Object} config
   */
  constructor(container, state, renderer, config = {}) {
    this.container = container;
    this.state = state;
    this.renderer = renderer;
    this.config = config;
    this.cleanupFns = [];
    this.sectionObserver = null;
  }

  init() {
    this.setupToggle();
    this.setupLanguageToggle();
    this.setupSearch();
    this.setupNavigation();
    this.setupGlobalListeners();
    this.setupResizeHandler();
    this.setupPageSpecific();
    this.setupScrollSpy();

    // Initial state sync
    this.handleUrlChange();
  }

  setupLanguageToggle() {
    const langToggle = this.container.querySelector('.lang-toggle');
    if (!langToggle) return;

    const handleLangClick = async (e) => {
      e.preventDefault();
      try {
        const { i18n } = await import('/content/core/i18n.js');
        i18n.toggleLanguage();
      } catch (err) {
        console.error('Failed to toggle language:', err);
      }
    };

    this.cleanupFns.push(
      this.addListener(langToggle, 'click', handleLangClick),
    );
  }

  setupToggle() {
    const toggle = this.container.querySelector('.site-menu__toggle');
    if (!toggle) return;

    const handleToggle = () => {
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

  setupSearch() {
    const searchTrigger = this.container.querySelector('.search-trigger');
    if (!searchTrigger) return;

    const handleSearch = async (e) => {
      e.preventDefault();
      this.closeMenu();

      // Visual feedback
      searchTrigger.classList.add('loading');

      try {
        const module = await import('/content/components/search/search.js');
        if (module.openSearch) {
          module.openSearch();
        }
      } catch (err) {
        console.error('Failed to load search:', err);
      } finally {
        searchTrigger.classList.remove('loading');
      }
    };

    this.cleanupFns.push(
      this.addListener(searchTrigger, 'click', handleSearch),
    );
  }

  setupNavigation() {
    const links = this.container.querySelectorAll('.site-menu a[href]');

    links.forEach((link) => {
      const handleClick = (e) => {
        const href = link.getAttribute('href');
        if (!href) return;

        // Handle internal links
        if (href.startsWith('/') || href.startsWith('#')) {
          this.closeMenu();

          // If it's a hash link on the same page, we let browser handle scroll
          // but we might want to update active state manually for instant feedback
          const isHash = href.includes('#');
          const isSamePage = href.split('#')[0] === window.location.pathname;

          if (!isHash || !isSamePage) {
             // Let normal navigation happen
          }
        }
      };

      this.cleanupFns.push(this.addListener(link, 'click', handleClick));
    });
  }

  setupGlobalListeners() {
    const handleDocClick = (e) => {
      if (!this.state.isOpen) return;

      const isInside = this.container.contains(e.target);
      const isToggle = e.target.closest('.site-menu__toggle');

      if (!isInside && !isToggle) {
        this.closeMenu();
      }
    };

    const handleEscape = (e) => {
      if (e.key === 'Escape' && this.state.isOpen) {
        this.closeMenu();
        const toggle = this.container.querySelector('.site-menu__toggle');
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
    let timeoutId;
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        if (window.innerWidth > 900 && this.state.isOpen) {
          this.closeMenu();
        }
      }, 100);
    };

    this.cleanupFns.push(this.addListener(window, 'resize', handleResize));
  }

  setupPageSpecific() {
    this.fixSubpageLinks();
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
      const visibleEntries = entries.filter(e => e.isIntersecting);
      if (visibleEntries.length === 0) return;

      const entry = visibleEntries[0]; // Usually the first one that intersects based on margin

      if (entry.target.id) {
        this.updateTitleFromSection(entry.target.id);
        // Optionally sync active link for scrolling on homepage
        if (window.location.pathname === '/' || window.location.pathname === '/index.html') {
             // We could update state here, but let's be careful not to spam
             // this.state.setActiveLink(`/#${entry.target.id}`);
        }
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
    const fullUrl = currentPath + currentHash;

    const links = Array.from(this.container.querySelectorAll('.site-menu a[href]'));

    let bestMatch = null;
    let matchScore = 0; // 3=Hash, 2=ExactPath, 1=Prefix

    links.forEach(link => {
      const rawHref = link.getAttribute('href');
      if (!rawHref) return;

      // Normalize link href
      // e.g. "/projekte/" -> "/projekte", "/#contact" -> "/#contact"
      let linkPath = rawHref.split('#')[0].replace(/\/$/, '') || '/';
      let linkHash = rawHref.includes('#') ? '#' + rawHref.split('#')[1] : '';

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
    const sortedKeys = Object.keys(titleMap).sort((a, b) => b.length - a.length);

    const matchedKey = sortedKeys.find(key => {
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
    const opts = { passive: true, ...options };
    target.addEventListener(event, handler, opts);
    return () => target.removeEventListener(event, handler, opts);
  }

  destroy() {
    this.cleanupFns.forEach(fn => fn());
    this.cleanupFns = [];
    if (this.sectionObserver) {
      this.sectionObserver.disconnect();
      this.sectionObserver = null;
    }
  }
}
