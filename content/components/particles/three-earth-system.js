// @ts-check
import * as THREE from "three";
import { createObserver, debounce, getElementById, TimerManager } from "../../core/utils/index.js";
import { createLogger } from "../../core/logger.js";
import { AppLoadManager } from "../../core/load-manager.js";
import { activeOverlay } from "../../core/state/overlay-state.js";
import { shouldModeShowBackdrop } from "../../core/overlay/index.js";
import {
  getSharedState,
  registerParticleSystem,
  unregisterParticleSystem,
  sharedCleanupManager,
} from "./shared-particle-system.js";

import { CONFIG } from "./earth/config.js";
import {
  detectDeviceCapabilities,
  getOptimizedConfig,
  supportsWebGL,
} from "./earth/device-capabilities.js";
import { setupScene, setupLighting } from "./earth/scene.js";
import {
  createEarthKTX2Loader,
  createEarthSystem,
  createMoonSystem,
  createCloudLayer,
} from "./earth/assets.js";
import { CameraManager } from "./earth/camera.js";
import {
  applyFeaturesSection3CameraOrbit,
  applyScrollLinkedEarthTransform,
  applyScrollLinkedSectionVisuals,
  EarthZoomTransition,
  getFeaturesToSection3ScrollProgress,
  getHeroToFeaturesScrollProgress as getScrollProgress,
  getHeroToFeaturesZoomProgress as getZoomProgress,
} from "./earth/zoom-transition.js";
import { StarManager, ShootingStarManager } from "./earth/stars.js";
import { CardManager } from "./earth/cards.js";
import { updatePhysicalLightingUniforms } from "./earth/physical-lighting.js";
import {
  showLoadingState,
  hideLoadingState,
  showErrorState,
  PerformanceMonitor,
} from "./earth/ui.js";

const log = createLogger("ThreeEarthSystem");
const WEBGL_RENDER_SECTIONS = new Set(["hero", "features", "section3"]);
const EARTH_TRANSFORM_DAMPING = Object.freeze({
  position: 3.2,
  scale: 4.2,
  rotation: 3,
  light: 5,
});
const EARTH_ZOOM_LOD = Object.freeze({
  globeFadeEnd: 0.68,
  europeFull: 1.2,
  berlinStart: 2.2,
  berlinFull: 4.2,
});
const HERO_FEATURE_VERTICAL_TURN = Math.PI * 0.325;
const WEBGL_CANVAS_CLEAR_DELAY_MS = 800;

const getDampingFactor = (rate, delta) => 1 - Math.exp(-rate * Math.min(delta, 1 / 15));
const smoothstep = (min, max, value) => {
  const t = Math.max(0, Math.min(1, (value - min) / Math.max(0.0001, max - min)));
  return t * t * (3 - 2 * t);
};

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
 *   mobileEarth?: SectionObjectConfig,
 *   moon?: SectionObjectConfig,
 *   mode?: 'day'|'night',
 *   cloudLayer?: boolean,
 *   cloudOpacity?: number,
 *   cloudShadowOpacity?: number,
 *   cloudScaleFactor?: number,
 *   cameraOrbit?: number,
 *   terrainRelief?: number,
 *   terrainDetailStrength?: number,
 *   surfaceClearcoat?: number,
 *   surfaceSpecularIntensity?: number,
 *   surfaceEmissiveIntensity?: number,
 *   surfaceNormalScale?: number,
 *   surfaceBumpScale?: number,
 *   proceduralTerrainMix?: number,
 *   axialTilt?: number,
 *   latitudeTilt?: number,
 *   lighting?: {
 *     ambientColor?: number,
 *     ambientIntensity?: number,
 *     sunIntensity?: number,
 *     sunPosition?: { x: number, y: number, z: number },
 *     fillIntensity?: number,
 *     fillColor?: number,
 *     rimIntensity?: number,
 *     rimColor?: number,
 *   },
 *   scroll?: {
 *     pos?: { x?: number, y?: number, z?: number },
 *     scale?: number,
 *     rotation?: number,
 *     orbit?: number,
 *   },
 * }} SectionConfig
 * @typedef {DeviceCapabilities & { recommendedQuality?: string, reducedMotion?: boolean }} EarthDeviceCapabilities
 * @typedef {{
 *   cloudLayer?: boolean,
 *   highCloudLayer?: boolean,
 *   terrainDetailScale?: number,
 *   meteorShowers?: boolean,
 *   desktopPixelRatio?: number,
 *   mobilePixelRatio?: number,
 * }} QualityConfig
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
    earth: { pos: { x: 0, y: -23.9, z: -1.1 }, scale: 5.75, rotation: -1.9 },
    mobileEarth: { pos: { x: 0, y: -23.5, z: -1.2 }, scale: 5.25, rotation: -1.9 },
    moon: { pos: { x: -6, y: 1, z: -12 }, scale: 0.36 },
    lighting: {
      ambientColor: 0x202b3d,
      ambientIntensity: 0.35,
      sunIntensity: 2.6,
      sunPosition: { x: 3.5, y: 6.8, z: 12 },
      fillColor: 0x88bbff,
      fillIntensity: 0.1,
      rimIntensity: 0.0,
    },
    mode: "day",
    terrainRelief: CONFIG.EARTH.HERO_DISPLACEMENT_SCALE,
    terrainDetailStrength: 1.0,
    surfaceClearcoat: 0.025,
    surfaceSpecularIntensity: 0.5,
    surfaceEmissiveIntensity: CONFIG.EARTH.CITY_LIGHT_INTENSITY,
    surfaceNormalScale: 1.25,
    surfaceBumpScale: 0.024,
    cityGlowMultiplier: 1,
    cityPointOpacity: 0,
    cloudLayer: true,
    cloudOpacity: 0.28,
    cloudShadowOpacity: 0.04,
    cloudScaleFactor: 1,
    proceduralTerrainMix: 1,
    cameraOrbit: 0,
    axialTilt: -7,
    latitudeTilt: -30,
    scroll: {
      pos: { x: 0.04, y: 0.04, z: -0.02 },
      scale: 0,
      rotation: 0,
      orbit: 0,
    },
  },
  features: {
    earth: { pos: { x: 0, y: -1.35, z: -2.35 }, scale: 1.12, rotation: -1.9 },
    mobileEarth: { pos: { x: 0, y: -1.1, z: -2.4 }, scale: 1, rotation: -1.9 },
    moon: { pos: { x: 4.8, y: 2.35, z: -9.6 }, scale: 0.62 },
    lighting: {
      ambientColor: 0x5f6678,
      ambientIntensity: 0.45,
      sunIntensity: 2.2,
      sunPosition: { x: 1.5, y: 4.2, z: 10.0 },
      fillIntensity: 0.15,
      rimIntensity: 0.3,
      rimColor: 0x88bbff,
    },
    mode: "day",
    terrainRelief: 0.012,
    terrainDetailStrength: 0.6, // Sharper terrain textures
    surfaceClearcoat: 0.012,
    surfaceSpecularIntensity: 0.16,
    surfaceEmissiveIntensity: CONFIG.EARTH.CITY_LIGHT_INTENSITY,
    surfaceNormalScale: 1.0,
    surfaceBumpScale: 0.012,
    cityGlowMultiplier: 1,
    cityPointOpacity: 0,
    cloudOpacity: 0.35, // More substantial clouds
    cloudShadowOpacity: 0.035, // Soft cloud shadows
    cloudScaleFactor: 1,
    proceduralTerrainMix: 1,
    cameraOrbit: 0,
    axialTilt: -7,
    latitudeTilt: 28.5,
    scroll: {
      pos: { x: 0.12, y: -0.08, z: 0.12 },
      scale: 0.04,
      rotation: 0,
      orbit: 0.06,
    },
  },
  section3: {
    earth: { pos: { x: 0, y: -1.35, z: -2.35 }, scale: 1.12, rotation: -1.9 },
    mobileEarth: { pos: { x: 0, y: -1.1, z: -2.4 }, scale: 1, rotation: -1.9 },
    moon: { pos: { x: 4.6, y: 2.2, z: -9.4 }, scale: 0.46 },
    lighting: {
      ambientColor: 0x425b86,
      ambientIntensity: 0.64,
      sunIntensity: 0.22,
      sunPosition: { x: -2.4, y: 3.2, z: 10.2 },
      fillColor: 0x79adff,
      fillIntensity: 0.32,
      rimColor: 0xffc76a,
      rimIntensity: 0,
    },
    mode: "night",
    terrainRelief: CONFIG.EARTH.DEFAULT_DISPLACEMENT_SCALE,
    terrainDetailStrength: 0,
    surfaceClearcoat: 0,
    surfaceSpecularIntensity: 0.08,
    surfaceEmissiveIntensity: CONFIG.EARTH.CITY_LIGHT_INTENSITY * 1.7,
    surfaceNormalScale: 0.72,
    surfaceBumpScale: CONFIG.EARTH.BUMP_SCALE,
    cityGlowMultiplier: 1.85,
    cityPointOpacity: 1,
    cloudLayer: true,
    cloudOpacity: 0.1,
    cloudShadowOpacity: 0.012,
    cloudScaleFactor: 1,
    proceduralTerrainMix: 0,
    cameraOrbit: Math.PI * 0.38,
    axialTilt: -7,
    latitudeTilt: 28.5,
    scroll: {
      pos: { x: 0, y: 0, z: 0 },
      scale: 0,
      rotation: 0,
      orbit: 0,
    },
  },
};

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

