export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

export function waitForReadyState(options) {
  const {
    getSnapshot,
    isReady,
    subscribe,
    timeout = 0,
    abortSignal = null,
    abortMessage = "Readiness wait aborted",
    timeoutMessage = `Timed out waiting for readiness after ${timeout}ms`,
  } = options;

  const snapshot = getSnapshot();
  if (isReady(snapshot)) return Promise.resolve(snapshot);
  if (abortSignal?.aborted) {
    return Promise.reject(new DOMException(abortMessage, "AbortError"));
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
      abortSignal?.removeEventListener?.("abort", handleAbort);
    };

    const resolveReady = readySnapshot => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(readySnapshot);
    };

    const rejectWait = error => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };

    const handleAbort = () => {
      rejectWait(new DOMException(abortMessage, "AbortError"));
    };

    unsubscribe = subscribe(nextSnapshot => {
      if (isReady(nextSnapshot)) resolveReady(nextSnapshot);
    });

    if (timeout > 0) {
      timeoutId = setTimeout(() => rejectWait(new Error(timeoutMessage)), timeout);
    }
    abortSignal?.addEventListener?.("abort", handleAbort, { once: true });
  });
}

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
    if (leading && timeSinceLastCall > delay) execute();

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

export function throttle(func, limit = 250, options = {}) {
  const { leading = true, trailing = true } = options;
  let inThrottle = false;
  let lastArgs = null;
  let timeoutId = null;

  const throttled = function (...args) {
    if (!inThrottle) {
      if (leading) func.apply(this, args);
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

export function handleSamePageScroll(url) {
  try {
    const parsed = new URL(url, location.origin);
    if (parsed.origin !== location.origin) return false;
    if (
      parsed.pathname === location.pathname &&
      parsed.search === location.search &&
      !parsed.hash
    ) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return true;
    }
  } catch {
    // Ignore malformed URLs.
  }
  return false;
}

export function scheduleIdleTask(callback, { timeout = 0, fallbackDelay = timeout } = {}) {
  if (globalThis.requestIdleCallback) {
    const id = requestIdleCallback(callback, timeout > 0 ? { timeout } : undefined);
    return { cancel: () => cancelIdleCallback(id) };
  }
  const id = setTimeout(callback, fallbackDelay || 0);
  return { cancel: () => clearTimeout(id) };
}

export function cancelIdleTask(handle) {
  handle?.cancel?.();
}
