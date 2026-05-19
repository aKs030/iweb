/**
 * Nonce Utilities - Centralized CSP nonce handling
 * @version 1.0.0
 */

/**
 * Escape HTML attribute values to prevent XSS
 * @param {string} value - Value to escape
 * @returns {string} Escaped value
 */
function escapeHtmlAttribute(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;");
}

/**
 * Build HTML nonce attribute string
 * @param {string} nonce - CSP nonce value
 * @returns {string} Nonce attribute (e.g., ` nonce="abc123"`) or empty string
 */
export function buildNonceAttribute(nonce) {
  if (!nonce) return "";
  return ` nonce="${escapeHtmlAttribute(nonce)}"`;
}
