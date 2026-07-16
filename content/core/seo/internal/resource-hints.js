/** Adaptive prefetching, module preloading, and speculation rules. */

import { createLogger } from "../../logger.js";
import { applyCspNonce, scheduleIdleTask, upsertHeadLink } from "../../utils/index.js";

const log = createLogger("ResourceHints");

// ============================================================================
// 1. ADAPTIVE RESOURCE BUDGET
// ============================================================================

const DEFAULT_PREFETCH_EAGERNESS = "conservative";

const RESOURCE_HINT_ROUTE_MATRIX = Object.freeze({
  home: Object.freeze({
    seedRoutes: ["/projekte/", "/gallery/", "/videos/", "/blog/", "/about/"],
    maxRoutes: 6,
    maxPrefetch: 3,
    prerenderEnabled: true,
    prerenderEagerness: "moderate",
    prefetchEagerness: DEFAULT_PREFETCH_EAGERNESS,
    intentWarmupDelayMs: 75,
  }),
  blog: Object.freeze({
    seedRoutes: ["/", "/projekte/", "/videos/", "/about/"],
    maxRoutes: 4,
    maxPrefetch: 2,
    prerenderEnabled: true,
    prerenderEagerness: "conservative",
    prefetchEagerness: DEFAULT_PREFETCH_EAGERNESS,
    intentWarmupDelayMs: 65,
  }),
  videos: Object.freeze({
    seedRoutes: ["/", "/gallery/", "/blog/", "/about/"],
    maxRoutes: 4,
    maxPrefetch: 2,
    prerenderEnabled: true,
    prerenderEagerness: "conservative",
    prefetchEagerness: DEFAULT_PREFETCH_EAGERNESS,
    intentWarmupDelayMs: 65,
  }),
  gallery: Object.freeze({
    seedRoutes: ["/", "/videos/", "/blog/", "/about/"],
    maxRoutes: 4,
    maxPrefetch: 2,
    prerenderEnabled: true,
    prerenderEagerness: "conservative",
    prefetchEagerness: DEFAULT_PREFETCH_EAGERNESS,
    intentWarmupDelayMs: 65,
  }),
  projects: Object.freeze({
    seedRoutes: ["/", "/blog/", "/gallery/", "/videos/", "/about/"],
    maxRoutes: 5,
    maxPrefetch: 2,
    prerenderEnabled: true,
    prerenderEagerness: "conservative",
    prefetchEagerness: DEFAULT_PREFETCH_EAGERNESS,
    intentWarmupDelayMs: 65,
  }),
  about: Object.freeze({
    seedRoutes: ["/", "/projekte/", "/blog/", "/gallery/", "/videos/"],
    maxRoutes: 4,
    maxPrefetch: 2,
    prerenderEnabled: true,
    prerenderEagerness: "conservative",
    prefetchEagerness: DEFAULT_PREFETCH_EAGERNESS,
    intentWarmupDelayMs: 60,
  }),
  generic: Object.freeze({
    seedRoutes: ["/projekte/", "/gallery/", "/videos/", "/blog/", "/about/"],
    maxRoutes: 4,
    maxPrefetch: 2,
    prerenderEnabled: true,
    prerenderEagerness: "conservative",
    prefetchEagerness: DEFAULT_PREFETCH_EAGERNESS,
    intentWarmupDelayMs: 60,
  }),
});

function detectResourceHintRouteBucket(pathname = "/") {
  const path = String(pathname || "/").toLowerCase();
  if (path === "/" || path === "/index.html") return "home";
  if (path.startsWith("/blog")) return "blog";
  if (path.startsWith("/videos")) return "videos";
  if (path.startsWith("/gallery")) return "gallery";
  if (path.startsWith("/projekte")) return "projects";
  if (path.startsWith("/about")) return "about";
  return "generic";
}

