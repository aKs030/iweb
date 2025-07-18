/**
 * Enhanced Error Handler for iweb-7 Website
 * Production-ready error handling and monitoring system
 *
 * @author Optimization Team
 * @version 1.0.0
 * @date 2025-01-13
 */

class WebsiteErrorHandler {
  constructor() {
    this.errors = [];
    this.maxErrors = 50;
    this.errorThreshold = 10; // Max errors per minute
    this.errorCounts = new Map();
    this.isProduction = window.location.hostname !== 'localhost';

    this.setupGlobalHandlers();
    // Performance monitoring is handled by dedicated performance-monitor-enhanced.js

    console.log('Enhanced Error Handler initialized');
  }

  /**
   * Setup global error handlers
   */
  setupGlobalHandlers() {
    // JavaScript runtime errors
    window.addEventListener('error', (event) => {
      this.handleError({
        type: 'javascript',
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack,
        timestamp: Date.now(),
        userAgent: navigator.userAgent,
      });
    });

    // Unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError({
        type: 'promise',
        message: event.reason?.message || 'Unhandled Promise Rejection',
        reason: String(event.reason),
        timestamp: Date.now(),
        userAgent: navigator.userAgent,
      });

      // Prevent the error from appearing in console
      event.preventDefault();
    });

    // Resource loading errors
    document.addEventListener(
      'error',
      (event) => {
        if (event.target !== window) {
          this.handleError({
            type: 'resource',
            message: `Failed to load resource: ${event.target.src || event.target.href}`,
            element: event.target.tagName,
            source: event.target.src || event.target.href,
            timestamp: Date.now(),
          });
        }
      },
      true
    );
  }

  /**
   * Handle and process errors
   */
  handleError(errorData) {
    // Rate limiting
    const errorKey = `${errorData.type}-${errorData.message}`;
    const now = Date.now();
    const minute = Math.floor(now / 60000);

    if (!this.errorCounts.has(minute)) {
      this.errorCounts.clear(); // Clear old minutes
      this.errorCounts.set(minute, new Map());
    }

    const minuteErrors = this.errorCounts.get(minute);
    const count = (minuteErrors.get(errorKey) || 0) + 1;
    minuteErrors.set(errorKey, count);

    if (count > this.errorThreshold) {
      return; // Skip if too many similar errors
    }

    // Add to error log
    this.errors.push(errorData);

    // Maintain maximum error count
    if (this.errors.length > this.maxErrors) {
      this.errors.shift();
    }

    // Log to console in development
    if (!this.isProduction) {
      console.group(`🚨 Error (${errorData.type})`);
      console.error(errorData.message);
      console.log('Details:', errorData);
      console.groupEnd();
    }

    // Send to analytics if available
    this.sendToAnalytics(errorData);

    // Try to recover from certain errors
    this.attemptRecovery(errorData);
  }

  /**
   * Send error data to analytics
   */
  sendToAnalytics(errorData) {
    try {
      // Google Analytics 4
      if (typeof gtag === 'function') {
        gtag('event', 'exception', {
          description: `${errorData.type}: ${errorData.message}`,
          fatal: errorData.type === 'javascript',
          custom_parameter_1: errorData.filename || 'unknown',
          custom_parameter_2: errorData.type,
        });
      }

      // Custom analytics endpoint (if configured)
      if (window.ANALYTICS_ENDPOINT) {
        fetch(window.ANALYTICS_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            event: 'error',
            data: errorData,
            url: window.location.href,
            timestamp: Date.now(),
          }),
        }).catch(() => {
          // Silently fail for analytics
        });
      }
    } catch (analyticsError) {
      // Don't let analytics errors break error handling
      console.warn('Analytics error:', analyticsError.message);
    }
  }

  /**
   * Attempt to recover from errors
   */
  attemptRecovery(errorData) {
    switch (errorData.type) {
      case 'resource':
        this.retryResourceLoad(errorData);
        break;

      case 'promise':
        this.handlePromiseError(errorData);
        break;

      case 'memory':
        this.performMemoryCleanup();
        break;

      case 'performance':
        this.optimizePerformance();
        break;
    }
  }

  /**
   * Retry loading failed resources
   */
  retryResourceLoad(errorData) {
    const { source, element } = errorData;

    if (source && element) {
      setTimeout(() => {
        const elements = document.querySelectorAll(element.toLowerCase());
        elements.forEach((el) => {
          if (el.src === source || el.href === source) {
            if (element === 'IMG') {
              el.src = source + '?retry=' + Date.now();
            } else if (element === 'SCRIPT' || element === 'LINK') {
              const newEl = el.cloneNode(true);
              if (newEl.src) newEl.src = source + '?retry=' + Date.now();
              if (newEl.href) newEl.href = source + '?retry=' + Date.now();
              el.parentNode.replaceChild(newEl, el);
            }
          }
        });
      }, 2000); // Retry after 2 seconds
    }
  }

  /**
   * Handle promise-related errors
   */
  handlePromiseError(errorData) {
    // Log the error and continue gracefully
    console.warn('Promise error handled gracefully:', errorData.message);

    // Dispatch a custom event for other parts of the app to handle
    document.dispatchEvent(
      new CustomEvent('promiseError', {
        detail: errorData,
      })
    );
  }

  /**
   * Perform memory cleanup
   */
  performMemoryCleanup() {
    console.warn('Performing memory cleanup...');

    // Clear unused timers and intervals
    for (let i = 1; i < 10000; i++) {
      clearTimeout(i);
      clearInterval(i);
    }

    // Trigger garbage collection if available
    if (window.gc) {
      window.gc();
    }

    // Dispatch cleanup event
    document.dispatchEvent(new CustomEvent('memoryCleanup'));
  }

  /**
   * Optimize performance
   */
  optimizePerformance() {
    console.warn('Optimizing performance...');

    // Reduce animation frequency
    document.documentElement.style.setProperty('--animation-duration', '0.2s');

    // Dispatch performance optimization event
    document.dispatchEvent(new CustomEvent('performanceOptimization'));
  }

  /**
   * Get error statistics
   */
  getErrorStats() {
    const stats = {
      total: this.errors.length,
      byType: {},
      recent: this.errors.filter((e) => Date.now() - e.timestamp < 300000), // Last 5 minutes
    };

    this.errors.forEach((error) => {
      stats.byType[error.type] = (stats.byType[error.type] || 0) + 1;
    });

    return stats;
  }

  /**
   * Export errors for debugging
   */
  exportErrors() {
    const errorData = {
      errors: this.errors,
      stats: this.getErrorStats(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      timestamp: Date.now(),
    };

    const blob = new Blob([JSON.stringify(errorData, null, 2)], {
      type: 'application/json',
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `error-report-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Clear all errors
   */
  clearErrors() {
    this.errors = [];
    this.errorCounts.clear();
    console.log('Error log cleared');
  }
}

// Initialize error handler
window.websiteErrorHandler = new WebsiteErrorHandler();

// Debug helper functions for development
if (window.location.hostname === 'localhost') {
  window.debugErrors = {
    stats: () => window.websiteErrorHandler.getErrorStats(),
    export: () => window.websiteErrorHandler.exportErrors(),
    clear: () => window.websiteErrorHandler.clearErrors(),
    trigger: (type) => {
      switch (type) {
        case 'js':
          throw new Error('Test JavaScript error');
        case 'promise':
          Promise.reject('Test promise rejection');
          break;
        case 'resource': {
          const img = new Image();
          img.src = 'non-existent-image.jpg';
          break;
        }
        default:
          console.log('Available test types: js, promise, resource');
      }
    },
  };

  console.log(
    'Debug functions available: debugErrors.stats(), debugErrors.export(), debugErrors.clear(), debugErrors.trigger(type)'
  );
}
