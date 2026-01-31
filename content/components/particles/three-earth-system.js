// @ts-check
/**
 * Three.js Earth System - Orchestrator
 * Modularized architecture for better maintainability.
 * @version 12.0.0 - MODERNIZED: Class-based Architecture
 */

import * as THREE from 'three';
import { createLogger } from '/content/core/logger.js';
import { getElementById, debounce } from '/content/core/utils.js';
import { createObserver } from '/content/core/intersection-observer.js';
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

/**
 * @typedef {import('/content/core/types.js').TimerID} TimerID
 * @typedef {import('/content/core/types.js').Vector2} Vector2
 * @typedef {import('/content/core/types.js').DeviceCapabilities} DeviceCapabilities
 */

// Helper: onResize
/**
 * @param {function} callback
 * @param {number} delay
 * @returns {function} cleanup function
 */
function onResize(callback, delay = 100) {
  const handler = debounce(callback, delay);
  window.addEventListener('resize', handler, { passive: true });
  return () => {
    window.removeEventListener('resize', handler);
  };
}

/**
 * Timer Manager Utility
 */
class TimerManager {
  constructor() {
    /** @type {Set<TimerID>} */
    this.timers = new Set();
    /** @type {Set<TimerID>} */
    this.intervals = new Set();
  }

  /**
   * @param {function} fn
   * @param {number} delay
   * @returns {TimerID}
   */
  setTimeout(fn, delay) {
    const id = /** @type {TimerID} */ (
      setTimeout(() => {
        // ✅ Guard clause: Check if timer is still active before executing
        if (this.timers.has(id)) {
          this.timers.delete(id);
          fn();
        }
      }, delay)
    );
    this.timers.add(id);
    return id;
  }

  /**
   * @param {function} fn
   * @param {number} delay
   * @returns {TimerID}
   */
  setInterval(fn, delay) {
    const id = /** @type {TimerID} */ (setInterval(fn, delay));
    this.intervals.add(id);
    return id;
  }

  /** @param {TimerID} id */
  clearTimeout(id) {
    clearTimeout(id);
    this.timers.delete(id);
  }

  /** @param {TimerID} id */
  clearInterval(id) {
    clearInterval(id);
    this.intervals.delete(id);
  }

  clearAll() {
    this.timers.forEach((id) => clearTimeout(id));
    this.intervals.forEach((id) => clearInterval(id));
    this.timers.clear();
    this.intervals.clear();
  }
}

/**
 * App Load Manager
 */
const AppLoadManager = {
  _blocked: new Set(),
  /** @param {string} key */
  block(key) {
    this._blocked.add(key);
  },
  /** @param {string} key */
  unblock(key) {
    this._blocked.delete(key);
  },
  isBlocked() {
    return this._blocked.size > 0;
  },
};

/**
 * Main Three Earth System Class
 */
class ThreeEarthSystem {
  constructor() {
    this.timers = new TimerManager();
    this.active = false;

    // Three.js Core
    /** @type {any} */ this.THREE = null;
    /** @type {any} */ this.scene = null;
    /** @type {any} */ this.camera = null;
    /** @type {any} */ this.renderer = null;

    // Objects
    /** @type {any} */ this.earthMesh = null;
    /** @type {any} */ this.moonMesh = null;
    /** @type {any} */ this.cloudMesh = null;

    // Materials
    /** @type {any} */ this.dayMaterial = null;
    /** @type {any} */ this.nightMaterial = null;

    // Lights
    /** @type {any} */ this.directionalLight = null;
    /** @type {any} */ this.ambientLight = null;

    // Managers
    /** @type {CameraManager|null} */ this.cameraManager = null;
    /** @type {StarManager|null} */ this.starManager = null;
    /** @type {ShootingStarManager|null} */ this.shootingStarManager = null;
    /** @type {PerformanceMonitor|null} */ this.performanceMonitor = null;
    /** @type {CardManager|null} */ this.cardManager = null;

    // State
    this.currentSection = 'hero';
    this.currentQualityLevel = 'HIGH';
    this.isMobileDevice = false;
    this.isVisible = true;
    this.deviceCapabilities = null;

    // Animation
    this.animationFrameId = 0;
    this.animate = null;

    // Loading
    this.assetsReady = false;
    this.firstFrameRendered = false;

    // Showcase
    this.showcaseActive = false;
    this.showcaseTimeoutId = 0;
    this.showcaseOriginals = {};

    // Handlers (bound)
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    this.onMove = this.onMove.bind(this);
    this.onClick = this.onClick.bind(this);
    this.onShowcaseTrigger = this.onShowcaseTrigger.bind(this);

    // Observers
    this.sectionObserver = null;
    this.viewportObserver = null;
  }

