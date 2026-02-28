/**
 * Modern Performance Monitoring
 * Tracks Core Web Vitals and provides optimization insights
 * @version 1.0.0
 */

import { createLogger } from './logger.js';

const log = createLogger('PerformanceMonitor');

/**
 * Core Web Vitals thresholds (Google recommendations)
 */
const THRESHOLDS = {
  LCP: { good: 2500, needsImprovement: 4000 }, // Largest Contentful Paint
  FID: { good: 100, needsImprovement: 300 }, // First Input Delay
  CLS: { good: 0.1, needsImprovement: 0.25 }, // Cumulative Layout Shift
  FCP: { good: 1800, needsImprovement: 3000 }, // First Contentful Paint
  TTFB: { good: 800, needsImprovement: 1800 }, // Time to First Byte
  INP: { good: 200, needsImprovement: 500 }, // Interaction to Next Paint
};

/**
 * Performance Monitor Class
 */
class PerformanceMonitor {
  constructor() {
    this.metrics = {};
    this.isEnabled = this.shouldEnable();
  }

  /**
   * Check if monitoring should be enabled.
   * Enabled when:
   *  - Running on localhost (always)
   *  - URL contains ?perf=true (opt-in for production debugging)
   *  - localStorage has perf=true (persistent opt-in)
   *  - 10% random sample in production
   */
  shouldEnable() {
    if (typeof window === 'undefined') return false;
    if (window.location.hostname === 'localhost') return true;

    // Allow explicit opt-in via URL or localStorage
    const params = new URLSearchParams(window.location.search);
    if (params.get('perf') === 'true') return true;
    if (window.localStorage?.getItem('perf') === 'true') return true;

    return Math.random() < 0.1; // Sample 10% of production traffic
  }

  /**
   * Initialize performance monitoring
   */
  init() {
    if (!this.isEnabled) return;

    this.observeLCP();
    this.observeFID();
    this.observeCLS();
    this.observeFCP();
    this.observeTTFB();
    this.observeINP();
    this.observeResourceTiming();
  }

  /**
   * Observe Largest Contentful Paint (LCP)
   */
  observeLCP() {
    if (!('PerformanceObserver' in window)) return;

    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        const lcp = lastEntry.renderTime || lastEntry.loadTime;

        this.metrics.LCP = lcp;
        this.reportMetric('LCP', lcp, THRESHOLDS.LCP);
      });

      observer.observe({ type: 'largest-contentful-paint', buffered: true });
    } catch (e) {
      log.warn('LCP observation failed:', e);
    }
  }

  /**
   * Observe First Input Delay (FID)
   */
  observeFID() {
    if (!('PerformanceObserver' in window)) return;

    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          const fid = entry.processingStart - entry.startTime;
          this.metrics.FID = fid;
          this.reportMetric('FID', fid, THRESHOLDS.FID);
        });
      });

      observer.observe({ type: 'first-input', buffered: true });
    } catch (e) {
      log.warn('FID observation failed:', e);
    }
  }

  /**
   * Observe Cumulative Layout Shift (CLS)
   */
  observeCLS() {
    if (!('PerformanceObserver' in window)) return;

    try {
      let clsValue = 0;
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
          }
        }
        this.metrics.CLS = clsValue;
        this.reportMetric('CLS', clsValue, THRESHOLDS.CLS);
      });

      observer.observe({ type: 'layout-shift', buffered: true });
    } catch (e) {
      log.warn('CLS observation failed:', e);
    }
  }

  /**
   * Observe First Contentful Paint (FCP)
   */
  observeFCP() {
    if (!('PerformanceObserver' in window)) return;

    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (entry.name === 'first-contentful-paint') {
            const fcp = entry.startTime;
            this.metrics.FCP = fcp;
            this.reportMetric('FCP', fcp, THRESHOLDS.FCP);
          }
        });
      });

      observer.observe({ type: 'paint', buffered: true });
    } catch (e) {
      log.warn('FCP observation failed:', e);
    }
  }

  /**
   * Observe Time to First Byte (TTFB)
   */
  observeTTFB() {
    if (!('performance' in window)) return;

    try {
      const navEntry = performance.getEntriesByType('navigation')[0];
      if (navEntry) {
        const ttfb = navEntry.responseStart - navEntry.requestStart;
        this.metrics.TTFB = ttfb;
        this.reportMetric('TTFB', ttfb, THRESHOLDS.TTFB);
      }
    } catch (e) {
      log.warn('TTFB observation failed:', e);
    }
  }

  /**
   * Observe Interaction to Next Paint (INP)
   */
  observeINP() {
    if (!('PerformanceObserver' in window)) return;

    try {
      let maxDuration = 0;
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (entry.duration > maxDuration) {
            maxDuration = entry.duration;
            this.metrics.INP = maxDuration;
            this.reportMetric('INP', maxDuration, THRESHOLDS.INP);
          }
        });
      });

      observer.observe({
        type: 'event',
        buffered: true,
        durationThreshold: 16,
      });
    } catch (e) {
      log.warn('INP observation failed:', e);
    }
  }

  /**
   * Observe Resource Timing for optimization insights
   */
  observeResourceTiming() {
    if (!('performance' in window)) return;

    try {
      const resources = performance.getEntriesByType('resource');
      const slowResources = resources
        .filter((r) => r.duration > 1000)
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 5);

      if (slowResources.length > 0) {
        log.info('Slow resources detected:', slowResources);
      }
    } catch (e) {
      log.warn('Resource timing observation failed:', e);
    }
  }

  /**
   * Report metric with rating
   */
  reportMetric(name, value, threshold) {
    let rating = 'good';
    if (value > threshold.needsImprovement) {
      rating = 'poor';
    } else if (value > threshold.good) {
      rating = 'needs-improvement';
    }

    if (window.location.hostname === 'localhost') {
      const emoji =
        rating === 'good' ? '✅' : rating === 'needs-improvement' ? '⚠️' : '❌';
      log.info(`${emoji} ${name}: ${Math.round(value)}ms (${rating})`);
    }

    // Send to analytics if available
    if (typeof gtag !== 'undefined') {
      gtag('event', name, {
        value: Math.round(value),
        metric_rating: rating,
        event_category: 'Web Vitals',
      });
    }
  }
}

// Create singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Auto-initialize on load
if (typeof window !== 'undefined') {
  if (document.readyState === 'complete') {
    performanceMonitor.init();
  } else {
    window.addEventListener('load', () => performanceMonitor.init());
  }
}
