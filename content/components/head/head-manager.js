/**
 * Head Manager - Unified Head Management
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
import { BASE_URL } from '/content/config/constants.js';

const log = createLogger('HeadManager');

function getPageData() {
  const currentPath = globalThis.location.pathname.toLowerCase();
  const matchedKey = Object.keys(ROUTES).find(
    (key) => key !== 'default' && currentPath.includes(key),
  );

  const rawPageData = matchedKey ? ROUTES[matchedKey] : ROUTES.default;

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

function updateBasicMeta(pageData, pageUrl) {
  if (pageData.title?.trim()) {
    document.title = pageData.title;
  }

  upsertMeta('description', pageData.description);
  upsertMeta('robots', 'index, follow, max-image-preview:large');
  upsertMeta('viewport', 'width=device-width, initial-scale=1');
  upsertMeta('language', 'de-DE');
  upsertMeta('author', 'Abdulkerim Sesli');

  upsertMeta('geo.region', 'DE-BE');
  upsertMeta('geo.placename', 'Berlin');
  upsertMeta('geo.position', '52.5733;13.2911');
  upsertMeta('ICBM', '52.5733, 13.2911');

  upsertMeta('twitter:card', 'summary_large_image');
  upsertMeta('twitter:creator', '@abdulkerimsesli');
  upsertMeta('twitter:url', pageUrl);
  if (pageData.image) {
    upsertMeta('twitter:image', pageData.image);
    upsertMeta('twitter:image:alt', pageData.title || pageData.description);
  }

  upsertMeta('og:title', pageData.title, true);
  upsertMeta('og:description', pageData.description, true);
  upsertMeta('og:locale', 'de_DE', true);
  upsertMeta('og:url', pageUrl, true);
  if (pageData.image) {
    upsertMeta('og:image', pageData.image, true);

    fetch('/content/assets/img/og/og-images-meta.json')
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

export async function loadHead() {
  if (globalThis.SHARED_HEAD_LOADED) return;

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

    const brandData = await loadBrandData();
    const pageData = getPageData();
    const pageUrl = globalThis.location.href.split('#')[0];

    updateBasicMeta(pageData, pageUrl);
    applyCanonicalLinks();
    setupPWAAssets(brandData);
    pushToDataLayer(pageData, pageUrl);

    scheduleSchemaInjection(() => {
      const graph = generateSchemaGraph(pageData, pageUrl, brandData, {
        doc: document,
        forceProdCanonical: false,
      });
      injectSchema(graph, 'head-manager-ldjson');
    });

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

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadHead, { once: true });
} else {
  loadHead();
}
