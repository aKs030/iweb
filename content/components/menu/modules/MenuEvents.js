/**
 * Menu Events Management
 * Handles all user interactions, URL changes, and scroll events.
 */
import { i18n } from '../../../core/i18n.js';

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
      bar: null,
      input: null,
      results: null,
      items: [],
      selectedIndex: -1,
      debounceTimer: null,
      abortController: null,
    };

    this.searchCache = new Map();
    this.searchCacheTtlMs = this.config.SEARCH_CACHE_TTL_MS ?? 120000;
    this.searchCacheMaxEntries = this.config.SEARCH_CACHE_MAX_ENTRIES ?? 40;
  }

  init() {
    this.setupToggle();
    this.setupLanguageToggle();
    this.setupSearch();
    this.setupI18nSync();
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

  setupToggle() {
    const toggle = this.container.querySelector('.site-menu__toggle');
    if (!toggle) return;

    const handleToggle = () => {
      if (this.isSearchOpen()) {
        this.closeSearchModeSilently();
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
    const searchBar = this.container.querySelector('.menu-search__bar');
    const searchInput = this.container.querySelector('.menu-search__input');
    const searchResults = this.container.querySelector('.menu-search__results');

    if (
      !searchTrigger ||
      !searchPanel ||
      !searchBar ||
      !searchInput ||
      !searchResults
    ) {
      return;
    }

    this.search.trigger = searchTrigger;
    this.search.panel = searchPanel;
    this.search.bar = searchBar;
    this.search.input = searchInput;
    this.search.results = searchResults;

    const handleSearchTrigger = (e) => {
      e.preventDefault();
      if (this.isSearchOpen()) {
        this.closeSearchModeSilently();
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

    const handleResultsPointerOver = (e) => {
      const index = this.getSearchResultIndexFromEvent(e);
      if (index < 0) return;
      if (this.search.selectedIndex === index) return;

      this.search.selectedIndex = index;
      this.updateSearchSelectionUI();
    };

    this.cleanupFns.push(
      this.addListener(searchTrigger, 'click', handleSearchTrigger),
      this.addListener(searchInput, 'input', handleSearchInput),
      this.addListener(searchInput, 'keydown', handleSearchKeydown),
      this.addListener(searchResults, 'click', handleResultsClick),
      this.addListener(searchResults, 'pointerover', handleResultsPointerOver),
    );
  }

  setupI18nSync() {
    this.cleanupFns.push(
      i18n.subscribe(() => {
        const isSearchOpen = this.isSearchOpen();
        this.syncSearchTriggerState(isSearchOpen);
        this.syncToggleSearchState(isSearchOpen);
      }),
    );
  }

  getSearchResultIndexFromEvent(event) {
    const target = /** @type {Element|null} */ (
      event.target instanceof Element ? event.target : null
    );
    const item = target?.closest?.('[data-search-index]');
    if (!item) return -1;

    const index = Number(item.getAttribute('data-search-index'));
    return Number.isFinite(index) ? index : -1;
  }

  getHeaderElement() {
    return this.container.closest('.site-header');
  }

  getToggleElement() {
    return this.container.querySelector('.site-menu__toggle');
  }

  isSearchOpen() {
    return Boolean(this.search.isOpen);
  }

  t(key, fallback = '') {
    const translated = i18n.t(key);
    if (translated === key) {
      return fallback || key;
    }
    return translated;
  }

  closeSearchModeSilently() {
    this.closeSearchMode({ restoreFocus: false });
  }

  syncSearchTriggerState(isOpen) {
    const trigger = this.search.trigger;
    if (!trigger) return;

    if (isOpen) {
      const closeLabel = this.t('menu.search_close', 'Suche schließen');
      trigger.setAttribute('aria-label', closeLabel);
      trigger.setAttribute('title', closeLabel);
      trigger.setAttribute('aria-expanded', 'true');
      return;
    }

    trigger.setAttribute('aria-label', this.t('menu.search_label', 'Suche'));
    trigger.setAttribute(
      'title',
      this.t('menu.search_tooltip', 'Website durchsuchen'),
    );
    trigger.setAttribute('aria-expanded', 'false');
  }

  syncToggleSearchState(isOpen) {
    const toggle = this.getToggleElement();
    if (!toggle) return;

    toggle.classList.toggle('active', isOpen);
    if (isOpen) {
      toggle.setAttribute(
        'aria-label',
        this.t('menu.search_close', 'Suche schließen'),
      );
      return;
    }

    toggle.setAttribute('aria-label', this.t('menu.toggle', 'Menü'));
  }

  openSearchMode() {
    const header = this.getHeaderElement();
    const panel = this.search.panel;
    const input = this.search.input;

    if (!header || !panel || !input) return;
    if (this.search.isOpen) return;

    this.closeMenu();

    this.search.isOpen = true;
    header.classList.add('search-mode');
    panel.setAttribute('aria-hidden', 'false');
    this.syncSearchTriggerState(true);
    this.syncToggleSearchState(true);
    this.setSearchPopupExpanded(false);

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
    this.syncSearchTriggerState(false);
    this.syncToggleSearchState(false);

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
    const minQueryLength = this.config.SEARCH_MIN_QUERY_LENGTH ?? 2;

    this.clearSearchDebounce();

    if (!query || query.length < minQueryLength) {
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
    const topK = this.config.SEARCH_TOP_K ?? 12;
    const requestTimeoutMs = this.config.SEARCH_REQUEST_TIMEOUT ?? 6000;
    const cacheKey = this.buildSearchCacheKey(query, topK);
    const cachedItems = this.getCachedSearchResults(cacheKey);

    if (cachedItems) {
      if (this.search.input?.value.trim() !== query) return;
      this.search.items = cachedItems;
      this.search.selectedIndex = cachedItems.length > 0 ? 0 : -1;

      if (cachedItems.length === 0) {
        this.renderSearchState({
          message: this.t('menu.search_no_results', 'Keine Treffer gefunden'),
        });
        return;
      }

      this.renderSearchState({
        items: cachedItems,
      });
      return;
    }

    const abortController = new AbortController();
    this.search.abortController = abortController;
    const signal = abortController.signal;
    let didTimeoutAbort = false;
    const timeoutId =
      requestTimeoutMs > 0
        ? setTimeout(() => {
            didTimeoutAbort = true;
            abortController.abort();
          }, requestTimeoutMs)
        : null;

    this.renderSearchState({
      loading: true,
      message: this.t('menu.search_loading', 'Suche...'),
    });

    try {
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
      this.setCachedSearchResults(cacheKey, items);

      if (items.length === 0) {
        this.renderSearchState({
          message: this.t('menu.search_no_results', 'Keine Treffer gefunden'),
        });
        return;
      }

      this.renderSearchState({
        items,
      });
    } catch (err) {
      if (err?.name === 'AbortError' && !didTimeoutAbort) return;
      console.error('Header search failed:', err);
      this.search.items = [];
      this.search.selectedIndex = -1;
      this.renderSearchState({
        message: didTimeoutAbort
          ? this.t('menu.search_timeout', 'Suche dauert zu lange')
          : this.t('menu.search_unavailable', 'Suche derzeit nicht verfuegbar'),
      });
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
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
    results.setAttribute('aria-busy', String(Boolean(loading)));

    if (hidden) {
      results.classList.remove('active');
      this.setSearchPopupExpanded(false);
      return;
    }

    results.classList.add('active');
    this.setSearchPopupExpanded(true);

    if (loading || message) {
      const stateEl = document.createElement('div');
      stateEl.className = 'menu-search__state';
      stateEl.textContent = message || this.t('common.loading', 'Lade...');
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
      button.id = this.buildSearchOptionId(index);
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
    let activeOptionId = '';

    optionEls.forEach((el) => {
      const index = Number(el.getAttribute('data-search-index'));
      const isSelected = index === this.search.selectedIndex;
      el.classList.toggle('is-selected', isSelected);
      el.setAttribute('aria-selected', String(isSelected));

      if (isSelected) {
        activeOptionId = el.id || '';
        el.scrollIntoView({ block: 'nearest' });
      }
    });

    if (this.search.input) {
      if (activeOptionId) {
        this.search.input.setAttribute('aria-activedescendant', activeOptionId);
      } else {
        this.search.input.removeAttribute('aria-activedescendant');
      }
    }
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

    this.closeSearchModeSilently();
    window.location.href = item.url;
  }

  setSearchPopupExpanded(isExpanded) {
    const expanded = String(Boolean(isExpanded));

    if (this.search.bar) {
      this.search.bar.setAttribute('aria-expanded', expanded);
    }

    if (this.search.input) {
      this.search.input.setAttribute('aria-expanded', expanded);
      if (!isExpanded) {
        this.search.input.removeAttribute('aria-activedescendant');
      }
    }
  }

  buildSearchCacheKey(query, topK) {
    return `${topK}:${String(query || '')
      .trim()
      .toLowerCase()}`;
  }

  buildSearchOptionId(index) {
    const resultsId = this.search.results?.id || 'menu-search-results';
    return `${resultsId}-option-${index}`;
  }

  getCachedSearchResults(cacheKey) {
    if (!cacheKey) return null;

    const entry = this.searchCache.get(cacheKey);
    if (!entry) return null;

    if (entry.expiresAt <= Date.now()) {
      this.searchCache.delete(cacheKey);
      return null;
    }

    // Mark as recently used (LRU).
    this.searchCache.delete(cacheKey);
    this.searchCache.set(cacheKey, entry);

    return entry.items.map((item) => ({ ...item }));
  }

  setCachedSearchResults(cacheKey, items) {
    if (!cacheKey || !Array.isArray(items)) return;
    if (this.searchCacheMaxEntries <= 0) return;

    if (this.searchCache.has(cacheKey)) {
      this.searchCache.delete(cacheKey);
    }

    if (this.searchCache.size >= this.searchCacheMaxEntries) {
      const leastRecentlyUsedKey = this.searchCache.keys().next().value;
      if (leastRecentlyUsedKey) {
        this.searchCache.delete(leastRecentlyUsedKey);
      }
    }

    this.searchCache.set(cacheKey, {
      expiresAt: Date.now() + this.searchCacheTtlMs,
      items: items.map((item) => ({ ...item })),
    });
  }

  setupNavigation() {
    const links = this.container.querySelectorAll('.site-menu a[href]');

    links.forEach((link) => {
      const handleClick = (_e) => {
        const href = link.getAttribute('href');
        if (!href) return;

        this.closeSearchModeSilently();

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

      if (this.isSearchOpen()) {
        const header = this.getHeaderElement();
        const isInsideHeader = Boolean(
          header && target && header.contains(target),
        );

        if (!isInsideHeader) {
          this.closeSearchModeSilently();
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
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
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
    this.closeSearchModeSilently();
    this.clearSearchDebounce();
    this.abortSearchRequest();
    this.searchCache.clear();

    this.cleanupFns.forEach((fn) => fn());
    this.cleanupFns = [];
    if (this.sectionObserver) {
      this.sectionObserver.disconnect();
      this.sectionObserver = null;
    }
  }
}
