/**
 * Resource Hints Manager
 * Optimizes resource loading with preconnect, prefetch, and preload
 * @author Abdulkerim Sesli
 * @version 1.0.0
 */

import { createLogger } from './logger.js';
import { upsertHeadLink } from './utils.js';

const log = createLogger('ResourceHints');
const DEFAULT_SPECULATIVE_ROUTES = Object.freeze([
  '/projekte/',
  '/gallery/',
  '/videos/',
  '/blog/',
  '/about/',
]);
const DEFAULT_MAX_SPECULATIVE_ROUTES = 6;
const DEFAULT_MAX_PREFETCH_ROUTES = 3;
const SPECULATION_RULES_SELECTOR =
  'script[type="speculationrules"][data-injected-by="resource-hints"]';
const DOWNLOAD_FILE_RE =
  /\.(pdf|zip|rar|7z|tar|gz|mp4|webm|mov|mp3|wav|doc|docx|xls|xlsx|ppt|pptx)$/i;
const POINTER_WARMUP_DELAY_MS = 75;

/**
 * Resource Hints Manager
 */
class ResourceHintsManager {
  constructor() {
    this.hints = new Map();
    this.initialized = false;
    this.speculationRefreshAttached = false;
    this.intentHandlersAttached = false;
    this.intentHandler = null;
    this.intentWarmupTimer = null;
    this.intentPrefetchedRoutes = new Set();
  }

  /**
   * Add preconnect hint for early connection to origin
   * @param {string} origin - Origin URL
   * @param {Object} options - Options
   */
  preconnect(origin, options = {}) {
    const { crossOrigin = true } = options;

    if (this.hints.has(`preconnect:${origin}`)) {
      return;
    }

    try {
      upsertHeadLink({
        rel: 'preconnect',
        href: origin,
        crossOrigin: crossOrigin ? 'anonymous' : undefined,
        dataset: { injectedBy: 'resource-hints' },
      });

      this.hints.set(`preconnect:${origin}`, { type: 'preconnect', origin });
      log.info(`Preconnect added: ${origin}`);
    } catch (err) {
      log.error(`Failed to add preconnect for ${origin}:`, err);
    }
  }

  /**
   * Add DNS prefetch hint
   * @param {string} origin - Origin URL
   */
  dnsPrefetch(origin) {
    if (this.hints.has(`dns-prefetch:${origin}`)) {
      return;
    }

    try {
      upsertHeadLink({
        rel: 'dns-prefetch',
        href: origin,
        dataset: { injectedBy: 'resource-hints' },
      });

      this.hints.set(`dns-prefetch:${origin}`, {
        type: 'dns-prefetch',
        origin,
      });
      log.info(`DNS prefetch added: ${origin}`);
    } catch (err) {
      log.error(`Failed to add DNS prefetch for ${origin}:`, err);
    }
  }

  /**
   * Add preload hint for critical resources
   * @param {string} href - Resource URL
   * @param {Object} options - Options
   */
  preload(href, options = {}) {
    const { as = 'script', type, crossOrigin = true } = options;

    if (this.hints.has(`preload:${href}`)) {
      return;
    }

    try {
      upsertHeadLink({
        rel: 'preload',
        href,
        as,
        crossOrigin: crossOrigin ? 'anonymous' : undefined,
        dataset: { injectedBy: 'resource-hints' },
        attrs: type ? { type } : {},
      });

      this.hints.set(`preload:${href}`, { type: 'preload', href, as });
      log.info(`Preload added: ${href} (as: ${as})`);
    } catch (err) {
      log.error(`Failed to add preload for ${href}:`, err);
    }
  }

  /**
   * Add prefetch hint for future navigation
   * @param {string} href - Resource URL
   * @param {Object} options - Options
   */
  prefetch(href, options = {}) {
    const { as = 'document' } = options;

    if (this.hints.has(`prefetch:${href}`)) {
      return;
    }

    try {
      upsertHeadLink({
        rel: 'prefetch',
        href,
        as,
        dataset: { injectedBy: 'resource-hints' },
      });

      this.hints.set(`prefetch:${href}`, { type: 'prefetch', href, as });
      log.info(`Prefetch added: ${href}`);
    } catch (err) {
      log.error(`Failed to add prefetch for ${href}:`, err);
    }
  }