function getAdaptiveResourceHintBudget(options = {}) {
  const { pathname = "/", connection = null, deviceMemory = 0, hardwareConcurrency = 0 } = options;
  const bucket = detectResourceHintRouteBucket(pathname);
  const base = RESOURCE_HINT_ROUTE_MATRIX[bucket] || RESOURCE_HINT_ROUTE_MATRIX.generic;
  const saveData = Boolean(connection?.saveData);
  const effectiveType = String(connection?.effectiveType || "").toLowerCase();
  const memory = Number(deviceMemory || 0);
  const cores = Number(hardwareConcurrency || 0);

  const budget = {
    ...base,
    seedRoutes: [...base.seedRoutes],
  };

  if (
    saveData ||
    effectiveType.includes("2g") ||
    (memory > 0 && memory <= 2) ||
    (cores > 0 && cores <= 4)
  ) {
    budget.maxRoutes = Math.min(budget.maxRoutes, 3);
    budget.maxPrefetch = Math.min(budget.maxPrefetch, 2);
    budget.prerenderEnabled = false;
    budget.prerenderEagerness = "conservative";
    budget.intentWarmupDelayMs = Math.max(budget.intentWarmupDelayMs, 110);
    return budget;
  }

  if (effectiveType.includes("3g") || (memory > 0 && memory <= 4) || (cores > 0 && cores <= 8)) {
    budget.maxRoutes = Math.min(budget.maxRoutes, 4);
    budget.maxPrefetch = Math.min(budget.maxPrefetch, 2);
    budget.prerenderEagerness = "conservative";
    budget.intentWarmupDelayMs = Math.max(budget.intentWarmupDelayMs, 90);
    return budget;
  }
  return budget;
}

// ============================================================================
// 2. RESOURCE HINTS MANAGER
// ============================================================================

const ELEMENT_HINT_SELECTOR =
  'link[rel="prefetch"], link[rel="prerender"], script[type="speculationrules"]';
const SPECULATION_RULES_SELECTOR =
  'script[type="speculationrules"][data-injected-by="resource-hints"]';
const DOWNLOAD_FILE_RE =
  /\.(pdf|zip|rar|7z|tar|gz|mp4|webm|mov|mp3|wav|doc|docx|xls|xlsx|ppt|pptx)$/i;

class ResourceHintsManager {
  constructor() {
    this.hints = new Map();
    this.resetRuntimeState();
  }

  resetRuntimeState() {
    this.initialized = false;
    this.speculationRefreshAttached = false;
    this.intentHandlersAttached = false;
    this.intentHandler = null;
    this.intentWarmupTimer = null;
    this.intentPrefetchedRoutes = new Set();
    this._cachedProfile = null;
    this._cachedProfilePathname = null;
    // IntersectionObserver-based prefetch state
    this.intersectionObserver = null;
    this.intersectionPrefetchedRoutes = new Set();
  }

  registerLinkHint(config) {
    const { key, linkOptions, hintMeta, successMessage, failureMessage } = config;
    if (!key || this.hints.has(key)) return false;

    try {
      upsertHeadLink({
        ...(linkOptions || {}),
        dataset: {
          injectedBy: "resource-hints",
          ...(linkOptions?.dataset || {}),
        },
      });
      this.hints.set(key, hintMeta);
      log.info(successMessage);
      return true;
    } catch (err) {
      log.error(failureMessage, err);
      return false;
    }
  }

  resolveEligibleRoute(rawHref) {
    const href = String(rawHref || "").trim();
    if (!href || href.startsWith("#")) return null;
    if (href.startsWith("mailto:") || href.startsWith("tel:")) return null;

    try {
      const url = new URL(href, globalThis.location.href);
      if (url.origin !== globalThis.location.origin) return null;
      if (url.search) return null;
      if (!this.isEligibleSpeculativePath(url.pathname)) return null;
      return this.toRoutePath(url.pathname);
    } catch {
      return null;
    }
  }

