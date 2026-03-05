import { i18n } from '../../../core/i18n.js';
import { createLogger } from '../../../core/logger.js';
import {
  batch,
  signal,
  subscribe as signalSubscribe,
} from '../../../core/signals.js';
import { MenuSearchApi } from './search-api.js';

const log = createLogger('MenuSearchStore');

export class MenuSearchStore {
  constructor(config = {}, searchApi = new MenuSearchApi(config)) {
    this.config = config;
    this.searchApi = searchApi;

    this.querySignal = signal('');
    this.loadingSignal = signal(false);
    this.messageSignal = signal('');
    this.itemsSignal = signal(Object.freeze([]));
    this.aiChatMessageSignal = signal('');

    this.signals = Object.freeze({
      query: this.querySignal,
      loading: this.loadingSignal,
      message: this.messageSignal,
      items: this.itemsSignal,
      aiChatMessage: this.aiChatMessageSignal,
    });

    this.abortController = null;
    this.searchCache = new Map();
    this.searchCacheTtlMs = this.config.SEARCH_CACHE_TTL_MS ?? 120000;
    this.searchCacheMaxEntries = this.config.SEARCH_CACHE_MAX_ENTRIES ?? 40;
  }

  getState() {
    return Object.freeze({
      query: this.querySignal.value,
      loading: this.loadingSignal.value,
      message: this.messageSignal.value,
      items: this.itemsSignal.value,
      aiChatMessage: this.aiChatMessageSignal.value,
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
      this.aiChatMessageSignal.value = '';
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

  async executeSearch(query) {
    this.abortSearchRequest();

    const topK = this.config.SEARCH_TOP_K ?? 12;
    const requestTimeoutMs = this.config.SEARCH_REQUEST_TIMEOUT ?? 6000;
    const cacheKey = this.buildSearchCacheKey(query, topK);
    const cachedPayload = this.getCachedSearchResults(cacheKey);

    if (cachedPayload) {
      this.applySearchPayload(query, {
        items: cachedPayload.items,
        aiChatMessage: cachedPayload.aiChatMessage,
      });
      return;
    }

    if (navigator.onLine === false) {
      const offlineItems = this.searchApi.buildOfflineSearchResults(query);
      this.applySearchPayload(query, {
        items: offlineItems,
        aiChatMessage: '',
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
    });

    try {
      const { items, aiChatMessage } = await this.searchApi.fetchSearchResults(
        query,
        {
          topK,
          signal: signalRef,
        },
      );
      const aiAgentMessage = await this.searchApi.fetchSearchAiAgentMessage(
        query,
        items,
        {
          timeoutMs: Math.min(
            Number(this.config.SEARCH_AI_REQUEST_TIMEOUT ?? 4500),
            requestTimeoutMs,
          ),
        },
      );
      this.applySearchPayload(query, {
        items,
        aiChatMessage: aiAgentMessage || aiChatMessage,
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
        this.aiChatMessageSignal.value = '';
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
    const aiChatMessage = String(payload.aiChatMessage || '');
    let statusMessage = String(payload.statusMessage || '');
    const cacheKey = String(payload.cacheKey || '').trim();
    const visibleItems = this.searchApi.filterHighlightedResults(items);

    if (!statusMessage && items.length > 0 && visibleItems.length === 0) {
      statusMessage = i18n.tOrFallback(
        'menu.search_no_highlight_matches',
        'Keine markierten Texttreffer gefunden',
      );
    }

    if (cacheKey) {
      this.setCachedSearchResults(cacheKey, visibleItems, aiChatMessage);
    }

    batch(() => {
      this.loadingSignal.value = false;
      this.messageSignal.value = statusMessage;
      this.itemsSignal.value = Object.freeze(
        visibleItems.map((item) => ({ ...item })),
      );
      this.aiChatMessageSignal.value = aiChatMessage;
    });
  }

  hasMarkedHighlight(value) {
    return this.searchApi.hasMarkedHighlight(value);
  }

  getFallbackSuggestions() {
    return this.searchApi.getFallbackSuggestions();
  }

  buildSearchCacheKey(query, topK) {
    return `${topK}:${String(query || '')
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
      aiChatMessage: String(entry.aiChatMessage || ''),
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
      aiChatMessage: String(aiChatMessage || ''),
    });
  }

  destroy() {
    this.abortSearchRequest();
    this.searchCache.clear();
    this.clear();
  }
}
