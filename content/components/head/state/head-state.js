// @ts-check
/**
 * Head State Manager
 * Centralized state management for head component initialization
 * @version 1.0.0
 */

import { createLogger } from "../../../core/logger.js";

const log = createLogger("HeadState");

/**
 * @typedef {Object} HeadStateConfig
 * @property {boolean} inlineReady - Whether head-inline.js has completed
 * @property {boolean} managerLoaded - Whether head-manager.js has loaded
 */

/**
 * Singleton state manager for Head component system
 */
class HeadStateManager {
  constructor() {
    /** @type {HeadStateConfig} */
    this.config = {
      inlineReady: false,
      managerLoaded: false,
    };

    /** @type {Promise<void>|null} */
    this.readyPromise = null;

    /** @type {Function|null} */
    this.readyResolve = null;
  }

  setInlineReady() {
    if (this.config.inlineReady) return;

    this.config.inlineReady = true;
    log.debug("Head inline ready");

    if (this.readyResolve) {
      this.readyResolve();
      this.readyResolve = null;
    }
  }

  setManagerLoaded() {
    this.config.managerLoaded = true;
    log.debug("Head manager loaded");
  }

  isManagerLoaded() {
    return this.config.managerLoaded;
  }

  waitForInlineReady(timeout = 5000) {
    if (this.config.inlineReady) {
      return Promise.resolve();
    }

    if (!this.readyPromise) {
      this.readyPromise = new Promise(resolve => {
        this.readyResolve = resolve;

        const timeoutId = setTimeout(() => {
          log.warn(`Timeout waiting for head-inline (${timeout}ms), proceeding anyway`);
          this.readyResolve = null;
          this.readyPromise = null;
          resolve();
        }, timeout);

        const originalResolve = this.readyResolve;
        this.readyResolve = () => {
          clearTimeout(timeoutId);
          this.readyPromise = null;
          originalResolve();
        };
      });
    }

    return this.readyPromise;
  }

}

export const headState = new HeadStateManager();
