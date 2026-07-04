/**
 * Search Engine Module
 * Centralizes search API interfaces, client-side store caches, keyboard accessibilities,
 * preload controllers, DOM renderers, and search view transitions for the Site Menu Search.
 */

import { i18n } from "../../../core/i18n.js";
import { createLogger } from "../../../core/logger.js";
import { batch, signal, subscribe as signalSubscribe } from "../../../core/signals.js";
import {
  fetchJSON,
  sanitizeInternalNavigationUrl,
  TimerManager,
  addManagedEventListener,
  formatCompactUrlPath,
  setSanitizedHTML,
} from "../../../core/utils/index.js";
import {
  activeOverlay,
  clearActiveOverlayMode,
  setActiveOverlayMode,
} from "../../../core/state/ui-store.js";
import { prepareOverlayFocusChange, OVERLAY_MODES } from "../../../core/overlay-manager.js";
import { resourceHints } from "../../../core/seo/index.js";
import { withViewTransition } from "../../../core/view-transitions.js";
import {
  VIEW_TRANSITION_ROOT_CLASSES,
  VIEW_TRANSITION_TYPES,
  VIEW_TRANSITION_TIMINGS_MS,
} from "../../../core/view-transitions/index.js";
import { isConnectedHTMLElement, resolveMenuHost } from "./menu-engine.js";

const log = createLogger("SearchEngine");

const SEARCH_ENDPOINT = "/api/search";
const MARK_HIGHLIGHT_PATTERN = /<mark>[\s\S]*?<\/mark>/i;
const SEARCH_FACETS = Object.freeze(["all", "blog", "projects", "videos", "pages"]);
const SEARCH_HIGHLIGHT_TOKEN_LIMIT = 8;

const escapeSearchHighlightPattern = value =>
  String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const tokenizeSearchHighlightQuery = query =>
  String(query || "")
    .split(/[^0-9A-Za-zÀ-ÖØ-öø-ÿ]+/g)
    .map(token => token.trim())
    .filter(token => token.length >= 2)
    .sort((a, b) => b.length - a.length)
    .slice(0, SEARCH_HIGHLIGHT_TOKEN_LIMIT);

// ============================================================================
// 1. SEARCH API INTERFACE (formerly search-api.js)
// ============================================================================

export class MenuSearchApi {
  constructor(config = {}) {
    this.config = config;
  }

  normalizeSearchResult(item) {
    if (!item || typeof item !== "object") return null;

    const title = String(item.title || "").trim();
    const url = String(item.url || "").trim();

    if (!title || !url) return null;

    return {
      title,
      url,
      description: String(item.description || "").trim(),
      highlightedDescription: String(item.highlightedDescription || "").trim(),
      category: String(item.category || "").trim(),
    };
  }

  hasMarkedHighlight(value) {
    return MARK_HIGHLIGHT_PATTERN.test(String(value || "").trim());
  }

  normalizeSearchFacet(rawFacet) {
    const value = String(rawFacet || "")
      .trim()
      .toLowerCase();
    if (value === "project" || value === "projekte") return "projects";
    if (value === "video") return "videos";
    if (value === "page" || value === "seiten") return "pages";
    return SEARCH_FACETS.includes(value) ? value : "all";
  }

  normalizeFacetCounts(facets) {
    const countsByKey = new Map(
      (Array.isArray(facets) ? facets : []).map(entry => [
        this.normalizeSearchFacet(entry?.key),
        Math.max(0, Number.parseInt(String(entry?.count || 0), 10) || 0),
      ])
    );

    return SEARCH_FACETS.map(key => ({
      key,
      count: countsByKey.get(key) || 0,
    }));
  }

  filterResultsByFacet(items, rawFacet) {
    const facet = this.normalizeSearchFacet(rawFacet);
    const list = Array.isArray(items) ? items : [];

    if (facet === "all") return list;

    return list.filter(item => {
      const category = String(item?.category || "")
        .trim()
        .toLowerCase();
      const url = String(item?.url || "")
        .trim()
        .toLowerCase();

      if (facet === "blog") return category === "blog" || url.startsWith("/blog/");
      if (facet === "projects") {
        return category === "projekte" || url === "/projekte/" || url.startsWith("/projekte/");
      }
      if (facet === "videos") {
        return category === "videos" || url === "/videos/" || url.startsWith("/videos/");
      }

      return !["blog", "projekte", "videos"].includes(category);
    });
  }

