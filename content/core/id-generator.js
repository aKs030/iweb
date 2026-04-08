/**
 * ID Generation Utilities - Client-side
 * @version 1.0.0
 */

/**
 * Generate a unique user ID with crypto fallback
 * @returns {string} User ID in format u_<hash>
 */
export function generateUserId() {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return `u_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;
  }
  return `u_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Generate a unique message ID
 * @returns {string} Message ID in format msg_<timestamp>_<random>
 */
export function generateMessageId() {
  return `msg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
