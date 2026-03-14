/**
 * Robot Companion Event Constants
 * Zentrale Definition aller Event-Namen zur Vermeidung von Magic Strings
 * @version 2.0.0
 */

export const ROBOT_EVENTS = Object.freeze({
  /** Fired by TypeWriter when hero subtitle finishes typing */
  HERO_TYPING_END: 'hero:typingEnd',
  /** Fired when the local robot chat history should be cleared */
  CHAT_HISTORY_CLEARED: 'robot:history:cleared',
});

export const ROBOT_ACTIONS = {
  START: 'start',
  TOGGLE_THEME: 'toggleTheme',
  SEARCH_WEBSITE: 'searchWebsite',
  SCROLL_FOOTER: 'scrollFooter',
  OPEN_MENU: 'openMenu',
  CLOSE_MENU: 'closeMenu',
  OPEN_SEARCH: 'openSearch',
  CLOSE_SEARCH: 'closeSearch',
  SCROLL_TOP: 'scrollTop',
  COPY_CURRENT_URL: 'copyCurrentUrl',
  SHOW_MEMORIES: 'showMemories',
  EDIT_PROFILE: 'editProfile',
  SWITCH_PROFILE: 'switchProfile',
  DISCONNECT_PROFILE: 'disconnectProfile',
  CLEAR_CHAT: 'clearChat',
};
