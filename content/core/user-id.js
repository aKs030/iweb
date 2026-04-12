const USER_ID_PATTERN = /^[A-Za-z0-9_-]{3,120}$/;

/**
 * Normalize a persisted/shared user id.
 * @param {unknown} raw
 * @returns {string}
 */
export function normalizeUserId(raw) {
  const value = String(raw || '').trim();
  if (!value || value === 'anonymous') return '';
  if (!USER_ID_PATTERN.test(value)) return '';
  return value;
}

function getCryptoApi() {
  try {
    return globalThis.crypto || null;
  } catch {
    return null;
  }
}

function normalizePrefix(prefix) {
  const value = String(prefix || 'anon')
    .trim()
    .replace(/[^A-Za-z0-9_-]+/g, '_');
  return value || 'anon';
}

function createRandomIdPart(length = 24) {
  const cryptoApi = getCryptoApi();
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    return cryptoApi.randomUUID().replace(/-/g, '').slice(0, length);
  }

  if (cryptoApi && typeof cryptoApi.getRandomValues === 'function') {
    const bytes = new Uint8Array(Math.ceil(length / 2));
    cryptoApi.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, length);
  }

  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Create a new normalized user id with a stable prefix.
 * @param {string} [prefix='anon']
 * @returns {string}
 */
export function createUserId(prefix = 'anon') {
  return `${normalizePrefix(prefix)}_${createRandomIdPart(24)}`;
}
