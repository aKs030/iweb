/**
 * Projects Page Loader
 * @version 3.0.0
 * @last-modified 2026-01-31
 */

import { initReactProjectsApp } from './app.js';
import { createLogger } from '/content/core/logger.js';
import { updateLoader, hideLoader } from '/content/core/global-loader.js';
import { i18n } from '/content/core/i18n.js';

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
    // Ensure i18n is ready
    await i18n.init();

    updateLoader(0.1, i18n.t('loader.init'));

    // Initialize React Projects App
    updateLoader(0.4, i18n.t('loader.loading_app'));

    try {
      initReactProjectsApp();
    } catch (reactError) {
      log.error(`React App failed: ${reactError.message}`);
      throw reactError;
    }

    // Apply Three.js presets when loaded
    updateLoader(0.6, i18n.t('loader.config_3d'));
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

    updateLoader(0.9, i18n.t('loader.almost_ready'));

    setTimeout(() => {
      updateLoader(1, i18n.t('loader.ready'));
      hideLoader(100);
    }, 100);

    log.info('Projects page initialized successfully');
  } catch (error) {
    log.error('Projects page initialization failed:', error);
    updateLoader(1, i18n.t('loader.failed'));
    hideLoader(500);

    // Show error in the root element if app failed to initialize
    const rootEl = document.getElementById('root');
    if (rootEl && !rootEl.innerHTML.trim()) {
      rootEl.innerHTML = `
        <div style="padding: 2rem; text-align: center; color: #ef4444; background: rgba(0,0,0,0.8); border-radius: 1rem; margin: 2rem;">
          <h2>${i18n.t('error.load_failed_title')}</h2>
          <p><strong>${i18n.t('error.details')}:</strong> ${error.message}</p>
          <p><strong>${i18n.t('error.time')}:</strong> ${new Date().toLocaleTimeString()}</p>
          <button onclick="location.reload()" style="margin-top: 1rem; padding: 0.5rem 1rem; cursor: pointer; background: #4444ff; color: white; border: none; border-radius: 4px;">
            ${i18n.t('error.reload_page')}
          </button>
        </div>
      `;
    }
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