  /**
   * Add modulepreload hint for ES modules
   * @param {string} href - Module URL
   */
  modulePreload(href) {
    if (this.hints.has(`modulepreload:${href}`)) {
      return;
    }

    try {
      upsertHeadLink({
        rel: 'modulepreload',
        href,
        crossOrigin: 'anonymous',
        dataset: { injectedBy: 'resource-hints' },
      });

      this.hints.set(`modulepreload:${href}`, { type: 'modulepreload', href });
      log.info(`Module preload added: ${href}`);
    } catch (err) {
      log.error(`Failed to add modulepreload for ${href}:`, err);
    }
  }

  /**
   * Get normalized pathname without forcing trailing slash
   * @param {string} pathname
   * @returns {string}
   */
  normalizePath(pathname) {
    const raw = String(pathname || '').trim();
    if (!raw || raw === '/index.html') return '/';

    const withLeadingSlash = raw.startsWith('/') ? raw : `/${raw}`;
    return withLeadingSlash.replace(/\/{2,}/g, '/');
  }

  /**
   * Convert path to canonical route format
   * @param {string} pathname
   * @returns {string}
   */
  toRoutePath(pathname) {
    const normalized = this.normalizePath(pathname);
    if (normalized === '/') return '/';
    return normalized.endsWith('/') ? normalized : `${normalized}/`;
  }

  /**
   * Detect global/runtime kill switch for speculative loading
   * @returns {boolean}
   */
  isSpeculationDisabled() {
    try {
      if (globalThis.__DISABLE_SPECULATION__ === true) return true;

      const params = new URLSearchParams(globalThis.location?.search || '');
      if (params.get('speculation') === 'off') return true;

      const stored = globalThis.localStorage?.getItem('iweb-speculation');
      if (stored === 'off' || stored === 'disabled') return true;
    } catch {
      // Ignore environments where location/localStorage are unavailable
    }

    return false;
  }

  /**
   * Avoid aggressive speculative loading on constrained connections
   * @returns {boolean}
   */
  shouldUseSpeculativeLoading() {
    try {
      const connection =
        globalThis.navigator?.connection ||
        globalThis.navigator?.mozConnection ||
        globalThis.navigator?.webkitConnection;

      if (!connection) return true;
      if (connection.saveData) return false;

      const effectiveType = String(
        connection.effectiveType || '',
      ).toLowerCase();
      return !effectiveType.includes('2g');
    } catch {
      return true;
    }
  }

  /**
   * Build adaptive speculation profile from route + device + network signals.
   * @returns {{
   *   maxRoutes: number,
   *   maxPrefetch: number,
   *   prerenderEnabled: boolean,
   *   prerenderEagerness: 'moderate'|'conservative',
   *   prefetchEagerness: 'conservative'
   * }}
   */
  getSpeculationProfile() {
    const current = this.normalizePath(globalThis.location?.pathname || '/');
    const isHome = current === '/';

    const connection =
      globalThis.navigator?.connection ||
      globalThis.navigator?.mozConnection ||
      globalThis.navigator?.webkitConnection;
    const saveData = Boolean(connection?.saveData);
    const effectiveType = String(connection?.effectiveType || '').toLowerCase();
    const memory = Number(globalThis.navigator?.deviceMemory || 0);
    const cores = Number(globalThis.navigator?.hardwareConcurrency || 0);

    const profile = {
      maxRoutes: DEFAULT_MAX_SPECULATIVE_ROUTES,
      maxPrefetch: DEFAULT_MAX_PREFETCH_ROUTES,
      prerenderEnabled: true,
      prerenderEagerness: /** @type {'moderate'|'conservative'} */ (
        isHome ? 'moderate' : 'conservative'
      ),
      prefetchEagerness: /** @type {'conservative'} */ ('conservative'),
    };

    // Constrained environments: keep to lightweight prefetch.
    if (
      saveData ||
      effectiveType.includes('2g') ||
      (memory > 0 && memory <= 2) ||
      (cores > 0 && cores <= 4)
    ) {
      profile.maxRoutes = 3;
      profile.maxPrefetch = 2;
      profile.prerenderEnabled = false;
      profile.prerenderEagerness = 'conservative';
      return profile;
    }

    // Mid-tier: tighter route budgets and conservative prerender.
    if (
      effectiveType.includes('3g') ||
      (memory > 0 && memory <= 4) ||
      (cores > 0 && cores <= 8)
    ) {
      profile.maxRoutes = 4;
      profile.maxPrefetch = 2;
      profile.prerenderEagerness = 'conservative';
      return profile;
    }

    return profile;
  }