  async init() {
    const sharedState = getSharedState();
    if (sharedState.systems.has('three-earth')) {
      log.debug('System already initialized');
      return () => this.cleanup();
    }

    const container = getElementById('threeEarthContainer');
    if (!container) {
      log.warn('Container not found');
      return () => {};
    }

    this._clearFallbacks(container);
    this.active = true;

    try {
      log.info('Initializing Three.js Earth System v12.0.0 (Pure WebGL)');

      if (!this._detectAndEnsureWebGL(container)) return () => this.cleanup();

      this._registerAndBlock();

      this.THREE = await this._loadThreeWithWatchdog(container);
      if (!this.active) return () => this.cleanup();

      showLoadingState(container);

      this._detectDevice();

      const sceneObjects = setupScene(this.THREE, container);
      this.scene = sceneObjects.scene;
      this.camera = sceneObjects.camera;
      this.renderer = sceneObjects.renderer;

      if (this.renderer && CONFIG.PERFORMANCE?.PIXEL_RATIO) {
        this.renderer.setPixelRatio(CONFIG.PERFORMANCE.PIXEL_RATIO);
      }

      const loadingManager = this._createLoadingManager(container);
      this._setupStarsAndLighting();

      const [earthAssets, moonLOD, cloudObj] =
        await this._loadAssets(loadingManager);

      if (!this.active) {
        if (earthAssets.dayMaterial) earthAssets.dayMaterial.dispose();
        return () => this.cleanup();
      }

      this.earthMesh = earthAssets.earthMesh;
      this.dayMaterial = earthAssets.dayMaterial;
      this.nightMaterial = earthAssets.nightMaterial;
      this.moonMesh = moonLOD;
      this.cloudMesh = cloudObj;

      this._assembleScene();
      this._initManagers(container);
      this._setupManagersAndCards(container);
      this._setupShowcaseTriggers();
      this._finalizeInitialization(container);

      return () => this.cleanup();
    } catch (error) {
      this._handleInitError(container, error);
      return () => {};
    }
  }

  cleanup() {
    this.active = false;
    log.info('Cleaning up Earth system');

    this._removeInteractionHandlers();

    if (this.showcaseTimeoutId) clearTimeout(this.showcaseTimeoutId);
    if (this.showcaseActive) this._revertShowcaseConfig();

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = 0;
    }

    document.removeEventListener(
      'visibilitychange',
      this.handleVisibilityChange,
    );
    document.removeEventListener(
      'three-earth:showcase',
      this.onShowcaseTrigger,
    );

    this.performanceMonitor?.cleanup();
    this.shootingStarManager?.cleanup();
    this.cameraManager?.cleanup();
    this.starManager?.cleanup();

    // ✅ Explicit null assignment after disconnect
    if (this.sectionObserver) {
      this.sectionObserver.disconnect();
      this.sectionObserver = null;
    }
    if (this.viewportObserver) {
      this.viewportObserver.disconnect();
      this.viewportObserver = null;
    }

    this.timers.clearAll();
    sharedCleanupManager.cleanupSystem('three-earth');

    this._disposeScene();

    this.assetsReady = false;
    this.firstFrameRendered = false;

    if (this.cardManager) this.cardManager.cleanup();
    this.cardManager = null;

    unregisterParticleSystem('three-earth');
    document.body.classList.remove('three-earth-active');

    // Clear Singleton
    if (singleton === this) singleton = null;

