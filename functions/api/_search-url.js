/**
 * Search URL Utilities
 * Normalization, canonicalization, and category detection.
 */

const TOP_LEVEL_TITLE_MAP = {
  projekte: 'Projekte Übersicht',
  blog: 'Blog Übersicht',
  gallery: 'Galerie',
  videos: 'Videos Übersicht',
  about: 'Über mich',
  contact: 'Kontakt',
};

const URL_DESCRIPTION_FALLBACKS = {
  '/': 'Startseite mit 3D-Visualisierung, Portfolio und AI-Funktionen.',
  '/about':
    'Profil, Tech-Stack und beruflicher Hintergrund von Abdulkerim Sesli.',
  '/contact': 'Kontaktseite mit E-Mail und Formular fuer Anfragen.',
  '/projekte': 'Uebersicht interaktiver Web-Apps, Spiele und Tools.',
  '/blog': 'Technischer Blog zu Webentwicklung, Performance und AI.',
  '/gallery': 'Fotogalerie mit optimierten Bildformaten und Serien.',
  '/videos': 'Video-Portfolio mit Tutorials und Demonstrationen.',
  '/datenschutz': 'Datenschutzinformationen gemaess DSGVO.',
  '/impressum': 'Rechtliche Anbieterkennzeichnung und Kontaktdaten.',
};

function humanizeSlug(value) {
  return String(value || '')
    .replace(/[_+]/g, '-')
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
    .trim();
}

export function extractAppSlugFromUrl(url) {
  try {
    const parsed = new URL(String(url || ''), 'https://example.com');
    const app = parsed.searchParams.get('app');
    return app ? decodeURIComponent(app).trim() : '';
  } catch {
    return '';
  }
}

export function canonicalizeUrlPath(path) {
  if (!path) return '/';

  let normalized = String(path).trim();
  if (!normalized.startsWith('/')) {
    normalized = '/' + normalized;
  }

  if (normalized.endsWith('/index.html')) {
    normalized = normalized.substring(0, normalized.length - 11);
  } else if (normalized.endsWith('.html')) {
    normalized = normalized.substring(0, normalized.length - 5);
  }

  if (normalized === '') {
    return '/';
  }

  if (normalized !== '/' && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }

  return normalized;
}

/**
 * Normalize URL to prevent duplicates
 * removes domain/protocol/noisy params but keeps canonical app deep-link query.
 * @param {string} url - Original URL
 * @returns {string} Normalized URL path
 */
export function normalizeUrl(url) {
  if (!url) return '/';

  let normalized = String(url).replace(/^https?:\/\/[^/]+/i, '');
  if (!normalized.startsWith('/')) {
    normalized = '/' + normalized;
  }

  const hashIndex = normalized.indexOf('#');
  if (hashIndex >= 0) {
    normalized = normalized.slice(0, hashIndex);
  }

  const [rawPath, rawQuery = ''] = normalized.split('?');
  const path = canonicalizeUrlPath(rawPath);
  const params = new URLSearchParams(rawQuery);
  const app = String(params.get('app') || '').trim();

  // Keep app deep-links as distinct canonical URLs.
  if (path === '/projekte' && app) {
    return `/projekte/?app=${encodeURIComponent(app)}`;
  }

  return path;
}

function toBasePath(url) {
  const [path] = String(url || '').split('?');
  return canonicalizeUrlPath(path);
}

/**
 * Infer high-level category from URL path.
 * @param {string} url
 * @returns {string}
 */
export function detectCategory(url) {
  const path = toBasePath(url);
  if (path.includes('/projekte')) return 'Projekte';
  if (path.includes('/blog')) return 'Blog';
  if (path.includes('/gallery')) return 'Galerie';
  if (path.includes('/videos')) return 'Videos';
  if (path.includes('/about')) return 'Über mich';
  if (path.includes('/contact')) return 'Kontakt';
  if (path === '/') return 'Home';
  return 'Seite';
}

/**
 * Derive a human-readable title from filename/path.
 * @param {string} filename
 * @param {string} url
 * @returns {string}
 */
export function extractTitle(filename, url) {
  const appSlug = extractAppSlugFromUrl(url);
  if (appSlug) {
    return humanizeSlug(appSlug);
  }

  const title = filename?.split('/').pop()?.replace('.html', '') || '';

  if (title === 'index' || title === '' || !title) {
    const basePath = toBasePath(url);
    const segments = basePath.split('/').filter(Boolean);

    if (basePath === '/') {
      return 'Startseite';
    }

    if (segments.length === 1) {
      return (
        TOP_LEVEL_TITLE_MAP[segments[0]] ||
        segments[0].charAt(0).toUpperCase() + segments[0].slice(1)
      );
    }

    if (segments.length >= 2) {
      const lastSegment = segments[segments.length - 1];
      return lastSegment
        .split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    }
  }

  return title
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Check whether a token looks like an 11-char YouTube video ID.
 * @param {unknown} value
 * @returns {boolean}
 */
export function looksLikeVideoId(value) {
  return /^[a-zA-Z0-9_-]{11}$/.test(String(value || '').trim());
}

/**
 * Pick the best result title from AI metadata and fallback heuristics.
 * @param {object} item
 * @param {string} fallbackTitle
 * @param {string} url
 * @returns {string}
 */
export function chooseBestTitle(item, fallbackTitle, url) {
  const aiTitle =
    typeof item?.title === 'string' ? String(item.title).trim() : '';

  if (aiTitle && aiTitle.length > 2 && !looksLikeVideoId(aiTitle)) {
    return aiTitle;
  }

  const fallback = String(fallbackTitle || '').trim();
  if (url.includes('/videos/') && looksLikeVideoId(fallback)) {
    return `Video ${fallback}`;
  }

  return fallback || 'Unbenannt';
}

export function buildFallbackDescription(url, title, category) {
  const appSlug = extractAppSlugFromUrl(url);
  if (appSlug) {
    return `${title} · Interaktive Projekt-App mit eigenem Funktionsumfang.`;
  }

  const basePath = toBasePath(url);
  return URL_DESCRIPTION_FALLBACKS[basePath] || `${title} · ${category}`;
}