  /**
   * Check if a pathname is safe/useful for speculation
   * @param {string} pathname
   * @returns {boolean}
   */
  isEligibleSpeculativePath(pathname) {
    const normalized = this.normalizePath(pathname);
    const current = this.normalizePath(globalThis.location?.pathname || '/');

    if (!normalized || normalized === '/' || normalized === current)
      return false;
    if (
      normalized.startsWith('/api/') ||
      normalized.startsWith('/functions/')
    ) {
      return false;
    }
    if (DOWNLOAD_FILE_RE.test(normalized)) return false;

    // Keep speculative route list focused on high-level destinations
    const segments = normalized.split('/').filter(Boolean);
    if (segments.length > 1) return false;

    return true;
  }

  /**
   * Collect likely next routes from current DOM links
   * @returns {string[]}
   */
  collectRoutesFromDom() {
    const selectors = [
      { selector: '.site-menu a[href]', weight: 6 },
      { selector: 'header a[href]', weight: 4 },
      { selector: 'main a[href]', weight: 2 },
      { selector: 'a[href]', weight: 1 },
    ];
    const routeScores = new Map();
    const origin = globalThis.location?.origin || '';

    selectors.forEach(({ selector, weight }) => {
      document.querySelectorAll(selector).forEach((anchor) => {
        if (!(anchor instanceof HTMLAnchorElement)) return;
        const rawHref = anchor.getAttribute('href');
        if (!rawHref) return;
        if (rawHref.startsWith('#')) return;
        if (rawHref.startsWith('mailto:') || rawHref.startsWith('tel:')) return;
        if (anchor.hasAttribute('download')) return;

        try {
          const url = new URL(rawHref, globalThis.location.href);
          if (url.origin !== origin) return;
          if (url.search) return;
          if (!this.isEligibleSpeculativePath(url.pathname)) return;

          const route = this.toRoutePath(url.pathname);
          const score = routeScores.get(route) || 0;
          routeScores.set(route, score + weight);
        } catch {
          // Skip malformed links
        }
      });
    });

    return Array.from(routeScores.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([route]) => route)
      .slice(0, this.getSpeculationProfile().maxRoutes);
  }

  /**
   * Merge static + dynamic speculative routes in stable order
   * @param {string[]} [seedRoutes]
   * @returns {string[]}
   */
  getSpeculativeRoutes(seedRoutes = DEFAULT_SPECULATIVE_ROUTES) {
    const merged = [...seedRoutes, ...this.collectRoutesFromDom()];
    const uniqueRoutes = [];
    const seen = new Set();
    const profile = this.getSpeculationProfile();

    merged.forEach((path) => {
      if (!this.isEligibleSpeculativePath(path)) return;
      const route = this.toRoutePath(path);
      if (seen.has(route)) return;
      seen.add(route);
      uniqueRoutes.push(route);
    });

    return uniqueRoutes.slice(0, profile.maxRoutes);
  }

  /**
   * Adaptive eagerness: home can be more aggressive than deep pages
   * @returns {'moderate'|'conservative'}
   */
  getPrerenderEagerness() {
    return this.getSpeculationProfile().prerenderEagerness;
  }

