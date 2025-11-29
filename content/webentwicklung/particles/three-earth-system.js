/**
 * Three.js Earth System - Orchestrator
 * Modularized architecture for better maintainability.
 * @version 9.2.0 - Added Page Visibility API support & Mobile Optimizations
 */

import { createLogger, getElementById, onResize, TimerManager } from '../shared-utilities.js';
import {
  getSharedState,
  loadThreeJS,
  registerParticleSystem,
  unregisterParticleSystem,
  sharedCleanupManager,
  sharedParallaxManager
} from './shared-particle-system.js';

import { CONFIG } from './earth/config.js';
import { setupScene, setupLighting, createAtmosphere } from './earth/scene.js';
import { createEarthSystem, createMoonSystem, createCloudLayer } from './earth/assets.js';
import { CameraManager } from './earth/camera.js';
import { StarManager, ShootingStarManager } from './earth/stars.js';
import {
  showLoadingState,
  hideLoadingState,
  showErrorState,
  PerformanceMonitor
} from './earth/ui.js';

const log = createLogger('ThreeEarthSystem');
const earthTimers = new TimerManager();

// Global instances for this module scope
let scene, camera, renderer, THREE_INSTANCE;
let earthMesh, moonMesh, cloudMesh;
let dayMaterial, nightMaterial;
let directionalLight, ambientLight;

// Sub-systems
let cameraManager, starManager, shootingStarManager, performanceMonitor;

// State
let sectionObserver, animationFrameId;
let currentSection = 'hero';
let currentQualityLevel = 'HIGH';
let isMobileDevice = false;
// Detected device capabilities for this session
let deviceCapabilities = null;

// ===== Main Manager =====

