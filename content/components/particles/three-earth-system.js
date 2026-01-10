/**
 * Three.js Earth System - Orchestrator
 * Modularized architecture for better maintainability.
 * @version 11.0.0 - REFACTOR: Pure WebGL Implementation
 */

import {
  createLogger,
  getElementById,
  onResize,
  TimerManager,
  AppLoadManager,
} from '../../utils/shared-utilities.js';
import {
  getSharedState,
  loadThreeJS,
  registerParticleSystem,
  unregisterParticleSystem,
  sharedCleanupManager,
  sharedParallaxManager,
} from './shared-particle-system.js';

import { CONFIG } from './earth/config.js';
import { setupScene, setupLighting, createAtmosphere } from './earth/scene.js';
import {
  createEarthSystem,
  createMoonSystem,
  createCloudLayer,
} from './earth/assets.js';
import { CameraManager } from './earth/camera.js';
import { StarManager, ShootingStarManager } from './earth/stars.js';
import { CardManager } from './earth/cards.js';
import {
  showLoadingState,
  hideLoadingState,
  showErrorState,
  PerformanceMonitor,
} from './earth/ui.js';

const log = createLogger('ThreeEarthSystem');
const earthTimers = new TimerManager();

// Global instances for this module scope
let scene, camera, renderer, THREE_INSTANCE;
let earthMesh, moonMesh, cloudMesh;
let dayMaterial, nightMaterial;
let directionalLight, ambientLight;

// Sub-systems
let cameraManager,
  starManager,
  shootingStarManager,
  performanceMonitor,
  cardManager;

// State
let sectionObserver, viewportObserver, animationFrameId;
let currentSection = 'hero';
let currentQualityLevel = 'HIGH';
let isMobileDevice = false;
let isSystemVisible = true;
let deviceCapabilities = null;

// Showcase (ephemeral) state
let showcaseActive = false;
let showcaseTimeoutId = null;
const showcaseOriginals = {};

// Loading sync flags — ensure loader stays until first rendered frame
let assetsReady = false;
let firstFrameRendered = false;

// Flag to prevent zombie execution after cleanup
let isSystemActive = false;

// ===== Main Manager =====

export const initThreeEarth = async () => {
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

  // Set Active Flag
  isSystemActive = true;

  try {
    log.info('Initializing Three.js Earth System v11.0.0 (Pure WebGL)');

    // Device Detection & WebGL check
    if (!_detectAndEnsureWebGL(container)) return cleanup;

    _registerAndBlock();

    // Load Three.js with watchdog to avoid blocking the global loader
    THREE_INSTANCE = await loadThreeWithWatchdog(earthTimers, container);

    // CRITICAL CHECK: Did cleanup happen while awaiting ThreeJS?
    if (!isSystemActive) return cleanup;

    showLoadingState(container);

    // Scene Setup
    isMobileDevice =
      !!deviceCapabilities?.isMobile ||
      (globalThis.matchMedia?.('(max-width: 768px)')?.matches ?? false);

    const sceneObjects = setupScene(THREE_INSTANCE, container);
    scene = sceneObjects.scene;
    camera = sceneObjects.camera;
    renderer = sceneObjects.renderer;

    if (renderer && CONFIG.PERFORMANCE?.PIXEL_RATIO) {
      renderer.setPixelRatio(CONFIG.PERFORMANCE.PIXEL_RATIO);
    }

    const loadingManager = _createLoadingManager(THREE_INSTANCE, container);
    _setupStarsAndLighting(THREE_INSTANCE, scene, camera, renderer);

    // Assets Loading (moved to helper)
    const [earthAssets, moonLOD, cloudObj] = await loadAssets(
      THREE_INSTANCE,
      scene,
      renderer,
      isMobileDevice,
      loadingManager,
    );

    // CRITICAL CHECK
    if (!isSystemActive) {
      if (earthAssets.dayMaterial) earthAssets.dayMaterial.dispose();
      return cleanup;
    }

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

    // Managers and event wiring
    _initManagers(container);
    _setupManagersAndCards(container);
    // Setup showcase triggers and handlers
    _setupShowcaseTriggers();

    _finalizeInitialization(container);

    // Fire ready event immediately after successful initialization
    // This ensures main.js doesn't timeout waiting for the event
    try {
      container.dataset.threeReady = '1';
      document.dispatchEvent(
        new CustomEvent('three-ready', {
          detail: { containerId: container?.id ?? null },
        }),
      );
      log.debug('three-ready event dispatched after initialization');
    } catch (err) {
      log.warn('three-ready dispatch after init failed', err);
    }

    // Early unblock: Don't wait for first frame if everything else is ready
    // This prevents timeout warnings when the animation loop is slow to start
    try {
      AppLoadManager.unblock('three-earth');
      log.debug('Earth system unblocked early (pre-render)');
    } catch (err) {
      log.warn('Early unblock failed', err);
    }

    return cleanup;
  } catch (error) {
    log.error('Initialization failed:', error);
    try {
      if (renderer) renderer.dispose();
    } catch {
      /* ignore */
    }
    sharedCleanupManager.cleanupSystem('three-earth');
    showErrorState(container, error, () => {
      cleanup();
      initThreeEarth();
    });
    return () => {};
  }
};

