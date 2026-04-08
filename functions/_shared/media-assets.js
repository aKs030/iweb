export const IMAGE_EXT_PATTERN = /\.(jpg|jpeg|png|webp|gif|svg)$/i;
export const VIDEO_EXT_PATTERN = /\.(mp4|webm)$/i;
export const GALLERY_MEDIA_EXT_PATTERN =
  /\.(jpg|jpeg|png|webp|gif|svg|mp4|webm)$/i;

export const PROXY_MEDIA_CONTENT_TYPES = new Map([
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.webp', 'image/webp'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'],
  ['.avif', 'image/avif'],
  ['.ico', 'image/x-icon'],
  ['.mp4', 'video/mp4'],
  ['.webm', 'video/webm'],
]);

export const PROJECT_APP_CONTENT_TYPES = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.map', 'application/json; charset=utf-8'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
  ['.ttf', 'font/ttf'],
  ['.wasm', 'application/wasm'],
  ...PROXY_MEDIA_CONTENT_TYPES,
]);

/**
 * @param {string | null | undefined} pathname
 * @returns {boolean}
 */
export function isImageMediaPath(pathname = '') {
  return IMAGE_EXT_PATTERN.test(String(pathname || ''));
}

/**
 * @param {string | null | undefined} pathname
 * @returns {boolean}
 */
export function isGalleryMediaPath(pathname = '') {
  return GALLERY_MEDIA_EXT_PATTERN.test(String(pathname || ''));
}

/**
 * @param {string | null | undefined} pathname
 * @returns {'image' | 'video'}
 */
export function inferGalleryAssetType(pathname = '') {
  return VIDEO_EXT_PATTERN.test(String(pathname || '')) ? 'video' : 'image';
}
