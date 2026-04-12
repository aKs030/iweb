import { normalizeUserId } from '../../content/core/user-id.js';

export { normalizeUserId };

export const USER_ID_HEADER_NAME = 'X-Jules-User-Id';
export const USER_ID_HEADER_KEY = 'x-jules-user-id';
export const USER_ID_COOKIE_NAME = 'jules_user_id';
const USER_ID_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function readUserIdFromCookieHeader(cookieHeader) {
  const entries = String(cookieHeader || '')
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean);

  for (const entry of entries) {
    const separatorIndex = entry.indexOf('=');
    if (separatorIndex <= 0) continue;

    const name = entry.slice(0, separatorIndex).trim();
    if (name !== USER_ID_COOKIE_NAME) continue;

    const rawValue = entry.slice(separatorIndex + 1).trim();
    try {
      return normalizeUserId(decodeURIComponent(rawValue));
    } catch {
      return normalizeUserId(rawValue);
    }
  }

  return '';
}

function isSecureRequest(request) {
  try {
    return new URL(request.url).protocol === 'https:';
  } catch {
    return false;
  }
}

export function buildUserIdCookie(request, userId) {
  const normalized = normalizeUserId(userId);
  if (!normalized) return buildUserIdClearCookie(request);

  const parts = [
    `${USER_ID_COOKIE_NAME}=${encodeURIComponent(normalized)}`,
    'Path=/',
    `Max-Age=${USER_ID_COOKIE_MAX_AGE}`,
    'SameSite=Lax',
    'HttpOnly',
  ];

  if (isSecureRequest(request)) {
    parts.push('Secure');
  }

  return parts.join('; ');
}

export function buildUserIdClearCookie(request) {
  const parts = [
    `${USER_ID_COOKIE_NAME}=`,
    'Path=/',
    'Max-Age=0',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
    'SameSite=Lax',
    'HttpOnly',
  ];

  if (isSecureRequest(request)) {
    parts.push('Secure');
  }

  return parts.join('; ');
}

export function appendSetCookie(headers, cookieValue) {
  if (!headers || !cookieValue) return;
  headers.append('Set-Cookie', cookieValue);
}
