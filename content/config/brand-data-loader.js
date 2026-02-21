import { createLogger } from '../core/logger.js';
import { BASE_URL, iconUrl } from './constants.js';

const log = createLogger('BrandDataLoader');

let BRAND_DATA_CACHE = null;

export async function loadBrandData() {
  if (BRAND_DATA_CACHE) return BRAND_DATA_CACHE;

  try {
    const response = await fetch('/content/config/brand-data.json');
    BRAND_DATA_CACHE = await response.json();

    // Logo and image are already absolute URLs in brand-data.json
    // No need to prepend BASE_URL

    if (BRAND_DATA_CACHE.knowsLanguage) {
      BRAND_DATA_CACHE.knowsLanguage = BRAND_DATA_CACHE.knowsLanguage.map(
        (lang) => ({
          '@type': 'Language',
          ...lang,
        }),
      );
    }
    if (BRAND_DATA_CACHE.hasOccupation) {
      BRAND_DATA_CACHE.hasOccupation = BRAND_DATA_CACHE.hasOccupation.map(
        (occ) => ({
          '@type': 'Occupation',
          ...occ,
        }),
      );
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
    logo: iconUrl('favicon-512.webp'),
    image: iconUrl('favicon-512.webp'),
    email: 'kontakt@abdulkerimsesli.de',
    sameAs: [],
  };
}