export const cleanup = () => {
  isSystemActive = false;
  log.info('Cleaning up Earth system');

  // Remove interaction listeners first
  try {
    globalThis.removeEventListener('mousemove', onMove);
    globalThis.removeEventListener('click', onClick);
  } catch {
    /* ignore */
  }

  // Clear any pending showcase timers and revert temporary config if needed
  if (showcaseTimeoutId) {
    try {
      clearTimeout(showcaseTimeoutId);
    } catch {
      /* ignore */
    }
    showcaseTimeoutId = null;
  }

  if (showcaseActive) {
    // revert any temporary config we changed for the showcase
    try {
      if (showcaseOriginals.cloudSpeed !== undefined)
        CONFIG.CLOUDS.ROTATION_SPEED = showcaseOriginals.cloudSpeed;
      if (showcaseOriginals.emissiveAmp !== undefined)
        CONFIG.EARTH.EMISSIVE_PULSE_AMPLITUDE = showcaseOriginals.emissiveAmp;
    } catch {
      /* ignore */
    }
    showcaseActive = false;
  }

  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  document.removeEventListener('visibilitychange', handleVisibilityChange);

  performanceMonitor?.cleanup();
  shootingStarManager?.cleanup();
  cameraManager?.cleanup();
  starManager?.cleanup();
  sectionObserver?.disconnect();
  viewportObserver?.disconnect();
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
    scene.clear();
  }

  if (renderer) {
    renderer.dispose();
  }

  [dayMaterial, nightMaterial].forEach(disposeMaterial);

  scene = camera = renderer = null;
  earthMesh = moonMesh = cloudMesh = null;
  dayMaterial = nightMaterial = null;
  directionalLight = ambientLight = null;

  // Reset rendering sync flags
  assetsReady = false;
  firstFrameRendered = false;

  if (cardManager) cardManager.cleanup();
  cardManager = starManager = shootingStarManager = performanceMonitor = null;
  cameraManager = null;

  unregisterParticleSystem('three-earth');
  document.body.classList.remove('three-earth-active');
  log.info('Cleanup complete');
};

function disposeMaterial(material) {
  if (!material) return;
  const textureProps = [
    'map',
    'normalMap',
    'bumpMap',
    'envMap',
    'emissiveMap',
    'alphaMap',
  ];
  textureProps.forEach((prop) => {
    if (material[prop]?.dispose) {
      material[prop].dispose();
      material[prop] = null;
    }
  });
  if (material.uniforms) {
    Object.values(material.uniforms).forEach((uniform) => {
      if (uniform?.value && typeof uniform.value.dispose === 'function') {
        uniform.value.dispose();
      }
    });
  }
  material.dispose();
}

const ThreeEarthManager = { initThreeEarth, cleanup };

// ===== Helpers =====

function supportsWebGL() {
  try {
    const canvas = document.createElement('canvas');
    // Prefer WebGL2 when available
    const ctx2 = canvas.getContext('webgl2', {
      failIfMajorPerformanceCaveat: true,
    });
    if (ctx2) {
      try {
        ctx2.getExtension?.('EXT_color_buffer_float');
      } catch (err) {
        log.warn('getExtension ignored', err);
      }
      return true;
    }
    const ctx =
      canvas.getContext('webgl', { failIfMajorPerformanceCaveat: true }) ||
      canvas.getContext('experimental-webgl');
    return !!ctx;
  } catch {
    return false;
  }
}

// Prevent repeated WebGL init attempts in environments where WebGL is unavailable
let __three_webgl_tested = false;

// Load Three.js with a watchdog to avoid blocking the app loader
async function loadThreeWithWatchdog(earthTimers, container) {
  const THREE_LOAD_WATCH = 8000;
  let threeLoadWatchTimer = null;
  let loaded = false;

  try {
    threeLoadWatchTimer = earthTimers.setTimeout(() => {
      if (!loaded) {
        log.warn(
          'Three.js load taking too long — unblocking three-earth to avoid blocking global loader',
        );
        try {
          AppLoadManager.unblock('three-earth');
        } catch (err) {
          log.warn('AppLoadManager.unblock ignored', err);
        }
        try {
          showErrorState(container, new Error('Three.js load timeout'), () => {
            cleanup();
            initThreeEarth();
          });
        } catch (err) {
          log.warn('showErrorState fallback ignored', err);
        }
      }
    }, THREE_LOAD_WATCH);
  } catch (err) {
    log.warn('start watchdog ignored', err);
  }

  const THREE = await loadThreeJS();
  loaded = true;

  try {
    if (threeLoadWatchTimer) earthTimers.clearTimeout(threeLoadWatchTimer);
  } catch (err) {
    log.warn('clear watchdog timer failed', err);
  }

  return THREE;
}