class ThreeEarthSystem {
  constructor() {
    this.timers = new TimerManager("ThreeEarthSystem");
    this.active = false;

    /** @type {typeof THREE|null} */ this.THREE = null;
    /** @type {THREE.Scene|null} */ this.scene = null;
    /** @type {THREE.PerspectiveCamera|null} */ this.camera = null;
    /** @type {THREE.WebGLRenderer|null} */ this.renderer = null;
    /** @type {HTMLElement|null} */ this.container = null;

    /** @type {EarthMesh|null} */ this.earthMesh = null;
    /** @type {EarthObject|null} */ this.moonMesh = null;
    /** @type {EarthObject|null} */ this.cloudMesh = null;
    /** @type {THREE.Object3D|null} */ this.cityGlowGroup = null;
    this.cityLightsPoints = null;
    /** @type {THREE.Object3D|null} */ this.proceduralTerrainGroup = null;
    /** @type {THREE.Vector3|null} */ this._terrainCameraLocal = null;
    /** @type {THREE.Vector3|null} */ this._terrainForwardAxis = null;
    /** @type {THREE.Quaternion|null} */ this._terrainTilt = null;

    /** @type {(THREE.Material & DisposableMaterial)|null} */ this.dayMaterial = null;
    /** @type {(THREE.Material & DisposableMaterial)|null} */ this.nightMaterial = null;

    /** @type {THREE.DirectionalLight|null} */ this.directionalLight = null;
    /** @type {THREE.AmbientLight|null} */ this.ambientLight = null;
    /** @type {THREE.DirectionalLight|null} */ this.fillLight = null;
    /** @type {THREE.PointLight|null} */ this.rimLight = null;
    this._lightTargets = null;
    this.earthAmbientRotation = 0;

    /** @type {CameraManager|null} */ this.cameraManager = null;
    /** @type {StarManager|null} */ this.starManager = null;
    /** @type {ShootingStarManager|null} */ this.shootingStarManager = null;
    /** @type {PerformanceMonitor|null} */ this.performanceMonitor = null;
    /** @type {CardManager|null} */ this.cardManager = null;

    this.currentSection = "hero";
    /** @type {HTMLElement|null} */ this._currentSectionEl = null;
    this.currentQualityLevel = "HIGH";
    this.isMobileDevice = false;
    this.isVisible = true;
    /** @type {EarthDeviceCapabilities|null} */
    this.deviceCapabilities = null;
    this._featuresCameraNeedsSettleLayout = false;
    this._scrollProgress = null;
    this._sectionEntries = new Map();
    this._zoomTransition = new EarthZoomTransition();

    this.animationFrameId = 0;
    this.animate = null;
    this.isOverlayPaused = false;
    this._resetAnimationTimer = false;
    this._overlayStateCleanup = null;
    this._canvasPauseTimeout = null;

    this.assetsReady = false;
    this.firstFrameRendered = false;

    this.showcaseActive = false;
    /** @type {TimerID|null} */
    this.showcaseTimeoutId = null;
    this.showcaseOriginals = {};

    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    this.onClick = this.onClick.bind(this);
    this.onShowcaseTrigger = this.onShowcaseTrigger.bind(this);

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
    this.container = container;
    this.active = true;

    try {
      log.info("Initializing Three.js Earth System v12.0.0 (Pure WebGL)");

      if (!this._detectAndEnsureWebGL()) return () => this.cleanup();

      this._registerAndBlock();

      this.THREE = THREE;

      showLoadingState(container);

      this._detectDevice();

      const sceneObjects = setupScene(this.THREE, container);
      this.scene = sceneObjects.scene;
      this.camera = sceneObjects.camera;
      this.renderer = sceneObjects.renderer;

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
      this.cityGlowGroup = earthAssets.cityGlowGroup;
      this.cityLightsPoints = earthAssets.cityLightsPoints;
      this.proceduralTerrainGroup = earthAssets.proceduralTerrainGroup;
      this._terrainCameraLocal = new this.THREE.Vector3();
      this._terrainForwardAxis = new this.THREE.Vector3(0, 0, 1);
      this._terrainTilt = new this.THREE.Quaternion().setFromEuler(
        new this.THREE.Euler(this.THREE.MathUtils.degToRad(-7), 0, 0)
      );
      this.moonMesh = moonLOD;
      this.cloudMesh = cloudObj;

      this._assembleScene();
      this._precompileEarthMaterials();
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
    this._overlayStateCleanup?.();
    this._overlayStateCleanup = null;
    this._zoomTransition.stop();
    if (this._canvasPauseTimeout) {
      clearTimeout(this._canvasPauseTimeout);
      this._canvasPauseTimeout = null;
    }

    document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    document.removeEventListener("three-earth:showcase", this.onShowcaseTrigger);

    this.shootingStarManager?.cleanup();
    this.cameraManager?.cleanup();
    this.starManager?.cleanup();

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
    if (this.container) {
      delete this.container.dataset.webglPaused;
      delete this.container.dataset.webglLoop;
    }
    this.container = null;

    if (this.cardManager) this.cardManager.cleanup();
    this.cardManager = null;

    unregisterParticleSystem("three-earth");
    document.body.classList.remove("three-earth-active");
    delete document.body.dataset.homeSection;

    if (singleton === this) singleton = null;
    const debugWindow = /** @type {any} */ (window);
    if (debugWindow.__threeEarthSystem === this) {
      delete debugWindow.__threeEarthSystem;
      delete debugWindow.__threeEarthCardManager;
    }

    log.info("Cleanup complete");
  }

  /**
   * @param {HTMLElement} container
   */
  _clearFallbacks(container) {
    try {
      container.classList.remove("error", "three-earth-unavailable");
      delete container.dataset.threeError;
      container.querySelector(".three-earth-error")?.classList.add("hidden");
      container
        .querySelectorAll(".three-earth-fallback")
        .forEach(el => /** @type {HTMLElement} */ (el).remove());
    } catch {
      /* ignore */
    }
  }

  _detectDevice() {
    this.isMobileDevice = Boolean(this.deviceCapabilities?.isMobile) || window.innerWidth <= 768;
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
      container.dataset.threeReady = "1";
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
    const ktx2Loader = createEarthKTX2Loader(this.renderer, loadingManager, this.isMobileDevice);

    try {
      return await Promise.all([
        createEarthSystem(
          this.THREE,
          this.scene,
          this.renderer,
          this.isMobileDevice,
          this.deviceCapabilities?.recommendedQuality || "MEDIUM",
          loadingManager,
          ktx2Loader
        ),
        createMoonSystem(
          this.THREE,
          this.scene,
          this.renderer,
          this.isMobileDevice,
          loadingManager
        ),
        createCloudLayer(
          this.THREE,
          this.renderer,
          loadingManager,
          this.isMobileDevice,
          ktx2Loader
        ),
      ]);
    } finally {
      ktx2Loader?.dispose();
    }
  }

  _setupStarsAndLighting() {
    try {
      this.starManager = new StarManager(this.THREE, this.scene);
      this.starManager.createStarField();

      const lights = setupLighting(this.THREE, this.scene);
      this.directionalLight = lights.directionalLight;
      this.ambientLight = lights.ambientLight;
      this.fillLight = lights.fillLight;
      this.rimLight = lights.rimLight;

      this._lightTargets = {
        directionalIntensity: 0,
        directionalPosition: new this.THREE.Vector3(),
        ambientIntensity: 0,
        ambientColor: new this.THREE.Color(),
        fillIntensity: 0,
        fillColor: new this.THREE.Color(),
        rimIntensity: 0,
        rimColor: new this.THREE.Color(),
      };
    } catch (err) {
      log.warn("Stars/Lighting init ignored", err);
    }
  }

  _assembleScene() {
    if (this.cloudMesh) {
      this.cloudMesh.position.copy(this.earthMesh.position);
      this.cloudMesh.scale.copy(this.earthMesh.scale);
      this.cloudMesh.rotation.z = this.earthMesh.rotation.z;
      this.cloudMesh.userData.currentScaleFactor = 1;
      this.cloudMesh.userData.targetScaleFactor = 1;
      this.scene.add(this.cloudMesh);
    }
  }

  _precompileEarthMaterials() {
    if (
      !this.renderer ||
      !this.scene ||
      !this.camera ||
      !this.earthMesh ||
      !this.dayMaterial ||
      !this.nightMaterial
    ) {
      return;
    }

    const originalMaterial = this.earthMesh.material;

    try {
      [this.dayMaterial, this.nightMaterial].forEach(material => {
        this.earthMesh.material = material;
        this.renderer.compile(this.scene, this.camera);
      });
    } catch (err) {
      log.debug("Earth material precompile skipped", err);
    } finally {
      this.earthMesh.material = originalMaterial;
    }
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
    document.body.dataset.homeSection = this.currentSection;
    this._updateEarthForSection(this.currentSection);
    this._syncWebGLVisibility(this.currentSection);

    this._setupSectionDetection();
    this._setupViewportObserver(container);

    document.body.classList.add("three-earth-active");

    this.shootingStarManager = new ShootingStarManager(this.scene, this.THREE);
    this.currentQualityLevel = this.deviceCapabilities?.recommendedQuality || "HIGH";
    this.performanceMonitor = new PerformanceMonitor(
      (/** @type {string} */ level) => this._applyQualityLevel(level),
      this.currentQualityLevel
    );
    this._applyQualityLevel(this.currentQualityLevel);

    this.cardManager = new CardManager(this.THREE, this.scene, this.camera, this.renderer);

    this.cardManager.initFromData(this._getCardData());
    this._syncFeatureCardsForSection();
  }

  _applyQualityLevel(level) {
    this.currentQualityLevel = level;
    const cfg = /** @type {Record<string, QualityConfig>} */ (CONFIG.QUALITY_LEVELS)[level] || {};
    const sectionConfig = SECTION_CONFIGS[this.currentSection] || SECTION_CONFIGS.hero;

    this._syncCloudVisibility(sectionConfig);
    this._applyTerrainQuality(cfg);
    if (this.shootingStarManager) {
      this.shootingStarManager.disabled = !cfg.meteorShowers;
    }

    if (!this.renderer || !this.container) return;
    const maxPixelRatio = this.isMobileDevice
      ? (cfg.mobilePixelRatio ?? 1.5)
      : (cfg.desktopPixelRatio ?? 1.75);
    const targetPixelRatio = Math.min(window.devicePixelRatio || 1, maxPixelRatio);
    if (Math.abs(this.renderer.getPixelRatio() - targetPixelRatio) < 0.01) return;

    this.renderer.setPixelRatio(targetPixelRatio);
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight, false);
  }

