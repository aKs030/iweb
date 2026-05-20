/**
 * Application Load Manager
 * Modern, UI-agnostic loading state manager.
 * - Uses reactive signals as the primary source of truth
 * - Keeps blocking orchestration (`block`/`unblock`)
 * - Does not require loader-specific DOM markup
 * @module AppLoadManager
 */

import { createLogger } from "./logger.js";
import { batch, computed, effect, signal, untracked } from "./signals.js";

const log = createLogger("AppLoadManager");

const pending = new Set();
const progressSignal = signal(0);
const messageSignal = signal("");
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

let stopAppReadyBridge = () => {};
stopAppReadyBridge = effect(() => {
  if (!loadSignals.done.value || loadSignals.blocked.value) return;

  untracked(() => {
    try {
      globalThis.dispatchEvent(new Event("app-ready"));
    } catch {
      // SSR / test environments may not have dispatchEvent
    }
    queueMicrotask(stopAppReadyBridge);
  });
});

export const AppLoadManager = (() => {
  const toPercent = value => Math.round(Math.max(0, Math.min(100, Number(value || 0) * 100)));

  return {
    /**
     * Block loading for a specific component.
     * @param {string} name
     */
    block(name) {
      const key = String(name || "").trim();
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
      const key = String(name || "").trim();
      if (!key || !pending.has(key)) return;

      pending.delete(key);
      pendingSignal.value = toPendingList();
      log.debug(`Unblocked: ${name}`);
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
        const text = String(message || "");

        batch(() => {
          progressSignal.value = pct;
          messageSignal.value = text;
        });

        if (!options.silent) {
          log.debug(`Loading state: ${pct}% - ${text}`);
        }
      } catch (err) {
        log.warn("Could not update loading state:", err);
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
  };
})();
