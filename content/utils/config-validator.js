/**
 * Configuration Validation Utilities
 * Centralized validation for site configuration
 */

import { SITE_CONFIG } from '../config/site-config.js';

/**
 * Get configuration for current host
 * @returns {Object} Configuration object for current host
 */
export function getCurrentConfig() {
  const hostname = globalThis.location?.hostname || 'localhost';
  return SITE_CONFIG[hostname] || SITE_CONFIG.default || {};
}

/**
 * Check if GTM is properly configured
 * @param {Object} config - Configuration object (optional, uses current if not provided)
 * @returns {boolean} True if GTM is configured
 */
export function isGTMConfigured(config = null) {
  const cfg = config || getCurrentConfig();
  return cfg.gtm && cfg.gtm !== 'GTM-XXXXXXX' && cfg.gtm.startsWith('GTM-');
}

/**
 * Check if GA4 is properly configured
 * @param {Object} config - Configuration object (optional, uses current if not provided)
 * @returns {boolean} True if GA4 is configured
 */
export function isGA4Configured(config = null) {
  const cfg = config || getCurrentConfig();
  return cfg.ga4 && cfg.ga4.startsWith('G-');
}

/**
 * Check if Google Ads is properly configured
 * @param {Object} config - Configuration object (optional, uses current if not provided)
 * @returns {boolean} True if Google Ads is configured
 */
export function isAdsConfigured(config = null) {
  const cfg = config || getCurrentConfig();
  return cfg.aw && cfg.aw.startsWith('AW-');
}

/**
 * Validate all configuration fields
 * @param {Object} config - Configuration object (optional, uses current if not provided)
 * @returns {Object} Validation results
 */
export function validateConfig(config = null) {
  const cfg = config || getCurrentConfig();

  return {
    gtm: isGTMConfigured(cfg),
    ga4: isGA4Configured(cfg),
    ads: isAdsConfigured(cfg),
    hasAdsLabel: Boolean(cfg.aw_label),
    config: cfg,
  };
}
