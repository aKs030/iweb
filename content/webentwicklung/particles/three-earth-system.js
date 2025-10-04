/**
 * Three.js Earth System - 3D WebGL Earth with Advanced Rendering
 *
 * High-Quality 3D Earth visualization featuring:
 * - Realistic PBR Earth textures with pulsing city lights
 * - ADVANCED: Rayleigh/Mie atmospheric scattering for realistic sky
 * - ADVANCED: Volumetric 3D clouds with multi-layer parallax (Simplex noise)
 * - ADVANCED: Ocean specular reflections with Fresnel effects
 * - Dynamic cloud layer with drift rotation (2D fallback option)
 * - Day/Night cycle: Sunlight rotates with clouds, creating moving city lights
 * - Procedural atmospheric glow using enhanced custom shader
 * - Procedural starfield with parallax and twinkling effects
 * - Mouse wheel zoom control for detailed inspection
 * - Scroll-based camera animations and section-responsive scenes
 * - Integrated performance monitor (FPS, Memory) with dynamic resolution scaling
 * - Occasional shooting stars for added visual flair
 * - Texture loading manager with a progress bar for better UX
 *
 * Uses shared-particle-system for parallax synchronization and effects.
 *
 * @author Portfolio System
 * @version 5.0.0
 * @created 2025-10-03
 * @last-modified 2025-10-04
 */
import {
  createLogger,
  getElementById,
  onResize,
  TimerManager,
} from "../shared-utilities.js";
import {
  getSharedState,
  registerParticleSystem,
  sharedCleanupManager,
  sharedParallaxManager,
  ShootingStarManager,
  unregisterParticleSystem,
} from "./shared-particle-system.js";

const log = createLogger("threeEarthSystem");
const earthTimers = new TimerManager();

// ===== NEW: Central Configuration Object =====
const CONFIG = {
  EARTH: {
    RADIUS: 3.5,
    SEGMENTS: 64, // Reduziert von 96 für bessere Performance
    BUMP_SCALE: 0.015,
    EMISSIVE_INTENSITY: 0.3, // Erhöht für hellere Stadtlichter
    EMISSIVE_PULSE_SPEED: 0.5, // ~12.6s pro Pulsation
    EMISSIVE_PULSE_AMPLITUDE: 0.1, // Pulsations-Stärke
  },
  CLOUDS: {
    ALTITUDE: 0.03,
    ROTATION_SPEED: 0.0013, // Subtiler Drift (~80.5s pro Umdrehung)
    OPACITY: 0.4,
  },
  ATMOSPHERE: {
    SCALE: 1.02,
    GLOW_COLOR: 0x6699ff,
    FRESNEL_POWER: 3.5,
    INTENSITY: 0.3,
    // Rayleigh/Mie Scattering Parameters
    RAYLEIGH_COEFFICIENT: [5.5e-6, 13.0e-6, 22.4e-6], // RGB wavelength scattering (blue scatters more)
    MIE_COEFFICIENT: 21e-6, // Aerosol/particle scattering
    RAYLEIGH_SCALE_HEIGHT: 8000, // meters - exponential density falloff
    MIE_SCALE_HEIGHT: 1200, // meters - aerosol layer thickness
    MIE_DIRECTIONAL_G: 0.76, // Henyey-Greenstein phase function parameter (forward scattering)
    ATMOSPHERE_RADIUS: 1.025, // Extended atmosphere for scattering
    SAMPLES: 16, // Ray-marching samples (lower for performance)
    LIGHT_SAMPLES: 8, // Optical depth samples
  },
  OCEAN: {
    SPECULAR_INTENSITY: 1.5, // Strength of ocean highlights
    SPECULAR_POWER: 128.0, // Sharpness/focus of highlights (higher = tighter)
    FRESNEL_BIAS: 0.1, // Base reflectivity at normal incidence
    FRESNEL_SCALE: 0.8, // Fresnel effect strength
    FRESNEL_POWER: 3.0, // Fresnel curve exponent
    OCEAN_MASK_THRESHOLD: 0.3, // RGB threshold to detect water in day texture (blue > threshold)
    ROUGHNESS_VARIATION: 0.15, // Ocean surface roughness variation
  },
  VOLUMETRIC_CLOUDS: {
    ENABLED: true, // Toggle volumetric clouds (performance-heavy)
    LAYERS: 3, // Number of cloud layers (1-5)
    BASE_ALTITUDE: 0.03, // Start altitude above surface
    LAYER_SPACING: 0.01, // Distance between layers
    DENSITY: 0.4, // Overall cloud density (0-1)
    SCALE: 3.0, // Noise texture scale (lower = larger clouds)
    OCTAVES: 3, // Noise detail levels (1-5, higher = more detail but slower)
    PERSISTENCE: 0.5, // Detail amplitude falloff
    LACUNARITY: 2.0, // Detail frequency increase
    SPEED_MULTIPLIER: [1.0, 0.8, 0.6], // Rotation speed per layer (creates parallax)
    OPACITY_FALLOFF: 0.7, // Opacity reduction per layer
    COVERAGE: 0.5, // Cloud coverage (0-1, higher = more clouds)
  },
  SUN: {
    RADIUS: 8, // Distanz der Sonne von der Erde
    HEIGHT: 3, // Höhe der Sonne
    INTENSITY: 2.0,
  },
  STARS: {
    COUNT: 2000,
    TWINKLE_SPEED: 0.5,
  },
  CAMERA: {
    FOV: 35,
    NEAR: 0.1,
    FAR: 1000,
    ZOOM_MIN: 4,
    ZOOM_MAX: 30,
    LERP_FACTOR: 0.05, // Linear interpolation factor for smooth camera movement
  },
  PERFORMANCE: {
    PIXEL_RATIO: Math.min(window.devicePixelRatio, 1.5),
    TARGET_FPS: 50,
    DRS_DOWN_THRESHOLD: 45, // Dynamic Resolution Scaling FPS threshold to scale down
    DRS_UP_THRESHOLD: 55, // Dynamic Resolution Scaling FPS threshold to scale up
  },
  PATHS: {
    THREE_JS: [
      "/content/webentwicklung/lib/three/build/three.module.min.js",
      "https://cdn.jsdelivr.net/npm/three@0.155.0/build/three.module.js",
    ],
    TEXTURES: {
      DAY: "/content/img/earth/textures/earth_day.webp",
      NIGHT: "/content/img/earth/textures/earth_night.webp",
      NORMAL: "/content/img/earth/textures/earth_normal.webp",
      BUMP: "/content/img/earth/textures/earth_bump.webp",
      CLOUDS: "/content/img/earth/textures/earth_clouds_1024.png",
    },
  },
};

// ===== Global Variables =====
let scene, camera, renderer, earthMesh, starField, cloudMesh, atmosphereMesh;
let sectionObserver = null;
let animationFrameId = null;
let currentSection = "hero";
let isMobileDevice = false;
let performanceMonitor = null;
let shootingStarManager = null;
let THREE_INSTANCE = null;
let directionalLight = null; // Sonne - rotiert mit Wolken

