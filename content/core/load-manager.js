/**
 * Application Load Manager
 * Modern, UI-agnostic loading state manager.
 * - Uses reactive signals as the primary source of truth
 * - Keeps blocking orchestration (`block`/`unblock`)
 * - Exposes `whenAppReady()` for async coordination without DOM events
 * - Does not require loader-specific DOM markup
 * @module AppLoadManager
 */

import { createLogger } from './logger.js';
import {
  batch,
  computed,
  effect,
  signal,
  subscribe as signalSubscribe,
  untracked,
} from './signals.js';

const log = createLogger('AppLoadManager');

const pending = new Set();
const progressSignal = signal(0);
const messageSignal = signal('');
const pendingSignal = signal(Object.freeze([]));
const hideScheduledSignal = signal(false);
const hideCompletedSignal = signal(false);

export const loadSignals = Object.freeze({
  progress: progressSignal,
  message: messageSignal,
  pending: pendingSignal,
  hideScheduled: hideScheduledSignal,
  done: hideCompletedSignal,
  blocked: computed(() => pendingSignal.value.length > 0),
});

const toPendingList = () => Object.freeze(Array.from(pending));

function getLoadSnapshot() {
  const pendingList = loadSignals.pending.value;

  return Object.freeze({
    blocked: pendingList.length > 0,
    pending: [...pendingList],
    progress: loadSignals.progress.value,
    message: loadSignals.message.value,
    hideScheduled: loadSignals.hideScheduled.value,
    done: loadSignals.done.value,
  });
}

export function subscribeLoadState(listener, options = {}) {
  return signalSubscribe(getLoadSnapshot, listener, options);
}

export function whenAppReady(options = {}) {
  const { timeout = 0, abortSignal = null } = options;
  const snapshot = getLoadSnapshot();

  if (!snapshot.blocked && snapshot.done) {
    return Promise.resolve(snapshot);
  }

  if (abortSignal?.aborted) {
    return Promise.reject(
      new DOMException('App readiness wait aborted', 'AbortError'),
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
      const readySnapshot = getLoadSnapshot();
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
      rejectWait(new DOMException('App readiness wait aborted', 'AbortError'));
    };

    unsubscribe = subscribeLoadState((state) => {
      if (!state.blocked && state.done) {
        resolveReady();
      }
    });

    if (timeout > 0) {
      timeoutId = setTimeout(() => {
        rejectWait(
          new Error(`Timed out waiting for app readiness after ${timeout}ms`),
        );
      }, timeout);
    }

    abortSignal?.addEventListener?.('abort', handleAbort, { once: true });
  });
}

// ---------------------------------------------------------------------------
// Legacy DOM event bridge — fires `app-ready` on globalThis exactly once
// when loading completes, so external consumers (GTM, analytics, third-party
// scripts) keep working without coupling to our signal system.
// ---------------------------------------------------------------------------
effect(() => {
  if (!loadSignals.done.value || loadSignals.blocked.value) return;

  untracked(() => {
    try {
      globalThis.dispatchEvent(new Event('app-ready'));
    } catch {
      // SSR / test environments may not have dispatchEvent
    }
  });

  // Return a dispose callback — effect auto-disposes after first emission
  // because `done` transitions from false→true exactly once per app lifecycle.
});

export const AppLoadManager = (() => {
  const toPercent = (value) =>
    Math.round(Math.max(0, Math.min(100, Number(value || 0) * 100)));

  return {
    /**
     * Block loading for a specific component.
     * @param {string} name
     */
    block(name) {
      const key = String(name || '').trim();
      if (!key || pending.has(key)) return;
      pending.add(key);
      pendingSignal.value = toPendingList();
      log.debug(`Blocked: ${name}`);
    },

    /**
     * Unblock loading for a specific component.
     * @param {string} name
     */
    unblock(name) {
      const key = String(name || '').trim();
      if (!key || !pending.has(key)) return;

      pending.delete(key);
      pendingSignal.value = toPendingList();
      log.debug(`Unblocked: ${name}`);
    },

    /**
     * Check if loading is currently blocked.
     * @returns {boolean}
     */
    isBlocked() {
      return loadSignals.pending.value.length > 0;
    },

    /**
     * Get list of pending blockers.
     * @returns {string[]}
     */
    getPending() {
      return [...loadSignals.pending.value];
    },

    /**
     * Update app loading progress.
     * @param {number} progress - Progress in range 0..1
     * @param {string} message
     * @param {{ silent?: boolean }} [options]
     */
    updateLoader(progress, message, options = {}) {
      try {
        const pct = toPercent(progress);
        const text = String(message || '');

        batch(() => {
          progressSignal.value = pct;
          messageSignal.value = text;
        });

        if (!options.silent) {
          log.debug(`Loading state: ${pct}% - ${text}`);
        }
      } catch (err) {
        log.warn('Could not update loading state:', err);
      }
    },

    /**
     * Mark loading as completed.
     * @param {number} [delay=0]
     */
    hideLoader(delay = 0) {
      if (loadSignals.done.value || loadSignals.hideScheduled.value) return;
      hideScheduledSignal.value = true;

      const run = () => {
        if (loadSignals.done.value) {
          hideScheduledSignal.value = false;
          return;
        }

        batch(() => {
          hideScheduledSignal.value = false;
          hideCompletedSignal.value = true;
          pending.clear();
          pendingSignal.value = Object.freeze([]);
        });
      };

      if (delay > 0) {
        setTimeout(run, delay);
      } else {
        run();
      }
    },

    /**
     * Read-only snapshot for debugging and telemetry.
     * @returns {{ blocked: boolean, pending: string[], progress: number, message: string, done: boolean }}
     */
    getSnapshot() {
      return getLoadSnapshot();
    },
  };
})();