  trackSpeculationHint(routes, rules) {
    this.hints.set("speculationrules", {
      type: "speculationrules",
      routes: [...routes],
      prerenderEnabled: Boolean(rules.prerender?.length),
      eagerness: rules.prerender?.[0]?.eagerness || "conservative",
    });
  }

  clearIntentWarmupTimer() {
    if (!this.intentWarmupTimer) return;
    clearTimeout(this.intentWarmupTimer);
    this.intentWarmupTimer = null;
  }

  getNetworkConnection() {
    const nav = /** @type {any} */ (globalThis.navigator);
    return nav?.connection || nav?.mozConnection || nav?.webkitConnection || null;
  }

  dnsPrefetch(origin) {
    this.registerLinkHint({
      key: `dns-prefetch:${origin}`,
      linkOptions: { rel: "dns-prefetch", href: origin },
      hintMeta: { type: "dns-prefetch", origin },
      successMessage: `DNS prefetch added: ${origin}`,
      failureMessage: `Failed to add DNS prefetch for ${origin}:`,
    });
  }

  prefetch(href, options = {}) {
    const { as = "document" } = options;
    this.registerLinkHint({
      key: `prefetch:${href}`,
      linkOptions: { rel: "prefetch", href, as },
      hintMeta: { type: "prefetch", href, as },
      successMessage: `Prefetch added: ${href}`,
      failureMessage: `Failed to add prefetch for ${href}:`,
    });
  }

  modulePreload(href) {
    this.registerLinkHint({
      key: `modulepreload:${href}`,
      linkOptions: {
        rel: "modulepreload",
        href,
        crossOrigin: "anonymous",
      },
      hintMeta: { type: "modulepreload", href },
      successMessage: `Module preload added: ${href}`,
      failureMessage: `Failed to add modulepreload for ${href}:`,
    });
  }

  normalizePath(pathname) {
    const raw = String(pathname || "").trim();
    if (!raw || raw === "/index.html") return "/";

    const withLeadingSlash = raw.startsWith("/") ? raw : `/${raw}`;
    return withLeadingSlash.replace(/\/{2,}/g, "/");
  }

  toRoutePath(pathname) {
    const normalized = this.normalizePath(pathname);
    if (normalized === "/") return "/";
    return normalized.endsWith("/") ? normalized : `${normalized}/`;
  }

  isSpeculationDisabled() {
    try {
      if (globalThis.__DISABLE_SPECULATION__ === true) return true;

      const params = new URLSearchParams(globalThis.location?.search || "");
      if (params.get("speculation") === "off") return true;
    } catch {
      // Ignore environments where location is unavailable
    }

    return false;
  }

  shouldUseSpeculativeLoading() {
    try {
      const connection = this.getNetworkConnection();

      if (!connection) return true;
      if (connection.saveData) return false;

      const effectiveType = String(connection.effectiveType || "").toLowerCase();
      return !effectiveType.includes("2g");
    } catch {
      return true;
    }
  }

  getSpeculationProfile() {
    const currentPathname = globalThis.location?.pathname || "/";

    if (this._cachedProfile && this._cachedProfilePathname === currentPathname) {
      return this._cachedProfile;
    }

    this._cachedProfilePathname = currentPathname;
    const nav = /** @type {any} */ (globalThis.navigator);
    this._cachedProfile = getAdaptiveResourceHintBudget({
      pathname: currentPathname,
      connection: this.getNetworkConnection(),
      deviceMemory: Number(nav?.deviceMemory || 0),
      hardwareConcurrency: Number(nav?.hardwareConcurrency || 0),
    });

    return this._cachedProfile;
  }

  isEligibleSpeculativePath(pathname) {
    const normalized = this.normalizePath(pathname);
    const current = this.normalizePath(globalThis.location?.pathname || "/");

    if (!normalized || normalized === "/" || normalized === current) return false;
    if (normalized.startsWith("/api/") || normalized.startsWith("/functions/")) {
      return false;
    }
    if (DOWNLOAD_FILE_RE.test(normalized)) return false;

    // Keep speculative route list focused on high-level destinations
    const segments = normalized.split("/").filter(Boolean);
    if (segments.length > 1) return false;

    return true;
  }