// New: Advanced atmosphere and ocean
let scatteringAtmosphere = null; // Rayleigh/Mie scattering atmosphere
let oceanSpecularMesh = null; // Ocean reflection layer
let volumetricCloudLayers = []; // Array of volumetric cloud layers

// Camera and Animation States
const cameraTarget = { x: 0, y: 0, z: 10 };
const cameraPosition = { x: 0, y: 0, z: 10 };
const cameraRotation = { x: 0, y: 0 };

// Mouse Interaction State - Nur Zoom aktiv
const mouseState = {
  zoom: 10, // Nur Zoom via Mausrad
};

// ===== Three.js Earth System Manager =====
const ThreeEarthManager = (() => {
  const initThreeEarth = async () => {
    const sharedState = getSharedState();
    if (sharedState.systems.has("three-earth")) {
      log.debug("Three.js Earth system already initialized.");
      return cleanup;
    }

    const container = getElementById("threeEarthContainer");
    if (!container) {
      log.warn("Three.js Earth container not found.");
      return () => {};
    }

    try {
      log.info("Initializing Three.js Earth system v5.0.0");
      registerParticleSystem("three-earth", { type: "three-earth" });

      THREE_INSTANCE = await loadThreeJS();
      if (!THREE_INSTANCE)
        throw new Error("Three.js failed to load from all sources");

      showLoadingState(container, 0); // Show initial loading state

      await setupScene(container);
      await createEarthSystem();

      // Create ocean reflections (requires day texture from earthMesh)
      oceanSpecularMesh = createOceanReflections();
      if (oceanSpecularMesh && earthMesh.material.map) {
        oceanSpecularMesh.material.uniforms.uDayTexture.value = earthMesh.material.map;
        oceanSpecularMesh.position.copy(earthMesh.position);
        oceanSpecularMesh.scale.copy(earthMesh.scale);
        scene.add(oceanSpecularMesh);
      }

      // Cloud system: Use either volumetric or classic 2D
      if (CONFIG.VOLUMETRIC_CLOUDS.ENABLED) {
        volumetricCloudLayers = createVolumetricClouds();
        volumetricCloudLayers.forEach(layer => {
          layer.position.copy(earthMesh.position);
          layer.scale.copy(earthMesh.scale);
          scene.add(layer);
        });
      } else {
        cloudMesh = await createCloudLayer();
        // Wolken als eigenständiges Objekt in Scene für unabhängige Rotation
        cloudMesh.position.copy(earthMesh.position);
        cloudMesh.scale.copy(earthMesh.scale); // Scale auch initial kopieren!
        scene.add(cloudMesh);
      }

      // Basic atmosphere (always enabled for glow)
      atmosphereMesh = createAtmosphere();
      // Atmosphäre bleibt Child von earthMesh (rotiert mit Erde)
      earthMesh.add(atmosphereMesh);

      // Advanced atmospheric scattering (optional, performance-heavy)
      scatteringAtmosphere = createScatteringAtmosphere();
      if (scatteringAtmosphere) {
        scatteringAtmosphere.position.copy(earthMesh.position);
        scatteringAtmosphere.scale.copy(earthMesh.scale);
        scene.add(scatteringAtmosphere);
      }

      setupCameraSystem();
      setupUserControls(container);
      setupSectionDetection();

      performanceMonitor = new PerformanceMonitor(container);
      shootingStarManager = new ShootingStarManager(scene, THREE_INSTANCE);
      shootingStarManager.start();

      startAnimationLoop();
      setupResizeHandler();

      log.info("Three.js Earth system initialized successfully.");
      return cleanup;
    } catch (error) {
      log.error("Failed to initialize Three.js Earth system:", error);
      handleInitializationError(container, error);
      return () => {};
    }
  };

  const cleanup = () => {
    log.info("Cleaning up Three.js Earth system");

    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    if (performanceMonitor) performanceMonitor.cleanup();
    if (shootingStarManager) shootingStarManager.cleanup();
    if (sectionObserver) sectionObserver.disconnect();

    earthTimers.clearAll();
    sharedCleanupManager.cleanupSystem("three-earth");

    if (scene) {
      scene.traverse(disposeObject);
      while (scene.children.length > 0) scene.remove(scene.children[0]);
    }

    if (renderer) {
      renderer.dispose();
      renderer.forceContextLoss();
    }

    scene =
      camera =
      renderer =
      earthMesh =
      starField =
      cloudMesh =
      atmosphereMesh =
      scatteringAtmosphere =
      oceanSpecularMesh =
      directionalLight =
        null;
    
    volumetricCloudLayers = [];
    currentSection = "hero";

    unregisterParticleSystem("three-earth");
    log.info("Three.js Earth system cleanup completed.");
  };

  function disposeObject(obj) {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      if (Array.isArray(obj.material)) {
        obj.material.forEach(disposeMaterial);
      } else {
        disposeMaterial(obj.material);
      }
    }
  }

  function disposeMaterial(material) {
    Object.values(material).forEach((value) => {
      if (value && typeof value.dispose === "function") {
        value.dispose();
      }
    });
    material.dispose();
  }

  function handleInitializationError(container, error) {
    try {
      if (renderer) renderer.dispose();
      sharedCleanupManager.cleanupSystem("three-earth");
    } catch (emergencyError) {
      log.error("Emergency cleanup failed:", emergencyError);
    }
    showErrorState(container, error);
  }

  return { initThreeEarth, cleanup };
})();

// ===== Three.js ES Module Loading =====
async function loadThreeJS() {
  if (window.THREE) return window.THREE;
  for (const src of CONFIG.PATHS.THREE_JS) {
    try {
      const THREE = await import(src);
      const ThreeJS = THREE.default || THREE;
      if (ThreeJS?.WebGLRenderer) {
        window.THREE = ThreeJS;
        return ThreeJS;
      }
    } catch (error) {
      log.warn(`Failed to load ES Module from ${src}:`, error);
    }
  }
  return null;
}

// ===== Scene Setup =====
async function setupScene(container) {
  isMobileDevice = window.matchMedia("(max-width: 768px)").matches;
  scene = new THREE_INSTANCE.Scene();
  const aspectRatio = container.clientWidth / container.clientHeight;
  camera = new THREE_INSTANCE.PerspectiveCamera(
    CONFIG.CAMERA.FOV,
    aspectRatio,
    CONFIG.CAMERA.NEAR,
    CONFIG.CAMERA.FAR
  );

  renderer = new THREE_INSTANCE.WebGLRenderer({
    canvas: container.querySelector("canvas") || undefined,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });

  renderer.setPixelRatio(CONFIG.PERFORMANCE.PIXEL_RATIO);
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE_INSTANCE.SRGBColorSpace;
  renderer.toneMapping = THREE_INSTANCE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.8; // Leicht reduziert für dunklere Texturen

  container.appendChild(renderer.domElement);

  createStarField();
  setupStarParallax();
  setupLighting();
}