function _createLoadingManager(THREE, container) {
  const loadingManager = new THREE.LoadingManager();

  loadingManager.onProgress = (_url, _itemsLoaded, _itemsTotal) => {
    if (!isSystemActive) return;
    try {
      const progress = Math.min(1, _itemsLoaded / Math.max(1, _itemsTotal));
      showLoadingState(container, progress);
    } catch (err) {
      log.debug('onProgress UI update failed', err);
    }
  };

  loadingManager.onLoad = () => {
    if (!isSystemActive) return;
    // Mark assets as ready; delay unblocking the global loader until the first
    // actual frame is rendered to avoid flashing/blank between loader and canvas
    assetsReady = true;

    // Note: three-ready event is now dispatched after full initialization
    // not here, to ensure all managers and handlers are set up first
    try {
      container.dataset.threeReady = '1';
    } catch (err) {
      log.warn('Failed to set threeReady dataset', err);
    }
  };

  loadingManager.onError = (url) => {
    log.warn('Error loading texture:', url);
    try {
      AppLoadManager.unblock('three-earth');
    } catch {
      /* ignore */
    }
  };

  return loadingManager;
}

function detectDeviceCapabilities() {
  try {
    const ua = (navigator.userAgent || '').toLowerCase();
    const isMobile = /mobile|tablet|android|ios|iphone|ipad/i.test(ua);
    const isLowEnd =
      /android 4|android 5|cpu iphone os 9|cpu iphone os 10/i.test(ua) ||
      (navigator.hardwareConcurrency || 4) <= 2;
    let recommendedQuality;
    if (isLowEnd) recommendedQuality = 'LOW';
    else if (isMobile) recommendedQuality = 'MEDIUM';
    else recommendedQuality = 'HIGH';
    return {
      isMobile,
      isLowEnd,
      recommendedQuality,
    };
  } catch {
    return { isMobile: false, isLowEnd: false, recommendedQuality: 'MEDIUM' };
  }
}

async function loadAssets(THREE, scene, renderer, isMobile, loadingManager) {
  return Promise.all([
    createEarthSystem(THREE, scene, renderer, isMobile, loadingManager),
    createMoonSystem(THREE, scene, renderer, isMobile, loadingManager),
    createCloudLayer(THREE, renderer, loadingManager, isMobile),
  ]);
}

function _setupStarsAndLighting(THREE, scene, camera, renderer) {
  try {
    starManager = new StarManager(THREE, scene, camera, renderer);
    const starField = starManager.createStarField();
    const parallaxHandler = (progress) => {
      if (!starField || !starManager || starManager.transition?.active) return;
      starField.rotation.y = progress * Math.PI * 0.2;
      starField.position.z = Math.sin(progress * Math.PI) * 15;
    };
    sharedParallaxManager.addHandler(parallaxHandler, 'three-earth-stars');

    const lights = setupLighting(THREE, scene);
    directionalLight = lights.directionalLight;
    ambientLight = lights.ambientLight;
  } catch (err) {
    log.warn('Stars/Lighting initialization ignored', err);
  }
}

function _finalizeInitialization(container) {
  startAnimationLoop();
  setupResizeHandler();
  setupInteraction();

  log.info('Initialization complete');

  // Note: three-ready event is now dispatched immediately after initialization
  // in initThreeEarth() to prevent timeout issues in main.js
  // This fallback is kept for backwards compatibility
  try {
    if (!container.dataset.threeReady) {
      container.dataset.threeReady = '1';
      document.dispatchEvent(
        new CustomEvent('three-ready', {
          detail: { containerId: container?.id ?? null },
        }),
      );
    }
  } catch (err) {
    log.warn('Failed to set fallback three-ready', err);
  }
}

function _bindInteractionHandlers(onMove, onClick) {
  // For closure-based handlers, always detach old handlers first to avoid duplicates.
  // Use weak references to avoid memory leaks if cleanup() is skipped.
  try {
    const prevMove = globalThis._threeEarthMove;
    const prevClick = globalThis._threeEarthClick;

    if (prevMove && prevMove !== onMove) {
      globalThis.removeEventListener('mousemove', prevMove);
    }
    if (prevClick && prevClick !== onClick) {
      globalThis.removeEventListener('click', prevClick);
    }
  } catch {
    /* ignore detach errors */
  }

  globalThis.addEventListener('mousemove', onMove);
  globalThis.addEventListener('click', onClick);

  // Store handlers for later cleanup. These are STRONG references (not WeakMap);
  // we rely on the cleanup() call to properly dispose them.
  // If cleanup() never runs, the old handlers remain but new ones still work.
  // Note: Handlers won't be GC'd while globalThis exists, but that's acceptable
  // because (1) there are at most 2 handlers, and (2) cleanup is called on page unload.
  globalThis._threeEarthMove = onMove;
  globalThis._threeEarthClick = onClick;

  sharedCleanupManager.addCleanupFunction(
    'three-earth',
    () => {
      globalThis.removeEventListener('mousemove', onMove);
      globalThis.removeEventListener('click', onClick);
    },
    'interaction',
  );
}

function _applyDeviceConfigSafely() {
  try {
    deviceCapabilities = detectDeviceCapabilities();
    const optimizedConfig = getOptimizedConfig(deviceCapabilities);
    Object.assign(CONFIG, optimizedConfig);
  } catch (e) {
    log.debug('Device detection failed, using defaults', e);
  }
}

