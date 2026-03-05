/**
 * Runtime-only cookie-like storage utility (no browser persistence)
 */
const runtimeCookieStore = new Map();

function normalizeKey(name) {
  const key = String(name || '').trim();
  return key ? key.toLowerCase() : '';
}

export const CookieManager = Object.freeze({
  /**
   * @param {string} name
   * @param {string} value
   * @param {number} [days=365]
   */
  set(name, value, days = 365) {
    void days;
    const key = normalizeKey(name);
    if (!key) return;
    runtimeCookieStore.set(key, String(value || ''));
  },

  /**
   * @param {string} name
   * @returns {string|null}
   */
  get(name) {
    const key = normalizeKey(name);
    if (!key) return null;
    return runtimeCookieStore.has(key) ? runtimeCookieStore.get(key) : null;
  },

  /**
   * @param {string} name
   */
  delete(name) {
    const key = normalizeKey(name);
    if (!key) return;
    runtimeCookieStore.delete(key);
  },

  deleteAnalytics() {
    const analyticsCookies = ['_ga', '_gid', '_gat', '_gat_gtag_G_S0587RQ4CN'];
    analyticsCookies.forEach((name) => this.delete(name));
  },
});
