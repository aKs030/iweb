/**
 * Modern Core Module Exports
 * Central export point for all modern core modules
 * @version 3.0.0
 */

// Logger
export { createLogger, Logger, LOG_LEVELS } from './logger.js';

// Fetch
export {
  fetchWithRetry,
  fetchJSON,
  fetchText,
  fetchHTML,
  fetchAll,
  clearCache as clearFetchCache,
  getCacheStats as getFetchCacheStats,
} from './fetch.js';

// Events
export { EVENTS, fire, on, once, off, EventEmitter } from './events.js';

// Performance
export {
  mark,
  measure,
  getWebVitals,
  getNavigationTiming,
  getResourceTiming,
  getMemoryUsage,
  reportMetrics,
  clearMetrics,
  optimizeImages,
  preloadResources,
  deferScripts,
  monitorLongTasks,
} from './performance.js';

// Cache
export {
  getCache,
  cached,
  CacheManager,
  MemoryCache,
  IndexedDBCache,
} from './cache.js';

// Analytics
export {
  initAnalytics,
  sendEvent,
  trackPageView,
  trackEvent,
  trackInteraction,
  trackError,
  trackPerformance,
  trackConversion,
  setUserProperties,
  trackScrollDepth,
  setupScrollTracking,
  trackOutboundLink,
  setupOutboundLinkTracking,
  trackDownload,
  setupDownloadTracking,
} from './analytics.js';

// Schema
export {
  generateSchemaGraph,
  injectSchema,
  scheduleSchemaInjection,
} from './schema.js';

// DOM Utilities
export {
  getElementById,
  querySelector,
  querySelectorAll,
  exists,
  waitForElement,
} from './dom-utils.js';

// DOM Helpers
export {
  upsertHeadLink,
  upsertMeta,
  applyCanonicalLinks,
} from './dom-helpers.js';

// Canonical Manager
export {
  computeCanonicalUrl,
  buildCanonicalLinks,
  applyCanonicalLinks as applyCanonical,
  setEarlyCanonical,
} from './canonical-manager.js';

// PWA Manager
export { setupPWAAssets, buildPwaAssets } from './pwa-manager.js';

// Types (re-export for convenience)
// export type * from './types.js';