function _ensureWebGLOrFallback(container, forceThree) {
  if (!__three_webgl_tested) {
    __three_webgl_tested = true;
    if (!forceThree && !supportsWebGL()) {
      log.warn(
        'WebGL not supported in this environment; skipping Three.js initialization',
      );
      // Add visible fallback to container so users see a friendly image/message
      try {
        container.classList.add('three-earth-unavailable');
        // Insert a fallback element if not present
        if (!container.querySelector('.three-earth-fallback')) {
          const fallback = document.createElement('div');
          fallback.className = 'three-earth-fallback';
          // role/aria labels are intentional and not replaced
          fallback.setAttribute('role', 'img');
          fallback.setAttribute(
            'aria-label',
            'Interaktive Darstellung wird nicht unterstützt. Statische Vorschau angezeigt.',
          );
          fallback.innerHTML = `
            <div class="three-earth-fallback__inner">
              <picture>
                <source type="image/avif" srcset="/content/assets/img/og/og-home@1600.avif 1600w, /content/assets/img/og/og-home@1200.avif 1200w, /content/assets/img/og/og-home@800.avif 800w, /content/assets/img/og/og-home@400.avif 400w" sizes="(max-width:1200px) 100vw, 1200px" />
                <source type="image/webp" srcset="/content/assets/img/og/og-home@1600.webp 1600w, /content/assets/img/og/og-home@1200.webp 1200w, /content/assets/img/og/og-home@800.webp 800w, /content/assets/img/og/og-home@400.webp 400w" sizes="(max-width:1200px) 100vw, 1200px" />
                <img src="/content/assets/img/og/og-home@1200.avif" srcset="/content/assets/img/og/og-home@1600.avif 1600w, /content/assets/img/og/og-home@1200.avif 1200w, /content/assets/img/og/og-home@800.avif 800w" sizes="(max-width:1200px) 100vw, 1200px" alt="Abdulkerim — Digital Creator Portfolio" width="1200" height="630" decoding="async" loading="eager" fetchpriority="high" />
              </picture>
              <p class="three-earth-fallback__text">Interaktive 3D‑Ansicht wird von Ihrem Gerät nicht unterstützt. Hier eine Vorschau.</p>
            </div>
          `;
          container.appendChild(fallback);
        }
      } catch (err) {
        log.warn('DOM insert ignored', err);
      }
      showErrorState(
        container,
        new Error('WebGL nicht verfügbar oder blockiert'),
      );
      // mark cleanup and exit gracefully
      sharedCleanupManager.cleanupSystem('three-earth');
      return false;
    }

    if (forceThree) {
      log.info(
        'Force flag detected: attempting to initialize Three.js despite WebGL checks',
      );
    }
  }
  return true;
}

function _detectAndEnsureWebGL(container) {
  try {
    _applyDeviceConfigSafely();
  } catch (err) {
    log.debug('Device detection failed in _detectAndEnsureWebGL', err);
  }

  const urlParams = new URL(location.href).searchParams;
  const forceThree =
    urlParams.get('forceThree') === '1' ||
    Boolean(globalThis.__FORCE_THREE_EARTH);

  return _ensureWebGLOrFallback(container, forceThree);
}

// Initialize managers and attach related event handlers
function _registerAndBlock() {
  registerParticleSystem('three-earth', { type: 'three-earth' });
  try {
    AppLoadManager.block('three-earth');
  } catch (err) {
    log.warn('AppLoadManager.block/unblock ignored', err);
  }
}

function _initManagers(container) {
  cameraManager = new CameraManager(THREE_INSTANCE, camera);
  cameraManager.setupCameraSystem();

  const onWheel = (e) => {
    if (isSystemActive) cameraManager?.handleWheel(e);
  };
  container.addEventListener('wheel', onWheel, { passive: true });
  sharedCleanupManager.addCleanupFunction(
    'three-earth',
    () => container.removeEventListener('wheel', onWheel),
    'wheel control',
  );
}

function getOptimizedConfig(capabilities) {
  if (!capabilities) return {};
  if (capabilities.isLowEnd) {
    return {
      EARTH: { ...CONFIG.EARTH, SEGMENTS: 24, SEGMENTS_MOBILE: 16 },
      STARS: { ...CONFIG.STARS, COUNT: 1000 },
      PERFORMANCE: { ...CONFIG.PERFORMANCE, PIXEL_RATIO: 1, TARGET_FPS: 30 },
      CLOUDS: { ...CONFIG.CLOUDS, OPACITY: 0 },
    };
  }
  if (capabilities.isMobile) {
    return {
      EARTH: { ...CONFIG.EARTH, SEGMENTS_MOBILE: 32 },
      STARS: { ...CONFIG.STARS, COUNT: 2000 },
      PERFORMANCE: {
        ...CONFIG.PERFORMANCE,
        PIXEL_RATIO: Math.min(globalThis.devicePixelRatio || 1, 2),
      },
    };
  }
  return {};
}