const ThreeEarthManager = (() => {
  const initThreeEarth = async () => {
    const sharedState = getSharedState();
    if (sharedState.systems.has('three-earth')) {
      log.debug('System already initialized');
      return cleanup;
    }

    const container = getElementById('threeEarthContainer');
    if (!container) {
      log.warn('Container not found');
      return () => {};
    }

    try {
      log.info('Initializing Three.js Earth System v9.2.0 (Modular)');

      // NEU: Device Detection & optimized config
      try {
        deviceCapabilities = detectDeviceCapabilities();
        const optimizedConfig = getOptimizedConfig(deviceCapabilities);
        log.info('Device capabilities:', deviceCapabilities);
        log.info('Using quality preset:', deviceCapabilities.recommendedQuality);
        // Apply optimized configuration
        Object.assign(CONFIG, optimizedConfig);
      } catch (e) {
        // non-fatal: log & continue with defaults
        log.debug('Device detection failed, using defaults', e);
      }
      registerParticleSystem('three-earth', { type: 'three-earth' });

      THREE_INSTANCE = await loadThreeJS();
      showLoadingState(container, 0);

      // Scene Setup
      isMobileDevice = !!(deviceCapabilities?.isMobile) || window.matchMedia('(max-width: 768px)').matches;
      const sceneObjects = setupScene(THREE_INSTANCE, container);
      scene = sceneObjects.scene;
      camera = sceneObjects.camera;
      renderer = sceneObjects.renderer;

      // Apply performance pixel ratio from CONFIG when set
      try {
        if (renderer && CONFIG.PERFORMANCE?.PIXEL_RATIO) {
          renderer.setPixelRatio(CONFIG.PERFORMANCE.PIXEL_RATIO);
        }
      } catch (e) {
        log.debug('Unable to set renderer pixel ratio', e);
      }

      // Loading Manager Setup
      const loadingManager = new THREE_INSTANCE.LoadingManager();
      
      loadingManager.onProgress = (url, itemsLoaded, itemsTotal) => {
        const progress = itemsLoaded / itemsTotal;
        showLoadingState(container, progress);
      };

      loadingManager.onLoad = () => {
        hideLoadingState(container);
      };

      loadingManager.onError = (url) => {
        log.warn('Error loading texture:', url);
      };

      // Stars
      starManager = new StarManager(THREE_INSTANCE, scene, camera, renderer);
      const starField = starManager.createStarField();
      setupStarParallax(starField);

      // Lighting
      const lights = setupLighting(THREE_INSTANCE, scene);
      directionalLight = lights.directionalLight;
      ambientLight = lights.ambientLight;

      // Assets - Pass loadingManager to all creators
      // We use Promise.all to start all loads, but the manager tracks individual texture progress
      const [earthAssets, moonLOD, cloudObj] = await Promise.all([
        createEarthSystem(THREE_INSTANCE, scene, renderer, isMobileDevice, loadingManager),
        createMoonSystem(THREE_INSTANCE, scene, renderer, isMobileDevice, loadingManager),
        createCloudLayer(THREE_INSTANCE, renderer, loadingManager, isMobileDevice)
      ]);

      earthMesh = earthAssets.earthMesh;
      dayMaterial = earthAssets.dayMaterial;
      nightMaterial = earthAssets.nightMaterial;
      moonMesh = moonLOD;
      cloudMesh = cloudObj;

      // Final Scene Assembly
      if (cloudMesh) {
        cloudMesh.position.copy(earthMesh.position);
        cloudMesh.scale.copy(earthMesh.scale);
        scene.add(cloudMesh);
      }

      const atmosphereMesh = createAtmosphere(THREE_INSTANCE, isMobileDevice);
      earthMesh.add(atmosphereMesh);

      // Managers
      cameraManager = new CameraManager(THREE_INSTANCE, camera);
      cameraManager.setupCameraSystem();

      setupUserControls(container);
      setupSectionDetection();

      performanceMonitor = new PerformanceMonitor(container, renderer, (level) => {
        currentQualityLevel = level;
        applyQualitySettings();
      });

      shootingStarManager = new ShootingStarManager(scene, THREE_INSTANCE);

      startAnimationLoop();
      setupResizeHandler();

      log.info('Initialization complete');
      return cleanup;
    } catch (error) {
      log.error('Initialization failed:', error);
      handleInitializationError(container, error);
      return () => {};
    }
  };

  const cleanup = () => {
    log.info('Cleaning up Earth system');

    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }

    // Removing Visibility Listener
    document.removeEventListener('visibilitychange', handleVisibilityChange);

    performanceMonitor?.cleanup();
    shootingStarManager?.cleanup();
    cameraManager?.cleanup();
    sectionObserver?.disconnect();
    earthTimers.clearAll();
    sharedCleanupManager.cleanupSystem('three-earth');

    if (scene) {
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => disposeMaterial(m));
          } else {
            disposeMaterial(obj.material);
          }
        }
      });
      while (scene.children.length > 0) {
        scene.remove(scene.children[0]);
      }
    }

    if (renderer) {
      renderer.dispose();
      renderer.forceContextLoss();
    }

    [dayMaterial, nightMaterial].forEach(disposeMaterial);

    scene = camera = renderer = null;
    earthMesh = moonMesh = cloudMesh = null;
    dayMaterial = nightMaterial = null;
    directionalLight = ambientLight = null;

    cameraManager = starManager = shootingStarManager = performanceMonitor = null;

    unregisterParticleSystem('three-earth');
    log.info('Cleanup complete');
  };

  function disposeMaterial(material) {
    if (!material) return;
    const textureProps = ['map', 'normalMap', 'bumpMap', 'envMap', 'emissiveMap', 'alphaMap'];
    textureProps.forEach((prop) => {
      if (material[prop]?.dispose) {
        material[prop].dispose();
        material[prop] = null;
      }
    });
    if (material.uniforms) {
      Object.values(material.uniforms).forEach((uniform) => {
        uniform.value?.dispose?.();
      });
    }
    material.dispose();
  }

  function handleInitializationError(container, error) {
    try {
      renderer?.dispose();
      sharedCleanupManager.cleanupSystem('three-earth');
    } catch (e) {
      log.error('Emergency cleanup failed:', e);
    }
    showErrorState(container, error, () => {
      cleanup();
      initThreeEarth();
    });
  }

  return { initThreeEarth, cleanup };
})();

// ===== Helpers =====

/**
 * Detect device capabilities for runtime optimizations
 * - Uses UA heuristics and modern APIs when available
 */
