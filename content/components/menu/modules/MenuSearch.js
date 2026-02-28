/**
 * Menu Search Module
 * Handles search functionality, API interactions, and search UI state.
 */
import { i18n } from '../../../core/i18n.js';
import { TimerManager } from '../../../core/utils.js';
import { createLogger } from '../../../core/logger.js';
import { resourceHints } from '../../../core/resource-hints.js';
import { uiStore } from '../../../core/ui-store.js';

const log = createLogger('MenuSearch');

export class MenuSearch {
  /**
   * @param {HTMLElement} container
   * @param {import('./MenuState.js').MenuState} state
   * @param {Object} config
   */
  constructor(container, state, config = {}) {
    this.container = container;
    this.state = state;
    this.config = config;
    this.cleanupFns = [];
    this.timers = new TimerManager('MenuSearch');

    this.isOpen = false;
    this.trigger = null;
    this.panel = null;
    this.bar = null;
    this.input = null;
    this.results = null;
    this.clearBtn = null;
    this.items = [];
    this.aiChatMessage = '';
    this.selectedIndex = -1;
    this.debounceTimer = null;
    this.abortController = null;
    this.searchDepsPreloaded = false;
    this.searchDepsIntentTimer = null;

    this.searchCache = new Map();
    this.searchCacheTtlMs = this.config.SEARCH_CACHE_TTL_MS ?? 120000;
    this.searchCacheMaxEntries = this.config.SEARCH_CACHE_MAX_ENTRIES ?? 40;

    /** @type {string[]} recent search queries (max 5) */
    this.recentSearches = this.loadRecentSearches();
  }

  init() {
    this.setupSearch();
    this.setupI18nSync();
  }

  setupSearch() {
    const searchTrigger = this.container.querySelector('.search-trigger');
    const searchPanel = this.container.querySelector('.menu-search');
    const searchBar = this.container.querySelector('.menu-search__bar');
    const searchInput = this.container.querySelector('.menu-search__input');
    const searchResults = this.container.querySelector('.menu-search__results');
    const clearBtn = this.container.querySelector('.menu-search__clear');

    if (
      !searchTrigger ||
      !searchPanel ||
      !searchBar ||
      !searchInput ||
      !searchResults
    ) {
      return;
    }

    this.trigger = searchTrigger;
    this.panel = searchPanel;
    this.bar = searchBar;
    this.input = searchInput;
    this.results = searchResults;
    this.clearBtn = clearBtn;

    const handleSearchTrigger = (e) => {
      e.preventDefault();
      if (this.isSearchOpen()) {
        this.closeSearchModeSilently();
        return;
      }
      this.openSearchMode();
    };

    const handleSearchInput = () => {
      const query = this.input ? this.input.value : '';
      this.updateClearButtonVisibility(query);
      this.scheduleSearch(query);
    };

    const handleSearchFocus = () => {
      const query = (this.input?.value || '').trim();
      if (!query && this.recentSearches.length > 0) {
        this.renderRecentSearches();
      }
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
      // Check for recent search click
      const recentBtn = e.target?.closest?.('[data-recent-query]');
      if (recentBtn) {
        const query = recentBtn.getAttribute('data-recent-query');
        if (query && this.input) {
          this.input.value = query;
          this.updateClearButtonVisibility(query);
          this.scheduleSearch(query);
        }
        return;
      }

      const suggestionBtn = e.target?.closest?.('[data-search-suggestion-url]');
      if (suggestionBtn) {
        const url = suggestionBtn.getAttribute('data-search-suggestion-url');
        if (url) {
          this.closeSearchModeSilently();
          window.location.href = url;
        }
        return;
      }

      const index = this.getSearchResultIndexFromEvent(e);
      if (index < 0) return;

      this.navigateToSearchResult(index);
    };

    const handleResultsPointerOver = (e) => {
      const index = this.getSearchResultIndexFromEvent(e);
      if (index < 0) return;
      if (this.selectedIndex === index) return;

      this.selectedIndex = index;
      this.updateSearchSelectionUI();
    };

    const handleClearClick = () => {
      if (this.input) {
        this.input.value = '';
        this.updateClearButtonVisibility('');
        this.items = [];
        this.aiChatMessage = '';
        this.selectedIndex = -1;
        this.renderSearchState({ hidden: true });
        this.input.focus();
        // Show recent searches again
        if (this.recentSearches.length > 0) {
          this.renderRecentSearches();
        }
      }
    };

    this.cleanupFns.push(
      this.addListener(searchTrigger, 'click', handleSearchTrigger),
      this.addListener(searchInput, 'input', handleSearchInput),
      this.addListener(searchInput, 'focus', handleSearchFocus),
      this.addListener(searchInput, 'keydown', handleSearchKeydown),
      this.addListener(searchResults, 'click', handleResultsClick),
      this.addListener(searchResults, 'pointerover', handleResultsPointerOver),
    );

    if (clearBtn) {
      this.cleanupFns.push(
        this.addListener(clearBtn, 'click', handleClearClick),
      );
    }

    this.setupSearchDependencyPreloadIntent();
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
    return Boolean(this.isOpen);
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
    const trigger = this.trigger;
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
    const panel = this.panel;
    const input = this.input;

    if (!header || !panel || !input) return;
    if (this.isOpen) return;

    // Close menu if open
    this.state.setOpen(false);

    this.isOpen = true;
    uiStore.setState({ searchOpen: true });
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
    if (!this.isOpen) return;

    const header = this.getHeaderElement();
    if (header) {
      header.classList.remove('search-mode');
    }

    if (this.panel) {
      this.panel.setAttribute('aria-hidden', 'true');
    }

    this.clearSearchDebounce();
    this.abortSearchRequest();

    this.isOpen = false;
    uiStore.setState({ searchOpen: false });
    this.items = [];
    this.aiChatMessage = '';
    this.selectedIndex = -1;
    this.syncSearchTriggerState(false);
    this.syncToggleSearchState(false);

    if (this.input) {
      this.input.value = '';
    }

    this.renderSearchState({ hidden: true });

    if (restoreFocus) {
      this.trigger?.focus();
    }

    window.dispatchEvent(new CustomEvent('search:closed'));
  }

