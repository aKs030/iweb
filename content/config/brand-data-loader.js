/**
 * Brand Data Loader
 * Centralized brand data loading with caching
 * @version 1.0.0
 */

import { createLogger } from '../core/logger.js';

const log = createLogger('BrandDataLoader');

const BASE_URL = 'https://www.abdulkerimsesli.de';

// Cache for brand data
let BRAND_DATA_CACHE = null;

/**
 * Load brand data with caching
 * @returns {Promise<BrandData>}
 */
export async function loadBrandData() {
  if (BRAND_DATA_CACHE) return BRAND_DATA_CACHE;

  try {
    const response = await fetch('/content/config/brand-data.json');
    BRAND_DATA_CACHE = await response.json();

    // Normalize URLs
    if (BRAND_DATA_CACHE.logo && !BRAND_DATA_CACHE.logo.startsWith('http')) {
      BRAND_DATA_CACHE.logo = `${BASE_URL}${BRAND_DATA_CACHE.logo}`;
    }

    // Add @type to nested objects for schema.org
    if (BRAND_DATA_CACHE.address) {
      BRAND_DATA_CACHE.address['@type'] = 'PostalAddress';
    }
    if (BRAND_DATA_CACHE.geo) {
      BRAND_DATA_CACHE.geo['@type'] = 'GeoCoordinates';
    }
    if (BRAND_DATA_CACHE.contactPoint) {
      BRAND_DATA_CACHE.contactPoint = BRAND_DATA_CACHE.contactPoint.map(
        (cp) => ({
          '@type': 'ContactPoint',
          ...cp,
          url: cp.url || `${BASE_URL}/#kontakt`,
        }),
      );
    }

    return BRAND_DATA_CACHE;
  } catch (err) {
    log.error('Failed to load brand-data.json, using fallback', err);
    BRAND_DATA_CACHE = getFallbackBrandData();
    return BRAND_DATA_CACHE;
  }
}

/**
 * Get fallback brand data
 * @returns {BrandData}
 */
function getFallbackBrandData() {
  return {
    name: 'Abdulkerim Sesli',
    legalName: 'Abdulkerim Sesli',
    logo: `${BASE_URL}/content/assets/img/icons/favicon-512.png`,
    email: 'kontakt@abdulkerimsesli.de',
    sameAs: [],
  };
}

/**
 * Clear brand data cache (useful for testing)
 */
export function clearBrandDataCache() {
  BRAND_DATA_CACHE = null;
}
