export class MenuEvents {
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

    // Initial call
    this.handleUrlChange();
  }

  setupLanguageToggle() {
    const langToggle = this.container.querySelector('.lang-toggle');
    if (!langToggle) return;

    const handleLangClick = async (e) => {
      e.preventDefault();
      const { i18n } = await import('/content/core/i18n.js');
      i18n.toggleLanguage();
    };

    this.cleanupFns.push(
      this.addListener(langToggle, 'click', handleLangClick),
    );
  }

  setupToggle() {
    const toggle = this.container.querySelector('.site-menu__toggle');
    const menu = this.container.querySelector('.site-menu');

    if (!toggle || !menu) return;

    const handleToggle = () => {
      const isOpen = !this.state.isOpen;
      this.state.setOpen(isOpen);

      // Let renderer handle UI updates based on state change
      // But we keep this for immediate feedback if needed
      // menu.classList.toggle('open', isOpen);
      // toggle.classList.toggle('active', isOpen);
    };

    this.cleanupFns.push(
      this.addListener(toggle, 'click', handleToggle),
      this.addListener(toggle, 'keydown', (e) => {
        if (e.key === 'Enter') handleToggle();
      }),
    );
  }

  setupSearch() {
    const searchTrigger = this.container.querySelector('.search-trigger');
    if (!searchTrigger) return;

    const handleSearch = async (e) => {
      e.preventDefault();
      this.closeMenu();

      try {
        const module = await import('/content/components/search/search.js');
        if (module.openSearch) module.openSearch();
      } catch (err) {
        console.error('Failed to load search:', err);
      }
    };

    this.cleanupFns.push(
      this.addListener(searchTrigger, 'click', handleSearch),
    );
  }

  setupNavigation() {
    const links = this.container.querySelectorAll('.site-menu a[href]');

    links.forEach((link) => {
      const handleClick = () => {
        const href = link.getAttribute('href');
        const isExternal = /^https?:\/\//i.test(href);

        this.closeMenu();

        // Update active link immediately for better UX
        if (!isExternal) {
          this.updateActiveLinkByHref(href);
        }
      };

      this.cleanupFns.push(this.addListener(link, 'click', handleClick));
    });
  }

  setupGlobalListeners() {
    const handleDocClick = (e) => {
      const isInside = this.container.contains(e.target);
      const isToggle = e.target.closest('.site-menu__toggle');
      if (!isInside && !isToggle && this.state.isOpen) this.closeMenu();
    };

    const handleEscape = (e) => {
      if (e.key === 'Escape' && this.state.isOpen) {
        this.closeMenu();
        this.container.querySelector('.site-menu__toggle')?.focus();
      }
    };

    this.cleanupFns.push(
      this.addListener(document, 'click', handleDocClick),
      this.addListener(document, 'keydown', handleEscape),
    );

    // Watch for URL changes
    const onUrlChange = () => this.handleUrlChange();
    this.cleanupFns.push(
      this.addListener(window, 'hashchange', onUrlChange),
      this.addListener(window, 'popstate', onUrlChange),
    );
  }

  setupResizeHandler() {
    // Simple debounce function
    const debounce = (fn, delay) => {
      let timeoutId;
      return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn.apply(this, args), delay);
      };
    };

    const handleResize = debounce((_e) => {
      // Close mobile menu when resizing to desktop
      if (window.innerWidth > 768 && this.state.isOpen) {
        this.closeMenu();
      }
    }, 150);

    this.cleanupFns.push(this.addListener(window, 'resize', handleResize));
  }

  setupPageSpecific() {
    this.fixSubpageLinks();
    // Titles are now handled via updateTitleFromPathOrSection
  }

  fixSubpageLinks() {
    const path = window.location.pathname;
    const isHomePage = path === '/' || path === '/index.html';

    if (!isHomePage) {
      const links = this.container.querySelectorAll('.site-menu a[href^="#"]');
      links.forEach((link) => {
        const hash = link.getAttribute('href');
        // If it's just '#', ignore
        if (hash === '#') return;

        // Check if it already has a slash prefix (unlikely if startsWith #)
        link.setAttribute('href', `/${hash}`);
      });
    }
  }

  setupScrollSpy() {
    // Use IntersectionObserver to detect which section is active
    // This is primarily for the homepage or pages with sections

    if (this.sectionObserver) {
      this.sectionObserver.disconnect();
    }

    const options = {
      root: null,
      rootMargin: '-20% 0px -60% 0px', // Active when near top/center
      threshold: 0,
    };

    const callback = (entries) => {
      // Find the first intersecting entry
      const visibleSection = entries.find((entry) => entry.isIntersecting);

      if (visibleSection) {
        const sectionId = visibleSection.target.id;
        this.updateTitleFromSection(sectionId);

        // Update hash without scrolling? maybe too intrusive
        // history.replaceState(null, null, `#${sectionId}`);
        // this.updateActiveLinkByHref(`#${sectionId}`);
      }
    };

    this.sectionObserver = new IntersectionObserver(callback, options);

    // Observe all sections that might have titles
    const sections = document.querySelectorAll('section[id], footer[id]');
    sections.forEach((section) => {
      this.sectionObserver.observe(section);
    });
  }

  handleUrlChange() {
    this.setActiveLink();
    this.updateTitleFromPathOrSection();
  }

  setActiveLink() {
    const path = window.location.pathname
      .replace(/index\.html$/, '')
      .replace(/\/$/, '');
    const hash = window.location.hash;

    // We need to find the "best" match among all links
    // 1. Exact match (path + hash)
    // 2. Exact path match (ignoring hash if link has no hash)
    // 3. Parent path match (for subpages)

    let bestMatch = null;
    let maxMatchLength = -1;
    let foundHashMatch = false;

    const links = Array.from(
      this.container.querySelectorAll('.site-menu a[href]'),
    );

    // Reset all first
    // Note: State update will handle the actual class toggling via Renderer,
    // but we need to calculate WHICH one is active here.

    // We will identify the active href and pass it to state
    let activeHref = null;

    links.forEach((a) => {
      const href = a.getAttribute('href');
      if (!href) return;

      // Normalize link href
      // Handle absolute URLs? Assuming mostly relative or same-domain
      let linkPath = href;
      let linkHash = '';

      if (href.includes('#')) {
        const parts = href.split('#');
        linkPath = parts[0];
        linkHash = '#' + parts[1];
      }

      linkPath = linkPath.replace(/index\.html$/, '').replace(/\/$/, '');
      if (linkPath === '') linkPath = '/'; // Normalize root

      // Check for match

      // Case A: Hash Match on Home/Same Page
      if (
        linkHash &&
        (linkPath === path || (path === '' && linkPath === '/'))
      ) {
        if (linkHash === hash) {
          bestMatch = a;
          maxMatchLength = 999; // Priority
          foundHashMatch = true;
        }
      }

      // Case B: Path Match (if no hash match found yet)
      if (!foundHashMatch) {
        if (linkPath === path) {
          // Exact path match
          if (!bestMatch || linkPath.length > maxMatchLength) {
            bestMatch = a;
            maxMatchLength = linkPath.length;
          }
        } else if (path.startsWith(linkPath) && linkPath !== '/') {
          // Prefix match (e.g. /blog/post-1 matches /blog)
          // Ensure /blog matches /blog/post-1 but /b doesn't match /blog
          if (
            path.charAt(linkPath.length) === '/' ||
            path.charAt(linkPath.length) === ''
          ) {
            if (!bestMatch || linkPath.length > maxMatchLength) {
              bestMatch = a;
              maxMatchLength = linkPath.length;
            }
          }
        }
      }

      // Special Case: Home link ('/') should only be active if we are exactly at root and no other match
      if (linkPath === '/' && path === '/' && !hash && !bestMatch) {
        bestMatch = a;
      }
    });

    if (bestMatch) {
      activeHref = bestMatch.getAttribute('href');
    }

    // Update State
    this.state.setActiveLink(activeHref);
  }

  updateActiveLinkByHref(href) {
    this.state.setActiveLink(href);
  }

  updateTitleFromPathOrSection() {
    // If we have a hash, try to find section title first (unless it's empty)
    const hash = window.location.hash;
    if (hash) {
      const sectionId = hash.substring(1);
      const info = this.extractSectionInfo(sectionId);
      if (info) {
        this.state.setTitle(info.title, info.subtitle);
        return;
      }
    }

    // Fallback to Path based title
    const path = window.location.pathname;
    const titleMap = this.config.TITLE_MAP || {};

    // Find best matching path in map
    // Sort keys by length desc to match most specific first
    const sortedKeys = Object.keys(titleMap).sort(
      (a, b) => b.length - a.length,
    );
    const matchedKey = sortedKeys.find((key) => {
      if (key === '/') return path === '/' || path === '/index.html';
      return path.startsWith(key);
    });

    if (matchedKey) {
      const val = titleMap[matchedKey];
      // It might be a string or object {title, subtitle}
      if (typeof val === 'string') {
        this.state.setTitle(val, '');
      } else {
        this.state.setTitle(val.title, val.subtitle || '');
      }
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

    // First check config
    if (fallbackTitles[sectionId]) {
      return fallbackTitles[sectionId];
    }

    // Then check DOM
    const section = document.getElementById(sectionId);
    if (!section) return null;

    // Try to find a header
    const header = section.querySelector('.section-header');
    if (header) {
      const titleEl = header.querySelector('.section-title, h2, h3');
      const subtitleEl = header.querySelector('.section-subtitle, p.subtitle');

      if (titleEl) {
        return {
          title: titleEl.textContent.trim(),
          subtitle: subtitleEl ? subtitleEl.textContent.trim() : '',
        };
      }
    }

    return null;
  }

  closeMenu() {
    this.state.setOpen(false);
  }

  addListener(target, event, handler, options = {}) {
    if (!target?.addEventListener) return () => {};
    const finalOptions = { passive: true, ...options };
    try {
      target.addEventListener(event, handler, finalOptions);
      return () => target.removeEventListener(event, handler, finalOptions);
    } catch {
      return () => {};
    }
  }

  destroy() {
    this.cleanupFns.forEach((fn) => fn());
    this.cleanupFns = [];
    if (this.sectionObserver) {
      this.sectionObserver.disconnect();
      this.sectionObserver = null;
    }
  }
}
