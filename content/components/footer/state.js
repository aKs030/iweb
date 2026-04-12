import { signal, subscribe as signalSubscribe } from '#core/signals.js';
import { waitForReadyState } from '#core/async-utils.js';

const loadedSignal = signal(false);
const expandedSignal = signal(false);

export const footerSignals = Object.freeze({
  loaded: loadedSignal,
  expanded: expandedSignal,
});

function getFooterSnapshot() {
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
  return waitForReadyState({
    getSnapshot: getFooterSnapshot,
    isReady: (snapshot) => snapshot.loaded === true,
    subscribe: (listener) => subscribeFooterState(listener),
    timeout,
    abortSignal,
    abortMessage: 'Footer readiness wait aborted',
    timeoutMessage: `Timed out waiting for footer readiness after ${timeout}ms`,
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
