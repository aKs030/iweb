// @ts-check
/**
 * Three.js Earth System - Orchestrator
 * Modularized architecture for better maintainability.
 * @version 12.0.0 - MODERNIZED: Class-based Architecture
 */

import * as THREE from "three";
import { debounce } from "../../core/utils/async-utils.js";
import { createObserver, getElementById } from "../../core/utils/dom-utils.js";
import { createLogger } from "../../core/logger.js";
import { AppLoadManager } from "../../core/load-manager.js";
import { TimerManager } from "../../core/utils/timer-manager.js";
import {
  getSharedState,
  registerParticleSystem,
  unregisterParticleSystem,
  sharedCleanupManager,
  sharedParallaxManager,
} from "./shared-particle-system.js";

import { CONFIG } from "./earth/config.js";
import { setupScene, setupLighting, createAtmosphere } from "./earth/scene.js";
import { createEarthSystem, createMoonSystem, createCloudLayer } from "./earth/assets.js";
import { CameraManager } from "./earth/camera.js";
import { StarManager, ShootingStarManager } from "./earth/stars.js";
import { CardManager } from "./earth/cards.js";
import {
  showLoadingState,
  hideLoadingState,
  showErrorState,
  PerformanceMonitor,
} from "./earth/ui.js";

const log = createLogger("ThreeEarthSystem");
const WEBGL_RENDER_SECTIONS = new Set(["hero", "features", "section3"]);

/**
 * @typedef {import('../../core/types.js').TimerID} TimerID
 * @typedef {import('../../core/types.js').DeviceCapabilities} DeviceCapabilities
 *
 * @typedef {{
 *   pos: { x: number, y: number, z: number },
 *   scale: number,
 *   rotation?: number,
 * }} SectionObjectConfig
 * @typedef {{
 *   earth: SectionObjectConfig,
 *   moon?: SectionObjectConfig,
 *   mode?: 'day'|'night',
 *   lighting?: { ambientColor?: number, ambientIntensity?: number, sunIntensity?: number },
 *   scroll?: {
 *     pos?: { x?: number, y?: number, z?: number },
 *     scale?: number,
 *     rotation?: number,
 *     orbit?: number,
 *   },
 * }} SectionConfig
 * @typedef {DeviceCapabilities & { recommendedQuality?: string }} EarthDeviceCapabilities
 * @typedef {{ cloudLayer?: boolean, meteorShowers?: boolean }} QualityConfig
 *
 * @typedef {Object} ObserverWrapper
 * @property {(el: Element) => void} observe
 * @property {(el: Element) => void} unobserve
 * @property {() => void} disconnect
 *
 * @typedef {{ dispose?: () => void, [key: string]: unknown }} DisposableTexture
 * @typedef {{ value?: DisposableTexture }} DisposableUniform
 * @typedef {{ dispose?: () => void, uniforms?: Record<string, DisposableUniform>, [key: string]: unknown }} DisposableMaterial
 * @typedef {{
 *   currentMode?: string,
 *   targetPosition?: THREE.Vector3,
 *   targetScale?: number,
 *   targetRotation?: number,
 *   [key: string]: unknown,
 * }} EarthObjectUserData
 * @typedef {THREE.Object3D & { userData: EarthObjectUserData, scale: THREE.Vector3 }} EarthObject
 * @typedef {EarthObject & { material: (THREE.Material & DisposableMaterial), geometry?: { dispose?: () => void } }} EarthMesh
 * @typedef {{ geometry?: { dispose?: () => void }, material?: DisposableMaterial|DisposableMaterial[], [key: string]: unknown }} DisposableSceneObject
 */

/** @type {Record<string, SectionConfig>} */
const SECTION_CONFIGS = {
  hero: {
    earth: { pos: { x: 1, y: -2.5, z: -1 }, scale: 1.3, rotation: 0 },
    moon: { pos: { x: -45, y: -45, z: -90 }, scale: 0.4 },
    mode: "day",
    scroll: {
      pos: { x: -0.35, y: 0.18, z: -0.2 },
      scale: -0.08,
      rotation: 0.28,
      orbit: 0.08,
    },
  },
  features: {
    earth: { pos: { x: 0, y: -0.06, z: -2.35 }, scale: 0.64, rotation: 0 },
    moon: { pos: { x: 5.8, y: 3.4, z: -9.6 }, scale: 0.72 },
    lighting: {
      ambientColor: 0x5f6678,
      ambientIntensity: 1.55,
      sunIntensity: 1.45,
    },
    mode: "day",
    scroll: {
      pos: { x: 0.12, y: -0.08, z: 0.12 },
      scale: 0.04,
      rotation: 0.18,
      orbit: 0.06,
    },
  },
  section3: {
    earth: { pos: { x: 1.9, y: -2.05, z: -2.65 }, scale: 0.76, rotation: Math.PI * 1.12 },
    moon: { pos: { x: 5.2, y: 2.8, z: -9.4 }, scale: 0.48 },
    lighting: {
      ambientColor: 0x2d375d,
      ambientIntensity: 0.58,
      sunIntensity: 0.62,
    },
    mode: "night",
    scroll: {
      pos: { x: -0.48, y: 0.24, z: 0.16 },
      scale: 0.08,
      rotation: -0.32,
      orbit: -0.1,
    },
  },
  contact: {
    earth: {
      pos: { x: 0, y: -1.5, z: 0 },
      scale: 1.1,
      rotation: Math.PI / 2,
    },
    moon: { pos: { x: -45, y: -45, z: -90 }, scale: 0.4 },
    mode: "day",
  },
};

