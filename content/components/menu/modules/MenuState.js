/**
 * Menu State Management
 */

export class MenuState {
  constructor() {
    this.isOpen = false;
    this.activeLink = null;
    this.currentTitle = 'Startseite';
    this.currentSubtitle = '';
    this.listeners = new Map();
  }

  setOpen(value) {
    if (this.isOpen === value) return;
    this.isOpen = value;
    this.emit('openChange', value);
  }

  setActiveLink(link) {
    if (this.activeLink === link) return;
    this.activeLink = link;
    this.emit('activeLinkChange', link);
  }

  setTitle(title, subtitle = '') {
    if (this.currentTitle === title && this.currentSubtitle === subtitle) return;
    this.currentTitle = title;
    this.currentSubtitle = subtitle;
    this.emit('titleChange', { title, subtitle });
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
  }

  off(event, callback) {
    this.listeners.get(event)?.delete(callback);
  }

  emit(event, data) {
    this.listeners.get(event)?.forEach(callback => callback(data));
  }

  reset() {
    this.isOpen = false;
    this.activeLink = null;
    this.currentTitle = 'Startseite';
    this.currentSubtitle = '';
    this.listeners.clear();
  }
}