  normalizeSearchChatMessage(value) {
    let text = String(value || "").trim();
    if (!text) return "";

    text = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, rawUrl) => {
      const safeUrl = sanitizeInternalNavigationUrl(rawUrl);
      if (!safeUrl) return label;
      return `<a href="${safeUrl}" class="menu-search__ai-link">${label}</a>`;
    });
    text = text.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/gi, (_match, prefix, rawUrl) => {
      const safeUrl = sanitizeInternalNavigationUrl(rawUrl);
      if (!safeUrl) return `${prefix}${rawUrl}`;
      return `${prefix}<a href="${safeUrl}" class="menu-search__ai-link">${safeUrl}</a>`;
    });
    text = text.replace(/`([^`]+)`/g, "<code>$1</code>");
    text = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    text = text.replace(/\*(.*?)\*/g, "<em>$1</em>");
    text = text.replace(/\n\n+/g, "</p><p>");
    text = text.replace(/\n/g, "<br>");
    return `<p>${text}</p>`;
  }

  normalizeSearchChatPayload(aiChat, fallbackSummary = "") {
    const payload = aiChat && typeof aiChat === "object" ? aiChat : {};
    const message = this.normalizeSearchChatMessage(payload.message || fallbackSummary || "");
    const suggestions = Array.isArray(payload.suggestions)
      ? payload.suggestions
          .map(suggestion => {
            const title = String(suggestion?.title || suggestion?.label || "").trim();
            const safeUrl = sanitizeInternalNavigationUrl(suggestion?.url || "");
            if (!title || !safeUrl) return null;
            return { title, url: safeUrl };
          })
          .filter(Boolean)
          .slice(0, 6)
      : [];
    return { message, suggestions };
  }

  async fetchSearchResults(query, options = {}) {
    const { topK = 12, facet = "all", signal = null } = options;
    const data = await fetchJSON(SEARCH_ENDPOINT, {
      fetchOptions: {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query,
          topK,
          facet: this.normalizeSearchFacet(facet),
        }),
        signal,
      },
      retries: 1,
    });
    const items = Array.isArray(data?.results)
      ? data.results.map(item => this.normalizeSearchResult(item)).filter(Boolean)
      : [];
    const fallbackAiChat = this.normalizeSearchChatPayload(data?.aiChat, data?.summary);

    return {
      items,
      facet: this.normalizeSearchFacet(data?.facet),
      facets: this.normalizeFacetCounts(data?.facets),
      aiChatMessage: fallbackAiChat.message,
      aiChatSuggestions: fallbackAiChat.suggestions || [],
    };
  }

  normalizeSuggestions(suggestions) {
    const seen = new Set();
    return (Array.isArray(suggestions) ? suggestions : [])
      .map(entry => {
        const title = String(entry?.title || "").trim();
        const safeUrl = sanitizeInternalNavigationUrl(entry?.url || "");
        if (!title || !safeUrl) return null;
        const key = `${title}|${safeUrl}`.toLowerCase();
        if (seen.has(key)) return null;
        seen.add(key);
        return { title, url: safeUrl };
      })
      .filter(Boolean);
  }

  pickSearchSuggestions(query, suggestions = [], maxCount = 6) {
    const normalizedQuery = String(query || "")
      .trim()
      .toLowerCase();
    const unique = this.normalizeSuggestions(suggestions);
    if (!normalizedQuery) {
      return unique.slice(0, maxCount);
    }
    const ranked = unique.sort((a, b) => {
      const aTitle = a.title.toLowerCase();
      const bTitle = b.title.toLowerCase();
      const aUrl = a.url.toLowerCase();
      const bUrl = b.url.toLowerCase();
      const aScore =
        (aTitle.includes(normalizedQuery) ? 2 : 0) + (aUrl.includes(normalizedQuery) ? 1 : 0);
      const bScore =
        (bTitle.includes(normalizedQuery) ? 2 : 0) + (bUrl.includes(normalizedQuery) ? 1 : 0);
      if (bScore !== aScore) return bScore - aScore;
      return aTitle.localeCompare(bTitle, "de");
    });
    return ranked.slice(0, maxCount);
  }

  getFallbackSuggestions() {
    return [
      {
        title: i18n.tOrFallback("menu.nav_home", "Startseite"),
        url: "/",
      },
      {
        title: i18n.tOrFallback("menu.nav_about", "About"),
        url: "/about/",
      },
      {
        title: i18n.tOrFallback("menu.nav_blog", "Blog"),
        url: "/blog/",
      },
      {
        title: i18n.tOrFallback("menu.nav_projects", "Projekte"),
        url: "/projekte/",
      },
    ];
  }

  buildLocalSearchResults(query) {
    const normalizedQuery = String(query || "")
      .trim()
      .toLowerCase();
    if (!normalizedQuery) return [];

    const fallbackSources = [
      ...this.getFallbackSuggestions(),
      {
        title: i18n.tOrFallback("menu.nav_gallery", "Galerie"),
        url: "/gallery/",
      },
      { title: i18n.tOrFallback("menu.nav_videos", "Videos"), url: "/videos/" },
      { title: i18n.tOrFallback("menu.contact", "Kontakt"), url: "#footer" },
    ];

    return fallbackSources
      .filter(item => {
        const title = String(item.title || "").toLowerCase();
        const url = String(item.url || "").toLowerCase();
        return title.includes(normalizedQuery) || url.includes(normalizedQuery);
      })
      .slice(0, 6)
      .map(item => ({
        title: String(item.title || ""),
        url: String(item.url || "/"),
        description: i18n.tOrFallback(
          "menu.search_local_desc",
          "Aus lokal verfuegbaren Navigationseintraegen"
        ),
        highlightedDescription: `<mark>${i18n.tOrFallback("menu.search_local_match", "Lokaler Treffer")}</mark>`,
        category: i18n.tOrFallback("menu.search_local_category", "Lokal"),
      }));
  }

  buildLocalFacetCounts(query) {
    const items = this.buildLocalSearchResults(query);
    return this.normalizeFacetCounts(
      SEARCH_FACETS.map(key => ({
        key,
        count: this.filterResultsByFacet(items, key).length,
      }))
    );
  }

  isAbortLikeError(error) {
    if (!error || typeof error !== "object") return false;

    if (error.name === "AbortError" || error.code === 20) {
      return true;
    }

    const message = String(error.message || "").toLowerCase();
    return message.includes("abort");
  }
}

// ============================================================================
// 2. CLIENT-SIDE SEARCH STORE (formerly MenuSearchStore.js)
// ============================================================================

export class MenuSearchStore {
  constructor(config = {}, searchApi = new MenuSearchApi(config)) {
    this.config = config;
    this.searchApi = searchApi;

    this.querySignal = signal("");
    this.facetSignal = signal("all");
    this.facetsSignal = signal(Object.freeze(this.searchApi.normalizeFacetCounts([])));
    this.loadingSignal = signal(false);
    this.messageSignal = signal("");
    this.itemsSignal = signal(Object.freeze([]));
    this.aiChatMessageSignal = signal("");
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
    const { query = "" } = options;

    this.abortSearchRequest();

    batch(() => {
      this.querySignal.value = String(query || "").trim();
      this.loadingSignal.value = false;
      this.messageSignal.value = "";
      this.itemsSignal.value = Object.freeze([]);
      this.facetsSignal.value = Object.freeze(this.searchApi.normalizeFacetCounts([]));
      this.aiChatMessageSignal.value = "";
      this.aiChatSuggestionsSignal.value = Object.freeze([]);
    });
  }

  abortSearchRequest() {
    if (!this.abortController) return;
    this.abortController.abort();
    this.abortController = null;
  }

  async search(rawQuery) {
    const query = String(rawQuery || "").trim();
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
    const query = String(this.querySignal.peek() || "").trim();
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
      const localItems = this.searchApi.filterResultsByFacet(
        this.searchApi.buildLocalSearchResults(query),
        facet
      );
      this.applySearchPayload(query, {
        items: localItems,
        facet,
        facets: this.searchApi.buildLocalFacetCounts(query),
        aiChatMessage: "",
        aiChatSuggestions: this.searchApi.pickSearchSuggestions(query, localItems),
        cacheKey,
        statusMessage: i18n.tOrFallback(
          "menu.search_local_fallback",
          "Server nicht erreichbar: lokale Treffer"
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
      this.messageSignal.value = i18n.tOrFallback("menu.search_loading", "Suche...");
      this.itemsSignal.value = Object.freeze([]);
      this.aiChatMessageSignal.value = "";
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
        ...responsePayload.items.map(item => ({
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
        log.error("Header search failed:", error);
      }

      batch(() => {
        this.loadingSignal.value = false;
        this.itemsSignal.value = Object.freeze([]);
        this.facetsSignal.value = Object.freeze(this.searchApi.normalizeFacetCounts([]));
        this.aiChatMessageSignal.value = "";
        this.aiChatSuggestionsSignal.value = Object.freeze([]);
        this.messageSignal.value = didTimeoutAbort
          ? i18n.tOrFallback("menu.search_timeout", "Suche dauert zu lange")
          : i18n.tOrFallback("menu.search_unavailable", "Suche derzeit nicht verfuegbar");
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
    const facet = this.searchApi.normalizeSearchFacet(payload.facet || this.facetSignal.peek());
    const facets = this.searchApi.normalizeFacetCounts(payload.facets);
    const aiChatMessage = String(payload.aiChatMessage || "");
    const aiChatSuggestions = this.searchApi.pickSearchSuggestions(
      query,
      payload.aiChatSuggestions
    );
    const statusMessage = String(payload.statusMessage || "");
    const cacheKey = String(payload.cacheKey || "").trim();

    if (cacheKey) {
      this.setCachedSearchResults(cacheKey, items, facets, aiChatMessage, aiChatSuggestions);
    }

    batch(() => {
      this.facetSignal.value = facet;
      this.facetsSignal.value = Object.freeze(facets.map(entry => ({ ...entry })));
      this.loadingSignal.value = false;
      this.messageSignal.value = statusMessage;
      this.itemsSignal.value = Object.freeze(items.map(item => ({ ...item })));
      this.aiChatMessageSignal.value = aiChatMessage;
      this.aiChatSuggestionsSignal.value = Object.freeze(
        aiChatSuggestions.map(entry => ({ ...entry }))
      );
    });
  }

  hasMarkedHighlight(value) {
    return this.searchApi.hasMarkedHighlight(value);
  }

  getFallbackSuggestions() {
    return this.searchApi.getFallbackSuggestions();
  }

  buildSearchCacheKey(query, topK, facet = "all") {
    return `${topK}:${this.searchApi.normalizeSearchFacet(facet)}:${String(query || "")
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
      items: Array.isArray(entry.items) ? entry.items.map(item => ({ ...item })) : [],
      facets: Array.isArray(entry.facets)
        ? entry.facets.map(entryItem => ({ ...entryItem }))
        : this.searchApi.normalizeFacetCounts([]),
      aiChatMessage: String(entry.aiChatMessage || ""),
      aiChatSuggestions: this.searchApi.normalizeSuggestions(entry.aiChatSuggestions),
    };
  }

  setCachedSearchResults(cacheKey, items, facets, aiChatMessage = "", aiChatSuggestions = []) {
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
      items: items.map(item => ({ ...item })),
      facets: Array.isArray(facets)
        ? facets.map(entry => ({ ...entry }))
        : this.searchApi.normalizeFacetCounts([]),
      aiChatMessage: String(aiChatMessage || ""),
      aiChatSuggestions: this.searchApi.normalizeSuggestions(aiChatSuggestions),
    });
  }

  destroy() {
    this.abortSearchRequest();
    this.searchCache.clear();
    this.clear();
  }
}

