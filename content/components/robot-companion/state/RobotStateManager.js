/**
 * Robot State Manager
 * Zentrales State Management für Robot Companion
 * @version 1.0.0
 */

import { ROBOT_EVENTS } from '../constants/events.js';
import { createLogger } from '/content/core/logger.js';

const log = createLogger('RobotStateManager');

/**
 * @typedef {Object} RobotState
 * @property {boolean} isInitialized
 * @property {boolean} isChatOpen
 * @property {boolean} isTyping
 * @property {boolean} isPatrolling
 * @property {boolean} isAnimating
 * @property {string} mood
 * @property {string} currentContext
 * @property {Object} analytics
 * @property {Object} position
 */

export class RobotStateManager {
  constructor() {
    /** @type {RobotState} */
    this._state = this._getInitialState();

    /** @type {Map<string, Set<Function>>} */
    this._listeners = new Map();

    /** @type {RobotState} */
    this._previousState = { ...this._state };
  }

  /**
   * Get initial state object
   * @returns {RobotState}
   * @private
   */
  _getInitialState() {
    return {
      isInitialized: false,
      isChatOpen: false,
      isTyping: false,
      isPatrolling: false,
      isAnimating: false,
      mood: 'normal',
      currentContext: 'default',
      analytics: {
        sessions: 0,
        interactions: 0,
        sectionsVisited: [],
        lastVisit: null,
      },
      position: {
        x: 0,
        y: 0,
        direction: 1,
      },
    };
  }

  /**
   * Get current state (immutable)
   * @returns {Readonly<RobotState>}
   */
  getState() {
    return Object.freeze({ ...this._state });
  }

  /**
   * Update state and notify listeners
   * @param {Partial<RobotState>} updates - State updates
   */
  setState(updates) {
    this._previousState = { ...this._state };
    this._state = { ...this._state, ...updates };

    // Emit state change event
    this._emit(ROBOT_EVENTS.STATE_CHANGED, {
      current: this.getState(),
      previous: this._previousState,
      changes: updates,
    });

    // Emit specific events for important state changes
    if (updates.isChatOpen !== undefined) {
      this._emit(
        updates.isChatOpen
          ? ROBOT_EVENTS.CHAT_OPENED
          : ROBOT_EVENTS.CHAT_CLOSED,
        { state: this.getState() },
      );
    }

    if (
      updates.mood !== undefined &&
      updates.mood !== this._previousState.mood
    ) {
      this._emit(ROBOT_EVENTS.MOOD_CHANGED, {
        mood: updates.mood,
        previousMood: this._previousState.mood,
      });
    }

    log.debug('State updated:', updates);
  }

  /**
   * Subscribe to state changes
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  subscribe(event, callback) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }

    this._listeners.get(event).add(callback);

    // Return unsubscribe function
    return () => {
      const listeners = this._listeners.get(event);
      if (listeners) {
        listeners.delete(callback);
      }
    };
  }

  /**
   * Emit event to all listeners
   * @param {string} event - Event name
   * @param {any} data - Event data
   * @private
   */
  _emit(event, data) {
    const listeners = this._listeners.get(event);
    if (listeners) {
      listeners.forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          log.error(`Error in listener for ${event}:`, error);
        }
      });
    }

    // Also emit as DOM event for external listeners
    if (typeof document !== 'undefined') {
      document.dispatchEvent(
        new CustomEvent(event, {
          detail: data,
          bubbles: true,
        }),
      );
    }
  }

  /**
   * Load state from localStorage
   */
  loadFromStorage() {
    try {
      const sessions = Number.parseInt(
        localStorage.getItem('robot-sessions') || '0',
        10,
      );
      const interactions = Number.parseInt(
        localStorage.getItem('robot-interactions') || '0',
        10,
      );
      const lastVisit = localStorage.getItem('robot-last-visit');

      this.setState({
        analytics: {
          ...this._state.analytics,
          sessions: sessions + 1,
          interactions,
          lastVisit,
        },
      });

      // Save updated session count
      localStorage.setItem('robot-sessions', String(sessions + 1));
      localStorage.setItem('robot-last-visit', new Date().toISOString());
    } catch (error) {
      log.warn('Failed to load state from storage:', error);
    }
  }

  /**
   * Save state to localStorage
   */
  saveToStorage() {
    try {
      localStorage.setItem(
        'robot-sessions',
        String(this._state.analytics.sessions),
      );
      localStorage.setItem(
        'robot-interactions',
        String(this._state.analytics.interactions),
      );
      localStorage.setItem(
        'robot-last-visit',
        this._state.analytics.lastVisit || new Date().toISOString(),
      );
    } catch (error) {
      log.warn('Failed to save state to storage:', error);
    }
  }

  /**
   * Track interaction
   */
  trackInteraction() {
    const interactions = this._state.analytics.interactions + 1;
    this.setState({
      analytics: {
        ...this._state.analytics,
        interactions,
      },
    });
    this.saveToStorage();
  }

  /**
   * Track section visit
   * @param {string} section - Section name
   */
  trackSectionVisit(section) {
    if (!this._state.analytics.sectionsVisited.includes(section)) {
      this.setState({
        analytics: {
          ...this._state.analytics,
          sectionsVisited: [...this._state.analytics.sectionsVisited, section],
        },
      });
    }
  }

  /**
   * Reset state
   */
  reset() {
    this._state = this._getInitialState();
  }

  /**
   * Cleanup
   */
  destroy() {
    this._listeners.clear();
    this.saveToStorage();
  }
}
