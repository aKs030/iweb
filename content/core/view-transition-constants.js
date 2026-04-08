/**
 * View Transition Constants - Centralized timings and types
 * @version 1.0.0
 */

// ============================================================================
// TIMINGS
// ============================================================================

/**
 * Central View Transition timings (JS + CSS variable bridge).
 * Values are in milliseconds unless noted otherwise.
 */
export const VIEW_TRANSITION_TIMINGS_MS = Object.freeze({
  DEFAULT_TIMEOUT: 5000,
  PAGE_OLD: 180,
  PAGE_NEW: 240,
  THEME_TIMEOUT: 1200,
  MENU_TIMEOUT: 900,
  SEARCH_TIMEOUT: 750,
  SECTION_SWAP_TIMEOUT: 1500,
});

const TIMING_CSS_VARS = Object.freeze({
  '--vt-page-old-duration': VIEW_TRANSITION_TIMINGS_MS.PAGE_OLD,
  '--vt-page-new-duration': VIEW_TRANSITION_TIMINGS_MS.PAGE_NEW,
});

/**
 * @param {number} valueMs
 * @returns {string}
 */
export const toCssMs = (valueMs) => `${Math.max(0, Math.round(valueMs))}ms`;

/**
 * Keep CSS transition timing vars in sync with JS timing source.
 * Safe to call repeatedly.
 */
export const applyViewTransitionTimingVars = () => {
  if (typeof document === 'undefined') return;
  const rootStyle = document.documentElement?.style;
  if (!rootStyle) return;

  for (const [name, valueMs] of Object.entries(TIMING_CSS_VARS)) {
    rootStyle.setProperty(name, toCssMs(valueMs));
  }
};

// ============================================================================
// TYPES
// ============================================================================

/**
 * Central list of typed View Transition labels used across the app.
 * Keep this as the single source of truth to avoid string drift.
 */
export const VIEW_TRANSITION_TYPES = Object.freeze({
  PAGE_NAVIGATE: 'page-navigate',
  SAME_PAGE_SCROLL: 'same-page-scroll',
  LOADER_HIDE: 'loader-hide',
  THEME_CHANGE: 'theme-change',
  MENU_OPEN: 'menu-open',
  MENU_CLOSE: 'menu-close',
  SEARCH_OPEN: 'search-open',
  SEARCH_CLOSE: 'search-close',
  SECTION_SWAP: 'section-swap',
  CHAT_OPEN: 'chat-open',
  CHAT_CLOSE: 'chat-close',
  CHAT_TOOL_RESULT: 'chat-tool-result',
  CHAT_TYPING_SHOW: 'chat-typing-show',
  CHAT_TYPING_HIDE: 'chat-typing-hide',
  CHAT_MESSAGE_ADD: 'chat-message-add',
  CHAT_CLEAR: 'chat-clear',
});

export const DEFAULT_NAVIGATION_TRANSITION_TYPES = Object.freeze([
  VIEW_TRANSITION_TYPES.PAGE_NAVIGATE,
]);

export const DEFAULT_SCROLL_TRANSITION_TYPES = Object.freeze([
  VIEW_TRANSITION_TYPES.SAME_PAGE_SCROLL,
]);

export const BACKDROP_SENSITIVE_TRANSITION_TYPES = Object.freeze([
  VIEW_TRANSITION_TYPES.MENU_OPEN,
  VIEW_TRANSITION_TYPES.MENU_CLOSE,
  VIEW_TRANSITION_TYPES.SEARCH_OPEN,
  VIEW_TRANSITION_TYPES.SEARCH_CLOSE,
]);

export const VIEW_TRANSITION_ROOT_CLASSES = Object.freeze({
  MENU: 'vt-menu',
  THEME_CHANGE: 'vt-theme-change',
  SECTION_SWAP: 'vt-section-swap',
});
