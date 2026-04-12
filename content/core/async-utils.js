/**
 * Async Utilities - Centralized async helpers
 * @version 1.0.0
 */

// ============================================================================
// TIMING UTILITIES
// ============================================================================

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Wait until a subscribed state snapshot satisfies `isReady`.
 *
 * @template T
 * @param {{
 *   getSnapshot: () => T,
 *   isReady: (snapshot: T) => boolean,
 *   subscribe: (listener: (snapshot: T) => void) => (() => void) | (() => boolean),
 *   timeout?: number,
 *   abortSignal?: AbortSignal | null,
 *   abortMessage?: string,
 *   timeoutMessage?: string,
 * }} options
 * @returns {Promise<T>}
 */
export function waitForReadyState(options) {
  const {
    getSnapshot,
    isReady,
    subscribe,
    timeout = 0,
    abortSignal = null,
    abortMessage = 'Readiness wait aborted',
    timeoutMessage = `Timed out waiting for readiness after ${timeout}ms`,
  } = options;

  const snapshot = getSnapshot();
  if (isReady(snapshot)) {
    return Promise.resolve(snapshot);
  }

  if (abortSignal?.aborted) {
    return Promise.reject(new DOMException(abortMessage, 'AbortError'));
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    let timeoutId = null;
    let unsubscribe = () => {};

    const cleanup = () => {
      unsubscribe();
      unsubscribe = () => {};

      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      abortSignal?.removeEventListener?.('abort', handleAbort);
    };

    const resolveReady = (readySnapshot) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(readySnapshot);
    };

    const rejectWait = (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };

    const handleAbort = () => {
      rejectWait(new DOMException(abortMessage, 'AbortError'));
    };

    unsubscribe = subscribe((nextSnapshot) => {
      if (isReady(nextSnapshot)) {
        resolveReady(nextSnapshot);
      }
    });

    if (timeout > 0) {
      timeoutId = setTimeout(() => {
        rejectWait(new Error(timeoutMessage));
      }, timeout);
    }

    abortSignal?.addEventListener?.('abort', handleAbort, { once: true });
  });
}

/**
 * Debounce a synchronous function
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @param {Object} options - Debounce options
 * @param {boolean} [options.leading=false] - Execute on leading edge
 * @param {boolean} [options.trailing=true] - Execute on trailing edge
 * @returns {Function} Debounced function with cancel method
 */
export function debounce(fn, delay, options = {}) {
  const { leading = false, trailing = true } = options;
  let timeoutId = null;
  let lastCallTime = 0;

  const debounced = function (...args) {
    const now = Date.now();
    const timeSinceLastCall = now - lastCallTime;

    const execute = () => {
      lastCallTime = now;
      fn.apply(this, args);
    };

    clearTimeout(timeoutId);

    if (leading && timeSinceLastCall > delay) {
      execute();
    }

    if (trailing) {
      timeoutId = setTimeout(() => {
        const elapsed = Date.now() - lastCallTime;
        if (!leading || elapsed >= delay) {
          lastCallTime = Date.now();
          fn.apply(this, args);
        }
      }, delay);
    }
  };

  debounced.cancel = () => {
    clearTimeout(timeoutId);
    timeoutId = null;
  };

  return debounced;
}

/**
 * Throttle a function
 * @param {Function} func - Function to throttle
 * @param {number} limit - Limit in milliseconds
 * @param {Object} options - Throttle options
 * @param {boolean} [options.leading=true] - Execute on leading edge
 * @param {boolean} [options.trailing=true] - Execute on trailing edge
 * @returns {Function} Throttled function with cancel method
 */
export function throttle(func, limit = 250, options = {}) {
  const { leading = true, trailing = true } = options;
  let inThrottle = false;
  let lastArgs = null;
  let timeoutId = null;

  const throttled = function (...args) {
    if (!inThrottle) {
      if (leading) {
        func.apply(this, args);
      }
      inThrottle = true;

      timeoutId = setTimeout(() => {
        inThrottle = false;
        if (trailing && lastArgs) {
          func.apply(this, lastArgs);
          lastArgs = null;
        }
      }, limit);
    } else if (trailing) {
      lastArgs = args;
    }
  };

  throttled.cancel = () => {
    clearTimeout(timeoutId);
    inThrottle = false;
    lastArgs = null;
  };

  return throttled;
}

// ============================================================================
// SCROLL UTILITIES
// ============================================================================

/**
 * Handle same-page scroll navigation
 * @param {string} url - URL to check
 * @returns {boolean} True if navigation was handled
 */
export function handleSamePageScroll(url) {
  try {
    const parsed = new URL(url, location.origin);
    if (parsed.origin !== location.origin) return false;
    if (
      parsed.pathname === location.pathname &&
      parsed.search === location.search
    ) {
      if (!parsed.hash) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return true;
      }
    }
  } catch {
    // malformed URL
  }
  return false;
}

// ============================================================================
// IDLE SCHEDULING
// ============================================================================

/**
 * @typedef {{
 *   type: 'idle' | 'timeout' | 'none',
 *   id: number | null,
 *   cancel: () => void,
 * }} IdleTaskHandle
 */

/**
 * Schedule a callback for browser idle time with a timeout-backed fallback.
 *
 * @param {() => void} callback
 * @param {{
 *   timeout?: number,
 *   fallbackDelay?: number,
 *   requestIdleCallbackFn?: typeof globalThis.requestIdleCallback,
 *   cancelIdleCallbackFn?: typeof globalThis.cancelIdleCallback,
 *   setTimeoutFn?: typeof globalThis.setTimeout,
 *   clearTimeoutFn?: typeof globalThis.clearTimeout,
 * }} [options]
 * @returns {IdleTaskHandle}
 */
export function scheduleIdleTask(callback, options = {}) {
  const {
    timeout = 0,
    fallbackDelay = timeout,
    requestIdleCallbackFn = globalThis.requestIdleCallback?.bind(globalThis),
    cancelIdleCallbackFn = globalThis.cancelIdleCallback?.bind(globalThis),
    setTimeoutFn = globalThis.setTimeout?.bind(globalThis),
    clearTimeoutFn = globalThis.clearTimeout?.bind(globalThis),
  } = options;

  if (typeof requestIdleCallbackFn === 'function') {
    const id = requestIdleCallbackFn(
      () => {
        callback();
      },
      Number.isFinite(timeout) && timeout > 0 ? { timeout } : undefined,
    );

    return {
      type: 'idle',
      id,
      cancel() {
        if (typeof cancelIdleCallbackFn === 'function') {
          cancelIdleCallbackFn(id);
        }
      },
    };
  }

  if (typeof setTimeoutFn === 'function') {
    const id = setTimeoutFn(
      () => {
        callback();
      },
      Number.isFinite(fallbackDelay) ? fallbackDelay : 0,
    );

    return {
      type: 'timeout',
      id,
      cancel() {
        if (typeof clearTimeoutFn === 'function') {
          clearTimeoutFn(id);
        }
      },
    };
  }

  callback();
  return {
    type: 'none',
    id: null,
    cancel() {},
  };
}

/**
 * Cancel a previously scheduled idle task.
 *
 * @param {IdleTaskHandle|null|undefined} handle
 */
export function cancelIdleTask(handle) {
  handle?.cancel?.();
}
