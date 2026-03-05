/**
 * Application Load Manager
 * Modern, UI-agnostic loading state manager.
 * - Keeps blocking orchestration (`block`/`unblock`)
 * - Emits progress events (`loading:update`)
 * - Emits completion event (`EVENTS.LOADING_HIDE`) + global `app-ready`
 * This keeps backward compatibility while removing hard dependency on legacy
 * #app-loader DOM markup.
 * @module AppLoadManager
 */

import { createLogger } from './logger.js';
import { EVENTS, fire } from './events.js';

const log = createLogger('AppLoadManager');

export const AppLoadManager = (() => {
  const pending = new Set();
  let lastProgress = 0;
  let lastMessage = '';
  let hideScheduled = false;
  let hideCompleted = false;

  const toPercent = (value) =>
    Math.round(Math.max(0, Math.min(100, Number(value || 0) * 100)));

  return {
    /**
     * Block loading for a specific component.
     * @param {string} name
     */
    block(name) {
      if (!name) return;
      pending.add(name);
      log.debug(`Blocked: ${name}`);
    },

    /**
     * Unblock loading for a specific component.
     * @param {string} name
     */
    unblock(name) {
      if (!name) return;
      pending.delete(name);
      log.debug(`Unblocked: ${name}`);
      if (pending.size === 0) {
        fire(EVENTS.LOADING_UNBLOCKED);
      }
    },

    /**
     * Check if loading is currently blocked.
     * @returns {boolean}
     */
    isBlocked() {
      return pending.size > 0;
    },

    /**
     * Get list of pending blockers.
     * @returns {string[]}
     */
    getPending() {
      return Array.from(pending);
    },

    /**
     * Update app loading progress (state + event only).
     * @param {number} progress - Progress in range 0..1
     * @param {string} message
     * @param {{ silent?: boolean }} [options]
     */
    updateLoader(progress, message, options = {}) {
      try {
        const pct = toPercent(progress);
        lastProgress = pct;
        lastMessage = String(message || '');
        fire('loading:update', { progress: pct, message: lastMessage });
        if (!options.silent) {
          log.debug(`Loading state: ${pct}% - ${lastMessage}`);
        }
      } catch (err) {
        log.warn('Could not update loading state:', err);
      }
    },

    /**
     * Mark loading as completed and emit lifecycle events.
     * @param {number} [delay=0]
     */
    hideLoader(delay = 0) {
      if (hideCompleted || hideScheduled) return;
      hideScheduled = true;

      const run = () => {
        hideScheduled = false;
        if (hideCompleted) return;
        hideCompleted = true;
        pending.clear();
        fire(EVENTS.LOADING_HIDE);
        fire(EVENTS.LOADING_COMPLETE);
        try {
          globalThis.dispatchEvent(new Event('app-ready'));
        } catch (err) {
          log.debug('app-ready dispatch failed:', err);
        }
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
      return {
        blocked: pending.size > 0,
        pending: Array.from(pending),
        progress: lastProgress,
        message: lastMessage,
        done: hideCompleted,
      };
    },
  };
})();
