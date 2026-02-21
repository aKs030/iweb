/**
 * CSP (Content Security Policy) Management
 * @version 1.0.0
 */

/**
 * Generate a cryptographically random nonce (base64, 128-bit)
 * @returns {string} Base64-encoded nonce
 */
export function generateNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

/**
 * Inject nonce attribute into inline <script> and <style> tags
 * @param {string} html - HTML content
 * @param {string} nonce - CSP nonce
 * @returns {string} HTML with nonce attributes
 */
export function injectNonce(html, nonce) {
  // Add nonce to <script> tags that don't have src (inline scripts)
  html = html.replace(
    /<script(?=[^>]*>)(?![^>]*\bsrc\s*=)(?![^>]*\bnonce\s*=)([^>]*)>/gi,
    `<script nonce="${nonce}"$1>`,
  );

  // Add nonce to <style> tags
  html = html.replace(
    /<style(?![^>]*\bnonce\s*=)([^>]*)>/gi,
    `<style nonce="${nonce}"$1>`,
  );

  return html;
}

/**
 * Replace script-src 'unsafe-inline' with nonce in a CSP header
 * @param {string} csp - CSP header value
 * @param {string} nonce - CSP nonce
 * @returns {string} Updated CSP header
 */
export function applyNonceToCSP(csp, nonce) {
  if (!csp || !nonce) return csp;

  const withScriptNonce = csp.replace(
    /(script-src[^;]*?)'unsafe-inline'([^;]*)(;|$)/gi,
    (_match, start, end, terminator) =>
      `${start}'nonce-${nonce}'${end}${terminator}`,
  );

  return withScriptNonce.replace(/\s{2,}/g, ' ').trim();
}