function setupSectionDetection() {
  const sections = Array.from(
    document.querySelectorAll('section[id], div#footer-trigger-zone'),
  );
  if (sections.length === 0) return;

  // Fallback when IntersectionObserver is not supported
  if (!('IntersectionObserver' in globalThis)) {
    log.warn('IntersectionObserver not supported - section detection disabled');
    return;
  }

  const OBSERVER_THRESHOLDS = Array.from({ length: 21 }, (_, i) => i / 20);

  sectionObserver = new IntersectionObserver(_onSectionObserverEntries, {
    rootMargin: '-20% 0px -20% 0px',
    threshold: OBSERVER_THRESHOLDS,
  });

  sections.forEach((section) => sectionObserver.observe(section));
}

function setupViewportObserver(container) {
  // Enhanced Viewport Observer with aggressive pause strategy
  // When Earth scrolls out of view, animation loop is paused to save CPU/GPU

  // Fallback for browsers without IntersectionObserver support
  if (!('IntersectionObserver' in globalThis)) {
    log.warn('IntersectionObserver not supported - animation stays active');
    isSystemVisible = true;
    if (!animationFrameId && animate && isSystemActive) {
      animate();
    }
    return;
  }

  viewportObserver = new IntersectionObserver(_onViewportEntries, {
    threshold: 0,
    rootMargin: '50px', // Small buffer to resume just before entering viewport
  });
  viewportObserver.observe(container);

  // Fallback: immediately check visibility to avoid cases where intersection
  // events fire only after a scroll or layout change. If container is already
  // in viewport, ensure render loop is running.
  try {
    const rect = container.getBoundingClientRect();
    const isVisibleNow =
      rect.top < globalThis.innerHeight &&
      rect.bottom > 0 &&
      rect.left < globalThis.innerWidth &&
      rect.right > 0;
    if (isVisibleNow) {
      isSystemVisible = true;
      if (!animationFrameId && animate && isSystemActive) {
        animate();
      }
    }
  } catch (err) {
    log.debug('Immediate visibility check failed', err);
  }
}

function updateEarthForSection(sectionName, options = {}) {
  if (!earthMesh || !isSystemActive) return;
  const allowModeSwitch = !!options.allowModeSwitch;

  const config = _getSectionConfig(sectionName);
  _applyConfigToMeshes(config);

  if (allowModeSwitch) {
    const newMode =
      earthMesh.userData.currentMode === 'night' ? 'day' : 'night';
    earthMesh.material = newMode === 'day' ? dayMaterial : nightMaterial;
    earthMesh.material.needsUpdate = true;
    earthMesh.userData.currentMode = newMode;
    cameraManager?.setTargetOrbitAngle(newMode === 'day' ? 0 : Math.PI);
  }

  if (directionalLight && ambientLight) {
    const mode = earthMesh.userData.currentMode;
    const lightingConfig =
      mode === 'day' ? CONFIG.LIGHTING.DAY : CONFIG.LIGHTING.NIGHT;
    directionalLight.intensity = lightingConfig.SUN_INTENSITY;
    ambientLight.intensity = lightingConfig.AMBIENT_INTENSITY;
    ambientLight.color.setHex(lightingConfig.AMBIENT_COLOR);
  }
}

function _getSectionConfig(sectionName) {
  const configs = {
    hero: {
      earth: { pos: { x: 1, y: -2.5, z: -1 }, scale: 1.3, rotation: 0 },
      moon: { pos: { x: -45, y: -45, z: -90 }, scale: 0.4 },
      mode: 'day',
    },
    features: {
      earth: { pos: { x: -7, y: -2, z: -4 }, scale: 0.7, rotation: 0 },
      moon: { pos: { x: 1, y: 2, z: -5 }, scale: 1.1 },
      mode: 'day',
    },
    section3: {
      earth: { pos: { x: -1, y: -0.5, z: -1 }, scale: 1, rotation: Math.PI },
      moon: { pos: { x: -45, y: -45, z: -90 }, scale: 0.4 },
      mode: 'night',
    },
    contact: {
      earth: {
        pos: { x: 0, y: -1.5, z: 0 },
        scale: 1.1,
        rotation: Math.PI / 2,
      },
      moon: { pos: { x: -45, y: -45, z: -90 }, scale: 0.4 },
      mode: 'day',
    },
  };

  return (
    configs[sectionName === 'site-footer' ? 'contact' : sectionName] ||
    configs.hero
  );
}

function _onSectionObserverEntries(entries) {
  let best = null;
  for (const entry of entries) {
    if (!best || entry.intersectionRatio > best.intersectionRatio) {
      best = entry;
    }
  }

  if (!best?.isIntersecting) return;

  // Sync feature cards entrance progress to how much the section intersects
  if (best.target.id === 'features' && cardManager) {
    cardManager.setProgress(best.intersectionRatio || 0);
  }

  const newSection = _mapId(best.target.id || '');
  if (!newSection) return;

  if (newSection !== currentSection) {
    const previousSection = currentSection;
    currentSection = newSection;

    cameraManager?.updateCameraForSection(newSection);

    const isFeaturesToAbout =
      previousSection === 'features' && newSection === 'section3';
    updateEarthForSection(newSection, { allowModeSwitch: isFeaturesToAbout });

    if (newSection === 'features') {
      cardManager?.setProgress(1);
    } else if (previousSection === 'features') {
      cardManager?.setProgress(0);
    }

    const container = document.querySelector('.three-earth-container');
    if (container) container.dataset.section = newSection;
  }
}

