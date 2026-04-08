/**
 * Menu Search Module
 * Orchestrates search state, keyboard interaction, and navigation.
 */
import { i18n } from '#core/i18n.js';
import { TimerManager } from '#core/timer-manager.js';
import {
  prepareOverlayFocusChange,
  OVERLAY_MODES,
} from '#core/overlay-manager.js';
import {
  activeOverlay,
  clearActiveOverlayMode,
  setActiveOverlayMode,
} from '#core/ui-store.js';
import { formatCompactUrlPath } from '#core/url-utils.js';
import { MenuSearchKeyboardController } from './search-keyboard-controller.js';
import { MenuSearchRenderer } from './search-renderer.js';
import { MenuSearchStore } from './MenuSearchStore.js';
import { MenuSearchViewController } from './search-view-controller.js';
import { MenuSearchPreloadController } from './search-preload-controller.js';
import { resolveMenuHost } from './menu-dom-helpers.js';

/**
 * @typedef {typeof import('./MenuConfig.js').MenuConfig} MenuComponentConfig
 */
/**
 * @typedef {Partial<MenuComponentConfig>} MenuComponentConfigInput
 */

export class MenuSearch {
  /**
   * @param {HTMLElement|ShadowRoot} container
   * @param {import('./MenuState.js').MenuState} state
   * @param {MenuComponentConfigInput} [config]
   * @param {HTMLElement|null} [host]
   */
  constructor(container, state, config = {}, host = null) {
    this.container = container;
    this.host = resolveMenuHost(container, host);
    this.state = state;
    this.config = config;
    this.cleanupFns = [];
    this.timers = new TimerManager('MenuSearch');
    this.view = new MenuSearchViewController(this.container, this.host);
    this.preloadController = new MenuSearchPreloadController({
      container: this.container,
      timers: this.timers,
      addListener: (...args) => this.addListener(...args),
    });

    this.items = [];
    this.debounceTimer = null;
    this.keyboardController = new MenuSearchKeyboardController();
    this.searchStore = new MenuSearchStore(config);
    this.renderer = new MenuSearchRenderer({
      translate: (key, fallback) => i18n.tOrFallback(key, fallback),
      getCategoryLabel: (category) => this.getCategoryLabel(category),
      getFacetLabel: (facet) => this.getFacetLabel(facet),
      formatSearchResultUrl: (rawUrl) => formatCompactUrlPath(rawUrl),
      getFallbackSuggestions: () => this.searchStore.getFallbackSuggestions(),
      hasMarkedHighlight: (value) => this.searchStore.hasMarkedHighlight(value),
      setPopupExpanded: (isExpanded) =>
        this.view.setSearchPopupExpanded(isExpanded),
    });
  }

  init() {
    this.setupSearch();
    this.setupI18nSync();
    this.setupSearchStateSync();
    this.setupSearchStoreSync();
  }

