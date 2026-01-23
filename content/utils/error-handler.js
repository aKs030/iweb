/**
 * Error Handler
 * Simplified error boundary and global error handling
 */

import { createLogger } from './shared-utilities.js';

const log = createLogger('error-handler');

/**
 * Global error handler for better user experience
 */
export class ErrorHandler {
  constructor(options = {}) {
    this.options = {
      logErrors: true,
      showUserMessages: true,
      onError: null,
      ...options,
    };

    this.init();
  }

  init() {
    // Handle uncaught JavaScript errors
    window.addEventListener('error', (event) => {
      this.handleError(event.error, {
        type: 'javascript',
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    });

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError(event.reason, {
        type: 'promise',
        promise: event.promise,
      });
    });

    log.info('Error handler initialized');
  }

  handleError(error, context = {}) {
    if (this.options.logErrors) {
      log.error('Error caught:', error, context);
    }

    if (this.options.onError) {
      this.options.onError(error, context);
    }

    if (this.options.showUserMessages) {
      this.showUserMessage(error, context);
    }
  }

  showUserMessage(error, context) {
    const message = this.getUserFriendlyMessage(error, context);

    // Simple toast notification
    this.showToast(message);
  }

  getUserFriendlyMessage(error, context) {
    if (context.type === 'network' || error?.name === 'NetworkError') {
      return 'Netzwerkfehler: Bitte überprüfen Sie Ihre Internetverbindung.';
    }

    if (context.type === 'promise') {
      return 'Ein unerwarteter Fehler ist aufgetreten. Die Seite funktioniert möglicherweise nicht korrekt.';
    }

    if (error?.message?.includes('fetch')) {
      return 'Fehler beim Laden der Daten. Bitte versuchen Sie es später erneut.';
    }

    return 'Ein technischer Fehler ist aufgetreten. Bitte laden Sie die Seite neu.';
  }

  showToast(message, duration = 5000) {
    // Create toast element
    const toast = document.createElement('div');
    toast.className = 'error-toast';
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #ef4444;
      color: white;
      padding: 12px 16px;
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      max-width: 300px;
      font-size: 14px;
      line-height: 1.4;
    `;

    document.body.appendChild(toast);

    // Auto-remove after duration
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, duration);
  }

  // Wrap async functions with error handling
  wrapAsync(fn, context = {}) {
    return async (...args) => {
      try {
        return await fn(...args);
      } catch (error) {
        this.handleError(error, { ...context, type: 'async' });
        throw error;
      }
    };
  }

  // Wrap regular functions with error handling
  wrap(fn, context = {}) {
    return (...args) => {
      try {
        return fn(...args);
      } catch (error) {
        this.handleError(error, { ...context, type: 'sync' });
        throw error;
      }
    };
  }
}

/**
 * Simple debug utilities for development
 */
export class DebugUtils {
  constructor() {
    this.isDebugMode = this.checkDebugMode();
  }

  checkDebugMode() {
    return (
      new URLSearchParams(window.location.search).has('debug') ||
      localStorage.getItem('debug') === 'true' ||
      window.location.hostname === 'localhost'
    );
  }

  // Log only in debug mode
  debug(...args) {
    if (this.isDebugMode) {
      // eslint-disable-next-line no-console
      console.log('[DEBUG]', ...args);
    }
  }

  // Expose debug interface globally
  exposeGlobally() {
    if (this.isDebugMode) {
      window.__debug = {
        errorHandler,
        debugUtils: this,
        isDebugMode: this.isDebugMode,
      };
    }
  }
}

// Global instances
export const errorHandler = new ErrorHandler();
export const debugUtils = new DebugUtils();

// Initialize debug utilities
debugUtils.exposeGlobally();
