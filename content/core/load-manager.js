/**
 * Application Load Manager
 * Centralizes loading state management and blocking mechanisms.
 * @module AppLoadManager
 */

import { createLogger } from './logger.js';
import { EVENTS, fire } from './events.js';

const log = createLogger('AppLoadManager');

export const AppLoadManager = (() => {
  const pending = new Set();

  return {
    /**
     * Block loading for a specific component
     * @param {string} name - Component name
     */
    block(name) {
      if (!name) return;
      pending.add(name);
      log.debug(`Blocked: ${name}`);
    },

    /**
     * Unblock loading for a specific component
     * @param {string} name - Component name
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
     * Check if loading is currently blocked
     * @returns {boolean}
     */
    isBlocked() {
      return pending.size > 0;
    },

    /**
     * Get list of pending blockers
     * @returns {string[]}
     */
    getPending() {
      return Array.from(pending);
    }
  };
})();