// ============================================================================
// 3. SEARCH KEYBOARD CONTROLLER (formerly search-keyboard-controller.js)
// ============================================================================

export class MenuSearchKeyboardController {
  constructor() {
    this.items = [];
    this.selectedIndex = -1;
  }

  setItems(items) {
    this.items = Array.isArray(items) ? [...items] : [];
    this.selectedIndex = this.items.length > 0 ? 0 : -1;
    return this.selectedIndex;
  }

  clear() {
    this.items = [];
    this.selectedIndex = -1;
    return this.selectedIndex;
  }

  getSelectedIndex() {
    return this.selectedIndex;
  }

  setSelectedIndex(index) {
    const nextIndex = Number(index);
    if (!Number.isInteger(nextIndex)) return false;
    if (nextIndex < 0 || nextIndex >= this.items.length) return false;
    if (this.selectedIndex === nextIndex) return false;
    this.selectedIndex = nextIndex;
    return true;
  }

  moveSelection(direction) {
    const max = this.items.length;
    if (max === 0) return false;

    if (this.selectedIndex < 0) {
      this.selectedIndex = 0;
      return true;
    }

    this.selectedIndex = (this.selectedIndex + direction + max) % max;
    return true;
  }

  getActivationIndex() {
    if (this.items.length === 0) return -1;
    return this.selectedIndex >= 0 ? this.selectedIndex : 0;
  }
}

