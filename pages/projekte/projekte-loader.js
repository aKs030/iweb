import { initProjectsApp } from './projekte-app.js';
import { createLogger } from '/content/core/logger.js';
import { upsertHeadLink } from '/content/core/dom-helpers.js';
const log = createLogger('ProjektePage');

// Load styles for Three Earth (Progressive Enhancement)
async function ensureThreeEarthStyles() {
  const href = '/content/components/particles/three-earth.css';
  if (document.querySelector(`link[href="${href}"]`)) return;
  return new Promise((resolve, reject) => {
    upsertHeadLink({
      rel: 'stylesheet',
      href,
      attrs: { media: 'print' },
      onload() {
        try {
          this.media = 'all';
          resolve();
        } catch (e) {
          log.warn('Failed to set link.media', e);
          resolve();
        }
      },
    }) || resolve();
    // add a fallback to reject in case of persistent failure
    setTimeout(() => reject(new Error('stylesheet load timeout')), 5000);
  });
}

globalThis.addEventListener('DOMContentLoaded', async () => {
  // 1. React App starten
  initProjectsApp();

  // Lazy-load Three-Earth only when needed: on visibility or user interaction
  const threeContainer = document.getElementById('threeEarthContainer');

  const loadThreeEarth = async () => {
    if (globalThis.__threeEarthLoaded) return;
    globalThis.__threeEarthLoaded = true;
    try {
      const mod =
        await import('../../content/components/particles/three-earth-system.js');

      // Allow module to expose API and adjust presets before init
      try {
        const config = mod?.EarthSystemAPI?.getConfig?.();
        const basePreset =
          config?.CAMERA?.PRESETS?.features || config?.CAMERA?.PRESETS?.hero;
        if (basePreset) {
          const baseRadius =
            Math.hypot(basePreset.x || 0, basePreset.z || 0) || 12;
          for (let i = 1; i <= 10; i++) {
            const angle = i * 0.8;
            config.CAMERA.PRESETS[`project-${i}`] = {
              ...basePreset,
              x: Math.sin(angle) * baseRadius,
              z: Math.cos(angle) * baseRadius,
              y: Math.max(2, (basePreset.y || 5) + Math.sin(i * 1.5) * 3),
              lookAt: basePreset.lookAt,
            };
          }
        }
      } catch (err) {
        log.warn('Konnte Projekt-Presets nicht automatisch setzen', err);
      }

      try {
        await ensureThreeEarthStyles();
      } catch (e) {
        log.warn('three-earth stylesheet preload failed', e);
      }

      try {
        mod.initThreeEarth();
      } catch (e) {
        log.warn('three-earth init failed', e);
      }
    } catch (e) {
      log.warn('Failed to import three-earth module', e);
    }
  };

  // If IntersectionObserver is available, init when container gets close to viewport
  if ('IntersectionObserver' in globalThis && threeContainer) {
    // Inline one-shot helper to avoid relying on module imports in inline script
    function observeOnceInline(target, onIntersect, options = {}) {
      const obs = new IntersectionObserver((entries, o) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            try {
              onIntersect(entry);
            } finally {
              o.disconnect();
            }
            break;
          }
        }
      }, options);
      obs.observe(target);
      return () => obs.disconnect();
    }

    const ioDisconnect = observeOnceInline(
      threeContainer,
      () => loadThreeEarth(),
      { root: null, rootMargin: '200px', threshold: 0.05 },
    );

    // Immediate visibility check: if the container is already within the
    // rootMargin area, trigger load right away to avoid idle/observer delays.
    try {
      const rect = threeContainer.getBoundingClientRect();
      const withinMargin =
        rect.top < (globalThis.innerHeight || 0) + 200 && rect.bottom > -200;
      if (withinMargin) {
        loadThreeEarth();
        ioDisconnect();
      }
    } catch (e) {
      // ignore and rely on IntersectionObserver
    }
  } else {
    // Fallback: load after a short idle period
    setTimeout(loadThreeEarth, 3000);
  }

  // Also trigger on first user interaction to prioritise UX
  const userTrigger = () => {
    loadThreeEarth();
    globalThis.removeEventListener('scroll', userTrigger);
    globalThis.removeEventListener('touchstart', userTrigger);
    globalThis.removeEventListener('pointerdown', userTrigger);
  };
  globalThis.addEventListener('scroll', userTrigger, { passive: true });
  globalThis.addEventListener('touchstart', userTrigger, { passive: true });
  globalThis.addEventListener('pointerdown', userTrigger, { passive: true });
});
