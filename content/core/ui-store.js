/**
 * Minimal UI Store
 * Shared observable UI state for lightweight cross-component coordination.
 */

const initialState = {
  menuOpen: false,
  searchOpen: false,
  robotChatOpen: false,
  robotHydrated: false,
};

class UIStore {
  constructor() {
    this.state = { ...initialState };
    this.listeners = new Set();
  }

  /**
   * @returns {Readonly<typeof initialState>}
   */
  getState() {
    return Object.freeze({ ...this.state });
  }

  /**
   * @param {Partial<typeof initialState>} patch
   */
  setState(patch = {}) {
    let hasChanges = false;
    const next = { ...this.state };

    for (const [key, value] of Object.entries(patch)) {
      if (!(key in next)) continue;
      if (Object.is(next[key], value)) continue;
      next[key] = value;
      hasChanges = true;
    }

    if (!hasChanges) return this.getState();

    this.state = next;
    const snapshot = this.getState();

    this.listeners.forEach((listener) => {
      try {
        listener(snapshot);
      } catch {
        /* ignore listener errors */
      }
    });

    return snapshot;
  }

  /**
   * @param {(state: Readonly<typeof initialState>) => void} listener
   * @param {Object} [options]
   * @param {boolean} [options.emitImmediately=true]
   * @returns {() => void}
   */
  subscribe(listener, options = {}) {
    if (typeof listener !== 'function') return () => {};
    const { emitImmediately = true } = options;

    this.listeners.add(listener);
    if (emitImmediately) {
      try {
        listener(this.getState());
      } catch {
        /* ignore listener errors */
      }
    }

    return () => {
      this.listeners.delete(listener);
    };
  }

  reset() {
    this.state = { ...initialState };
    this.listeners.clear();
  }
}

export const uiStore = new UIStore();
