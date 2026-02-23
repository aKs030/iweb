import { createLogger } from './logger.js';
import { upsertHeadLink } from './utils.js';

const log = createLogger('CanonicalManager');
const BASE_URL = 'https://www.abdulkerimsesli.de';

function isLocalDevelopment() {
  const hostname = globalThis.location?.hostname?.toLowerCase() || '';
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.startsWith('192.168.')
  );
}

function isPreviewEnvironment() {
  const hostname = globalThis.location?.hostname?.toLowerCase() || '';
  return hostname.includes('.pages.dev') || hostname.includes('preview');
}

function computeCleanPath() {
  const rawPath = globalThis.location.pathname || '/';
  let cleanPath = rawPath
    .replace(/\/\/+/g, '/')
    .replace(/\/index\.html$/i, '/')
    .replace(/\.html$/i, '/');

  if (!cleanPath.startsWith('/')) cleanPath = '/' + cleanPath;
  if (!cleanPath.endsWith('/')) cleanPath += '/';

  return cleanPath;
}

function computeCanonicalQuerySuffix(pathname = globalThis.location.pathname) {
  const path = String(pathname || '');
  if (!/^\/projekte\/?$/i.test(path)) return '';

  const params = new URLSearchParams(globalThis.location.search || '');
  const app = String(params.get('app') || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '');
  if (!app) return '';

  return `?app=${encodeURIComponent(app)}`;
}

function computeCanonicalUrl({ forceProd = false, cleanPath = null }) {
  const path = cleanPath || computeCleanPath();
  const querySuffix = computeCanonicalQuerySuffix(globalThis.location.pathname);

  if (forceProd) {
    return `${BASE_URL}${path}${querySuffix}`;
  }

  const isDirtyPath =
    /^\/pages\//i.test(globalThis.location.pathname) ||
    /\/index\.html$/i.test(globalThis.location.pathname);

  if (isDirtyPath || querySuffix) {
    return `${globalThis.location.origin}${path}${querySuffix}`;
  }

  return globalThis.location.href.split('#')[0].split('?')[0];
}

function buildCanonicalLinks(options = {}) {
  const forceProd =
    options.forceProd ?? (!isLocalDevelopment() && !isPreviewEnvironment());
  const cleanPath = options.cleanPath || computeCleanPath();
  const querySuffix = computeCanonicalQuerySuffix(globalThis.location.pathname);

  const canonical = computeCanonicalUrl({ forceProd, cleanPath });
  const origin = forceProd ? BASE_URL : globalThis.location.origin;

  const alternates = [
    { lang: 'de', href: `${origin}${cleanPath}${querySuffix}` },
    { lang: 'en', href: `${origin}${cleanPath}${querySuffix}` },
    { lang: 'x-default', href: `${origin}${cleanPath}${querySuffix}` },
  ];

  return { canonical, alternates, origin };
}

export function applyCanonicalLinks(options = {}) {
  try {
    const { canonical, alternates } = buildCanonicalLinks(options);

    const canonicalEl = document.head.querySelector('link[rel="canonical"]');
    if (canonicalEl) {
      const currentHref = canonicalEl.getAttribute('href');
      if (currentHref !== canonical) {
        log.info('Updating canonical from', currentHref, 'to', canonical);
        canonicalEl.setAttribute('href', canonical);
      }
      canonicalEl.removeAttribute('data-early');
    } else {
      log.warn('No static canonical tag found, injecting dynamically');
      upsertHeadLink({ rel: 'canonical', href: canonical });
    }

    alternates.forEach(({ lang, href }) => {
      if (!href) return;
      const selector = `link[rel="alternate"][hreflang="${lang}"]`;
      let el = document.head.querySelector(selector);
      if (el) {
        el.setAttribute('href', href);
      } else {
        el = document.createElement('link');
        el.setAttribute('rel', 'alternate');
        el.setAttribute('hreflang', lang);
        el.setAttribute('href', href);
        document.head.appendChild(el);
      }
    });

    log.debug('Canonical links applied:', canonical);
  } catch (error) {
    log.error('Failed to apply canonical links:', error);
  }
}
