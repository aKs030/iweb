/**
 * Projects Page Loader
 * @version 3.0.0
 * @last-modified 2026-01-31
 */

import { initProjectsApp } from './app.js';
import { createLogger } from '/content/core/logger.js';
import { updateLoader, hideLoader } from '/content/core/global-loader.js';

const log = createLogger('ProjectsLoader');

/**
 * Configure camera presets for Three.js Earth
 */
const configureCameraPresets = () => {
  try {
    const basePreset = {
      x: 7.5,
      y: 6.0,
      z: 8.5,
      lookAt: { x: 0, y: 0.0, z: 0 },
    };

    const baseRadius = Math.hypot(basePreset.x || 0, basePreset.z || 0) || 12;

    // Store presets globally for Three.js access
    const globalAny = /** @type {any} */ (globalThis);
    if (!globalAny.__projectCameraPresets) {
      globalAny.__projectCameraPresets = {};
    }

    // Generate presets for each project section
    for (let i = 1; i <= 10; i++) {
      const angle = i * 0.8;
      globalAny.__projectCameraPresets[`project-${i}`] = {
        x: Math.sin(angle) * baseRadius,
        z: Math.cos(angle) * baseRadius,
        y: Math.max(2, (basePreset.y || 5) + Math.sin(i * 1.5) * 3),
        lookAt: { x: 0, y: 0, z: 0 },
      };
    }

    // Hero and contact presets
    globalAny.__projectCameraPresets['hero'] = {
      x: -6.5,
      y: 4.8,
      z: 10.5,
      lookAt: { x: 0, y: -0.5, z: 0 },
    };

    globalAny.__projectCameraPresets['contact'] = {
      x: -0.5,
      y: 3.0,
      z: 9.5,
      lookAt: { x: 0, y: 0, z: 0 },
    };

    log.info('Camera presets configured');
  } catch (err) {
    log.warn('Could not configure camera presets:', err);
  }
};

/**
 * Apply presets to Three.js CONFIG
 */
const applyPresetsToThreeJS = async () => {
  try {
    const mod =
      await import('../../content/components/particles/three-earth-system.js');
    const config = mod?.EarthSystemAPI?.getConfig?.();
    const globalAny = /** @type {any} */ (globalThis);

    if (config?.CAMERA?.PRESETS && globalAny.__projectCameraPresets) {
      Object.assign(config.CAMERA.PRESETS, globalAny.__projectCameraPresets);
      log.info('Camera presets applied to Three.js CONFIG');
    }
  } catch (err) {
    log.debug('Could not apply presets to Three.js CONFIG:', err);
  }
};

/**
 * Initialize page with progress tracking
 */
const initPage = async () => {
  try {
    updateLoader(0.1, 'Initialisiere Projekte...');

    // 1. Initialize React App
    updateLoader(0.3, 'Lade Komponenten...');
    initProjectsApp();

    // 2. Apply Three.js presets when loaded
    updateLoader(0.6, 'Konfiguriere 3D-Ansicht...');
    if (document.readyState === 'complete') {
      await applyPresetsToThreeJS();
    } else {
      globalThis.addEventListener(
        'load',
        async () => {
          await applyPresetsToThreeJS();
        },
        { once: true },
      );
    }

    updateLoader(0.9, 'Fast fertig...');

    setTimeout(() => {
      updateLoader(1, 'Projekte bereit!');
      hideLoader(100);
    }, 100);

    log.info('Projects page initialized successfully');
  } catch (error) {
    log.error('Projects page initialization failed:', error);
    updateLoader(1, 'Fehler beim Laden');
    hideLoader(500);
  }
};

// Configure presets immediately
configureCameraPresets();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  globalThis.addEventListener('DOMContentLoaded', initPage, { once: true });
} else {
  initPage();
}
