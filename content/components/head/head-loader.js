/**
 * Modern Head Loader - Modular & Testable
 * @version 3.0.0
 */

import { createLogger } from '/content/core/logger.js';
import { fetchJSON } from '/content/core/fetch.js';
import { ENV } from '/content/config/env.config.js';
import {
  upsertHeadLink,
  upsertMeta,
  applyCanonicalLinks,
} from '/content/core/dom-helpers.js';

const log = createLogger('HeadLoader');

// ===== Data Loading =====

/**
 * Load brand data with caching
 * @returns {Promise<BrandData>}
 */
async function loadBrandData() {
  try {
    const data = await fetchJSON('/content/config/brand-data.json', {
      cache: true,
      cacheTTL: 3600000, // 1 hour
    });

    // Normalize URLs
    if (data.logo && !data.logo.startsWith('http')) {
      data.logo = `${ENV.BASE_URL}${data.logo}`;
    }

    // Add @type for schema.org
    if (data.address) data.address['@type'] = 'PostalAddress';
    if (data.geo) data.geo['@type'] = 'GeoCoordinates';
    if (data.contactPoint) {
      data.contactPoint = data.contactPoint.map((cp) => ({
        '@type': 'ContactPoint',
        ...cp,
        url: cp.url || `${ENV.BASE_URL}/#kontakt`,
      }));
    }

    return data;
  } catch (error) {
    log.error('Failed to load brand data:', error);
    return getFallbackBrandData();
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
    logo: `${ENV.BASE_URL}/content/assets/img/icons/favicon-512.png`,
    email: 'kontakt@abdulkerimsesli.de',
    sameAs: [],
  };
}

// ===== Route Configuration =====

const ROUTES = {
  default: {
    title:
      'Abdulkerim Sesli | Webentwicklung & Fotografie Berlin | Abdul Berlin',
    description:
      'Offizielles Portfolio von Abdulkerim Sesli (Abdul Berlin). Webentwickler (React, Three.js) und Fotograf aus Berlin.',
    title_en: 'Abdulkerim Sesli — Web Developer & Photographer in Berlin',
    description_en:
      'Abdulkerim Sesli — Web Developer & Photographer in Berlin. Specialist in React, Three.js and urban photography.',
    type: 'ProfilePage',
    image: `${ENV.BASE_URL}/content/assets/img/og/og-home-800.webp`,
  },
  '/projekte/': {
    title: 'Referenzen & Code-Projekte | Abdulkerim Sesli',
    description:
      'Entdecke interaktive Web-Experimente aus Berlin. Spezialisiert auf React, Three.js und modernes UI/UX Design.',
    type: 'CollectionPage',
    image: `${ENV.BASE_URL}/content/assets/img/og/og-projekte-800.webp`,
  },
  '/blog/': {
    title: 'Tech-Blog & Tutorials | Webentwicklung Berlin',
    description:
      'Expertenwissen zu JavaScript, CSS und Web-Architektur. Praxisnahe Tutorials.',
    type: 'Blog',
    image: `${ENV.BASE_URL}/content/assets/img/og/og-home-800.webp`,
  },
  '/videos/': {
    title: 'Videos — Abdulkerim Sesli',
    description: 'Eine Auswahl meiner Arbeiten und Behind-the-Scenes.',
    type: 'CollectionPage',
    image: `${ENV.BASE_URL}/content/assets/img/og/og-videos-800.webp`,
  },
  '/gallery/': {
    title: 'Fotografie Portfolio | Urban & Portrait Berlin',
    description:
      'Visuelle Ästhetik aus der Hauptstadt. Street Photography, Architektur und Portraits.',
    type: 'ImageGallery',
    image: `${ENV.BASE_URL}/content/assets/img/og/og-home-800.webp`,
  },
};

/**
 * Get page data for current route
 * @returns {PageData}
 */
function getPageData() {
  const currentPath = window.location.pathname.toLowerCase();
  const matchedKey = Object.keys(ROUTES).find(
    (key) => key !== 'default' && currentPath.includes(key),
  );

  const rawPageData = matchedKey ? ROUTES[matchedKey] : ROUTES.default;

  // i18n: Choose localized title/description
  const preferredLang = (
    document?.documentElement?.lang ||
    navigator?.language ||
    'de'
  ).toLowerCase();
  const isEnglish = preferredLang.startsWith('en');

  return {
    ...rawPageData,
    title:
      isEnglish && rawPageData.title_en
        ? rawPageData.title_en
        : rawPageData.title,
    description:
      isEnglish && rawPageData.description_en
        ? rawPageData.description_en
        : rawPageData.description,
  };
}

// ===== Meta Tag Management =====

/**
 * Update basic meta tags
 * @param {PageData} pageData
 */
function updateBasicMeta(pageData) {
  if (pageData.title?.trim()) {
    document.title = pageData.title;
  }

  upsertMeta('description', pageData.description);
  upsertMeta('robots', 'index, follow, max-image-preview:large');
  upsertMeta('viewport', 'width=device-width, initial-scale=1');
  upsertMeta('language', 'de-DE');
  upsertMeta('author', 'Abdulkerim Sesli');
}

/**
 * Update social media meta tags
 * @param {PageData} pageData
 * @param {string} pageUrl
 */