// ============================================================================
// 4. RESOURCE PRELOAD INTENTS (formerly search-preload-controller.js)
// ============================================================================

const SEARCH_PRELOAD_URLS = Object.freeze(["/content/components/menu/search-deps.js"]);

export class MenuSearchPreloadController {
  constructor(options = {}) {
    this.container = options.container || null;
    this.timers = options.timers || null;
    this.addListener = options.addListener || (() => () => {});
    this.searchDepsPreloaded = false;
    this.searchDepsIntentTimer = null;
  }

  setupIntent({ trigger, bar }) {
    if (!trigger || !bar) return [];

    const preload = () => this.preloadSearchDependencies();
    const scheduleIntent = () => {
      if (this.searchDepsPreloaded || this.searchDepsIntentTimer || !this.timers) {
        return;
      }

      this.searchDepsIntentTimer = this.timers.setTimeout(() => {
        this.searchDepsIntentTimer = null;
        preload();
      }, 80);
    };

    const clearIntentTimer = () => {
      if (!this.searchDepsIntentTimer || !this.timers) return;
      this.timers.clearTimeout(this.searchDepsIntentTimer);
      this.searchDepsIntentTimer = null;
    };

    const isPointerNearSearchControl = event => {
      const pointerX = Number(event?.clientX);
      const pointerY = Number(event?.clientY);
      if (!Number.isFinite(pointerX) || !Number.isFinite(pointerY)) {
        return false;
      }

      const rects = [trigger, bar]
        .map(element => element?.getBoundingClientRect?.())
        .filter(Boolean);
      if (!rects.length) return false;

      return rects.some(rect => {
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

    const handlePointerMove = event => {
      if (this.searchDepsPreloaded) return;
      if (!isPointerNearSearchControl(event)) return;
      scheduleIntent();
    };

    const cleanupFns = [];
    const canHover = window.matchMedia?.("(hover: hover)").matches;
    if (canHover) {
      cleanupFns.push(
        this.addListener(this.container, "pointermove", handlePointerMove, {
          passive: true,
        }),
        this.addListener(trigger, "pointerenter", scheduleIntent),
        this.addListener(bar, "pointerenter", scheduleIntent)
      );
    }

    cleanupFns.push(
      this.addListener(trigger, "focus", preload),
      this.addListener(bar, "focusin", preload),
      this.addListener(trigger, "click", preload),
      clearIntentTimer
    );

    return cleanupFns;
  }

  preloadSearchDependencies() {
    if (this.searchDepsPreloaded) return;
    this.searchDepsPreloaded = true;

    [...SEARCH_PRELOAD_URLS].forEach(href => resourceHints.modulePreload(href));
  }
}

// ============================================================================
// 5. SEARCH TREELISTS RENDERING (formerly search-renderer.js)
// ============================================================================

export class MenuSearchRenderer {
  constructor(options = {}) {
    this.translate = options.translate;
    this.getCategoryLabel = options.getCategoryLabel;
    this.getFacetLabel = options.getFacetLabel;
    this.formatSearchResultUrl = options.formatSearchResultUrl;
    this.getFallbackSuggestions = options.getFallbackSuggestions;
    this.hasMarkedHighlight = options.hasMarkedHighlight;
    this.setPopupExpanded = options.setPopupExpanded;
  }

  t(key, fallback = "") {
    if (typeof this.translate !== "function") {
      return fallback || key;
    }
    return this.translate(key, fallback);
  }

  renderSuggestionChips(suggestions = [], className = "menu-search__empty-suggestions") {
    const suggestionsWrap = document.createElement("div");
    suggestionsWrap.className = className;

    (Array.isArray(suggestions) ? suggestions : []).forEach(suggestion => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "menu-search__empty-suggestion";
      btn.setAttribute("data-search-suggestion-url", suggestion.url);
      btn.textContent = suggestion.title;
      suggestionsWrap.appendChild(btn);
    });

    return suggestionsWrap;
  }

  appendClientHighlightedText(target, text = "", query = "") {
    const source = String(text || "").trim();
    if (!target || !source) return false;

    const tokens = tokenizeSearchHighlightQuery(query);
    if (!tokens.length) return false;

    const regex = new RegExp(
      `(${tokens.map(token => escapeSearchHighlightPattern(token)).join("|")})`,
      "gi"
    );

    if (!regex.test(source)) return false;
    regex.lastIndex = 0;

    let lastIndex = 0;
    for (const match of source.matchAll(regex)) {
      const index = match.index ?? 0;
      if (index > lastIndex) {
        target.append(document.createTextNode(source.slice(lastIndex, index)));
      }

      const mark = document.createElement("mark");
      mark.textContent = match[0];
      target.append(mark);
      lastIndex = index + match[0].length;
    }

    if (lastIndex < source.length) {
      target.append(document.createTextNode(source.slice(lastIndex)));
    }

    return true;
  }

  renderEmptyState(query = "", providedSuggestions = []) {
    const wrap = document.createElement("div");
    wrap.className = "menu-search__empty";

    const title = document.createElement("p");
    title.className = "menu-search__empty-title";
    title.textContent = query
      ? this.t("menu.search_no_results_title", "Keine passenden Ergebnisse gefunden")
      : this.t("menu.search_empty_title", "Website-Suche starten");
    wrap.appendChild(title);

    const description = document.createElement("p");
    description.className = "menu-search__empty-text";
    description.textContent = this.t(
      "menu.search_empty_text",
      "Probiere Startseite, About, Blog oder Projekte."
    );
    wrap.appendChild(description);

    const suggestions =
      Array.isArray(providedSuggestions) && providedSuggestions.length > 0
        ? providedSuggestions
        : typeof this.getFallbackSuggestions === "function"
          ? this.getFallbackSuggestions()
          : [];
    const suggestionChips = this.renderSuggestionChips(
      suggestions,
      "menu-search__empty-suggestions"
    );
    if (suggestionChips.children.length > 0) {
      wrap.appendChild(suggestionChips);
    }
    return wrap;
  }

  renderState(results, options = {}) {
    if (!results) return;

    const {
      hidden = false,
      loading = false,
      message = "",
      items = [],
      facet = "all",
      facets = [],
      aiChatMessage = "",
      aiChatSuggestions = [],
      query = "",
      selectedIndex = -1,
      optionIdBuilder = index => `menu-search-results-option-${index}`,
    } = options;

    results.replaceChildren();
    results.setAttribute("aria-busy", String(Boolean(loading)));

    if (hidden) {
      results.classList.remove("active");
      this.setPopupExpanded?.(false);
      return;
    }

    results.classList.add("active");
    this.setPopupExpanded?.(true);

    if (loading) {
      const skeleton = document.createElement("div");
      skeleton.className = "menu-search__skeleton";
      for (let i = 0; i < 3; i += 1) {
        const row = document.createElement("div");
        row.className = "menu-search__skeleton-row";
        const title = document.createElement("div");
        title.className = "skeleton-title";
        const desc = document.createElement("div");
        desc.className = "skeleton-desc";
        row.append(title, desc);
        skeleton.appendChild(row);
      }
      results.appendChild(skeleton);
      return;
    }

    if (aiChatMessage) {
      const aiChat = document.createElement("div");
      aiChat.className = "menu-search__ai-chat";

      const aiText = document.createElement("div");
      aiText.className = "menu-search__ai-text";
      setSanitizedHTML(aiText, aiChatMessage);
      aiChat.appendChild(aiText);

      const suggestionChips = this.renderSuggestionChips(
        aiChatSuggestions,
        "menu-search__ai-suggestions"
      );
      if (suggestionChips.children.length > 0) {
        aiChat.appendChild(suggestionChips);
      }

      results.appendChild(aiChat);
    }

    if (query) {
      const facetBar = document.createElement("div");
      facetBar.className = "menu-search__facets";

      (Array.isArray(facets) ? facets : []).forEach(entry => {
        const facetKey = String(entry?.key || "").trim() || "all";
        const button = document.createElement("button");
        button.type = "button";
        button.className = "menu-search__facet";
        button.dataset.searchFacet = facetKey;
        button.dataset.active = String(facetKey === facet);
        if (facetKey === facet) {
          button.classList.add("is-active");
        }

        const label = document.createElement("span");
        label.className = "menu-search__facet-label";
        label.textContent =
          typeof this.getFacetLabel === "function" ? this.getFacetLabel(facetKey) : facetKey;

        const count = document.createElement("span");
        count.className = "menu-search__facet-count";
        count.textContent = String(
          Math.max(0, Number.parseInt(String(entry?.count || 0), 10) || 0)
        );

        button.append(label, count);
        facetBar.appendChild(button);
      });

      if (facetBar.children.length > 0) {
        results.appendChild(facetBar);
      }
    }

    if (message) {
      const stateEl = document.createElement("div");
      stateEl.className = "menu-search__state";
      stateEl.textContent = message;
      results.appendChild(stateEl);

      if (items.length === 0) {
        return;
      }
    }

    if (items.length === 0) {
      if (!aiChatMessage) {
        results.appendChild(this.renderEmptyState(query, aiChatSuggestions));
      }
      return;
    }

    const summary = document.createElement("div");
    summary.className = "menu-search__count";

    const countText = document.createElement("span");
    countText.className = "menu-search__count-value";
    const activeFacetLabel =
      typeof this.getFacetLabel === "function" ? this.getFacetLabel(facet) : facet;
    countText.textContent = `${items.length} ${items.length === 1 ? "Ergebnis" : "Ergebnisse"}${
      activeFacetLabel && facet !== "all" ? ` in ${activeFacetLabel}` : ""
    }`;
    summary.appendChild(countText);

    const hintText = document.createElement("span");
    hintText.className = "menu-search__count-hint";
    hintText.textContent = "Enter oeffnen | Pfeile navigieren | Esc";
    summary.appendChild(hintText);

    results.appendChild(summary);

    const list = document.createElement("ul");
    list.className = "menu-search__list";

    items.forEach((item, index) => {
      const li = document.createElement("li");
      li.className = "menu-search__item";

      const button = document.createElement("button");
      button.type = "button";
      button.className = "menu-search__result";
      button.id = optionIdBuilder(index);
      button.setAttribute("data-search-index", String(index));
      button.setAttribute("role", "option");
      button.setAttribute("aria-selected", String(index === selectedIndex));

      if (index === selectedIndex) {
        button.classList.add("is-selected");
      }

      const badge = document.createElement("span");
      badge.className = "menu-search__badge";
      badge.textContent =
        typeof this.getCategoryLabel === "function"
          ? this.getCategoryLabel(item.category)
          : item.category || "Seite";
      button.appendChild(badge);

      const heading = document.createElement("span");
      heading.className = "menu-search__heading";

      const title = document.createElement("span");
      title.className = "menu-search__title";
      title.textContent = item.title;
      heading.appendChild(title);

      const go = document.createElement("span");
      go.className = "menu-search__go";
      go.setAttribute("aria-hidden", "true");
      go.textContent = "›";
      heading.appendChild(go);

      button.appendChild(heading);

      const url = document.createElement("span");
      url.className = "menu-search__url";
      url.textContent =
        typeof this.formatSearchResultUrl === "function"
          ? this.formatSearchResultUrl(item.url)
          : String(item.url || "");
      button.appendChild(url);

      const descriptionText = String(item.description || "").trim();
      if (item.highlightedDescription || descriptionText) {
        const desc = document.createElement("span");
        desc.className = "menu-search__desc";
        if (
          typeof this.hasMarkedHighlight === "function" &&
          this.hasMarkedHighlight(item.highlightedDescription)
        ) {
          setSanitizedHTML(desc, item.highlightedDescription);
          button.appendChild(desc);
        } else if (this.appendClientHighlightedText(desc, descriptionText, query)) {
          button.appendChild(desc);
        } else if (descriptionText) {
          desc.textContent = descriptionText;
          button.appendChild(desc);
        }
      }

      li.appendChild(button);
      list.appendChild(li);
    });

    results.appendChild(list);
  }

  updateSelectionUI(results, input, selectedIndex) {
    if (!results) return;

    const optionEls = results.querySelectorAll("[data-search-index]");
    let activeOptionId = "";

    optionEls.forEach(el => {
      const index = Number(el.getAttribute("data-search-index"));
      const isSelected = index === selectedIndex;
      el.classList.toggle("is-selected", isSelected);
      el.setAttribute("aria-selected", String(isSelected));

      if (isSelected) {
        activeOptionId = el.id || "";
        el.scrollIntoView({ block: "nearest" });
      }
    });

    if (!input) return;

    if (activeOptionId) {
      input.setAttribute("aria-activedescendant", activeOptionId);
      return;
    }

    input.removeAttribute("aria-activedescendant");
  }
}

// ============================================================================
// 6. SEARCH VIEW TRANSITION CONTROLLERS (formerly search-view-controller.js)
// ============================================================================

const SEARCH_VIEW_TRANSITION_OPTIONS = Object.freeze({
  rootClasses: [VIEW_TRANSITION_ROOT_CLASSES.MENU],
  timeoutMs: VIEW_TRANSITION_TIMINGS_MS.SEARCH_TIMEOUT,
  preserveLiveBackdropOnMobile: true,
});

export class MenuSearchViewController {
  constructor(container, host = null) {
    this.container = container;
    this.host = resolveMenuHost(container, host);

    this.isOpen = false;
    this.trigger = null;
    this.panel = null;
    this.bar = null;
    this.input = null;
    this.results = null;
    this.clearBtn = null;
  }

  bindElementsFromContainer() {
    const trigger = this.container.querySelector(".search-trigger");
    const panel = this.container.querySelector(".menu-search");
    const bar = this.container.querySelector(".menu-search__bar");
    const input = /** @type {HTMLInputElement|null} */ (
      this.container.querySelector(".menu-search__input")
    );
    const results = this.container.querySelector(".menu-search__results");
    const clearBtn = this.container.querySelector(".menu-search__clear");

    if (!trigger || !panel || !bar || !input || !results) {
      return false;
    }

    this.trigger = trigger;
    this.panel = panel;
    this.bar = bar;
    this.input = input;
    this.results = results;
    this.clearBtn = clearBtn;
    return true;
  }

  getHeaderElement() {
    const header = this.host?.closest?.(".site-header");
    return isConnectedHTMLElement(header) ? header : null;
  }

  getToggleElement() {
    const toggle = this.container.querySelector(".site-menu__toggle");
    return isConnectedHTMLElement(toggle) ? toggle : null;
  }

  getPrimaryFocusTarget() {
    return this.input || this.trigger || this.getToggleElement();
  }

  getRestoreFocusTarget() {
    return this.trigger || this.getToggleElement();
  }

  getFocusTrapRoots() {
    return [this.panel, this.trigger, this.getToggleElement()].filter(isConnectedHTMLElement);
  }

  syncSearchTriggerState(isOpen) {
    const trigger = this.trigger;
    if (!trigger) return;

    if (isOpen) {
      const closeLabel = i18n.tOrFallback("menu.search_close", "Suche schließen");
      trigger.setAttribute("aria-label", closeLabel);
      trigger.setAttribute("title", closeLabel);
      trigger.setAttribute("aria-expanded", "true");
      return;
    }

    trigger.setAttribute("aria-label", i18n.tOrFallback("menu.search_label", "Suche"));
    trigger.setAttribute("title", i18n.tOrFallback("menu.search_tooltip", "Website durchsuchen"));
    trigger.setAttribute("aria-expanded", "false");
  }

  syncToggleSearchState(isOpen) {
    const toggle = this.getToggleElement();
    if (!toggle) return;

    toggle.classList.toggle("active", isOpen);
    if (isOpen) {
      toggle.setAttribute("aria-label", i18n.tOrFallback("menu.search_close", "Suche schließen"));
      return;
    }

    toggle.setAttribute("aria-label", i18n.tOrFallback("menu.toggle", "Menü"));
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
        header.classList.add("search-mode");
        panel.setAttribute("aria-hidden", "false");
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
      }
    );
  }

