/**
 * Resource Hints Manager
 * Simplified version focusing on essential performance optimizations
 */

import { createLogger } from './shared-utilities.js';

const log = createLogger('resource-hints');

/**
 * Resource hints manager for performance optimization
 */
export class ResourceHintsManager {
  constructor() {
    this.preloadedResources = new Set();
    this.init();
  }

  init() {
    // Setup resource hints for common external resources
    this.dnsPrefetch('fonts.googleapis.com');
    this.dnsPrefetch('cdn.jsdelivr.net');
    this.dnsPrefetch('esm.sh');
    this.dnsPrefetch('raw.githack.com');
    this.dnsPrefetch('cdn.jsdelivr.net');

    this.preconnect('fonts.gstatic.com', true);

    log.info('Resource hints initialized');
  }

  // Preload critical resources
  preload(href, as = 'script', crossorigin = false) {
    if (this.preloadedResources.has(href)) return;

    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = href;
    link.as = as;
    if (crossorigin) link.crossOrigin = 'anonymous';

    document.head.appendChild(link);
    this.preloadedResources.add(href);

    log.debug(`Preloaded: ${href}`);
  }

  // Prefetch resources for future navigation
  prefetch(href) {
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = href;
    document.head.appendChild(link);

    log.debug(`Prefetched: ${href}`);
  }

  // DNS prefetch for external domains
  dnsPrefetch(domain) {
    const link = document.createElement('link');
    link.rel = 'dns-prefetch';
    link.href = `//${domain}`;
    document.head.appendChild(link);

    log.debug(`DNS prefetch: ${domain}`);
  }

  // Preconnect to external domains
  preconnect(domain, crossorigin = false) {
    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = `//${domain}`;
    if (crossorigin) link.crossOrigin = 'anonymous';
    document.head.appendChild(link);

    log.debug(`Preconnect: ${domain}`);
  }

  // Preload critical CSS
  preloadCSS(href) {
    this.preload(href, 'style');
  }

  // Load non-critical CSS asynchronously
  loadCSSAsync(href) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.media = 'print';
    link.onload = () => {
      link.media = 'all';
    };
    document.head.appendChild(link);

    log.debug(`Async CSS: ${href}`);
  }
}

// Global instance
export const resourceHints = new ResourceHintsManager();
