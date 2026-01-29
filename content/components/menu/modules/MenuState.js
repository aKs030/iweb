// @ts-check
/**
 * Menu State Management
 */

export class MenuState {
  constructor() {
    this.isOpen = false;
    /** @type {string|null} */
    this.activeLink = null;
    this.currentTitle = 'Startseite';
    this.currentSubtitle = '';
    /** @type {Map<string, Set<Function>>} */
    this.listeners = new Map();
  }

  /**
   * @param {boolean} value
   */
  setOpen(value) {
    if (this.isOpen === value) return;
    this.isOpen = value;
    this.emit('openChange', value);
  }

  /**
   * @param {string|null} link
   */
  setActiveLink(link) {
    if (this.activeLink === link) return;
    this.activeLink = link;
    this.emit('activeLinkChange', link);
  }

  /**
   * @param {string} title
   * @param {string} [subtitle]
   */
  setTitle(title, subtitle = '') {
    if (this.currentTitle === title && this.currentSubtitle === subtitle)
      return;
    this.currentTitle = title;
    this.currentSubtitle = subtitle;
    this.emit('titleChange', { title, subtitle });
  }

  /**
   * @param {string} event
   * @param {Function} callback
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)?.add(callback);
  }

  /**
   * @param {string} event
   * @param {Function} callback
   */
  off(event, callback) {
    this.listeners.get(event)?.delete(callback);
  }

  /**
   * @param {string} event
   * @param {any} data
   */
  emit(event, data) {
    this.listeners.get(event)?.forEach((callback) => callback(data));
  }

  reset() {
    this.isOpen = false;
    this.activeLink = null;
    this.currentTitle = 'Startseite';
    this.currentSubtitle = '';
    this.listeners.clear();
  }
}