    log.info('Cleanup complete');
  }

  // --- Internals ---

  _clearFallbacks(container) {
    try {
      container.classList.remove('three-earth-unavailable');
      container
        .querySelectorAll('.three-earth-fallback')
        .forEach((el) => el.remove());
    } catch {
      /* ignore */
    }
  }

  _detectDevice() {
    const caps = /** @type {DeviceCapabilities|undefined} */ (
      this.deviceCapabilities
    );
    this.isMobileDevice =
      !!caps?.isMobile ||
      (globalThis.matchMedia?.('(max-width: 768px)')?.matches ?? false);
  }

  async _loadThreeWithWatchdog(container) {
    const THREE_LOAD_WATCH = 8000;
    let loaded = false;

    const timer = this.timers.setTimeout(() => {
      if (!loaded) {
        log.warn('Three.js load timeout');
        try {
          AppLoadManager.unblock('three-earth');
        } catch {
          /* ignore */
        }
        this._handleInitError(container, new Error('Three.js load timeout'));
      }
    }, THREE_LOAD_WATCH);

    const THREE = await loadThreeJS();
    loaded = true;
    this.timers.clearTimeout(timer);
    return THREE;
  }

  _createLoadingManager(container) {
    const manager = new this.THREE.LoadingManager();

    manager.onProgress = (_url, loaded, total) => {
      if (!this.active) return;
      showLoadingState(container, Math.min(1, loaded / Math.max(1, total)));
    };

    manager.onLoad = () => {
      if (!this.active) return;
      this.assetsReady = true;
      try {
        container.dataset.threeReady = '1';
      } catch {
        /* ignore */
      }
    };

    manager.onError = (url) => {
      log.warn('Error loading texture:', url);
      AppLoadManager.unblock('three-earth');
    };

    return manager;
  }

  _registerAndBlock() {
    registerParticleSystem('three-earth', { type: 'three-earth' });
    AppLoadManager.block('three-earth');
  }

  async _loadAssets(loadingManager) {
    return Promise.all([
      createEarthSystem(
        this.THREE,
        this.scene,
        this.renderer,
        this.isMobileDevice,
        loadingManager,
      ),
      createMoonSystem(
        this.THREE,
        this.scene,
        this.renderer,
        this.isMobileDevice,
        loadingManager,
      ),
      createCloudLayer(
        this.THREE,
        this.renderer,
        loadingManager,
        this.isMobileDevice,
      ),
    ]);
  }

  _setupStarsAndLighting() {
    try {
      this.starManager = new StarManager(
        this.THREE,
        this.scene,
        this.camera,
        this.renderer,
      );
      const starField = this.starManager.createStarField();

      sharedParallaxManager.addHandler((progress) => {
        if (
          !starField ||
          !this.starManager ||
          this.starManager.transition?.active
        )
          return;
        starField.rotation.y = progress * Math.PI * 0.2;
        starField.position.z = Math.sin(progress * Math.PI) * 15;
      }, 'three-earth-stars');

      const lights = setupLighting(this.THREE, this.scene);
      this.directionalLight = lights.directionalLight;
      this.ambientLight = lights.ambientLight;
    } catch (err) {
      log.warn('Stars/Lighting init ignored', err);
    }
  }

  _assembleScene() {
    if (this.cloudMesh) {
      this.cloudMesh.position.copy(this.earthMesh.position);
      this.cloudMesh.scale.copy(this.earthMesh.scale);
      this.scene.add(this.cloudMesh);
    }
    const atmosphere = createAtmosphere(this.THREE, this.isMobileDevice);
    this.earthMesh.add(atmosphere);
  }

  _initManagers(container) {
    this.cameraManager = new CameraManager(this.THREE, this.camera);
    this.cameraManager.setupCameraSystem();

    const onWheel = (e) => {
      if (this.active) this.cameraManager?.handleWheel(e);
    };
    container.addEventListener('wheel', onWheel, { passive: true });
    sharedCleanupManager.addCleanupFunction(
      'three-earth',
      () => {
        container.removeEventListener('wheel', onWheel);
      },
      'wheel control',
    );
  }

  _setupManagersAndCards(container) {
    this._setupSectionDetection();
    this._setupViewportObserver(container);

    document.body.classList.add('three-earth-active');

    this.performanceMonitor = new PerformanceMonitor(
      container,
      this.renderer,
      (level) => {
        this.currentQualityLevel = level;
        const cfg = CONFIG.QUALITY_LEVELS[level];
        if (this.cloudMesh) this.cloudMesh.visible = cfg.cloudLayer;
        if (this.shootingStarManager)
          this.shootingStarManager.disabled = !cfg.meteorShowers;
      },
    );

    this.shootingStarManager = new ShootingStarManager(this.scene, this.THREE);

    this.cardManager = new CardManager(
      this.THREE,
      this.scene,
      this.camera,
      this.renderer,
    );

    if (this.starManager && 'setCardManager' in this.starManager) {
      this.starManager.setCardManager(this.cardManager);
    }

    this.cardManager.initFromData(this._getCardData());
  }

  _getCardData() {
    return [
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
  }

  _finalizeInitialization(container) {
    this._startAnimationLoop();
    this._setupResizeHandler(container);
    this._setupInteraction();

    log.info('Initialization complete');

    try {
      container.dataset.threeReady = '1';
      document.dispatchEvent(
        new CustomEvent('three-ready', {
          detail: { containerId: container.id },
        }),
      );
    } catch {
      /* ignore */
    }
  }

  // --- Interaction & Events ---

  _setupInteraction() {
    const global =
      /** @type {import('/content/core/types.js').GlobalThisExtended & typeof globalThis} */ (
        globalThis
      );
    global.lastMousePos = new this.THREE.Vector2(-999, -999);

    window.addEventListener('mousemove', this.onMove);
    window.addEventListener('click', this.onClick);

    // We don't use globalThis._threeEarthMove anymore
  }

  _removeInteractionHandlers() {
    window.removeEventListener('mousemove', this.onMove);
    window.removeEventListener('click', this.onClick);
  }

  onMove(event) {
    if (!this.active) return;
    const global =
      /** @type {import('/content/core/types.js').GlobalThisExtended & typeof globalThis} */ (
        globalThis
      );
    if (global.lastMousePos) {
      global.lastMousePos.x = (event.clientX / window.innerWidth) * 2 - 1;
      global.lastMousePos.y = -(event.clientY / window.innerHeight) * 2 + 1;
    }
  }

  onClick(event) {
    if (!this.active || !this.cardManager) return;
    const mouse = new this.THREE.Vector2();
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    this.cardManager.handleClick(mouse);
  }

  _setupResizeHandler(container) {
    const handler = () => {
      if (!this.camera || !this.renderer) return;
      const width = container.clientWidth;
      const height = container.clientHeight;
      this.isMobileDevice =
        globalThis.matchMedia?.('(max-width: 768px)')?.matches ?? false;

      this.camera.aspect = width / height;
      this.camera.fov = this.isMobileDevice ? 55 : CONFIG.CAMERA.FOV;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
      this.starManager?.handleResize(width, height);
    };

    const cleanup = onResize(handler, 100);
    sharedCleanupManager.addCleanupFunction('three-earth', cleanup, 'resize');
  }

  // --- Animation Loop ---

  _startAnimationLoop() {
    const clock = new this.THREE.Clock();
    let lastFrameTime = performance.now();

    this.animate = () => {
      if (!this.active) return;
      this.animationFrameId = requestAnimationFrame(this.animate);

      const cap = /** @type {DeviceCapabilities} */ (
        this.deviceCapabilities || detectDeviceCapabilities()
      );
      const targetFrameTime = cap.isLowEnd ? 33.33 : 16.67;

      const now = performance.now();
      const elapsed = now - lastFrameTime;

      if (cap.isLowEnd && elapsed < targetFrameTime) return;
      lastFrameTime = now;

      const delta = clock.getDelta();
      const totalTime = clock.getElapsedTime();

      this._updateFrame(totalTime, delta, cap);
    };

    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    if (document.visibilityState === 'visible') this.animate();
  }

  handleVisibilityChange() {
    if (document.hidden) {
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = 0;
      }
    } else {
      if (
        !this.animationFrameId &&
        this.animate &&
        this.isVisible &&
        this.active
      ) {
        this.animate();
      }
    }
  }

  _updateFrame(totalTime, delta, capabilities) {
    if (this.cloudMesh) {
      this.cloudMesh.rotation.y += CONFIG.CLOUDS.ROTATION_SPEED * 30 * delta;
    }
    if (this.moonMesh) {
      this.moonMesh.rotation.y += CONFIG.MOON.ORBIT_SPEED * 20 * delta;
    }
    if (!capabilities.isLowEnd) this.starManager?.update(totalTime);

    this._updateNightPulse(totalTime, capabilities);

    this.cameraManager?.updateCameraPosition(delta);
    this._updateTransforms();

    const global =
      /** @type {import('/content/core/types.js').GlobalThisExtended & typeof globalThis} */ (
        globalThis
      );
    if (this.cardManager && global.lastMousePos) {
      this.cardManager.update(totalTime * 1000, global.lastMousePos);
    }

    if (!capabilities.isLowEnd) this.shootingStarManager?.update(delta);
    this.performanceMonitor?.update();

    this._render();
  }

  _updateNightPulse(time, capabilities) {
    if (
      this.earthMesh?.userData.currentMode === 'night' &&
      !capabilities.isLowEnd
    ) {
      const base = CONFIG.EARTH.EMISSIVE_INTENSITY * 4;
      const pulse =
        Math.sin(time * CONFIG.EARTH.EMISSIVE_PULSE_SPEED) *
        CONFIG.EARTH.EMISSIVE_PULSE_AMPLITUDE *
        2;
      this.earthMesh.material.emissiveIntensity = base + pulse;
    }
  }

  _updateTransforms() {
    if (!this.earthMesh) return;
    const em = this.earthMesh;

    if (em.userData.targetPosition)
      em.position.lerp(em.userData.targetPosition, 0.04);
    if (em.userData.targetScale) {
      em.scale.x += (em.userData.targetScale - em.scale.x) * 0.06;
      em.scale.y = em.scale.z = em.scale.x;
    }
    if (em.userData.targetRotation !== undefined) {
      const diff = em.userData.targetRotation - em.rotation.y;
      if (Math.abs(diff) > 0.001) em.rotation.y += diff * 0.06;
    }

    if (this.cloudMesh) {
      this.cloudMesh.position.copy(em.position);
      this.cloudMesh.scale.copy(em.scale);
    }

    if (this.moonMesh) {
      const mm = this.moonMesh;
      if (mm.userData.targetPosition)
        mm.position.lerp(mm.userData.targetPosition, 0.04);
      if (mm.userData.targetScale) {
        mm.scale.x += (mm.userData.targetScale - mm.scale.x) * 0.06;
        mm.scale.y = mm.scale.z = mm.scale.x;
      }
    }
  }

  _render() {
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);

      if (this.assetsReady && !this.firstFrameRendered) {
        this.firstFrameRendered = true;
        const container = getElementById('threeEarthContainer');
        hideLoadingState(container);
        AppLoadManager.unblock('three-earth');
        document.dispatchEvent(
          new CustomEvent('three-first-frame', {
            detail: { containerId: container?.id },
          }),
        );
      }
    }
  }

  // --- Observers ---

  _setupSectionDetection() {
    const sections = Array.from(
      document.querySelectorAll('section[id], div#footer-trigger-zone'),
    );
    if (!sections.length || !('IntersectionObserver' in window)) return;

    const thresholds = Array.from({ length: 21 }, (_, i) => i / 20);
    this.sectionObserver = createObserver(
      (entries) => {
        let best = null;
        for (const entry of entries) {
          if (!best || entry.intersectionRatio > best.intersectionRatio)
            best = entry;
        }

        if (best?.isIntersecting) {
          this._handleSectionChange(best);
        }
      },
      { rootMargin: '-20% 0px -20% 0px', threshold: thresholds },
    );

    sections.forEach((s) => this.sectionObserver.observe(s));
  }

  _handleSectionChange(entry) {
    if (entry.target.id === 'features' && this.cardManager) {
      this.cardManager.setProgress(entry.intersectionRatio || 0);
    }

    const newSection = _mapId(entry.target.id || '');
    if (!newSection || newSection === this.currentSection) return;

    const prev = this.currentSection;
    this.currentSection = newSection;

    this.cameraManager?.updateCameraForSection(newSection);

    const isFeaturesToAbout = prev === 'features' && newSection === 'section3';
    this._updateEarthForSection(newSection, isFeaturesToAbout);

    if (newSection === 'features') this.cardManager?.setProgress(1);
    else if (prev === 'features') this.cardManager?.setProgress(0);

    const container = document.querySelector('.three-earth-container');
    const datasetContainer =
      /** @type {import('/content/core/types.js').DatasetHTMLElement|null} */ (
        container
      );
    if (datasetContainer) datasetContainer.dataset.section = newSection;
  }

  _updateEarthForSection(sectionName, allowModeSwitch) {
    if (!this.earthMesh || !this.active) return;

    const config = _getSectionConfig(sectionName);
    this._applyConfigToMeshes(config);

    if (allowModeSwitch) {
      const newMode =
        this.earthMesh.userData.currentMode === 'night' ? 'day' : 'night';
      this.earthMesh.material =
        newMode === 'day' ? this.dayMaterial : this.nightMaterial;
      const material = /** @type {THREE.Material & {needsUpdate?: boolean}} */ (
        this.earthMesh.material
      );
      material.needsUpdate = true;
      this.earthMesh.userData.currentMode = newMode;
      this.cameraManager?.setTargetOrbitAngle(newMode === 'day' ? 0 : Math.PI);
    }

    if (this.directionalLight && this.ambientLight) {
      const mode = this.earthMesh.userData.currentMode;
      const lightCfg =
        mode === 'day' ? CONFIG.LIGHTING.DAY : CONFIG.LIGHTING.NIGHT;
      this.directionalLight.intensity = lightCfg.SUN_INTENSITY;
      this.ambientLight.intensity = lightCfg.AMBIENT_INTENSITY;
      this.ambientLight.color.setHex(lightCfg.AMBIENT_COLOR);
    }
  }

  _applyConfigToMeshes(config) {
    if (!config) return;
    const em = this.earthMesh;
    em.userData.targetPosition = new this.THREE.Vector3(
      config.earth.pos.x,
      config.earth.pos.y,
      config.earth.pos.z,
    );
    em.userData.targetScale = config.earth.scale;
    em.userData.targetRotation = config.earth.rotation;

    if (this.moonMesh && config.moon) {
      const mm = this.moonMesh;
      mm.userData.targetPosition = new this.THREE.Vector3(
        config.moon.pos.x,
        config.moon.pos.y,
        config.moon.pos.z,
      );
      mm.userData.targetScale = config.moon.scale;
    }
  }

  _setupViewportObserver(container) {
    if (!('IntersectionObserver' in window)) {
      this.isVisible = true;
      return;
    }

    this.viewportObserver = createObserver(
      (entries) => {
        this.isVisible = entries[0].isIntersecting;
        if (this.isVisible) {
          if (!this.animationFrameId && this.animate && this.active) {
            log.debug('Resuming render loop');
            this.animate();
          }
        } else {
          if (this.animationFrameId) {
            log.debug('Pausing render loop');
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = 0;
          }
        }
      },
      { threshold: 0, rootMargin: '50px' },
    );

    this.viewportObserver.observe(container);
  }

  // --- Showcase ---

  _setupShowcaseTriggers() {
    document.addEventListener('three-earth:showcase', this.onShowcaseTrigger);
  }

  onShowcaseTrigger(e) {
    const duration = e?.detail?.duration ?? 8000;
    this.triggerShowcase(duration);
  }

  triggerShowcase(duration = 8000) {
    const caps = /** @type {DeviceCapabilities|undefined} */ (
      this.deviceCapabilities
    );
    if (!this.active || this.showcaseActive || caps?.isLowEnd) return;

    this.showcaseActive = true;
    this.showcaseOriginals = {
      cloudSpeed: CONFIG.CLOUDS.ROTATION_SPEED,
      emissiveAmp: CONFIG.EARTH.EMISSIVE_PULSE_AMPLITUDE,
    };

    CONFIG.CLOUDS.ROTATION_SPEED *= 3;
    CONFIG.EARTH.EMISSIVE_PULSE_AMPLITUDE *= 3;

    try {
      const cur = this.cameraManager?.cameraOrbitAngle ?? 0;
      this.cameraManager?.setTargetOrbitAngle(cur + Math.PI / 2);
    } catch {
      /* ignore */
    }

    const showers = Math.max(2, Math.floor(duration / 2000));
    for (let i = 0; i < showers; i++) {
      this.timers.setTimeout(
        () => this.shootingStarManager?.triggerShower(),
        i * 1200,
      );
    }

    if (this.earthMesh) {
      const current = this.earthMesh.scale.x || 1;
      this.earthMesh.userData.targetScale = current * 1.06;
      this.timers.setTimeout(() => {
        if (this.earthMesh) this.earthMesh.userData.targetScale = current;
      }, duration - 300);
    }

    this.showcaseTimeoutId = this.timers.setTimeout(() => {
      this._revertShowcaseConfig();
      this.showcaseActive = false;
      this.showcaseTimeoutId = 0;
    }, duration);
  }

  _revertShowcaseConfig() {
    const originals =
      /** @type {{cloudSpeed?: number, emissiveAmp?: number}} */ (
        this.showcaseOriginals
      );
    if (originals.cloudSpeed !== undefined) {
      CONFIG.CLOUDS.ROTATION_SPEED = originals.cloudSpeed;
    }
    if (originals.emissiveAmp !== undefined) {
      CONFIG.EARTH.EMISSIVE_PULSE_AMPLITUDE = originals.emissiveAmp;
    }
  }

  // --- Utilities ---

  _handleInitError(container, error) {
    if (this.renderer) {
      try {
        this.renderer.dispose();
      } catch {
        /* ignore */
      }
    }
    sharedCleanupManager.cleanupSystem('three-earth');
    showErrorState(container, error, () => {
      this.cleanup();
      initThreeEarth();
    });
  }

  _disposeScene() {
    if (this.scene) {
      this.scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => disposeMaterial(m));
          } else {
            disposeMaterial(obj.material);
          }
        }
      });
      this.scene.clear();
    }
    if (this.renderer) this.renderer.dispose();

    [this.dayMaterial, this.nightMaterial].forEach(disposeMaterial);
  }

  _detectAndEnsureWebGL() {
    try {
      this._applyDeviceConfigSafely();
    } catch (err) {
      log.debug('Device detection failed', err);
    }

    const urlParams = new URL(location.href).searchParams;
    const forceThree =
      urlParams.get('forceThree') === '1' ||
      Boolean(globalThis.__FORCE_THREE_EARTH);

    if (!supportsWebGL() && !forceThree) {
      log.warn('WebGL not supported');
      return true; // We return true to attempt anyway as per original logic, but usually this fails
    }
    return true;
  }

  _applyDeviceConfigSafely() {
    this.deviceCapabilities = detectDeviceCapabilities();
    const optimized = getOptimizedConfig(this.deviceCapabilities);
    Object.assign(CONFIG, optimized);
  }
}