  /**
   * Keep prefetch list small to avoid speculative overfetch
   * @param {string[]} routes
   * @returns {string[]}
   */
  getPrefetchRoutes(routes) {
    return routes.slice(0, this.getSpeculationProfile().maxPrefetch);
  }

  /**
   * Build speculation rules object
   * @param {string[]} routes
   * @returns {{ prefetch: Array<object>, prerender?: Array<object> }}
   */
  createSpeculationRules(routes) {
    const profile = this.getSpeculationProfile();
    const prefetchRoutes = this.getPrefetchRoutes(routes);
    const rules = {
      prefetch: [
        {
          source: 'list',
          urls: prefetchRoutes,
          eagerness: profile.prefetchEagerness,
        },
      ],
    };

    if (profile.prerenderEnabled) {
      rules.prerender = [
        {
          source: 'document',
          where: {
            and: [
              { href_matches: '/*' },
              { not: { href_matches: '/api/*' } },
              { not: { href_matches: '/functions/*' } },
              {
                not: {
                  selector_matches:
                    'a[download],a[href^="#"],a[href*="?"],a[target="_blank"],a[href$=".pdf"],a[href$=".zip"],a[href$=".mp4"],a[data-no-speculate],a[data-no-prerender]',
                },
              },
            ],
          },
          eagerness: this.getPrerenderEagerness(),
        },
      ];
    }

    return rules;
  }

  /**
   * Check browser support for Speculation Rules API
   * @returns {boolean}
   */
  supportsSpeculationRules() {
    return Boolean(
      HTMLScriptElement.supports &&
      HTMLScriptElement.supports('speculationrules'),
    );
  }

  /**
   * Record prerender activation metrics (if this page was prerendered)
   */
  trackSpeculationActivation() {
    try {
      const [navigationEntry] = performance.getEntriesByType('navigation');
      if (!navigationEntry) return;

      const activationStart = Number(navigationEntry.activationStart || 0);
      if (activationStart <= 0) return;

      performance.mark('speculation-prerender-activated');

      const detail = {
        activated: true,
        activationStart: Math.round(activationStart),
        path: this.normalizePath(globalThis.location?.pathname || '/'),
        type: navigationEntry.type || 'navigate',
      };

      log.info('Prerender activation detected', detail);

      globalThis.dispatchEvent(
        new CustomEvent('speculation:activation', { detail }),
      );
    } catch (err) {
      log.debug('Speculation activation tracking unavailable', err);
    }
  }

  /**
   * Prefetch fallback for browsers without Speculation Rules API
   * @param {string[]} [routes]
   */
  initPrefetchFallback(routes = DEFAULT_SPECULATIVE_ROUTES) {
    const speculativeRoutes = this.getPrefetchRoutes(
      this.getSpeculativeRoutes(routes),
    );
    speculativeRoutes.forEach((href) =>
      this.prefetch(href, { as: 'document' }),
    );
    log.info(
      `Prefetch fallback initialized (${speculativeRoutes.length} routes)`,
    );
  }

  /**
   * Update previously injected speculation rules (when route candidates change)
   * @param {string[]} routes
   * @returns {boolean}
   */
  updateInjectedSpeculationRules(routes) {
    const rules = this.createSpeculationRules(routes);
    const script = document.querySelector(SPECULATION_RULES_SELECTOR);
    if (!script) return false;

    // Chromium currently requires reinserting a new speculationrules script.
    // Updating textContent on an already processed script has no effect.
    const replacement = document.createElement('script');
    replacement.type = 'speculationrules';
    replacement.dataset.injectedBy = 'resource-hints';
    replacement.textContent = JSON.stringify(rules);
    script.replaceWith(replacement);

    this.hints.set('speculationrules', {
      type: 'speculationrules',
      routes: [...routes],
      prerenderEnabled: Boolean(rules.prerender?.length),
      eagerness: rules.prerender?.[0]?.eagerness || 'conservative',
    });
    log.info(`Speculation Rules updated (${routes.length} routes)`);
    return true;
  }

