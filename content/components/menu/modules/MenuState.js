/**
 * Menu State Management
 * Handles the reactive state of the menu (open/closed, active link, title).
 */
import { createLogger } from '../../../core/logger.js';
import { uiStore } from '../../../core/ui-store.js';

const log = createLogger('MenuState');

export class MenuState {
  constructor() {
    /** @type {boolean} */
    this.isOpen = false;
    /** @type {string|null} */
    this.activeLink = null;
    /** @type {string} */
    this.currentTitle = 'menu.home';
    /** @type {string} */
    this.currentSubtitle = '';

    /** @type {Map<string, Set<Function>>} */
    this.listeners = new Map();
  }

  /**
   * Sets the menu open state.
   * @param {boolean} value
   */
  setOpen(value) {
    if (this.isOpen === value) return;
    this.isOpen = value;
    uiStore.setState({ menuOpen: value });
    this.emit('openChange', value);
  }

  /**
   * Sets the active link href.
   * @param {string|null} link
   */
  setActiveLink(link) {
    if (this.activeLink === link) return;
    this.activeLink = link;
    this.emit('activeLinkChange', link);
  }

  /**
   * Sets the current page title and subtitle.
   * @param {string} title
   * @param {string} [subtitle='']
   */
  setTitle(title, subtitle = '') {
    // Only update if changed to prevent unnecessary re-renders
    if (this.currentTitle === title && this.currentSubtitle === subtitle)
      return;

    this.currentTitle = title;
    this.currentSubtitle = subtitle;
    this.emit('titleChange', { title, subtitle });
  }

  /**
   * Subscribe to a state change event.
   * @param {string} event
   * @param {Function} callback
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
  }

  /**
   * Unsubscribe from a state change event.
   * @param {string} event
   * @param {Function} callback
   */
  off(event, callback) {
    this.listeners.get(event)?.delete(callback);
  }

  /**
   * Emit an event to listeners.
   * @param {string} event
   * @param {any} data
   * @private
   */
  emit(event, data) {
    this.listeners.get(event)?.forEach((callback) => {
      try {
        callback(data);
      } catch (err) {
        log.error(`Error in menu listener for ${event}:`, err);
      }
    });
  }

  /**
   * Resets the state to initial values.
   */
  reset() {
    this.isOpen = false;
    this.activeLink = null;
    this.currentTitle = 'menu.home';
    this.currentSubtitle = '';
    uiStore.setState({ menuOpen: false });
    this.listeners.clear();
  }
}
