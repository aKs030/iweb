import { initProjectsApp } from './projekte-app.js';
import { createLogger } from '/content/core/logger.js';
const log = createLogger('ProjektePage');

// Configure project camera presets BEFORE Three.js initializes
// This ensures the presets are available when sections are detected
const configureProjectPresetsEarly = () => {
  try {
    // Access CONFIG directly before Three.js system loads
    const basePreset = {
      x: 7.5,
      y: 6.0,
      z: 8.5,
      lookAt: { x: 0, y: 0.0, z: 0 },
    };

    const baseRadius = Math.hypot(basePreset.x || 0, basePreset.z || 0) || 12;

    // Store presets in a global location that Three.js can access
    const globalAny = /** @type {any} */ (globalThis);
    if (!globalAny.__projectCameraPresets) {
      globalAny.__projectCameraPresets = {};
    }

    for (let i = 1; i <= 10; i++) {
      const angle = i * 0.8;
      globalAny.__projectCameraPresets[`project-${i}`] = {
        x: Math.sin(angle) * baseRadius,
        z: Math.cos(angle) * baseRadius,
        y: Math.max(2, (basePreset.y || 5) + Math.sin(i * 1.5) * 3),
        lookAt: { x: 0, y: 0, z: 0 },
      };
    }

    // Also add hero and contact presets for projekte page
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

    log.info('Project camera presets configured early');
  } catch (err) {
    log.warn('Could not configure project presets early', err);
  }
};

// Configure presets immediately
configureProjectPresetsEarly();

const initPage = async () => {
  // 1. React App starten
  initProjectsApp();

  // 2. Apply presets to CONFIG when Three.js loads
  const applyPresetsToConfig = async () => {
    try {
      const mod =
        await import('../../content/components/particles/three-earth-system.js');
      const config = mod?.EarthSystemAPI?.getConfig?.();
      const globalAny = /** @type {any} */ (globalThis);

      if (config?.CAMERA?.PRESETS && globalAny.__projectCameraPresets) {
        Object.assign(config.CAMERA.PRESETS, globalAny.__projectCameraPresets);
        log.info('Project camera presets applied to CONFIG');
      }
    } catch (err) {
      log.debug('Could not apply project presets to CONFIG', err);
    }
  };

  // Apply presets when page loads
  if (document.readyState === 'complete') {
    applyPresetsToConfig();
  } else {
    globalThis.addEventListener('load', applyPresetsToConfig, { once: true });
  }
};

// Initialize immediately if DOM is ready, otherwise wait for DOMContentLoaded
if (document.readyState === 'loading') {
  globalThis.addEventListener('DOMContentLoaded', initPage, { once: true });
} else {
  initPage();
}
