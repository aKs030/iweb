import { signal, batch } from './signals.js';
// ---------------------------------------------------------------------------
// Reactive Signals — fine-grained, subscribable per-property state
// ---------------------------------------------------------------------------
export const menuOpen = signal(false);
export const searchOpen = signal(false);
export const robotChatOpen = signal(false);
export const robotHydrated = signal(false);
/**
 * All UI signals collected for convenience.
 * Components can import individual signals for fine-grained reactivity.
 */
export const uiSignals = { menuOpen, searchOpen, robotChatOpen, robotHydrated };
const _signalMap = {
  menuOpen,
  searchOpen,
  robotChatOpen,
  robotHydrated,
};
class UIStore {
  listeners = new Set();
  getState() {
    return Object.freeze({
      menuOpen: menuOpen.value,
      searchOpen: searchOpen.value,
      robotChatOpen: robotChatOpen.value,
      robotHydrated: robotHydrated.value,
    });
  }
  setState(patch = {}) {
    let hasChanges = false;
    batch(() => {
      Object.keys(patch).forEach((key) => {
        const value = patch[key];
        if (value === undefined) return;
        const sig = _signalMap[key];
        if (!sig) return;
        if (Object.is(sig.peek(), value)) return;
        sig.value = value;
        hasChanges = true;
      });
    });
    if (!hasChanges) return this.getState();
    const snapshot = this.getState();
    this.listeners.forEach((listener) => {
      try {
        listener(snapshot);
      } catch {
        // keep store resilient against listener errors
      }
    });
    return snapshot;
  }
  subscribe(listener, options = {}) {
    if (typeof listener !== 'function') return () => {};
    const { emitImmediately = true } = options;
    this.listeners.add(listener);
    if (emitImmediately) {
      try {
        listener(this.getState());
      } catch {
        // keep store resilient against listener errors
      }
    }
    return () => {
      this.listeners.delete(listener);
    };
  }
  reset() {
    batch(() => {
      menuOpen.value = false;
      searchOpen.value = false;
      robotChatOpen.value = false;
      robotHydrated.value = false;
    });
    this.listeners.clear();
  }
}
export const uiStore = new UIStore();
