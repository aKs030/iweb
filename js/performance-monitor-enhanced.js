/* global gtag */
/**
 * Performance Monitor for iweb Website
 * Real-time performance tracking and optimization
 *
 * @author Optimization Team
 * @version 1.0.0
 * @date 2025-01-13
 */

class WebsitePerformanceMonitor {
  constructor() {
    this.metrics = new Map();
    this.observers = new Map();
    this.thresholds = {
      templateLoad: 500, // ms
      animationDuration: 1000, // ms
      scrollResponse: 16, // ms (60fps)
      memoryUsage: 0.8, // 80% of available memory
      largestContentfulPaint: 2500, // ms
      firstInputDelay: 100, // ms
      cumulativeLayoutShift: 0.1,
    };

    this.isEnabled = this.checkPerformanceAPISupport();

    if (this.isEnabled) {
      this.initializeMonitoring();
      console.log('🚀 Performance Monitor initialized');
    } else {
      console.warn('⚠️ Performance API not fully supported');
    }
  }

  /**
   * Check if performance monitoring APIs are supported
   */
  checkPerformanceAPISupport() {
    return !!(
      window.performance?.now &&
      window.performance?.mark &&
      window.performance?.measure
    );
  }

  /**
   * Initialize all performance monitoring
   */
  initializeMonitoring() {
    this.setupCoreWebVitals();
    this.setupCustomMetrics();
    this.setupMemoryMonitoring();
    this.setupNetworkMonitoring();
    this.setupUserInteractionTracking();

    // Start monitoring loop
    this.startMonitoringLoop();
  }