function _onViewportEntries(entries) {
  const entry = entries[0];
  isSystemVisible = entry.isIntersecting;
  if (isSystemVisible) {
    if (!animationFrameId && animate) {
      log.debug('Container visible: resuming render loop');
      animate();
    }
    return;
  }
  if (animationFrameId) {
    log.debug('Container hidden: pausing render loop');
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
}

function _mapId(id) {
  return id === 'footer-trigger-zone' ? 'site-footer' : id;
}

function _applyConfigToMeshes(config) {
  if (!config) return;
  earthMesh.userData.targetPosition = new THREE_INSTANCE.Vector3(
    config.earth.pos.x,
    config.earth.pos.y,
    config.earth.pos.z,
  );
  earthMesh.userData.targetScale = config.earth.scale;
  earthMesh.userData.targetRotation = config.earth.rotation;

  if (moonMesh && config.moon) {
    moonMesh.userData.targetPosition = new THREE_INSTANCE.Vector3(
      config.moon.pos.x,
      config.moon.pos.y,
      config.moon.pos.z,
    );
    moonMesh.userData.targetScale = config.moon.scale;
  }
}

// Global Animation Loop Reference
let animate;

function handleVisibilityChange() {
  // Enhanced Page Visibility API: Pause rendering when tab is inactive
  // This provides significant CPU/GPU/Battery savings on mobile devices
  if (document.hidden) {
    log.debug('Tab hidden - pausing Earth animation');
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    return;
  }
  // Resume animation only if:
  // 1. No animation is currently running
  // 2. The animate function exists
  // 3. The container is visible in viewport
  // 4. The system is still active
  log.debug('Tab visible - resuming Earth animation');
  if (!animationFrameId && animate && isSystemVisible && isSystemActive) {
    animate();
  }
}

function startAnimationLoop() {
  const clock = new THREE_INSTANCE.Clock();
  const capabilities = deviceCapabilities || detectDeviceCapabilities();
  const updateInterval = capabilities.isLowEnd ? 1 / 30 : 1 / 60; // seconds between heavy updates
  let updateAccumulator = 0;

  animate = () => {
    if (!isSystemActive) return;
    animationFrameId = requestAnimationFrame(animate);

    // Always measure delta/elapsed each frame
    const delta = clock.getDelta();
    updateAccumulator += delta;

    // Use delta time for consistent speed across all frame rates (60Hz vs 120Hz)
    const delta = clock.getDelta();
    const elapsedTime = clock.getElapsedTime();

    _advancePeriodicAnimations(frameCounter, elapsedTime, capabilities, delta);
    _updateNightPulse(elapsedTime, capabilities);
    _updateManagers(elapsedTime, capabilities, delta);
    _renderIfReady();
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);
  if (document.visibilityState === 'visible') animate();
}

function _advancePeriodicAnimations(frameCounter, elapsedTime, capabilities, delta) {
  // Normalize speeds to match original 60fps behavior:
  // Clouds: ran every 2nd frame (30fps effective) -> 30x multiplier
  // Moon: ran every 3rd frame (20fps effective) -> 20x multiplier
  if (cloudMesh) {
    cloudMesh.rotation.y += CONFIG.CLOUDS.ROTATION_SPEED * 30 * delta;
  }
  if (moonMesh) {
    moonMesh.rotation.y += CONFIG.MOON.ORBIT_SPEED * 20 * delta;
  }
  if (!capabilities.isLowEnd) starManager?.update(elapsedTime);
}

function _updateNightPulse(elapsedTime, capabilities) {
  if (earthMesh?.userData.currentMode === 'night' && !capabilities.isLowEnd) {
    const baseIntensity = CONFIG.EARTH.EMISSIVE_INTENSITY * 4;
    const pulseAmount =
      Math.sin(elapsedTime * CONFIG.EARTH.EMISSIVE_PULSE_SPEED) *
      CONFIG.EARTH.EMISSIVE_PULSE_AMPLITUDE *
      2;
    if (earthMesh?.material)
      earthMesh.material.emissiveIntensity = baseIntensity + pulseAmount;
  }
}

function _updateManagers(elapsedTime, capabilities, delta) {
  cameraManager?.updateCameraPosition();
  updateObjectTransforms();
  if (cardManager && globalThis.lastMousePos) {
    cardManager.update(elapsedTime * 1000, globalThis.lastMousePos);
  }
  if (!capabilities.isLowEnd) shootingStarManager?.update(delta);
  if (performanceMonitor) performanceMonitor.update();
}

function _renderIfReady() {
  if (renderer && scene && camera) {
    renderer.render(scene, camera);

    // If assets are loaded and this is the first rendered frame, hide the
    // global loader — this prevents the loader disappearing before the
    // canvas actually painted (avoids blank flashes). Also, only unblock the
    // AppLoadManager after the first visible frame to avoid revealing a
    // blank canvas when the global loader hides.
    try {
      if (assetsReady && !firstFrameRendered) {
        firstFrameRendered = true;
        const container = getElementById('threeEarthContainer');
        try {
          log.info('First rendered frame — hiding loader');
        } catch (e) {
          /* ignore */
        }
        try {
          hideLoadingState(container);
        } catch (err) {
          log.debug('post-render loader hide failed', err);
        }

        // Note: AppLoadManager.unblock is already called during initialization
        // No need to call it again here

        try {
          document.dispatchEvent(
            new CustomEvent('three-first-frame', {
              detail: { containerId: container?.id ?? null },
            }),
          );
        } catch (err) {
          log.warn('three-first-frame dispatch failed', err);
        }
      }
    } catch (err) {
      log.debug('post-render loader hide failed', err);
    }
  }
}

// Interaction handlers need to be persistent for attach/detach
let onMove, onClick;

function setupInteraction() {
  globalThis.lastMousePos = new THREE_INSTANCE.Vector2(-999, -999); // Default off-screen

  if (!onMove) {
    onMove = (event) => {
      if (!isSystemActive) return;
      globalThis.lastMousePos.x =
        (event.clientX / globalThis.innerWidth) * 2 - 1;
      globalThis.lastMousePos.y =
        -(event.clientY / globalThis.innerHeight) * 2 + 1;
    };
  }

  if (!onClick) {
    onClick = (event) => {
      if (!isSystemActive || !cardManager) return;
      const mouse = new THREE_INSTANCE.Vector2();
      mouse.x = (event.clientX / globalThis.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / globalThis.innerHeight) * 2 + 1;
      cardManager.handleClick(mouse);
    };
  }
  // Ensure fresh binding
  _bindInteractionHandlers(onMove, onClick);
}

function updateObjectTransforms() {
  if (!earthMesh) return;
  if (earthMesh.userData.targetPosition)
    earthMesh.position.lerp(earthMesh.userData.targetPosition, 0.04);
  if (earthMesh.userData.targetScale) {
    earthMesh.scale.x +=
      (earthMesh.userData.targetScale - earthMesh.scale.x) * 0.06;
    earthMesh.scale.y = earthMesh.scale.z = earthMesh.scale.x;
  }
  if (earthMesh.userData.targetRotation !== undefined) {
    const rotDiff = earthMesh.userData.targetRotation - earthMesh.rotation.y;
    if (Math.abs(rotDiff) > 0.001) earthMesh.rotation.y += rotDiff * 0.06;
  }
  if (cloudMesh && earthMesh) {
    cloudMesh.position.copy(earthMesh.position);
    cloudMesh.scale.copy(earthMesh.scale);
  }
  if (moonMesh) {
    if (moonMesh.userData.targetPosition)
      moonMesh.position.lerp(moonMesh.userData.targetPosition, 0.04);
    if (moonMesh.userData.targetScale) {
      moonMesh.scale.x +=
        (moonMesh.userData.targetScale - moonMesh.scale.x) * 0.06;
      moonMesh.scale.y = moonMesh.scale.z = moonMesh.scale.x;
    }
  }
}

function setupResizeHandler() {
  const handleResize = () => {
    const container = getElementById('threeEarthContainer');
    if (!container || !camera || !renderer) return;
    const width = container.clientWidth;
    const height = container.clientHeight;
    isMobileDevice =
      globalThis.matchMedia?.('(max-width: 768px)')?.matches ?? false;

    camera.aspect = width / height;
    // Adjust FOV for mobile to show more vertical content
    camera.fov = isMobileDevice ? 55 : CONFIG.CAMERA.FOV;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);

    if (starManager) starManager.handleResize(width, height);
  };
  const resizeCleanup = onResize(handleResize, 100);
  sharedCleanupManager.addCleanupFunction(
    'three-earth',
    resizeCleanup,
    'resize handler',
  );
}

