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
