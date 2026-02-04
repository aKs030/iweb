// @ts-check
/**
 * Robot Companion Web Component
 * Modern Web Component wrapper for RobotCompanion
 * @version 2.0.0
 */

import { RobotCompanion } from './robot-companion.js';
import { createLogger } from '/content/core/logger.js';
import { ROBOT_EVENTS } from './constants/events.js';

const log = createLogger('RobotCompanionElement');

/**
 * Robot Companion Custom Element
 * @extends HTMLElement
 */
export class RobotCompanionElement extends HTMLElement {
  constructor() {
    super();
    /** @type {RobotCompanion|null} */
    this.robot = null;
    this.initialized = false;
  }

  async connectedCallback() {
    if (this.initialized) return;

    try {
      // Create and initialize robot instance
      this.robot = new RobotCompanion();
      await this.robot.initialize();

      this.initialized = true;
      log.info('Robot Companion initialized');

      this.dispatchEvent(
        new CustomEvent(ROBOT_EVENTS.INITIALIZED, {
          bubbles: true,
          detail: { robot: this.robot },
        }),
      );
    } catch (error) {
      log.error('Robot Companion initialization failed:', error);
      this.dispatchEvent(
        new CustomEvent(ROBOT_EVENTS.ERROR, {
          bubbles: true,
          detail: { error },
        }),
      );
    }
  }

  disconnectedCallback() {
    if (this.robot) {
      this.robot.destroy();
      this.robot = null;
    }
    this.initialized = false;
    log.info('Robot Companion destroyed');
  }

  /**
   * Get robot instance
   * @returns {RobotCompanion|null}
   */
  getRobot() {
    return this.robot;
  }

  /**
   * Toggle chat window
   * @param {boolean} [force] - Force open/close state
   */
  toggleChat(force) {
    this.robot?.toggleChat(force);
  }

  /**
   * Show bubble message
   * @param {string} text - Message text
   */
  showBubble(text) {
    this.robot?.showBubble(text);
  }

  /**
   * Get current stats
   * @returns {Object}
   */
  getStats() {
    if (!this.robot) return null;
    return {
      initialized: this.initialized,
      mood: this.robot.mood,
      analytics: this.robot.analytics,
      easterEggs: Array.from(this.robot.easterEggFound),
    };
  }
}

// Define custom element
customElements.define('robot-companion', RobotCompanionElement);
