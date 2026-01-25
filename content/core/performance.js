/**
 * Modern Performance Monitoring & Optimization
 * @version 1.0.0
 */

import { createLogger } from './logger.js';

const log = createLogger('Performance');

/**
 * Performance metrics storage
 */
const metrics = {
  marks: new Map(),
  measures: new Map(),
  vitals: {},
};

/**
 * Mark a performance point
 * @param {string} name - Mark name
 */
export function mark(name) {
  try {
    performance.mark(name);
    metrics.marks.set(name, performance.now());
    log.debug(`Mark: ${name}`);
  } catch (error) {
    log.warn('Failed to mark:', error);
  }
}

/**
 * Measure performance between two marks
 * @param {string} name - Measure name
 * @param {string} startMark - Start mark name
 * @param {string} [endMark] - End mark name (optional)
 * @returns {number} Duration in ms
 */
export function measure(name, startMark, endMark) {
  try {
    if (endMark) {
      performance.measure(name, startMark, endMark);
    } else {
      performance.measure(name, startMark);
    }

    const entries = performance.getEntriesByName(name, 'measure');
    const duration = entries[entries.length - 1]?.duration || 0;

    metrics.measures.set(name, duration);
    log.info(`Measure: ${name} = ${duration.toFixed(2)}ms`);

    return duration;
  } catch (error) {
    log.warn('Failed to measure:', error);
    return 0;
  }
}

/**
 * Get Core Web Vitals
 * @returns {Promise<Object>} Web Vitals metrics
 */
export async function getWebVitals() {
  const vitals = {};

  // LCP - Largest Contentful Paint
  try {
    const lcpObserver = new globalThis.PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];
      vitals.lcp = lastEntry.renderTime || lastEntry.loadTime;
      log.info(`LCP: ${vitals.lcp.toFixed(2)}ms`);
    });
    lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
  } catch {
    log.warn('LCP not supported');
  }

  // FID - First Input Delay
  try {
    const fidObserver = new globalThis.PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        vitals.fid = entry.processingStart - entry.startTime;
        log.info(`FID: ${vitals.fid.toFixed(2)}ms`);
      });
    });
    fidObserver.observe({ entryTypes: ['first-input'] });
  } catch {
    log.warn('FID not supported');
  }

  // CLS - Cumulative Layout Shift
  try {
    let clsValue = 0;
    const clsObserver = new globalThis.PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
        }
      }
      vitals.cls = clsValue;
      log.info(`CLS: ${vitals.cls.toFixed(4)}`);
    });
    clsObserver.observe({ entryTypes: ['layout-shift'] });
  } catch {
    log.warn('CLS not supported');
  }

  metrics.vitals = vitals;
  return vitals;
}

/**
 * Get navigation timing
 * @returns {Object} Navigation timing metrics
 */
export function getNavigationTiming() {
  try {
    const timing = performance.getEntriesByType('navigation')[0];
    if (!timing) return {};

    return {
      dns: timing.domainLookupEnd - timing.domainLookupStart,
      tcp: timing.connectEnd - timing.connectStart,
      ttfb: timing.responseStart - timing.requestStart,
      download: timing.responseEnd - timing.responseStart,
      domInteractive: timing.domInteractive - timing.fetchStart,
      domComplete: timing.domComplete - timing.fetchStart,
      loadComplete: timing.loadEventEnd - timing.fetchStart,
    };
  } catch (error) {
    log.warn('Navigation timing not available:', error);
    return {};
  }
}

/**
 * Get resource timing
 * @param {string} [type] - Resource type filter
 * @returns {Array} Resource timing entries
 */
export function getResourceTiming(type) {
  try {
    const resources = performance.getEntriesByType('resource');

    if (type) {
      return resources.filter((r) => r.initiatorType === type);
    }

    return resources.map((r) => ({
      name: r.name,
      type: r.initiatorType,
      duration: r.duration,
      size: r.transferSize,
    }));
  } catch (error) {
    log.warn('Resource timing not available:', error);
    return [];
  }
}

/**
 * Get memory usage (Chrome only)
 * @returns {Object|null} Memory info
 */
export function getMemoryUsage() {
  try {
    if (performance.memory) {
      return {
        used: performance.memory.usedJSHeapSize,
        total: performance.memory.totalJSHeapSize,
        limit: performance.memory.jsHeapSizeLimit,
        usedMB: (performance.memory.usedJSHeapSize / 1048576).toFixed(2),
        totalMB: (performance.memory.totalJSHeapSize / 1048576).toFixed(2),
      };
    }
    return null;
  } catch (error) {
    log.warn('Memory info not available:', error);
    return null;
  }
}

/**
 * Report all metrics
 * @returns {Object} All performance metrics
 */
export function reportMetrics() {
  const report = {
    marks: Object.fromEntries(metrics.marks),
    measures: Object.fromEntries(metrics.measures),
    vitals: metrics.vitals,
    navigation: getNavigationTiming(),
    memory: getMemoryUsage(),
  };

  log.info('Performance Report:', report);
  return report;
}

/**
 * Clear all metrics
 */
export function clearMetrics() {
  try {
    performance.clearMarks();
    performance.clearMeasures();
    metrics.marks.clear();
    metrics.measures.clear();
    metrics.vitals = {};
    log.debug('Metrics cleared');
  } catch (error) {
    log.warn('Failed to clear metrics:', error);
  }
}

/**
 * Optimize images with lazy loading
 * @param {string} [selector] - Image selector
 */
export function optimizeImages(selector = 'img') {
  const images = document.querySelectorAll(selector);

  images.forEach((img) => {
    if (!img.loading) {
      img.loading = 'lazy';
    }
    if (!img.decoding) {
      img.decoding = 'async';
    }
  });

  log.debug(`Optimized ${images.length} images`);
}

/**
 * Preload critical resources
 * @param {Array<{href: string, as: string}>} resources
 */
export function preloadResources(resources) {
  resources.forEach(({ href, as }) => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = href;
    link.as = as;
    document.head.appendChild(link);
  });

  log.debug(`Preloaded ${resources.length} resources`);
}

/**
 * Defer non-critical scripts
 * @param {string} [selector] - Script selector
 */
export function deferScripts(selector = 'script[data-defer]') {
  const scripts = document.querySelectorAll(selector);

  scripts.forEach((script) => {
    if (!script.defer && !script.async) {
      script.defer = true;
    }
  });

  log.debug(`Deferred ${scripts.length} scripts`);
}

/**
 * Monitor long tasks
 * @param {Function} callback - Callback for long tasks
 */
export function monitorLongTasks(callback) {
  try {
    const observer = new globalThis.PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration > 50) {
          log.warn(`Long task detected: ${entry.duration.toFixed(2)}ms`);
          callback?.(entry);
        }
      }
    });

    observer.observe({ entryTypes: ['longtask'] });
    return observer;
  } catch {
    log.warn('Long task monitoring not supported');
    return null;
  }
}

// Auto-initialize Web Vitals tracking
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    getWebVitals();
  });
}

export { metrics };
