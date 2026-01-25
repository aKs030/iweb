/**
 * Head Manager - Unified Head Management
 * Replaces head-complete.js and head-loader.js with centralized modules
 * @version 1.0.0
 */

import { createLogger } from '/content/core/logger.js';
import { upsertMeta } from '/content/core/dom-helpers.js';
import { applyCanonicalLinks } from '/content/core/canonical-manager.js';
import { setupPWAAssets } from '/content/core/pwa-manager.js';
import {
  generateSchemaGraph,
  injectSchema,
  scheduleSchemaInjection,
} from '/content/core/schema.js';
import { loadBrandData } from '/content/config/brand-data-loader.js';
import { ROUTES } from '/content/config/routes-config.js';

const log = createLogger('HeadManager');

const BASE_URL = 'https://www.abdulkerimsesli.de';

/**
 * Get page data for current route
 * @returns {PageData}
 */
function getPageData() {
  const currentPath = globalThis.location.pathname.toLowerCase();
  const matchedKey = Object.keys(ROUTES).find(
    (key) => key !== 'default' && currentPath.includes(key),
  );

  const rawPageData = matchedKey ? ROUTES[matchedKey] : ROUTES.default;

  // i18n: Choose localized title/description
  const preferredLang = (
    document?.documentElement?.lang ||
    globalThis.navigator?.language ||
    'de'
  ).toLowerCase();
  const isEnglish = preferredLang.startsWith('en');

  const pageData = {
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

  // Allow partials to override via window.PAGE_META
  try {
    const partialMeta =
      globalThis.PAGE_META ||
      (function () {
        try {
          const el = document.querySelector(
            'script[type="application/json"][data-partial-meta]',
          );
          return el ? JSON.parse(el.textContent) : null;
        } catch {
          return null;
        }
      })();

    if (partialMeta && typeof partialMeta === 'object') {
      if (partialMeta.image && partialMeta.image.startsWith('/')) {
        partialMeta.image = `${BASE_URL}${partialMeta.image}`;
      }
      Object.assign(pageData, partialMeta);
    }
  } catch (e) {
    log.warn('Failed to merge partial PAGE_META:', e);
  }

  return pageData;
}

/**
 * Update basic meta tags
 * @param {PageData} pageData
 * @param {string} pageUrl
 */
function updateBasicMeta(pageData, pageUrl) {
  // Title
  if (pageData.title?.trim()) {
    document.title = pageData.title;
  }

  // Core meta tags
  upsertMeta('description', pageData.description);
  upsertMeta('robots', 'index, follow, max-image-preview:large');
  upsertMeta('viewport', 'width=device-width, initial-scale=1');
  upsertMeta('language', 'de-DE');
  upsertMeta('author', 'Abdulkerim Sesli');

  // Geo tags for local SEO
  upsertMeta('geo.region', 'DE-BE');
  upsertMeta('geo.placename', 'Berlin');
  upsertMeta('geo.position', '52.5733;13.2911');
  upsertMeta('ICBM', '52.5733, 13.2911');

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

    // Try to get real image dimensions
    fetch('/content/core/og-image-dimensions.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((map) => {
        if (!map) {
          upsertMeta('og:image:width', '1200', true);
          upsertMeta('og:image:height', '630', true);
          return;
        }
        const dims = map[pageData.image] || null;
        if (dims) {
          upsertMeta('og:image:width', String(dims.width), true);
          upsertMeta('og:image:height', String(dims.height), true);
        } else {
          upsertMeta('og:image:width', '1200', true);
          upsertMeta('og:image:height', '630', true);
        }
      })
      .catch(() => {
        upsertMeta('og:image:width', '1200', true);
        upsertMeta('og:image:height', '630', true);
      });
  }
}

/**
 * Push page metadata to dataLayer for GTM
 * @param {PageData} pageData
 * @param {string} pageUrl
 */
function pushToDataLayer(pageData, pageUrl) {
  try {
    globalThis.dataLayer = globalThis.dataLayer || [];
    globalThis.dataLayer.push({
      event: 'pageMetadataReady',
      page_meta: {
        page_title: pageData.title || document.title || '',
        page_path: globalThis.location.pathname || '/',
        page_url: pageUrl,
        page_type: pageData.type || 'WebPage',
        page_image: pageData.image || '',
        page_lang: 'de-DE',
      },
    });
  } catch (e) {
    log.warn('Failed to push page metadata to dataLayer:', e);
  }
}

/**
 * Main head loading function
 */
export async function loadHead() {
  // Skip if already loaded
  if (globalThis.SHARED_HEAD_LOADED) return;

  // Wait for head-inline.js to complete
  if (!globalThis.__HEAD_INLINE_READY) {
    await new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (globalThis.__HEAD_INLINE_READY) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 50);
      setTimeout(() => {
        clearInterval(checkInterval);
        log.warn('Timeout waiting for head-inline, proceeding anyway');
        resolve();
      }, 5000);
    });
  }

  try {
    log.time('loadHead');

    // Load data
    const brandData = await loadBrandData();
    const pageData = getPageData();
    const pageUrl = globalThis.location.href.split('#')[0];

    // Update meta tags
    updateBasicMeta(pageData, pageUrl);

    // Update canonical links
    applyCanonicalLinks();

    // Setup PWA assets
    setupPWAAssets(brandData);

    // Push to dataLayer
    pushToDataLayer(pageData, pageUrl);

    // Schedule schema injection
    scheduleSchemaInjection(() => {
      const graph = generateSchemaGraph(pageData, pageUrl, brandData, {
        doc: document,
        forceProdCanonical: false,
      });
      injectSchema(graph, 'head-manager-ldjson');
    });

    // Hide loader
    const hideLoader = () => {
      const el = document.getElementById('app-loader');
      if (!el) return;

      el.classList.add('fade-out');
      el.setAttribute('aria-hidden', 'true');
      Object.assign(el.style, {
        opacity: '0',
        pointerEvents: 'none',
        visibility: 'hidden',
      });

      setTimeout(() => {
        if (el) el.style.display = 'none';
      }, 800);
    };

    document.addEventListener('app:loaderHide', hideLoader, { once: true });

    globalThis.SHARED_HEAD_LOADED = true;
    log.timeEnd('loadHead');
    log.info('Head loaded successfully');
  } catch (error) {
    log.error('Failed to load head:', error);
  }
}

// Auto-load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadHead, { once: true });
} else {
  loadHead();
}
