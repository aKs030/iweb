import { CLIENT_TOOL_DEFINITIONS, getToolDefinition } from './tool-registry.js';
import {
  getRobotAvatarButton,
  getRobotChatWindow,
  getRobotImageUploadInput,
  getSiteMenuHost,
} from './tool-dom-utils.js';

function isDocumentReadyForTools() {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function hasRobotCompanion() {
  if (!isDocumentReadyForTools()) return false;
  return Boolean(
    getRobotAvatarButton() ||
    document.getElementById('robot-companion-container'),
  );
}

function hasRobotChat() {
  if (!isDocumentReadyForTools()) return false;
  return Boolean(getRobotChatWindow() || getRobotImageUploadInput());
}

const TOOL_AVAILABILITY_CHECKS = {
  navigate: () => isDocumentReadyForTools(),
  setTheme: () => isDocumentReadyForTools(),
  searchBlog: () => Boolean(getSiteMenuHost()),
  toggleMenu: () => Boolean(getSiteMenuHost()),
  scrollToSection: () => isDocumentReadyForTools(),
  recommend: () => Boolean(getSiteMenuHost()),
  openSearch: () => Boolean(getSiteMenuHost()),
  closeSearch: () => Boolean(getSiteMenuHost()),
  focusSearch: () => Boolean(getSiteMenuHost()),
  scrollTop: () => isDocumentReadyForTools(),
  copyCurrentUrl: () => isDocumentReadyForTools(),
  openImageUpload: () =>
    Boolean(getRobotImageUploadInput() || getRobotAvatarButton()),
  clearChatHistory: () => hasRobotCompanion() || hasRobotChat(),
  openExternalLink: () => isDocumentReadyForTools(),
  openSocialProfile: () => isDocumentReadyForTools(),
  composeEmail: () => isDocumentReadyForTools(),
  createCalendarReminder: () => isDocumentReadyForTools(),
};

export function isClientToolAvailable(name) {
  const toolDefinition = getToolDefinition(name);
  if (!toolDefinition || toolDefinition.execution !== 'client') {
    return false;
  }

  const check = TOOL_AVAILABILITY_CHECKS[toolDefinition.name];
  if (typeof check !== 'function') return true;

  try {
    return !!check();
  } catch {
    return false;
  }
}

export function getAvailableClientToolNames() {
  return CLIENT_TOOL_DEFINITIONS.map((tool) => tool.name).filter((name) =>
    isClientToolAvailable(name),
  );
}
