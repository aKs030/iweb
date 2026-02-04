/**
 * Image Optimizer
 * Intelligentes Lazy Loading und moderne Bildformate (AVIF/WebP)
 * @author Abdulkerim Sesli
 * @version 1.0.0
 */

import { createLogger } from './logger.js';
import { observeOnce } from './intersection-observer.js';

const log = createLogger('ImageOptimizer');

/**
 * Bildformat-Unterstützung prüfen
 */
const checkFormatSupport = (() => {
  const cache = {};

  return async (format) => {
    if (cache[format] !== undefined) return cache[format];

    const testImages = {
      avif: 'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAIAAAACAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKCBgANogQEAwgMg8f8D///8WfhwB8+ErK42A=',
      webp: 'data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=',
    };

    if (!testImages[format]) {
      cache[format] = false;
      return false;
    }

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        cache[format] = img.width === 1;
        resolve(cache[format]);
      };
      img.onerror = () => {
        cache[format] = false;
        resolve(false);
      };
      img.src = testImages[format];
    });
  };
})();

/**
 * Optimierte Bild-URL generieren
 * @param {string} src - Original Bild-URL
 * @param {Object} options - Optionen
 * @returns {Promise<string>}
 */
export async function getOptimizedImageUrl(src, options = {}) {
  const { width, quality = 85, format = 'auto' } = options;

  // Für externe URLs (Unsplash, etc.) Parameter anhängen
  if (src.includes('unsplash.com')) {
    const url = new URL(src);
    if (width) url.searchParams.set('w', width);
    url.searchParams.set('q', quality);

    if (format === 'auto') {
      const supportsAvif = await checkFormatSupport('avif');
      const supportsWebp = await checkFormatSupport('webp');

      if (supportsAvif) url.searchParams.set('fm', 'avif');
      else if (supportsWebp) url.searchParams.set('fm', 'webp');
    } else if (format !== 'original') {
      url.searchParams.set('fm', format);
    }

    return url.toString();
  }

  // Für lokale Bilder: Prüfe ob optimierte Versionen existieren
  if (format === 'auto') {
    const supportsAvif = await checkFormatSupport('avif');
    const supportsWebp = await checkFormatSupport('webp');

    if (supportsAvif) {
      const avifSrc = src.replace(/\.(jpg|jpeg|png)$/i, '.avif');
      if (await imageExists(avifSrc)) return avifSrc;
    }

    if (supportsWebp) {
      const webpSrc = src.replace(/\.(jpg|jpeg|png)$/i, '.webp');
      if (await imageExists(webpSrc)) return webpSrc;
    }
  }

  return src;
}

/**
 * Prüfe ob Bild existiert
 */
