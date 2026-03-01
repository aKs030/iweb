/**
 * Resource Hints Manager
 * Optimizes resource loading with preconnect, prefetch, and preload
 * @author Abdulkerim Sesli
 * @version 1.0.0
 */

import { createLogger } from './logger.js';
import { upsertHeadLink } from './utils.js';

const log = createLogger('ResourceHints');

/**
 * Resource Hints Manager
 */
class ResourceHintsManager {
  constructor() {
    this.hints = new Map();
    this.initialized = false;
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
   * Inject Speculative Rules for prerendering on hover/pointerdown
   */
  initSpeculativeRules() {
    if (
      HTMLScriptElement.supports &&
      HTMLScriptElement.supports('speculationrules')
    ) {
      if (document.querySelector('script[type="speculationrules"]')) {
        return;
      }

      const script = document.createElement('script');
      script.type = 'speculationrules';

      // Wir definieren Regeln: Prerender für interne Links auf Hover.
      // eagerness 'moderate' triggert auf mousedown/pointerdown oder längeres Hovern (z.B. 200ms)
      const rules = {
        prerender: [
          {
            source: 'document',
            where: {
              and: [
                { href_matches: '/*\\?*' },
                { not: { href_matches: '/api/*' } },
              ],
            },
            eagerness: 'moderate',
          },
        ],
      };

      script.textContent = JSON.stringify(rules);
      document.head.appendChild(script);
      log.info('Speculative Rules injected for prerendering');
    } else {
      log.info('Speculative Rules API not supported by browser');
    }
  }

  /**
   * Initialize common resource hints
   */
  initCommonHints() {
    if (this.initialized) return;

    // CDN origins
    this.preconnect('https://cdn.jsdelivr.net');
    this.preconnect('https://esm.sh');

    // DNS prefetch for external services
    this.dnsPrefetch('https://www.google-analytics.com');
    this.dnsPrefetch('https://www.googletagmanager.com');

    this.initSpeculativeRules();

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
   * Clear all hints
   */
  clear() {
    this.hints.clear();
    this.initialized = false;
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
