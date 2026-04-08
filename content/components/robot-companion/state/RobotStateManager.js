/**
 * Robot State Manager
 * Zentrales State Management für Robot Companion
 * @version 1.0.0
 */

import { createLogger } from '#core/logger.js';
import {
  computed,
  signal,
  subscribe as signalSubscribe,
} from '#core/signals.js';

const log = createLogger('RobotStateManager');

/**
 * @typedef {Object} RobotState
 * @property {boolean} isInitialized
 * @property {boolean} isChatOpen
 * @property {boolean} isTyping
 * @property {boolean} isResponding
 * @property {boolean} isPatrolling
 * @property {boolean} isAnimating
 * @property {string} mood
 * @property {string} currentContext
 * @property {string|null} lastGreetedContext
 * @property {Object} analytics
 * @property {Object} position
 */

export class RobotStateManager {
  static STORAGE_KEY = 'robot-companion-state';

  constructor() {
    const initialState = Object.freeze(this._getInitialState());
    this._stateSignal = signal(initialState);

    this.signals = Object.freeze({
      state: computed(() => this._stateSignal.value),
      isChatOpen: computed(() => this._stateSignal.value.isChatOpen),
      isTyping: computed(() => this._stateSignal.value.isTyping),
      isResponding: computed(() => this._stateSignal.value.isResponding),
      mood: computed(() => this._stateSignal.value.mood),
      currentContext: computed(() => this._stateSignal.value.currentContext),
      lastGreetedContext: computed(
        () => this._stateSignal.value.lastGreetedContext,
      ),
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
      isInitialized: false,
      isChatOpen: false,
      isTyping: false,
      isResponding: false,
      isPatrolling: false,
      isAnimating: false,
      mood: 'normal',
      currentContext: 'default',
      lastGreetedContext: null,
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
    return Object.freeze({ ...this._stateSignal.value });
  }

  /**
   * Read current state without cloning for hot paths and lightweight getters.
   * @returns {Readonly<RobotState>}
   */
  peekState() {
    return this._stateSignal.peek();
  }

  /**
   * Update state
   * @param {Partial<RobotState>} updates - State updates
   */
  setState(updates) {
    const currentState = this._stateSignal.peek();
    const nextState = Object.freeze({ ...currentState, ...updates });
    const hasChanges = Object.keys(updates || {}).some(
      (key) => !Object.is(currentState[key], nextState[key]),
    );

    if (!hasChanges) return this.getState();

    this._stateSignal.value = nextState;

    this.saveToStorage();
    log.debug('State updated:', updates);
    return this.getState();
  }

  /**
   * Get and apply state from localStorage if available.
   */
  loadFromStorage() {
    if (typeof localStorage === 'undefined') {
      return;
    }

    try {
      const raw = localStorage.getItem(RobotStateManager.STORAGE_KEY);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        this.setState(parsed);
      }
    } catch (error) {
      log.warn('Unable to parse stored robot state:', error);
    }
  }

  /**
   * Persist current robot state to localStorage.
   */
  saveToStorage() {
    if (typeof localStorage === 'undefined') {
      return;
    }

    try {
      const state = this._stateSignal.peek();
      localStorage.setItem(
        RobotStateManager.STORAGE_KEY,
        JSON.stringify(state),
      );
    } catch (error) {
      log.warn('Unable to save robot state:', error);
    }
  }

  /**
   * Subscribe to a selected slice of state using signals.
   * @template T
   * @param {(state: Readonly<RobotState>) => T} selector
   * @param {(value: T) => void} listener
   * @param {{ emitImmediately?: boolean }} [options]
   * @returns {() => void}
   */
  select(selector, listener, options = {}) {
    if (typeof selector !== 'function') return () => {};

    return signalSubscribe(
      () => selector(this._stateSignal.value),
      listener,
      options,
    );
  }

  /**
   * Initialize per-session analytics state (no local persistence).
   */
  initializeSessionState() {
    const now = new Date().toISOString();
    const currentSessions = Number.parseInt(
      String(this._stateSignal.peek().analytics.sessions || 0),
      10,
    );

    this.setState({
      analytics: {
        ...this._stateSignal.peek().analytics,
        sessions: Number.isFinite(currentSessions) ? currentSessions + 1 : 1,
        lastVisit: now,
      },
    });
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
