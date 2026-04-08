/**
 * ID Generation Utilities
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

/**
 * Generate a unique purge job ID
 * @returns {string} Job ID in format purge_<hash>
 */
export function generatePurgeJobId() {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return `purge_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;
  }
  return `purge_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Generate a unique purge confirmation ID
 * @returns {string} Confirmation ID in format pc_<hash>
 */
export function generatePurgeConfirmationId() {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return `pc_${crypto.randomUUID().replace(/-/g, '')}`;
  }
  return `pc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 14)}`;
}
