/**
 * Analytics Error Tracking Integration
 * @version 1.0.0
 * Integrates with error-tracker.js and sends to analytics services
 */

import { createLogger } from './logger.js';
import { errorTracker as _errorTracker } from './error-tracker.js';

const log = createLogger('AnalyticsErrorTracker');

/**
 * Analytics Error Tracker Configuration
 */
const CONFIG = {
  // Enable/disable tracking
  enabled: true,

  // Sample rate (0-1, 1 = track all errors)
  sampleRate: 1.0,

  // Maximum errors to send per session
  maxErrorsPerSession: 50,

  // Debounce time for duplicate errors (ms)
  debounceTime: 5000,

  // Services to send errors to
  services: {
    googleAnalytics: true,
    sentry: false, // Set to true when Sentry is configured
    custom: false, // Set to true for custom endpoint
  },
};

/**
 * Analytics Error Tracker Class
 */
class AnalyticsErrorTracker {
  constructor() {
    this.errorCount = 0;
    this.lastErrors = new Map();
    this.initialized = false;
  }

  /**
   * Initialize analytics error tracking
   */
  init() {
    if (this.initialized) return;
    this.initialized = true;

    // Listen to error tracker events
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => {
        this.trackError({
          type: 'error',
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          stack: event.error?.stack,
        });
      });

      window.addEventListener('unhandledrejection', (event) => {
        this.trackError({
          type: 'unhandledrejection',
          message: event.reason?.message || String(event.reason),
          stack: event.reason?.stack,
        });
      });
    }

    log.info('Analytics error tracking initialized');
  }

  /**
   * Track error to analytics services
   * @param {Object} errorData - Error data
   */
  trackError(errorData) {
    if (!CONFIG.enabled) return;

    // Check sample rate
    if (Math.random() > CONFIG.sampleRate) return;

    // Check max errors per session
    if (this.errorCount >= CONFIG.maxErrorsPerSession) {
      log.warn('Max errors per session reached, skipping tracking');
      return;
    }

    // Check for duplicate errors (debounce)
    const errorKey = `${errorData.type}:${errorData.message}`;
    const lastTime = this.lastErrors.get(errorKey);
    const now = Date.now();

    if (lastTime && now - lastTime < CONFIG.debounceTime) {
      log.debug('Duplicate error within debounce time, skipping');
      return;
    }

    this.lastErrors.set(errorKey, now);
    this.errorCount++;

    // Send to configured services
    if (CONFIG.services.googleAnalytics) {
      this.sendToGoogleAnalytics(errorData);
    }

    if (CONFIG.services.sentry) {
      this.sendToSentry(errorData);
    }

    if (CONFIG.services.custom) {
      this.sendToCustomEndpoint(errorData);
    }
  }

  /**
   * Send error to Google Analytics
   * @param {Object} errorData - Error data
   */
  sendToGoogleAnalytics(errorData) {
    if (typeof gtag === 'undefined') {
      log.debug('Google Analytics not available');
      return;
    }

    try {
      gtag('event', 'exception', {
        description: `${errorData.type}: ${errorData.message}`,
        fatal: errorData.type === 'error',
        error_type: errorData.type,
        error_message: errorData.message,
        error_filename: errorData.filename || 'unknown',
        error_line: errorData.lineno || 0,
      });

      log.debug('Error sent to Google Analytics');
    } catch (error) {
      log.warn('Failed to send error to Google Analytics:', error);
    }
  }

  /**
   * Send error to Sentry
   * @param {Object} errorData - Error data
   */
  sendToSentry(errorData) {
    if (typeof window.Sentry === 'undefined') {
      log.debug('Sentry not available');
      return;
    }

    try {
      window.Sentry.captureException(new Error(errorData.message), {
        level: errorData.type === 'error' ? 'error' : 'warning',
        tags: {
          error_type: errorData.type,
        },
        extra: {
          filename: errorData.filename,
          lineno: errorData.lineno,
          colno: errorData.colno,
          stack: errorData.stack,
        },
      });

      log.debug('Error sent to Sentry');
    } catch (error) {
      log.warn('Failed to send error to Sentry:', error);
    }
  }

  /**
   * Send error to custom endpoint
   * @param {Object} errorData - Error data
   */
  async sendToCustomEndpoint(errorData) {
    try {
      const response = await fetch('/api/errors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...errorData,
          timestamp: Date.now(),
          userAgent: navigator.userAgent,
          url: window.location.href,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      log.debug('Error sent to custom endpoint');
    } catch (error) {
      log.warn('Failed to send error to custom endpoint:', error);
    }
  }

  /**
   * Get error statistics
   * @returns {Object} Error statistics
   */
  getStats() {
    return {
      errorCount: this.errorCount,
      uniqueErrors: this.lastErrors.size,
      maxErrors: CONFIG.maxErrorsPerSession,
      sampleRate: CONFIG.sampleRate,
    };
  }

  /**
   * Reset error tracking
   */
  reset() {
    this.errorCount = 0;
    this.lastErrors.clear();
    log.info('Error tracking reset');
  }
}

// Export singleton instance
export const analyticsErrorTracker = new AnalyticsErrorTracker();

// Auto-initialize if in browser
if (typeof window !== 'undefined') {
  analyticsErrorTracker.init();
}
