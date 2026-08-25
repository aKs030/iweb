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
  attachRegionalCloudLayer,
} from "./earth/assets.js?v=berlin-mitte-r2";
import { CameraManager, getResponsiveCameraFov } from "./earth/camera.js";
import { EarthDetailTileManager } from "./earth/detail-tiles.js";
import {
  applyFeaturesSection3CameraOrbit,
  applyScrollLinkedEarthTransform,
  applyScrollLinkedSectionVisuals,
  EarthZoomTransition,
  getFeaturesToSection3ScrollProgress,
  getSection3ToFooterScrollProgress,
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
const WEBGL_RENDER_SECTIONS = new Set(["hero", "features", "section3", "site-footer"]);
const EARTH_TRANSFORM_DAMPING = Object.freeze({
  position: 3.2,
  scale: 4.2,
  rotation: 3,
  light: 5,
});
const EARTH_ZOOM_LOD = Object.freeze({
  globeFadeEnd: 0.68,
  berlinStart: 2.2,
  berlinFull: 4.2,
});
const WEBGL_CANVAS_CLEAR_DELAY_MS = 800;

const getDampingFactor = (rate, delta) => 1 - Math.exp(-rate * Math.min(delta, 1 / 15));
const smoothstep = (min, max, value) => {
  const t = Math.max(0, Math.min(1, (value - min) / Math.max(0.0001, max - min)));
  return t * t * (3 - 2 * t);
};
const requestEarthRetry = () => {
  const detail = {};
  document.dispatchEvent(new CustomEvent("three-earth:retry", { detail }));
  return detail.promise;
};

const SECTION_CONFIGS = {
  hero: {
    earth: { pos: { x: 0, y: -44.7, z: -1.1 }, scale: 12.0, rotation: -1.9 },
    mobileEarth: { pos: { x: 0, y: -43.3, z: -1.2 }, scale: 11.5, rotation: -1.9 },
    moon: { pos: { x: -6, y: 1, z: -12 }, scale: 0.36 },
    lighting: {
      // The aerial photograph was captured in clear summer daylight. A higher,
      // neutral fill keeps its real colour information visible while the low
      // sun still gives the close-up a sense of scale.
      ambientColor: 0x3a4b62,
      ambientIntensity: 0.52,
      sunIntensity: 2.35,
      sunPosition: { x: 10.0, y: 5.4, z: 6.8 },
      fillColor: 0x9cc8ff,
      fillIntensity: 0.22,
      rimColor: 0x99ccff,
      rimIntensity: 0,
    },
    mode: "day",
    // A thin blue limb grounds the close-up in a real atmosphere without
    // obscuring the orthophoto detail behind the headline.
    atmosphereVisible: true,
    atmosphereOpacity: 0.28,
    surfaceOpacity: 1,
    terrainRelief: CONFIG.EARTH.HERO_DISPLACEMENT_SCALE,
    terrainDetailStrength: 0,
    oceanGradeStrength: 0.54,
    oceanSaturation: 1.1,
    oceanBrightness: 1.04,
    surfaceClearcoat: 0.04,
    surfaceSpecularIntensity: 0.15,
    surfaceEmissiveIntensity: CONFIG.EARTH.CITY_LIGHT_INTENSITY,
    surfaceNormalScale: 0.2,
    cityGlowMultiplier: 1,
    cityPointOpacity: 0,
    cloudLayer: false,
    cloudOpacity: 0,
    cloudShadowOpacity: 0,
    cloudScaleFactor: 1,
    proceduralTerrainMix: 1,
    cameraOrbit: 0,
    axialTilt: -7,
    latitudeTilt: -12,
    scroll: {
      pos: { x: 0.04, y: 0.04, z: -0.02 },
      scale: 0,
      rotation: 0,
      orbit: 0,
    },
  },
  features: {
    earth: { pos: { x: 0, y: -1.35, z: -2.35 }, scale: 1.12, rotation: -1.28 },
    mobileEarth: { pos: { x: 0, y: -1.1, z: -2.4 }, scale: 1, rotation: -1.28 },
    moon: { pos: { x: 4.8, y: 2.35, z: -9.6 }, scale: 0.62 },
    lighting: {
      // ── Features / Section 2 – vivid afternoon daylight ──
      ambientColor: 0x6a7490, // ↑ slightly warmer ambient
      ambientIntensity: 0.48, // ↑ was 0.36 → less harsh darkness
      sunIntensity: 2.45, // ↑ was 2.1 → punchier highlights
      sunPosition: { x: 2.2, y: 5.0, z: 10.0 }, // higher sun for crisper shadows
      fillColor: 0x99ccff, // ↑ brighter blue fill
      fillIntensity: 0.18, // ↑ was 0.1 → reduce underexposed areas
      rimColor: 0x99ccff,
      rimIntensity: 0.12,
    },
    mode: "day",
    atmosphereVisible: true,
    atmosphereOpacity: 0.52, // ↑ was 0.42 → denser halo visible at limb
    surfaceOpacity: 1,
    terrainRelief: CONFIG.EARTH.HERO_DISPLACEMENT_SCALE * 0.5,
    terrainDetailStrength: 0.62, // ↑ was 0.5 → sharper terrain features
    oceanGradeStrength: 0.66, // ↑ was 0.58 → richer ocean
    oceanSaturation: 1.14, // ↑ was 1.08
    oceanBrightness: 1.06, // ↑ was 1.04
    surfaceClearcoat: 0.05, // ↑ was 0.03
    surfaceSpecularIntensity: 0.44, // ↑ was 0.34
    surfaceEmissiveIntensity: CONFIG.EARTH.CITY_LIGHT_INTENSITY,
    surfaceNormalScale: 0.85, // ↑ was 0.78
    cityGlowMultiplier: 1,
    cityPointOpacity: 0,
    cloudOpacity: 0.26, // ↑ was 0.21 → slightly denser clouds
    cloudShadowOpacity: 0.016, // ↑ was 0.014
    cloudScaleFactor: 1.005,
    proceduralTerrainMix: 0,
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
    earth: { pos: { x: 0, y: -1.35, z: -2.35 }, scale: 1.12, rotation: -1.28 },
    mobileEarth: { pos: { x: 0, y: -1.1, z: -2.4 }, scale: 1, rotation: -1.28 },
    moon: { pos: { x: 4.6, y: 2.2, z: -9.4 }, scale: 0.46 },
    lighting: {
      // ── Section 3 – deep night side, vivid city lights ──
      ambientColor: 0x2a3d60, // deeper midnight blue
      ambientIntensity: 0.42, // was 0.5 → darker to make cities pop more
      sunIntensity: 0.18, // was 0.22 → slightly dimmer crescent sun
      sunPosition: { x: -2.4, y: 3.2, z: 10.2 },
      fillColor: 0x6699dd, // cooler blue fill
      fillIntensity: 0.32, // ↑ was 0.26 → slight earthshine fill
      rimColor: 0xffcc88, // warm crescent rim
      rimIntensity: 0.14, // ↑ was 0 → subtle limb brightening
    },
    mode: "night",
    atmosphereVisible: true,
    atmosphereOpacity: 0.58, // ↑ was 0.48 → richer limb glow
    surfaceOpacity: 1,
    terrainRelief: CONFIG.EARTH.DEFAULT_DISPLACEMENT_SCALE,
    terrainDetailStrength: 0,
    oceanGradeStrength: 0.52, // ↑ was 0.48
    oceanSaturation: 1.02, // ↑ was 1.0
    oceanBrightness: 0.92, // ↑ was 0.9
    surfaceClearcoat: 0,
    surfaceSpecularIntensity: 0.1, // ↑ was 0.08 → slight ocean reflection
    surfaceEmissiveIntensity: CONFIG.EARTH.CITY_LIGHT_INTENSITY * 1.75, // ↑ was 1.5 → brighter city lights
    surfaceNormalScale: 0.72,
    cityGlowMultiplier: 1.82, // ↑ was 1.55 → more dramatic city glow
    cityPointOpacity: 0.92, // ↑ was 0.78 → sharper city points
    cloudLayer: true,
    cloudOpacity: 0.07,
    cloudShadowOpacity: 0.004,
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
  "site-footer": {
    earth: { pos: { x: 0, y: -1.35, z: -2.35 }, scale: 1.12, rotation: -1.28 },
    mobileEarth: { pos: { x: 0, y: -1.1, z: -2.4 }, scale: 1, rotation: -1.28 },
    moon: { pos: { x: 4.6, y: 2.2, z: -9.4 }, scale: 0.46 },
    lighting: {
      ambientColor: 0x1f2e48,
      ambientIntensity: 0.32,
      sunIntensity: 0.12,
      sunPosition: { x: -2.4, y: 3.2, z: 10.2 },
      fillColor: 0x4d75b3,
      fillIntensity: 0.24,
      rimColor: 0xffbb77,
      rimIntensity: 0.1,
    },
    mode: "night",
    atmosphereVisible: true,
    atmosphereOpacity: 0.45,
    surfaceOpacity: 1,
    terrainRelief: CONFIG.EARTH.DEFAULT_DISPLACEMENT_SCALE,
    terrainDetailStrength: 0,
    oceanGradeStrength: 0.5,
    oceanSaturation: 1.0,
    oceanBrightness: 0.9,
    surfaceClearcoat: 0,
    surfaceSpecularIntensity: 0.08,
    surfaceEmissiveIntensity: CONFIG.EARTH.CITY_LIGHT_INTENSITY * 1.5,
    surfaceNormalScale: 0.72,
    cityGlowMultiplier: 1.5,
    cityPointOpacity: 0.85,
    cloudLayer: true,
    cloudOpacity: 0.05,
    cloudShadowOpacity: 0.003,
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

function onResize(callback, delay = 100) {
  const handler = debounce(callback, delay);
  window.addEventListener("resize", handler, { passive: true });
  return () => {
    window.removeEventListener("resize", handler);
  };
}

class ThreeEarthSystem {
  constructor() {
    this.timers = new TimerManager("ThreeEarthSystem");
    this.active = false;

    this.THREE = null;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.container = null;

    this.earthMesh = null;
    this.moonMesh = null;
    this.cloudMesh = null;
    this.cityGlowGroup = null;
    this.cityLightsPoints = null;
    this.detailTileManager = null;
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
    this.earthAmbientRotation = 0;

    this.cameraManager = null;
    this.starManager = null;
    this.shootingStarManager = null;
    this.performanceMonitor = null;
    this.cardManager = null;

    this.currentSection = "hero";
    this._currentSectionEl = null;
    this.currentQualityLevel = "HIGH";
    this._assetQualityCeiling = "MEDIUM";
    this.isMobileDevice = false;
    this.isMobileLayout = false;
    this.isVisible = true;

    this.deviceCapabilities = null;
    this._featuresCameraNeedsSettleLayout = false;
    this._scrollProgress = null;
    this._sectionEntries = new Map();
    this._zoomTransition = new EarthZoomTransition();

    this.animationFrameId = 0;
    this._firstFrameRafId = 0;
    this._initGeneration = 0;
    this._runtimeFailed = false;
    this.animate = null;
    this.isOverlayPaused = false;
    this._resetAnimationTimer = false;
    this._overlayStateCleanup = null;
    this._canvasPauseTimeout = null;

    this.assetsReady = false;
    this.firstFrameRendered = false;

    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    this.onClick = this.onClick.bind(this);

    this.sectionObserver = null;
    this.viewportObserver = null;
    this._visibleWebGLSections = new Set(WEBGL_RENDER_SECTIONS);
  }

  async init(signal) {
    const initGeneration = ++this._initGeneration;
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
    if (signal?.aborted) return () => this.cleanup();

    this._clearFallbacks(container);
    this.container = container;
    this.active = true;
    this._runtimeFailed = false;
    const abortInitialization = () => this.cleanup();
    signal?.addEventListener("abort", abortInitialization, { once: true });

    try {
      if (!this._detectAndEnsureWebGL()) {
        this.active = false;
        AppLoadManager.unblock("three-earth");
        return () => this.cleanup();
      }

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

      if (!this.active || initGeneration !== this._initGeneration) {
        this._disposeDetachedAssets(earthAssets?.earthMesh, moonLOD, cloudObj);
        return () => this.cleanup();
      }

      if (!earthAssets) {
        throw new Error("Failed to load earth assets");
      }
      this.assetsReady = true;

      this.earthMesh = earthAssets.earthMesh;
      this.dayMaterial = earthAssets.dayMaterial;
      this.nightMaterial = earthAssets.nightMaterial;
      this.cityGlowGroup = earthAssets.cityGlowGroup;
      this.cityLightsPoints = earthAssets.cityLightsPoints;
      this.proceduralTerrainGroup = earthAssets.proceduralTerrainGroup;
      this.detailTileManager = new EarthDetailTileManager(
        this.THREE,
        this.earthMesh,
        this.renderer,
        this.isMobileDevice,
        this.deviceCapabilities?.recommendedQuality || "MEDIUM"
      );
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
      this._finalizeInitialization(container);

      return () => this.cleanup();
    } catch (error) {
      if (signal?.aborted || !this.active || initGeneration !== this._initGeneration) {
        return () => this.cleanup();
      }
      this._handleInitError(container, error);
      throw error;
    } finally {
      signal?.removeEventListener("abort", abortInitialization);
    }
  }

  cleanup() {
    this.active = false;
    this._initGeneration++;

    this._removeInteractionHandlers();

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = 0;
    }
    if (this._firstFrameRafId) {
      cancelAnimationFrame(this._firstFrameRafId);
      this._firstFrameRafId = 0;
    }
    this._overlayStateCleanup?.();
    this._overlayStateCleanup = null;
    this._zoomTransition.stop();
    if (this._canvasPauseTimeout) {
      this.timers.clearTimeout(this._canvasPauseTimeout);
      this._canvasPauseTimeout = null;
    }

    document.removeEventListener("visibilitychange", this.handleVisibilityChange);

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

    if (this.cardManager) this.cardManager.cleanup();
    this.cardManager = null;
    this._disposeScene();

    this.assetsReady = false;
    this.firstFrameRendered = false;
    this._currentSectionEl = null;
    if (this.container) {
      delete this.container.dataset.webglPaused;
      delete this.container.dataset.webglLoop;
      delete this.container.dataset.threeAttached;
      delete this.container.dataset.threeReady;
      delete this.container.dataset.earthLoading;
      delete this.container.dataset.earthZoomLevel;
      this.container.setAttribute("aria-busy", "false");
    }
    this.container = null;

    unregisterParticleSystem("three-earth");
    document.body.classList.remove("three-earth-active");
    delete document.body.dataset.homeSection;

    if (singleton === this) singleton = null;
  }

  _clearFallbacks(container) {
    try {
      container.classList.remove("error", "three-earth-unavailable");
      delete container.dataset.threeError;
      container.querySelector(".three-earth-error")?.classList.add("hidden");
      container.querySelectorAll(".three-earth-fallback").forEach(el => el.remove());
    } catch (err) {
      void err;
    }
  }

  _detectDevice() {
    this.isMobileDevice = Boolean(this.deviceCapabilities?.isMobile);
    this.isMobileLayout = this.isMobileDevice || window.innerWidth <= 768;
  }

  _createLoadingManager(container) {
    const manager = new this.THREE.LoadingManager();

    manager.onStart = (_url, _loaded, _total) => {
      if (!this.active) return;
      showLoadingState(container, 0);
    };

    manager.onProgress = (_url, loaded, total) => {
      if (!this.active) return;
      const progress = Math.min(1, loaded / Math.max(1, total));
      showLoadingState(container, progress);
    };

    manager.onError = url => {
      log.warn("Error loading texture:", url);
    };

    return manager;
  }

  _registerAndBlock() {
    registerParticleSystem("three-earth", { type: "three-earth" });
    AppLoadManager.block("three-earth");
  }

  async _loadAssets(loadingManager) {
    const ktx2Loader = createEarthKTX2Loader(this.renderer, undefined, this.isMobileDevice);
    const qualityLevel = this.deviceCapabilities?.recommendedQuality || "MEDIUM";
    this._assetQualityCeiling = qualityLevel;

    try {
      return await Promise.all([
        createEarthSystem(
          this.THREE,
          this.scene,
          this.renderer,
          this.isMobileDevice,
          qualityLevel,
          loadingManager,
          ktx2Loader
        ),
        createMoonSystem(this.THREE, this.scene, this.renderer, this.isMobileDevice, qualityLevel),
        createCloudLayer(this.THREE, this.renderer, this.isMobileDevice, qualityLevel),
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
      this.cloudMesh.rotation.y = this.earthMesh.rotation.y;
      this.cloudMesh.userData.currentScaleFactor = 1;
      this.cloudMesh.userData.targetScaleFactor = 1;
      this.scene.add(this.cloudMesh);
    }
    attachRegionalCloudLayer(this.THREE, this.proceduralTerrainGroup, this.cloudMesh);
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
      new Set([this.dayMaterial, this.nightMaterial]).forEach(material => {
        this.earthMesh.material = material;
        this.renderer.compile(this.scene, this.camera);
      });
    } catch (err) {
      log.debug("Earth material precompile skipped", err);
    } finally {
      this.earthMesh.material = originalMaterial;
    }
  }

  _initManagers(container) {
    this.cameraManager = new CameraManager(this.THREE, this.camera);
    this.cameraManager.setupCameraSystem();

    const onWheel = event => {
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
    this.currentQualityLevel = this._assetQualityCeiling;
    this.performanceMonitor = new PerformanceMonitor(
      level => this._applyQualityLevel(level),
      this.currentQualityLevel,
      this._assetQualityCeiling
    );
    this._applyQualityLevel(this.currentQualityLevel);

    this.cardManager = new CardManager(this.THREE, this.scene, this.camera, this.renderer);

    this.cardManager.initFromData(this._getCardData());
    this._syncFeatureCardsForSection();
  }

  _applyQualityLevel(level) {
    this.currentQualityLevel = level;
    const cfg = CONFIG.QUALITY_LEVELS[level] || {};
    const sectionConfig = SECTION_CONFIGS[this.currentSection] || SECTION_CONFIGS.hero;

    this._syncCloudVisibility(sectionConfig);
    this._applyTerrainQuality(cfg);
    this.detailTileManager?.setQualityLevel(level);
    if (this.shootingStarManager) {
      this.shootingStarManager.disabled = !cfg.meteorShowers;
    }

    if (!this.renderer || !this.container) return;
    const maxPixelRatio = this.isMobileDevice
      ? (cfg.mobilePixelRatio ?? 1.75)
      : (cfg.desktopPixelRatio ?? 2.0);
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

  _finalizeInitialization(container) {
    this._setupOverlayPause();
    this._startAnimationLoop();
    this._setupResizeHandler(container);
    this._setupInteraction();

    container.dataset.threeReady = "1";
    document.dispatchEvent(
      new CustomEvent("three-ready", {
        detail: { containerId: container.id },
      })
    );
  }

  _setupInteraction() {
    window.addEventListener("click", this.onClick);
  }

  _removeInteractionHandlers() {
    window.removeEventListener("click", this.onClick);
  }

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

  _setupResizeHandler(container) {
    if (!("ResizeObserver" in window)) {
      const handler = () => this._applyViewportSize(container.clientWidth, container.clientHeight);
      const cleanup = onResize(handler, 100);
      sharedCleanupManager.addCleanupFunction("three-earth", cleanup, "resize");
      return;
    }

    let lastWidth = 0;
    let lastHeight = 0;

    const resizeObserver = new ResizeObserver(
      debounce(entries => {
        if (!this.active || !this.camera || !this.renderer) return;
        for (const entry of entries) {
          const { width, height } = entry.contentRect;

          if (
            lastWidth === 0 ||
            Math.abs(width - lastWidth) > 1 ||
            Math.abs(height - lastHeight) > 1
          ) {
            this._applyViewportSize(width, height);
            lastWidth = width;
            lastHeight = height;
          }
        }
      }, 100)
    );

    resizeObserver.observe(container);
    sharedCleanupManager.addCleanupFunction(
      "three-earth",
      () => resizeObserver.disconnect(),
      "ResizeObserver"
    );
  }

  _applyViewportSize(width, height) {
    if (!this.camera || !this.renderer || width <= 0 || height <= 0) return;
    this.isMobileLayout = this.isMobileDevice || width <= 768;
    const presetFov = CONFIG.CAMERA.PRESETS[this.currentSection]?.fov ?? CONFIG.CAMERA.FOV;
    this.camera.aspect = width / height;
    this.camera.fov = getResponsiveCameraFov(presetFov, this.isMobileLayout);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
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

  _pauseAnimationLoop() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = 0;
    }
    if (this.container) this.container.dataset.webglLoop = "paused";
    this._resetAnimationTimer = true;
  }

  _resumeAnimationLoop() {
    if (this.animationFrameId || !this.animate || !this._canRunAnimationLoop()) return;
    this.performanceMonitor?.resetSamplingWindow?.();
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
      this.animationFrameId = 0;
      if (!this._canRunAnimationLoop()) {
        if (this.container) this.container.dataset.webglLoop = "paused";
        return;
      }

      try {
        if (this.container) this.container.dataset.webglLoop = "running";
        const cap = this.deviceCapabilities || detectDeviceCapabilities(log);
        const targetFrameTime = cap.isLowEnd || cap.reducedMotion ? 33.33 : 16.67;
        const now = performance.now();
        if (this._resetAnimationTimer) {
          timer.reset?.();
          lastFrameTime = now;
          this._resetAnimationTimer = false;
        }
        const elapsed = now - lastFrameTime;

        if (!(cap.isLowEnd || cap.reducedMotion) || elapsed >= targetFrameTime) {
          lastFrameTime = now;
          timer.update();
          this._updateFrame(timer.getElapsed(), timer.getDelta(), cap);
        }
      } catch (error) {
        this._handleRuntimeError(error);
        return;
      }

      if (this._canRunAnimationLoop()) {
        this.animationFrameId = requestAnimationFrame(this.animate);
      }
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
    const section3FooterProgress = getSection3ToFooterScrollProgress(this.currentSection);
    if (
      !Number.isFinite(this._scrollProgress) &&
      !Number.isFinite(featuresSection3Progress) &&
      !Number.isFinite(section3FooterProgress)
    ) {
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
        delta,
        "features",
        "section3"
      );
      applyScrollLinkedSectionVisuals(
        this,
        SECTION_CONFIGS.features,
        SECTION_CONFIGS.section3,
        featuresSection3Progress,
        CONFIG,
        false
      );
    }
    if (Number.isFinite(section3FooterProgress)) {
      applyFeaturesSection3CameraOrbit(
        this,
        SECTION_CONFIGS.section3,
        SECTION_CONFIGS["site-footer"],
        section3FooterProgress,
        delta,
        "section3",
        "site-footer"
      );
      applyScrollLinkedSectionVisuals(
        this,
        SECTION_CONFIGS.section3,
        SECTION_CONFIGS["site-footer"],
        section3FooterProgress,
        CONFIG,
        false
      );
    }
    if (!Number.isFinite(featuresSection3Progress)) {
      this.cameraManager?.updateCameraPosition(delta);
    }
    this._updateTransforms(
      delta,
      Number.isFinite(featuresSection3Progress) && featuresSection3Progress > 0
        ? null
        : this._scrollProgress,
      featuresSection3Progress
    );
    this.detailTileManager?.update(
      this.camera,
      this.earthMesh?.userData.currentMode,
      this.earthMesh?.scale.x || 0,
      delta,
      Boolean(
        this.currentSection === "hero" ||
        (this.proceduralTerrainGroup?.userData.regionalAvailable &&
          (this.proceduralTerrainGroup.userData.opacity || 0) > 0.01)
      )
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
    this._updateOceanAndWater(totalTime);

    this._render();
  }

  _updateOceanAndWater(time) {
    if (this.dayMaterial) {
      this.dayMaterial.userData.oceanTime = time;
      const reliefShader = this.dayMaterial.userData.reliefShader;
      if (reliefShader?.uniforms?.oceanTime) {
        reliefShader.uniforms.oceanTime.value = time;
      }
    }
    if (this.proceduralTerrainGroup) {
      const lakes = this.proceduralTerrainGroup.getObjectByName("earth-regional-lakes");
      if (lakes?.material) {
        lakes.material.userData.waterTime = time;
        const waterShader = lakes.material.userData.waterShader;
        if (waterShader?.uniforms?.waterTime) {
          waterShader.uniforms.waterTime.value = time;
        }
      }
    }
  }

  _updateFeatureCardExit() {
    if (this.currentSection !== "features" || !this.cardManager) return;
    const isLeaving = this._currentSectionEl?.classList.contains("is-leaving-before-scroll");
    if (isLeaving) {
      this.cardManager.setProgress(0);
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
    const regionalShader = this.proceduralTerrainGroup?.userData?.rcs;
    if (regionalShader?.uniforms?.rct) regionalShader.uniforms.rct.value = time;
  }

  _updateTransforms(delta = 0.016, heroFeatureProgress = null, featuresSection3Progress = null) {
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
        isMobile: this.isMobileLayout,
        progress: heroFeatureProgress,
        startLatitude: this.THREE.MathUtils.degToRad(SECTION_CONFIGS.hero.latitudeTilt ?? -30),
        endLatitude: this.THREE.MathUtils.degToRad(SECTION_CONFIGS.features.latitudeTilt ?? 0),
        ambientRotation: this.earthAmbientRotation,
      });
    }
    if (
      this.proceduralTerrainGroup &&
      this.camera &&
      this._terrainCameraLocal &&
      this._terrainForwardAxis
    ) {
      if (this.camera && this._terrainCameraLocal && this._terrainForwardAxis) {
        const terrainGroup = this.proceduralTerrainGroup;
        const terrainData = terrainGroup.userData;
        const previousOpacity = terrainData.opacity || 0;
        let targetOpacity = 0;
        if (terrainData.regionalAvailable) {
          if (Number.isFinite(heroFeatureProgress)) {
            const transitionProgress = getZoomProgress(heroFeatureProgress);
            targetOpacity = this.THREE.MathUtils.lerp(
              SECTION_CONFIGS.hero.proceduralTerrainMix ?? 1,
              SECTION_CONFIGS.features.proceduralTerrainMix ?? 0,
              smoothstep(0.0, 0.45, transitionProgress)
            );
          } else if (Number.isFinite(featuresSection3Progress)) {
            targetOpacity = this.THREE.MathUtils.lerp(
              SECTION_CONFIGS.features.proceduralTerrainMix ?? 0,
              SECTION_CONFIGS.section3.proceduralTerrainMix ?? 0,
              featuresSection3Progress
            );
          } else {
            targetOpacity = SECTION_CONFIGS[this.currentSection]?.proceduralTerrainMix ?? 0;
          }
        }

        if (this._terrainTilt) {
          const positionSettled =
            !em.userData.targetPosition || em.position.distanceTo(em.userData.targetPosition) < 0.3;
          const scaleSettled =
            !Number.isFinite(em.userData.targetScale) ||
            Math.abs(em.scale.x - em.userData.targetScale) < 0.04;

          this._terrainCameraLocal.copy(this.camera.position);
          em.worldToLocal(this._terrainCameraLocal);
          this._terrainCameraLocal.normalize();
          terrainGroup.quaternion.setFromUnitVectors(
            this._terrainForwardAxis,
            this._terrainCameraLocal
          );
          terrainGroup.quaternion.multiply(this._terrainTilt);
          if (positionSettled && scaleSettled) {
            terrainData.anchorInitialized = true;
            terrainData.anchorLocked = true;
          }
        }

        if (previousOpacity <= 0.01 && targetOpacity > 0.01) {
          terrainData.anchorInitialized = false;
          terrainData.anchorLocked = false;
          terrainData.isReanchoring = true;
        }

        terrainData.opacity = targetOpacity;
        terrainGroup.visible = terrainData.opacity > 0.004;
        terrainData.fadeMaterials?.forEach(({ material, baseOpacity, writesDepth = false }) => {
          material.opacity = terrainData.opacity * baseOpacity;
          if (writesDepth) material.depthWrite = material.opacity >= 0.985;
        });
      }

      const zoomLevel = Number.isFinite(heroFeatureProgress)
        ? em.scale.x > EARTH_ZOOM_LOD.berlinStart
          ? "berlin"
          : "europe"
        : this.currentSection === "hero"
          ? "berlin"
          : em.scale.x > 1.75
            ? "berlin"
            : "europe";
      if (em.userData.zoomLevel !== zoomLevel) {
        em.userData.zoomLevel = zoomLevel;
        const zoomGeometries = em.userData.zoomGeometries;
        const nextGeometry = zoomGeometries?.[zoomLevel];
        if (nextGeometry && "geometry" in em) em.geometry = nextGeometry;
        if (this.container) this.container.dataset.earthZoomLevel = zoomLevel;
      }

      if (this.dayMaterial && em.userData.currentMode === "day") {
        const transitionProgress = Number.isFinite(heroFeatureProgress)
          ? getZoomProgress(heroFeatureProgress)
          : null;
        const section3Progress = Number.isFinite(featuresSection3Progress)
          ? smoothstep(0, 1, featuresSection3Progress)
          : null;
        const currentConfig = SECTION_CONFIGS[this.currentSection] || SECTION_CONFIGS.hero;
        const fallbackTerrainRelief = currentConfig.terrainRelief ?? 0;
        const fallbackDetailStrength = currentConfig.terrainDetailStrength ?? 0;
        const terrainRelief = Number.isFinite(transitionProgress)
          ? this.THREE.MathUtils.lerp(
              SECTION_CONFIGS.hero.terrainRelief ?? CONFIG.EARTH.HERO_DISPLACEMENT_SCALE,
              SECTION_CONFIGS.features.terrainRelief ?? CONFIG.EARTH.DEFAULT_DISPLACEMENT_SCALE,
              transitionProgress
            )
          : Number.isFinite(section3Progress)
            ? this.THREE.MathUtils.lerp(
                SECTION_CONFIGS.features.terrainRelief ?? 0,
                SECTION_CONFIGS.section3.terrainRelief ?? 0,
                section3Progress
              )
            : fallbackTerrainRelief;
        const terrainDetailStrength = Number.isFinite(transitionProgress)
          ? this.THREE.MathUtils.lerp(
              SECTION_CONFIGS.hero.terrainDetailStrength ?? 0,
              SECTION_CONFIGS.features.terrainDetailStrength ?? 0.3,
              transitionProgress
            )
          : Number.isFinite(section3Progress)
            ? this.THREE.MathUtils.lerp(
                SECTION_CONFIGS.features.terrainDetailStrength ?? 0,
                SECTION_CONFIGS.section3.terrainDetailStrength ?? 0,
                section3Progress
              )
            : fallbackDetailStrength;

        const fallbackMix = currentConfig.proceduralTerrainMix ?? 0;
        const proceduralTerrainMix = Number.isFinite(transitionProgress)
          ? this.THREE.MathUtils.lerp(
              SECTION_CONFIGS.hero.proceduralTerrainMix ?? 1,
              SECTION_CONFIGS.features.proceduralTerrainMix ?? 0,
              smoothstep(0.0, 0.45, transitionProgress)
            )
          : Number.isFinite(section3Progress)
            ? this.THREE.MathUtils.lerp(
                SECTION_CONFIGS.features.proceduralTerrainMix ?? 0,
                SECTION_CONFIGS.section3.proceduralTerrainMix ?? 0,
                section3Progress
              )
            : fallbackMix;

        this.dayMaterial.displacementScale = terrainRelief;
        this.dayMaterial.userData.terrainDetailStrength = terrainDetailStrength;
        this.dayMaterial.userData.proceduralTerrainMix = proceduralTerrainMix;
        const reliefShader = this.dayMaterial.userData.reliefShader;
        if (reliefShader?.uniforms?.terrainDetailStrength) {
          reliefShader.uniforms.terrainDetailStrength.value = terrainDetailStrength;
        }
        if (reliefShader?.uniforms?.proceduralTerrainMix) {
          reliefShader.uniforms.proceduralTerrainMix.value = proceduralTerrainMix;
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

        // Shader compile happens on first render. Sync all section uniforms
        // now that reliefShader is guaranteed to be populated.
        this._syncReliefShaderUniforms();

        const container = getElementById("threeEarthContainer");
        const initGeneration = this._initGeneration;

        this._firstFrameRafId = requestAnimationFrame(() => {
          this._firstFrameRafId = 0;
          if (!this.active || initGeneration !== this._initGeneration) return;
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

  _syncReliefShaderUniforms() {
    const material = this.dayMaterial;
    if (!material) return;
    const shader = /** @type {any} */ (material.userData.reliefShader);
    if (!shader?.uniforms) return;
    const ud = material.userData;
    if (shader.uniforms.terrainDetailStrength)
      shader.uniforms.terrainDetailStrength.value = ud.terrainDetailStrength ?? 1;
    if (shader.uniforms.oceanGradeStrength)
      shader.uniforms.oceanGradeStrength.value = ud.oceanGradeStrength ?? 0.48;
    if (shader.uniforms.oceanSaturation)
      shader.uniforms.oceanSaturation.value = ud.oceanSaturation ?? 1;
    if (shader.uniforms.oceanBrightness)
      shader.uniforms.oceanBrightness.value = ud.oceanBrightness ?? 1;
  }

  _setupSectionDetection() {
    const sectionElements = document.querySelectorAll(
      "section[id], site-footer[id], footer[id], .site-footer, #site-footer"
    );
    const sections = Array.from(sectionElements);
    if (!sections.length || !("IntersectionObserver" in window)) return;

    const thresholds = Array.from({ length: 11 }, (_, i) => i / 10);
    const sectionObserver = createObserver(
      entries => {
        if (!this.active) return;
        entries.forEach(entry => {
          const target = entry?.target;
          const id =
            target?.id || (target?.classList?.contains("site-footer") ? "site-footer" : "");
          if (id) {
            this._sectionEntries.set(id, entry);
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
    this.sectionObserver = sectionObserver;

    sections.forEach(s => this.sectionObserver?.observe(s));
  }

  _handleSectionChange(entry) {
    const target = entry.target;
    const newSection =
      target.id || (target.classList?.contains("site-footer") ? "site-footer" : "");
    if (!newSection || newSection === this.currentSection) return;
    if (
      newSection === "features" &&
      this.currentSection === "hero" &&
      (getScrollProgress("hero") ?? 0) < 0.78 &&
      window.location.hash !== "#features"
    ) {
      return;
    }

    this.currentSection = newSection;
    this._currentSectionEl = target;
    document.body.dataset.homeSection = newSection;

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
    const datasetContainer = container;
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
      this.cardManager.setProgress(0);
      this._featuresCameraNeedsSettleLayout = false;
      if (this.container) this.container.dataset.featureCards = "hidden";
    }
  }

  _resolveCurrentSection() {
    const hashId = decodeURIComponent(window.location.hash.slice(1));
    if (hashId) {
      const hashEl = document.getElementById(hashId);
      if (hashEl) {
        this._currentSectionEl = hashEl;
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

    this._currentSectionEl = bestEl;
    return bestId;
  }

  _isWebGLSectionVisible(sectionName = this.currentSection) {
    return WEBGL_RENDER_SECTIONS.has(sectionName) && this._visibleWebGLSections.has(sectionName);
  }

  _clearWebGLCanvas() {
    if (!this.renderer) return;
    this.renderer.clear(true, true, true);
  }

  _getCurrentSectionConfig() {
    return (
      SECTION_CONFIGS[this.currentSection] || SECTION_CONFIGS["site-footer"] || SECTION_CONFIGS.hero
    );
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
    moon.visible = moonConfig.scale > 0;
    moon.userData.targetPosition ||= new this.THREE.Vector3();
    moon.userData.targetPosition.set(moonConfig.pos.x, moonConfig.pos.y, moonConfig.pos.z);
    moon.userData.targetScale = moonConfig.scale;
  }

  _startEarthZoomTransition(sectionName) {
    if (!this.earthMesh) return;
    const config = SECTION_CONFIGS[sectionName] || SECTION_CONFIGS.hero;
    const earthConfig =
      this.isMobileLayout && config.mobileEarth ? config.mobileEarth : config.earth;
    this._zoomTransition.start({
      isMobile: this.isMobileLayout,
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
      this.isMobileLayout && config.mobileEarth ? config.mobileEarth : config.earth;
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

  _syncWebGLVisibility(sectionName) {
    const shouldRender = this._isWebGLSectionVisible(sectionName);

    if (!shouldRender) {
      this._pauseAnimationLoop("WebGL section hidden");
      this.cardManager?.setProgress(0);
      return;
    }

    this._resumeAnimationLoop("WebGL section visible");
  }

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
      const terrainData = this.proceduralTerrainGroup.userData;
      const nextTerrainOpacity = terrainData.regionalAvailable
        ? (config.proceduralTerrainMix ?? 0)
        : 0;
      if (nextTerrainOpacity > 0 && (terrainData.targetOpacity ?? 0) <= 0) {
        terrainData.anchorInitialized = false;
        terrainData.anchorLocked = false;
        terrainData.isReanchoring = true;
      }
      terrainData.targetOpacity = nextTerrainOpacity;
    }

    this._syncCloudVisibility(config);
    const atmosphere = this.earthMesh.getObjectByName?.("earth-atmosphere");
    if (atmosphere) {
      const atmosphereOpacity =
        config.atmosphereVisible === false ? 0 : (config.atmosphereOpacity ?? 0.42);
      atmosphere.userData.setOpacity?.(atmosphereOpacity);
      atmosphere.visible = atmosphereOpacity > 0.001;
    }

    this.cityGlowGroup?.traverse(object => {
      const glowOpacity = object.material?.uniforms?.glowOpacity;
      const baseOpacity = object.material?.userData?.baseGlowOpacity;
      if (glowOpacity && Number.isFinite(baseOpacity)) {
        glowOpacity.value = baseOpacity * (config.cityGlowMultiplier ?? 1);
      }
    });
    const cityPointsMesh = this.cityLightsPoints?.getObjectByName?.("earth-city-light-points-mesh");
    const targetPointOpacity = config.cityPointOpacity ?? 0;
    if (cityPointsMesh?.material?.uniforms?.cityPointOpacity) {
      cityPointsMesh.material.uniforms.cityPointOpacity.value = targetPointOpacity;
      cityPointsMesh.visible = targetPointOpacity > 0.001;
    }
    if (this.cityLightsPoints) {
      this.cityLightsPoints.visible = targetPointOpacity > 0.001;
    }

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
      if ("opacity" in nextMaterial) {
        nextMaterial.opacity = config.surfaceOpacity ?? 1;
        nextMaterial.depthWrite = nextMaterial.opacity >= 0.98;
      }
      if (this.dayMaterial) {
        const terrainDetailStrength = config.terrainDetailStrength ?? 0;
        this.dayMaterial.userData.terrainDetailStrength = terrainDetailStrength;
        const reliefShader = this.dayMaterial.userData.reliefShader;
        if (reliefShader?.uniforms?.terrainDetailStrength) {
          reliefShader.uniforms.terrainDetailStrength.value = terrainDetailStrength;
        }
        const oceanGradeStrength = config.oceanGradeStrength ?? 0.48;
        const oceanSaturation = config.oceanSaturation ?? 1;
        const oceanBrightness = config.oceanBrightness ?? 1;
        this.dayMaterial.userData.oceanGradeStrength = oceanGradeStrength;
        this.dayMaterial.userData.oceanSaturation = oceanSaturation;
        this.dayMaterial.userData.oceanBrightness = oceanBrightness;
        if (reliefShader?.uniforms?.oceanGradeStrength) {
          reliefShader.uniforms.oceanGradeStrength.value = oceanGradeStrength;
        }
        if (reliefShader?.uniforms?.oceanSaturation) {
          reliefShader.uniforms.oceanSaturation.value = oceanSaturation;
        }
        if (reliefShader?.uniforms?.oceanBrightness) {
          reliefShader.uniforms.oceanBrightness.value = oceanBrightness;
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
    const quality = CONFIG.QUALITY_LEVELS[this.currentQualityLevel] || {};
    this.cloudMesh.visible = config.cloudLayer !== false && quality.cloudLayer !== false;

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
  }

  _applyTerrainQuality(quality) {
    const terrainData = this.proceduralTerrainGroup?.userData;
    if (!terrainData) return;
    const detailScale = quality.terrainDetailScale ?? 1;
    const normalizedDetail = Math.max(0, Math.min(1, (detailScale - 0.52) / 0.48));
    const drawFraction = 0.35 + normalizedDetail * 0.65;

    // Support both old single cityMesh and new multi-variant cityMeshes[]
    if (Array.isArray(terrainData.cityMeshes)) {
      const totalFull = terrainData.cityFullCount || 0;
      const sliceCount = terrainData.cityMeshes.length;
      const perSliceFull = Math.round(totalFull / Math.max(sliceCount, 1));
      terrainData.cityMeshes.forEach(m => {
        m.count = Math.round(
          Math.min(m.userData?.fullCount ?? perSliceFull, perSliceFull) * drawFraction
        );
      });
    } else if (terrainData.cityMesh && Number.isFinite(terrainData.cityFullCount)) {
      terrainData.cityMesh.count = Math.round(terrainData.cityFullCount * drawFraction);
    }

    if (terrainData.forestMesh && Number.isFinite(terrainData.forestFullCount)) {
      terrainData.forestMesh.count = Math.round(terrainData.forestFullCount * drawFraction);
    }
  }

  _setLightTargets(config) {
    if (!this.THREE || !this.earthMesh || !this._lightTargets) return;

    const mode = this.earthMesh.userData.currentMode;
    const lightCfg = mode === "day" ? CONFIG.LIGHTING.DAY : CONFIG.LIGHTING.NIGHT;
    const sectionLight = config.lighting || {};
    const sunX = sectionLight.sunPosition?.x ?? -10;
    const sunY = sectionLight.sunPosition?.y ?? 6;
    const sunZ = sectionLight.sunPosition?.z ?? 12;

    const targets = this._lightTargets;
    targets.directionalIntensity = sectionLight.sunIntensity ?? lightCfg.SUN_INTENSITY;
    targets.directionalPosition.set(sunX, sunY, sunZ);
    targets.ambientIntensity = sectionLight.ambientIntensity ?? lightCfg.AMBIENT_INTENSITY;
    targets.ambientColor.set(sectionLight.ambientColor ?? lightCfg.AMBIENT_COLOR);
    targets.fillIntensity = sectionLight.fillIntensity ?? lightCfg.FILL_INTENSITY;
    targets.fillColor.set(sectionLight.fillColor ?? 0x6ea8ff);
    targets.rimIntensity = sectionLight.rimIntensity ?? lightCfg.RIM_INTENSITY;
    targets.rimColor.set(sectionLight.rimColor ?? 0xffc76a);

    const terrainSunDirection = this.dayMaterial?.userData?.terrainSunDirection;
    if (terrainSunDirection?.set) {
      terrainSunDirection.set(-sunX, sunY);
      if (terrainSunDirection.lengthSq() > 0) terrainSunDirection.normalize();
    }
  }

  _applyConfigToMeshes(config) {
    if (!config || !this.active) return;
    const em = this.earthMesh;
    if (!em) return;

    if (!em.userData.targetPosition) {
      em.userData.targetPosition = new this.THREE.Vector3();
    }
    const earthConfig =
      this.isMobileLayout && config.mobileEarth ? config.mobileEarth : config.earth;
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

  _setupViewportObserver(container) {
    if (!("IntersectionObserver" in window)) {
      this.isVisible = true;
      return;
    }

    this._visibleWebGLSections = new Set([this.currentSection]);

    const createdViewportObserver = createObserver(
      entries => {
        if (!this.active) return;
        const visibleSections = this._visibleWebGLSections;
        if (!visibleSections) return;
        entries.forEach(entry => {
          const target = entry.target;
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
            this.timers.clearTimeout(this._canvasPauseTimeout);
            this._canvasPauseTimeout = null;
          }
          this._resumeAnimationLoop("WebGL area in view");
        } else {
          if (this._canvasPauseTimeout) this.timers.clearTimeout(this._canvasPauseTimeout);
          this._canvasPauseTimeout = this.timers.setTimeout(() => {
            this._canvasPauseTimeout = null;
            if (this.active && !this.isVisible) {
              this._pauseAnimationLoop("WebGL area out of view");
              this._clearWebGLCanvas();
            }
          }, WEBGL_CANVAS_CLEAR_DELAY_MS);
        }
      },
      { threshold: 0, rootMargin: "100px" }
    );
    this.viewportObserver = createdViewportObserver;

    const targets = document.querySelectorAll("#hero, #features, #section3");
    const viewportObserver = this.viewportObserver;
    if (!viewportObserver) return;
    if (targets.length) {
      targets.forEach(el => viewportObserver.observe(el));
    } else {
      viewportObserver.observe(container);
    }
  }

  _handleInitError(container, error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.error("Earth initialization failed:", error);
    this.cleanup();
    container.dataset.threeError = errorMessage;
    AppLoadManager.unblock("three-earth");
    showErrorState(container, error, requestEarthRetry);
  }

  _handleRuntimeError(error) {
    if (this._runtimeFailed) return;
    this._runtimeFailed = true;
    const container = this.container;
    if (!container) {
      this.cleanup();
      return;
    }
    const runtimeError = error instanceof Error ? error : new Error(String(error));
    log.error("Earth render loop failed:", runtimeError);
    this.cleanup();
    container.dataset.threeError = runtimeError.message;
    AppLoadManager.unblock("three-earth");
    showErrorState(container, runtimeError, requestEarthRetry);
  }

  _disposeDetachedAssets(...objects) {
    const geometries = new Set();
    const materials = new Set();
    objects.filter(Boolean).forEach(object => {
      object.removeFromParent?.();
      object.traverse?.(child => {
        if (child.geometry) geometries.add(child.geometry);
        if (Array.isArray(child.material)) {
          child.material.forEach(material => materials.add(material));
        } else if (child.material) {
          materials.add(child.material);
        }
      });
    });
    geometries.forEach(geometry => geometry.dispose?.());
    materials.forEach(material => disposeMaterial(material));
  }

  _disposeScene() {
    this.detailTileManager?.dispose();
    this.detailTileManager = null;
    const zoomGeometries = this.earthMesh?.userData?.zoomGeometries;
    if (zoomGeometries && this.earthMesh) {
      const activeGeometry = this.earthMesh.geometry;
      new Set(Object.values(zoomGeometries)).forEach(geometry => {
        if (geometry !== activeGeometry) geometry.dispose();
      });
    }

    if (this.scene) {
      const geometries = new Set();
      const materials = new Set();
      this.scene.traverse(obj => {
        if (obj.geometry) geometries.add(obj.geometry);
        if (obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach(material => materials.add(material));
          } else {
            materials.add(obj.material);
          }
        }
      });
      geometries.forEach(geometry => geometry.dispose());
      materials.forEach(material => disposeMaterial(material));
      this.scene.clear();
    }

    if (this.renderer) {
      const canvas = this.renderer.domElement;
      try {
        this.renderer.dispose();
        if (typeof this.renderer.forceContextLoss === "function") {
          this.renderer.forceContextLoss();
        }
      } catch (err) {
        void err;
      }
      canvas.remove();
    }

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.earthMesh = null;
    this.moonMesh = null;
    this.cloudMesh = null;
    this.cityGlowGroup = null;
    this.cityLightsPoints = null;
    this.detailTileManager = null;
    this.proceduralTerrainGroup = null;
    this._terrainCameraLocal = null;
    this._terrainForwardAxis = null;
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

let singleton = null;

export const initThreeEarth = signal => {
  if (!singleton) singleton = new ThreeEarthSystem();
  return singleton.init(signal);
};

function disposeMaterial(material) {
  if (!material) return;
  ["map", "normalMap", "bumpMap", "displacementMap", "envMap", "emissiveMap", "alphaMap"].forEach(
    p => {
      const tex = material[p];
      if (tex && typeof tex.dispose === "function") {
        tex.dispose();
        material[p] = null;
      }
    }
  );
  if (material.uniforms) {
    Object.values(material.uniforms).forEach(u => u?.value?.dispose?.());
  }
  material.dispose?.();
}
