import {
  signal,
  batch,
  effect,
  subscribe as signalSubscribe,
} from './signals.js';
/** @typedef {import('./types.js').OverlayMode} OverlayMode */
// ---------------------------------------------------------------------------
// Reactive Signals — fine-grained, subscribable per-property state
// ---------------------------------------------------------------------------
export const OVERLAY_MODES = Object.freeze({
  NONE: 'none',
  MENU: 'menu',
  SEARCH: 'search',
  ROBOT_CHAT: 'robot-chat',
});

export const menuOpen = signal(false);
export const searchOpen = signal(false);
export const robotChatOpen = signal(false);
export const robotHydrated = signal(false);
/** @type {{ value: OverlayMode, peek: () => OverlayMode, subscribe: (fn: (value: OverlayMode) => void) => () => boolean }} */
export const activeOverlay = signal(OVERLAY_MODES.NONE);

/**
 * @param {string|null|undefined} mode
 * @returns {OverlayMode}
 */
export function normalizeOverlayMode(mode) {
  switch (String(mode || 'none').trim()) {
    case OVERLAY_MODES.MENU:
    case OVERLAY_MODES.SEARCH:
    case OVERLAY_MODES.ROBOT_CHAT:
      return /** @type {OverlayMode} */ (String(mode).trim());
    default:
      return OVERLAY_MODES.NONE;
  }
}

/**
 * @param {{ menuOpen: boolean, searchOpen: boolean, robotChatOpen: boolean }} param0
 * @returns {OverlayMode}
 */
function deriveOverlayModeFromFlags({
  menuOpen: nextMenuOpen,
  searchOpen: nextSearchOpen,
  robotChatOpen: nextRobotChatOpen,
}) {
  if (nextRobotChatOpen) return OVERLAY_MODES.ROBOT_CHAT;
  if (nextSearchOpen) return OVERLAY_MODES.SEARCH;
  if (nextMenuOpen) return OVERLAY_MODES.MENU;
  return OVERLAY_MODES.NONE;
}

/**
 * @param {string|null|undefined} mode
 * @returns {void}
 */
function syncOverlaySignalsFromMode(mode) {
  const normalizedMode = normalizeOverlayMode(mode);
  activeOverlay.value = normalizedMode;
  menuOpen.value = normalizedMode === OVERLAY_MODES.MENU;
  searchOpen.value = normalizedMode === OVERLAY_MODES.SEARCH;
  robotChatOpen.value = normalizedMode === OVERLAY_MODES.ROBOT_CHAT;
}

/**
 * @param {string|null|undefined} mode
 * @returns {void}
 */
export function setActiveOverlayMode(mode) {
  batch(() => {
    syncOverlaySignalsFromMode(mode);
  });
}

/**
 * @param {string|null|undefined} [mode]
 * @returns {void}
 */
export function clearActiveOverlayMode(mode = null) {
  const normalizedMode = mode == null ? null : normalizeOverlayMode(mode);
  if (
    normalizedMode &&
    normalizedMode !== OVERLAY_MODES.NONE &&
    activeOverlay.value !== normalizedMode
  ) {
    return;
  }

  batch(() => {
    syncOverlaySignalsFromMode(OVERLAY_MODES.NONE);
  });
}

/**
 * All UI signals collected for convenience.
 * Components can import individual signals for fine-grained reactivity.
 */
export const uiSignals = {
  menuOpen,
  searchOpen,
  robotChatOpen,
  robotHydrated,
  activeOverlay,
};
const _signalMap = {
  menuOpen,
  searchOpen,
  robotChatOpen,
  robotHydrated,
  activeOverlay,
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
  get activeOverlay() {
    return activeOverlay.value;
  },
});
class UIStore {
  getState() {
    return Object.freeze({
      menuOpen: menuOpen.value,
      searchOpen: searchOpen.value,
      robotChatOpen: robotChatOpen.value,
      robotHydrated: robotHydrated.value,
      activeOverlay: activeOverlay.value,
    });
  }
  setState(patch = {}) {
    const hasExplicitActiveOverlay = patch.activeOverlay !== undefined;
    const hasLegacyOverlayPatch =
      patch.menuOpen !== undefined ||
      patch.searchOpen !== undefined ||
      patch.robotChatOpen !== undefined;

    batch(() => {
      if (patch.robotHydrated !== undefined) {
        robotHydrated.value = patch.robotHydrated;
      }

      if (hasExplicitActiveOverlay) {
        syncOverlaySignalsFromMode(patch.activeOverlay);
        return;
      }

      if (hasLegacyOverlayPatch) {
        syncOverlaySignalsFromMode(
          deriveOverlayModeFromFlags({
            menuOpen:
              patch.menuOpen !== undefined ? patch.menuOpen : menuOpen.value,
            searchOpen:
              patch.searchOpen !== undefined
                ? patch.searchOpen
                : searchOpen.value,
            robotChatOpen:
              patch.robotChatOpen !== undefined
                ? patch.robotChatOpen
                : robotChatOpen.value,
          }),
        );
      }
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
      syncOverlaySignalsFromMode(OVERLAY_MODES.NONE);
      robotHydrated.value = false;
    });
  }
}
export const uiStore = new UIStore();
