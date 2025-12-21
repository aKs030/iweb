/**
 * App Load Manager
 * Centralized reference counting for application loading state.
 * Modules can block the loading screen from hiding until they are ready.
 */

import {createLogger} from './shared-utilities.js'

const log = createLogger('AppLoadManager')

class AppLoadManager {
  constructor() {
    this._blockers = new Set()
    this._listeners = new Set()
  }

  /**
   * Register a blocking process.
   * @param {string} id - Unique identifier for the process
   */
  block(id) {
    if (!id) return
    if (!this._blockers.has(id)) {
      this._blockers.add(id)
      log.debug(`Blocked by: ${id} (Total: ${this._blockers.size})`)
      this._notify()
    }
  }

  /**
   * Release a blocking process.
   * @param {string} id - Unique identifier for the process
   */
  unblock(id) {
    if (this._blockers.has(id)) {
      this._blockers.delete(id)
      log.debug(`Released: ${id} (Remaining: ${this._blockers.size})`)
      this._notify()
    }
  }

  /**
   * Check if application load is currently blocked.
   * @returns {boolean}
   */
  isBlocked() {
    return this._blockers.size > 0
  }

  /**
   * Get list of current blockers.
   * @returns {string[]}
   */
  getPending() {
    return Array.from(this._blockers)
  }

  /**
   * Add a listener for state changes.
   * @param {Function} callback
   * @returns {Function} unsubscribe function
   */
  subscribe(callback) {
    this._listeners.add(callback)
    return () => this._listeners.delete(callback)
  }

  _notify() {
    for (const listener of this._listeners) {
      try {
        listener(this.isBlocked())
      } catch (e) {
        log.warn('Listener error:', e)
      }
    }
  }
}

// Singleton instance
const appLoadManager = new AppLoadManager()

// Export singleton
export default appLoadManager
export {AppLoadManager} // Export class for testing if needed
