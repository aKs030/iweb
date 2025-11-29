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
let frameCount = 0;

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
      registerParticleSystem('three-earth', { type: 'three-earth' });

      THREE_INSTANCE = await loadThreeJS();
      showLoadingState(container, 0);

      // Scene Setup
      isMobileDevice = window.matchMedia('(max-width: 768px)').matches;
      const sceneObjects = setupScene(THREE_INSTANCE, container);
      scene = sceneObjects.scene;
      camera = sceneObjects.camera;
      renderer = sceneObjects.renderer;

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
      starManager = new StarManager(THREE_INSTANCE, scene, camera);
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

  animate = () => {
    animationFrameId = requestAnimationFrame(animate);
    frameCount++;
    const elapsedTime = clock.getElapsedTime();

    if (cloudMesh) cloudMesh.rotation.y += CONFIG.CLOUDS.ROTATION_SPEED;
    if (moonMesh) moonMesh.rotation.y += CONFIG.MOON.ORBIT_SPEED;

    if (starManager) starManager.update(elapsedTime);

    if (earthMesh?.userData.currentMode === 'night' && frameCount % 2 === 0) {
      const baseIntensity = CONFIG.EARTH.EMISSIVE_INTENSITY * 4.0;
      const pulseAmount =
        Math.sin(elapsedTime * CONFIG.EARTH.EMISSIVE_PULSE_SPEED) *
        CONFIG.EARTH.EMISSIVE_PULSE_AMPLITUDE *
        2;
      earthMesh.material.emissiveIntensity = baseIntensity + pulseAmount;
    }

    if (cameraManager) cameraManager.updateCameraPosition();
    updateObjectTransforms();

    if (shootingStarManager) shootingStarManager.update();
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