function _setupManagersAndCards(container) {
  setupSectionDetection();
  setupViewportObserver(container);

  // Mark system as active for CSS
  document.body.classList.add('three-earth-active');

  performanceMonitor = new PerformanceMonitor(container, renderer, (level) => {
    currentQualityLevel = level;
    const levelCfg = CONFIG.QUALITY_LEVELS[currentQualityLevel];
    if (cloudMesh) cloudMesh.visible = levelCfg.cloudLayer;
    if (shootingStarManager)
      shootingStarManager.disabled = !levelCfg.meteorShowers;
    try {
      if (renderer && CONFIG.PERFORMANCE?.PIXEL_RATIO) {
        renderer.setPixelRatio(CONFIG.PERFORMANCE.PIXEL_RATIO);
      }
    } catch (e) {
      log.debug('Unable to set PIXEL_RATIO during quality apply', e);
    }
  });

  shootingStarManager = new ShootingStarManager(scene, THREE_INSTANCE);

  // Cards (Pure WebGL) — data-driven initialization
  const DEFAULT_FEATURES = [
    {
      title: 'Über mich',
      subtitle: 'ÜBER MICH',
      text: 'Kurz & knapp: Wer ich bin, was mich antreibt und meine Vision.',
      link: '/about/',
      iconChar: '👨‍💻',
      color: '#07a1ff',
    },
    {
      title: 'Projekte',
      subtitle: 'PROJEKTE',
      text: 'Auswahl an Projekten — Konzept, Umsetzung und Ergebnis.',
      link: '/projekte/',
      iconChar: '🚀',
      color: '#a107ff',
    },
    {
      title: 'Fotos',
      subtitle: 'FOTOS',
      text: 'Ausschnitte aus meiner Sicht der Welt.',
      link: '/gallery/',
      iconChar: '📸',
      color: '#ff07a1',
    },
    {
      title: 'Videos',
      subtitle: 'VIDEOS',
      text: 'Meine Videosammlung — Technik, Making-of und Stories.',
      link: '/videos/',
      iconChar: '🎬',
      color: '#07ffbc',
    },
    {
      title: 'Blog',
      subtitle: 'BLOG',
      text: 'Aktuelle Gedanken, Learnings und Updates rund um meine Arbeit.',
      link: '/blog/',
      iconChar: '📝',
      color: '#ffb807',
    },
  ];

  cardManager = new CardManager(THREE_INSTANCE, scene, camera, renderer);

  // Let the stars system use card mesh rects when available
  if (starManager && typeof starManager.setCardManager === 'function') {
    starManager.setCardManager(cardManager);
  }

  // Initialize exclusively from built-in data (WebGL-only)
  cardManager.initFromData(DEFAULT_FEATURES);

  // Keep a lightweight listener to ensure cards are present when the section is (no DOM parsing)
  const onSectionLoaded = (e) => {
    if (e.detail?.id === 'features' && cardManager) {
      cardManager.initFromData(DEFAULT_FEATURES);
    }
  };
  document.addEventListener('section:loaded', onSectionLoaded);
  sharedCleanupManager.addCleanupFunction(
    'three-earth',
    () => document.removeEventListener('section:loaded', onSectionLoaded),
    'section listener',
  );
}

