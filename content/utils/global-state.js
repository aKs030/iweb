/**
 * Global State Management
 * Centralized namespace for all global variables
 *
 * @module global-state
 * @version 1.0.0
 */

/**
 * Initialize the global AKS namespace
 * All global variables are consolidated under window.AKS
 */
if (typeof window !== 'undefined' && !window.AKS) {
  window.AKS = {
    // Three.js Earth system
    threeEarthCleanup: null,
    threeEarthSystem: null,
    forceThreeEarth: false,

    // Core systems
    announce: null,
    SectionLoader: null,
    mainDelegatedRemove: null,

    // Robot Companion
    robotCompanionTexts: null,

    // YouTube integration
    youtubeChannelId: null,
    youtubeChannelHandle: null,

    // Internal tracking
    _migrationWarningsShown: new Set(),
    _deprecationWarnings: new Map(),
  };
}

/**
 * Create a deprecated proxy for backward compatibility
 * Logs a warning on first access and tracks usage
 *
 * @param {string} oldPath - The old global path (e.g., 'globalThis.__threeEarthCleanup')
 * @param {string} newPath - The new path (e.g., 'window.AKS.threeEarthCleanup')
 * @param {Function} getter - Function to get the current value
 * @param {Function} setter - Function to set the value
 * @returns {Object} Property descriptor for Object.defineProperty
 */
export function createDeprecatedProxy(oldPath, newPath, getter, setter) {
  return {
    get() {
      // Show deprecation warning only once per path
      if (!window.AKS._migrationWarningsShown.has(oldPath)) {
        console.warn(
          `[DEPRECATED] ${oldPath} is deprecated and will be removed in a future release.\n` +
            `Please use ${newPath} instead.\n` +
            `Migration guide: See docs/MIGRATION.md`,
        );
        window.AKS._migrationWarningsShown.add(oldPath);

        // Track deprecation usage
        const count = window.AKS._deprecationWarnings.get(oldPath) || 0;
        window.AKS._deprecationWarnings.set(oldPath, count + 1);
      }

      return getter();
    },
    set(value) {
      // Show deprecation warning only once per path
      if (!window.AKS._migrationWarningsShown.has(oldPath)) {
        console.warn(
          `[DEPRECATED] ${oldPath} is deprecated and will be removed in a future release.\n` +
            `Please use ${newPath} instead.\n` +
            `Migration guide: See docs/MIGRATION.md`,
        );
        window.AKS._migrationWarningsShown.add(oldPath);

        // Track deprecation usage
        const count = window.AKS._deprecationWarnings.get(oldPath) || 0;
        window.AKS._deprecationWarnings.set(oldPath, count + 1);
      }

      setter(value);
    },
    configurable: true,
    enumerable: false,
  };
}

/**
 * Setup backward compatibility proxies for all migrated global variables
 * This allows old code to continue working while showing deprecation warnings
 *
 * @example
 * // Old code (deprecated):
 * globalThis.__threeEarthCleanup = cleanup;
 *
 * // New code:
 * window.AKS.threeEarthCleanup = cleanup;
 */
