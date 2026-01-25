/**
 * Performance Tracker Module
 * Tracks and logs performance metrics
 * @version 1.0.0
 */

import { createLogger } from './shared-utilities.js';

const log = createLogger('PerformanceTracker');

export class PerformanceTracker {
  constructor() {
    this.marks = {
      start: performance.now(),
    };
  }

  mark(name) {
    this.marks[name] = performance.now();
  }

  getDuration(from, to = 'now') {
    const start = this.marks[from] || this.marks.start;
    const end = to === 'now' ? performance.now() : this.marks[to];
    return Math.round(end - start);
  }

  logMetrics() {
    const metrics = {
      domReady: this.getDuration('start', 'domReady'),
      modulesReady: this.getDuration('start', 'modulesReady'),
      windowLoaded: this.getDuration('start', 'windowLoaded'),
    };

    log.info('Performance Metrics:', metrics);

    // Send to analytics if available
    if (typeof gtag === 'function') {
      try {
        gtag('event', 'timing_complete', {
          name: 'app_load',
          value: metrics.windowLoaded,
          event_category: 'Performance',
        });
      } catch {
        /* ignore */
      }
    }

    return metrics;
  }

  // Web Vitals tracking
  trackWebVitals() {
    if (!('PerformanceObserver' in window)) return;

    try {
      // Largest Contentful Paint
      const lcpObserver = new window.PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        log.info(
          'LCP:',
          Math.round(lastEntry.renderTime || lastEntry.loadTime),
        );
      });
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

      // First Input Delay
      const fidObserver = new window.PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          log.info('FID:', Math.round(entry.processingStart - entry.startTime));
        });
      });
      fidObserver.observe({ entryTypes: ['first-input'] });

      // Cumulative Layout Shift
      let clsValue = 0;
      const clsObserver = new window.PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
          }
        }
        log.info('CLS:', clsValue.toFixed(3));
      });
      clsObserver.observe({ entryTypes: ['layout-shift'] });
    } catch (error) {
      log.debug('Web Vitals tracking failed:', error);
    }
  }
}
