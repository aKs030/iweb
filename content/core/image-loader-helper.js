/**
 * Image Loader Helper
 * Vereinfachte API für Bildoptimierung in React/HTML
 * @author Abdulkerim Sesli
 * @version 1.0.0
 */

import { createLogger } from './logger.js';
import ImageOptimizer from './image-optimizer.js';

const log = createLogger('ImageLoaderHelper');

/**
 * Initialisiere Bildoptimierung für eine Seite
 * @param {Object} options - Optionen
 */
export async function initImageOptimization(options = {}) {
  const { autoOptimize = true, preloadCritical = true } = options;

  if (!autoOptimize) return;

  log.info('Initializing image optimization...');

  // Warte auf DOM ready
  if (document.readyState === 'loading') {
    await new Promise((resolve) => {
      document.addEventListener('DOMContentLoaded', resolve, { once: true });
    });
  }

  // Preload kritische Bilder
  if (preloadCritical) {
    const criticalImages = document.querySelectorAll(
      'img[fetchpriority="high"]',
    );
    if (criticalImages.length > 0) {
      const urls = Array.from(criticalImages)
        .map(
          (img) =>
            /** @type {HTMLImageElement} */(img).src ||
            /** @type {HTMLImageElement} */ (img).dataset.src,
        )
        .filter(Boolean);
      await ImageOptimizer.preloadImages(urls);
    }
  }

  // Lazy load andere Bilder
  ImageOptimizer.lazyLoadImagesInContainer('body', options);

  log.info('Image optimization initialized');
}