// Helper: onResize
/**
 * @param {Function} callback
 * @param {number} delay
 * @returns {Function} cleanup function
 */
function onResize(callback, delay = 100) {
  const handler = /** @type {EventListener} */ (debounce(callback, delay));
  window.addEventListener("resize", handler, { passive: true });
  return () => {
    window.removeEventListener("resize", handler);
  };
}

/**
 * Main Three Earth System Class
 */
class ThreeEarthSystem {
  constructor() {
    this.timers = new TimerManager("ThreeEarthSystem");
    this.active = false;

    // Three.js Core
    /** @type {typeof THREE|null} */ this.THREE = null;
    /** @type {THREE.Scene|null} */ this.scene = null;
    /** @type {THREE.PerspectiveCamera|null} */ this.camera = null;
    /** @type {THREE.WebGLRenderer|null} */ this.renderer = null;

    // Objects
    /** @type {EarthMesh|null} */ this.earthMesh = null;
    /** @type {EarthObject|null} */ this.moonMesh = null;
    /** @type {EarthObject|null} */ this.cloudMesh = null;

    // Materials
    /** @type {(THREE.Material & DisposableMaterial)|null} */ this.dayMaterial = null;
    /** @type {(THREE.Material & DisposableMaterial)|null} */ this.nightMaterial = null;

    // Lights
    /** @type {THREE.DirectionalLight|null} */ this.directionalLight = null;
    /** @type {THREE.AmbientLight|null} */ this.ambientLight = null;

    // Managers
    /** @type {CameraManager|null} */ this.cameraManager = null;
    /** @type {StarManager|null} */ this.starManager = null;
    /** @type {ShootingStarManager|null} */ this.shootingStarManager = null;
    /** @type {PerformanceMonitor|null} */ this.performanceMonitor = null;
    /** @type {CardManager|null} */ this.cardManager = null;

    // State
    this.currentSection = "hero";
    /** @type {HTMLElement|null} */ this._currentSectionEl = null;
    this.currentQualityLevel = "HIGH";
    this.isMobileDevice = false;
    this.isVisible = true;
    /** @type {EarthDeviceCapabilities|null} */
    this.deviceCapabilities = null;
    this._featuresCameraNeedsSettleLayout = false;
    this._featureCardLayoutTimer = 0;
    this._sectionEntries = new Map();

    // Animation
    this.animationFrameId = 0;
    this.animate = null;

    // Loading
    this.assetsReady = false;
    this.firstFrameRendered = false;

    // Showcase
    this.showcaseActive = false;
    /** @type {TimerID|null} */
    this.showcaseTimeoutId = null;
    this.showcaseOriginals = {};

    // Handlers (bound)
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    this.onClick = this.onClick.bind(this);
    this.onShowcaseTrigger = this.onShowcaseTrigger.bind(this);

    // Observers
    /** @type {ObserverWrapper|null} */ this.sectionObserver = null;
    /** @type {ObserverWrapper|null} */ this.viewportObserver = null;
    /** @type {Set<string>} */ this._visibleWebGLSections = new Set(WEBGL_RENDER_SECTIONS);
  }