async function imageExists(url) {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Create responsive image element with modern formats
 * @param {Object} config - Image configuration
 * @returns {Promise<HTMLPictureElement>}
 */
export async function createResponsiveImage(config) {
  const {
    src,
    alt = '',
    sizes = '100vw',
    widths = [320, 640, 960, 1280, 1920],
    loading = 'lazy',
    fetchpriority = 'auto',
    className = '',
    aspectRatio,
  } = config;

  const picture = document.createElement('picture');

  // AVIF Source
  const supportsAvif = await checkFormatSupport('avif');
  if (supportsAvif) {
    const avifSource = document.createElement('source');
    avifSource.type = 'image/avif';
    avifSource.srcset = await generateSrcset(src, widths, 'avif');
    avifSource.sizes = sizes;
    picture.appendChild(avifSource);
  }

  // WebP Source
  const supportsWebp = await checkFormatSupport('webp');
  if (supportsWebp) {
    const webpSource = document.createElement('source');
    webpSource.type = 'image/webp';
    webpSource.srcset = await generateSrcset(src, widths, 'webp');
    webpSource.sizes = sizes;
    picture.appendChild(webpSource);
  }

  // Fallback IMG
  const img = document.createElement('img');
  img.src = await getOptimizedImageUrl(src, { width: widths[2] });
  img.srcset = await generateSrcset(src, widths);
  img.sizes = sizes;
  img.alt = alt;
  img.loading = loading;
  img.decoding = 'async';

  if (fetchpriority !== 'auto') {
    img.fetchPriority = fetchpriority;
  }

  if (className) {
    img.className = className;
  }

  if (aspectRatio) {
    img.style.aspectRatio = aspectRatio;
  }

  picture.appendChild(img);

  return picture;
}

/**
 * Generiere srcset String
 */
async function generateSrcset(src, widths, format) {
  const srcsetParts = await Promise.all(
    widths.map(async (width) => {
      const url = await getOptimizedImageUrl(src, { width, format });
      return `${url} ${width}w`;
    }),
  );

  return srcsetParts.join(', ');
}

/**
 * Lazy load images with Intersection Observer
 * @param {string|HTMLElement|HTMLElement[]|NodeListOf<HTMLElement>} target - Selector or element(s)
 * @param {Object} options - Options
 */
export function lazyLoadImages(target, options = {}) {
  const {
    rootMargin = '50px',
    threshold = 0.01,
    placeholder = 'blur',
  } = options;

  let elements;
  if (typeof target === 'string') {
    elements = Array.from(document.querySelectorAll(target));
  } else if (target instanceof NodeList || Array.isArray(target)) {
    elements = Array.from(target);
  } else {
    elements = [target];
  }

  // Batch process images
  const imagesToLoad = elements.filter((el) => {
    if (!(el instanceof HTMLElement)) return false;
    return el.dataset.loaded !== 'true';
  });

  if (imagesToLoad.length === 0) return;

  imagesToLoad.forEach((el) => {
    const element = el;

    // Placeholder setzen
    if (placeholder === 'blur' && !element.style.filter) {
      element.style.filter = 'blur(10px)';
      element.style.transition = 'filter 0.3s ease-out';
    }

    observeOnce(
      element,
      async (entry) => {
        const img = entry.target;

        try {
          // Lade optimiertes Bild
          if (img.dataset.src) {
            const optimizedSrc = await getOptimizedImageUrl(img.dataset.src);
            img.src = optimizedSrc;
          } else if (!img.src) {
            // Skip if no src is available
            log.warn('Image has no src or data-src attribute');
            img.dataset.loaded = 'skipped';
            return;
          }

          if (img.dataset.srcset) {
            img.srcset = img.dataset.srcset;
          }

          // Warte auf Laden
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            // Timeout nach 10 Sekunden
            setTimeout(reject, 10000);
          });

          // Entferne Blur
          if (placeholder === 'blur') {
            img.style.filter = 'none';
          }

          img.dataset.loaded = 'true';
          img.classList.add('loaded');

          log.debug(`Image loaded: ${img.src}`);
        } catch (error) {
          // Only log error if we have a valid src
          if (img.src && img.src !== 'undefined') {
            log.error('Failed to load image:', error);
          }
          img.dataset.loaded = 'error';
          // Remove blur even on error
          if (placeholder === 'blur') {
            img.style.filter = 'none';
          }
        }
      },
      { rootMargin, threshold },
    );
  });
}

/**
 * Batch Lazy Loading for multiple images
 * @param {string} containerSelector - Container Selector
 * @param {Object} options - Options
 */
export function lazyLoadImagesInContainer(containerSelector, options = {}) {
  const container = document.querySelector(containerSelector);
  if (!container) {
    log.warn(`Container not found: ${containerSelector}`);
    return;
  }

  const images = container.querySelectorAll(
    'img[data-src], img[loading="lazy"]',
  );

  if (images.length === 0) {
    log.debug(`No lazy images found in ${containerSelector}`);
    return;
  }

  log.info(`Lazy loading ${images.length} images in ${containerSelector}`);
  lazyLoadImages(
    Array.from(images).filter((img) => img instanceof HTMLElement),
    options,
  );
}

/**
 * Preload kritische Bilder
 * @param {Array<string>} urls - Bild-URLs
 * @param {Object} options - Optionen
 */
export async function preloadImages(urls, options = {}) {
  const { as = 'image', fetchpriority = 'high' } = options;

  const promises = urls.map(async (url) => {
    const optimizedUrl = await getOptimizedImageUrl(url);

    // Link preload
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = as;
    link.href = optimizedUrl;
    link.fetchPriority = fetchpriority;

    // AVIF/WebP Support
    const supportsAvif = await checkFormatSupport('avif');
    const supportsWebp = await checkFormatSupport('webp');

    if (supportsAvif) {
      link.type = 'image/avif';
    } else if (supportsWebp) {
      link.type = 'image/webp';
    }

    document.head.appendChild(link);

    log.debug(`Preloading image: ${optimizedUrl}`);
  });

  await Promise.all(promises);
}

// Export Singleton-Funktionen
export default {
  getOptimizedImageUrl,
  createResponsiveImage,
  lazyLoadImages,
  lazyLoadImagesInContainer,
  preloadImages,
  checkFormatSupport,
};
