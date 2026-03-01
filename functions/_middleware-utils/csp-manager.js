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