function detectDeviceCapabilities() {
  try {
    const ua = (navigator.userAgent || '').toLowerCase();
    const isMobile = /mobile|tablet|android|ios|iphone|ipad/i.test(ua);
    const isLowEnd = /android 4|android 5|cpu iphone os 9|cpu iphone os 10|cpu iphone os 11/i.test(ua);
    const hasSlowGPU = /mali|adreno\s?[34]|powervr sgx|intel hd/i.test(ua);

    // Detect via Device Memory API and Performance.memory when available
    const deviceMemory = navigator.deviceMemory || 0; // in GB
    const memLimit = (performance && performance.memory && performance.memory.jsHeapSizeLimit) || 0;
    const isLowMemory = (deviceMemory > 0 && deviceMemory < 1) || (memLimit > 0 && memLimit < 1073741824);

    const cores = navigator.hardwareConcurrency || 2;
    const isLowCores = cores <= 2;

    const recommendedQuality = isLowEnd || hasSlowGPU ? 'LOW' : (isMobile ? 'MEDIUM' : 'HIGH');

    return {
      isMobile,
      isLowEnd: isLowEnd || hasSlowGPU || isLowMemory || isLowCores,
      cores,
      deviceMemoryGB: deviceMemory || Math.round(memLimit / (1024 * 1024 * 1024)),
      recommendedQuality
    };
  } catch (e) {
    // Robust fallback: assume medium
    return { isMobile: false, isLowEnd: false, cores: 2, deviceMemoryGB: 0, recommendedQuality: 'MEDIUM' };
  }
}

/**
 * Based on detected capabilities, return a merged CONFIG used for optimized scene creation
 */
function getOptimizedConfig(capabilities) {
  const baseConfig = { ...CONFIG };
  if (!capabilities) return baseConfig;

  if (capabilities.isLowEnd) {
    return {
      ...baseConfig,
      EARTH: {
        ...baseConfig.EARTH,
        SEGMENTS: 24,
        SEGMENTS_MOBILE: 16
      },
      STARS: {
        ...baseConfig.STARS,
        COUNT: 1000
      },
      PERFORMANCE: {
        ...baseConfig.PERFORMANCE,
        PIXEL_RATIO: 1.0,
        TARGET_FPS: 30
      },
      CLOUDS: {
        ...baseConfig.CLOUDS,
        OPACITY: 0
      }
    };
  }

  if (capabilities.isMobile) {
    return {
      ...baseConfig,
      EARTH: {
        ...baseConfig.EARTH,
        SEGMENTS_MOBILE: 32
      },
      STARS: {
        ...baseConfig.STARS,
        COUNT: 2000
      },
      PERFORMANCE: {
        ...baseConfig.PERFORMANCE,
        PIXEL_RATIO: Math.min(window.devicePixelRatio || 1, 2.0)
      }
    };
  }

  return baseConfig;
}

function setupStarParallax(starField) {
  const parallaxHandler = (progress) => {
    // FIX: Check if starManager exists and has properties before accessing
    if (!starField || !starManager || (starManager.transition && starManager.transition.active)) return;
    
    starField.rotation.y = progress * Math.PI * 0.2;
    starField.position.z = Math.sin(progress * Math.PI) * 15;
  };
  sharedParallaxManager.addHandler(parallaxHandler, 'three-earth-stars');
}

function setupSectionDetection() {
  const sections = Array.from(document.querySelectorAll('section[id], div#footer-trigger-zone'));
  if (sections.length === 0) return;

  const mapId = (id) => (id === 'footer-trigger-zone' ? 'site-footer' : id);
  const OBSERVER_THRESHOLDS = Array.from({ length: 21 }, (_, i) => i / 20);

  sectionObserver = new IntersectionObserver(
    (entries) => {
      let best = null;
      for (const entry of entries) {
        if (!best || entry.intersectionRatio > best.intersectionRatio) {
          best = entry;
        }
      }

      if (!best) return;

      if (best.isIntersecting) {
        let newSection = mapId(best.target.id || '');

        if (!newSection) return;

        if (newSection !== currentSection) {
          const previousSection = currentSection;
          currentSection = newSection;

          if (cameraManager) cameraManager.updateCameraForSection(newSection);

          const isFeaturesToAbout = previousSection === 'features' && newSection === 'about';
          updateEarthForSection(newSection, { allowModeSwitch: isFeaturesToAbout });

          if (newSection === 'features' && starManager) {
            starManager.animateStarsToCards();
          } else if (previousSection === 'features' && starManager) {
            starManager.resetStarsToOriginal();
          }

          document
            .querySelector('.three-earth-container')
            ?.setAttribute('data-section', newSection);
        }
      }
    },
    { rootMargin: '-20% 0px -20% 0px', threshold: OBSERVER_THRESHOLDS }
  );

  sections.forEach((section) => sectionObserver.observe(section));
}