// ===== Starfield & Parallax =====
function createStarField() {
  const starCount = isMobileDevice
    ? CONFIG.STARS.COUNT / 2
    : CONFIG.STARS.COUNT;
  const positions = new Float32Array(starCount * 3);
  const colors = new Float32Array(starCount * 3);
  const sizes = new Float32Array(starCount);

  const color = new THREE_INSTANCE.Color();

  for (let i = 0; i < starCount; i++) {
    const i3 = i * 3;
    const radius = 100 + Math.random() * 200;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
    positions[i3 + 2] = radius * Math.cos(phi);

    color.setHSL(Math.random() * 0.1 + 0.5, 0.8, 0.8 + Math.random() * 0.2);
    colors[i3] = color.r;
    colors[i3 + 1] = color.g;
    colors[i3 + 2] = color.b;

    sizes[i] = Math.random() * 1.5 + 0.5;
  }

  const starGeometry = new THREE_INSTANCE.BufferGeometry();
  starGeometry.setAttribute(
    "position",
    new THREE_INSTANCE.BufferAttribute(positions, 3)
  );
  starGeometry.setAttribute(
    "color",
    new THREE_INSTANCE.BufferAttribute(colors, 3)
  );
  starGeometry.setAttribute(
    "size",
    new THREE_INSTANCE.BufferAttribute(sizes, 1)
  );

  const starMaterial = new THREE_INSTANCE.ShaderMaterial({
    uniforms: {
      time: { value: 0.0 },
      twinkleSpeed: { value: CONFIG.STARS.TWINKLE_SPEED },
    },
    vertexShader: `
      attribute float size;
      varying vec3 vColor;
      void main() {
        vColor = color;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * (300.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform float time;
      uniform float twinkleSpeed;
      varying vec3 vColor;
      void main() {
        float strength = (sin(time * twinkleSpeed + gl_FragCoord.x * 0.5) + 1.0) / 2.0 * 0.5 + 0.5;
        gl_FragColor = vec4(vColor, strength);
      }
    `,
    blending: THREE_INSTANCE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
    vertexColors: true,
  });

  starField = new THREE_INSTANCE.Points(starGeometry, starMaterial);
  starField.name = "starField";
  scene.add(starField);
}

function setupStarParallax() {
  const parallaxHandler = (progress) => {
    if (!starField) return;
    starField.rotation.y = progress * Math.PI * 0.2;
    starField.position.z = Math.sin(progress * Math.PI) * 15;
  };
  sharedParallaxManager.addHandler(parallaxHandler, "three-earth-stars");
  sharedCleanupManager.addCleanupFunction(
    "three-earth",
    () => sharedParallaxManager.removeHandler(parallaxHandler),
    "star parallax handler"
  );
}

// ===== Lighting Setup =====
function setupLighting() {
  // Sonne - rotiert mit Wolken für wandernde Tag/Nacht-Grenze
  directionalLight = new THREE_INSTANCE.DirectionalLight(
    0xffffff,
    CONFIG.SUN.INTENSITY
  );
  directionalLight.position.set(CONFIG.SUN.RADIUS, CONFIG.SUN.HEIGHT, 0);
  scene.add(directionalLight);

  // Sanftes Umgebungslicht (reduziert für sichtbare Stadtlichter)
  const ambientLight = new THREE_INSTANCE.AmbientLight(0x404040, 0.2);
  scene.add(ambientLight);
}

// ===== Earth System Creation =====
async function createEarthSystem() {
  const loadingManager = new THREE_INSTANCE.LoadingManager();
  loadingManager.onProgress = (url, itemsLoaded, itemsTotal) => {
    const progress = itemsLoaded / itemsTotal;
    showLoadingState(document.getElementById("threeEarthContainer"), progress);
  };
  loadingManager.onLoad = () => {
    // A short delay to allow the user to see the "100%" state
    setTimeout(() => {
      hideLoadingState(document.getElementById("threeEarthContainer"));
    }, 500);
  };

  const textureLoader = new THREE_INSTANCE.TextureLoader(loadingManager);

  const [dayTexture, nightTexture, normalTexture, bumpTexture] =
    await Promise.all([
      textureLoader.loadAsync(CONFIG.PATHS.TEXTURES.DAY),
      textureLoader.loadAsync(CONFIG.PATHS.TEXTURES.NIGHT),
      textureLoader.loadAsync(CONFIG.PATHS.TEXTURES.NORMAL),
      textureLoader.loadAsync(CONFIG.PATHS.TEXTURES.BUMP),
    ]);

  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  [dayTexture, nightTexture, normalTexture, bumpTexture].forEach((tex) => {
    if (tex) tex.anisotropy = Math.min(maxAniso, isMobileDevice ? 4 : 16);
  });

  const earthMaterial = new THREE_INSTANCE.MeshStandardMaterial({
    map: dayTexture,
    normalMap: normalTexture,
    normalScale: new THREE_INSTANCE.Vector2(1.0, 1.0),
    bumpMap: bumpTexture,
    bumpScale: CONFIG.EARTH.BUMP_SCALE,
    roughness: 0.7, // Reduziert für bessere Licht-Absorption
    metalness: 0.0,
    emissive: 0xffaa44, // Wärmere Farbe für Stadtlichter
    emissiveMap: nightTexture,
    emissiveIntensity: CONFIG.EARTH.EMISSIVE_INTENSITY,
  });

  const earthGeometry = new THREE_INSTANCE.SphereGeometry(
    CONFIG.EARTH.RADIUS,
    CONFIG.EARTH.SEGMENTS,
    CONFIG.EARTH.SEGMENTS
  );
  earthMesh = new THREE_INSTANCE.Mesh(earthGeometry, earthMaterial);

  // Initiale Position und Scale für Hero-Section setzen
  earthMesh.position.set(0, -6.0, 0);
  earthMesh.scale.set(1.5, 1.5, 1.5);

  // Target-Werte für Transitions speichern
  earthMesh.userData.targetPosition = { x: 0, y: -6.0, z: 0 };
  earthMesh.userData.targetScale = 1.5;

  scene.add(earthMesh);
}

