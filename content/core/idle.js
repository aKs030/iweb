/**
 * Shared idle scheduling helper with deterministic timeout fallback.
 * Consumers receive a single cancelable handle regardless of browser support.
 */

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
