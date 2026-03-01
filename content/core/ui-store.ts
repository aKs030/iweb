import { signal, batch, type Signal } from './signals.js';

export type UIState = {
  menuOpen: boolean;
  searchOpen: boolean;
  robotChatOpen: boolean;
  robotHydrated: boolean;
};

// ---------------------------------------------------------------------------
// Reactive Signals — fine-grained, subscribable per-property state
// ---------------------------------------------------------------------------

export const menuOpen: Signal<boolean> = signal(false);
export const searchOpen: Signal<boolean> = signal(false);
export const robotChatOpen: Signal<boolean> = signal(false);
export const robotHydrated: Signal<boolean> = signal(false);

/**
 * All UI signals collected for convenience.
 * Components can import individual signals for fine-grained reactivity.
 */
export const uiSignals = { menuOpen, searchOpen, robotChatOpen, robotHydrated };

const _signalMap: Record<string, Signal<boolean>> = {
  menuOpen,
  searchOpen,
  robotChatOpen,
  robotHydrated,
};

// ---------------------------------------------------------------------------
// UIStore — backwards-compatible façade backed by Signals
// ---------------------------------------------------------------------------

type UIListener = (state: Readonly<UIState>) => void;

class UIStore {
  private listeners = new Set<UIListener>();

  getState(): Readonly<UIState> {
    return Object.freeze({
      menuOpen: menuOpen.value,
      searchOpen: searchOpen.value,
      robotChatOpen: robotChatOpen.value,
      robotHydrated: robotHydrated.value,
    });
  }

  setState(patch: Partial<UIState> = {}): Readonly<UIState> {
    let hasChanges = false;

    batch(() => {
      (Object.keys(patch) as Array<keyof UIState>).forEach((key) => {
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

  subscribe(
    listener: UIListener,
    options: { emitImmediately?: boolean } = {},
  ): () => void {
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

  reset(): void {
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