async function createCloudLayer() {
  const textureLoader = new THREE_INSTANCE.TextureLoader();
  try {
    const cloudTexture = await textureLoader.loadAsync(
      CONFIG.PATHS.TEXTURES.CLOUDS
    );
    cloudTexture.wrapS = THREE_INSTANCE.RepeatWrapping;
    cloudTexture.wrapT = THREE_INSTANCE.RepeatWrapping;
    // Optimierte Textur-Einstellungen
    cloudTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();

    const cloudMaterial = new THREE_INSTANCE.MeshStandardMaterial({
      map: cloudTexture,
      transparent: true,
      opacity: CONFIG.CLOUDS.OPACITY,
      // AdditiveBlending entfernt - zu performance-intensiv
      blending: THREE_INSTANCE.NormalBlending,
      depthWrite: false,
      side: THREE_INSTANCE.DoubleSide,
    });

    const cloudGeometry = new THREE_INSTANCE.SphereGeometry(
      CONFIG.EARTH.RADIUS + CONFIG.CLOUDS.ALTITUDE,
      CONFIG.EARTH.SEGMENTS,
      CONFIG.EARTH.SEGMENTS
    );
    const clouds = new THREE_INSTANCE.Mesh(cloudGeometry, cloudMaterial);
    clouds.renderOrder = 1; // Render after Earth
    log.info("Cloud layer created successfully");
    return clouds;
  } catch (error) {
    log.warn("Could not load cloud texture, skipping cloud layer.", error);
    return new THREE_INSTANCE.Object3D(); // Return empty object if fails
  }
}

function createAtmosphere() {
  const vertexShader = `
    varying vec3 vNormal;
    void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`;
  const fragmentShader = `
    varying vec3 vNormal;
    uniform vec3 uGlowColor;
    uniform float uPower;
    uniform float uIntensity;
    void main() {
        float fresnel = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), uPower);
        gl_FragColor = vec4(uGlowColor, 1.0) * fresnel * uIntensity;
    }`;

  const atmosphereMaterial = new THREE_INSTANCE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uGlowColor: {
        value: new THREE_INSTANCE.Color(CONFIG.ATMOSPHERE.GLOW_COLOR),
      },
      uPower: { value: CONFIG.ATMOSPHERE.FRESNEL_POWER },
      uIntensity: { value: CONFIG.ATMOSPHERE.INTENSITY },
    },
    blending: THREE_INSTANCE.AdditiveBlending,
    transparent: true,
    side: THREE_INSTANCE.BackSide,
    depthWrite: false,
  });

  const atmosphere = new THREE_INSTANCE.Mesh(
    new THREE_INSTANCE.SphereGeometry(
      CONFIG.EARTH.RADIUS * CONFIG.ATMOSPHERE.SCALE,
      CONFIG.EARTH.SEGMENTS,
      CONFIG.EARTH.SEGMENTS
    ),
    atmosphereMaterial
  );
  atmosphere.renderOrder = 2; // Render after clouds
  return atmosphere;
}

// ===== Advanced Rayleigh/Mie Atmospheric Scattering =====
function createScatteringAtmosphere() {
  // Performance check: Disable on mobile for complex shader
  if (isMobileDevice && CONFIG.PERFORMANCE.PIXEL_RATIO < 1.0) {
    log.info("Skipping atmospheric scattering on low-performance device");
    return null;
  }

  const vertexShader = `
    varying vec3 vWorldPosition;
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    
    void main() {
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
      vNormal = normalize(normalMatrix * normal);
      
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      vViewPosition = -mvPosition.xyz;
      
      gl_Position = projectionMatrix * mvPosition;
    }
  `;

  const fragmentShader = `
    uniform vec3 uSunPosition;
    uniform vec3 uRayleighCoeff;
    uniform float uMieCoeff;
    uniform float uRayleighScaleHeight;
    uniform float uMieScaleHeight;
    uniform float uMieG;
    uniform float uEarthRadius;
    uniform float uAtmosphereRadius;
    uniform int uSamples;
    uniform int uLightSamples;
    uniform vec3 uCameraPosition;
    
    varying vec3 vWorldPosition;
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    
    const float PI = 3.14159265359;
    const float E = 2.71828;
    
    // Henyey-Greenstein phase function for Mie scattering
    float henyeyGreenstein(float cosTheta, float g) {
      float g2 = g * g;
      return (1.0 - g2) / (4.0 * PI * pow(1.0 + g2 - 2.0 * g * cosTheta, 1.5));
    }
    
    // Rayleigh phase function
    float rayleighPhase(float cosTheta) {
      return (3.0 / (16.0 * PI)) * (1.0 + cosTheta * cosTheta);
    }
    
    // Optical depth calculation (simplified for performance)
    vec3 opticalDepth(vec3 point, vec3 direction, float length) {
      float stepSize = length / float(uLightSamples);
      vec3 rayleighDepth = vec3(0.0);
      float mieDepth = 0.0;
      
      for (int i = 0; i < 8; i++) { // Max samples hardcoded for WebGL 1.0
        if (i >= uLightSamples) break;
        
        vec3 samplePoint = point + direction * stepSize * float(i);
        float height = length(samplePoint) - uEarthRadius;
        
        // Exponential density falloff
        float rayleighDensity = exp(-height / uRayleighScaleHeight);
        float mieDensity = exp(-height / uMieScaleHeight);
        
        rayleighDepth += uRayleighCoeff * rayleighDensity * stepSize;
        mieDepth += uMieCoeff * mieDensity * stepSize;
      }
      
      return rayleighDepth + vec3(mieDepth);
    }
    
    void main() {
      vec3 viewDir = normalize(vViewPosition);
      vec3 sunDir = normalize(uSunPosition);
      
      // Calculate ray through atmosphere
      vec3 rayOrigin = uCameraPosition;
      vec3 rayDir = normalize(vWorldPosition - rayOrigin);
      
      // Distance from camera to atmosphere edge
      float distToAtmosphere = length(vWorldPosition - rayOrigin);
      float stepSize = distToAtmosphere / float(uSamples);
      
      vec3 rayleighScattering = vec3(0.0);
      vec3 mieScattering = vec3(0.0);
      
      // Ray-march through atmosphere
      for (int i = 0; i < 16; i++) { // Max samples hardcoded for WebGL 1.0
        if (i >= uSamples) break;
        
        vec3 samplePoint = rayOrigin + rayDir * stepSize * (float(i) + 0.5);
        float height = length(samplePoint) - uEarthRadius;
        
        // Skip if below surface
        if (height < 0.0) continue;
        
        // Calculate densities at sample point
        float rayleighDensity = exp(-height / uRayleighScaleHeight);
        float mieDensity = exp(-height / uMieScaleHeight);
        
        // Optical depth to sun
        vec3 opticalDepthToSun = opticalDepth(samplePoint, sunDir, uAtmosphereRadius - length(samplePoint));
        
        // Optical depth to camera
        vec3 opticalDepthToCamera = opticalDepth(samplePoint, -rayDir, length(samplePoint - rayOrigin));
        
        // Total attenuation
        vec3 attenuation = exp(-(opticalDepthToSun + opticalDepthToCamera));
        
        // Accumulate scattering
        rayleighScattering += uRayleighCoeff * rayleighDensity * attenuation * stepSize;
        mieScattering += vec3(uMieCoeff) * mieDensity * attenuation * stepSize;
      }
      
      // Apply phase functions
      float cosTheta = dot(rayDir, sunDir);
      float rayleighFactor = rayleighPhase(cosTheta);
      float mieFactor = henyeyGreenstein(cosTheta, uMieG);
      
      vec3 scatteredLight = rayleighScattering * rayleighFactor + mieScattering * mieFactor;
      
      // Add base glow at edges (Fresnel)
      float fresnel = pow(1.0 - abs(dot(vNormal, viewDir)), 2.5);
      vec3 glowColor = vec3(0.4, 0.6, 1.0) * fresnel * 0.3;
      
      vec3 finalColor = scatteredLight + glowColor;
      float alpha = min(1.0, length(finalColor) * 2.0);
      
      gl_FragColor = vec4(finalColor, alpha);
    }
  `;

  const scatteringMaterial = new THREE_INSTANCE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uSunPosition: { value: new THREE_INSTANCE.Vector3(CONFIG.SUN.RADIUS, CONFIG.SUN.HEIGHT, 0) },
      uRayleighCoeff: { value: new THREE_INSTANCE.Vector3(...CONFIG.ATMOSPHERE.RAYLEIGH_COEFFICIENT) },
      uMieCoeff: { value: CONFIG.ATMOSPHERE.MIE_COEFFICIENT },
      uRayleighScaleHeight: { value: CONFIG.ATMOSPHERE.RAYLEIGH_SCALE_HEIGHT },
      uMieScaleHeight: { value: CONFIG.ATMOSPHERE.MIE_SCALE_HEIGHT },
      uMieG: { value: CONFIG.ATMOSPHERE.MIE_DIRECTIONAL_G },
      uEarthRadius: { value: CONFIG.EARTH.RADIUS },
      uAtmosphereRadius: { value: CONFIG.EARTH.RADIUS * CONFIG.ATMOSPHERE.ATMOSPHERE_RADIUS },
      uSamples: { value: CONFIG.ATMOSPHERE.SAMPLES },
      uLightSamples: { value: CONFIG.ATMOSPHERE.LIGHT_SAMPLES },
      uCameraPosition: { value: new THREE_INSTANCE.Vector3() },
    },
    transparent: true,
    blending: THREE_INSTANCE.AdditiveBlending,
    side: THREE_INSTANCE.BackSide,
    depthWrite: false,
  });

  const scatteringGeometry = new THREE_INSTANCE.SphereGeometry(
    CONFIG.EARTH.RADIUS * CONFIG.ATMOSPHERE.ATMOSPHERE_RADIUS,
    48, // Lower segments for performance
    48
  );

  const atmosphere = new THREE_INSTANCE.Mesh(scatteringGeometry, scatteringMaterial);
  atmosphere.renderOrder = 3; // Render after basic atmosphere
  
  log.info("Advanced atmospheric scattering created successfully");
  return atmosphere;
}