function updateSocialMeta(pageData, pageUrl) {
  // Twitter
  upsertMeta('twitter:card', 'summary_large_image');
  upsertMeta('twitter:creator', '@abdulkerimsesli');
  upsertMeta('twitter:url', pageUrl);
  if (pageData.image) {
    upsertMeta('twitter:image', pageData.image);
    upsertMeta('twitter:image:alt', pageData.title || pageData.description);
  }

  // OpenGraph
  upsertMeta('og:title', pageData.title, true);
  upsertMeta('og:description', pageData.description, true);
  upsertMeta('og:locale', 'de_DE', true);
  upsertMeta('og:url', pageUrl, true);
  if (pageData.image) {
    upsertMeta('og:image', pageData.image, true);
    upsertMeta('og:image:width', '1200', true);
    upsertMeta('og:image:height', '630', true);
  }
}

/**
 * Update local SEO meta tags
 */
function updateLocalSEO() {
  upsertMeta('geo.region', 'DE-BE');
  upsertMeta('geo.placename', 'Berlin');
  upsertMeta('geo.position', '52.5733;13.2911');
  upsertMeta('ICBM', '52.5733, 13.2911');
}

// ===== Canonical Links =====

/**
 * Compute canonical URL
 * @param {boolean} forceProd
 * @param {string} cleanPath
 * @returns {string}
 */
function computeCanonical(forceProd, cleanPath) {
  if (forceProd) {
    return `${ENV.BASE_URL}${cleanPath}`;
  }

  const isDirtyPath =
    /^\/pages\//i.test(window.location.pathname) ||
    /\/index\.html$/i.test(window.location.pathname);

  if (isDirtyPath) {
    return `${window.location.origin}${cleanPath}`;
  }

  return window.location.href.split('#')[0].split('?')[0];
}

/**
 * Update canonical links
 * @param {boolean} forceProd
 */
function updateCanonicalLinks(forceProd) {
  const rawPath = window.location.pathname || '/';
  let cleanPath = rawPath
    .replace(/\/\/+/g, '/')
    .replace(/\/index\.html$/i, '/')
    .replace(/\.html$/i, '/');

  if (!cleanPath.startsWith('/')) cleanPath = '/' + cleanPath;
  if (!cleanPath.endsWith('/')) cleanPath += '/';

  const canonical = computeCanonical(forceProd, cleanPath);
  const canonicalOrigin = forceProd ? ENV.BASE_URL : window.location.origin;

  const alternates = [
    { lang: 'de', href: `${canonicalOrigin}${cleanPath}` },
    { lang: 'x-default', href: `${canonicalOrigin}${cleanPath}` },
  ];

  applyCanonicalLinks(document, alternates, canonical);
}

// ===== PWA Assets =====

/**
 * Update PWA meta tags and icons
 * @param {BrandData} brandData
 */
function updatePWAAssets(brandData) {
  // Manifest
  upsertHeadLink({ rel: 'manifest', href: '/manifest.json' });

  // Theme
  upsertMeta('theme-color', '#0d0d0d');
  upsertMeta('mobile-web-app-capable', 'yes');
  upsertMeta('apple-mobile-web-app-capable', 'yes');
  upsertMeta('apple-mobile-web-app-title', brandData.name);
  upsertMeta('apple-mobile-web-app-status-bar-style', 'default');

  // Icons
  const iconSizes = [16, 32, 48, 64, 128, 192, 256, 512];
  iconSizes.forEach((size) => {
    upsertHeadLink({
      rel: 'icon',
      href: `${ENV.BASE_URL}/content/assets/img/icons/favicon-${size}.png`,
      attrs: { sizes: `${size}x${size}`, type: 'image/png' },
    });
  });

  // Apple touch icon
  upsertHeadLink({
    rel: 'apple-touch-icon',
    href: `${ENV.BASE_URL}/content/assets/img/icons/apple-touch-icon.png`,
    attrs: { sizes: '180x180' },
  });

  // SVG icon
  upsertHeadLink({
    rel: 'icon',
    href: `${ENV.BASE_URL}/content/assets/img/icons/favicon.svg`,
    attrs: { sizes: 'any', type: 'image/svg+xml' },
  });
}

// ===== Main Loader =====

/**
 * Load and update all head elements
 */
export async function loadHead() {
  if (window.__HEAD_LOADED) return;
  window.__HEAD_LOADED = true;

  log.time('loadHead');

  try {
    // Load data
    const [brandData, pageData] = await Promise.all([
      loadBrandData(),
      Promise.resolve(getPageData()),
    ]);

    const pageUrl = window.location.href.split('#')[0];

    // Update meta tags
    updateBasicMeta(pageData);
    updateSocialMeta(pageData, pageUrl);
    updateLocalSEO();

    // Update canonical (force prod in production)
    const forceProd = ENV.isProd;
    updateCanonicalLinks(forceProd);

    // Update PWA assets
    updatePWAAssets(brandData);

    // Push to dataLayer for GTM
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: 'pageMetadataReady',
      page_meta: {
        page_title: pageData.title,
        page_path: window.location.pathname,
        page_url: pageUrl,
        page_type: pageData.type,
        page_image: pageData.image,
        page_lang: 'de-DE',
      },
    });

    log.timeEnd('loadHead');
    log.info('Head loaded successfully');
  } catch (error) {
    log.error('Failed to load head:', error);
  }
}

// Auto-load on DOMContentLoaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadHead, { once: true });
} else {
  loadHead();
}