  collectRoutesFromDom() {
    const selectors = [
      { selector: ".site-menu a[href]", weight: 6 },
      { selector: "header a[href]", weight: 4 },
      { selector: "main a[href]", weight: 2 },
      { selector: "a[href]", weight: 1 },
    ];
    const routeScores = new Map();
    const origin = globalThis.location?.origin || "";

    selectors.forEach(({ selector, weight }) => {
      document.querySelectorAll(selector).forEach(anchor => {
        if (!(anchor instanceof HTMLAnchorElement)) return;
        if (anchor.hasAttribute("download")) return;
        const route = this.resolveEligibleRoute(anchor.getAttribute("href"));
        if (!route) return;
        const url = new URL(route, globalThis.location.href);
        if (url.origin !== origin) return;
        const score = routeScores.get(route) || 0;
        routeScores.set(route, score + weight);
      });
    });

    return Array.from(routeScores.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([route]) => route)
      .slice(0, this.getSpeculationProfile().maxRoutes);
  }

  getSpeculativeRoutes(seedRoutes = this.getSpeculationProfile().seedRoutes) {
    const merged = [...seedRoutes, ...this.collectRoutesFromDom()];
    const uniqueRoutes = [];
    const seen = new Set();
    const profile = this.getSpeculationProfile();

    merged.forEach(path => {
      if (!this.isEligibleSpeculativePath(path)) return;
      const route = this.toRoutePath(path);
      if (seen.has(route)) return;
      seen.add(route);
      uniqueRoutes.push(route);
    });

    return uniqueRoutes.slice(0, profile.maxRoutes);
  }

  getPrefetchRoutes(routes) {
    return routes.slice(0, this.getSpeculationProfile().maxPrefetch);
  }

  createSpeculationRules(routes) {
    const profile = this.getSpeculationProfile();
    const prefetchRoutes = this.getPrefetchRoutes(routes);
    const rules = {
      prefetch: [
        {
          source: "list",
          urls: prefetchRoutes,
          eagerness: profile.prefetchEagerness,
        },
      ],
    };

    if (profile.prerenderEnabled) {
      rules.prerender = [
        {
          source: "document",
          where: {
            and: [
              { href_matches: "/*" },
              { not: { href_matches: "/api/*" } },
              { not: { href_matches: "/functions/*" } },
              {
                not: {
                  selector_matches:
                    'a[download],a[href^="#"],a[href*="?"],a[target="_blank"],a[href$=".pdf"],a[href$=".zip"],a[href$=".mp4"],a[data-no-speculate],a[data-no-prerender]',
                },
              },
            ],
          },
          eagerness: profile.prerenderEagerness,
        },
      ];
    }

    return rules;
  }

  supportsSpeculationRules() {
    return Boolean(HTMLScriptElement.supports && HTMLScriptElement.supports("speculationrules"));
  }

  trackSpeculationActivation() {
    try {
      const [navigationEntry] = performance.getEntriesByType("navigation");
      if (!navigationEntry) return;

      const navEntry = /** @type {any} */ (navigationEntry);
      const activationStart = Number(navEntry.activationStart || 0);
      if (activationStart <= 0) return;

      performance.mark("speculation-prerender-activated");

      const detail = {
        activated: true,
        activationStart: Math.round(activationStart),
        path: this.normalizePath(globalThis.location?.pathname || "/"),
        type: navEntry.type || "navigate",
      };

      log.info("Prerender activation detected", detail);

      globalThis.dispatchEvent(new CustomEvent("speculation:activation", { detail }));
    } catch (err) {
      log.debug("Speculation activation tracking unavailable", err);
    }
  }

