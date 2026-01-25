/**
 * Centralized Error Handler
 * @version 1.0.0
 * @description Production-ready error handling with logging and reporting
 */

import { createLogger } from './shared-utilities.js';

const log = createLogger('ErrorHandler');

// Error severity levels
export const ErrorSeverity = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
};

// Error categories
export const ErrorCategory = {
  NETWORK: 'network',
  RENDER: 'render',
  STORAGE: 'storage',
  VALIDATION: 'validation',
  PERMISSION: 'permission',
  UNKNOWN: 'unknown',
};

/**
 * Centralized error handler
 */
class ErrorHandler {
  constructor() {
    this.errors = [];
    this.maxErrors = 50; // Keep last 50 errors
    this.listeners = new Set();
    this.isProduction = this.detectEnvironment();
  }

  /**
   * Detect if running in production
   */
  detectEnvironment() {
    try {
      return (
        window.location.hostname !== 'localhost' &&
        !window.location.hostname.includes('127.0.0.1') &&
        !window.location.search.includes('debug')
      );
    } catch {
      return true;
    }
  }

  /**
   * Handle error with context
   */
  handle(error, context = {}) {
    const errorInfo = this.normalizeError(error, context);

    // Store error
    this.storeError(errorInfo);

    // Log based on severity
    this.logError(errorInfo);

    // Notify listeners
    this.notifyListeners(errorInfo);

    // Report to analytics (if configured)
    this.reportError(errorInfo);

    return errorInfo;
  }

  /**
   * Normalize error to consistent format
   */
  normalizeError(error, context = {}) {
    const {
      severity = ErrorSeverity.MEDIUM,
      category = ErrorCategory.UNKNOWN,
      component = 'Unknown',
      action = 'Unknown',
      recoverable = true,
      metadata = {},
    } = context;

    return {
      message: error?.message || String(error),
      stack: error?.stack || new Error().stack,
      severity,
      category,
      component,
      action,
      recoverable,
      metadata,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    };
  }

  /**
   * Store error in memory
   */
  storeError(errorInfo) {
    this.errors.push(errorInfo);
    if (this.errors.length > this.maxErrors) {
      this.errors.shift();
    }
  }

  /**
   * Log error based on severity
   */
  logError(errorInfo) {
    const { severity, message, component, action } = errorInfo;

    // In production, only log critical errors
    if (this.isProduction && severity !== ErrorSeverity.CRITICAL) {
      return;
    }

    const logMessage = `[${component}] ${action}: ${message}`;

    switch (severity) {
      case ErrorSeverity.CRITICAL:
        log.error(logMessage, errorInfo);
        break;
      case ErrorSeverity.HIGH:
        log.error(logMessage, errorInfo);
        break;
      case ErrorSeverity.MEDIUM:
        log.warn(logMessage, errorInfo);
        break;
      case ErrorSeverity.LOW:
        log.debug(logMessage, errorInfo);
        break;
      default:
        log.info(logMessage, errorInfo);
    }
  }

  /**
   * Notify error listeners
   */
  notifyListeners(errorInfo) {
    this.listeners.forEach((listener) => {
      try {
        listener(errorInfo);
      } catch (err) {
        // Prevent listener errors from breaking error handling
        log.warn('Error listener failed:', err);
      }
    });
  }

  /**
   * Report error to analytics
   */
  reportError(errorInfo) {
    // Only report high/critical errors in production
    if (
      !this.isProduction ||
      (errorInfo.severity !== ErrorSeverity.HIGH &&
        errorInfo.severity !== ErrorSeverity.CRITICAL)
    ) {
      return;
    }

    try {
      // Google Analytics 4
      if (typeof gtag === 'function') {
        gtag('event', 'exception', {
          description: errorInfo.message,
          fatal: errorInfo.severity === ErrorSeverity.CRITICAL,
          component: errorInfo.component,
          category: errorInfo.category,
        });
      }
    } catch (err) {
      // Silently fail - don't break on analytics errors
      log.debug('Analytics reporting failed:', err);
    }
  }

  /**
   * Add error listener
   */
  onError(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Get recent errors
   */
  getErrors(filter = {}) {
    let filtered = [...this.errors];

    if (filter.severity) {
      filtered = filtered.filter((e) => e.severity === filter.severity);
    }

    if (filter.category) {
      filtered = filtered.filter((e) => e.category === filter.category);
    }

    if (filter.component) {
      filtered = filtered.filter((e) => e.component === filter.component);
    }

    return filtered;
  }

  /**
   * Clear stored errors
   */
  clearErrors() {
    this.errors = [];
  }

  /**
   * Get error statistics
   */
  getStats() {
    const stats = {
      total: this.errors.length,
      bySeverity: {},
      byCategory: {},
      byComponent: {},
    };

    this.errors.forEach((error) => {
      // By severity
      stats.bySeverity[error.severity] =
        (stats.bySeverity[error.severity] || 0) + 1;

      // By category
      stats.byCategory[error.category] =
        (stats.byCategory[error.category] || 0) + 1;

      // By component
      stats.byComponent[error.component] =
        (stats.byComponent[error.component] || 0) + 1;
    });

    return stats;
  }
}

// Singleton instance
const errorHandler = new ErrorHandler();

/**
 * Helper function for handling errors
 */
export function handleError(error, context = {}) {
  return errorHandler.handle(error, context);
}

/**
 * Helper for network errors
 */
export function handleNetworkError(error, context = {}) {
  return errorHandler.handle(error, {
    ...context,
    category: ErrorCategory.NETWORK,
    severity: context.severity || ErrorSeverity.MEDIUM,
  });
}

/**
 * Helper for storage errors
 */
export function handleStorageError(error, context = {}) {
  return errorHandler.handle(error, {
    ...context,
    category: ErrorCategory.STORAGE,
    severity: context.severity || ErrorSeverity.LOW,
    recoverable: true,
  });
}

/**
 * Helper for render errors
 */
export function handleRenderError(error, context = {}) {
  return errorHandler.handle(error, {
    ...context,
    category: ErrorCategory.RENDER,
    severity: context.severity || ErrorSeverity.HIGH,
  });
}

/**
 * Safe wrapper for async functions
 */
export function safeAsync(fn, context = {}) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      handleError(error, {
        ...context,
        action: context.action || fn.name || 'async operation',
      });
      return context.fallback !== undefined ? context.fallback : null;
    }
  };
}

/**
 * Safe wrapper for sync functions
 */
export function safeSync(fn, context = {}) {
  return (...args) => {
    try {
      return fn(...args);
    } catch (error) {
      handleError(error, {
        ...context,
        action: context.action || fn.name || 'sync operation',
      });
      return context.fallback !== undefined ? context.fallback : null;
    }
  };
}

// Global error handlers
if (typeof window !== 'undefined') {
  // Unhandled errors
  window.addEventListener('error', (event) => {
    errorHandler.handle(event.error || new Error(event.message), {
      severity: ErrorSeverity.HIGH,
      category: ErrorCategory.UNKNOWN,
      component: 'Global',
      action: 'Unhandled Error',
      metadata: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
    });
  });

  // Unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    errorHandler.handle(
      event.reason || new Error('Unhandled Promise Rejection'),
      {
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.UNKNOWN,
        component: 'Global',
        action: 'Unhandled Promise Rejection',
      },
    );
  });
}

export default errorHandler;