// ===== Ocean Specular Reflections Layer =====
function createOceanReflections() {
  if (isMobileDevice && CONFIG.PERFORMANCE.PIXEL_RATIO < 1.0) {
    log.info("Skipping ocean reflections on low-performance device");
    return null;
  }

  const vertexShader = `
    varying vec3 vNormal;
    varying vec3 vWorldPosition;
    varying vec2 vUv;
    
    void main() {
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPos.xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const fragmentShader = `
    uniform sampler2D uDayTexture;
    uniform vec3 uSunPosition;
    uniform vec3 uCameraPosition;
    uniform float uSpecularIntensity;
    uniform float uSpecularPower;
    uniform float uFresnelBias;
    uniform float uFresnelScale;
    uniform float uFresnelPower;
    uniform float uOceanThreshold;
    
    varying vec3 vNormal;
    varying vec3 vWorldPosition;
    varying vec2 vUv;
    
    void main() {
      // Sample day texture to detect ocean (blue areas)
      vec3 texColor = texture2D(uDayTexture, vUv).rgb;
      
      // Ocean mask: Blue channel dominates, green/red are low
      float oceanMask = step(uOceanThreshold, texColor.b) * 
                        step(texColor.b, texColor.r + 0.3) * 
                        step(texColor.b, texColor.g + 0.3);
      
      if (oceanMask < 0.5) discard; // Not ocean, skip pixel
      
      // Calculate view and light directions
      vec3 viewDir = normalize(uCameraPosition - vWorldPosition);
      vec3 sunDir = normalize(uSunPosition - vWorldPosition);
      vec3 normal = normalize(vNormal);
      
      // Phong specular reflection
      vec3 reflectDir = reflect(-sunDir, normal);
      float specular = pow(max(dot(viewDir, reflectDir), 0.0), uSpecularPower);
      
      // Fresnel effect (more reflection at grazing angles)
      float fresnel = uFresnelBias + uFresnelScale * pow(1.0 - max(dot(viewDir, normal), 0.0), uFresnelPower);
      
      // Combine specular with fresnel
      float finalSpecular = specular * fresnel * uSpecularIntensity;
      
      // Sun color with slight blue tint for water
      vec3 specularColor = mix(vec3(1.0, 0.95, 0.8), vec3(0.8, 0.9, 1.0), 0.3);
      
      gl_FragColor = vec4(specularColor * finalSpecular, finalSpecular * 0.6);
    }
  `;

  // We need to pass the day texture - will be set after earth creation
  const oceanMaterial = new THREE_INSTANCE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uDayTexture: { value: null }, // Will be set after texture loads
      uSunPosition: { value: new THREE_INSTANCE.Vector3(CONFIG.SUN.RADIUS, CONFIG.SUN.HEIGHT, 0) },
      uCameraPosition: { value: new THREE_INSTANCE.Vector3() },
      uSpecularIntensity: { value: CONFIG.OCEAN.SPECULAR_INTENSITY },
      uSpecularPower: { value: CONFIG.OCEAN.SPECULAR_POWER },
      uFresnelBias: { value: CONFIG.OCEAN.FRESNEL_BIAS },
      uFresnelScale: { value: CONFIG.OCEAN.FRESNEL_SCALE },
      uFresnelPower: { value: CONFIG.OCEAN.FRESNEL_POWER },
      uOceanThreshold: { value: CONFIG.OCEAN.OCEAN_MASK_THRESHOLD },
    },
    transparent: true,
    blending: THREE_INSTANCE.AdditiveBlending,
    depthWrite: false,
    side: THREE_INSTANCE.FrontSide,
  });

  const oceanGeometry = new THREE_INSTANCE.SphereGeometry(
    CONFIG.EARTH.RADIUS + 0.002, // Slightly above earth surface to avoid z-fighting
    CONFIG.EARTH.SEGMENTS,
    CONFIG.EARTH.SEGMENTS
  );

  const oceanLayer = new THREE_INSTANCE.Mesh(oceanGeometry, oceanMaterial);
  oceanLayer.renderOrder = 1; // Render after earth, before clouds
  
  log.info("Ocean specular reflections layer created successfully");
  return oceanLayer;
}

// ===== Volumetric 3D Cloud System =====
function createVolumetricClouds() {
  if (!CONFIG.VOLUMETRIC_CLOUDS.ENABLED || (isMobileDevice && CONFIG.PERFORMANCE.PIXEL_RATIO < 1.0)) {
    log.info("Volumetric clouds disabled (config or performance)");
    return [];
  }

  // Simplex 3D Noise function (embedded for performance)
  const simplexNoiseGLSL = `
    // Simplex 3D Noise by Ian McEwan, Ashima Arts
    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
    vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
    
    float snoise(vec3 v) {
      const vec2 C = vec2(1.0/6.0, 1.0/3.0);
      const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
      
      vec3 i  = floor(v + dot(v, C.yyy));
      vec3 x0 = v - i + dot(i, C.xxx);
      
      vec3 g = step(x0.yzx, x0.xyz);
      vec3 l = 1.0 - g;
      vec3 i1 = min(g.xyz, l.zxy);
      vec3 i2 = max(g.xyz, l.zxy);
      
      vec3 x1 = x0 - i1 + C.xxx;
      vec3 x2 = x0 - i2 + C.yyy;
      vec3 x3 = x0 - D.yyy;
      
      i = mod289(i);
      vec4 p = permute(permute(permute(
                i.z + vec4(0.0, i1.z, i2.z, 1.0))
              + i.y + vec4(0.0, i1.y, i2.y, 1.0))
              + i.x + vec4(0.0, i1.x, i2.x, 1.0));
      
      float n_ = 0.142857142857;
      vec3 ns = n_ * D.wyz - D.xzx;
      
      vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
      
      vec4 x_ = floor(j * ns.z);
      vec4 y_ = floor(j - 7.0 * x_);
      
      vec4 x = x_ *ns.x + ns.yyyy;
      vec4 y = y_ *ns.x + ns.yyyy;
      vec4 h = 1.0 - abs(x) - abs(y);
      
      vec4 b0 = vec4(x.xy, y.xy);
      vec4 b1 = vec4(x.zw, y.zw);
      
      vec4 s0 = floor(b0)*2.0 + 1.0;
      vec4 s1 = floor(b1)*2.0 + 1.0;
      vec4 sh = -step(h, vec4(0.0));
      
      vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
      vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
      
      vec3 p0 = vec3(a0.xy, h.x);
      vec3 p1 = vec3(a0.zw, h.y);
      vec3 p2 = vec3(a1.xy, h.z);
      vec3 p3 = vec3(a1.zw, h.w);
      
      vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
      p0 *= norm.x;
      p1 *= norm.y;
      p2 *= norm.z;
      p3 *= norm.w;
      
      vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
      m = m * m;
      return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
    }
  `;

  const vertexShader = `
    varying vec2 vUv;
    varying vec3 vPosition;
    
    void main() {
      vUv = uv;
      vPosition = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const fragmentShader = `
    ${simplexNoiseGLSL}
    
    uniform float uTime;
    uniform float uScale;
    uniform int uOctaves;
    uniform float uPersistence;
    uniform float uLacunarity;
    uniform float uDensity;
    uniform float uCoverage;
    uniform float uLayerOpacity;
    
    varying vec2 vUv;
    varying vec3 vPosition;
    
    // Fractal Brownian Motion (FBM) for detailed noise
    float fbm(vec3 p) {
      float value = 0.0;
      float amplitude = 1.0;
      float frequency = 1.0;
      
      for (int i = 0; i < 5; i++) { // Max octaves hardcoded
        if (i >= uOctaves) break;
        value += amplitude * snoise(p * frequency);
        frequency *= uLacunarity;
        amplitude *= uPersistence;
      }
      
      return value;
    }
    
    void main() {
      // Create 3D position from sphere surface UV
      float theta = vUv.x * 3.14159 * 2.0;
      float phi = vUv.y * 3.14159;
      vec3 noisePos = vec3(
        sin(phi) * cos(theta),
        cos(phi),
        sin(phi) * sin(theta)
      ) * uScale;
      
      // Animate noise over time (cloud drift)
      noisePos.x += uTime * 0.1;
      
      // Generate cloud density using FBM
      float noise = fbm(noisePos);
      
      // Remap noise to cloud coverage
      float cloudDensity = smoothstep(1.0 - uCoverage, 1.0, (noise + 1.0) * 0.5);
      cloudDensity *= uDensity;
      
      // Apply layer-specific opacity
      float alpha = cloudDensity * uLayerOpacity;
      
      // Cloud color (white with slight blue tint)
      vec3 cloudColor = vec3(1.0, 1.0, 1.05);
      
      gl_FragColor = vec4(cloudColor, alpha);
    }
  `;

  const cloudLayers = [];
  const numLayers = Math.min(CONFIG.VOLUMETRIC_CLOUDS.LAYERS, 5); // Cap at 5 for performance

  for (let i = 0; i < numLayers; i++) {
    const altitude = CONFIG.VOLUMETRIC_CLOUDS.BASE_ALTITUDE + (i * CONFIG.VOLUMETRIC_CLOUDS.LAYER_SPACING);
    const speedMult = CONFIG.VOLUMETRIC_CLOUDS.SPEED_MULTIPLIER[i] || 1.0;
    const opacity = CONFIG.VOLUMETRIC_CLOUDS.DENSITY * Math.pow(CONFIG.VOLUMETRIC_CLOUDS.OPACITY_FALLOFF, i);

    const cloudMaterial = new THREE_INSTANCE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0.0 },
        uScale: { value: CONFIG.VOLUMETRIC_CLOUDS.SCALE + i * 0.5 }, // Vary scale per layer
        uOctaves: { value: CONFIG.VOLUMETRIC_CLOUDS.OCTAVES },
        uPersistence: { value: CONFIG.VOLUMETRIC_CLOUDS.PERSISTENCE },
        uLacunarity: { value: CONFIG.VOLUMETRIC_CLOUDS.LACUNARITY },
        uDensity: { value: CONFIG.VOLUMETRIC_CLOUDS.DENSITY },
        uCoverage: { value: CONFIG.VOLUMETRIC_CLOUDS.COVERAGE },
        uLayerOpacity: { value: opacity },
      },
      transparent: true,
      blending: THREE_INSTANCE.NormalBlending,
      depthWrite: false,
      side: THREE_INSTANCE.DoubleSide,
    });

    const cloudGeometry = new THREE_INSTANCE.SphereGeometry(
      CONFIG.EARTH.RADIUS + altitude,
      48, // Lower segments for performance
      48
    );

    const cloudLayer = new THREE_INSTANCE.Mesh(cloudGeometry, cloudMaterial);
    cloudLayer.renderOrder = 1; // Render after earth
    cloudLayer.userData.rotationSpeed = CONFIG.CLOUDS.ROTATION_SPEED * speedMult;
    cloudLayer.userData.layerIndex = i;

    cloudLayers.push(cloudLayer);
  }

  log.info(`Created ${cloudLayers.length} volumetric cloud layers`);
  return cloudLayers;
}