  initPrefetchFallback(routes = this.getSpeculationProfile().seedRoutes) {
    const speculativeRoutes = this.getPrefetchRoutes(this.getSpeculativeRoutes(routes));
    speculativeRoutes.forEach(href => this.prefetch(href, { as: "document" }));
    log.info(`Prefetch fallback initialized (${speculativeRoutes.length} routes)`);
  }

  updateInjectedSpeculationRules(routes) {
    const rules = this.createSpeculationRules(routes);
    const script = document.querySelector(SPECULATION_RULES_SELECTOR);
    if (!script) return false;

    const replacement = document.createElement("script");
    replacement.type = "speculationrules";
    replacement.dataset.injectedBy = "resource-hints";
    applyCspNonce(replacement);
    replacement.textContent = JSON.stringify(rules);
    script.replaceWith(replacement);

    this.trackSpeculationHint(routes, rules);
    log.info(`Speculation Rules updated (${routes.length} routes)`);
    return true;
  }

  getIntentRouteFromAnchor(anchor) {
    if (!anchor) return null;
    if (anchor.hasAttribute("download")) return null;
    if (anchor.target === "_blank") return null;
    if (anchor.dataset?.noSpeculate === "true") return null;
    if (anchor.dataset?.noPrerender === "true") return null;

    return this.resolveEligibleRoute(anchor.getAttribute("href"));
  }

  promoteIntentRoute(route) {
    if (!route) return;

    const prioritizedRoutes = [
      route,
      ...this.getSpeculativeRoutes().filter(item => item !== route),
    ].slice(0, this.getSpeculationProfile().maxRoutes);

    if (this.supportsSpeculationRules()) {
      if (this.updateInjectedSpeculationRules(prioritizedRoutes)) {
        return;
      }
    }

    this.prefetch(route, { as: "document" });
  }

  attachIntentPreloading() {
    if (this.intentHandlersAttached) return;
    this.intentHandlersAttached = true;

    this.intentHandler = event => {
      const target = event?.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(target instanceof HTMLAnchorElement)) return;

      const route = this.getIntentRouteFromAnchor(target);
      if (!route) return;

      if (event.type === "pointerover") {
        if (this.intentPrefetchedRoutes.has(route)) return;
        this.clearIntentWarmupTimer();
        this.intentWarmupTimer = setTimeout(() => {
          this.intentPrefetchedRoutes.add(route);
          this.prefetch(route, { as: "document" });
          this.intentWarmupTimer = null;
        }, this.getSpeculationProfile().intentWarmupDelayMs);
        return;
      }

      this.clearIntentWarmupTimer();
      this.promoteIntentRoute(route);
    };