  setupSearch() {
    if (!this.view.bindElementsFromContainer()) {
      return;
    }

    const handleSearchTrigger = (e) => {
      e.preventDefault();
      if (this.isSearchOpen()) {
        this.closeSearchModeSilently();
        return;
      }
      this.openSearchMode();
    };

    const handleSearchInput = () => {
      const query = this.view.input ? this.view.input.value : '';
      this.view.updateClearButtonVisibility(query);
      this.scheduleSearch(query);
    };

    const handleSearchKeydown = (e) => {
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
      const facetBtn = e.target?.closest?.('[data-search-facet]');
      if (facetBtn instanceof HTMLButtonElement) {
        void this.searchStore.setFacet(facetBtn.dataset.searchFacet);
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
      if (!this.keyboardController.setSelectedIndex(index)) return;
      this.updateSearchSelectionUI();
    };

    const handleClearClick = () => {
      if (this.view.input) {
        this.view.input.value = '';
        this.keyboardController.clear();
        this.searchStore.clear({ query: '' });
        this.view.input.focus();
      }
    };

    this.cleanupFns.push(
      this.addListener(this.view.trigger, 'click', handleSearchTrigger),
      this.addListener(this.view.input, 'input', handleSearchInput),
      this.addListener(this.view.input, 'keydown', handleSearchKeydown),
      this.addListener(this.view.results, 'click', handleResultsClick),
      this.addListener(
        this.view.results,
        'pointerover',
        handleResultsPointerOver,
      ),
      ...this.preloadController.setupIntent({
        trigger: this.view.trigger,
        bar: this.view.bar,
      }),
    );

    if (this.view.clearBtn) {
      this.cleanupFns.push(
        this.addListener(this.view.clearBtn, 'click', handleClearClick),
      );
    }
  }

  setupI18nSync() {
    this.cleanupFns.push(
      i18n.subscribe(() => {
        const isSearchOpen = this.isSearchOpen();
        this.view.syncSearchTriggerState(isSearchOpen);
        this.view.syncToggleSearchState(isSearchOpen);
      }),
    );
  }

  setupSearchStateSync() {
    this.cleanupFns.push(
      activeOverlay.subscribe((mode) => {
        this.syncSearchModeState(mode === OVERLAY_MODES.SEARCH);
      }),
    );
  }

  setupSearchStoreSync() {
    this.cleanupFns.push(
      this.searchStore.subscribe((state) => {
        this.items = [...state.items];
        this.keyboardController.setItems(this.items);
        this.view.updateClearButtonVisibility(state.query);
        this.renderer.renderState(this.view.results, {
          hidden:
            !state.loading &&
            !state.message &&
            !state.aiChatMessage &&
            state.aiChatSuggestions.length === 0 &&
            state.items.length === 0 &&
            !state.query,
          loading: state.loading,
          message: state.message,
          items: state.items,
          facet: state.facet,
          facets: state.facets,
          aiChatMessage: state.aiChatMessage,
          aiChatSuggestions: state.aiChatSuggestions,
          query: state.query,
          selectedIndex: this.keyboardController.getSelectedIndex(),
          optionIdBuilder: (index) => this.view.buildSearchOptionId(index),
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

  getPrimaryFocusTarget() {
    return this.view.getPrimaryFocusTarget();
  }

  getRestoreFocusTarget() {
    return this.view.getRestoreFocusTarget();
  }

  getFocusTrapRoots() {
    return this.view.getFocusTrapRoots();
  }

  isSearchOpen() {
    return activeOverlay.value === OVERLAY_MODES.SEARCH;
  }

  closeSearchModeSilently() {
    this.closeSearchMode({ restoreFocus: false });
  }

  syncSearchModeState(isOpen) {
    if (isOpen) {
      this.view.applySearchOpenState();
      return;
    }

    this.view.applySearchClosedState({
      keyboardController: this.keyboardController,
      searchStore: this.searchStore,
      renderer: this.renderer,
    });
  }

  openSearchMode() {
    if (this.isSearchOpen()) return;

    if (this.state.isOpen) {
      prepareOverlayFocusChange(OVERLAY_MODES.MENU, { restoreFocus: false });
    }
    this.state.setOpen(false);
    setActiveOverlayMode(OVERLAY_MODES.SEARCH);
  }

  closeSearchMode(options = {}) {
    const { restoreFocus = true } = options;
    if (!this.isSearchOpen()) return;
    prepareOverlayFocusChange(OVERLAY_MODES.SEARCH, { restoreFocus });
    clearActiveOverlayMode(OVERLAY_MODES.SEARCH);
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

  getFacetLabel(facet) {
    const key = String(facet || '')
      .trim()
      .toLowerCase();

    const labels = {
      all: 'Alle',
      blog: 'Blog',
      projects: 'Projekte',
      videos: 'Videos',
      pages: 'Seiten',
    };

    return labels[key] || facet || 'Alle';
  }

  updateSearchSelectionUI() {
    this.renderer.updateSelectionUI(
      this.view.results,
      this.view.input,
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
    clearActiveOverlayMode(OVERLAY_MODES.SEARCH);
    this.clearSearchDebounce();
    this.abortSearchRequest();
    this.searchStore.destroy();

    this.timers.clearAll();
    this.cleanupFns.forEach((fn) => fn());
    this.cleanupFns = [];
  }
}