  /**
   * Resolve a normalized internal route from an anchor element
   * @param {HTMLAnchorElement} anchor
   * @returns {string|null}
   */
  getIntentRouteFromAnchor(anchor) {
    if (!anchor) return null;
    if (anchor.hasAttribute('download')) return null;
    if (anchor.target === '_blank') return null;
    if (anchor.dataset?.noSpeculate === 'true') return null;
    if (anchor.dataset?.noPrerender === 'true') return null;

    const rawHref = anchor.getAttribute('href');
    if (!rawHref || rawHref.startsWith('#')) return null;
    if (rawHref.startsWith('mailto:') || rawHref.startsWith('tel:'))
      return null;

    try {
      const url = new URL(rawHref, globalThis.location.href);
      if (url.origin !== globalThis.location.origin) return null;
      if (url.search) return null;
      if (!this.isEligibleSpeculativePath(url.pathname)) return null;
      return this.toRoutePath(url.pathname);
    } catch {
      return null;
    }
  }

  /**
   * Promote an intent route (hover/tap/click) to the front of speculation list
   * @param {string} route
   */
  promoteIntentRoute(route) {
    if (!route) return;

    const prioritizedRoutes = [
      route,
      ...this.getSpeculativeRoutes().filter((item) => item !== route),
    ].slice(0, this.getSpeculationProfile().maxRoutes);

    // If we control speculationrules, update with intent-first ranking.
    if (this.supportsSpeculationRules()) {
      if (this.updateInjectedSpeculationRules(prioritizedRoutes)) {
        return;
      }
    }

    // Fallback path (or external speculation script): prefetch this route.
    this.prefetch(route, { as: 'document' });
  }

  /**
   * Attach lightweight interaction-based prefetch/prerender promotion
   */
  attachIntentPreloading() {
    if (this.intentHandlersAttached) return;
    this.intentHandlersAttached = true;

    this.intentHandler = (event) => {
      const target =
        event?.target instanceof Element
          ? event.target.closest('a[href]')
          : null;
      if (!(target instanceof HTMLAnchorElement)) return;

      const route = this.getIntentRouteFromAnchor(target);
      if (!route) return;

      // Warmup on hover intent (debounced to avoid excessive prefetch churn).
      if (event.type === 'pointerover') {
        if (this.intentPrefetchedRoutes.has(route)) return;
        if (this.intentWarmupTimer) {
          clearTimeout(this.intentWarmupTimer);
          this.intentWarmupTimer = null;
        }
        this.intentWarmupTimer = setTimeout(() => {
          this.intentPrefetchedRoutes.add(route);
          this.prefetch(route, { as: 'document' });
          this.intentWarmupTimer = null;
        }, POINTER_WARMUP_DELAY_MS);
        return;
      }

      // On committed intent (pointerdown), prioritize route in speculation rules.
      if (this.intentWarmupTimer) {
        clearTimeout(this.intentWarmupTimer);
        this.intentWarmupTimer = null;
      }
      this.promoteIntentRoute(route);
    };

    document.addEventListener('pointerover', this.intentHandler, {
      passive: true,
    });
    document.addEventListener('pointerdown', this.intentHandler, {
      passive: true,
    });
  }

  /**
   * Inject Speculation Rules (adaptive prerender + prefetch)
   */
  initSpeculativeRules(routes = DEFAULT_SPECULATIVE_ROUTES) {
    try {
      const speculativeRoutes = this.getSpeculativeRoutes(routes);
      if (!this.supportsSpeculationRules()) {
        log.info('Speculative Rules API not supported by browser');
        return false;
      }

      // Update own injected rules if they already exist
      if (this.updateInjectedSpeculationRules(speculativeRoutes)) {
        return true;
      }

      // Respect existing rules (for example static rules in templates)
      if (document.querySelector('script[type="speculationrules"]')) {
        log.info(
          'Speculation Rules already present (external script), skipping manager injection',
        );
        return true;
      }

      const script = document.createElement('script');
      script.type = 'speculationrules';
      script.dataset.injectedBy = 'resource-hints';

      const rules = this.createSpeculationRules(speculativeRoutes);

      script.textContent = JSON.stringify(rules);
      document.head.appendChild(script);
      this.hints.set('speculationrules', {
        type: 'speculationrules',
        routes: [...speculativeRoutes],
        prerenderEnabled: Boolean(rules.prerender?.length),
        eagerness: rules.prerender?.[0]?.eagerness || 'conservative',
      });
      log.info(
        `Speculation Rules injected (${speculativeRoutes.length} routes, prerender=${Boolean(rules.prerender?.length)})`,
      );
      return true;
    } catch (err) {
      log.error('Failed to initialize speculative rules:', err);
      return false;
    }
  }

