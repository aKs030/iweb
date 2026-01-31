import { initProjectsApp } from './projekte-app.js';
import { createLogger } from '/content/core/logger.js';
const log = createLogger('ProjektePage');

const initPage = async () => {
  // 1. React App starten
  initProjectsApp();

  // Note: Three.js Earth is now handled by main.js via ThreeEarthManager
  // We only need to configure project-specific camera presets here
  const configureProjectPresets = async () => {
    try {
      // Wait for Three.js module to be available
      const mod =
        await import('../../content/components/particles/three-earth-system.js');

      // Configure project-specific camera presets
      const config = mod?.EarthSystemAPI?.getConfig?.();
      const basePreset =
        config?.CAMERA?.PRESETS?.features || config?.CAMERA?.PRESETS?.hero;
      if (basePreset && config?.CAMERA?.PRESETS) {
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
        log.info('Project camera presets configured');
      }
    } catch (err) {
      log.debug(
        'Could not configure project presets (Three.js may not be loaded yet)',
        err,
      );
    }
  };

  // Configure presets when Three.js is ready
  if (document.readyState === 'complete') {
    configureProjectPresets();
  } else {
    globalThis.addEventListener('load', configureProjectPresets, {
      once: true,
    });
  }
};

// Initialize immediately if DOM is ready, otherwise wait for DOMContentLoaded
if (document.readyState === 'loading') {
  globalThis.addEventListener('DOMContentLoaded', initPage, { once: true });
} else {
  initPage();
}
