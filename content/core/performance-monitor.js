/**
 * Performance Monitoring Utility
 * Tracks Core Web Vitals and custom metrics
 * @version 1.0.0
 */

/* global PerformanceObserver */

import { createLogger } from './logger.js';

const log = createLogger('performance');

/**
 * @typedef {Object} PerformanceMetrics
 * @property {number} [FCP] - First Contentful Paint
 * @property {number} [LCP] - Largest Contentful Paint
 * @property {number} [FID] - First Input Delay
 * @property {number} [CLS] - Cumulative Layout Shift
 * @property {number} [TTFB] - Time to First Byte
 * @property {number} [TTI] - Time to Interactive
 */

class PerformanceMonitor {
  constructor() {
    /** @type {PerformanceMetrics} */
    this.metrics = {};
    this.initialized = false;
  }

  /**
   * Initialize performance monitoring
   */
  init() {
    if (this.initialized) return;
    this.initialized = true;

    // Only in production
    // @ts-ignore - Vite-specific import.meta.env
    if (import.meta.env?.DEV) {
      log.debug('Performance monitoring disabled in development');
      return;
    }

    this.observeWebVitals();
    this.trackNavigationTiming();
    this.trackResourceTiming();
  }

  /**
   * Observe Core Web Vitals
   */
  observeWebVitals() {
    // FCP - First Contentful Paint
    this.observePaint('first-contentful-paint', (entry) => {
      this.metrics.FCP = entry.startTime;
      log.info(`FCP: ${Math.round(entry.startTime)}ms`);
    });

    // LCP - Largest Contentful Paint
    this.observeLCP();

    // FID - First Input Delay
    this.observeFID();

    // CLS - Cumulative Layout Shift
    this.observeCLS();
  }

  /**
   * Observe paint timing
   * @param {string} name - Paint name
   * @param {(entry: PerformanceEntry) => void} callback - Callback
   */
  observePaint(name, callback) {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name === name) {
            callback(entry);
            observer.disconnect();
          }
        }
      });
      observer.observe({ type: 'paint', buffered: true });
    } catch (error) {
      log.warn('Paint observer failed:', error);
    }
  }

  /**
   * Observe Largest Contentful Paint
   */
  observeLCP() {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        this.metrics.LCP = lastEntry.startTime;
        log.info(`LCP: ${Math.round(lastEntry.startTime)}ms`);
      });
      observer.observe({ type: 'largest-contentful-paint', buffered: true });
    } catch (error) {
      log.warn('LCP observer failed:', error);
    }
  }

  /**
   * Observe First Input Delay
   */
  observeFID() {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          // @ts-ignore - processingStart exists on PerformanceEventTiming
          const fid = entry.processingStart - entry.startTime;
          this.metrics.FID = fid;
          log.info(`FID: ${Math.round(fid)}ms`);
          observer.disconnect();
        }
      });
      observer.observe({ type: 'first-input', buffered: true });
    } catch (error) {
      log.warn('FID observer failed:', error);
    }
  }

  /**
   * Observe Cumulative Layout Shift
   */
  observeCLS() {
    try {
      let clsValue = 0;
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          // @ts-ignore - value exists on LayoutShift
          if (!entry.hadRecentInput) {
            // @ts-ignore
            clsValue += entry.value;
            this.metrics.CLS = clsValue;
          }
        }
      });
      observer.observe({ type: 'layout-shift', buffered: true });

      // Log final CLS on page unload
      window.addEventListener(
        'visibilitychange',
        () => {
          if (document.visibilityState === 'hidden') {
            log.info(`CLS: ${clsValue.toFixed(3)}`);
          }
        },
        { once: true },
      );
    } catch (error) {
      log.warn('CLS observer failed:', error);
    }
  }

  /**
   * Track Navigation Timing
   */
  trackNavigationTiming() {
    try {
      window.addEventListener('load', () => {
        const entries = performance.getEntriesByType('navigation');
        /** @type {PerformanceNavigationTiming} */
        const navigation = /** @type {any} */ (entries[0]);

        if (navigation) {
          this.metrics.TTFB =
            navigation.responseStart - navigation.requestStart;
          log.info(`TTFB: ${Math.round(this.metrics.TTFB)}ms`);

          const domInteractive =
            navigation.domInteractive - navigation.fetchStart;
          log.info(`DOM Interactive: ${Math.round(domInteractive)}ms`);

          const domComplete = navigation.domComplete - navigation.fetchStart;
          log.info(`DOM Complete: ${Math.round(domComplete)}ms`);

          const loadComplete = navigation.loadEventEnd - navigation.fetchStart;
          log.info(`Load Complete: ${Math.round(loadComplete)}ms`);
        }
      });
    } catch (error) {
      log.warn('Navigation timing failed:', error);
    }
  }

  /**
   * Track Resource Timing
   */
  trackResourceTiming() {
    try {
      window.addEventListener('load', () => {
        const resources = performance.getEntriesByType('resource');
        const stats = {
          total: resources.length,
          scripts: 0,
          styles: 0,
          images: 0,
          fonts: 0,
          other: 0,
        };

        resources.forEach((resource) => {
          // @ts-ignore - initiatorType exists
          const type = resource.initiatorType;
          if (type === 'script') stats.scripts++;
          else if (type === 'css' || type === 'link') stats.styles++;
          else if (type === 'img') stats.images++;
          else if (type === 'font') stats.fonts++;
          else stats.other++;
        });

        log.info('Resource Stats:', stats);
      });
    } catch (error) {
      log.warn('Resource timing failed:', error);
    }
  }

  /**
   * Get all metrics
   * @returns {PerformanceMetrics}
   */
  getMetrics() {
    return { ...this.metrics };
  }

  /**
   * Send metrics to analytics (optional)
   * @param {string} endpoint - Analytics endpoint
   */
  async sendMetrics(endpoint) {
    try {
      await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metrics: this.metrics,
          url: window.location.href,
          userAgent: navigator.userAgent,
          timestamp: Date.now(),
        }),
      });
    } catch (error) {
      log.warn('Failed to send metrics:', error);
    }
  }
}

// Singleton instance
let instance = null;

/**
 * Get performance monitor instance
 * @returns {PerformanceMonitor}
 */
export function getPerformanceMonitor() {
  if (!instance) {
    instance = new PerformanceMonitor();
  }
  return instance;
}

/**
 * Initialize performance monitoring
 */
export function initPerformanceMonitoring() {
  const monitor = getPerformanceMonitor();
  monitor.init();
}
