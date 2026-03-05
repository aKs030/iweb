import { signal, subscribe as signalSubscribe } from './signals.js';

const loadedSignal = signal(false);
const expandedSignal = signal(false);

export const footerSignals = Object.freeze({
  loaded: loadedSignal,
  expanded: expandedSignal,
});

export function getFooterSnapshot() {
  return Object.freeze({
    loaded: footerSignals.loaded.value,
    expanded: footerSignals.expanded.value,
  });
}

export function subscribeFooterState(listener, options = {}) {
  return signalSubscribe(getFooterSnapshot, listener, options);
}

export function whenFooterReady(options = {}) {
  const { timeout = 0, abortSignal = null } = options;

  if (footerSignals.loaded.value === true) {
    return Promise.resolve(getFooterSnapshot());
  }

  if (abortSignal?.aborted) {
    return Promise.reject(
      new DOMException('Footer readiness wait aborted', 'AbortError'),
    );
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

    const resolveReady = () => {
      if (settled) return;
      settled = true;
      const snapshot = getFooterSnapshot();
      cleanup();
      resolve(snapshot);
    };

    const rejectWait = (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };

    const handleAbort = () => {
      rejectWait(
        new DOMException('Footer readiness wait aborted', 'AbortError'),
      );
    };

    unsubscribe = footerSignals.loaded.subscribe((isLoaded) => {
      if (isLoaded === true) {
        resolveReady();
      }
    });

    if (timeout > 0) {
      timeoutId = setTimeout(() => {
        rejectWait(
          new Error(
            `Timed out waiting for footer readiness after ${timeout}ms`,
          ),
        );
      }, timeout);
    }

    abortSignal?.addEventListener?.('abort', handleAbort, { once: true });
  });
}

export function setFooterLoaded(isLoaded) {
  loadedSignal.value = Boolean(isLoaded);
}

export function setFooterExpanded(isExpanded) {
  expandedSignal.value = Boolean(isExpanded);
}

export function resetFooterState() {
  loadedSignal.value = false;
  expandedSignal.value = false;
}