function triggerShowcase(duration = 8000) {
  if (!isSystemActive || showcaseActive) return;
  if (deviceCapabilities?.isLowEnd) return; // avoid heavy effects on low-end devices
  showcaseActive = true;

  showcaseOriginals.cloudSpeed = CONFIG.CLOUDS.ROTATION_SPEED;
  showcaseOriginals.emissiveAmp = CONFIG.EARTH.EMISSIVE_PULSE_AMPLITUDE;

  // Intensify effects
  CONFIG.CLOUDS.ROTATION_SPEED = showcaseOriginals.cloudSpeed * 3;
  CONFIG.EARTH.EMISSIVE_PULSE_AMPLITUDE = showcaseOriginals.emissiveAmp * 3;

  // Camera nudge / dramatic orbit
  try {
    const cur = cameraManager?.cameraOrbitAngle || 0;
    cameraManager?.setTargetOrbitAngle(cur + Math.PI / 2);
  } catch {
    /* ignore */
  }

  // Trigger a few meteor showers spaced over the duration
  const showers = Math.max(2, Math.floor(duration / 2000));
  for (let i = 0; i < showers; i++) {
    setTimeout(() => shootingStarManager?.triggerShower(), i * 1200);
  }

  // Scale/emphasize the Earth briefly
  if (earthMesh) {
    const current = earthMesh.scale.x || 1;
    earthMesh.userData.targetScale = current * 1.06;
    setTimeout(() => {
      if (earthMesh) earthMesh.userData.targetScale = current;
    }, duration - 300);
  }

  // Revert after duration
  showcaseTimeoutId = setTimeout(() => {
    CONFIG.CLOUDS.ROTATION_SPEED =
      showcaseOriginals.cloudSpeed || CONFIG.CLOUDS.ROTATION_SPEED;
    CONFIG.EARTH.EMISSIVE_PULSE_AMPLITUDE =
      showcaseOriginals.emissiveAmp || CONFIG.EARTH.EMISSIVE_PULSE_AMPLITUDE;
    showcaseActive = false;
    showcaseTimeoutId = null;
  }, duration);
}

function _onThreeEarthShowcase(e) {
  try {
    const dur = e?.detail?.duration ?? 8000;
    triggerShowcase(dur);
  } catch (err) {
    log.warn('Showcase trigger failed', err);
  }
}

function _setupShowcaseTriggers() {
  document.addEventListener('three-earth:showcase', _onThreeEarthShowcase);
  sharedCleanupManager.addCleanupFunction(
    'three-earth',
    () =>
      document.removeEventListener(
        'three-earth:showcase',
        _onThreeEarthShowcase,
      ),
    'showcase listener',
  );
}
// ===== Public API =====

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
  },
  get shootingStarManager() {
    return shootingStarManager;
  },
};
export default ThreeEarthManager;
export {
  detectDeviceCapabilities,
  _createLoadingManager,
  _mapId,
  _onSectionObserverEntries,
  _detectAndEnsureWebGL,
};
