export const CACHE_CONTROL_NO_STORE = 'no-store';
export const CACHE_CONTROL_PRIVATE_NO_STORE =
  'no-store, no-cache, must-revalidate, private';
export const CACHE_CONTROL_PROXY_DEFAULT =
  'public, max-age=300, stale-while-revalidate=86400';
export const CACHE_CONTROL_NOT_FOUND_SHORT = 'public, max-age=60';
export const ACCEPT_ANY_HEADERS = Object.freeze({ Accept: '*/*' });
export const ACCEPT_JSON_HEADERS = Object.freeze({
  Accept: 'application/json',
});

/**
 * @param {...(Headers | Record<string, string> | undefined | null)} sources
 * @returns {Headers}
 */
export function mergeHeaders(...sources) {
  const headers = new Headers();

  for (const source of sources) {
    if (!source) continue;

    if (source instanceof Headers) {
      source.forEach((value, key) => {
        headers.set(key, value);
      });
      continue;
    }

    Object.entries(source).forEach(([key, value]) => {
      headers.set(key, String(value));
    });
  }

  return headers;
}