  _getCardData() {
    return [
      {
        title: "Profil",
        link: "/about/",
        routeLabel: "Profil",
        color: "#07a1ff",
      },
      {
        title: "Projekte",
        link: "/projekte/",
        routeLabel: "Projekte",
        color: "#a107ff",
      },
      {
        title: "Fotos",
        link: "/gallery/",
        routeLabel: "Fotos",
        color: "#ff07a1",
      },
      {
        title: "Videos",
        link: "/videos/",
        routeLabel: "Videos",
        color: "#07ffbc",
      },
      {
        title: "Journal",
        link: "/blog/",
        routeLabel: "Journal",
        color: "#ffb807",
      },
    ];
  }

  /**
   * @param {HTMLElement} container
   */
  _finalizeInitialization(container) {
    this._setupOverlayPause();
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
      try {
        const isLocal = location.hostname === "localhost" || location.hostname === "127.0.0.1";
        const debugFlag = location.search.includes("debugThree");
        if (isLocal || debugFlag) {
          try {
            const debugWindow = /** @type {any} */ (window);
            debugWindow.__threeEarthSystem = this;
            debugWindow.__threeEarthCardManager = this.cardManager || null;
          } catch {
            /* ignore */
          }
        }
      } catch {
        /* ignore */
      }
    } catch {
      /* ignore */
    }
  }

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
    if (event.defaultPrevented) return;

    const target = event.target;
    if (
      target instanceof Element &&
      target.closest(
        'a, button, input, label, select, textarea, [contenteditable], [role="button"], [role="link"], [role="dialog"], .site-header, site-footer, .overlay-backdrop, .robot-companion'
      )
    ) {
      return;
    }

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
      const handler = () => {
        if (!this.camera || !this.renderer) return;
        const width = container.clientWidth;
        const height = container.clientHeight;
        this.isMobileDevice = Boolean(this.deviceCapabilities?.isMobile) || width <= 768;

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
              this.isMobileDevice = Boolean(this.deviceCapabilities?.isMobile) || width <= 768;

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

  _canRunAnimationLoop() {
    return (
      this.active &&
      !document.hidden &&
      !this.isOverlayPaused &&
      this.isVisible &&
      this._isWebGLSectionVisible()
    );
  }

  _pauseAnimationLoop(reason) {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = 0;
    }
    if (this.container) this.container.dataset.webglLoop = "paused";
    this._resetAnimationTimer = true;
    log.debug(`Pausing render loop (${reason})`);
  }

  _resumeAnimationLoop(reason) {
    if (this.animationFrameId || !this.animate || !this._canRunAnimationLoop()) return;
    log.debug(`Resuming render loop (${reason})`);
    this.animate();
  }

  _setupOverlayPause() {
    this._overlayStateCleanup?.();
    this._overlayStateCleanup = activeOverlay.subscribe(mode => {
      const shouldPause = shouldModeShowBackdrop(mode);
      if (this.container) {
        this.container.dataset.webglPaused = String(shouldPause);
      }
      if (this.isOverlayPaused === shouldPause) return;

      this.isOverlayPaused = shouldPause;
      if (shouldPause) {
        this._pauseAnimationLoop(`overlay: ${mode}`);
      } else {
        this._resumeAnimationLoop("overlay closed");
      }
    });
  }

  _startAnimationLoop() {
    const timer = new this.THREE.Timer();
    let lastFrameTime = performance.now();

    this.animate = () => {
      if (!this._canRunAnimationLoop()) {
        this.animationFrameId = 0;
        if (this.container) this.container.dataset.webglLoop = "paused";
        return;
      }

      if (this.container) this.container.dataset.webglLoop = "running";
      this.animationFrameId = requestAnimationFrame(this.animate);

      const cap = /** @type {EarthDeviceCapabilities} */ (
        this.deviceCapabilities || detectDeviceCapabilities(log)
      );
      const targetFrameTime = cap.isLowEnd || cap.reducedMotion ? 33.33 : 16.67;

      const now = performance.now();
      if (this._resetAnimationTimer) {
        timer.reset?.();
        lastFrameTime = now;
        this._resetAnimationTimer = false;
      }
      const elapsed = now - lastFrameTime;

      if ((cap.isLowEnd || cap.reducedMotion) && elapsed < targetFrameTime) return;
      lastFrameTime = now;

      timer.update();
      const delta = timer.getDelta();
      const totalTime = timer.getElapsed();

      this._updateFrame(totalTime, delta, cap);
    };

    document.addEventListener("visibilitychange", this.handleVisibilityChange);
    this.animate();
  }

  handleVisibilityChange() {
    if (document.hidden) {
      this._pauseAnimationLoop("document hidden");
    } else {
      this._resumeAnimationLoop("document visible");
    }
  }

  /**
   * @param {number} totalTime
   * @param {number} delta
   * @param {EarthDeviceCapabilities} capabilities
   */
  _updateFrame(totalTime, delta, capabilities) {
    if (!capabilities.reducedMotion) {
      if (this.cloudMesh) {
        this.cloudMesh.rotation.y += CONFIG.CLOUDS.ROTATION_SPEED * 30 * delta;
      }
      this._updateCloudWind(totalTime);
      if (this.moonMesh) {
        this.moonMesh.rotation.y += CONFIG.MOON.ORBIT_SPEED * 20 * delta;
      }
    }
    this._scrollProgress = getScrollProgress(this.currentSection);
    const featuresSection3Progress = getFeaturesToSection3ScrollProgress(this.currentSection);
    if (!Number.isFinite(this._scrollProgress) && !Number.isFinite(featuresSection3Progress)) {
      this.earthAmbientRotation += CONFIG.EARTH.AMBIENT_ROTATION_SPEED * delta;
    }
    if (!capabilities.isLowEnd && !capabilities.reducedMotion) {
      this.starManager?.update(totalTime);
    }

    this._updateScrollLinkedEarthTarget(this._scrollProgress);

    if (Number.isFinite(this._scrollProgress)) {
      applyScrollLinkedSectionVisuals(
        this,
        SECTION_CONFIGS.hero,
        SECTION_CONFIGS.features,
        this._scrollProgress,
        CONFIG
      );
      this.cameraManager?.setScrollLinkedPresetProgress(
        "hero",
        "features",
        getZoomProgress(this._scrollProgress)
      );
    }
    if (Number.isFinite(featuresSection3Progress)) {
      applyFeaturesSection3CameraOrbit(
        this,
        SECTION_CONFIGS.features,
        SECTION_CONFIGS.section3,
        featuresSection3Progress,
        delta
      );
      applyScrollLinkedSectionVisuals(
        this,
        SECTION_CONFIGS.features,
        SECTION_CONFIGS.section3,
        featuresSection3Progress,
        CONFIG
      );
    }
    if (!Number.isFinite(featuresSection3Progress)) {
      this.cameraManager?.updateCameraPosition(delta);
    }
    this._updateTransforms(
      delta,
      Number.isFinite(featuresSection3Progress) && featuresSection3Progress > 0
        ? null
        : this._scrollProgress
    );
    updatePhysicalLightingUniforms(this);
    this.starManager?.syncToCamera(this.camera);
    this._updateFeatureCardExit();

    if (this.cardManager) {
      const featuresCameraTransitioning =
        this.currentSection === "features" &&
        (Boolean(this.cameraManager?.transition?.active) || this._zoomTransition.active);

      if (featuresCameraTransitioning) {
        this.cardManager.alignCardsToCameraImmediate?.();
      }

      this.cardManager.update(totalTime * 1000);
    }

    if (!capabilities.isLowEnd && !capabilities.reducedMotion) {
      this.shootingStarManager?.update(delta);
    }
    this.performanceMonitor?.update();

    this._render();
  }

  _updateFeatureCardExit() {
    if (this.currentSection !== "features" || !this.cardManager) return;
    const isLeaving = this._currentSectionEl?.classList.contains("is-leaving-before-scroll");
    if (isLeaving) {
      this.cardManager.hideImmediate();
      if (this.container) this.container.dataset.featureCards = "hidden";
    } else if (this.container?.dataset.featureCards === "hidden") {
      this.cardManager.setProgress(1);
      this.container.dataset.featureCards = "visible";
    }
  }

  _updateCloudWind(time) {
    const updateMaterials = materials => {
      materials?.forEach(material => {
        material.userData.windTime = time;
        const shader = material.userData.cloudShader;
        if (shader?.uniforms?.cloudTime) shader.uniforms.cloudTime.value = time;
      });
    };

    updateMaterials(this.cloudMesh?.userData?.windMaterials);
    if (this.proceduralTerrainGroup?.visible) {
      updateMaterials(this.proceduralTerrainGroup.userData.windMaterials);
    }
  }

  _updateTransforms(delta = 0.016, heroFeatureProgress = null) {
    if (!this.earthMesh) return;
    const em = this.earthMesh;
    if (this._zoomTransition.active) {
      em.userData.targetScale = this._zoomTransition.getScale(this._zoomTransition.endScale);
      em.userData.targetRotation = this._zoomTransition.getRotation(
        this._zoomTransition.endRotation
      );
      const stagedPosition = this._zoomTransition.getPosition(this._zoomTransition.endPosition);
      em.userData.targetPosition?.set(stagedPosition.x, stagedPosition.y, stagedPosition.z);
      em.rotation.x = this._zoomTransition.getLatitude(this._zoomTransition.endLatitude);
      if (this.cloudMesh) this.cloudMesh.rotation.x = em.rotation.x;
    }
    const posLerp = getDampingFactor(EARTH_TRANSFORM_DAMPING.position, delta);
    const scaleLerp = getDampingFactor(EARTH_TRANSFORM_DAMPING.scale, delta);
    const rotationLerp = getDampingFactor(EARTH_TRANSFORM_DAMPING.rotation, delta);
    const lightLerp = getDampingFactor(EARTH_TRANSFORM_DAMPING.light, delta);

    if (em.userData.targetPosition) em.position.lerp(em.userData.targetPosition, posLerp);
    if (Number.isFinite(em.userData.targetScale)) {
      em.scale.x += (em.userData.targetScale - em.scale.x) * scaleLerp;
      em.scale.y = em.scale.z = em.scale.x;
    }
    if (em.userData.targetRotation !== undefined) {
      const targetRotation = em.userData.targetRotation + this.earthAmbientRotation;
      const diff = targetRotation - em.rotation.y;
      if (Math.abs(diff) > 0.001) em.rotation.y += diff * rotationLerp;
    }
    if (Number.isFinite(heroFeatureProgress)) {
      this._zoomTransition.stop();
      applyScrollLinkedEarthTransform({
        earth: em,
        clouds: this.cloudMesh,
        heroConfig: SECTION_CONFIGS.hero,
        featuresConfig: SECTION_CONFIGS.features,
        isMobile: this.isMobileDevice,
        progress: heroFeatureProgress,
        startLatitude: this.THREE.MathUtils.degToRad(SECTION_CONFIGS.hero.latitudeTilt ?? -30),
        verticalTurn: HERO_FEATURE_VERTICAL_TURN,
        ambientRotation: this.earthAmbientRotation,
      });
    }
    if (
      this.proceduralTerrainGroup &&
      this.camera &&
      this._terrainCameraLocal &&
      this._terrainForwardAxis &&
      this._terrainTilt
    ) {
      const terrainGroup = this.proceduralTerrainGroup;
      const terrainData = /** @type {any} */ (terrainGroup.userData);
      const targetOpacity = Number.isFinite(terrainData.targetOpacity)
        ? terrainData.targetOpacity
        : 0;
      const regionalVisibility = smoothstep(
        EARTH_ZOOM_LOD.globeFadeEnd,
        EARTH_ZOOM_LOD.europeFull,
        em.scale.x
      );
      const berlinWeight = smoothstep(
        EARTH_ZOOM_LOD.berlinStart,
        EARTH_ZOOM_LOD.berlinFull,
        em.scale.x
      );
      const europeWeight = regionalVisibility * (1 - berlinWeight);
      const globeWeight = 1 - Math.max(berlinWeight, europeWeight);
      const berlinVisualWeight = smoothstep(0.52, 0.9, berlinWeight);
      const cloudWeight = berlinVisualWeight;
      const visibleOpacityTarget = targetOpacity * berlinVisualWeight;
      const positionSettled =
        !em.userData.targetPosition || em.position.distanceTo(em.userData.targetPosition) < 0.3;
      const scaleSettled =
        !Number.isFinite(em.userData.targetScale) ||
        Math.abs(em.scale.x - em.userData.targetScale) < 0.04;

      if (!terrainData.anchorLocked && targetOpacity > 0) {
        em.updateWorldMatrix(true, false);
        this._terrainCameraLocal.copy(this.camera.position);
        this._terrainCameraLocal.y += 11;
        em.worldToLocal(this._terrainCameraLocal);
        this._terrainCameraLocal.normalize();
        terrainGroup.quaternion.setFromUnitVectors(
          this._terrainForwardAxis,
          this._terrainCameraLocal
        );
        terrainGroup.quaternion.multiply(this._terrainTilt);
        terrainData.anchorLocked = positionSettled && scaleSettled;
      }

      terrainData.berlinWeight = berlinWeight;
      terrainData.europeWeight = europeWeight;
      terrainData.globeWeight = globeWeight;
      terrainData.opacity = Number.isFinite(heroFeatureProgress)
        ? visibleOpacityTarget
        : terrainData.opacity + (visibleOpacityTarget - terrainData.opacity) * scaleLerp;
      terrainGroup.visible = terrainData.opacity > 0.004;
      terrainData.fadeMaterials?.forEach(({ material, baseOpacity, lod }) => {
        const lodWeight =
          lod === "berlin"
            ? berlinVisualWeight
            : lod === "europe"
              ? europeWeight
              : lod === "cloud"
                ? cloudWeight
                : 1;
        material.opacity = terrainData.opacity * baseOpacity * lodWeight;
      });

      const zoomLevel =
        this.currentSection === "hero"
          ? "berlin"
          : em.scale.x > 1.75
            ? "berlin"
            : em.scale.x > 0.78
              ? "europe"
              : "globe";
      if (em.userData.zoomLevel !== zoomLevel) {
        em.userData.zoomLevel = zoomLevel;
        const zoomGeometries = /** @type {Record<string, THREE.BufferGeometry>|undefined} */ (
          em.userData.zoomGeometries
        );
        const nextGeometry = zoomGeometries?.[zoomLevel];
        if (nextGeometry && "geometry" in em) em.geometry = nextGeometry;
        if (this.container) this.container.dataset.earthZoomLevel = zoomLevel;
      }

      if (this.dayMaterial && em.userData.currentMode === "day") {
        const transitionProgress = Number.isFinite(heroFeatureProgress)
          ? getZoomProgress(heroFeatureProgress)
          : null;
        const reliefWeight = smoothstep(
          EARTH_ZOOM_LOD.globeFadeEnd,
          EARTH_ZOOM_LOD.berlinFull,
          em.scale.x
        );
        const terrainRelief = Number.isFinite(transitionProgress)
          ? this.THREE.MathUtils.lerp(
              SECTION_CONFIGS.hero.terrainRelief ?? CONFIG.EARTH.HERO_DISPLACEMENT_SCALE,
              SECTION_CONFIGS.features.terrainRelief ?? CONFIG.EARTH.DEFAULT_DISPLACEMENT_SCALE,
              transitionProgress
            )
          : this.THREE.MathUtils.lerp(
              CONFIG.EARTH.DEFAULT_DISPLACEMENT_SCALE,
              CONFIG.EARTH.HERO_DISPLACEMENT_SCALE,
              reliefWeight
            );
        const terrainDetailStrength = Number.isFinite(transitionProgress)
          ? this.THREE.MathUtils.lerp(
              SECTION_CONFIGS.hero.terrainDetailStrength ?? 0.72,
              SECTION_CONFIGS.features.terrainDetailStrength ?? 0.3,
              transitionProgress
            )
          : this.THREE.MathUtils.lerp(0.12, 0.72, reliefWeight);
        this.dayMaterial.displacementScale = terrainRelief;
        this.dayMaterial.userData.terrainDetailStrength = terrainDetailStrength;
        const reliefShader = /** @type {any} */ (this.dayMaterial.userData.reliefShader);
        if (reliefShader?.uniforms?.terrainDetailStrength) {
          reliefShader.uniforms.terrainDetailStrength.value = terrainDetailStrength;
        }
      }
    }

    if (this.cloudMesh) {
      this.cloudMesh.position.copy(em.position);
      const cloudData = this.cloudMesh.userData;
      const targetCloudScale = Number.isFinite(cloudData.targetScaleFactor)
        ? cloudData.targetScaleFactor
        : 1;
      const currentCloudScale = Number.isFinite(cloudData.currentScaleFactor)
        ? cloudData.currentScaleFactor
        : 1;
      cloudData.currentScaleFactor =
        currentCloudScale + (targetCloudScale - currentCloudScale) * scaleLerp;
      this.cloudMesh.scale.copy(em.scale).multiplyScalar(cloudData.currentScaleFactor);
    }

    if (this.moonMesh) {
      const mm = this.moonMesh;
      if (mm.userData.targetPosition) mm.position.lerp(mm.userData.targetPosition, posLerp);
      if (Number.isFinite(mm.userData.targetScale)) {
        mm.scale.x += (mm.userData.targetScale - mm.scale.x) * scaleLerp;
        mm.scale.y = mm.scale.z = mm.scale.x;
      }
    }

    this._updateLightTransition(lightLerp);
  }

  _updateLightTransition(factor) {
    const targets = this._lightTargets;
    if (!targets) return;

    if (this.directionalLight) {
      this.directionalLight.intensity +=
        (targets.directionalIntensity - this.directionalLight.intensity) * factor;
      this.directionalLight.position.lerp(targets.directionalPosition, factor);
    }
    if (this.ambientLight) {
      this.ambientLight.intensity +=
        (targets.ambientIntensity - this.ambientLight.intensity) * factor;
      this.ambientLight.color.lerp(targets.ambientColor, factor);
    }
    if (this.fillLight) {
      this.fillLight.intensity += (targets.fillIntensity - this.fillLight.intensity) * factor;
      this.fillLight.color.lerp(targets.fillColor, factor);
    }
    if (this.rimLight) {
      this.rimLight.intensity += (targets.rimIntensity - this.rimLight.intensity) * factor;
      this.rimLight.color.lerp(targets.rimColor, factor);
    }
  }

  _render() {
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);

      if (this.assetsReady && !this.firstFrameRendered) {
        this.firstFrameRendered = true;
        const container = getElementById("threeEarthContainer");

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

  _setupSectionDetection() {
    const sections = Array.from(document.querySelectorAll("section[id]"));
    if (!sections.length || !("IntersectionObserver" in window)) return;

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
    if (
      newSection === "features" &&
      this.currentSection === "hero" &&
      (getScrollProgress("hero") ?? 0) < 0.78
    ) {
      return;
    }

    this.currentSection = newSection;
    this._currentSectionEl = target;
    document.body.dataset.homeSection = newSection;

    if (newSection === "hero" && this.performanceMonitor) {
      const preferredQuality = this.deviceCapabilities?.recommendedQuality || "HIGH";
      this.performanceMonitor.restoreQuality(preferredQuality);
    }
    if (newSection === "hero" && this.proceduralTerrainGroup) {
      const terrainData = this.proceduralTerrainGroup.userData;
      terrainData.targetOpacity = SECTION_CONFIGS.hero.proceduralTerrainMix ?? 0;
      terrainData.anchorLocked = false;
    }

    const isHeroFeatureTransition = newSection === "hero" || newSection === "features";
    if (isHeroFeatureTransition) {
      this._zoomTransition.stop();
      const scrollProgress = getScrollProgress(newSection);
      if (Number.isFinite(scrollProgress)) {
        this.cameraManager?.setScrollLinkedPresetProgress(
          "hero",
          "features",
          getZoomProgress(scrollProgress)
        );
      }
    } else if (newSection === "section3") {
      this._zoomTransition.stop();
    } else {
      this._startEarthZoomTransition(newSection);
      this.cameraManager?.updateCameraForSection(newSection);
    }

    if (
      newSection !== "section3" &&
      (!isHeroFeatureTransition || this.earthMesh?.userData.currentMode !== "day")
    ) {
      this._updateEarthForSection(newSection);
    }
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
      this.cardManager.hideImmediate();
      this._featuresCameraNeedsSettleLayout = true;
      if (this.container) this.container.dataset.featureCards = "waiting";

      const preset = CONFIG.CAMERA.PRESETS["features"];
      const origPos = this.camera.position.clone();
      const origQuat = this.camera.quaternion.clone();

      if (preset) {
        this.camera.position.set(preset.x, preset.y, preset.z);
        this.camera.lookAt(preset.lookAt.x, preset.lookAt.y, preset.lookAt.z);
        this.camera.updateMatrixWorld(true);
      }

      this.cardManager.alignCardsToCameraImmediate?.();
      this.cardManager.refreshLayoutForCamera?.(true);

      if (preset) {
        this.camera.position.copy(origPos);
        this.camera.quaternion.copy(origQuat);
        this.camera.updateMatrixWorld(true);
      }

      this.cardManager.setProgress(1);
      this._featuresCameraNeedsSettleLayout = false;
      if (this.container) this.container.dataset.featureCards = "visible";
    } else {
      this.cardManager.hideImmediate();
      this._featuresCameraNeedsSettleLayout = false;
      if (this.container) this.container.dataset.featureCards = "hidden";
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

  _getCurrentSectionConfig() {
    return SECTION_CONFIGS[this.currentSection] || SECTION_CONFIGS.hero;
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

  _applyMoonTarget(moonConfig) {
    if (!this.moonMesh || !moonConfig) return;

    const moon = this.moonMesh;
    moon.userData.targetPosition ||= new this.THREE.Vector3();
    moon.userData.targetPosition.set(moonConfig.pos.x, moonConfig.pos.y, moonConfig.pos.z);
    moon.userData.targetScale = moonConfig.scale;
  }

  _startEarthZoomTransition(sectionName) {
    if (!this.earthMesh) return;
    const config = SECTION_CONFIGS[sectionName] || SECTION_CONFIGS.hero;
    const earthConfig =
      this.isMobileDevice && config.mobileEarth ? config.mobileEarth : config.earth;
    this._zoomTransition.start({
      isMobile: this.isMobileDevice,
      duration: CONFIG.CAMERA.TRANSITION_DURATION * 1000,
      startScale: this.earthMesh.scale.x,
      endScale: earthConfig.scale,
      startRotation: this.earthMesh.rotation.y - this.earthAmbientRotation,
      endRotation: earthConfig.rotation || 0,
      startLatitude: this.earthMesh.rotation.x,
      endLatitude: this.THREE.MathUtils.degToRad(config.latitudeTilt ?? 0),
      startPosition: {
        x: this.earthMesh.position.x,
        y: this.earthMesh.position.y,
        z: this.earthMesh.position.z,
      },
      endPosition: { ...earthConfig.pos },
    });
  }

  _updateScrollLinkedEarthTarget(heroFeatureProgress = null) {
    if (!this.earthMesh || !this.active || !this._isWebGLSectionVisible()) return;
    if (Number.isFinite(heroFeatureProgress)) {
      this.cameraManager?.setTargetOrbitAngle(0);
      return;
    }

    const config = this._getCurrentSectionConfig();
    const progress = this._getCurrentSectionScrollProgress();
    const centeredProgress = progress - 0.5;
    const scroll = config.scroll || {};
    const pos = scroll.pos || {};
    const earthConfig =
      this.isMobileDevice && config.mobileEarth ? config.mobileEarth : config.earth;
    const em = this.earthMesh;

    if (!em.userData.targetPosition) {
      em.userData.targetPosition = new this.THREE.Vector3();
    }

    const sectionPosition = {
      x: earthConfig.pos.x + (pos.x || 0) * centeredProgress,
      y: earthConfig.pos.y + (pos.y || 0) * centeredProgress,
      z: earthConfig.pos.z + (pos.z || 0) * centeredProgress,
    };
    const stagedPosition = this._zoomTransition.getPosition(sectionPosition);
    em.userData.targetPosition.set(stagedPosition.x, stagedPosition.y, stagedPosition.z);
    const sectionScale = Math.max(0.2, earthConfig.scale + (scroll.scale || 0) * centeredProgress);
    em.userData.targetScale = this._zoomTransition.getScale(sectionScale);
    const sectionRotation = (earthConfig.rotation || 0) + (scroll.rotation || 0) * centeredProgress;
    em.userData.targetRotation = this._zoomTransition.getRotation(sectionRotation);

    this._applyMoonTarget(config.moon);

    const baseOrbit = config.cameraOrbit ?? (em.userData.currentMode === "night" ? Math.PI : 0);
    this.cameraManager?.setTargetOrbitAngle(baseOrbit + (scroll.orbit || 0) * centeredProgress);
  }

  /**
   * @param {string} sectionName
   */
  _syncWebGLVisibility(sectionName) {
    const shouldRender = this._isWebGLSectionVisible(sectionName);

    if (!shouldRender) {
      this._pauseAnimationLoop("WebGL section hidden");
      this.cardManager?.setProgress(0);
      return;
    }

    this._resumeAnimationLoop("WebGL section visible");
  }

  /**
   * @param {string} sectionName
   */
  _updateEarthForSection(sectionName) {
    if (!this.earthMesh || !this.active) return;

    const config = SECTION_CONFIGS[sectionName] || SECTION_CONFIGS.hero;
    this._applyConfigToMeshes(config);

    const axialTilt = this.THREE.MathUtils.degToRad(config.axialTilt ?? CONFIG.EARTH.AXIAL_TILT);
    this.earthMesh.rotation.z = axialTilt;
    this.earthMesh.rotation.x = this.THREE.MathUtils.degToRad(config.latitudeTilt ?? 0);
    if (this.cloudMesh) this.cloudMesh.rotation.z = axialTilt;
    if (this.cloudMesh) this.cloudMesh.rotation.x = this.earthMesh.rotation.x;
    if (this.proceduralTerrainGroup) {
      const nextTerrainOpacity = config.proceduralTerrainMix ?? 0;
      const terrainData = this.proceduralTerrainGroup.userData;
      if (nextTerrainOpacity > 0 && (terrainData.targetOpacity ?? 0) <= 0) {
        terrainData.anchorLocked = false;
      }
      terrainData.targetOpacity = nextTerrainOpacity;
    }

    this._syncCloudVisibility(config);

    this.cityGlowGroup?.traverse(object => {
      const glowOpacity = object.material?.uniforms?.glowOpacity;
      const baseOpacity = object.material?.userData?.baseGlowOpacity;
      if (glowOpacity && Number.isFinite(baseOpacity)) {
        glowOpacity.value = baseOpacity * (config.cityGlowMultiplier ?? 1);
      }
    });
    const cityPointOpacity = this.cityLightsPoints?.getObjectByName?.(
      "earth-city-light-points-mesh"
    )?.material?.uniforms?.cityPointOpacity;
    if (cityPointOpacity) cityPointOpacity.value = config.cityPointOpacity ?? 0;

    if (config.mode) {
      const newMode = config.mode;
      const nextMaterial = newMode === "day" ? this.dayMaterial : this.nightMaterial;
      if (!nextMaterial) return;
      const terrainRelief = config.terrainRelief ?? CONFIG.EARTH.DEFAULT_DISPLACEMENT_SCALE;
      if ("displacementScale" in nextMaterial) {
        nextMaterial.displacementScale = terrainRelief;
      }
      if ("clearcoat" in nextMaterial) {
        nextMaterial.clearcoat = config.surfaceClearcoat ?? 0;
      }
      if ("specularIntensity" in nextMaterial) {
        nextMaterial.specularIntensity = config.surfaceSpecularIntensity ?? 1;
      }
      if ("emissiveIntensity" in nextMaterial && config.surfaceEmissiveIntensity !== undefined) {
        nextMaterial.emissiveIntensity = config.surfaceEmissiveIntensity;
      }
      if ("normalScale" in nextMaterial && config.surfaceNormalScale !== undefined) {
        nextMaterial.normalScale.setScalar(config.surfaceNormalScale);
      }
      if ("bumpScale" in nextMaterial && config.surfaceBumpScale !== undefined) {
        nextMaterial.bumpScale = config.surfaceBumpScale;
      }
      if (this.dayMaterial) {
        const terrainDetailStrength = config.terrainDetailStrength ?? 0;
        this.dayMaterial.userData.terrainDetailStrength = terrainDetailStrength;
        const reliefShader = /** @type {any} */ (this.dayMaterial.userData.reliefShader);
        if (reliefShader?.uniforms?.terrainDetailStrength) {
          reliefShader.uniforms.terrainDetailStrength.value = terrainDetailStrength;
        }
      }
      this.earthMesh.material = nextMaterial;
      if (newMode !== this.earthMesh.userData.currentMode) {
        this.cameraManager?.setTargetOrbitAngle(
          config.cameraOrbit ?? (newMode === "day" ? 0 : Math.PI)
        );
      }
      this.earthMesh.userData.currentMode = newMode;
      if (this.cityGlowGroup) this.cityGlowGroup.visible = true;
    }

    this._setLightTargets(config);
  }

  _syncCloudVisibility(config = SECTION_CONFIGS[this.currentSection] || SECTION_CONFIGS.hero) {
    if (!this.cloudMesh) return;
    this.cloudMesh.userData.targetScaleFactor = config.cloudScaleFactor ?? 1;
    const quality =
      /** @type {Record<string, QualityConfig>} */ (CONFIG.QUALITY_LEVELS)[
        this.currentQualityLevel
      ] || {};
    this.cloudMesh.visible = config.cloudLayer !== false && quality.cloudLayer !== false;

    // Cache getObjectByName results — the mesh hierarchy never changes after init.
    const parts =
      this.cloudMesh.userData.syncParts ||
      (this.cloudMesh.userData.syncParts = {
        surface: this.cloudMesh.getObjectByName?.("earth-cloud-surface"),
        high: this.cloudMesh.getObjectByName?.("earth-cloud-high"),
        shadow: this.cloudMesh.getObjectByName?.("earth-cloud-shadow"),
      });

    if (parts.surface?.material && config.cloudOpacity !== undefined) {
      parts.surface.material.opacity = config.cloudOpacity;
    }
    if (parts.high?.material && config.cloudOpacity !== undefined) {
      parts.high.material.opacity = config.cloudOpacity * CONFIG.CLOUDS.HIGH_OPACITY_FACTOR;
      parts.high.visible = quality.highCloudLayer !== false;
    }
    if (parts.shadow?.material && config.cloudShadowOpacity !== undefined) {
      parts.shadow.material.opacity = config.cloudShadowOpacity;
    }
    const regionalHighCloud = this.proceduralTerrainGroup?.getObjectByName?.(
      "earth-regional-cloud-high"
    );
    if (regionalHighCloud) regionalHighCloud.visible = quality.highCloudLayer !== false;
  }

  _applyTerrainQuality(quality) {
    const terrainMaterial = /** @type {any} */ (
      this.proceduralTerrainGroup?.userData?.terrainMaterial
    );
    if (!terrainMaterial) return;
    const detailScale = quality.terrainDetailScale ?? 1;
    terrainMaterial.normalScale?.setScalar(0.3 * detailScale);
    terrainMaterial.bumpScale = 0.0026 * detailScale;
  }

  _setLightTargets(config) {
    if (!this.THREE || !this.earthMesh || !this._lightTargets) return;

    const mode = this.earthMesh.userData.currentMode;
    const lightCfg = mode === "day" ? CONFIG.LIGHTING.DAY : CONFIG.LIGHTING.NIGHT;
    const sectionLight = config.lighting || {};
    const sunX = sectionLight.sunPosition?.x ?? -10;
    const sunY = sectionLight.sunPosition?.y ?? 6;
    const sunZ = sectionLight.sunPosition?.z ?? 12;

    // Update pre-allocated objects with .set() to avoid GC pressure from
    // allocating new THREE.Vector3 / THREE.Color on every section change.
    const targets = this._lightTargets;
    targets.directionalIntensity = sectionLight.sunIntensity ?? lightCfg.SUN_INTENSITY;
    targets.directionalPosition.set(sunX, sunY, sunZ);
    targets.ambientIntensity = sectionLight.ambientIntensity ?? lightCfg.AMBIENT_INTENSITY;
    targets.ambientColor.set(sectionLight.ambientColor ?? lightCfg.AMBIENT_COLOR);
    targets.fillIntensity = sectionLight.fillIntensity ?? lightCfg.FILL_INTENSITY;
    targets.fillColor.set(sectionLight.fillColor ?? 0x6ea8ff);
    targets.rimIntensity = sectionLight.rimIntensity ?? lightCfg.RIM_INTENSITY;
    targets.rimColor.set(sectionLight.rimColor ?? 0xffc76a);

    const terrainSunDirection = /** @type {any} */ (
      this.dayMaterial?.userData?.terrainSunDirection
    );
    if (terrainSunDirection?.set) {
      terrainSunDirection.set(-sunX, sunY);
      if (terrainSunDirection.lengthSq() > 0) terrainSunDirection.normalize();
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
    const earthConfig =
      this.isMobileDevice && config.mobileEarth ? config.mobileEarth : config.earth;
    const stagedPosition = this._zoomTransition.getPosition(earthConfig.pos);
    em.userData.targetPosition.set(stagedPosition.x, stagedPosition.y, stagedPosition.z);
    em.userData.targetScale = this._zoomTransition.active
      ? this._zoomTransition.getScale(earthConfig.scale)
      : earthConfig.scale;
    em.userData.targetRotation = this._zoomTransition.active
      ? this._zoomTransition.getRotation(earthConfig.rotation || 0)
      : earthConfig.rotation;

    this._applyMoonTarget(config.moon);
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
          this._resumeAnimationLoop("WebGL area in view");
        } else {
          if (this._canvasPauseTimeout) clearTimeout(this._canvasPauseTimeout);
          this._canvasPauseTimeout = setTimeout(() => {
            if (!this.isVisible) {
              this._pauseAnimationLoop("WebGL area out of view");
              this._clearWebGLCanvas();
            }
          }, WEBGL_CANVAS_CLEAR_DELAY_MS);
        }
      },
      { threshold: 0, rootMargin: "100px" }
    );
    this.viewportObserver = /** @type {ObserverWrapper} */ (createdViewportObserver);

    const targets = document.querySelectorAll("#hero, #features, #section3");
    const viewportObserver = /** @type {ObserverWrapper|null} */ (this.viewportObserver);
    if (!viewportObserver) return;
    if (targets.length) {
      targets.forEach(el => viewportObserver.observe(el));
    } else {
      viewportObserver.observe(container);
    }
  }

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
    };

    CONFIG.CLOUDS.ROTATION_SPEED *= 3;

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
    const originals = /** @type {{cloudSpeed?: number}} */ (this.showcaseOriginals);
    if (originals.cloudSpeed !== undefined) {
      CONFIG.CLOUDS.ROTATION_SPEED = originals.cloudSpeed;
    }
  }

  /**
   * @param {HTMLElement} container
   * @param {unknown} error
   */
  _handleInitError(container, error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.error("Earth initialization failed:", error);
    container.dataset.threeError = errorMessage;

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
    const zoomGeometries = /** @type {Record<string, THREE.BufferGeometry>|undefined} */ (
      this.earthMesh?.userData?.zoomGeometries
    );
    if (zoomGeometries && this.earthMesh) {
      const activeGeometry = this.earthMesh.geometry;
      new Set(Object.values(zoomGeometries)).forEach(geometry => {
        if (geometry !== activeGeometry) geometry.dispose();
      });
    }

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
    this.cityGlowGroup = null;
    this.cityLightsPoints = null;
    this.proceduralTerrainGroup = null;
    this._terrainCameraLocal = null;
    this._terrainForwardAxis = null;
    this._terrainTilt = null;
    this.dayMaterial = null;
    this.nightMaterial = null;
    this.directionalLight = null;
    this.ambientLight = null;
    this.fillLight = null;
    this.rimLight = null;
    this._lightTargets = null;
    this.cameraManager = null;
    this.starManager = null;
    this.shootingStarManager = null;
    this.performanceMonitor = null;
  }

  _detectAndEnsureWebGL() {
    try {
      this.deviceCapabilities = detectDeviceCapabilities(log);
      Object.assign(CONFIG, getOptimizedConfig(this.deviceCapabilities));
    } catch (err) {
      log.debug("Device detection failed", err);
    }

    const urlParams = new URL(location.href).searchParams;
    const forceThree = urlParams.get("forceThree") === "1";

    if (!supportsWebGL(log) && !forceThree) {
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
}

/** @type {ThreeEarthSystem|null} */
let singleton = null;

export const initThreeEarth = () => {
  if (!singleton) singleton = new ThreeEarthSystem();
  return singleton.init();
};

/**
 * @param {DisposableMaterial|null|undefined} material
 */
function disposeMaterial(material) {
  if (!material) return;
  const textureProps = [
    "map",
    "normalMap",
    "bumpMap",
    "displacementMap",
    "envMap",
    "emissiveMap",
    "alphaMap",
  ];
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
