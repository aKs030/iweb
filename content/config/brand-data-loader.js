import { createLogger } from '../core/logger.js';
import { BASE_URL, CONTACT_PATH, iconUrl } from './constants.js';

const log = createLogger('BrandDataLoader');

let BRAND_DATA_CACHE = null;
let BRAND_DATA_PROMISE = null;

function addJsonLdType(entries, type) {
  if (!Array.isArray(entries)) return null;
  return entries
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry) => ({
      '@type': type,
      ...entry,
    }));
}

function normalizeBrandData(payload) {
  const raw =
    payload && typeof payload === 'object' && !Array.isArray(payload)
      ? payload
      : {};
  const normalized = { ...raw };

  const knowsLanguage = addJsonLdType(raw.knowsLanguage, 'Language');
  if (knowsLanguage) {
    normalized.knowsLanguage = knowsLanguage;
  }

  const hasOccupation = addJsonLdType(raw.hasOccupation, 'Occupation');
  if (hasOccupation) {
    normalized.hasOccupation = hasOccupation;
  }

  const contactPoint = addJsonLdType(raw.contactPoint, 'ContactPoint');
  if (contactPoint) {
    normalized.contactPoint = contactPoint.map((cp) => ({
      ...cp,
      url: cp.url || `${BASE_URL}${CONTACT_PATH}`,
    }));
  }

  return normalized;
}

export async function loadBrandData() {
  if (BRAND_DATA_CACHE) return BRAND_DATA_CACHE;
  if (BRAND_DATA_PROMISE) return BRAND_DATA_PROMISE;

  BRAND_DATA_PROMISE = (async () => {
    try {
      const response = await fetch('/content/config/brand-data.json');
      if (!response.ok) {
        throw new Error(`brand-data.json returned ${response.status}`);
      }

      const payload = await response.json();
      BRAND_DATA_CACHE = normalizeBrandData(payload);
      return BRAND_DATA_CACHE;
    } catch (err) {
      log.error('Failed to load brand-data.json, using fallback', err);
      BRAND_DATA_CACHE = getFallbackBrandData();
      return BRAND_DATA_CACHE;
    } finally {
      BRAND_DATA_PROMISE = null;
    }
  })();

  return BRAND_DATA_PROMISE;
}

function getFallbackBrandData() {
  return {
    name: 'Abdulkerim Sesli',
    legalName: 'Abdulkerim Sesli',
    logo: iconUrl('favicon-512.webp'),
    image: iconUrl('favicon-512.webp'),
    email: 'kontakt@abdulkerimsesli.de',
    contactPoint: [
      {
        '@type': 'ContactPoint',
        contactType: 'customer service',
        email: 'kontakt@abdulkerimsesli.de',
        url: `${BASE_URL}${CONTACT_PATH}`,
      },
    ],
    sameAs: [],
  };
}