  /**
   * Initialize speculative navigation strategy with graceful fallback
   */
  initSpeculativeNavigation() {
    if (this.isSpeculationDisabled()) {
      log.info('Speculative navigation disabled via runtime flag');
      return;
    }

    if (!this.shouldUseSpeculativeLoading()) {
      log.info(
        'Skipping speculative navigation due to Save-Data or slow connection',
      );
      return;
    }

    const profile = this.getSpeculationProfile();
    log.info('Speculation profile', profile);

    const initializedWithSpeculation = this.initSpeculativeRules();
    if (!initializedWithSpeculation) {
      this.initPrefetchFallback();
    }

    this.attachIntentPreloading();
    this.attachSpeculationRefresh();
  }

  /**
   * Refresh speculation rules after late UI hydration (e.g. menu links)
   */
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

    document.addEventListener('menu:loaded', refresh, { once: true });

    if (globalThis.requestIdleCallback) {
      requestIdleCallback(refresh, { timeout: 2200 });
    } else {
      setTimeout(refresh, 1200);
    }
  }

  /**
   * Initialize common resource hints
   */
  initCommonHints() {
    if (this.initialized) return;

    // Network warmup for stable third-party origins is handled in base-head.html.
    // This manager focuses on runtime-adaptive speculative navigation.
    this.trackSpeculationActivation();
    this.initSpeculativeNavigation();

    this.initialized = true;
    log.info('Common resource hints initialized');
  }

  /**
   * Get all active hints
   * @returns {Array} Array of hints
   */
  getHints() {
    return Array.from(this.hints.values());
  }

  /**
   * Clear all hints — removes DOM elements and resets state
   */
  clear() {
    // Remove injected <link> elements from the DOM
    const injected = document.querySelectorAll(
      'link[data-injected-by="resource-hints"]',
    );
    injected.forEach((el) => el.remove());
    const injectedRules = document.querySelectorAll(SPECULATION_RULES_SELECTOR);
    injectedRules.forEach((el) => el.remove());
    if (this.intentHandlersAttached && this.intentHandler) {
      document.removeEventListener('pointerover', this.intentHandler);
      document.removeEventListener('pointerdown', this.intentHandler);
    }
    if (this.intentWarmupTimer) {
      clearTimeout(this.intentWarmupTimer);
      this.intentWarmupTimer = null;
    }

    this.hints.clear();
    this.intentPrefetchedRoutes.clear();
    this.initialized = false;
    this.speculationRefreshAttached = false;
    this.intentHandlersAttached = false;
    this.intentHandler = null;
  }
}

// Singleton instance
let instance = null;

/**
 * Get ResourceHintsManager instance
 * @returns {ResourceHintsManager}
 */
function getResourceHintsManager() {
  if (!instance) {
    instance = new ResourceHintsManager();
  }
  return instance;
}

/**
 * Quick helper functions
 */
export const resourceHints = {
  preconnect: (origin, options) =>
    getResourceHintsManager().preconnect(origin, options),
  dnsPrefetch: (origin) => getResourceHintsManager().dnsPrefetch(origin),
  preload: (href, options) => getResourceHintsManager().preload(href, options),
  prefetch: (href, options) =>
    getResourceHintsManager().prefetch(href, options),
  modulePreload: (href) => getResourceHintsManager().modulePreload(href),
  init: () => getResourceHintsManager().initCommonHints(),
};
