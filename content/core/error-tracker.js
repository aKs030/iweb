/**
 * Error Tracking and Reporting
 * @version 1.0.0
 */

import { createLogger } from './logger.js';

const log = createLogger('ErrorTracker');

class ErrorTracker {
  constructor() {
    this.errors = [];
    this.maxErrors = 50;
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;
    this.initialized = true;

    // Global error handler
    window.addEventListener('error', (event) => {
      this.trackError({
        type: 'error',
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error,
        timestamp: Date.now(),
      });
    });

    // Unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.trackError({
        type: 'unhandledrejection',
        message: event.reason?.message || String(event.reason),
        error: event.reason,
        timestamp: Date.now(),
      });
    });

    log.info('Error tracker initialized');
  }

  trackError(errorData) {
    // Add to local storage
    this.errors.push(errorData);
    if (this.errors.length > this.maxErrors) {
      this.errors.shift();
    }

    // Log to console in development
    if (window.location.hostname === 'localhost') {
      log.error('Tracked error:', errorData);
    }

    // Here you could send to external service like Sentry
    // this.sendToService(errorData);
  }

  getErrors() {
    return this.errors;
  }

  clearErrors() {
    this.errors = [];
  }
}

export const errorTracker = new ErrorTracker();
