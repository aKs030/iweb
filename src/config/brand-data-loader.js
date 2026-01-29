import { createLogger } from '../core/logger.js';
import { BASE_URL } from './constants.js';

const log = createLogger('BrandDataLoader');

let BRAND_DATA_CACHE = null;

export async function loadBrandData() {
  if (BRAND_DATA_CACHE) return BRAND_DATA_CACHE;

  try {
    const response = await fetch('/config/brand-data.json');
    BRAND_DATA_CACHE = await response.json();

    if (BRAND_DATA_CACHE.logo && !BRAND_DATA_CACHE.logo.startsWith('http')) {
      BRAND_DATA_CACHE.logo = `${BASE_URL}${BRAND_DATA_CACHE.logo}`;
    }

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

function getFallbackBrandData() {
  return {
    name: 'Abdulkerim Sesli',
    legalName: 'Abdulkerim Sesli',
    logo: `${BASE_URL}/assets/img/icons/favicon-512.png`,
    email: 'kontakt@abdulkerimsesli.de',
    sameAs: [],
  };
}

export function clearBrandDataCache() {
  BRAND_DATA_CACHE = null;
}
