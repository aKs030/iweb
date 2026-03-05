/**
 * Menu Search Module
 * Handles menu search interaction and rendering.
 */
import { i18n } from '../../../core/i18n.js';
import { SEARCH_PRELOAD_URLS } from '../../../config/import-map.generated.js';
import { TimerManager } from '../../../core/utils.js';
import { resourceHints } from '../../../core/resource-hints.js';
import { searchOpen, uiStore } from '../../../core/ui-store.js';
import { formatCompactUrlPath } from '../../../core/url-utils.js';
import { withViewTransition } from '../../../core/view-transitions.js';
import {
  VIEW_TRANSITION_ROOT_CLASSES,
  VIEW_TRANSITION_TYPES,
} from '../../../core/view-transition-types.js';
import { VIEW_TRANSITION_TIMINGS_MS } from '../../../core/view-transition-timings.js';
import { setMenuOverlayState } from './MenuOverlayState.js';
import { MenuSearchKeyboardController } from './search-keyboard-controller.js';
import { MenuSearchRenderer } from './search-renderer.js';
import { MenuSearchStore } from './MenuSearchStore.js';

const SEARCH_VIEW_TRANSITION_OPTIONS = Object.freeze({
  rootClasses: [VIEW_TRANSITION_ROOT_CLASSES.MENU],
  timeoutMs: VIEW_TRANSITION_TIMINGS_MS.SEARCH_TIMEOUT,
  preserveLiveBackdropOnMobile: true,
});

export class MenuSearch {
  /**
   * @param {HTMLElement|ShadowRoot} container
   * @param {import('./MenuState.js').MenuState} state
   * @param {Object} config
   * @param {HTMLElement|null} [host]
   */
  constructor(container, state, config = {}, host = null) {
    this.container = container;
    this.host =
      host || (container instanceof ShadowRoot ? container.host : container);
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
    this.debounceTimer = null;
    this.searchDepsPreloaded = false;
    this.searchDepsIntentTimer = null;
    this._pendingCloseOptions = { restoreFocus: false };
    this.keyboardController = new MenuSearchKeyboardController();
    this.searchStore = new MenuSearchStore(config);
    this.renderer = new MenuSearchRenderer({
      translate: (key, fallback) => i18n.tOrFallback(key, fallback),
      getCategoryLabel: (category) => this.getCategoryLabel(category),
      formatSearchResultUrl: (rawUrl) => formatCompactUrlPath(rawUrl),
      getFallbackSuggestions: () => this.searchStore.getFallbackSuggestions(),
      hasMarkedHighlight: (value) => this.searchStore.hasMarkedHighlight(value),
      setPopupExpanded: (isExpanded) => this.setSearchPopupExpanded(isExpanded),
    });
  }

