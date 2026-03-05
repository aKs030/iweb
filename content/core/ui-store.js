import {
  signal,
  batch,
  effect,
  subscribe as signalSubscribe,
} from './signals.js';
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
const _stateView = Object.freeze({
  get menuOpen() {
    return menuOpen.value;
  },
  get searchOpen() {
    return searchOpen.value;
  },
  get robotChatOpen() {
    return robotChatOpen.value;
  },
  get robotHydrated() {
    return robotHydrated.value;
  },
});
class UIStore {
  getState() {
    return Object.freeze({
      menuOpen: menuOpen.value,
      searchOpen: searchOpen.value,
      robotChatOpen: robotChatOpen.value,
      robotHydrated: robotHydrated.value,
    });
  }
  setState(patch = {}) {
    batch(() => {
      Object.keys(patch).forEach((key) => {
        const value = patch[key];
        if (value === undefined) return;
        const sig = _signalMap[key];
        if (!sig) return;
        sig.value = value;
      });
    });
    return this.getState();
  }
  subscribe(listener, options = {}) {
    return signalSubscribe(() => this.getState(), listener, options);
  }
  subscribeKey(key, listener, options = {}) {
    const sig = _signalMap[key];
    if (!sig) return () => {};
    return signalSubscribe(() => sig.value, listener, options);
  }
  select(selector, listener, options = {}) {
    if (typeof selector !== 'function' || typeof listener !== 'function') {
      return () => {};
    }

    const { emitImmediately = true, isEqual = Object.is } = options;
    let hasRun = false;
    let previousValue;

    return effect(() => {
      const selected = selector(_stateView);

      if (!emitImmediately && !hasRun) {
        previousValue = selected;
        hasRun = true;
        return;
      }

      if (hasRun && isEqual(selected, previousValue)) {
        return;
      }

      previousValue = selected;
      hasRun = true;

      try {
        listener(selected);
      } catch {
        // keep store resilient against listener errors
      }
    });
  }
  reset() {
    batch(() => {
      menuOpen.value = false;
      searchOpen.value = false;
      robotChatOpen.value = false;
      robotHydrated.value = false;
    });
  }
}
export const uiStore = new UIStore();