  clearSearchDebounce() {
    if (!this.debounceTimer) return;
    this.timers.clearTimeout(this.debounceTimer);
    this.debounceTimer = null;
  }

  isAbortLikeError(error) {
    if (!error || typeof error !== 'object') return false;

    if (error.name === 'AbortError' || error.code === 20) {
      return true;
    }

    const message = String(error.message || '').toLowerCase();
    return message.includes('abort');
  }

  abortSearchRequest() {
    if (!this.abortController) return;
    this.abortController.abort();
    this.abortController = null;
  }

  scheduleSearch(rawQuery) {
    const query = String(rawQuery || '').trim();
    const minQueryLength = this.config.SEARCH_MIN_QUERY_LENGTH ?? 2;

    this.clearSearchDebounce();

    if (!query || query.length < minQueryLength) {
      this.abortSearchRequest();
      this.items = [];
      this.aiChatMessage = '';
      this.selectedIndex = -1;
      // Show recent searches when clearing
      if (!query && this.recentSearches.length > 0 && this.isSearchOpen()) {
        this.renderRecentSearches();
      } else {
        this.renderSearchState({ hidden: true });
      }
      return;
    }

    const debounceDelay = this.config.SEARCH_DEBOUNCE ?? 220;
    this.debounceTimer = this.timers.setTimeout(() => {
      this.executeSearch(query);
    }, debounceDelay);
  }

