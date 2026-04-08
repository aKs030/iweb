import { isLocalDevHost } from '#core/runtime-env.js';
import { createLogger } from './logger.js';
import { upsertHeadLink } from './dom-utils.js';
import { buildProjectDetailPath, extractProjectSlug } from './project-paths.js';

const log = createLogger('CanonicalManager');
const BASE_URL = 'https://www.abdulkerimsesli.de';

function isLocalDevelopment() {
  return isLocalDevHost();
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

function computeProjectCanonicalPath() {
  const projectSlug = extractProjectSlug(
    globalThis.location.pathname || '/',
    globalThis.location.search || '',
  );
  return projectSlug ? buildProjectDetailPath(projectSlug) : '';
}

function computeCanonicalUrl({ forceProd = false, cleanPath = null }) {
  const path = cleanPath || computeProjectCanonicalPath() || computeCleanPath();

  if (forceProd) {
    return `${BASE_URL}${path}`;
  }

  const isDirtyPath =
    /^\/pages\//i.test(globalThis.location.pathname) ||
    /\/index\.html$/i.test(globalThis.location.pathname);

  if (isDirtyPath || path !== computeCleanPath()) {
    return `${globalThis.location.origin}${path}`;
  }

  return globalThis.location.href.split('#')[0].split('?')[0];
}

function buildCanonicalLinks(options = {}) {
  const forceProd =
    options.forceProd ?? (!isLocalDevelopment() && !isPreviewEnvironment());
  const cleanPath =
    options.cleanPath || computeProjectCanonicalPath() || computeCleanPath();

  const canonical = computeCanonicalUrl({ forceProd, cleanPath });
  const origin = forceProd ? BASE_URL : globalThis.location.origin;

  const alternates = [
    { lang: 'de', href: `${origin}${cleanPath}` },
    { lang: 'en', href: `${origin}${cleanPath}` },
    { lang: 'x-default', href: `${origin}${cleanPath}` },
  ];

  return { canonical, alternates, origin };
}

function upsertAlternateLanguageLink(lang, href) {
  if (!href) return;
  const selector = `link[rel="alternate"][hreflang="${lang}"]`;
  const existing = document.head.querySelector(selector);
  if (existing) return void existing.setAttribute('href', href);

  const el = document.createElement('link');
  el.setAttribute('rel', 'alternate');
  el.setAttribute('hreflang', lang);
  el.setAttribute('href', href);
  document.head.appendChild(el);
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

    alternates.forEach(({ lang, href }) =>
      upsertAlternateLanguageLink(lang, href),
    );

    log.debug('Canonical links applied:', canonical);
  } catch (error) {
    log.error('Failed to apply canonical links:', error);
  }
}
