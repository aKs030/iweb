const runtimeCookieStore = new Map();

function normalizeKey(name) {
  const key = String(name || '').trim();
  return key ? key.toLowerCase() : '';
}

function hasDocumentCookies() {
  return typeof document !== 'undefined' && typeof document.cookie === 'string';
}

function readDocumentCookie(name) {
  if (!hasDocumentCookies()) return null;

  const key = normalizeKey(name);
  if (!key) return null;

  const entries = document.cookie.split(';');
  for (const entry of entries) {
    const separatorIndex = entry.indexOf('=');
    const rawName =
      separatorIndex >= 0 ? entry.slice(0, separatorIndex) : entry;
    const rawValue = separatorIndex >= 0 ? entry.slice(separatorIndex + 1) : '';
    if (normalizeKey(rawName) !== key) continue;

    try {
      return decodeURIComponent(rawValue);
    } catch {
      return rawValue;
    }
  }

  return null;
}

function writeDocumentCookie(name, value, maxAgeSeconds) {
  if (!hasDocumentCookies()) return;

  const parts = [
    `${encodeURIComponent(String(name || ''))}=${encodeURIComponent(String(value || ''))}`,
    'Path=/',
    'SameSite=Lax',
  ];

  if (typeof maxAgeSeconds === 'number') {
    parts.push(`Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`);
  }

  if (globalThis.location?.protocol === 'https:') {
    parts.push('Secure');
  }

  document.cookie = parts.join('; ');
}

function syncDocumentConsentState(name, value) {
  if (normalizeKey(name) !== 'cookie_consent') return;
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  if (!root) return;

  const normalizedValue = String(value || '');
  const consentResolved =
    normalizedValue === 'accepted' || normalizedValue === 'rejected';

  if (consentResolved) {
    root.setAttribute('data-cookie-consent', normalizedValue);
    root.setAttribute('data-cookie-consent-resolved', 'true');
    return;
  }

  root.removeAttribute('data-cookie-consent');
  root.removeAttribute('data-cookie-consent-resolved');
}

export const CookieManager = Object.freeze({
  /**
   * @param {string} name
   * @param {string} value
   * @param {number} [days=365]
   */
  set(name, value, days = 365) {
    const key = normalizeKey(name);
    if (!key) return;

    const normalizedValue = String(value || '');
    runtimeCookieStore.set(key, normalizedValue);
    writeDocumentCookie(name, normalizedValue, days * 24 * 60 * 60);
    syncDocumentConsentState(name, normalizedValue);
  },

  /**
   * @param {string} name
   * @returns {string|null}
   */
  get(name) {
    const key = normalizeKey(name);
    if (!key) return null;

    const storedCookie = readDocumentCookie(name);
    if (storedCookie !== null) {
      runtimeCookieStore.set(key, storedCookie);
      syncDocumentConsentState(name, storedCookie);
      return storedCookie;
    }

    return runtimeCookieStore.has(key) ? runtimeCookieStore.get(key) : null;
  },

  /**
   * @param {string} name
   */
  delete(name) {
    const key = normalizeKey(name);
    if (!key) return;

    runtimeCookieStore.delete(key);
    writeDocumentCookie(name, '', 0);
    syncDocumentConsentState(name, '');
  },

  deleteAnalytics() {
    const analyticsCookies = ['_ga', '_gid', '_gat', '_gat_gtag_G_S0587RQ4CN'];
    analyticsCookies.forEach((name) => this.delete(name));
  },
});
