/**
 * Robot State Manager
 * Zentrales State Management für Robot Companion
 * @version 1.0.0
 */

import { createLogger } from "../../../core/logger.js";
import { computed, signal } from "../../../core/signals.js";

const log = createLogger("RobotStateManager");

/**
 * @typedef {Object} RobotState
 * @property {boolean} isChatOpen
 * @property {string} mood
 * @property {string} currentContext
 * @property {Object} analytics
 */

const STATE_KEYS = new Set(["isChatOpen", "mood", "currentContext", "analytics"]);

function pickKnownState(updates = {}) {
  return Object.fromEntries(Object.entries(updates).filter(([key]) => STATE_KEYS.has(key)));
}

export class RobotStateManager {
  static STORAGE_KEY = "robot-companion-state";

  constructor() {
    const initialState = Object.freeze(this._getInitialState());
    this._stateSignal = signal(initialState);

    this.signals = Object.freeze({
      state: computed(() => this._stateSignal.value),
      isChatOpen: computed(() => this._stateSignal.value.isChatOpen),
      mood: computed(() => this._stateSignal.value.mood),
      currentContext: computed(() => this._stateSignal.value.currentContext),
      analytics: computed(() => this._stateSignal.value.analytics),
    });
  }

  /**
   * Get initial state object
   * @returns {RobotState}
   * @private
   */
  _getInitialState() {
    return {
      isChatOpen: false,
      mood: "normal",
      currentContext: "default",
      analytics: {
        sessions: 0,
        interactions: 0,
        sectionsVisited: [],
        lastVisit: null,
      },
    };
  }

  /**
   * Get current state (immutable)
   * @returns {Readonly<RobotState>}
   */
  getState() {
    return Object.freeze({ ...this._stateSignal.value });
  }

  /**
   * Update state
   * @param {Partial<RobotState>} updates - State updates
   */
  setState(updates) {
    const normalizedUpdates = pickKnownState(updates);
    if (Object.keys(normalizedUpdates).length === 0) {
      return this.getState();
    }

    const currentState = this._stateSignal.peek();
    const nextState = Object.freeze({ ...currentState, ...normalizedUpdates });
    const hasChanges = Object.keys(normalizedUpdates).some(
      key => !Object.is(currentState[key], nextState[key])
    );

    if (!hasChanges) return this.getState();

    this._stateSignal.value = nextState;

    this.saveToStorage();
    log.debug("State updated:", normalizedUpdates);
    return this.getState();
  }

  /**
   * Get and apply state from localStorage if available.
   */
  loadFromStorage() {
    if (typeof localStorage === "undefined") {
      return;
    }

    try {
      const raw = localStorage.getItem(RobotStateManager.STORAGE_KEY);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        this.setState(pickKnownState(parsed));
      }
    } catch (error) {
      log.warn("Unable to parse stored robot state:", error);
    }
  }

  /**
   * Persist current robot state to localStorage.
   */
  saveToStorage() {
    if (typeof localStorage === "undefined") {
      return;
    }

    try {
      const state = this._stateSignal.peek();
      localStorage.setItem(RobotStateManager.STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      log.warn("Unable to save robot state:", error);
    }
  }

  /**
   * Track interaction
   */
  trackInteraction() {
    const currentState = this._stateSignal.peek();
    const interactions = currentState.analytics.interactions + 1;
    this.setState({
      analytics: {
        ...currentState.analytics,
        interactions,
      },
    });
  }

  /**
   * Track section visit
   * @param {string} section - Section name
   */
  trackSectionVisit(section) {
    const currentState = this._stateSignal.peek();

    if (!currentState.analytics.sectionsVisited.includes(section)) {
      this.setState({
        analytics: {
          ...currentState.analytics,
          sectionsVisited: [...currentState.analytics.sectionsVisited, section],
        },
      });
    }
  }

  /**
   * Reset state
   */
  reset() {
    const resetState = Object.freeze(this._getInitialState());
    this._stateSignal.value = resetState;
  }

  /**
   * Cleanup
   */
  destroy() {
    this.reset();
  }
}
