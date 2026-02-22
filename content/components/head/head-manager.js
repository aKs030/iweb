/**
 * Head Manager - Unified Head Management
 * @version 1.1.0
 */

import { createLogger } from '../../core/logger.js';
import { upsertMeta } from '../../core/utils.js';
import { applyCanonicalLinks } from '../../core/canonical-manager.js';
import { setupPWAAssets } from '../../core/pwa-manager.js';
import {
  generateSchemaGraph,
  injectSchema,
  scheduleSchemaInjection,
} from '../../core/schema.js';
import { loadBrandData } from '../../config/brand-data-loader.js';
import { ROUTES } from '../../config/routes-config.js';
import { BASE_URL } from '../../config/constants.js';
import { headState } from './head-state.js';

const log = createLogger('HeadManager');
const BASE_KEYWORDS = [
  'Abdulkerim Sesli',
  'Abdülkerim Sesli',
  'Abdul Sesli',
  'Portfolio',
  'Webentwicklung',
  'Fotografie',
  'Bilder',
  'Videos',
  'Blog',
  'React',
  'Three.js',
  'JavaScript',
  'TypeScript',
  'Frontend',
  'UI',
  'SEO',
  'Google Bilder',
  'Google Videos',
  'KI Suche',
];

function pathTopics(pathname = '/') {
  const path = String(pathname || '/').toLowerCase();

  if (path === '/' || path === '') {
    return [
      'Hauptseite',
      'Portfolio Übersicht',
      'Bilder und Videos',
      'Blog Artikel',
      'Code Projekte',
    ];
  }
  if (path.startsWith('/blog')) {
    return [
      'Tech Blog',
      'Tutorial',
      'Performance',
      'SEO Inhalte',
      'Frontend Wissen',
    ];
  }
  if (path.startsWith('/videos')) {
    return [
      'Video Inhalte',
      'YouTube Videos',
      'Short Clips',
      'Making-of',
      'Video Landingpages',
    ];
  }
  if (path.startsWith('/gallery')) {
    return [
      'Bildgalerie',
      'Fotografie',
      'Portrait',
      'Street Photography',
      'Visuelle Serien',
    ];
  }
  if (path.startsWith('/projekte')) {
    return [
      'Code Projekte',
      'Web Apps',
      'Frontend Experimente',
      'JavaScript Projekte',
      'Interaktive Demos',
    ];
  }
  if (path.startsWith('/about')) {
    return [
      'Über Abdulkerim Sesli',
      'Profil',
      'Technischer Hintergrund',
      'Themenfelder',
    ];
  }

  return ['Portfolio', 'Web', 'Foto', 'Video'];
}

function extractHeadingTerms(doc) {
  const nodes = Array.from(
    doc?.querySelectorAll?.('main h1, main h2, main h3, main img[alt]') || [],
  );
  const tokens = [];

  for (const node of nodes) {
    const source =
      node.getAttribute?.('alt') ||
      node.textContent ||
      node.getAttribute?.('title');
    const words = String(source || '')
      .split(/[\s,.;:/()[\]|!?-]+/)
      .map((value) => value.trim())
      .filter((value) => value.length >= 3);
    tokens.push(...words);
  }

  const seen = new Set();
  const deduped = [];
  for (const token of tokens) {
    const normalized = token.toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    deduped.push(token);
    if (deduped.length >= 20) break;
  }

  return deduped;
}

function buildKeywordList(pageData, pageUrl) {
  const titleTokens = String(pageData?.title || '')
    .split(/[\s,.;:/()[\]|!?-]+/)
    .map((value) => value.trim())
    .filter((value) => value.length >= 3);
  const sectionTerms = pathTopics(new URL(pageUrl).pathname);
  const headingTerms = extractHeadingTerms(document);

  return Array.from(
    new Set([
      ...BASE_KEYWORDS,
      ...sectionTerms,
      ...titleTokens,
      ...headingTerms,
    ]),
  ).slice(0, 40);
}

function buildAbstractText(pageData, pageUrl) {
  const sectionTerms = pathTopics(new URL(pageUrl).pathname);
  return [
    pageData.description || '',
    `Inhaltsschwerpunkte: ${sectionTerms.join(', ')}.`,
    'Diese Seite ist auf organische Suche für Bilder, Videos und redaktionelle Inhalte optimiert.',
  ]
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
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
  const isEnglish = preferredLang.startsWith('en');

  let pageData = {
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

  return pageData;
};

const updateBasicMeta = (pageData, pageUrl) => {
  if (pageData.title?.trim()) {
    document.title = pageData.title;
  }

  const keywordList = buildKeywordList(pageData, pageUrl);
  const abstractText = buildAbstractText(pageData, pageUrl);

  const metaUpdates = [
    ['description', pageData.description],
    ['keywords', keywordList.join(', ')],
    ['subject', pathTopics(new URL(pageUrl).pathname).join(', ')],
    ['abstract', abstractText],
    ['summary', abstractText],
    ['robots', 'index, follow, max-image-preview:large'],
    ['language', 'de-DE'],
    ['author', 'Abdulkerim Sesli'],
    ['twitter:card', 'summary_large_image'],
    ['twitter:site', '@abdulkerimsesli'],
    ['twitter:creator', '@abdulkerimsesli'],
    ['twitter:title', pageData.title],
    ['twitter:description', pageData.description],
    ['twitter:url', pageUrl],
  ];

  metaUpdates.forEach(([name, content]) => upsertMeta(name, content));

  const ogUpdates = [
    ['og:type', 'website'],
    ['og:title', pageData.title],
    ['og:site_name', 'Abdulkerim Sesli — Digital Creator Portfolio'],
    ['og:description', pageData.description],
    ['og:locale', 'de_DE'],
    ['og:url', pageUrl],
  ];

  ogUpdates.forEach(([property, content]) =>
    upsertMeta(property, content, true),
  );

  if (pageData.image) {
    const imgAlt = pageData.title || pageData.description;
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
        page_lang: 'de-DE',
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

      setTimeout(() => (el.style.display = 'none'), 800);
    };

    document.addEventListener('app:loaderHide', hideLoader, { once: true });

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
