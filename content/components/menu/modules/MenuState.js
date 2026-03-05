/**
 * Menu State Management
 * Handles the reactive state of the menu (open/closed, active link, title).
 */
import { createLogger } from '../../../core/logger.js';
import { computed, signal } from '../../../core/signals.js';
import { uiStore } from '../../../core/ui-store.js';

const log = createLogger('MenuState');

export class MenuState {
  constructor() {
    this._openSignal = signal(false);
    this._activeLinkSignal = signal(null);
    this._titleSignal = signal(
      Object.freeze({
        title: 'menu.home',
        subtitle: '',
      }),
    );

    this.signals = Object.freeze({
      open: computed(() => this._openSignal.value),
      activeLink: computed(() => this._activeLinkSignal.value),
      title: computed(() => this._titleSignal.value),
    });

    /** @type {Map<string, Map<Function, Function>>} */
    this._subscriptions = new Map();
  }

  get isOpen() {
    return this._openSignal.value;
  }

  get activeLink() {
    return this._activeLinkSignal.value;
  }

  get currentTitle() {
    return this._titleSignal.value.title;
  }

  get currentSubtitle() {
    return this._titleSignal.value.subtitle;
  }

  /**
   * Sets the menu open state.
   * @param {boolean} value
   */
  setOpen(value) {
    if (this.isOpen === value) return;
    this._openSignal.value = value;
    uiStore.setState({ menuOpen: value });
  }

  /**
   * Sets the active link href.
   * @param {string|null} link
   */
  setActiveLink(link) {
    if (this.activeLink === link) return;
    this._activeLinkSignal.value = link;
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

    this._titleSignal.value = Object.freeze({ title, subtitle });
  }

  /**
   * Subscribe to a state change event.
   * @param {string} event
   * @param {Function} callback
   * @returns {Function}
   */
  on(event, callback) {
    if (typeof callback !== 'function') return () => {};

    const source = this._resolveSignal(event);
    if (!source) return () => {};

    this.off(event, callback);

    let hasRun = false;
    const unsubscribe = source.subscribe((value) => {
      if (!hasRun) {
        hasRun = true;
        return;
      }

      try {
        callback(value);
      } catch (err) {
        log.error(`Error in menu listener for ${event}:`, err);
      }
    });

    if (!this._subscriptions.has(event)) {
      this._subscriptions.set(event, new Map());
    }
    this._subscriptions.get(event).set(callback, unsubscribe);

    return unsubscribe;
  }

  /**
   * Unsubscribe from a state change event.
   * @param {string} event
   * @param {Function} callback
   */
  off(event, callback) {
    const subscriptions = this._subscriptions.get(event);
    const unsubscribe = subscriptions?.get(callback);
    if (!unsubscribe) return;

    unsubscribe();
    subscriptions.delete(callback);

    if (subscriptions.size === 0) {
      this._subscriptions.delete(event);
    }
  }

  /**
   * Resets the state to initial values.
   */
  reset() {
    this._openSignal.value = false;
    this._activeLinkSignal.value = null;
    this._titleSignal.value = Object.freeze({
      title: 'menu.home',
      subtitle: '',
    });
    uiStore.setState({ menuOpen: false });
    this._subscriptions.forEach((subscriptions) => {
      subscriptions.forEach((unsubscribe) => unsubscribe());
    });
    this._subscriptions.clear();
  }

  _resolveSignal(event) {
    switch (event) {
      case 'openChange':
        return this.signals.open;
      case 'activeLinkChange':
        return this.signals.activeLink;
      case 'titleChange':
        return this.signals.title;
      default:
        return null;
    }
  }
}