function updateEarthForSection(sectionName, options = {}) {
  if (!earthMesh) return;
  const allowModeSwitch = !!options.allowModeSwitch;

  const configs = {
    hero: {
      earth: { pos: { x: 1, y: -2.5, z: -1 }, scale: 1.3, rotation: 0 },
      moon: { pos: { x: -45, y: -45, z: -90 }, scale: 0.4 },
      mode: 'day'
    },
    features: {
      earth: { pos: { x: -7, y: -2, z: -4 }, scale: 0.7, rotation: 0 },
      moon: { pos: { x: 1, y: 2, z: -5 }, scale: 1.1 },
      mode: 'day'
    },
    about: {
      earth: { pos: { x: -1, y: -0.5, z: -1 }, scale: 1.0, rotation: Math.PI },
      moon: { pos: { x: -45, y: -45, z: -90 }, scale: 0.4 },
      mode: 'night'
    },
    contact: {
      earth: { pos: { x: 0, y: -1.5, z: 0 }, scale: 1.1, rotation: Math.PI / 2 },
      moon: { pos: { x: -45, y: -45, z: -90 }, scale: 0.4 },
      mode: 'day'
    }
  };

  const config = configs[sectionName === 'site-footer' ? 'contact' : sectionName] || configs.hero;

  earthMesh.userData.targetPosition = new THREE_INSTANCE.Vector3(
    config.earth.pos.x,
    config.earth.pos.y,
    config.earth.pos.z
  );
  earthMesh.userData.targetScale = config.earth.scale;
  earthMesh.userData.targetRotation = config.earth.rotation;

  if (moonMesh && config.moon) {
    moonMesh.userData.targetPosition = new THREE_INSTANCE.Vector3(
      config.moon.pos.x,
      config.moon.pos.y,
      config.moon.pos.z
    );
    moonMesh.userData.targetScale = config.moon.scale;
  }

  if (allowModeSwitch) {
    const newMode = earthMesh.userData.currentMode === 'night' ? 'day' : 'night';
    earthMesh.material = newMode === 'day' ? dayMaterial : nightMaterial;
    earthMesh.material.needsUpdate = true;
    earthMesh.userData.currentMode = newMode;

    if (cameraManager) cameraManager.setTargetOrbitAngle(newMode === 'day' ? 0 : Math.PI);
  }

  if (directionalLight && ambientLight) {
    const mode = earthMesh.userData.currentMode;
    if (mode === 'day') {
      directionalLight.intensity = CONFIG.LIGHTING.DAY.SUN_INTENSITY;
      ambientLight.intensity = CONFIG.LIGHTING.DAY.AMBIENT_INTENSITY;
      ambientLight.color.setHex(CONFIG.LIGHTING.DAY.AMBIENT_COLOR);
    } else {
      directionalLight.intensity = CONFIG.LIGHTING.NIGHT.SUN_INTENSITY;
      ambientLight.intensity = CONFIG.LIGHTING.NIGHT.AMBIENT_INTENSITY;
      ambientLight.color.setHex(CONFIG.LIGHTING.NIGHT.AMBIENT_COLOR);
    }
  }
}

function setupUserControls(container) {
  const onWheel = (e) => {
    if (cameraManager) cameraManager.handleWheel(e);
  };
  container.addEventListener('wheel', onWheel, { passive: true });
  sharedCleanupManager.addCleanupFunction(
    'three-earth',
    () => container.removeEventListener('wheel', onWheel),
    'wheel control'
  );
}

// Global Animation Loop Reference
let animate; 

function handleVisibilityChange() {
  if (document.hidden) {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
      log.debug('Tab hidden: paused animation loop');
    }
  } else {
    if (!animationFrameId && animate) {
      animate();
      log.debug('Tab visible: resumed animation loop');
    }
  }
}

