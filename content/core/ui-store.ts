export type UIState = {
  menuOpen: boolean;
  searchOpen: boolean;
  robotChatOpen: boolean;
  robotHydrated: boolean;
};

const initialState: UIState = {
  menuOpen: false,
  searchOpen: false,
  robotChatOpen: false,
  robotHydrated: false,
};

type UIListener = (state: Readonly<UIState>) => void;

class UIStore {
  private state: UIState = { ...initialState };
  private listeners = new Set<UIListener>();

  getState(): Readonly<UIState> {
    return Object.freeze({ ...this.state });
  }

  setState(patch: Partial<UIState> = {}): Readonly<UIState> {
    let hasChanges = false;
    const next: UIState = { ...this.state };

    (Object.keys(patch) as Array<keyof UIState>).forEach((key) => {
      const value = patch[key];
      if (value === undefined) return;
      if (Object.is(next[key], value)) return;
      next[key] = value;
      hasChanges = true;
    });

    if (!hasChanges) return this.getState();

    this.state = next;
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
    this.state = { ...initialState };
    this.listeners.clear();
  }
}

export const uiStore = new UIStore();