  /**
   * Setup Core Web Vitals monitoring
   */
  setupCoreWebVitals() {
    if ('PerformanceObserver' in window) {
      try {
        // Largest Contentful Paint (LCP)
        const lcpObserver = new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries();
          const lastEntry = entries[entries.length - 1];

          this.recordMetric('LCP', {
            value: lastEntry.startTime,
            rating: this.getRating('LCP', lastEntry.startTime),
            timestamp: Date.now(),
          });
        });

        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
        this.observers.set('lcp', lcpObserver);

        // First Input Delay (FID)
        const fidObserver = new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries();
          entries.forEach((entry) => {
            const fid = entry.processingStart - entry.startTime;

            this.recordMetric('FID', {
              value: fid,
              rating: this.getRating('FID', fid),
              timestamp: Date.now(),
            });
          });
        });

        fidObserver.observe({ entryTypes: ['first-input'] });
        this.observers.set('fid', fidObserver);

        // Cumulative Layout Shift (CLS)
        let clsValue = 0;
        const clsObserver = new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries();
          entries.forEach((entry) => {
            if (!entry.hadRecentInput) {
              clsValue += entry.value;
            }
          });

          this.recordMetric('CLS', {
            value: clsValue,
            rating: this.getRating('CLS', clsValue),
            timestamp: Date.now(),
          });
        });

        clsObserver.observe({ entryTypes: ['layout-shift'] });
        this.observers.set('cls', clsObserver);
      } catch (error) {
        console.warn(
          'Some PerformanceObserver features not supported:',
          error.message
        );
      }
    }
  }

  /**
   * Setup custom metrics for website-specific functionality
   */
  setupCustomMetrics() {
    // Template loading performance
    this.trackTemplateLoading();

    // Animation performance
    this.trackAnimationPerformance();

    // Scroll performance
    this.trackScrollPerformance();

    // Menu interaction performance
    this.trackMenuPerformance();
  }

  /**
   * Track template loading performance
   */
  trackTemplateLoading() {
    performance.mark('template-load-start');

    document.addEventListener('templatesLoaded', () => {
      performance.mark('template-load-end');
      performance.measure(
        'template-load',
        'template-load-start',
        'template-load-end'
      );

      const measure = performance.getEntriesByName('template-load')[0];
      this.recordMetric('templateLoad', {
        value: measure.duration,
        rating: this.getRating('templateLoad', measure.duration),
        timestamp: Date.now(),
      });

      performance.clearMarks('template-load-start');
      performance.clearMarks('template-load-end');
      performance.clearMeasures('template-load');
    });
  }

  /**
   * Track animation performance
   */
  trackAnimationPerformance() {
    let animationStart = null;

    document.addEventListener('scrollToSection', () => {
      animationStart = performance.now();
    });

    document.addEventListener('animationComplete', () => {
      if (animationStart) {
        const duration = performance.now() - animationStart;

        this.recordMetric('animationDuration', {
          value: duration,
          rating: this.getRating('animationDuration', duration),
          timestamp: Date.now(),
        });

        animationStart = null;
      }
    });
  }

  /**
   * Track scroll performance
   */
  trackScrollPerformance() {
    let scrollStart = null;
    let frameCount = 0;

    const trackScrollFrame = () => {
      if (scrollStart) {
        frameCount++;
        const elapsed = performance.now() - scrollStart;
        const fps = (frameCount / elapsed) * 1000;

        if (elapsed > 1000) {
          // Track for 1 second
          let rating;
          if (fps >= 55) {
            rating = 'good';
          } else if (fps >= 30) {
            rating = 'needs-improvement';
          } else {
            rating = 'poor';
          }

          this.recordMetric('scrollFPS', {
            value: fps,
            rating: rating,
            timestamp: Date.now(),
          });

          scrollStart = null;
          frameCount = 0;
        } else {
          requestAnimationFrame(trackScrollFrame);
        }
      }
    };

    let scrollTimeout;
    document.addEventListener(
      'scroll',
      () => {
        if (!scrollStart) {
          scrollStart = performance.now();
          frameCount = 0;
          requestAnimationFrame(trackScrollFrame);
        }

        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
          scrollStart = null;
          frameCount = 0;
        }, 150);
      },
      { passive: true }
    );
  }

  /**
   * Track menu interaction performance
   */
  trackMenuPerformance() {
    document.addEventListener('click', (event) => {
      if (
        event.target.closest('.menu-toggle') ||
        event.target.closest('.menu-item')
      ) {
        const startTime = performance.now();

        requestAnimationFrame(() => {
          const responseTime = performance.now() - startTime;

          this.recordMetric('menuResponse', {
            value: responseTime,
            rating: this.getRating('scrollResponse', responseTime),
            timestamp: Date.now(),
          });
        });
      }
    });
  }

  /**
   * Setup memory monitoring
   */
  setupMemoryMonitoring() {
    if ('memory' in performance) {
      setInterval(() => {
        const memory = performance.memory;
        const usageRatio = memory.usedJSHeapSize / memory.jsHeapSizeLimit;

        this.recordMetric('memoryUsage', {
          value: usageRatio,
          absolute: {
            used: memory.usedJSHeapSize,
            total: memory.totalJSHeapSize,
            limit: memory.jsHeapSizeLimit,
          },
          rating: this.getRating('memoryUsage', usageRatio),
          timestamp: Date.now(),
        });

        // Alert if memory usage is high
        if (usageRatio > this.thresholds.memoryUsage) {
          this.dispatchPerformanceAlert('memory', usageRatio);
        }
      }, 10000); // Check every 10 seconds
    }
  }

  /**
   * Setup network monitoring
   */
  setupNetworkMonitoring() {
    if ('PerformanceObserver' in window) {
      try {
        const networkObserver = new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries();

          entries.forEach((entry) => {
            if (entry.duration > 1000) {
              // Slow requests (>1s)
              this.recordMetric('slowRequest', {
                url: entry.name,
                duration: entry.duration,
                size: entry.transferSize || 0,
                timestamp: Date.now(),
              });
            }
          });
        });

        networkObserver.observe({ entryTypes: ['resource'] });
        this.observers.set('network', networkObserver);
      } catch (error) {
        console.warn('Network monitoring not supported:', error.message);
      }
    }
  }

  /**
   * Setup user interaction tracking
   */
  setupUserInteractionTracking() {
    const interactionTypes = ['click', 'keydown', 'touchstart'];

    interactionTypes.forEach((type) => {
      document.addEventListener(
        type,
        (event) => {
          const startTime = performance.now();

          requestAnimationFrame(() => {
            const responseTime = performance.now() - startTime;

            let rating;
            if (responseTime < 16) {
              rating = 'good';
            } else if (responseTime < 50) {
              rating = 'needs-improvement';
            } else {
              rating = 'poor';
            }

            this.recordMetric(`${type}Response`, {
              value: responseTime,
              element: event.target.tagName,
              rating: rating,
              timestamp: Date.now(),
            });
          });
        },
        { passive: true }
      );
    });
  }

  /**
   * Start the main monitoring loop
   */
  startMonitoringLoop() {
    setInterval(() => {
      this.collectBrowserMetrics();
      this.analyzePerformanceTrends();
      this.cleanupOldMetrics();
    }, 30000); // Run every 30 seconds
  }

  /**
   * Collect browser-specific metrics
   */
  collectBrowserMetrics() {
    const navigation = performance.getEntriesByType('navigation')[0];

    if (navigation) {
      this.recordMetric('pageLoad', {
        domContentLoaded:
          navigation.domContentLoadedEventEnd -
          navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        totalTime: navigation.loadEventEnd - navigation.fetchStart,
        timestamp: Date.now(),
      });
    }

    // Connection information
    if ('connection' in navigator) {
      const connection = navigator.connection;
      this.recordMetric('connection', {
        effectiveType: connection.effectiveType,
        downlink: connection.downlink,
        rtt: connection.rtt,
        saveData: connection.saveData,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Analyze performance trends
   */
  analyzePerformanceTrends() {
    const criticalMetrics = [
      'LCP',
      'FID',
      'CLS',
      'templateLoad',
      'memoryUsage',
    ];

    criticalMetrics.forEach((metricName) => {
      const metrics = this.getMetricHistory(metricName, 5); // Last 5 measurements

      if (metrics.length >= 3) {
        const trend = this.calculateTrend(metrics);

        if (trend.isWorsening && trend.severity > 0.5) {
          this.dispatchPerformanceAlert('trend', {
            metric: metricName,
            trend: trend,
            recent: metrics.slice(-3),
          });
        }
      }
    });
  }

  /**
   * Calculate performance trend
   */
  calculateTrend(metrics) {
    const values = metrics.map((m) => m.value);
    const n = values.length;

    // Simple linear regression slope
    const meanX = (n - 1) / 2;
    const meanY = values.reduce((a, b) => a + b, 0) / n;

    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < n; i++) {
      numerator += (i - meanX) * (values[i] - meanY);
      denominator += (i - meanX) ** 2;
    }

    const slope = numerator / denominator;
    const isWorsening = slope > 0; // Positive slope means increasing values (worse performance)
    const severity = Math.abs(slope) / meanY; // Relative change

    return { slope, isWorsening, severity };
  }

  /**
   * Clean up old metrics
   */
  cleanupOldMetrics() {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000; // 24 hours ago

    this.metrics.forEach((metricList, key) => {
      const filtered = metricList.filter((metric) => metric.timestamp > cutoff);
      this.metrics.set(key, filtered);
    });
  }

  /**
   * Record a performance metric
   */
  recordMetric(name, data) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const metricList = this.metrics.get(name);
    metricList.push(data);

    // Keep only last 100 measurements per metric
    if (metricList.length > 100) {
      metricList.shift();
    }

    // Send to analytics if configured
    this.sendMetricToAnalytics(name, data);
  }

  /**
   * Get metric history
   */
  getMetricHistory(name, count = 10) {
    const metrics = this.metrics.get(name) || [];
    return metrics.slice(-count);
  }

  /**
   * Get performance rating
   */
  getRating(metricName, value) {
    const thresholds = {
      LCP: { good: 2500, poor: 4000 },
      FID: { good: 100, poor: 300 },
      CLS: { good: 0.1, poor: 0.25 },
      templateLoad: { good: 500, poor: 1000 },
      animationDuration: { good: 1000, poor: 2000 },
      scrollResponse: { good: 16, poor: 50 },
      memoryUsage: { good: 0.5, poor: 0.8 },
    };

    const threshold = thresholds[metricName];
    if (!threshold) return 'unknown';

    if (value <= threshold.good) return 'good';
    if (value <= threshold.poor) return 'needs-improvement';
    return 'poor';
  }

  /**
   * Send metric to analytics
   */
  sendMetricToAnalytics(name, data) {
    try {
      if (typeof gtag === 'function') {
        gtag('event', 'performance_metric', {
          custom_parameter_1: name,
          custom_parameter_2: data.value,
          custom_parameter_3: data.rating,
        });
      }
    } catch (error) {
      // Log analytics errors in development only
      if (window.location.hostname === 'localhost') {
        console.warn('Analytics error in performance monitor:', error.message);
      }
    }
  }

  /**
   * Dispatch performance alert
   */
  dispatchPerformanceAlert(type, data) {
    const event = new CustomEvent('performanceAlert', {
      detail: { type, data, timestamp: Date.now() },
    });

    document.dispatchEvent(event);

    if (window.location.hostname === 'localhost') {
      console.warn(`🐌 Performance Alert (${type}):`, data);
    }
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary() {
    const summary = {
      coreWebVitals: {},
      customMetrics: {},
      trends: {},
      alerts: [],
    };

    // Core Web Vitals
    ['LCP', 'FID', 'CLS'].forEach((metric) => {
      const latest = this.getMetricHistory(metric, 1)[0];
      if (latest) {
        summary.coreWebVitals[metric] = {
          value: latest.value,
          rating: latest.rating,
          timestamp: latest.timestamp,
        };
      }
    });

    // Custom metrics
    ['templateLoad', 'animationDuration', 'memoryUsage'].forEach((metric) => {
      const latest = this.getMetricHistory(metric, 1)[0];
      if (latest) {
        summary.customMetrics[metric] = {
          value: latest.value,
          rating: latest.rating,
          timestamp: latest.timestamp,
        };
      }
    });

    return summary;
  }

  /**
   * Cleanup on page unload
   */
  cleanup() {
    this.observers.forEach((observer) => {
      observer.disconnect();
    });
    this.observers.clear();
    this.metrics.clear();
  }
}

// Initialize performance monitor
window.websitePerformanceMonitor = new WebsitePerformanceMonitor();

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (window.websitePerformanceMonitor) {
    window.websitePerformanceMonitor.cleanup();
  }
});

// Debug helper for development
if (window.location.hostname === 'localhost') {
  window.debugPerformance = {
    summary: () => window.websitePerformanceMonitor.getPerformanceSummary(),
    metrics: (name) => window.websitePerformanceMonitor.getMetricHistory(name),
    all: () => Object.fromEntries(window.websitePerformanceMonitor.metrics),
    alert: (type, data) =>
      window.websitePerformanceMonitor.dispatchPerformanceAlert(type, data),
  };

  console.log(
    'Debug functions: debugPerformance.summary(), debugPerformance.metrics(name), debugPerformance.all()'
  );
}