  async init() {
    const sharedState = getSharedState();
    if (sharedState.hasSystem("three-earth")) {
      log.debug("System already initialized");
      return () => this.cleanup();
    }

    const container = getElementById("threeEarthContainer");
    if (!container) {
      log.warn("Container not found");
      return () => {};
    }

    this._clearFallbacks(container);
    this.active = true;

    try {
      log.info("Initializing Three.js Earth System v12.0.0 (Pure WebGL)");

      if (!this._detectAndEnsureWebGL()) return () => this.cleanup();

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

      const [earthAssets, moonLOD, cloudObj] = await this._loadAssets(loadingManager);

      if (!this.active) {
        if (earthAssets?.dayMaterial) earthAssets.dayMaterial.dispose();
        return () => this.cleanup();
      }

      if (!earthAssets) {
        throw new Error("Failed to load earth assets");
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
    log.info("Cleaning up Earth system");

    this._removeInteractionHandlers();

    if (this.showcaseTimeoutId) {
      this.timers.clearTimeout(this.showcaseTimeoutId);
      this.showcaseTimeoutId = null;
    }
    if (this.showcaseActive) this._revertShowcaseConfig();

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = 0;
    }

    document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    document.removeEventListener("three-earth:showcase", this.onShowcaseTrigger);

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
    sharedCleanupManager.cleanupSystem("three-earth");

    this._disposeScene();

    this.assetsReady = false;
    this.firstFrameRendered = false;
    this._currentSectionEl = null;

    if (this.cardManager) this.cardManager.cleanup();
    this.cardManager = null;

    unregisterParticleSystem("three-earth");
    document.body.classList.remove("three-earth-active");

    // Clear Singleton
    if (singleton === this) singleton = null;

    log.info("Cleanup complete");
  }

  // --- Internals ---

  /**
   * @param {HTMLElement} container
   */
  _clearFallbacks(container) {
    try {
      container.classList.remove("three-earth-unavailable");
      container
        .querySelectorAll(".three-earth-fallback")
        .forEach(el => /** @type {HTMLElement} */ (el).remove());
    } catch {
      /* ignore */
    }
  }

  _detectDevice() {
    this.isMobileDevice = window.innerWidth <= 768;
  }

  /**
   * @param {HTMLElement} container
   */
  async _loadThreeWithWatchdog(container) {
    const THREE_LOAD_WATCH = 8000;
    let loaded = false;

    const timer = this.timers.setTimeout(() => {
      if (!loaded) {
        log.warn("Three.js load timeout");
        try {
          AppLoadManager.unblock("three-earth");
        } catch {
          /* ignore */
        }
        this._handleInitError(container, new Error("Three.js load timeout"));
      }
    }, THREE_LOAD_WATCH);

    // Three.js is already imported at the top, just use it directly
    this.THREE = THREE;
    loaded = true;
    this.timers.clearTimeout(timer);
    return THREE;
  }

  /**
   * @param {HTMLElement} container
   */
  _createLoadingManager(container) {
    const manager = new this.THREE.LoadingManager();

    manager.onStart = (
      /** @type {string} */ _url,
      /** @type {number} */ _loaded,
      /** @type {number} */ _total
    ) => {
      showLoadingState(container, 0);
    };

    manager.onProgress = (
      /** @type {string} */ _url,
      /** @type {number} */ loaded,
      /** @type {number} */ total
    ) => {
      if (!this.active) return;
      const progress = Math.min(1, loaded / Math.max(1, total));
      showLoadingState(container, progress);
    };

    manager.onLoad = () => {
      if (!this.active) return;
      this.assetsReady = true;
      showLoadingState(container, 1);
      try {
        container.dataset.threeReady = "1";
      } catch {
        /* ignore */
      }
    };

    manager.onError = (/** @type {string} */ url) => {
      log.warn("Error loading texture:", url);
      AppLoadManager.unblock("three-earth");
    };

    return manager;
  }

  _registerAndBlock() {
    registerParticleSystem("three-earth", { type: "three-earth" });
    AppLoadManager.block("three-earth");
  }

  /**
   * @param {THREE.LoadingManager} loadingManager
   */
  async _loadAssets(loadingManager) {
    return Promise.all([
      createEarthSystem(this.THREE, this.scene, this.renderer, this.isMobileDevice, loadingManager),
      createMoonSystem(this.THREE, this.scene, this.renderer, this.isMobileDevice, loadingManager),
      createCloudLayer(this.THREE, this.renderer, loadingManager, this.isMobileDevice),
    ]);
  }

  _setupStarsAndLighting() {
    try {
      this.starManager = new StarManager(this.THREE, this.scene);
      const starField = this.starManager.createStarField();

      sharedParallaxManager.addHandler((/** @type {number} */ progress) => {
        if (!starField || !this.starManager) return;
        starField.rotation.y = progress * Math.PI * 0.2;
        starField.position.z = Math.sin(progress * Math.PI) * 15;
      }, "three-earth-stars");

      const lights = setupLighting(this.THREE, this.scene);
      this.directionalLight = lights.directionalLight;
      this.ambientLight = lights.ambientLight;
    } catch (err) {
      log.warn("Stars/Lighting init ignored", err);
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

  /**
   * @param {HTMLElement} container
   */
  _initManagers(container) {
    this.cameraManager = new CameraManager(this.THREE, this.camera);
    this.cameraManager.setupCameraSystem();

    const onWheel = (/** @type {WheelEvent} */ event) => {
      if (!this.active || !event.altKey) return;

      this.cameraManager?.handleWheel(event);
    };
    container.addEventListener("wheel", onWheel, { passive: true });
    sharedCleanupManager.addCleanupFunction(
      "three-earth",
      () => {
        container.removeEventListener("wheel", onWheel);
      },
      "wheel control"
    );
  }

  /**
   * @param {HTMLElement} container
   */
  _setupManagersAndCards(container) {
    this.currentSection = this._resolveCurrentSection();
    container.dataset.section = this.currentSection;
    this._syncWebGLVisibility(this.currentSection);

    this._setupSectionDetection();
    this._setupViewportObserver(container);

    document.body.classList.add("three-earth-active");

    this.performanceMonitor = new PerformanceMonitor(
      container,
      this.renderer,
      (/** @type {string} */ level) => {
        this.currentQualityLevel = level;
        const cfg =
          /** @type {Record<string, QualityConfig>} */ (CONFIG.QUALITY_LEVELS)[level] || {};
        if (this.cloudMesh) this.cloudMesh.visible = cfg.cloudLayer;
        if (this.shootingStarManager) this.shootingStarManager.disabled = !cfg.meteorShowers;
      }
    );

    this.shootingStarManager = new ShootingStarManager(this.scene, this.THREE);

    this.cardManager = new CardManager(this.THREE, this.scene, this.camera, this.renderer);

    this.cardManager.initFromData(this._getCardData());
    this._syncFeatureCardsForSection();
  }

  _getCardData() {
    return [
      {
        title: "Profil",
        subtitle: "PROFIL",
        text: "Fokus, Arbeitsweise, Hintergrund.",
        link: "/about/",
        cta: "Oeffnen",
        meta: "Profil",
        routeLabel: "Profil",
        iconChar: "👨‍💻",
        color: "#07a1ff",
      },
      {
        title: "Projekte",
        subtitle: "PROJEKTE",
        text: "Arbeiten, Cases und Experimente.",
        link: "/projekte/",
        cta: "Oeffnen",
        meta: "Cases",
        routeLabel: "Projekte",
        iconChar: "🚀",
        color: "#a107ff",
      },
      {
        title: "Fotos",
        subtitle: "FOTOS",
        text: "Serien, Stills und Beobachtungen.",
        link: "/gallery/",
        cta: "Oeffnen",
        meta: "Archiv",
        routeLabel: "Fotos",
        iconChar: "📸",
        color: "#ff07a1",
      },
      {
        title: "Videos",
        subtitle: "VIDEOS",
        text: "Clips und Motion-Studien.",
        link: "/videos/",
        cta: "Oeffnen",
        meta: "Motion",
        routeLabel: "Videos",
        iconChar: "🎬",
        color: "#07ffbc",
      },
      {
        title: "Journal",
        subtitle: "JOURNAL",
        text: "Notizen aus laufenden Projekten.",
        link: "/blog/",
        cta: "Oeffnen",
        meta: "Notes",
        routeLabel: "Journal",
        iconChar: "📝",
        color: "#ffb807",
      },
    ];
  }

  /**
   * @param {HTMLElement} container
   */
  _finalizeInitialization(container) {
    this._startAnimationLoop();
    this._setupResizeHandler(container);
    this._setupInteraction();

    log.info("Initialization complete");

    try {
      container.dataset.threeReady = "1";
      document.dispatchEvent(
        new CustomEvent("three-ready", {
          detail: { containerId: container.id },
        })
      );
    } catch {
      /* ignore */
    }
  }

  // --- Interaction & Events ---

  _setupInteraction() {
    window.addEventListener("click", this.onClick);
  }

  _removeInteractionHandlers() {
    window.removeEventListener("click", this.onClick);
  }

  /**
   * @param {MouseEvent} event
   */
  onClick(event) {
    if (!this.active || !this.cardManager) return;
    const mouse = new this.THREE.Vector2();
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    this.cardManager.handleClick(mouse);
  }

  /**
   * @param {HTMLElement} container
   */
  _setupResizeHandler(container) {
    if (!("ResizeObserver" in window)) {
      // Fallback to window resize
      const handler = () => {
        if (!this.camera || !this.renderer) return;
        const width = container.clientWidth;
        const height = container.clientHeight;
        this.isMobileDevice = width <= 768;

        this.camera.aspect = width / height;
        this.camera.fov = this.isMobileDevice ? 55 : CONFIG.CAMERA.FOV;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
      };
      const cleanup = onResize(handler, 100);
      sharedCleanupManager.addCleanupFunction("three-earth", cleanup, "resize");
      return;
    }

    let lastWidth = 0;
    let lastHeight = 0;

    const resizeObserver = new ResizeObserver(
      /** @type {ResizeObserverCallback} */ (
        debounce((/** @type {ResizeObserverEntry[]} */ entries) => {
          if (!this.active || !this.camera || !this.renderer) return;
          for (const entry of entries) {
            const { width, height } = entry.contentRect;

            const isFirstRun = lastWidth === 0 && lastHeight === 0;
            const widthChanged = width !== lastWidth;
            const heightChangedSignificantly = Math.abs(height - lastHeight) > 80;

            if (isFirstRun || widthChanged || heightChangedSignificantly) {
              this.isMobileDevice = width <= 768;

              this.camera.aspect = width / height;
              this.camera.fov = this.isMobileDevice ? 55 : CONFIG.CAMERA.FOV;
              this.camera.updateProjectionMatrix();
              this.renderer.setSize(width, height);

              lastWidth = width;
              lastHeight = height;
            }
          }
        }, 100)
      )
    );

    resizeObserver.observe(container);
    sharedCleanupManager.addCleanupFunction(
      "three-earth",
      () => resizeObserver.disconnect(),
      "ResizeObserver"
    );
  }

  // --- Animation Loop ---

  _startAnimationLoop() {
    const timer = new this.THREE.Timer();
    let lastFrameTime = performance.now();

    this.animate = () => {
      if (!this.active) return;
      if (document.hidden || !this.isVisible || !this._isWebGLSectionVisible()) {
        this.animationFrameId = 0;
        this._clearWebGLCanvas();
        return;
      }

      this.animationFrameId = requestAnimationFrame(this.animate);

      const cap = /** @type {EarthDeviceCapabilities} */ (
        this.deviceCapabilities || detectDeviceCapabilities()
      );
      const targetFrameTime = cap.isLowEnd ? 33.33 : 16.67;

      const now = performance.now();
      const elapsed = now - lastFrameTime;

      if (cap.isLowEnd && elapsed < targetFrameTime) return;
      lastFrameTime = now;

      timer.update();
      const delta = timer.getDelta();
      const totalTime = timer.getElapsed();

      this._updateFrame(totalTime, delta, cap);
    };

    document.addEventListener("visibilitychange", this.handleVisibilityChange);
    // Start animation immediately, regardless of visibility state
    this.animate();
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
        this.active &&
        this._isWebGLSectionVisible()
      ) {
        this.animate();
      }
    }
  }

  /**
   * @param {number} totalTime
   * @param {number} delta
   * @param {EarthDeviceCapabilities} capabilities
   */
  _updateFrame(totalTime, delta, capabilities) {

    if (this.cloudMesh) {
      this.cloudMesh.rotation.y += CONFIG.CLOUDS.ROTATION_SPEED * 30 * delta;
    }
    if (this.moonMesh) {
      this.moonMesh.rotation.y += CONFIG.MOON.ORBIT_SPEED * 20 * delta;
    }
    if (!capabilities.isLowEnd) this.starManager?.update(totalTime);

    this._updateNightPulse(totalTime, capabilities);
    this._updateScrollLinkedEarthTarget();

    this.cameraManager?.updateCameraPosition(delta);
    this._updateTransforms(delta);

    if (this.cardManager) {
      const featuresCameraTransitioning =
        this.currentSection === "features" && Boolean(this.cameraManager?.transition?.active);

      if (featuresCameraTransitioning) {
        this.cardManager.alignCardsToCameraImmediate?.();
      }

      this.cardManager.update(totalTime * 1000);
    }

    if (!capabilities.isLowEnd) this.shootingStarManager?.update(delta);
    this.performanceMonitor?.update();

    this._render();
  }

  /**
   * @param {number} time
   * @param {EarthDeviceCapabilities} capabilities
   */
  _updateNightPulse(time, capabilities) {
    if (this.earthMesh?.userData.currentMode === "night" && !capabilities.isLowEnd) {
      const base = CONFIG.EARTH.EMISSIVE_INTENSITY * 4;
      const pulse =
        Math.sin(time * CONFIG.EARTH.EMISSIVE_PULSE_SPEED) *
        CONFIG.EARTH.EMISSIVE_PULSE_AMPLITUDE *
        2;
      this.earthMesh.material.emissiveIntensity = base + pulse;
    }
  }

  _updateTransforms(delta = 0.016) {
    if (!this.earthMesh) return;
    const em = this.earthMesh;
    const timeScale = delta * 60;
    const posLerp = 1 - Math.pow(1 - 0.04, timeScale);
    const scaleLerp = 1 - Math.pow(1 - 0.06, timeScale);

    if (em.userData.targetPosition) em.position.lerp(em.userData.targetPosition, posLerp);
    if (em.userData.targetScale) {
      em.scale.x += (em.userData.targetScale - em.scale.x) * scaleLerp;
      em.scale.y = em.scale.z = em.scale.x;
    }
    if (em.userData.targetRotation !== undefined) {
      const diff = em.userData.targetRotation - em.rotation.y;
      if (Math.abs(diff) > 0.001) em.rotation.y += diff * scaleLerp;
    }

    if (this.cloudMesh) {
      this.cloudMesh.position.copy(em.position);
      this.cloudMesh.scale.copy(em.scale);
    }

    if (this.moonMesh) {
      const mm = this.moonMesh;
      if (mm.userData.targetPosition) mm.position.lerp(mm.userData.targetPosition, posLerp);
      if (mm.userData.targetScale) {
        mm.scale.x += (mm.userData.targetScale - mm.scale.x) * scaleLerp;
        mm.scale.y = mm.scale.z = mm.scale.x;
      }
    }
  }

  _render() {
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);

      if (this.assetsReady && !this.firstFrameRendered) {
        this.firstFrameRendered = true;
        const container = getElementById("threeEarthContainer");

        // Small delay to ensure the first frame is visible before hiding loader
        requestAnimationFrame(() => {
          hideLoadingState(container);
          AppLoadManager.unblock("three-earth");
          document.dispatchEvent(
            new CustomEvent("three-first-frame", {
              detail: { containerId: container?.id },
            })
          );
        });
      }
    }
  }

  // --- Observers ---

  _setupSectionDetection() {
    const sections = Array.from(document.querySelectorAll("section[id]"));
    if (!sections.length || !("IntersectionObserver" in window)) return;

    // Reduced thresholds from 21 to 11 (steps of 0.1) for better performance
    const thresholds = Array.from({ length: 11 }, (_, i) => i / 10);
    const sectionObserver = createObserver(
      (/** @type {IntersectionObserverEntry[]} */ entries) => {
        entries.forEach(entry => {
          if (entry?.target?.id) {
            this._sectionEntries.set(entry.target.id, entry);
          }
        });

        let best = null;
        for (const entry of this._sectionEntries.values()) {
          if (entry.isIntersecting && (!best || entry.intersectionRatio > best.intersectionRatio)) {
            best = entry;
          }
        }

        if (best) this._handleSectionChange(best);
      },
      { rootMargin: "-20% 0px -20% 0px", threshold: thresholds }
    );
    this.sectionObserver = /** @type {ObserverWrapper} */ (sectionObserver);

    sections.forEach(s => this.sectionObserver?.observe(s));
  }

  /**
   * @param {IntersectionObserverEntry} entry
   */
  _handleSectionChange(entry) {
    const target = /** @type {HTMLElement} */ (entry.target);
    const newSection = target.id || "";
    if (!newSection || newSection === this.currentSection) return;

    const prev = this.currentSection;
    this.currentSection = newSection;
    this._currentSectionEl = target;

    this.cameraManager?.updateCameraForSection(newSection);

    const forceMode = prev === "features" && newSection === "section3";
    this._updateEarthForSection(newSection, forceMode);
    this._syncFeatureCardsForSection();

    const container = document.querySelector(".three-earth-container");
    const datasetContainer = /** @type {import('../../core/types.js').DatasetHTMLElement|null} */ (
      container
    );
    if (datasetContainer) datasetContainer.dataset.section = newSection;
    this._syncWebGLVisibility(newSection);
  }

  _syncFeatureCardsForSection() {
    if (!this.cardManager) return;

    if (this.currentSection === "features") {
      // Temporarily snap camera to target so CardManager can calculate screen projections
      const preset = CONFIG.CAMERA.PRESETS["features"];
      const origPos = this.camera.position.clone();
      const origQuat = this.camera.quaternion.clone();

      if (preset) {
        this.camera.position.set(preset.x, preset.y, preset.z);
        this.camera.lookAt(preset.lookAt.x, preset.lookAt.y, preset.lookAt.z);
        this.camera.updateMatrixWorld(true);
      }

      this.cardManager.setProgress(1);
      this.cardManager.alignCardsToCameraImmediate?.();
      this.cardManager.refreshLayoutForCamera?.(true);

      // Restore camera
      if (preset) {
        this.camera.position.copy(origPos);
        this.camera.quaternion.copy(origQuat);
        this.camera.updateMatrixWorld(true);
      }

      this._featuresCameraNeedsSettleLayout = false; // Layout is already perfect, no need to recalculate later

      if (this._featureCardLayoutTimer) {
        this.timers.clearTimeout(this._featureCardLayoutTimer);
        this._featureCardLayoutTimer = 0;
      }
    } else {
      this.cardManager.setProgress(0);
      this._featuresCameraNeedsSettleLayout = false;
      if (this._featureCardLayoutTimer) {
        this.timers.clearTimeout(this._featureCardLayoutTimer);
        this._featureCardLayoutTimer = 0;
      }
    }
  }

  _resolveCurrentSection() {
    const hashId = decodeURIComponent(window.location.hash.slice(1));
    if (hashId) {
      const hashEl = document.getElementById(hashId);
      if (hashEl) {
        this._currentSectionEl = /** @type {HTMLElement} */ (hashEl);
        return hashId;
      }
    }

    const sections = Array.from(document.querySelectorAll("section[id]"));
    let bestEl = null;
    let bestId = this.currentSection || "hero";
    let bestVisibleArea = 0;

    sections.forEach(section => {
      const rect = section.getBoundingClientRect();
      const visibleHeight = Math.max(
        0,
        Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0)
      );
      const visibleArea = visibleHeight * Math.max(0, rect.width);
      if (visibleArea > bestVisibleArea) {
        bestVisibleArea = visibleArea;
        bestEl = section;
        bestId = section.id;
      }
    });

    this._currentSectionEl = /** @type {HTMLElement|null} */ (bestEl);
    return bestId;
  }

  /**
   * @param {string} [sectionName]
   */
  _isWebGLSectionVisible(sectionName = this.currentSection) {
    return WEBGL_RENDER_SECTIONS.has(sectionName) && this._visibleWebGLSections.has(sectionName);
  }

  _clearWebGLCanvas() {
    if (!this.renderer) return;
    this.renderer.clear(true, true, true);
  }

  /**
   * Maps section IDs to config keys (e.g. "site-footer" → "contact").
   * @param {string} [sectionName]
   * @returns {string}
   */
  _resolveSectionKey(sectionName = this.currentSection) {
    return sectionName === "site-footer" ? "contact" : sectionName;
  }

  _getCurrentSectionConfig() {
    return SECTION_CONFIGS[this._resolveSectionKey()] || SECTION_CONFIGS.hero;
  }

  _getCurrentSectionScrollProgress() {
    const section = this._currentSectionEl;
    if (!section) return 0.5;

    const rect = section.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 1;
    const range = rect.height + viewportHeight;
    const rawProgress = (viewportHeight - rect.top) / range;
    const progress = Math.max(0, Math.min(1, rawProgress));

    return progress * progress * (3 - 2 * progress);
  }

  _updateScrollLinkedEarthTarget() {
    if (!this.earthMesh || !this.active || !this._isWebGLSectionVisible()) return;

    const config = this._getCurrentSectionConfig();
    const progress = this._getCurrentSectionScrollProgress();
    const centeredProgress = progress - 0.5;
    const scroll = config.scroll || {};
    const pos = scroll.pos || {};
    const em = this.earthMesh;

    if (!em.userData.targetPosition) {
      em.userData.targetPosition = new this.THREE.Vector3();
    }

    em.userData.targetPosition.set(
      config.earth.pos.x + (pos.x || 0) * centeredProgress,
      config.earth.pos.y + (pos.y || 0) * centeredProgress,
      config.earth.pos.z + (pos.z || 0) * centeredProgress
    );
    em.userData.targetScale = Math.max(
      0.2,
      config.earth.scale + (scroll.scale || 0) * centeredProgress
    );
    em.userData.targetRotation =
      (config.earth.rotation || 0) + (scroll.rotation || 0) * centeredProgress;

    if (this.moonMesh && config.moon) {
      const mm = this.moonMesh;
      if (!mm.userData.targetPosition) {
        mm.userData.targetPosition = new this.THREE.Vector3();
      }
      mm.userData.targetPosition.set(config.moon.pos.x, config.moon.pos.y, config.moon.pos.z);
      mm.userData.targetScale = config.moon.scale;
    }

    const baseOrbit = em.userData.currentMode === "night" ? Math.PI : 0;
    this.cameraManager?.setTargetOrbitAngle(baseOrbit + (scroll.orbit || 0) * centeredProgress);
  }

  /**
   * @param {string} sectionName
   */
  _syncWebGLVisibility(sectionName) {
    const shouldRender = this._isWebGLSectionVisible(sectionName);

    if (!shouldRender) {
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = 0;
      }
      this.cardManager?.setProgress(0);
      this._clearWebGLCanvas();
      return;
    }

    if (
      !this.animationFrameId &&
      this.animate &&
      this.active &&
      this.isVisible &&
      !document.hidden
    ) {
      this.animate();
    }
  }

  /**
   * @param {string} sectionName
   * @param {boolean} forceMode – apply config.mode even if it matches the current mode
   */
  _updateEarthForSection(sectionName, forceMode) {
    if (!this.earthMesh || !this.active) return;

    const config = SECTION_CONFIGS[this._resolveSectionKey(sectionName)] || SECTION_CONFIGS.hero;
    this._applyConfigToMeshes(config);

    if (config.mode && (forceMode || config.mode !== this.earthMesh.userData.currentMode)) {
      const newMode = config.mode;
      const nextMaterial = newMode === "day" ? this.dayMaterial : this.nightMaterial;
      if (!nextMaterial) return;
      this.earthMesh.material = nextMaterial;
      this.earthMesh.material.needsUpdate = true;
      this.earthMesh.userData.currentMode = newMode;
      this.cameraManager?.setTargetOrbitAngle(newMode === "day" ? 0 : Math.PI);
    }

    if (this.directionalLight && this.ambientLight) {
      const mode = this.earthMesh.userData.currentMode;
      const lightCfg = mode === "day" ? CONFIG.LIGHTING.DAY : CONFIG.LIGHTING.NIGHT;
      const sectionLight = config.lighting || {};
      this.directionalLight.intensity = sectionLight.sunIntensity ?? lightCfg.SUN_INTENSITY;
      this.ambientLight.intensity = sectionLight.ambientIntensity ?? lightCfg.AMBIENT_INTENSITY;
      this.ambientLight.color.setHex(sectionLight.ambientColor ?? lightCfg.AMBIENT_COLOR);
    }
  }

  /**
   * @param {SectionConfig} config
   */
  _applyConfigToMeshes(config) {
    if (!config || !this.active) return;
    const em = this.earthMesh;
    if (!em) return;

    if (!em.userData.targetPosition) {
      em.userData.targetPosition = new this.THREE.Vector3();
    }
    em.userData.targetPosition.set(config.earth.pos.x, config.earth.pos.y, config.earth.pos.z);
    em.userData.targetScale = config.earth.scale;
    em.userData.targetRotation = config.earth.rotation;

    if (this.moonMesh && config.moon) {
      const mm = this.moonMesh;
      if (!mm.userData.targetPosition) {
        mm.userData.targetPosition = new this.THREE.Vector3();
      }
      mm.userData.targetPosition.set(config.moon.pos.x, config.moon.pos.y, config.moon.pos.z);
      mm.userData.targetScale = config.moon.scale;
    }
  }

  /**
   * @param {HTMLElement} container
   */
  _setupViewportObserver(container) {
    if (!("IntersectionObserver" in window)) {
      this.isVisible = true;
      return;
    }

    this._visibleWebGLSections = new Set([this.currentSection]);

    const createdViewportObserver = createObserver(
      /**
       * @param {IntersectionObserverEntry[]} entries
       */
      entries => {
        const visibleSections = this._visibleWebGLSections;
        if (!visibleSections) return;
        entries.forEach(entry => {
          const target = /** @type {HTMLElement|null} */ (entry.target);
          if (!target || typeof target.id !== "string") return;
          if (entry.isIntersecting) {
            visibleSections.add(target.id);
          } else {
            visibleSections.delete(target.id);
          }
        });

        this.isVisible = visibleSections.size > 0;

        if (this.isVisible) {
          if (this._canvasPauseTimeout) {
            clearTimeout(this._canvasPauseTimeout);
            this._canvasPauseTimeout = null;
          }
          if (!this.animationFrameId && this.animate && this.active) {
            log.debug("Resuming render loop (WebGL area in view)");
            this.animate();
          }
        } else {
          // Add grace period to allow card fade-out animations to finish
          if (this._canvasPauseTimeout) clearTimeout(this._canvasPauseTimeout);
          this._canvasPauseTimeout = setTimeout(() => {
            if (!this.isVisible && this.animationFrameId) {
              log.debug("Pausing render loop (WebGL area out of view)");
              cancelAnimationFrame(this.animationFrameId);
              this.animationFrameId = 0;
              this._clearWebGLCanvas();
            }
          }, 800);
        }
      },
      { threshold: 0, rootMargin: "100px" }
    );
    this.viewportObserver = /** @type {ObserverWrapper} */ (createdViewportObserver);

    // Observe all sections that render 3D content.
    const targets = document.querySelectorAll("#hero, #features, #section3");
    const viewportObserver = /** @type {ObserverWrapper|null} */ (this.viewportObserver);
    if (!viewportObserver) return;
    if (targets.length) {
      targets.forEach(el => viewportObserver.observe(el));
    } else {
      viewportObserver.observe(container);
    }
  }

  // --- Showcase ---

  _setupShowcaseTriggers() {
    document.addEventListener("three-earth:showcase", this.onShowcaseTrigger);
  }

  /**
   * @param {Event} event
   */
  onShowcaseTrigger(event) {
    const detail =
      event instanceof CustomEvent && event.detail && typeof event.detail === "object"
        ? /** @type {{ duration?: unknown }} */ (event.detail)
        : {};
    const duration = Number(detail.duration ?? 8000);
    this.triggerShowcase(duration);
  }

  triggerShowcase(duration = 8000) {
    const caps = /** @type {EarthDeviceCapabilities|null} */ (this.deviceCapabilities);
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
      this.timers.setTimeout(() => this.shootingStarManager?.triggerShower(), i * 1200);
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
      this.showcaseTimeoutId = null;
    }, duration);
  }

  _revertShowcaseConfig() {
    const originals = /** @type {{cloudSpeed?: number, emissiveAmp?: number}} */ (
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

  /**
   * @param {HTMLElement} container
   * @param {unknown} error
   */
  _handleInitError(container, error) {
    if (this.renderer) {
      try {
        this.renderer.dispose();
      } catch {
        /* ignore */
      }
    }
    sharedCleanupManager.cleanupSystem("three-earth");
    showErrorState(container, error, () => {
      this.cleanup();
      initThreeEarth();
    });
  }

  _disposeScene() {
    if (this.scene) {
      this.scene.traverse((/** @type {DisposableSceneObject} */ obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach(material => disposeMaterial(material));
          } else {
            disposeMaterial(obj.material);
          }
        }
      });
      this.scene.clear();
    }

    if (this.renderer) {
      try {
        this.renderer.dispose();
        if (typeof this.renderer.forceContextLoss === "function") {
          this.renderer.forceContextLoss();
        }
      } catch {
        /* ignore */
      }
    }

    [this.dayMaterial, this.nightMaterial].forEach(disposeMaterial);

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.earthMesh = null;
    this.moonMesh = null;
    this.cloudMesh = null;
    this.dayMaterial = null;
    this.nightMaterial = null;
    this.directionalLight = null;
    this.ambientLight = null;
    this.cameraManager = null;
    this.starManager = null;
    this.shootingStarManager = null;
    this.performanceMonitor = null;
  }

  _detectAndEnsureWebGL() {
    try {
      this._applyDeviceConfigSafely();
    } catch (err) {
      log.debug("Device detection failed", err);
    }

    const urlParams = new URL(location.href).searchParams;
    const forceThree = urlParams.get("forceThree") === "1";

    if (!supportsWebGL() && !forceThree) {
      log.warn("WebGL not supported, falling back to CSS");
      const container = getElementById("threeEarthContainer");
      if (container) {
        container.classList.add("three-earth-unavailable");
        showErrorState(container, new Error("WebGL not supported"), null);
      }
      return false;
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

// --- Shared material and geometry helpers ---

/**
 * @param {DisposableMaterial|null|undefined} material
 */
function disposeMaterial(material) {
  if (!material) return;
  const textureProps = ["map", "normalMap", "bumpMap", "envMap", "emissiveMap", "alphaMap"];
  textureProps.forEach(prop => {
    const texture = material[prop];
    if (
      texture &&
      typeof texture === "object" &&
      "dispose" in texture &&
      typeof texture.dispose === "function"
    ) {
      texture.dispose();
      material[prop] = null;
    }
  });
  if (material.uniforms) {
    Object.values(material.uniforms).forEach(uniform => {
      const value = uniform?.value;
      if (value && typeof value.dispose === "function") {
        value.dispose();
      }
    });
  }
  material.dispose?.();
}

function supportsWebGL() {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");

    if (!gl) {
      log.warn("WebGL context not available");
      return false;
    }

    // Basic WebGL is enough - don't require specific extensions
    // Most mobile devices support basic WebGL
    log.debug("WebGL is supported");
    return true;
  } catch (e) {
    log.warn("WebGL detection failed:", e);
    return false;
  }
}

/**
 * @returns {EarthDeviceCapabilities}
 */
function detectDeviceCapabilities() {
  try {
    const ua = (navigator.userAgent || "").toLowerCase();
    const isMobile = /mobile|tablet|android|ios|iphone|ipad/i.test(ua);

    // Flag only ancient devices as low-end (e.g. Android 4/5 or very old iOS).
    // Modern devices with few cores (e.g. newer iPhones) should NOT be flagged as low-end.
    // We removed the hardwareConcurrency check as it falsely flags powerful mobile devices.
    const isLowEnd = /android 4|android 5|cpu iphone os 9|cpu iphone os 10|cpu iphone os 11/i.test(
      ua
    );

    let recommendedQuality;
    if (isLowEnd) recommendedQuality = "LOW";
    else if (isMobile || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 8))
      recommendedQuality = "MEDIUM";
    else recommendedQuality = "HIGH";

    log.debug("Device capabilities:", {
      isMobile,
      isLowEnd,
      recommendedQuality,
    });

    return { isMobile, isLowEnd, recommendedQuality };
  } catch (err) {
    log.warn("Device detection failed:", err);
    return { isMobile: false, isLowEnd: false, recommendedQuality: "MEDIUM" };
  }
}

