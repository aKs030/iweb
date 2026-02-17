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

    this.search = {
      isOpen: false,
      trigger: null,
      panel: null,
      input: null,
      results: null,
      items: [],
      selectedIndex: -1,
      debounceTimer: null,
      abortController: null,
    };
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
    if (!toggle.dataset.defaultAriaLabel) {
      toggle.dataset.defaultAriaLabel = toggle.getAttribute('aria-label') || '';
    }

    const handleToggle = () => {
      if (this.isSearchOpen()) {
        this.closeSearchMode({ restoreFocus: false });
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

  setupSearch() {
    const searchTrigger = this.container.querySelector('.search-trigger');
    const searchPanel = this.container.querySelector('.menu-search');
    const searchInput = this.container.querySelector('.menu-search__input');
    const searchResults = this.container.querySelector('.menu-search__results');

    if (!searchTrigger || !searchPanel || !searchInput || !searchResults) {
      return;
    }

    this.search.trigger = searchTrigger;
    this.search.panel = searchPanel;
    this.search.input = searchInput;
    this.search.results = searchResults;
    if (!searchTrigger.dataset.defaultAriaLabel) {
      searchTrigger.dataset.defaultAriaLabel =
        searchTrigger.getAttribute('aria-label') || '';
    }
    if (!searchTrigger.dataset.defaultTitle) {
      searchTrigger.dataset.defaultTitle =
        searchTrigger.getAttribute('title') || '';
    }

    const handleSearchTrigger = (e) => {
      e.preventDefault();
      if (this.isSearchOpen()) {
        this.closeSearchMode({ restoreFocus: false });
        return;
      }
      this.openSearchMode();
    };

    const handleSearchInput = () => {
      const query = this.search.input ? this.search.input.value : '';
      this.scheduleSearch(query);
    };

    const handleSearchKeydown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        this.closeSearchMode();
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.moveSearchSelection(1);
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.moveSearchSelection(-1);
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        this.activateSelectedSearchResult();
      }
    };

    const handleResultsClick = (e) => {
      const index = this.getSearchResultIndexFromEvent(e);
      if (index < 0) return;

      this.navigateToSearchResult(index);
    };

    const handleResultsMouseMove = (e) => {
      const index = this.getSearchResultIndexFromEvent(e);
      if (index < 0) return;

      this.search.selectedIndex = index;
      this.updateSearchSelectionUI();
    };

    this.cleanupFns.push(
      this.addListener(searchTrigger, 'click', handleSearchTrigger),
      this.addListener(searchInput, 'input', handleSearchInput),
      this.addListener(searchInput, 'keydown', handleSearchKeydown),
      this.addListener(searchResults, 'click', handleResultsClick),
      this.addListener(searchResults, 'mousemove', handleResultsMouseMove),
    );
  }

  getSearchResultIndexFromEvent(event) {
    const target = /** @type {HTMLElement|null} */ (
      event.target instanceof HTMLElement ? event.target : null
    );
    const item = target?.closest?.('[data-search-index]');
    if (!item) return -1;

    const index = Number(item.getAttribute('data-search-index'));
    return Number.isFinite(index) ? index : -1;
  }

  getHeaderElement() {
    return this.container.closest('.site-header');
  }

  isSearchOpen() {
    return Boolean(this.search.isOpen);
  }

  openSearchMode() {
    const header = this.getHeaderElement();
    const panel = this.search.panel;
    const input = this.search.input;
    const trigger = this.search.trigger;
    const toggle = this.container.querySelector('.site-menu__toggle');

    if (!header || !panel || !input) return;
    if (this.search.isOpen) return;

    this.closeMenu();

    this.search.isOpen = true;
    header.classList.add('search-mode');
    panel.setAttribute('aria-hidden', 'false');
    if (trigger) {
      trigger.setAttribute('aria-label', 'Suche schließen');
      trigger.setAttribute('title', 'Suche schließen');
    }
    if (toggle) {
      toggle.classList.add('active');
      toggle.setAttribute('aria-label', 'Suche schließen');
    }

    requestAnimationFrame(() => {
      try {
        input.focus({ preventScroll: true });
      } catch {
        input.focus();
      }
      input.select();
    });

    window.dispatchEvent(new CustomEvent('search:opened'));
  }

  closeSearchMode(options = {}) {
    const { restoreFocus = true } = options;
    if (!this.search.isOpen) return;

    const header = this.getHeaderElement();
    const trigger = this.search.trigger;
    const toggle = this.container.querySelector('.site-menu__toggle');
    if (header) {
      header.classList.remove('search-mode');
    }

    if (this.search.panel) {
      this.search.panel.setAttribute('aria-hidden', 'true');
    }

    this.clearSearchDebounce();
    this.abortSearchRequest();

    this.search.isOpen = false;
    this.search.items = [];
    this.search.selectedIndex = -1;
    if (trigger) {
      const defaultAria =
        trigger.dataset.defaultAriaLabel ||
        trigger.getAttribute('aria-label') ||
        '';
      const defaultTitle =
        trigger.dataset.defaultTitle || trigger.getAttribute('title') || '';
      trigger.setAttribute('aria-label', defaultAria);
      trigger.setAttribute('title', defaultTitle);
    }
    if (toggle) {
      toggle.classList.remove('active');
      const defaultToggleLabel = toggle.dataset.defaultAriaLabel || 'Menü';
      toggle.setAttribute('aria-label', defaultToggleLabel);
    }

    if (this.search.input) {
      this.search.input.value = '';
    }

    this.renderSearchState({ hidden: true });

    if (restoreFocus) {
      this.search.trigger?.focus();
    }

    window.dispatchEvent(new CustomEvent('search:closed'));
  }

  clearSearchDebounce() {
    if (!this.search.debounceTimer) return;
    clearTimeout(this.search.debounceTimer);
    this.search.debounceTimer = null;
  }

  abortSearchRequest() {
    if (!this.search.abortController) return;
    this.search.abortController.abort();
    this.search.abortController = null;
  }

  scheduleSearch(rawQuery) {
    const query = String(rawQuery || '').trim();

    this.clearSearchDebounce();

    if (!query) {
      this.abortSearchRequest();
      this.search.items = [];
      this.search.selectedIndex = -1;
      this.renderSearchState({ hidden: true });
      return;
    }

    const debounceDelay = this.config.SEARCH_DEBOUNCE ?? 220;
    this.search.debounceTimer = setTimeout(() => {
      this.executeSearch(query);
    }, debounceDelay);
  }

  async executeSearch(query) {
    if (!this.search.results) return;

    this.abortSearchRequest();
    this.search.abortController = new AbortController();
    const signal = this.search.abortController.signal;

    this.renderSearchState({
      loading: true,
      message: 'Suche...',
    });

    try {
      const topK = this.config.SEARCH_TOP_K ?? 12;
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, topK }),
        signal,
      });

      if (!response.ok) {
        throw new Error(`Search request failed with status ${response.status}`);
      }

      const data = await response.json();
      const items = Array.isArray(data?.results)
        ? data.results
            .map((item) => this.normalizeSearchResult(item))
            .filter(Boolean)
        : [];

      if (this.search.input?.value.trim() !== query) {
        return;
      }

      this.search.items = items;
      this.search.selectedIndex = items.length > 0 ? 0 : -1;

      if (items.length === 0) {
        this.renderSearchState({
          message: 'Keine Treffer gefunden',
        });
        return;
      }

      this.renderSearchState({
        items,
      });
    } catch (err) {
      if (err?.name === 'AbortError') return;
      console.error('Header search failed:', err);
      this.search.items = [];
      this.search.selectedIndex = -1;
      this.renderSearchState({
        message: 'Suche derzeit nicht verfuegbar',
      });
    } finally {
      if (this.search.abortController?.signal === signal) {
        this.search.abortController = null;
      }
    }
  }

  normalizeSearchResult(item) {
    if (!item || typeof item !== 'object') return null;

    const title = String(item.title || '').trim();
    const url = String(item.url || '').trim();

    if (!title || !url) return null;

    return {
      title,
      url,
      description: String(item.description || '').trim(),
      category: String(item.category || '').trim(),
    };
  }

  renderSearchState(options = {}) {
    if (!this.search.results) return;

    const {
      hidden = false,
      loading = false,
      message = '',
      items = [],
    } = options;

    const results = this.search.results;
    results.innerHTML = '';

    if (hidden) {
      results.classList.remove('active');
      return;
    }

    results.classList.add('active');

    if (loading || message) {
      const stateEl = document.createElement('div');
      stateEl.className = 'menu-search__state';
      stateEl.textContent = message || 'Lade...';
      results.appendChild(stateEl);
      return;
    }

    const list = document.createElement('ul');
    list.className = 'menu-search__list';

    items.forEach((item, index) => {
      const li = document.createElement('li');
      li.className = 'menu-search__item';

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'menu-search__result';
      button.setAttribute('data-search-index', String(index));
      button.setAttribute('role', 'option');
      button.setAttribute(
        'aria-selected',
        String(index === this.search.selectedIndex),
      );

      if (index === this.search.selectedIndex) {
        button.classList.add('is-selected');
      }

      const title = document.createElement('span');
      title.className = 'menu-search__title';
      title.textContent = item.title;

      const meta = document.createElement('span');
      meta.className = 'menu-search__meta';
      meta.textContent = item.category || item.url;

      button.appendChild(title);
      button.appendChild(meta);

      if (item.description) {
        const desc = document.createElement('span');
        desc.className = 'menu-search__desc';
        desc.textContent = item.description;
        button.appendChild(desc);
      }

      li.appendChild(button);
      list.appendChild(li);
    });

    results.appendChild(list);
  }

  updateSearchSelectionUI() {
    if (!this.search.results) return;

    const optionEls = this.search.results.querySelectorAll(
      '[data-search-index]',
    );

    optionEls.forEach((el) => {
      const index = Number(el.getAttribute('data-search-index'));
      const isSelected = index === this.search.selectedIndex;
      el.classList.toggle('is-selected', isSelected);
      el.setAttribute('aria-selected', String(isSelected));

      if (isSelected) {
        el.scrollIntoView({ block: 'nearest' });
      }
    });
  }

  moveSearchSelection(direction) {
    const max = this.search.items.length;
    if (max === 0) return;

    if (this.search.selectedIndex < 0) {
      this.search.selectedIndex = 0;
    } else {
      this.search.selectedIndex =
        (this.search.selectedIndex + direction + max) % max;
    }

    this.updateSearchSelectionUI();
  }

  activateSelectedSearchResult() {
    if (this.search.items.length === 0) return;

    const index =
      this.search.selectedIndex >= 0 ? this.search.selectedIndex : 0;

    this.navigateToSearchResult(index);
  }

  navigateToSearchResult(index) {
    const item = this.search.items[index];
    if (!item?.url) return;

    this.closeSearchMode({ restoreFocus: false });
    window.location.href = item.url;
  }

  setupNavigation() {
    const links = this.container.querySelectorAll('.site-menu a[href]');

    links.forEach((link) => {
      const handleClick = (_e) => {
        const href = link.getAttribute('href');
        if (!href) return;

        this.closeSearchMode({ restoreFocus: false });

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
      // SVG taps (e.g. <use> in icon buttons) are Element, not HTMLElement.
      // Using Element prevents false "outside click" detection on icon taps.
      const target = /** @type {Element|null} */ (
        e.target instanceof Element ? e.target : null
      );

      if (this.isSearchOpen()) {
        const header = this.getHeaderElement();
        const isInsideHeader = Boolean(
          header && target && header.contains(target),
        );

        if (!isInsideHeader) {
          this.closeSearchMode({ restoreFocus: false });
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

      if (this.isSearchOpen()) {
        this.closeSearchMode();
        return;
      }

      if (this.state.isOpen) {
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
    const menuCollapseBreakpoint =
      this.config.MOBILE_BREAKPOINT ?? this.config.TABLET_BREAKPOINT ?? 900;
    const resizeDebounce = this.config.DEBOUNCE_DELAY ?? 100;

    let timeoutId;
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        if (window.innerWidth > menuCollapseBreakpoint && this.state.isOpen) {
          this.closeMenu();
        }
      }, resizeDebounce);
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
      const visibleEntries = entries.filter((e) => e.isIntersecting);
      if (visibleEntries.length === 0) return;

      const entry = visibleEntries[0]; // Usually the first one that intersects based on margin

      if (entry.target.id) {
        this.updateTitleFromSection(entry.target.id);
        // Optionally sync active link for scrolling on homepage
        if (
          window.location.pathname === '/' ||
          window.location.pathname === '/index.html'
        ) {
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
    this.closeSearchMode({ restoreFocus: false });
    this.clearSearchDebounce();
    this.abortSearchRequest();

    this.cleanupFns.forEach((fn) => fn());
    this.cleanupFns = [];
    if (this.sectionObserver) {
      this.sectionObserver.disconnect();
      this.sectionObserver = null;
    }
  }
}
