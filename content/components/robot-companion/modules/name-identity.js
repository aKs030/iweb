import { normalizeUserId } from '#core/user-id.js';

const NAME_USER_ID_PREFIX = 'name_';

/**
 * @typedef {Window & typeof globalThis & {
 *   ROBOT_USER_NAME?: string;
 *   ROBOT_NO_COOKIES?: boolean | '1';
 * }} RobotIdentityWindow
 */

function getRobotIdentityWindow() {
  if (typeof window === 'undefined') return null;
  return /** @type {RobotIdentityWindow} */ (window);
}

function updateRobotNameUrl(rawName = '', { remove = false } = {}) {
  const robotWindow = getRobotIdentityWindow();
  if (!robotWindow) return false;

  try {
    const url = new URL(robotWindow.location.href);
    const current = url.searchParams.get('name') || '';
    if (remove) {
      if (!current) return false;
      url.searchParams.delete('name');
      robotWindow.history.replaceState(null, '', url.toString());
      return true;
    }

    if (current === rawName) return false;
    url.searchParams.set('name', rawName);
    robotWindow.history.replaceState(null, '', url.toString());
    return true;
  } catch {
    return false;
  }
}

export function normalizeRobotUserName(rawName) {
  return normalizeUserId(rawName);
}

export function getRobotUserName() {
  return normalizeRobotUserName(getRobotIdentityWindow()?.ROBOT_USER_NAME);
}

export function readRobotUserNameFromUrl() {
  const robotWindow = getRobotIdentityWindow();
  if (!robotWindow) return '';

  try {
    const url = new URL(robotWindow.location.href);
    return normalizeRobotUserName(url.searchParams.get('name') || '');
  } catch {
    return '';
  }
}

export function writeRobotUserName(rawName, { syncUrl = true } = {}) {
  const name = normalizeRobotUserName(rawName);
  if (!name) return { name: '', urlUpdated: false };

  const robotWindow = getRobotIdentityWindow();
  if (robotWindow) {
    robotWindow.ROBOT_USER_NAME = name;
    robotWindow.ROBOT_NO_COOKIES = true;
  }

  return {
    name,
    urlUpdated: syncUrl ? updateRobotNameUrl(name) : false,
  };
}

export function clearRobotUserName({ clearUrl = true } = {}) {
  const robotWindow = getRobotIdentityWindow();
  if (robotWindow) {
    robotWindow.ROBOT_USER_NAME = '';
    try {
      delete robotWindow.ROBOT_NO_COOKIES;
    } catch {
      robotWindow.ROBOT_NO_COOKIES = false;
    }
  }

  return {
    name: '',
    urlUpdated: clearUrl ? updateRobotNameUrl('', { remove: true }) : false,
  };
}

export function hydrateRobotUserNameFromUrl() {
  const existingName = getRobotUserName();
  if (existingName) return { name: existingName, urlUpdated: false };

  const urlName = readRobotUserNameFromUrl();
  if (!urlName) return { name: '', urlUpdated: false };

  return writeRobotUserName(urlName, { syncUrl: false });
}

export function isNameBasedUserId(userId) {
  return normalizeUserId(userId).startsWith(NAME_USER_ID_PREFIX);
}

export function getRobotUserNameFromUserId(userId) {
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId.startsWith(NAME_USER_ID_PREFIX)) return '';
  return normalizeRobotUserName(
    normalizedUserId.slice(NAME_USER_ID_PREFIX.length),
  );
}

export function toNameBasedUserId(rawNameOrUserId) {
  const normalizedValue = normalizeUserId(rawNameOrUserId);
  if (!normalizedValue) return '';
  if (normalizedValue.startsWith(NAME_USER_ID_PREFIX)) {
    return getRobotUserNameFromUserId(normalizedValue) ? normalizedValue : '';
  }
  return `${NAME_USER_ID_PREFIX}${normalizedValue}`;
}

export function syncRobotUserNameFromUserId(
  userId,
  { syncUrl = true } = {},
) {
  const name = getRobotUserNameFromUserId(userId);
  if (!name) return { name: '', urlUpdated: false };
  return writeRobotUserName(name, { syncUrl });
}
