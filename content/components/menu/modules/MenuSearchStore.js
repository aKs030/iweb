import { i18n } from '#core/i18n.js';
import { createLogger } from '#core/logger.js';
import { batch, signal, subscribe as signalSubscribe } from '#core/signals.js';
import { MenuSearchApi } from './search-api.js';

const log = createLogger('MenuSearchStore');

/**
 * @typedef {typeof import('./MenuConfig.js').MenuConfig} MenuComponentConfig
 */
/**
 * @typedef {Partial<MenuComponentConfig>} MenuComponentConfigInput
 */

export class MenuSearchStore {
  /**
   * @param {MenuComponentConfigInput} [config]
   * @param {MenuSearchApi} [searchApi]
   */
  constructor(config = {}, searchApi = new MenuSearchApi(config)) {
    this.config = config;
    this.searchApi = searchApi;

    this.querySignal = signal('');
    this.facetSignal = signal('all');
    this.facetsSignal = signal(
      Object.freeze(this.searchApi.normalizeFacetCounts([])),
    );
    this.loadingSignal = signal(false);
    this.messageSignal = signal('');
    this.itemsSignal = signal(Object.freeze([]));
    this.aiChatMessageSignal = signal('');
    this.aiChatSuggestionsSignal = signal(Object.freeze([]));

    this.signals = Object.freeze({
      query: this.querySignal,
      facet: this.facetSignal,
      facets: this.facetsSignal,
      loading: this.loadingSignal,
      message: this.messageSignal,
      items: this.itemsSignal,
      aiChatMessage: this.aiChatMessageSignal,
      aiChatSuggestions: this.aiChatSuggestionsSignal,
    });

    this.abortController = null;
    this.searchCache = new Map();
    this.searchCacheTtlMs = this.config.SEARCH_CACHE_TTL_MS ?? 120000;
    this.searchCacheMaxEntries = this.config.SEARCH_CACHE_MAX_ENTRIES ?? 40;
  }

  getState() {
    return Object.freeze({
      query: this.querySignal.value,
      facet: this.facetSignal.value,
      facets: this.facetsSignal.value,
      loading: this.loadingSignal.value,
      message: this.messageSignal.value,
      items: this.itemsSignal.value,
      aiChatMessage: this.aiChatMessageSignal.value,
      aiChatSuggestions: this.aiChatSuggestionsSignal.value,
    });
  }

  subscribe(listener, options = {}) {
    return signalSubscribe(() => this.getState(), listener, options);
  }

  clear(options = {}) {
    const { query = '' } = options;

    this.abortSearchRequest();

    batch(() => {
      this.querySignal.value = String(query || '').trim();
      this.loadingSignal.value = false;
      this.messageSignal.value = '';
      this.itemsSignal.value = Object.freeze([]);
      this.facetsSignal.value = Object.freeze(
        this.searchApi.normalizeFacetCounts([]),
      );
      this.aiChatMessageSignal.value = '';
      this.aiChatSuggestionsSignal.value = Object.freeze([]);
    });
  }

  abortSearchRequest() {
    if (!this.abortController) return;
    this.abortController.abort();
    this.abortController = null;
  }

  async search(rawQuery) {
    const query = String(rawQuery || '').trim();
    const minQueryLength = this.config.SEARCH_MIN_QUERY_LENGTH ?? 2;

    this.querySignal.value = query;

    if (!query || query.length < minQueryLength) {
      this.clear({ query });
      return;
    }

    await this.executeSearch(query);
  }

  async setFacet(rawFacet) {
    const facet = this.searchApi.normalizeSearchFacet(rawFacet);
    if (this.facetSignal.value === facet) return;

    this.facetSignal.value = facet;
    const query = String(this.querySignal.peek() || '').trim();
    const minQueryLength = this.config.SEARCH_MIN_QUERY_LENGTH ?? 2;

    if (!query || query.length < minQueryLength) {
      this.clear({ query });
      return;
    }

    await this.executeSearch(query);
  }

