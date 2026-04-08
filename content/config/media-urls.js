import { isLocalDevRuntime } from '../core/runtime-env.js';

export const R2_PUBLIC_BASE_URL = 'https://img.abdulkerimsesli.de';
export const R2_PUBLIC_ORIGIN = new URL(R2_PUBLIC_BASE_URL).origin;
export const R2_PROXY_BASE_PATH = '/r2-proxy';
export const R2_ICONS_BASE_URL = `${R2_PUBLIC_BASE_URL}/icons`;
export const R2_BLOG_BASE_URL = `${R2_PUBLIC_BASE_URL}/blog`;
export const R2_APP_PREVIEWS_BASE_URL = `${R2_PUBLIC_BASE_URL}/app`;

export const ICONS_VERSION = '20260221';
export const APP_PREVIEWS_VERSION = '20260221';
export const SAFARI_PINNED_TAB_VERSION = '20260306';

export const FAVICON_ICO_URL = buildIconUrl('favicon.ico');
export const FAVICON_512_URL = buildIconUrl('favicon-512.webp');
export const APPLE_TOUCH_ICON_URL = buildIconUrl('apple-touch-icon.webp');
export const SAFARI_PINNED_TAB_URL = buildIconUrl(
  'safari-pinned-tab.svg',
  SAFARI_PINNED_TAB_VERSION,
);

export const OG_HOME_IMAGE_URL = buildBlogUrl('og-home-800.png');
export const OG_PROJECTS_IMAGE_URL = buildBlogUrl('og-projekte-800.png');
export const OG_VIDEOS_IMAGE_URL = buildBlogUrl('og-videos-800.png');
export const OG_DESIGN_IMAGE_URL = buildBlogUrl('og-design-800.png');
export const OG_PHOTOGRAPHY_IMAGE_URL = buildBlogUrl('og-photography-800.png');
export const OG_REACT_IMAGE_URL = buildBlogUrl('og-react-800.png');
export const OG_THREEJS_IMAGE_URL = buildBlogUrl('og-threejs-800.png');
export const OG_SEO_IMAGE_URL = buildBlogUrl('og-seo-800.png');
export const OG_PWA_IMAGE_URL = buildBlogUrl('og-pwa-800.png');
export const OG_WEBCOMPONENTS_IMAGE_URL = buildBlogUrl(
  'og-webcomponents-800.png',
);
export const OG_CSS_IMAGE_URL = buildBlogUrl('og-css-800.png');
export const OG_PERFORMANCE_IMAGE_URL = buildBlogUrl('og-performance-800.png');
export const OG_TYPESCRIPT_IMAGE_URL = buildBlogUrl('og-typescript-800.png');

export const BLOG_POST_OG_IMAGE_URLS = Object.freeze({
  'react-no-build': OG_REACT_IMAGE_URL,
  'modern-ui-design': OG_DESIGN_IMAGE_URL,
  'visual-storytelling': OG_PHOTOGRAPHY_IMAGE_URL,
  'threejs-performance': OG_THREEJS_IMAGE_URL,
  'seo-technische-optimierung': OG_SEO_IMAGE_URL,
  'progressive-web-apps-2026': OG_PWA_IMAGE_URL,
  'web-components-zukunft': OG_WEBCOMPONENTS_IMAGE_URL,
  'css-container-queries': OG_CSS_IMAGE_URL,
  'javascript-performance-patterns': OG_PERFORMANCE_IMAGE_URL,
  'typescript-advanced-patterns': OG_TYPESCRIPT_IMAGE_URL,
});

function normalizeMediaText(value) {
  return String(value || '').trim();
}

function encodeMediaPathSegment(segment) {
  try {
    return encodeURIComponent(decodeURIComponent(segment));
  } catch {
    return encodeURIComponent(segment);
  }
}

function normalizeR2Path(pathname) {
  const rawPath = String(pathname || '')
    .trim()
    .replace(/^\/+/, '');

  if (!rawPath) return '';

  const normalizedSegments = rawPath
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeMediaPathSegment(segment));

  return normalizedSegments.length > 0
    ? `/${normalizedSegments.join('/')}`
    : '';
}

function normalizeSearch(search = '') {
  const normalized = normalizeMediaText(search);
  if (!normalized) return '';
  return normalized.startsWith('?') ? normalized : `?${normalized}`;
}

function buildVersionSearch(version) {
  const normalized = normalizeMediaText(version);
  return normalized ? `v=${normalized}` : '';
}

export function buildR2Url(pathname, search = '') {
  const normalizedPath = normalizeR2Path(pathname);
  if (!normalizedPath) return '';

  const mediaUrl = new URL(normalizedPath, `${R2_PUBLIC_BASE_URL}/`);
  const normalizedSearch = normalizeSearch(search);
  if (normalizedSearch) {
    mediaUrl.search = normalizedSearch;
  }

  return mediaUrl.toString();
}

export function buildIconUrl(filename, version = ICONS_VERSION) {
  return buildR2Url(`icons/${filename}`, buildVersionSearch(version));
}

export function buildBlogUrl(filename, search = '') {
  return buildR2Url(`blog/${filename}`, search);
}

export function getProjectPreviewName(project) {
  if (project && typeof project === 'object') {
    if (project.previewMedia === null || project.previewMedia === false) {
      return '';
    }

    return normalizeMediaText(
      project.previewMedia || project.dirName || project.name || project.id,
    );
  }

  return normalizeMediaText(project);
}

export function buildProjectPreviewUrl(
  project,
  version = APP_PREVIEWS_VERSION,
) {
  const previewName = getProjectPreviewName(project);
  if (!previewName) return '';
  return buildR2Url(`app/${previewName}.svg`, buildVersionSearch(version));
}

export function resolveR2Url(value, locationLike = globalThis.location) {
  const rawValue = normalizeMediaText(value);
  if (!rawValue) return '';

  try {
    const baseHref = locationLike?.href || `${R2_PUBLIC_BASE_URL}/`;
    const mediaUrl = new URL(rawValue, baseHref);

    if (mediaUrl.origin !== R2_PUBLIC_ORIGIN) {
      return rawValue;
    }

    if (!isLocalDevRuntime(locationLike)) {
      return mediaUrl.toString();
    }

    return `${R2_PROXY_BASE_PATH}${mediaUrl.pathname}${mediaUrl.search}`;
  } catch {
    return rawValue;
  }
}

export function resolveProjectPreviewUrl(
  project,
  locationLike = globalThis.location,
) {
  const configuredUrl = normalizeMediaText(project?.previewUrl);
  return resolveR2Url(
    configuredUrl || buildProjectPreviewUrl(project),
    locationLike,
  );
}

export function resolveR2Path(
  pathname,
  locationLike = globalThis.location,
  search = '',
) {
  const mediaUrl = buildR2Url(pathname, search);
  if (!mediaUrl) return '';
  return resolveR2Url(mediaUrl, locationLike);
}
