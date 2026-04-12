/**
 * Head Manager - Unified Head Management
 * @version 1.1.0
 */

import { createLogger } from '#core/logger.js';
import { upsertMeta } from '#core/dom-utils.js';
import { applyCanonicalLinks } from '#core/canonical-manager.js';
import { extractMainHeadingTerms } from '#core/content-extractors.js';
import {
  buildSeoAbstractText,
  buildSeoKeywordList,
  getSeoPageTopics,
} from '#core/schema-page-types.js';
import {
  generateSchemaGraph,
  injectSchema,
  scheduleSchemaInjection,
} from '#core/schema.js';
import { loadBrandData } from '../../config/brand-data-loader.js';
import { ROUTES } from '../../config/routes-config.js';
import { BASE_URL } from '../../config/constants.js';
import { SITE_NAME } from '../../config/site-seo.js';
import { headState } from './head-state.js';

const log = createLogger('HeadManager');

function getOpenGraphType(pageData) {
  const explicitType = String(pageData?.ogType || '').trim();
  if (explicitType) return explicitType;

  const semanticType = String(pageData?.type || '').toLowerCase();
  if (semanticType === 'blogposting' || semanticType === 'article') {
    return 'article';
  }
  if (semanticType === 'videoobject' || semanticType === 'video') {
    return 'video.other';
  }
  return 'website';
}

function resolveLanguageContext(preferredLang) {
  const normalizedLang = String(preferredLang || '').toLowerCase();
  const isEnglish = normalizedLang.startsWith('en');

  return {
    isEnglish,
    pageLang: isEnglish ? 'en-US' : 'de-DE',
    ogLocale: isEnglish ? 'en_US' : 'de_DE',
  };
}

const getPageData = () => {
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
  const { isEnglish, pageLang, ogLocale } =
    resolveLanguageContext(preferredLang);

  let pageData = {
    ...rawPageData,
    title:
      isEnglish && rawPageData.title_en
        ? rawPageData.title_en
        : rawPageData.title || '',
    description:
      isEnglish && rawPageData.description_en
        ? rawPageData.description_en
        : rawPageData.description || '',
  };

  try {
    const getPartialMeta = () => {
      try {
        const el = document.querySelector(
          'script[type="application/json"][data-partial-meta]',
        );
        return el ? JSON.parse(el.textContent) : null;
      } catch {
        return null;
      }
    };

    const partialMeta = globalThis.PAGE_META || getPartialMeta();

    if (partialMeta && typeof partialMeta === 'object') {
      if (partialMeta.image && partialMeta.image.startsWith('/')) {
        partialMeta.image = `${BASE_URL}${partialMeta.image}`;
      }
      pageData = { ...pageData, ...partialMeta };
    }
  } catch (e) {
    log.warn('Failed to merge partial PAGE_META:', e);
  }

  pageData.pageLang = pageLang;
  pageData.ogLocale = ogLocale;

  return pageData;
};

const updateBasicMeta = (pageData, pageUrl) => {
  if (pageData.title?.trim()) {
    document.title = pageData.title;
  }

  const appTitle = pageData.appTitle || pageData.title;
  const ogTitle = pageData.ogTitle || pageData.title;
  const ogDescription = pageData.ogDescription || pageData.description;
  const twitterTitle = pageData.twitterTitle || ogTitle || pageData.title;
  const twitterDescription =
    pageData.twitterDescription || ogDescription || pageData.description;
  const pathname = new URL(pageUrl).pathname;
  const keywordList = buildSeoKeywordList(
    pageData,
    pathname,
    extractMainHeadingTerms(document),
  );
  const abstractText = buildSeoAbstractText(pageData, pathname);

  const metaUpdates = [
    ['description', pageData.description],
    ['keywords', keywordList.join(', ')],
    ['subject', getSeoPageTopics(pathname).join(', ')],
    ['abstract', abstractText],
    ['summary', abstractText],
    ['robots', pageData.robots || 'index, follow, max-image-preview:large'],
    ['language', pageData.pageLang || 'de-DE'],
    ['author', 'Abdulkerim Sesli'],
    ['apple-mobile-web-app-title', appTitle],
    ['twitter:card', 'summary_large_image'],
    ['twitter:site', '@abdulkerimsesli'],
    ['twitter:creator', '@abdulkerimsesli'],
    ['twitter:title', twitterTitle],
    ['twitter:description', twitterDescription],
    ['twitter:url', pageUrl],
  ];

  metaUpdates.forEach(([name, content]) => upsertMeta(name, content));

  const ogUpdates = [
    ['og:type', getOpenGraphType(pageData)],
    ['og:title', ogTitle],
    ['og:site_name', SITE_NAME],
    ['og:description', ogDescription],
    ['og:locale', pageData.ogLocale || 'de_DE'],
    ['og:url', pageUrl],
  ];

  ogUpdates.forEach(([property, content]) =>
    upsertMeta(property, content, true),
  );

  if (pageData.image) {
    const imgAlt = pageData.imageAlt || pageData.title || pageData.description;
    upsertMeta('twitter:image', pageData.image);
    upsertMeta('twitter:image:alt', imgAlt);

    upsertMeta('og:image', pageData.image, true);
    upsertMeta('og:image:alt', imgAlt, true);
    upsertMeta('og:image:width', '1200', true);
    upsertMeta('og:image:height', '630', true);

    const ext = String(pageData.image).toLowerCase().split('.').pop();
    const typeMap = {
      png: 'image/png',
      webp: 'image/webp',
      svg: 'image/svg+xml',
    };
    upsertMeta('og:image:type', typeMap[ext] || 'image/jpeg', true);
  }
};

const pushToDataLayer = (pageData, pageUrl) => {
  try {
    const dl = (globalThis.dataLayer ??= []);
    dl.push({
      event: 'pageMetadataReady',
      page_meta: {
        page_title: pageData.title || document.title || '',
        page_path: globalThis.location.pathname || '/',
        page_url: pageUrl,
        page_type: pageData.type || 'WebPage',
        page_image: pageData.image || '',
        page_lang: pageData.pageLang || 'de-DE',
      },
    });
  } catch (e) {
    log.warn('Failed to push page metadata to dataLayer:', e);
  }
};

async function loadHead() {
  if (headState.isManagerLoaded()) return;

  // Wait for head-inline to be ready
  await headState.waitForInlineReady(5000);

  try {
    log.time('loadHead');

    const brandData = await loadBrandData();
    const pageData = getPageData();
    applyCanonicalLinks();
    const pageUrl =
      /** @type {any} */ (document.head.querySelector('link[rel="canonical"]'))
        ?.href || globalThis.location.href.split('#')[0];

    updateBasicMeta(pageData, pageUrl);
    pushToDataLayer(pageData, pageUrl);

    scheduleSchemaInjection(() => {
      const graph = generateSchemaGraph(pageData, pageUrl, brandData, {
        doc: document,
        forceProdCanonical: false,
      });
      injectSchema(graph, { scriptId: 'head-manager-ldjson' });
    });

    headState.setManagerLoaded();
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