  applySearchClosedState({ keyboardController, searchStore, renderer }) {
    const wasOpen = this.isOpen;
    const header = this.getHeaderElement();
    this.isOpen = false;
    keyboardController.clear();

    const applyClosedState = () => {
      if (header) {
        header.classList.remove("search-mode");
      }

      if (this.panel) {
        this.panel.setAttribute("aria-hidden", "true");
      }

      this.syncSearchTriggerState(false);
      this.syncToggleSearchState(false);

      if (this.input) {
        this.input.value = "";
      }

      searchStore.clear({ query: "" });
      renderer.renderState(this.results, { hidden: true });
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

  updateClearButtonVisibility(query) {
    if (!this.clearBtn) return;
    this.clearBtn.classList.toggle("visible", Boolean(query && query.trim()));
  }

  setSearchPopupExpanded(isExpanded) {
    const expanded = String(Boolean(isExpanded));

    if (this.bar) {
      this.bar.setAttribute("aria-expanded", expanded);
    }

    if (this.input) {
      this.input.setAttribute("aria-expanded", expanded);
      if (!isExpanded) {
        this.input.removeAttribute("aria-activedescendant");
      }
    }
  }

  buildSearchOptionId(index) {
    const resultsId = this.results?.id || "menu-search-results";
    return `${resultsId}-option-${index}`;
  }
}

// ============================================================================
// 7. CENTRAL SEARCH ORCHESTRATOR (formerly MenuSearch.js)
// ============================================================================

export class MenuSearch {
  constructor(container, state, config = {}, host = null) {
    this.container = container;
    this.host = resolveMenuHost(container, host);
    this.state = state;
    this.config = config;
    this.cleanupFns = [];
    this.timers = new TimerManager("MenuSearch");
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
      getCategoryLabel: category => this.getCategoryLabel(category),
      getFacetLabel: facet => this.getFacetLabel(facet),
      formatSearchResultUrl: rawUrl => formatCompactUrlPath(rawUrl),
      getFallbackSuggestions: () => this.searchStore.getFallbackSuggestions(),
      hasMarkedHighlight: value => this.searchStore.hasMarkedHighlight(value),
      setPopupExpanded: isExpanded => this.view.setSearchPopupExpanded(isExpanded),
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

    const prepareSearchStyles = () => {
      void this.ensureSearchStyles();
    };

    const handleSearchTrigger = e => {
      e.preventDefault();
      if (this.isSearchOpen()) {
        this.closeSearchModeSilently();
        return;
      }
      void this.openSearchMode();
    };

    const handleSearchInput = () => {
      const query = this.view.input ? this.view.input.value : "";
      this.view.updateClearButtonVisibility(query);
      this.scheduleSearch(query);
    };

    const handleSearchKeydown = e => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (this.keyboardController.moveSelection(1)) {
          this.updateSearchSelectionUI();
        }
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (this.keyboardController.moveSelection(-1)) {
          this.updateSearchSelectionUI();
        }
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        this.activateSelectedSearchResult();
      }
    };

    const handleResultsClick = e => {
      const facetBtn = e.target?.closest?.("[data-search-facet]");
      if (facetBtn instanceof HTMLButtonElement) {
        void this.searchStore.setFacet(facetBtn.dataset.searchFacet);
        return;
      }

      const suggestionBtn = e.target?.closest?.("[data-search-suggestion-url]");
      if (suggestionBtn) {
        const url = suggestionBtn.getAttribute("data-search-suggestion-url");
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

    const handleResultsPointerOver = e => {
      const index = this.getSearchResultIndexFromEvent(e);
      if (index < 0) return;
      if (!this.keyboardController.setSelectedIndex(index)) return;
      this.updateSearchSelectionUI();
    };

    const handleClearClick = () => {
      if (this.view.input) {
        this.view.input.value = "";
        this.keyboardController.clear();
        this.searchStore.clear({ query: "" });
        this.view.input.focus();
      }
    };

    this.cleanupFns.push(
      this.addListener(this.view.trigger, "click", handleSearchTrigger),
      this.addListener(this.view.trigger, "pointerenter", prepareSearchStyles),
      this.addListener(this.view.trigger, "focus", prepareSearchStyles),
      this.addListener(this.view.input, "input", handleSearchInput),
      this.addListener(this.view.input, "keydown", handleSearchKeydown),
      this.addListener(this.view.results, "click", handleResultsClick),
      this.addListener(this.view.results, "pointerover", handleResultsPointerOver),
      ...this.preloadController.setupIntent({
        trigger: this.view.trigger,
        bar: this.view.bar,
      })
    );

    if (this.view.clearBtn) {
      this.cleanupFns.push(this.addListener(this.view.clearBtn, "click", handleClearClick));
    }
  }

  setupI18nSync() {
    this.cleanupFns.push(
      i18n.subscribe(() => {
        const isSearchOpen = this.isSearchOpen();
        this.view.syncSearchTriggerState(isSearchOpen);
        this.view.syncToggleSearchState(isSearchOpen);
      })
    );
  }

  setupSearchStateSync() {
    this.cleanupFns.push(
      activeOverlay.subscribe(mode => {
        this.syncSearchModeState(mode === OVERLAY_MODES.SEARCH);
      })
    );
  }

  setupSearchStoreSync() {
    this.cleanupFns.push(
      this.searchStore.subscribe(state => {
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
          optionIdBuilder: index => this.view.buildSearchOptionId(index),
        });
      })
    );
  }