export function setupBackwardCompatibility() {
  if (typeof globalThis === 'undefined' || typeof window === 'undefined') {
    return;
  }

  // Three.js Earth system proxies
  Object.defineProperty(
    globalThis,
    '__threeEarthCleanup',
    createDeprecatedProxy(
      'globalThis.__threeEarthCleanup',
      'window.AKS.threeEarthCleanup',
      () => window.AKS.threeEarthCleanup,
      (value) => {
        window.AKS.threeEarthCleanup = value;
      },
    ),
  );

  Object.defineProperty(
    globalThis,
    'threeEarthSystem',
    createDeprecatedProxy(
      'globalThis.threeEarthSystem',
      'window.AKS.threeEarthSystem',
      () => window.AKS.threeEarthSystem,
      (value) => {
        window.AKS.threeEarthSystem = value;
      },
    ),
  );

  Object.defineProperty(
    globalThis,
    '__FORCE_THREE_EARTH',
    createDeprecatedProxy(
      'globalThis.__FORCE_THREE_EARTH',
      'window.AKS.forceThreeEarth',
      () => window.AKS.forceThreeEarth,
      (value) => {
        window.AKS.forceThreeEarth = value;
      },
    ),
  );

  // Core system proxies
  Object.defineProperty(
    globalThis,
    'announce',
    createDeprecatedProxy(
      'globalThis.announce',
      'window.AKS.announce',
      () => window.AKS.announce,
      (value) => {
        window.AKS.announce = value;
      },
    ),
  );

  Object.defineProperty(
    globalThis,
    'SectionLoader',
    createDeprecatedProxy(
      'globalThis.SectionLoader',
      'window.AKS.SectionLoader',
      () => window.AKS.SectionLoader,
      (value) => {
        window.AKS.SectionLoader = value;
      },
    ),
  );

  Object.defineProperty(
    globalThis,
    '__main_delegated_remove',
    createDeprecatedProxy(
      'globalThis.__main_delegated_remove',
      'window.AKS.mainDelegatedRemove',
      () => window.AKS.mainDelegatedRemove,
      (value) => {
        window.AKS.mainDelegatedRemove = value;
      },
    ),
  );

  // Robot Companion proxy
  Object.defineProperty(
    globalThis,
    'robotCompanionTexts',
    createDeprecatedProxy(
      'globalThis.robotCompanionTexts',
      'window.AKS.robotCompanionTexts',
      () => window.AKS.robotCompanionTexts,
      (value) => {
        window.AKS.robotCompanionTexts = value;
      },
    ),
  );

  // YouTube integration proxies
  Object.defineProperty(
    globalThis,
    'YOUTUBE_CHANNEL_ID',
    createDeprecatedProxy(
      'globalThis.YOUTUBE_CHANNEL_ID',
      'window.AKS.youtubeChannelId',
      () => window.AKS.youtubeChannelId,
      (value) => {
        window.AKS.youtubeChannelId = value;
      },
    ),
  );

  Object.defineProperty(
    globalThis,
    'YOUTUBE_CHANNEL_HANDLE',
    createDeprecatedProxy(
      'globalThis.YOUTUBE_CHANNEL_HANDLE',
      'window.AKS.youtubeChannelHandle',
      () => window.AKS.youtubeChannelHandle,
      (value) => {
        window.AKS.youtubeChannelHandle = value;
      },
    ),
  );
}

/**
 * Type-safe access helpers for global state
 * Provides a clean API for accessing global state
 */
export const GlobalState = {
  // Three.js Earth system
  get threeEarthCleanup() {
    return window.AKS?.threeEarthCleanup;
  },
  set threeEarthCleanup(value) {
    if (window.AKS) window.AKS.threeEarthCleanup = value;
  },

  get threeEarthSystem() {
    return window.AKS?.threeEarthSystem;
  },
  set threeEarthSystem(value) {
    if (window.AKS) window.AKS.threeEarthSystem = value;
  },

  get forceThreeEarth() {
    return window.AKS?.forceThreeEarth;
  },
  set forceThreeEarth(value) {
    if (window.AKS) window.AKS.forceThreeEarth = value;
  },

  // Core systems
  get announce() {
    return window.AKS?.announce;
  },
  set announce(value) {
    if (window.AKS) window.AKS.announce = value;
  },

  get SectionLoader() {
    return window.AKS?.SectionLoader;
  },
  set SectionLoader(value) {
    if (window.AKS) window.AKS.SectionLoader = value;
  },

  get mainDelegatedRemove() {
    return window.AKS?.mainDelegatedRemove;
  },
  set mainDelegatedRemove(value) {
    if (window.AKS) window.AKS.mainDelegatedRemove = value;
  },

  // Robot Companion
  get robotCompanionTexts() {
    return window.AKS?.robotCompanionTexts;
  },
  set robotCompanionTexts(value) {
    if (window.AKS) window.AKS.robotCompanionTexts = value;
  },

  // YouTube integration
  get youtubeChannelId() {
    return window.AKS?.youtubeChannelId;
  },
  set youtubeChannelId(value) {
    if (window.AKS) window.AKS.youtubeChannelId = value;
  },

  get youtubeChannelHandle() {
    return window.AKS?.youtubeChannelHandle;
  },
  set youtubeChannelHandle(value) {
    if (window.AKS) window.AKS.youtubeChannelHandle = value;
  },

  /**
   * Get deprecation statistics
   * @returns {Object} Map of deprecated paths and their usage counts
   */
  getDeprecationStats() {
    return {
      warnings: Array.from(window.AKS?._deprecationWarnings?.entries() || []),
      totalWarnings: window.AKS?._migrationWarningsShown?.size || 0,
    };
  },

  /**
   * Clear deprecation warnings (for testing)
   */
  clearDeprecationWarnings() {
    if (window.AKS) {
      window.AKS._migrationWarningsShown.clear();
      window.AKS._deprecationWarnings.clear();
    }
  },
};

export default GlobalState;