// ===== Camera & Section Updates =====
function setupCameraSystem() {
  updateCameraForSection("hero");
}

function updateCameraForSection(sectionName) {
  const configs = {
    hero: { pos: { x: 0, y: -1.8, z: 10 }, rot: { x: 0.2, y: 0 } },
    features: { pos: { x: -3, y: 2.5, z: 12 }, rot: { x: -0.3, y: 0.4 } },
    about: { pos: { x: 0, y: 1, z: 25 }, rot: { x: -0.15, y: 0 } },
  };
  const config = configs[sectionName] || configs.hero;
  cameraTarget.x = config.pos.x;
  cameraTarget.y = config.pos.y;
  mouseState.zoom = config.pos.z; // Use zoom for Z control
  cameraRotation.x = config.rot.x;
  cameraRotation.y = config.rot.y;
}

function setupSectionDetection() {
  const sections = document.querySelectorAll("section[id]");
  if (sections.length === 0) return;
  sectionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const newSection = entry.target.id;
          if (newSection !== currentSection) {
            currentSection = newSection;
            updateCameraForSection(newSection);
            updateEarthForSection(newSection);
            document
              .querySelector(".three-earth-container")
              ?.setAttribute("data-section", newSection);
          }
        }
      });
    },
    { rootMargin: "-20% 0px -20% 0px", threshold: 0.3 }
  );
  sections.forEach((section) => sectionObserver.observe(section));
}