  getSearchResultIndexFromEvent(event) {
    const target = /** @type {Element|null} */ (
      event.target instanceof Element ? event.target : null
    );
    const item = target?.closest?.("[data-search-index]");
    if (!item) return -1;

    const index = Number(item.getAttribute("data-search-index"));
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

  ensureSearchStyles() {
    if (this.host && typeof (/** @type {any} */ (this.host).ensureDeferredStyles) === "function") {
      return /** @type {any} */ (this.host).ensureDeferredStyles();
    }

    return Promise.resolve();
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

  async openSearchMode() {
    if (this.isSearchOpen()) return;

    await this.ensureSearchStyles();

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
    const query = String(rawQuery || "").trim();
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
    const key = String(category || "")
      .trim()
      .toLowerCase();

    const labels = {
      home: "Start",
      projekte: "Projekte",
      blog: "Blog",
      galerie: "Galerie",
      videos: "Videos",
      "ueber mich": "About",
      "über mich": "About",
      kontakt: "Kontakt",
      seite: "Seite",
    };

    return labels[key] || category || "Seite";
  }

  getFacetLabel(facet) {
    const key = String(facet || "")
      .trim()
      .toLowerCase();

    const labels = {
      all: "Alle",
      blog: "Blog",
      projects: "Projekte",
      videos: "Videos",
      pages: "Seiten",
    };

    return labels[key] || facet || "Alle";
  }

  updateSearchSelectionUI() {
    this.renderer.updateSelectionUI(
      this.view.results,
      this.view.input,
      this.keyboardController.getSelectedIndex()
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

  addListener(target, event, handler, options = {}) {
    return addManagedEventListener(target, event, handler, options);
  }

  destroy() {
    clearActiveOverlayMode(OVERLAY_MODES.SEARCH);
    this.clearSearchDebounce();
    this.abortSearchRequest();
    this.searchStore.destroy();

    this.timers.clearAll();
    this.cleanupFns.forEach(fn => fn());
    this.cleanupFns = [];
  }
}
