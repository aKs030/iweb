/**
 * Menu Persistence
 * Save and restore menu state
 */

export class MenuPersistence {
  constructor(state, config = {}) {
    this.state = state;
    this.config = config;
    this.enabled = config.ENABLE_PERSISTENCE || false;
    this.storageKey = 'menu-state';
  }

  init() {
    if (!this.enabled || !this.isStorageAvailable()) return;

    // Restore state on init
    this.restore();

    // Save state on changes
    this.state.on('openChange', () => this.save());
    this.state.on('titleChange', () => this.save());
  }

  save() {
    try {
      const state = {
        isOpen: this.state.isOpen,
        currentTitle: this.state.currentTitle,
        currentSubtitle: this.state.currentSubtitle,
        timestamp: Date.now(),
      };
      localStorage.setItem(this.storageKey, JSON.stringify(state));
    } catch (error) {
      console.warn('[Menu Persistence] Save failed:', error);
    }
  }

  restore() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (!saved) return;

      const state = JSON.parse(saved);
      
      // Check if state is not too old (24 hours)
      const maxAge = 24 * 60 * 60 * 1000;
      if (Date.now() - state.timestamp > maxAge) {
        this.clear();
        return;
      }

      // Restore state
      if (state.isOpen !== undefined) {
        this.state.setOpen(state.isOpen);
      }
      if (state.currentTitle) {
        this.state.setTitle(state.currentTitle, state.currentSubtitle || '');
      }
    } catch (error) {
      console.warn('[Menu Persistence] Restore failed:', error);
      this.clear();
    }
  }

  clear() {
    try {
      localStorage.removeItem(this.storageKey);
    } catch (error) {
      console.warn('[Menu Persistence] Clear failed:', error);
    }
  }

  isStorageAvailable() {
    try {
      const test = '__storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch (e) {
      return false;
    }
  }

  destroy() {
    // Optional: clear on destroy
    // this.clear();
  }
}