function startAnimationLoop() {
  const clock = new THREE_INSTANCE.Clock();

  // Adaptation: frame skipping and conditional updates for low-end devices
  const capabilities = deviceCapabilities || detectDeviceCapabilities();
  let frameSkip = capabilities.isLowEnd ? 2 : 1; // skip every n-th frame if low-end
  let frameCounter = 0;

  animate = () => {
    animationFrameId = requestAnimationFrame(animate);
    frameCounter++;

    // Skip full update/render on low-end devices (adaptive)
    if (frameCounter % frameSkip !== 0) return;

    const elapsedTime = clock.getElapsedTime();

    // Conditional rotations and updates
    if (cloudMesh && frameCounter % 2 === 0) {
      cloudMesh.rotation.y += CONFIG.CLOUDS.ROTATION_SPEED;
    }

    if (moonMesh && frameCounter % 3 === 0) {
      moonMesh.rotation.y += CONFIG.MOON.ORBIT_SPEED;
    }

    if (starManager && !capabilities.isLowEnd) starManager.update(elapsedTime);

    // Emissive pulsing only on medium+ devices
    if (earthMesh?.userData.currentMode === 'night' && !capabilities.isLowEnd && frameCounter % 2 === 0) {
      const baseIntensity = CONFIG.EARTH.EMISSIVE_INTENSITY * 4.0;
      const pulseAmount = Math.sin(elapsedTime * CONFIG.EARTH.EMISSIVE_PULSE_SPEED) * CONFIG.EARTH.EMISSIVE_PULSE_AMPLITUDE * 2;
      earthMesh.material.emissiveIntensity = baseIntensity + pulseAmount;
    }

    if (cameraManager) cameraManager.updateCameraPosition();
    updateObjectTransforms();

    if (shootingStarManager && !capabilities.isLowEnd) shootingStarManager.update();
    if (performanceMonitor) performanceMonitor.update();

    renderer.render(scene, camera);
  };

  // Add listener for Page Visibility API
  document.addEventListener('visibilitychange', handleVisibilityChange);

  animate();
}

function updateObjectTransforms() {
  if (!earthMesh) return;

  if (earthMesh.userData.targetPosition) {
    earthMesh.position.lerp(earthMesh.userData.targetPosition, 0.04);
  }
  if (earthMesh.userData.targetScale) {
    const scaleDiff = earthMesh.userData.targetScale - earthMesh.scale.x;
    if (Math.abs(scaleDiff) > 0.001) {
      const newScale = earthMesh.scale.x + scaleDiff * 0.06;
      earthMesh.scale.set(newScale, newScale, newScale);
    }
  }
  if (earthMesh.userData.targetRotation !== undefined) {
    const rotDiff = earthMesh.userData.targetRotation - earthMesh.rotation.y;
    if (Math.abs(rotDiff) > 0.001) {
      earthMesh.rotation.y += rotDiff * 0.06;
    }
  }

  if (cloudMesh && earthMesh) {
    cloudMesh.position.copy(earthMesh.position);
    cloudMesh.scale.copy(earthMesh.scale);
  }

  if (moonMesh) {
    if (moonMesh.userData.targetPosition) {
      moonMesh.position.lerp(moonMesh.userData.targetPosition, 0.04);
    }
    if (moonMesh.userData.targetScale) {
      const moonScaleDiff = moonMesh.userData.targetScale - moonMesh.scale.x;
      if (Math.abs(moonScaleDiff) > 0.001) {
        const newMoonScale = moonMesh.scale.x + moonScaleDiff * 0.06;
        moonMesh.scale.set(newMoonScale, newMoonScale, newMoonScale);
      }
    }
  }
}

function applyQualitySettings() {
  const level = CONFIG.QUALITY_LEVELS[currentQualityLevel];
  if (cloudMesh) cloudMesh.visible = level.cloudLayer;
  if (shootingStarManager) shootingStarManager.disabled = !level.meteorShowers;
  try {
    if (renderer && CONFIG.PERFORMANCE?.PIXEL_RATIO) {
      renderer.setPixelRatio(CONFIG.PERFORMANCE.PIXEL_RATIO);
    }
  } catch (e) {
    log.debug('Unable to set PIXEL_RATIO during quality apply', e);
  }
}

function setupResizeHandler() {
  const handleResize = () => {
    const container = getElementById('threeEarthContainer');
    if (!container || !camera || !renderer) return;

    const width = container.clientWidth;
    const height = container.clientHeight;
    isMobileDevice = window.matchMedia('(max-width: 768px)').matches;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  };

  const resizeCleanup = onResize(handleResize, 100);
  sharedCleanupManager.addCleanupFunction('three-earth', resizeCleanup, 'resize handler');
}

// ===== Public API =====

export const { initThreeEarth, cleanup } = ThreeEarthManager;

export const EarthSystemAPI = {
  flyToPreset: (presetName) => {
    if (cameraManager) cameraManager.flyToPreset(presetName);
  },
  triggerMeteorShower: () => {
    shootingStarManager?.triggerShower();
  },
  getConfig: () => CONFIG,
  updateConfig: (updates) => {
    Object.assign(CONFIG, updates);
  }
};

export default ThreeEarthManager;

// Export for testing and usage
export { detectDeviceCapabilities, getOptimizedConfig };