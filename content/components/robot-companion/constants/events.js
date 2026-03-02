/**
 * Robot Companion Event Constants
 * Zentrale Definition aller Event-Namen zur Vermeidung von Magic Strings
 * @version 1.0.0
 */

export const ROBOT_EVENTS = {
  // Lifecycle Events
  INITIALIZED: 'robot:initialized',
  DESTROYED: 'robot:destroyed',

  // Chat Events
  CHAT_OPENED: 'robot:chat:opened',
  CHAT_CLOSED: 'robot:chat:closed',
  CHAT_MESSAGE_SENT: 'robot:chat:message:sent',
  CHAT_MESSAGE_RECEIVED: 'robot:chat:message:received',

  // Animation Events
  ANIMATION_START: 'robot:animation:start',
  ANIMATION_END: 'robot:animation:end',
  PATROL_START: 'robot:patrol:start',
  PATROL_PAUSE: 'robot:patrol:pause',

  // Interaction Events
  AVATAR_CLICKED: 'robot:avatar:clicked',
  BUBBLE_SHOWN: 'robot:bubble:shown',
  BUBBLE_HIDDEN: 'robot:bubble:hidden',

  // State Events
  STATE_CHANGED: 'robot:state:changed',
  MOOD_CHANGED: 'robot:mood:changed',

  // External Events (listening to)
  HERO_TYPING_END: 'hero:typingEnd',
  SECTION_CHANGED: 'robot:section:changed',

  // Agent Events
  TOOL_EXECUTED: 'robot:tool:executed',
  IMAGE_UPLOADED: 'robot:image:uploaded',
  MEMORY_RECALLED: 'robot:memory:recalled',
  MEMORY_STORED: 'robot:memory:stored',

  // Error Events
  ERROR: 'robot:error',
};

export const ROBOT_ACTIONS = {
  START: 'start',
  SUMMARIZE_PAGE: 'summarizePage',
  UPLOAD_IMAGE: 'uploadImage',
  TOGGLE_THEME: 'toggleTheme',
  SEARCH_WEBSITE: 'searchWebsite',
  SCROLL_FOOTER: 'scrollFooter',
  OPEN_MENU: 'openMenu',
  CLOSE_MENU: 'closeMenu',
  OPEN_SEARCH: 'openSearch',
  CLOSE_SEARCH: 'closeSearch',
  SCROLL_TOP: 'scrollTop',
  COPY_CURRENT_URL: 'copyCurrentUrl',
  CLEAR_CHAT: 'clearChat',
  EXPORT_CHAT: 'exportChat',
};
