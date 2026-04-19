let cachedNonce = null;

/**
 * Read the active CSP nonce from the current document.
 * Falls back to the first nonce-bearing script/style tag rendered by the server.
 *
 * @returns {string}
 */
export function getCspNonce() {
  if (cachedNonce) return cachedNonce;
  if (typeof document === 'undefined') return '';

  const currentScript =
    document.currentScript instanceof HTMLScriptElement
      ? document.currentScript
      : null;
  const currentScriptNonce = currentScript?.nonce || '';
  if (currentScriptNonce) {
    cachedNonce = currentScriptNonce;
    return cachedNonce;
  }

  const nonceSource = document.querySelector('script[nonce], style[nonce]');
  const resolvedNonce =
    nonceSource instanceof HTMLElement
      ? nonceSource.nonce || nonceSource.getAttribute('nonce') || ''
      : '';

  if (resolvedNonce) {
    cachedNonce = resolvedNonce;
  }

  return cachedNonce || '';
}

/**
 * Apply the active CSP nonce to a dynamically created node when available.
 *
 * @template {HTMLElement} T
 * @param {T} element
 * @returns {T}
 */
export function applyCspNonce(element) {
  const nonce = getCspNonce();
  if (!nonce) return element;
  element.nonce = nonce;
  element.setAttribute('nonce', nonce);
  return element;
}
