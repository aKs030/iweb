import { signal } from "../../core/signals.js";
import { waitForReadyState } from "../../core/utils/index.js";

const loadedSignal = signal(false);

export const footerSignals = Object.freeze({
  loaded: loadedSignal,
});

export function whenFooterReady(options = {}) {
  const { timeout = 0, abortSignal = null } = options;
  return waitForReadyState({
    getSnapshot: () => loadedSignal.value,
    isReady: Boolean,
    subscribe: listener => loadedSignal.subscribe(listener),
    timeout,
    abortSignal,
    abortMessage: "Footer readiness wait aborted",
    timeoutMessage: `Timed out waiting for footer readiness after ${timeout}ms`,
  });
}

export function setFooterLoaded(isLoaded) {
  loadedSignal.value = Boolean(isLoaded);
}

export function resetFooterState() {
  loadedSignal.value = false;
}