  async executeSearch(query) {
    this.abortSearchRequest();

    const topK = this.config.SEARCH_TOP_K ?? 12;
    const facet = this.facetSignal.peek();
    const requestTimeoutMs = this.config.SEARCH_REQUEST_TIMEOUT ?? 6000;
    const cacheKey = this.buildSearchCacheKey(query, topK, facet);
    const cachedPayload = this.getCachedSearchResults(cacheKey);

    if (cachedPayload) {
      this.applySearchPayload(query, {
        items: cachedPayload.items,
        facet,
        facets: cachedPayload.facets,
        aiChatMessage: cachedPayload.aiChatMessage,
        aiChatSuggestions: cachedPayload.aiChatSuggestions,
      });
      return;
    }

    if (navigator.onLine === false) {
      const offlineItems = this.searchApi.filterResultsByFacet(
        this.searchApi.buildOfflineSearchResults(query),
        facet,
      );
      this.applySearchPayload(query, {
        items: offlineItems,
        facet,
        facets: this.searchApi.buildOfflineFacetCounts(query),
        aiChatMessage: '',
        aiChatSuggestions: this.searchApi.pickSearchSuggestions(
          query,
          offlineItems,
        ),
        cacheKey,
        statusMessage: i18n.tOrFallback(
          'menu.search_offline',
          'Offline-Modus: lokale Treffer',
        ),
      });
      return;
    }

    const abortController = new AbortController();
    this.abortController = abortController;
    const signalRef = abortController.signal;
    let didTimeoutAbort = false;
    const timeoutId =
      requestTimeoutMs > 0
        ? setTimeout(() => {
            didTimeoutAbort = true;
            abortController.abort();
          }, requestTimeoutMs)
        : null;

    batch(() => {
      this.loadingSignal.value = true;
      this.messageSignal.value = i18n.tOrFallback(
        'menu.search_loading',
        'Suche...',
      );
      this.itemsSignal.value = Object.freeze([]);
      this.aiChatMessageSignal.value = '';
      this.aiChatSuggestionsSignal.value = Object.freeze([]);
    });

    try {
      const responsePayload = await this.searchApi.fetchSearchResults(query, {
        topK,
        facet,
        signal: signalRef,
      });
      const aiChatSuggestions = this.searchApi.pickSearchSuggestions(query, [
        ...(Array.isArray(responsePayload.aiChatSuggestions)
          ? responsePayload.aiChatSuggestions
          : []),
        ...responsePayload.items.map((item) => ({
          title: item?.title,
          url: item?.url,
        })),
      ]);
      this.applySearchPayload(query, {
        items: responsePayload.items,
        facet: responsePayload.facet,
        facets: responsePayload.facets,
        aiChatMessage: responsePayload.aiChatMessage,
        aiChatSuggestions,
        cacheKey,
      });
    } catch (error) {
      const isAbortError = this.searchApi.isAbortLikeError(error);

      if (isAbortError && !didTimeoutAbort) {
        return;
      }

      if (!isAbortError) {
        log.error('Header search failed:', error);
      }

      batch(() => {
        this.loadingSignal.value = false;
        this.itemsSignal.value = Object.freeze([]);
        this.facetsSignal.value = Object.freeze(
          this.searchApi.normalizeFacetCounts([]),
        );
        this.aiChatMessageSignal.value = '';
        this.aiChatSuggestionsSignal.value = Object.freeze([]);
        this.messageSignal.value = didTimeoutAbort
          ? i18n.tOrFallback('menu.search_timeout', 'Suche dauert zu lange')
          : i18n.tOrFallback(
              'menu.search_unavailable',
              'Suche derzeit nicht verfuegbar',
            );
      });
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (this.abortController?.signal === signalRef) {
        this.abortController = null;
      }
    }
  }

  applySearchPayload(query, payload = {}) {
    if (this.querySignal.peek() !== query) return;

    const items = Array.isArray(payload.items) ? payload.items : [];
    const facet = this.searchApi.normalizeSearchFacet(
      payload.facet || this.facetSignal.peek(),
    );
    const facets = this.searchApi.normalizeFacetCounts(payload.facets);
    const aiChatMessage = String(payload.aiChatMessage || '');
    const aiChatSuggestions = this.searchApi.pickSearchSuggestions(
      query,
      payload.aiChatSuggestions,
    );
    const statusMessage = String(payload.statusMessage || '');
    const cacheKey = String(payload.cacheKey || '').trim();

    if (cacheKey) {
      this.setCachedSearchResults(
        cacheKey,
        items,
        facets,
        aiChatMessage,
        aiChatSuggestions,
      );
    }

    batch(() => {
      this.facetSignal.value = facet;
      this.facetsSignal.value = Object.freeze(
        facets.map((entry) => ({ ...entry })),
      );
      this.loadingSignal.value = false;
      this.messageSignal.value = statusMessage;
      this.itemsSignal.value = Object.freeze(
        items.map((item) => ({ ...item })),
      );
      this.aiChatMessageSignal.value = aiChatMessage;
      this.aiChatSuggestionsSignal.value = Object.freeze(
        aiChatSuggestions.map((entry) => ({ ...entry })),
      );
    });
  }

  hasMarkedHighlight(value) {
    return this.searchApi.hasMarkedHighlight(value);
  }

  getFallbackSuggestions() {
    return this.searchApi.getFallbackSuggestions();
  }

  buildSearchCacheKey(query, topK, facet = 'all') {
    return `${topK}:${this.searchApi.normalizeSearchFacet(facet)}:${String(
      query || '',
    )
      .trim()
      .toLowerCase()}`;
  }

  getCachedSearchResults(cacheKey) {
    if (!cacheKey) return null;

    const entry = this.searchCache.get(cacheKey);
    if (!entry) return null;

    if (entry.expiresAt <= Date.now()) {
      this.searchCache.delete(cacheKey);
      return null;
    }

    this.searchCache.delete(cacheKey);
    this.searchCache.set(cacheKey, entry);

    return {
      items: Array.isArray(entry.items)
        ? entry.items.map((item) => ({ ...item }))
        : [],
      facets: Array.isArray(entry.facets)
        ? entry.facets.map((entryItem) => ({ ...entryItem }))
        : this.searchApi.normalizeFacetCounts([]),
      aiChatMessage: String(entry.aiChatMessage || ''),
      aiChatSuggestions: this.searchApi.normalizeSuggestions(
        entry.aiChatSuggestions,
      ),
    };
  }

  setCachedSearchResults(
    cacheKey,
    items,
    facets,
    aiChatMessage = '',
    aiChatSuggestions = [],
  ) {
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
      facets: Array.isArray(facets)
        ? facets.map((entry) => ({ ...entry }))
        : this.searchApi.normalizeFacetCounts([]),
      aiChatMessage: String(aiChatMessage || ''),
      aiChatSuggestions: this.searchApi.normalizeSuggestions(aiChatSuggestions),
    });
  }

  destroy() {
    this.abortSearchRequest();
    this.searchCache.clear();
    this.clear();
  }
}