function updateEarthForSection(sectionName) {
  if (!earthMesh) return;
  const configs = {
    hero: { pos: { x: 0, y: -6.0, z: 0 }, scale: 1.5 },
    features: { pos: { x: 1, y: -1, z: -0.5 }, scale: 1.0 },
    about: { pos: { x: 0, y: 0, z: -2 }, scale: 0.35 },
  };
  const config = configs[sectionName] || configs.hero;

  // Nur setzen wenn config.pos existiert (immer der Fall, aber defensive)
  if (config.pos) {
    earthMesh.userData.targetPosition = new THREE_INSTANCE.Vector3(
      config.pos.x,
      config.pos.y,
      config.pos.z
    );
  }

  earthMesh.userData.targetScale = config.scale;

  log.debug(
    `Section: ${sectionName}, Target Scale: ${config.scale}, Current Scale: ${earthMesh.scale.x.toFixed(2)}`
  );
}

// ===== User Controls & Interaction =====
function setupUserControls(container) {
  // Nur Zoom via Mausrad - Drag-Rotation entfernt
  const onWheel = (e) => {
    mouseState.zoom -= e.deltaY * 0.01;
    mouseState.zoom = Math.max(
      CONFIG.CAMERA.ZOOM_MIN,
      Math.min(CONFIG.CAMERA.ZOOM_MAX, mouseState.zoom)
    );
  };

  // Nur Wheel-Event - Drag-Events entfernt
  container.addEventListener("wheel", onWheel, { passive: true });

  sharedCleanupManager.addCleanupFunction(
    "three-earth",
    () => {
      container.removeEventListener("wheel", onWheel);
    },
    "user controls cleanup"
  );
}

// ===== Animation Loop =====
function startAnimationLoop() {
  const clock = new THREE_INSTANCE.Clock();

  function animate() {
    animationFrameId = requestAnimationFrame(animate);
    const elapsedTime = clock.getElapsedTime();
    const lerpFactor = CONFIG.CAMERA.LERP_FACTOR;

    // Erde bleibt statisch - keine Rotation

    // Stadtlichter pulsieren (12.6s Periode, 0.2-0.4 Intensity Range)
    if (earthMesh) {
      earthMesh.material.emissiveIntensity =
        CONFIG.EARTH.EMISSIVE_INTENSITY +
        Math.sin(elapsedTime * CONFIG.EARTH.EMISSIVE_PULSE_SPEED) *
          CONFIG.EARTH.EMISSIVE_PULSE_AMPLITUDE;
    }

    // Wolken driften (80.5s pro Umdrehung)
    if (cloudMesh && cloudMesh.rotation) {
      cloudMesh.rotation.y += CONFIG.CLOUDS.ROTATION_SPEED;
    }

    // Volumetric cloud layers rotation (each at different speeds)
    if (volumetricCloudLayers.length > 0) {
      volumetricCloudLayers.forEach(layer => {
        if (layer.rotation) {
          layer.rotation.y += layer.userData.rotationSpeed;
        }
        // Update time uniform for animated noise
        if (layer.material && layer.material.uniforms && layer.material.uniforms.uTime) {
          layer.material.uniforms.uTime.value = elapsedTime;
        }
      });
    }

    // Sonne kreist mit Wolken → Tag/Nacht-Grenze wandert
    if (directionalLight && (cloudMesh || volumetricCloudLayers.length > 0)) {
      const angle = cloudMesh ? cloudMesh.rotation.y : (volumetricCloudLayers[0]?.rotation.y || 0);
      directionalLight.position.set(
        Math.cos(angle) * CONFIG.SUN.RADIUS,
        CONFIG.SUN.HEIGHT,
        Math.sin(angle) * CONFIG.SUN.RADIUS
      );
      
      // Update atmospheric scattering sun position
      if (scatteringAtmosphere && scatteringAtmosphere.material.uniforms) {
        scatteringAtmosphere.material.uniforms.uSunPosition.value.copy(directionalLight.position);
        scatteringAtmosphere.material.uniforms.uCameraPosition.value.copy(camera.position);
      }
      
      // Update ocean specular sun position
      if (oceanSpecularMesh && oceanSpecularMesh.material.uniforms) {
        oceanSpecularMesh.material.uniforms.uSunPosition.value.copy(directionalLight.position);
        oceanSpecularMesh.material.uniforms.uCameraPosition.value.copy(camera.position);
      }
    }

    if (starField) {
      starField.material.uniforms.time.value = elapsedTime;
    }

    updateCameraPosition(lerpFactor);
    updateObjectTransforms();

    if (shootingStarManager) shootingStarManager.update();
    if (performanceMonitor) performanceMonitor.update();

    renderer.render(scene, camera);
  }

  function updateCameraPosition(lerpFactor) {
    cameraTarget.z = mouseState.zoom;
    cameraPosition.x += (cameraTarget.x - cameraPosition.x) * lerpFactor;
    cameraPosition.y += (cameraTarget.y - cameraPosition.y) * lerpFactor;
    cameraPosition.z += (cameraTarget.z - cameraPosition.z) * lerpFactor;
    camera.position.set(cameraPosition.x, cameraPosition.y, cameraPosition.z);

    camera.rotation.x += (cameraRotation.x - camera.rotation.x) * lerpFactor;
    camera.rotation.y += (cameraRotation.y - camera.rotation.y) * lerpFactor;

    camera.lookAt(0, 0, 0);
  }

  function updateObjectTransforms() {
    if (!earthMesh) return;

    // Animiere Erd-Position und -Scale via Lerp
    if (earthMesh.userData.targetPosition) {
      earthMesh.position.lerp(earthMesh.userData.targetPosition, 0.03);
    }
    if (earthMesh.userData.targetScale) {
      const scaleDiff = earthMesh.userData.targetScale - earthMesh.scale.x;
      if (Math.abs(scaleDiff) > 0.001) {
        const newScale = earthMesh.scale.x + scaleDiff * 0.05;
        earthMesh.scale.set(newScale, newScale, newScale);
      }
    }

    // Synchronisiere Wolken mit Erde (da eigenständiges Scene-Objekt, nicht Child)
    // WICHTIG: Position + Scale müssen manuell kopiert werden nach allen Erd-Transformationen
    if (cloudMesh) {
      if (cloudMesh.position) {
        cloudMesh.position.copy(earthMesh.position);
      }
      if (cloudMesh.scale && earthMesh.scale) {
        cloudMesh.scale.copy(earthMesh.scale);
      }
    }

    // Synchronize volumetric cloud layers
    if (volumetricCloudLayers.length > 0) {
      volumetricCloudLayers.forEach(layer => {
        if (layer.position) {
          layer.position.copy(earthMesh.position);
        }
        if (layer.scale && earthMesh.scale) {
          layer.scale.copy(earthMesh.scale);
        }
      });
    }

    // Synchronize atmospheric scattering
    if (scatteringAtmosphere) {
      if (scatteringAtmosphere.position) {
        scatteringAtmosphere.position.copy(earthMesh.position);
      }
      if (scatteringAtmosphere.scale && earthMesh.scale) {
        scatteringAtmosphere.scale.copy(earthMesh.scale);
      }
    }

    // Synchronize ocean specular layer
    if (oceanSpecularMesh) {
      if (oceanSpecularMesh.position) {
        oceanSpecularMesh.position.copy(earthMesh.position);
      }
      if (oceanSpecularMesh.scale && earthMesh.scale) {
        oceanSpecularMesh.scale.copy(earthMesh.scale);
      }
    }
  }

  animate();
}