  async executeSearch(query) {
    if (!this.results) return;

    this.abortSearchRequest();
    const topK = this.config.SEARCH_TOP_K ?? 12;
    const requestTimeoutMs = this.config.SEARCH_REQUEST_TIMEOUT ?? 6000;
    const cacheKey = this.buildSearchCacheKey(query, topK);
    const cachedPayload = this.getCachedSearchResults(cacheKey);

    if (cachedPayload) {
      this.applySearchPayload(query, {
        items: cachedPayload.items,
        query,
        aiChatMessage: cachedPayload.aiChatMessage,
      });
      return;
    }

    if (navigator.onLine === false) {
      const offlineItems = this.buildOfflineSearchResults(query);
      this.applySearchPayload(query, {
        items: offlineItems,
        query,
        aiChatMessage: '',
        cacheKey,
        statusMessage: this.t(
          'menu.search_offline',
          'Offline-Modus: lokale Treffer',
        ),
      });
      return;
    }

    const abortController = new AbortController();
    this.abortController = abortController;
    const signal = abortController.signal;
    let didTimeoutAbort = false;
    const timeoutId =
      requestTimeoutMs > 0
        ? this.timers.setTimeout(() => {
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
      const aiChat = this.normalizeSearchChatPayload(
        data?.aiChat,
        data?.summary,
      );
      this.applySearchPayload(query, {
        items,
        query,
        aiChatMessage: aiChat.message,
        cacheKey,
      });
    } catch (err) {
      const isAbortError = this.isAbortLikeError(err);

      if (isAbortError && !didTimeoutAbort) {
        return;
      }

      if (!isAbortError) {
        log.error('Header search failed:', err);
      }

      this.items = [];
      this.aiChatMessage = '';
      this.selectedIndex = -1;
      this.renderSearchState({
        message: didTimeoutAbort
          ? this.t('menu.search_timeout', 'Suche dauert zu lange')
          : this.t('menu.search_unavailable', 'Suche derzeit nicht verfuegbar'),
      });
    } finally {
      if (timeoutId) {
        this.timers.clearTimeout(timeoutId);
      }
      if (this.abortController?.signal === signal) {
        this.abortController = null;
      }
    }
  }

  applySearchPayload(query, payload = {}) {
    if (this.input?.value.trim() !== query) return;

    const items = Array.isArray(payload.items) ? payload.items : [];
    const aiChatMessage = String(payload.aiChatMessage || '');
    const statusMessage = String(payload.statusMessage || '');
    const cacheKey = String(payload.cacheKey || '').trim();
    const inlineAiMode = Boolean(aiChatMessage);
    const visibleItems = inlineAiMode ? [] : items;

    this.items = visibleItems;
    this.aiChatMessage = aiChatMessage;
    this.selectedIndex = visibleItems.length > 0 ? 0 : -1;

    if (cacheKey) {
      this.setCachedSearchResults(cacheKey, items, aiChatMessage);
    }

    this.renderSearchState({
      items: visibleItems,
      query,
      aiChatMessage,
      message: statusMessage,
    });

    if (items.length > 0 || aiChatMessage) {
      this.saveRecentSearch(query);
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
      highlightedDescription: String(
        item.highlightedDescription || item.description || '',
      ).trim(),
      category: String(item.category || '').trim(),
    };
  }

  sanitizeSearchLinkUrl(rawUrl) {
    const value = String(rawUrl || '').trim();
    if (!value) return '';

    try {
      const parsed = new URL(value, window.location.origin);
      if (!['http:', 'https:'].includes(parsed.protocol)) return '';

      const hostname = parsed.hostname.toLowerCase();
      const allowedHosts = new Set([
        window.location.hostname.toLowerCase(),
        'www.abdulkerimsesli.de',
        'abdulkerimsesli.de',
      ]);
      if (!allowedHosts.has(hostname)) return '';

      return `${parsed.pathname}${parsed.search}${parsed.hash}` || '/';
    } catch {
      return '';
    }
  }

  normalizeSearchChatMessage(value) {
    let text = String(value || '').trim();
    if (!text) return '';
    // Basic Markdown to HTML
    text = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    // Markdown links [label](url)
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, rawUrl) => {
      const safeUrl = this.sanitizeSearchLinkUrl(rawUrl);
      if (!safeUrl) return label;
      return `<a href="${safeUrl}" class="menu-search__ai-link">${label}</a>`;
    });
    // Plain URLs to internal clickable links
    text = text.replace(
      /(^|[\s(])(https?:\/\/[^\s<)]+)/gi,
      (_match, prefix, rawUrl) => {
        const safeUrl = this.sanitizeSearchLinkUrl(rawUrl);
        if (!safeUrl) return `${prefix}${rawUrl}`;
        return `${prefix}<a href="${safeUrl}" class="menu-search__ai-link">${safeUrl}</a>`;
      },
    );
    // Code blocks / inline
    text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
    // Bold & italic
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
    // Lines
    text = text.replace(/\n\n+/g, '</p><p>');
    text = text.replace(/\n/g, '<br>');
    return `<p>${text}</p>`;
  }

  normalizeSearchChatPayload(aiChat, fallbackSummary = '') {
    const payload = aiChat && typeof aiChat === 'object' ? aiChat : {};
    const message = this.normalizeSearchChatMessage(
      payload.message || fallbackSummary || '',
    );
    return { message };
  }

  getCategoryLabel(category) {
    const key = String(category || '')
      .trim()
      .toLowerCase();

    const labels = {
      home: 'Start',
      projekte: 'Projekte',
      blog: 'Blog',
      galerie: 'Galerie',
      videos: 'Videos',
      'ueber mich': 'About',
      'über mich': 'About',
      kontakt: 'Kontakt',
      seite: 'Seite',
    };

    return labels[key] || category || 'Seite';
  }

  formatSearchResultUrl(rawUrl) {
    const fallback = String(rawUrl || '').trim();
    if (!fallback) return '';

    try {
      const parsed = new URL(fallback, window.location.origin);
      const basePath = parsed.pathname || '/';
      const compactPath =
        basePath.length > 44
          ? `${basePath.slice(0, 41).replace(/\/+$/, '')}...`
          : basePath;

      return `${compactPath}${parsed.search}`;
    } catch {
      return fallback.length > 46 ? `${fallback.slice(0, 43)}...` : fallback;
    }
  }

  getFallbackSuggestions() {
    return [
      {
        title: this.t('menu.nav_home', 'Startseite'),
        url: '/',
      },
      {
        title: this.t('menu.nav_about', 'About'),
        url: '/about/',
      },
      {
        title: this.t('menu.nav_blog', 'Blog'),
        url: '/blog/',
      },
      {
        title: this.t('menu.nav_projects', 'Projekte'),
        url: '/projekte/',
      },
    ];
  }

  buildOfflineSearchResults(query) {
    const normalizedQuery = String(query || '')
      .trim()
      .toLowerCase();
    if (!normalizedQuery) return [];

    const fallbackSources = [
      ...this.getFallbackSuggestions(),
      { title: this.t('menu.nav_gallery', 'Galerie'), url: '/gallery/' },
      { title: this.t('menu.nav_videos', 'Videos'), url: '/videos/' },
      { title: this.t('menu.contact', 'Kontakt'), url: '#footer' },
    ];

    return fallbackSources
      .filter((item) => {
        const title = String(item.title || '').toLowerCase();
        const url = String(item.url || '').toLowerCase();
        return title.includes(normalizedQuery) || url.includes(normalizedQuery);
      })
      .slice(0, 6)
      .map((item) => ({
        title: String(item.title || ''),
        url: String(item.url || '/'),
        description: this.t(
          'menu.search_offline_desc',
          'Aus lokal verfügbaren Navigationseinträgen',
        ),
        highlightedDescription: '',
        category: this.t('menu.search_offline_category', 'Offline'),
      }));
  }

  setupSearchDependencyPreloadIntent() {
    const trigger = this.trigger;
    const bar = this.bar;
    if (!trigger || !bar) return;

    const preload = () => this.preloadSearchDependencies();
    const scheduleIntent = () => {
      if (this.searchDepsPreloaded || this.searchDepsIntentTimer) return;
      this.searchDepsIntentTimer = this.timers.setTimeout(() => {
        this.searchDepsIntentTimer = null;
        preload();
      }, 80);
    };

    const clearIntentTimer = () => {
      if (!this.searchDepsIntentTimer) return;
      this.timers.clearTimeout(this.searchDepsIntentTimer);
      this.searchDepsIntentTimer = null;
    };

    const isPointerNearSearchControl = (event) => {
      const pointerX = Number(event?.clientX);
      const pointerY = Number(event?.clientY);
      if (!Number.isFinite(pointerX) || !Number.isFinite(pointerY)) {
        return false;
      }

      const rects = [trigger, bar]
        .map((element) => element?.getBoundingClientRect?.())
        .filter(Boolean);
      if (!rects.length) return false;

      return rects.some((rect) => {
        const dx =
          pointerX < rect.left
            ? rect.left - pointerX
            : pointerX > rect.right
              ? pointerX - rect.right
              : 0;
        const dy =
          pointerY < rect.top
            ? rect.top - pointerY
            : pointerY > rect.bottom
              ? pointerY - rect.bottom
              : 0;
        return Math.hypot(dx, dy) <= 120;
      });
    };

    const handlePointerMove = (event) => {
      if (this.searchDepsPreloaded) return;
      if (!isPointerNearSearchControl(event)) return;
      scheduleIntent();
    };

    const canHover = window.matchMedia?.('(hover: hover)').matches;
    if (canHover) {
      this.cleanupFns.push(
        this.addListener(this.container, 'pointermove', handlePointerMove, {
          passive: true,
        }),
        this.addListener(trigger, 'pointerenter', scheduleIntent),
        this.addListener(bar, 'pointerenter', scheduleIntent),
      );
    }

    this.cleanupFns.push(
      this.addListener(trigger, 'focus', preload),
      this.addListener(bar, 'focusin', preload),
      this.addListener(trigger, 'click', preload),
      clearIntentTimer,
    );
  }

  preloadSearchDependencies() {
    if (this.searchDepsPreloaded) return;
    this.searchDepsPreloaded = true;

    const deps = this.resolveSearchDependencyUrls();
    deps.forEach((href) => resourceHints.modulePreload(href));
  }

  resolveSearchDependencyUrls() {
    const importMapScript = document.querySelector('script[type="importmap"]');
    const fallback = [
      'https://esm.sh/htm@3.1.1',
      'https://esm.sh/react-dom@19.2.4',
      'https://esm.sh/react-dom@19.2.4/client',
    ];

    if (!importMapScript?.textContent) return fallback;

    try {
      const parsed = JSON.parse(importMapScript.textContent);
      const imports = parsed?.imports || {};

      const urls = ['htm', 'react-dom', 'react-dom/client']
        .map((key) => String(imports[key] || '').trim())
        .filter(Boolean);

      return urls.length ? urls : fallback;
    } catch (error) {
      log.warn('Failed to parse importmap for search preloading:', error);
      return fallback;
    }
  }

  renderSearchEmptyState(query = '') {
    const wrap = document.createElement('div');
    wrap.className = 'menu-search__empty';

    const title = document.createElement('p');
    title.className = 'menu-search__empty-title';
    if (query) {
      title.textContent = this.t(
        'menu.search_no_results_title',
        'Keine passenden Ergebnisse gefunden',
      );
    } else {
      title.textContent = this.t(
        'menu.search_empty_title',
        'Website-Suche starten',
      );
    }
    wrap.appendChild(title);

    const description = document.createElement('p');
    description.className = 'menu-search__empty-text';
    description.textContent = this.t(
      'menu.search_empty_text',
      'Probiere Startseite, About, Blog oder Projekte.',
    );
    wrap.appendChild(description);

    const suggestionsWrap = document.createElement('div');
    suggestionsWrap.className = 'menu-search__empty-suggestions';

    this.getFallbackSuggestions().forEach((suggestion) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'menu-search__empty-suggestion';
      btn.setAttribute('data-search-suggestion-url', suggestion.url);
      btn.textContent = suggestion.title;
      suggestionsWrap.appendChild(btn);
    });

    wrap.appendChild(suggestionsWrap);
    return wrap;
  }

  renderSearchState(options = {}) {
    if (!this.results) return;

    const {
      hidden = false,
      loading = false,
      message = '',
      items = [],
      aiChatMessage = '',
      query = '',
    } = options;

    const results = this.results;
    results.innerHTML = '';
    results.setAttribute('aria-busy', String(Boolean(loading)));

    if (hidden) {
      results.classList.remove('active');
      this.setSearchPopupExpanded(false);
      return;
    }

    results.classList.add('active');
    this.setSearchPopupExpanded(true);

    // Loading skeleton
    if (loading) {
      const skeleton = document.createElement('div');
      skeleton.className = 'menu-search__skeleton';
      for (let i = 0; i < 3; i++) {
        const row = document.createElement('div');
        row.className = 'menu-search__skeleton-row';
        row.innerHTML =
          '<div class="skeleton-title"></div><div class="skeleton-desc"></div>';
        skeleton.appendChild(row);
      }
      results.appendChild(skeleton);
      return;
    }

    if (aiChatMessage) {
      const aiChat = document.createElement('div');
      aiChat.className = 'menu-search__ai-chat';

      const aiText = document.createElement('div');
      aiText.className = 'menu-search__ai-text';
      aiText.innerHTML = aiChatMessage;
      aiChat.appendChild(aiText);

      results.appendChild(aiChat);
      return;
    }

    if (message) {
      const stateEl = document.createElement('div');
      stateEl.className = 'menu-search__state';
      stateEl.textContent = message;
      results.appendChild(stateEl);

      if (items.length === 0) {
        return;
      }
    }

    if (items.length === 0) {
      if (!aiChatMessage) {
        results.appendChild(this.renderSearchEmptyState(query));
      }
      return;
    }

    const summary = document.createElement('div');
    summary.className = 'menu-search__count';

    const countText = document.createElement('span');
    countText.className = 'menu-search__count-value';
    countText.textContent = `${items.length} ${items.length === 1 ? 'Ergebnis' : 'Ergebnisse'}`;
    summary.appendChild(countText);

    const hintText = document.createElement('span');
    hintText.className = 'menu-search__count-hint';
    hintText.textContent = 'Enter oeffnen | Pfeile navigieren | Esc';
    summary.appendChild(hintText);

    results.appendChild(summary);

    const list = document.createElement('ul');
    list.className = 'menu-search__list';

    items.forEach((item, index) => {
      const li = document.createElement('li');
      li.className = 'menu-search__item';
      li.style.setProperty('--search-item-index', index);

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'menu-search__result';
      button.id = this.buildSearchOptionId(index);
      button.setAttribute('data-search-index', String(index));
      button.setAttribute('role', 'option');
      button.setAttribute(
        'aria-selected',
        String(index === this.selectedIndex),
      );

      if (index === this.selectedIndex) {
        button.classList.add('is-selected');
      }

      // Category badge
      const badge = document.createElement('span');
      badge.className = 'menu-search__badge';
      badge.textContent = this.getCategoryLabel(item.category);
      button.appendChild(badge);

      const heading = document.createElement('span');
      heading.className = 'menu-search__heading';

      const title = document.createElement('span');
      title.className = 'menu-search__title';
      title.textContent = item.title;
      heading.appendChild(title);

      const go = document.createElement('span');
      go.className = 'menu-search__go';
      go.setAttribute('aria-hidden', 'true');
      go.textContent = '›';
      heading.appendChild(go);

      button.appendChild(heading);

      const url = document.createElement('span');
      url.className = 'menu-search__url';
      url.textContent = this.formatSearchResultUrl(item.url);
      button.appendChild(url);

      // Use highlighted description if available
      if (item.highlightedDescription || item.description) {
        const desc = document.createElement('span');
        desc.className = 'menu-search__desc';
        // highlightedDescription contains <mark> tags – render as HTML
        if (
          item.highlightedDescription &&
          item.highlightedDescription.includes('<mark>')
        ) {
          desc.innerHTML = item.highlightedDescription;
        } else {
          desc.textContent = item.description;
        }
        button.appendChild(desc);
      }

      li.appendChild(button);
      list.appendChild(li);
    });

    results.appendChild(list);
  }

  updateSearchSelectionUI() {
    if (!this.results) return;

    const optionEls = this.results.querySelectorAll('[data-search-index]');
    let activeOptionId = '';

    optionEls.forEach((el) => {
      const index = Number(el.getAttribute('data-search-index'));
      const isSelected = index === this.selectedIndex;
      el.classList.toggle('is-selected', isSelected);
      el.setAttribute('aria-selected', String(isSelected));

      if (isSelected) {
        activeOptionId = el.id || '';
        el.scrollIntoView({ block: 'nearest' });
      }
    });

    if (this.input) {
      if (activeOptionId) {
        this.input.setAttribute('aria-activedescendant', activeOptionId);
      } else {
        this.input.removeAttribute('aria-activedescendant');
      }
    }
  }

  moveSearchSelection(direction) {
    const max = this.items.length;
    if (max === 0) return;

    if (this.selectedIndex < 0) {
      this.selectedIndex = 0;
    } else {
      this.selectedIndex = (this.selectedIndex + direction + max) % max;
    }

    this.updateSearchSelectionUI();
  }

  activateSelectedSearchResult() {
    if (this.items.length === 0) return;

    const index = this.selectedIndex >= 0 ? this.selectedIndex : 0;

    this.navigateToSearchResult(index);
  }

  navigateToSearchResult(index) {
    const item = this.items[index];
    if (!item?.url) return;

    this.closeSearchModeSilently();
    window.location.href = item.url;
  }

  // ── Clear button visibility ──
  updateClearButtonVisibility(query) {
    if (!this.clearBtn) return;
    this.clearBtn.classList.toggle('visible', Boolean(query && query.trim()));
  }

  // ── Recent searches (localStorage) ──
  loadRecentSearches() {
    try {
      const raw = localStorage.getItem('search_recent');
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.slice(0, 5) : [];
    } catch {
      return [];
    }
  }

  saveRecentSearch(query) {
    if (!query || query.length < 2) return;
    const q = query.trim().toLowerCase();
    this.recentSearches = [
      q,
      ...this.recentSearches.filter((r) => r !== q),
    ].slice(0, 5);
    try {
      localStorage.setItem(
        'search_recent',
        JSON.stringify(this.recentSearches),
      );
    } catch {
      /* quota exceeded – ignore */
    }
  }

  renderRecentSearches() {
    if (!this.results) return;
    const results = this.results;
    results.innerHTML = '';
    results.classList.add('active');
    this.setSearchPopupExpanded(true);

    const header = document.createElement('div');
    header.className = 'menu-search__recent-header';
    header.textContent = this.t('menu.search_recent', 'Letzte Suchen');
    results.appendChild(header);

    const list = document.createElement('ul');
    list.className = 'menu-search__list';

    this.recentSearches.forEach((q) => {
      const li = document.createElement('li');
      li.className = 'menu-search__item';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'menu-search__recent-item';
      btn.setAttribute('data-recent-query', q);
      btn.textContent = q;
      li.appendChild(btn);
      list.appendChild(li);
    });

    results.appendChild(list);
  }

  setSearchPopupExpanded(isExpanded) {
    const expanded = String(Boolean(isExpanded));

    if (this.bar) {
      this.bar.setAttribute('aria-expanded', expanded);
    }

    if (this.input) {
      this.input.setAttribute('aria-expanded', expanded);
      if (!isExpanded) {
        this.input.removeAttribute('aria-activedescendant');
      }
    }
  }

  buildSearchCacheKey(query, topK) {
    return `${topK}:${String(query || '')
      .trim()
      .toLowerCase()}`;
  }

  buildSearchOptionId(index) {
    const resultsId = this.results?.id || 'menu-search-results';
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

    return {
      items: Array.isArray(entry.items)
        ? entry.items.map((item) => ({ ...item }))
        : [],
      aiChatMessage: this.normalizeSearchChatMessage(entry.aiChatMessage),
    };
  }

  setCachedSearchResults(cacheKey, items, aiChatMessage = '') {
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
      aiChatMessage: this.normalizeSearchChatMessage(aiChatMessage),
    });
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
    uiStore.setState({ searchOpen: false });

    if (this.timers) {
      this.timers.clearAll();
    }
    this.cleanupFns.forEach((fn) => fn());
    this.cleanupFns = [];
  }
}