  init() {
    this.setupSearch();
    this.setupI18nSync();
    this.setupSearchStateSync();
    this.setupSearchStoreSync();
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

    const handleSearchKeydown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        this.closeSearchMode();
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (this.keyboardController.moveSelection(1)) {
          this.updateSearchSelectionUI();
        }
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (this.keyboardController.moveSelection(-1)) {
          this.updateSearchSelectionUI();
        }
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        this.activateSelectedSearchResult();
      }
    };

    const handleResultsClick = (e) => {
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
      if (!this.keyboardController.setSelectedIndex(index)) return;
      this.updateSearchSelectionUI();
    };

    const handleClearClick = () => {
      if (this.input) {
        this.input.value = '';
        this.keyboardController.clear();
        this.searchStore.clear({ query: '' });
        this.input.focus();
      }
    };

    this.cleanupFns.push(
      this.addListener(searchTrigger, 'click', handleSearchTrigger),
      this.addListener(searchInput, 'input', handleSearchInput),
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

  setupSearchStateSync() {
    this.cleanupFns.push(
      searchOpen.subscribe((isOpen) => {
        this.syncSearchModeState(isOpen);
      }),
    );
  }

  setupSearchStoreSync() {
    this.cleanupFns.push(
      this.searchStore.subscribe((state) => {
        this.items = [...state.items];
        this.keyboardController.setItems(this.items);
        this.updateClearButtonVisibility(state.query);
        this.renderer.renderState(this.results, {
          hidden:
            !state.loading &&
            !state.message &&
            !state.aiChatMessage &&
            state.items.length === 0 &&
            !state.query,
          loading: state.loading,
          message: state.message,
          items: state.items,
          aiChatMessage: state.aiChatMessage,
          query: state.query,
          selectedIndex: this.keyboardController.getSelectedIndex(),
          optionIdBuilder: (index) => this.buildSearchOptionId(index),
        });
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
    return this.host?.closest?.('.site-header') || null;
  }

  getToggleElement() {
    return this.container.querySelector('.site-menu__toggle');
  }

  isSearchOpen() {
    return Boolean(searchOpen.value);
  }

  closeSearchModeSilently() {
    this.closeSearchMode({ restoreFocus: false });
  }

  syncSearchModeState(isOpen) {
    if (isOpen) {
      this.applySearchOpenState();
      return;
    }

    const options = this._pendingCloseOptions || { restoreFocus: false };
    this._pendingCloseOptions = { restoreFocus: false };
    this.applySearchClosedState(options);
  }

  syncSearchTriggerState(isOpen) {
    const trigger = this.trigger;
    if (!trigger) return;

    if (isOpen) {
      const closeLabel = i18n.tOrFallback(
        'menu.search_close',
        'Suche schließen',
      );
      trigger.setAttribute('aria-label', closeLabel);
      trigger.setAttribute('title', closeLabel);
      trigger.setAttribute('aria-expanded', 'true');
      return;
    }

    trigger.setAttribute(
      'aria-label',
      i18n.tOrFallback('menu.search_label', 'Suche'),
    );
    trigger.setAttribute(
      'title',
      i18n.tOrFallback('menu.search_tooltip', 'Website durchsuchen'),
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
        i18n.tOrFallback('menu.search_close', 'Suche schließen'),
      );
      return;
    }

    toggle.setAttribute('aria-label', i18n.tOrFallback('menu.toggle', 'Menü'));
  }

  openSearchMode() {
    if (this.isSearchOpen()) return;

    this.state.setOpen(false);
    uiStore.setState({ searchOpen: true });
  }

  applySearchOpenState() {
    const header = this.getHeaderElement();
    const panel = this.panel;
    const input = this.input;

    if (!header || !panel || !input) return;
    if (this.isOpen) return;

    this.isOpen = true;
    void withViewTransition(
      () => {
        setMenuOverlayState('search');

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
      },
      {
        ...SEARCH_VIEW_TRANSITION_OPTIONS,
        types: [VIEW_TRANSITION_TYPES.SEARCH_OPEN],
      },
    );
  }

  closeSearchMode(options = {}) {
    const { restoreFocus = true } = options;
    if (!this.isSearchOpen()) return;
    this._pendingCloseOptions = { restoreFocus };
    uiStore.setState({ searchOpen: false });
  }

  applySearchClosedState(options = {}) {
    const { restoreFocus = false } = options;
    const wasOpen = this.isOpen;
    const header = this.getHeaderElement();
    this.isOpen = false;
    this.keyboardController.clear();

    const applyClosedState = () => {
      setMenuOverlayState(null);

      if (header) {
        header.classList.remove('search-mode');
      }

      if (this.panel) {
        this.panel.setAttribute('aria-hidden', 'true');
      }

      this.syncSearchTriggerState(false);
      this.syncToggleSearchState(false);

      if (this.input) {
        this.input.value = '';
      }

      this.searchStore.clear({ query: '' });
      this.renderer.renderState(this.results, { hidden: true });

      if (restoreFocus) {
        this.trigger?.focus();
      }
    };

    if (!wasOpen) {
      applyClosedState();
      return;
    }

    void withViewTransition(applyClosedState, {
      ...SEARCH_VIEW_TRANSITION_OPTIONS,
      types: [VIEW_TRANSITION_TYPES.SEARCH_CLOSE],
    });
  }

  clearSearchDebounce() {
    if (!this.debounceTimer) return;
    this.timers.clearTimeout(this.debounceTimer);
    this.debounceTimer = null;
  }

  abortSearchRequest() {
    this.searchStore.abortSearchRequest();
  }

  scheduleSearch(rawQuery) {
    const query = String(rawQuery || '').trim();
    const minQueryLength = this.config.SEARCH_MIN_QUERY_LENGTH ?? 2;

    this.clearSearchDebounce();

    if (!query || query.length < minQueryLength) {
      this.keyboardController.clear();
      this.searchStore.clear({ query });
      return;
    }

    const debounceDelay = this.config.SEARCH_DEBOUNCE ?? 220;
    this.debounceTimer = this.timers.setTimeout(() => {
      void this.searchStore.search(query);
    }, debounceDelay);
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
    return [...SEARCH_PRELOAD_URLS];
  }

  updateSearchSelectionUI() {
    this.renderer.updateSelectionUI(
      this.results,
      this.input,
      this.keyboardController.getSelectedIndex(),
    );
  }

  activateSelectedSearchResult() {
    const index = this.keyboardController.getActivationIndex();
    if (index < 0) return;

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

  buildSearchOptionId(index) {
    const resultsId = this.results?.id || 'menu-search-results';
    return `${resultsId}-option-${index}`;
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
    this._pendingCloseOptions = { restoreFocus: false };
    uiStore.setState({ searchOpen: false });
    setMenuOverlayState(null);
    this.clearSearchDebounce();
    this.abortSearchRequest();
    this.searchStore.destroy();

    this.timers.clearAll();
    this.cleanupFns.forEach((fn) => fn());
    this.cleanupFns = [];
  }
}