/**
 * @param {EarthDeviceCapabilities|null|undefined} capabilities
 */
function getOptimizedConfig(capabilities) {
  if (!capabilities) return {};
  if (capabilities.isLowEnd) {
    return {
      EARTH: { ...CONFIG.EARTH, SEGMENTS: 24, SEGMENTS_MOBILE: 32 },
      STARS: { ...CONFIG.STARS, COUNT: 1000 },
      // Even on low-end devices, keep decent resolution (1.5x minimum) to avoid extreme blur
      PERFORMANCE: {
        ...CONFIG.PERFORMANCE,
        PIXEL_RATIO: Math.min(window.devicePixelRatio || 1, 1.5),
        TARGET_FPS: 30,
      },
      CLOUDS: { ...CONFIG.CLOUDS, OPACITY: 0 },
    };
  }
  if (capabilities.isMobile) {
    return {
      EARTH: { ...CONFIG.EARTH, SEGMENTS_MOBILE: 32 },
      STARS: { ...CONFIG.STARS, COUNT: 1500 },
      PERFORMANCE: {
        ...CONFIG.PERFORMANCE,
        // Capping Pixel Ratio on mobile devices to 1.5 to prevent GPU overheating on high DPI devices
        // (like iPhone 17 Pro Max) which causes battery drain and thermal throttling.
        PIXEL_RATIO: Math.min(window.devicePixelRatio || 1, 1.5),
      },
    };
  }
  return {};
}