    document.addEventListener("pointerover", this.intentHandler, {
      passive: true,
    });
    document.addEventListener("pointerdown", this.intentHandler, {
      passive: true,
    });
  }

  initSpeculativeRules(routes = this.getSpeculationProfile().seedRoutes) {
    try {
      const speculativeRoutes = this.getSpeculativeRoutes(routes);
      if (!this.supportsSpeculationRules()) {
        log.info("Speculative Rules API not supported by browser");
        return false;
      }

      if (this.updateInjectedSpeculationRules(speculativeRoutes)) {
        return true;
      }

      if (document.querySelector('script[type="speculationrules"]')) {
        log.info("Speculation Rules already present (external script), skipping manager injection");
        return true;
      }

      const script = document.createElement("script");
      script.type = "speculationrules";
      script.dataset.injectedBy = "resource-hints";
      applyCspNonce(script);

      const rules = this.createSpeculationRules(speculativeRoutes);

      script.textContent = JSON.stringify(rules);
      document.head.appendChild(script);
      this.trackSpeculationHint(speculativeRoutes, rules);
      log.info(
        `Speculation Rules injected (${speculativeRoutes.length} routes, prerender=${Boolean(rules.prerender?.length)})`
      );
      return true;
    } catch (err) {
      log.error("Failed to initialize speculative rules:", err);
      return false;
    }
  }

  initSpeculativeNavigation() {
    if (this.isSpeculationDisabled()) {
      log.info("Speculative navigation disabled via runtime flag");
      return;
    }

    if (!this.shouldUseSpeculativeLoading()) {
      log.info("Skipping speculative navigation due to Save-Data or slow connection");
      return;
    }

    const profile = this.getSpeculationProfile();
    log.info("Speculation profile", profile);

    const initializedWithSpeculation = this.initSpeculativeRules();
    if (!initializedWithSpeculation) {
      this.initPrefetchFallback();
    }

    this.attachIntentPreloading();
    this.attachIntersectionPrefetch();
    this.attachSpeculationRefresh();
  }

  attachSpeculationRefresh() {
    if (this.speculationRefreshAttached) return;
    this.speculationRefreshAttached = true;

    const refresh = () => {
      if (!this.initialized) return;
      if (this.isSpeculationDisabled()) return;
      if (!this.shouldUseSpeculativeLoading()) return;

      if (this.supportsSpeculationRules()) {
        this.initSpeculativeRules();
      } else {
        this.initPrefetchFallback();
      }
    };

    document.addEventListener("menu:loaded", refresh, { once: true });
    scheduleIdleTask(refresh, {
      timeout: 2200,
      fallbackDelay: 1200,
    });
  }

  attachIntersectionPrefetch() {
    if (this.intersectionObserver) return;
    if (typeof IntersectionObserver === "undefined") return;
    if (!this.shouldUseSpeculativeLoading()) return;

    const VIEWPORT_MARGIN = "0px 0px 150px 0px";

    this.intersectionObserver = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const anchor = entry.target;
          if (!(anchor instanceof HTMLAnchorElement)) continue;

          const route = this.getIntentRouteFromAnchor(anchor);
          if (!route) continue;
          if (this.intersectionPrefetchedRoutes.has(route)) continue;
          if (this.intentPrefetchedRoutes.has(route)) continue;

          this.intersectionPrefetchedRoutes.add(route);
          this.prefetch(route, { as: "document" });
          log.debug(`IntersectionObserver prefetch: ${route}`);

          this.intersectionObserver?.unobserve(anchor);
        }
      },
      { rootMargin: VIEWPORT_MARGIN, threshold: 0 }
    );

    this._observeEligibleLinks();

    document.addEventListener("menu:loaded", () => this._observeEligibleLinks(), { once: true });
  }

  _observeEligibleLinks() {
    if (!this.intersectionObserver) return;
    document.querySelectorAll("a[href]").forEach(el => {
      if (!(el instanceof HTMLAnchorElement)) return;
      const route = this.resolveEligibleRoute(el.getAttribute("href"));
      if (!route) return;
      if (this.intersectionPrefetchedRoutes.has(route)) return;
      this.intersectionObserver.observe(el);
    });
  }

  initCommonHints() {
    if (this.initialized) return;

    this.trackSpeculationActivation();
    this.initSpeculativeNavigation();

    this.initialized = true;
    log.info("Common resource hints initialized");
  }

  clearAllHints() {
    if (typeof document === "undefined") return;
    document.querySelectorAll(ELEMENT_HINT_SELECTOR).forEach(el => el.remove());
    this.hints.clear();
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
    }
  }
}

let instance = null;

function getResourceHintsManager() {
  if (!instance) {
    instance = new ResourceHintsManager();
  }
  return instance;
}

export const resourceHints = {
  dnsPrefetch: origin => getResourceHintsManager().dnsPrefetch(origin),
  prefetch: (href, options) => getResourceHintsManager().prefetch(href, options),
  modulePreload: href => getResourceHintsManager().modulePreload(href),
  init: () => getResourceHintsManager().initCommonHints(),
  clearAllHints: () => getResourceHintsManager().clearAllHints(),
};
