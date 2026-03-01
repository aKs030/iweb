import { signal, batch } from './signals.js';

// ---------------------------------------------------------------------------
// Reactive Signals — fine-grained, subscribable per-property state
// ---------------------------------------------------------------------------

/** @type {import('./signals.js').Signal<boolean>} */
export const menuOpen = signal(false);
/** @type {import('./signals.js').Signal<boolean>} */
export const searchOpen = signal(false);
/** @type {import('./signals.js').Signal<boolean>} */
export const robotChatOpen = signal(false);
/** @type {import('./signals.js').Signal<boolean>} */
export const robotHydrated = signal(false);

/**
 * All UI signals collected for convenience.
 * Components can import individual signals for fine-grained reactivity
 * instead of subscribing to the full store snapshot.
 */
export const uiSignals = { menuOpen, searchOpen, robotChatOpen, robotHydrated };

// ---------------------------------------------------------------------------
// Map signal names → signal instances (internal helper)
// ---------------------------------------------------------------------------

/** @type {Record<string, import('./signals.js').Signal<boolean>>} */
const _signalMap = {
  menuOpen,
  searchOpen,
  robotChatOpen,
  robotHydrated,
};

// ---------------------------------------------------------------------------
// UIStore — backwards-compatible façade backed by Signals
// ---------------------------------------------------------------------------

class UIStore {
  /** @type {Set<(state: Readonly<Record<string, boolean>>) => void>} */
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