// --- Legacy Export Adapters ---

/** @type {ThreeEarthSystem|null} */
let singleton = null;

export const initThreeEarth = () => {
  if (!singleton) singleton = new ThreeEarthSystem();
  return singleton.init();
};

export const cleanup = () => {
  if (singleton) singleton.cleanup();
};

const ThreeEarthManager = { initThreeEarth, cleanup };

// --- Helpers copied from original (kept for compatibility) ---

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
      const u = /** @type {any} */ (uniform);
      if (u?.value && typeof u.value.dispose === 'function') {
        u.value.dispose();
      }
    });
  }
  material.dispose();
}

function supportsWebGL() {
  return true;
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
    return { isMobile, isLowEnd, recommendedQuality };
  } catch {
    return { isMobile: false, isLowEnd: false, recommendedQuality: 'MEDIUM' };
  }
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

function _mapId(id) {
  return id === 'footer-trigger-zone' ? 'site-footer' : id;
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

// Export for compatibility with other modules if they import these
export {
  detectDeviceCapabilities,
  _mapId,
  // _createLoadingManager is internal now
  // _onSectionObserverEntries is internal now
  // _detectAndEnsureWebGL is internal now
};
// Re-export specific helpers if needed by tests, but ideally tests should use the class instance or mocks

export const _createLoadingManager = (_T, c) => {
  if (singleton) return singleton._createLoadingManager(c);
  return null;
};
export const _detectAndEnsureWebGL = (c) => {
  if (singleton) return singleton._detectAndEnsureWebGL(c);
  return true;
};

export const EarthSystemAPI = {
  flyToPreset: (presetName) => {
    if (singleton?.cameraManager)
      singleton.cameraManager.flyToPreset(presetName);
  },
  triggerMeteorShower: () => {
    singleton?.shootingStarManager?.triggerShower();
  },
  getConfig: () => CONFIG,
  updateConfig: (updates) => {
    Object.assign(CONFIG, updates);
  },
  get shootingStarManager() {
    return singleton?.shootingStarManager;
  },
};

export default ThreeEarthManager;
