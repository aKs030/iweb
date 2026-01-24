/**
 * Menu Keyboard Shortcuts
 * Enhanced keyboard navigation
 */

export class MenuKeyboard {
  constructor(state, config = {}) {
    this.state = state;
    this.config = config;
    this.shortcuts = new Map();
    this.enabled = true;
  }

  init() {
    this.registerDefaultShortcuts();
    this.attachListeners();
  }

  registerDefaultShortcuts() {
    // Cmd/Ctrl + M: Toggle menu
    this.register(['Meta+m', 'Control+m'], () => {
      this.state.setOpen(!this.state.isOpen);
    });

    // Escape: Close menu
    this.register(['Escape'], () => {
      if (this.state.isOpen) {
        this.state.setOpen(false);
      }
    });

    // Cmd/Ctrl + K: Open search
    this.register(['Meta+k', 'Control+k'], () => {
      const searchTrigger = document.querySelector('.search-trigger');
      if (searchTrigger) {
        searchTrigger.click();
      }
    });
  }

  register(keys, callback) {
    if (!Array.isArray(keys)) keys = [keys];
    keys.forEach(key => {
      this.shortcuts.set(key.toLowerCase(), callback);
    });
  }

  unregister(keys) {
    if (!Array.isArray(keys)) keys = [keys];
    keys.forEach(key => {
      this.shortcuts.delete(key.toLowerCase());
    });
  }

  attachListeners() {
    this.handleKeydown = (e) => {
      if (!this.enabled) return;

      // Build key combination
      const parts = [];
      if (e.metaKey) parts.push('meta');
      if (e.ctrlKey) parts.push('control');
      if (e.altKey) parts.push('alt');
      if (e.shiftKey) parts.push('shift');
      parts.push(e.key.toLowerCase());

      const combination = parts.join('+');
      const callback = this.shortcuts.get(combination);

      if (callback) {
        e.preventDefault();
        callback(e);
      }
    };

    document.addEventListener('keydown', this.handleKeydown);
  }

  enable() {
    this.enabled = true;
  }

  disable() {
    this.enabled = false;
  }

  destroy() {
    if (this.handleKeydown) {
      document.removeEventListener('keydown', this.handleKeydown);
    }
    this.shortcuts.clear();
  }
}