// ===== Resize Handler =====
function setupResizeHandler() {
  const handleResize = () => {
    const container = getElementById("threeEarthContainer");
    if (!container || !camera || !renderer) return;
    const width = container.clientWidth;
    const height = container.clientHeight;
    isMobileDevice = window.matchMedia("(max-width: 768px)").matches;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  };
  const resizeCleanup = onResize(handleResize, 100);
  sharedCleanupManager.addCleanupFunction(
    "three-earth",
    resizeCleanup,
    "resize handler cleanup"
  );
}

// ===== UI State Management =====
function showLoadingState(container, progress) {
  container.classList.add("loading");
  const loadingElement = container.querySelector(".three-earth-loading");
  if (loadingElement) loadingElement.classList.remove("hidden");
  const progressBar = container.querySelector(".loading-progress-bar");
  const progressText = container.querySelector(".loading-progress-text");
  if (progressBar) progressBar.style.width = `${progress * 100}%`;
  if (progressText) progressText.textContent = `${Math.round(progress * 100)}%`;
}

function hideLoadingState(container) {
  container.classList.remove("loading");
  const loadingElement = container.querySelector(".three-earth-loading");
  if (loadingElement) loadingElement.classList.add("hidden");
}

function showErrorState(container, error) {
  container.classList.add("error");
  container.classList.remove("loading");
  const errorElement = container.querySelector(".three-earth-error");
  if (errorElement) {
    errorElement.classList.remove("hidden");
    const errorText = errorElement.querySelector("p");
    if (errorText)
      errorText.textContent = `WebGL Error: ${error.message || "Unknown error"}. Please try refreshing.`;
  }
}

// ===== Performance Monitor & Dynamic Resolution =====
class PerformanceMonitor {
  constructor(parentContainer) {
    this.element = document.createElement("div");
    this.element.className = "three-earth-performance-overlay";
    parentContainer.appendChild(this.element);

    this.frame = 0;
    this.lastTime = performance.now();
    this.fps = 60;
    this.currentPixelRatio = CONFIG.PERFORMANCE.PIXEL_RATIO;
  }

  update() {
    this.frame++;
    const time = performance.now();
    if (time >= this.lastTime + 1000) {
      this.fps = (this.frame * 1000) / (time - this.lastTime);
      this.lastTime = time;
      this.frame = 0;
      this.updateDisplay();
      this.adjustResolution();
    }
  }

  updateDisplay() {
    const mem = renderer.info.memory;
    const render = renderer.info.render;
    this.element.innerHTML = `
        FPS: ${Math.round(this.fps)} | 
        MEM: ${mem.geometries}g/${mem.textures}t | 
        Calls: ${render.calls} | Tris: ${(render.triangles / 1000).toFixed(1)}k | 
        PR: ${this.currentPixelRatio.toFixed(2)}
    `;
  }

  adjustResolution() {
    // Kritischer FPS-Einbruch erkennen (< 10 FPS)
    if (this.fps < 10) {
      this.currentPixelRatio = 0.5; // Drastische Reduktion bei kritischem FPS
      renderer.setPixelRatio(this.currentPixelRatio);
      log.error(
        `Critical FPS (${this.fps.toFixed(1)}), emergency pixel ratio reduction to ${this.currentPixelRatio.toFixed(2)}`
      );
      return;
    }

    if (
      this.fps < CONFIG.PERFORMANCE.DRS_DOWN_THRESHOLD &&
      this.currentPixelRatio > 0.5
    ) {
      this.currentPixelRatio = Math.max(0.5, this.currentPixelRatio - 0.15);
      renderer.setPixelRatio(this.currentPixelRatio);
      log.warn(
        `Low FPS (${this.fps.toFixed(1)}), reducing pixel ratio to ${this.currentPixelRatio.toFixed(2)}`
      );
    } else if (
      this.fps > CONFIG.PERFORMANCE.DRS_UP_THRESHOLD &&
      this.currentPixelRatio < CONFIG.PERFORMANCE.PIXEL_RATIO
    ) {
      this.currentPixelRatio = Math.min(
        CONFIG.PERFORMANCE.PIXEL_RATIO,
        this.currentPixelRatio + 0.05
      );
      renderer.setPixelRatio(this.currentPixelRatio);
      log.info(
        `Good FPS (${this.fps.toFixed(1)}), increasing pixel ratio to ${this.currentPixelRatio.toFixed(2)}`
      );
    }
  }

  cleanup() {
    this.element?.parentNode?.removeChild(this.element);
  }
}

export const { initThreeEarth, cleanup } = ThreeEarthManager;
export default ThreeEarthManager;
