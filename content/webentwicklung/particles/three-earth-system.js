/**
 * Three.js Earth System - 3D WebGL Earth with Stars, Clouds & Multi-Layer Atmosphere
 *
 * High-Quality 3D Earth visualization featuring:
 * - Realistic PBR Earth textures with pulsing city lights
 * - Dynamic, separate cloud layer with drift rotation
 * - Day/Night cycle: Automatic or manual sunlight rotation with synchronized city lights
 * - Multi-Layer Atmosphere with Rayleigh & Mie Scattering (physically-based)
 * - Ocean Specular Reflections based on sun position
 * - Smooth camera flight animations to preset positions
 * - Meteor shower events with configurable frequency and trajectories
 * - Procedural starfield with parallax and twinkling effects
 * - Mouse wheel zoom control for detailed inspection
 * - Scroll-based camera animations and section-responsive scenes
 * - Integrated performance monitor (FPS, Memory) with dynamic resolution scaling
 * - Texture loading manager with a progress bar for better UX
 *
 * NEW in v5.0.0:
 * - Multi-Layer Atmospheric Scattering (Rayleigh + Mie)
 * - Ocean Specular Highlights
 * - Camera Flight System (flyToLocation, flyToPreset)
 * - Automatic Day/Night Cycle with sync'd city lights
 * - Enhanced Meteor Shower System
 * - Preset Camera Positions for Sections
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
    // Multi-Layer Scattering (Rayleigh + Mie)
    RAYLEIGH_SCALE: 1.05, // Innere Atmosphären-Schicht (Blau-Streuung)
    MIE_SCALE: 1.025, // Äußere Atmosphären-Schicht (Wolken-Streuung)
    RAYLEIGH_COLOR: 0x5588ff, // Blaue Rayleigh-Streuung
    MIE_COLOR: 0xffddaa, // Warme Mie-Streuung (Sonnenuntergangs-Farbe)
    RAYLEIGH_INTENSITY: 0.4,
    MIE_INTENSITY: 0.25,
    SCATTERING_STRENGTH: 0.8, // Gesamt-Streuungsstärke
  },
  OCEAN: {
    SHININESS: 128.0, // Spekulare Schärfe
    SPECULAR_INTENSITY: 0.6, // Reflexions-Stärke
    SPECULAR_COLOR: 0xffffff, // Weiße Highlights
  },
  SUN: {
    RADIUS: 8, // Distanz der Sonne von der Erde
    HEIGHT: 3, // Höhe der Sonne
    INTENSITY: 2.0,
    AUTO_ROTATE: false, // Tag/Nacht-Zyklus aktivieren
    ROTATION_SPEED: 0.0005, // Umdrehungen pro Frame (~33min für vollen Zyklus bei 60fps)
  },
  DAY_NIGHT_CYCLE: {
    ENABLED: false, // Toggle für automatischen Zyklus
    SPEED_MULTIPLIER: 10, // Beschleunigungsfaktor (1 = Echtzeit, 10 = 10x schneller)
    SYNC_CITY_LIGHTS: true, // Stadtlichter mit Nacht-Seite synchronisieren
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
    // Preset-Positionen für verschiedene Sections
    PRESETS: {
      hero: { x: 0, y: 0, z: 10, lookAt: { x: 0, y: -6, z: 0 } },
      portfolio: { x: 5, y: 2, z: 8, lookAt: { x: 0, y: -4, z: 0 } },
      about: { x: -4, y: 3, z: 9, lookAt: { x: 0, y: -5, z: 0 } },
      contact: { x: 0, y: -3, z: 12, lookAt: { x: 0, y: -6, z: 0 } },
    },
    TRANSITION_DURATION: 2.0, // Sekunden für Kamera-Flüge
  },
  METEOR_EVENTS: {
    BASE_FREQUENCY: 0.003, // Basis-Wahrscheinlichkeit pro Frame
    SHOWER_FREQUENCY: 0.02, // Während Meteoritenregen
    SHOWER_DURATION: 180, // Frames (~3 Sekunden bei 60fps)
    SHOWER_COOLDOWN: 1800, // Frames (~30 Sekunden)
    MAX_SIMULTANEOUS: 3, // Max. parallele Meteore
    TRAJECTORIES: [
      // Verschiedene Flugbahnen
      { start: { x: -100, y: 50, z: -50 }, end: { x: 100, y: -50, z: 50 } },
      { start: { x: 100, y: 60, z: -40 }, end: { x: -80, y: -40, z: 60 } },
      { start: { x: -80, y: 70, z: 60 }, end: { x: 90, y: -60, z: -70 } },
    ],
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
      log.info("Initializing Three.js Earth system v4.0.0");
      registerParticleSystem("three-earth", { type: "three-earth" });

      THREE_INSTANCE = await loadThreeJS();
      if (!THREE_INSTANCE)
        throw new Error("Three.js failed to load from all sources");

      showLoadingState(container, 0); // Show initial loading state

      await setupScene(container);
      await createEarthSystem();

      cloudMesh = await createCloudLayer();
      // Wolken als eigenständiges Objekt in Scene für unabhängige Rotation
      cloudMesh.position.copy(earthMesh.position);
      cloudMesh.scale.copy(earthMesh.scale); // Scale auch initial kopieren!
      scene.add(cloudMesh);

      atmosphereMesh = createAtmosphere();
      // Atmosphäre bleibt Child von earthMesh (rotiert mit Erde)
      earthMesh.add(atmosphereMesh);

      setupCameraSystem();
      setupUserControls(container);
      setupSectionDetection();

      performanceMonitor = new PerformanceMonitor(container);
      shootingStarManager = new ShootingStarManager(scene, THREE_INSTANCE, CONFIG.METEOR_EVENTS);
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
      directionalLight =
        null;
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

  // Ozean-Reflexionen via onBeforeCompile Shader-Injection
  earthMaterial.onBeforeCompile = (shader) => {
    // Uniforms für Ozean-Highlights hinzufügen
    shader.uniforms.uSunPosition = {
      value: new THREE_INSTANCE.Vector3(CONFIG.SUN.RADIUS, CONFIG.SUN.HEIGHT, 0),
    };
    shader.uniforms.uOceanShininess = { value: CONFIG.OCEAN.SHININESS };
    shader.uniforms.uOceanSpecularIntensity = {
      value: CONFIG.OCEAN.SPECULAR_INTENSITY,
    };
    shader.uniforms.uOceanSpecularColor = {
      value: new THREE_INSTANCE.Color(CONFIG.OCEAN.SPECULAR_COLOR),
    };

    // Vertex Shader: Füge varying am Anfang hinzu
    shader.vertexShader = `
      varying vec3 vViewPosition;
    ` + shader.vertexShader;

    // Vertex Shader: Setze vViewPosition
    shader.vertexShader = shader.vertexShader.replace(
      "#include <worldpos_vertex>",
      `
      #include <worldpos_vertex>
      vViewPosition = -mvPosition.xyz;
      `
    );

    // Fragment Shader: Füge Uniforms und varying am Anfang hinzu
    shader.fragmentShader = `
      uniform vec3 uSunPosition;
      uniform float uOceanShininess;
      uniform float uOceanSpecularIntensity;
      uniform vec3 uOceanSpecularColor;
      varying vec3 vViewPosition;
    ` + shader.fragmentShader;

    // Fragment Shader: Füge Ozean-Reflexionen hinzu
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <color_fragment>",
      `
      #include <color_fragment>
      
      // Ozean-Erkennung: Dunkle Pixel in Day-Textur sind Wasser
      float oceanMask = step(diffuseColor.r + diffuseColor.g + diffuseColor.b, 0.4);
      
      if (oceanMask > 0.5) {
        // Berechne Spekulare Reflexion (Phong-Modell)
        vec3 sunDirection = normalize(uSunPosition);
        vec3 viewDirection = normalize(vViewPosition);
        vec3 reflectDirection = reflect(-sunDirection, normal);
        
        float specular = pow(max(dot(viewDirection, reflectDirection), 0.0), uOceanShininess);
        specular *= uOceanSpecularIntensity;
        
        // Addiere Spekulare Highlights
        diffuseColor.rgb += uOceanSpecularColor * specular;
      }
      `
    );

    // Speichere Shader-Referenz für Uniform-Updates
    earthMesh.userData.oceanShader = shader;
  };

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
  // Erweiterte Multi-Layer Atmosphäre mit Rayleigh & Mie Scattering
  const vertexShader = `
    varying vec3 vNormal;
    varying vec3 vPosition;
    varying vec3 vWorldPosition;
    void main() {
        vNormal = normalize(normalMatrix * normal);
        vPosition = position;
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`;
  
  const fragmentShader = `
    varying vec3 vNormal;
    varying vec3 vPosition;
    varying vec3 vWorldPosition;
    uniform vec3 uRayleighColor;
    uniform vec3 uMieColor;
    uniform float uPower;
    uniform float uRayleighIntensity;
    uniform float uMieIntensity;
    uniform float uScatteringStrength;
    uniform vec3 uSunPosition;
    
    void main() {
        // Fresnel-Effekt für Atmosphären-Rand
        vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
        float fresnel = pow(1.0 - abs(dot(vNormal, viewDirection)), uPower);
        
        // Rayleigh Scattering (Blau - kurzwellige Streuung)
        // Stärker am Horizont, nimmt mit Höhe ab
        float rayleighFactor = fresnel * uRayleighIntensity;
        vec3 rayleighScatter = uRayleighColor * rayleighFactor;
        
        // Mie Scattering (Warm - langwellige Streuung, Sonnenuntergangs-Effekt)
        // Berechne Winkel zur Sonne
        vec3 toSun = normalize(uSunPosition - vWorldPosition);
        float sunAlignment = max(0.0, dot(viewDirection, toSun));
        
        // Mie-Phase-Funktion (Henyey-Greenstein approximation)
        float g = 0.76; // Anisotropie-Parameter
        float g2 = g * g;
        float mieFactor = (1.0 - g2) / pow(1.0 + g2 - 2.0 * g * sunAlignment, 1.5);
        mieFactor *= fresnel * uMieIntensity;
        
        vec3 mieScatter = uMieColor * mieFactor;
        
        // Kombiniere Rayleigh + Mie mit Gesamt-Streuungsstärke
        vec3 finalColor = (rayleighScatter + mieScatter) * uScatteringStrength;
        
        // Alpha basierend auf Fresnel für weichen Übergang
        float alpha = fresnel * (uRayleighIntensity + uMieIntensity * 0.5);
        
        gl_FragColor = vec4(finalColor, alpha);
    }`;

  const atmosphereMaterial = new THREE_INSTANCE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uRayleighColor: {
        value: new THREE_INSTANCE.Color(CONFIG.ATMOSPHERE.RAYLEIGH_COLOR),
      },
      uMieColor: {
        value: new THREE_INSTANCE.Color(CONFIG.ATMOSPHERE.MIE_COLOR),
      },
      uPower: { value: CONFIG.ATMOSPHERE.FRESNEL_POWER },
      uRayleighIntensity: { value: CONFIG.ATMOSPHERE.RAYLEIGH_INTENSITY },
      uMieIntensity: { value: CONFIG.ATMOSPHERE.MIE_INTENSITY },
      uScatteringStrength: { value: CONFIG.ATMOSPHERE.SCATTERING_STRENGTH },
      uSunPosition: {
        value: new THREE_INSTANCE.Vector3(
          CONFIG.SUN.RADIUS,
          CONFIG.SUN.HEIGHT,
          0
        ),
      },
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

  // Zweite Rayleigh-Schicht (innere blaue Atmosphäre) mit reduziertem Mie-Effekt
  const rayleighFragmentShader = `
    varying vec3 vNormal;
    varying vec3 vPosition;
    varying vec3 vWorldPosition;
    uniform vec3 uRayleighColor;
    uniform vec3 uMieColor;
    uniform float uPower;
    uniform float uRayleighIntensity;
    uniform float uMieIntensity;
    uniform float uScatteringStrength;
    uniform vec3 uSunPosition;
    
    void main() {
        // Fresnel-Effekt für Atmosphären-Rand
        vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
        float fresnel = pow(1.0 - abs(dot(vNormal, viewDirection)), uPower);
        
        // Rayleigh Scattering (Blau - kurzwellige Streuung)
        float rayleighFactor = fresnel * uRayleighIntensity;
        vec3 rayleighScatter = uRayleighColor * rayleighFactor;
        
        // Mie Scattering - reduziert für innere Schicht
        vec3 toSun = normalize(uSunPosition - vWorldPosition);
        float sunAlignment = max(0.0, dot(viewDirection, toSun));
        
        float g = 0.76;
        float g2 = g * g;
        float mieFactor = (1.0 - g2) / pow(1.0 + g2 - 2.0 * g * sunAlignment, 1.5);
        mieFactor *= fresnel * uMieIntensity * 0.3; // 30% Reduktion für innere Schicht
        
        vec3 mieScatter = uMieColor * mieFactor;
        
        // Kombiniere Rayleigh + Mie
        vec3 finalColor = (rayleighScatter + mieScatter) * uScatteringStrength;
        
        float alpha = fresnel * (uRayleighIntensity + uMieIntensity * 0.15);
        
        gl_FragColor = vec4(finalColor, alpha);
    }`;

  const rayleighMaterial = new THREE_INSTANCE.ShaderMaterial({
    vertexShader,
    fragmentShader: rayleighFragmentShader,
    uniforms: {
      uRayleighColor: {
        value: new THREE_INSTANCE.Color(CONFIG.ATMOSPHERE.RAYLEIGH_COLOR),
      },
      uMieColor: {
        value: new THREE_INSTANCE.Color(CONFIG.ATMOSPHERE.MIE_COLOR),
      },
      uPower: { value: CONFIG.ATMOSPHERE.FRESNEL_POWER * 0.8 },
      uRayleighIntensity: { value: CONFIG.ATMOSPHERE.RAYLEIGH_INTENSITY * 0.6 },
      uMieIntensity: { value: CONFIG.ATMOSPHERE.MIE_INTENSITY },
      uScatteringStrength: { value: CONFIG.ATMOSPHERE.SCATTERING_STRENGTH * 0.7 },
      uSunPosition: {
        value: new THREE_INSTANCE.Vector3(
          CONFIG.SUN.RADIUS,
          CONFIG.SUN.HEIGHT,
          0
        ),
      },
    },
    blending: THREE_INSTANCE.AdditiveBlending,
    transparent: true,
    side: THREE_INSTANCE.BackSide,
    depthWrite: false,
  });

  const rayleighLayer = new THREE_INSTANCE.Mesh(
    new THREE_INSTANCE.SphereGeometry(
      CONFIG.EARTH.RADIUS * CONFIG.ATMOSPHERE.RAYLEIGH_SCALE,
      CONFIG.EARTH.SEGMENTS,
      CONFIG.EARTH.SEGMENTS
    ),
    rayleighMaterial
  );
  rayleighLayer.renderOrder = 2.5; // Zwischen Erde und äußerer Atmosphäre

  // Beide Schichten in Container-Objekt
  const atmosphereGroup = new THREE_INSTANCE.Group();
  atmosphereGroup.add(atmosphere);
  atmosphereGroup.add(rayleighLayer);

  // Speichere Shader-Referenzen für Updates
  atmosphereGroup.userData.atmosphereMaterial = atmosphereMaterial;
  atmosphereGroup.userData.rayleighMaterial = rayleighMaterial;

  return atmosphereGroup;
}

// ===== Camera & Section Updates =====
function setupCameraSystem() {
  updateCameraForSection("hero");
}

// Erweiterte Kamera-Steuerung mit Presets und Smooth Transitions
let cameraTransition = null; // Aktueller Tween

function updateCameraForSection(sectionName) {
  // Neue Preset-basierte Kamera-Positionen
  const preset = CONFIG.CAMERA.PRESETS[sectionName];
  
  if (preset) {
    // Nutze Preset mit smooth Transition
    flyToPreset(sectionName);
  } else {
    // Fallback auf alte Konfiguration
    const configs = {
      hero: { pos: { x: 0, y: -1.8, z: 10 }, rot: { x: 0.2, y: 0 } },
      features: { pos: { x: -3, y: 2.5, z: 12 }, rot: { x: -0.3, y: 0.4 } },
      about: { pos: { x: 0, y: 1, z: 25 }, rot: { x: -0.15, y: 0 } },
    };
    const config = configs[sectionName] || configs.hero;
    cameraTarget.x = config.pos.x;
    cameraTarget.y = config.pos.y;
    mouseState.zoom = config.pos.z;
    cameraRotation.x = config.rot.x;
    cameraRotation.y = config.rot.y;
  }
}

// Fliege zu vordefiniertem Preset
function flyToPreset(presetName) {
  const preset = CONFIG.CAMERA.PRESETS[presetName];
  if (!preset) {
    log.warn(`Camera preset '${presetName}' not found`);
    return;
  }

  // Stoppe laufenden Transition
  if (cameraTransition) {
    earthTimers.clearTimeout(cameraTransition);
    cameraTransition = null;
  }

  // Smooth Transition zu neuer Position
  const startPos = { ...cameraTarget };
  const startZoom = mouseState.zoom;
  const duration = CONFIG.CAMERA.TRANSITION_DURATION * 1000; // ms
  const startTime = performance.now();

  function transitionStep() {
    const elapsed = performance.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    // Easing: easeInOutCubic
    const eased = progress < 0.5
      ? 4 * progress * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 3) / 2;

    // Interpoliere Position
    cameraTarget.x = startPos.x + (preset.x - startPos.x) * eased;
    cameraTarget.y = startPos.y + (preset.y - startPos.y) * eased;
    mouseState.zoom = startZoom + (preset.z - startZoom) * eased;

    // Aktualisiere LookAt wenn definiert
    if (preset.lookAt && camera) {
      camera.lookAt(
        preset.lookAt.x,
        preset.lookAt.y,
        preset.lookAt.z
      );
    }

    if (progress < 1) {
      cameraTransition = earthTimers.setTimeout(transitionStep, 16); // ~60fps
    } else {
      cameraTransition = null;
      log.debug(`Camera transition to '${presetName}' complete`);
    }
  }

  transitionStep();
}

// Fliege zu Lat/Lon Koordinaten (z.B. für Locations)
function flyToLocation(lat, lon, zoom = 8, duration = 2.0) {
  // Konvertiere Lat/Lon zu Kamera-Position
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);

  const x = -(zoom * Math.sin(phi) * Math.cos(theta));
  const y = zoom * Math.cos(phi);
  const z = zoom * Math.sin(phi) * Math.sin(theta);

  // Erstelle temporäres Preset
  const tempPreset = {
    x,
    y,
    z: zoom,
    lookAt: { x: 0, y: 0, z: 0 },
  };

  // Speichere in PRESETS und fliege hin
  CONFIG.CAMERA.PRESETS._temp = tempPreset;
  const oldDuration = CONFIG.CAMERA.TRANSITION_DURATION;
  CONFIG.CAMERA.TRANSITION_DURATION = duration;
  
  flyToPreset("_temp");
  
  // Cleanup nach Transition
  earthTimers.setTimeout(() => {
    delete CONFIG.CAMERA.PRESETS._temp;
    CONFIG.CAMERA.TRANSITION_DURATION = oldDuration;
  }, duration * 1000 + 100);

  log.info(`Flying to location: ${lat}°N, ${lon}°E`);
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

    // Wolken driften (80.5s pro Umdrehung)
    if (cloudMesh && cloudMesh.rotation) {
      cloudMesh.rotation.y += CONFIG.CLOUDS.ROTATION_SPEED;
    }

    // Tag/Nacht-Zyklus: Sonne rotiert automatisch oder mit Wolken
    if (directionalLight) {
      let sunAngle;
      
      if (CONFIG.DAY_NIGHT_CYCLE.ENABLED) {
        // Automatischer Zyklus mit beschleunigter Zeit
        const cycleSpeed = CONFIG.SUN.ROTATION_SPEED * CONFIG.DAY_NIGHT_CYCLE.SPEED_MULTIPLIER;
        sunAngle = elapsedTime * cycleSpeed;
      } else if (cloudMesh) {
        // Sonne kreist mit Wolken → Tag/Nacht-Grenze wandert
        sunAngle = cloudMesh.rotation.y;
      } else {
        sunAngle = 0;
      }

      const sunX = Math.cos(sunAngle) * CONFIG.SUN.RADIUS;
      const sunZ = Math.sin(sunAngle) * CONFIG.SUN.RADIUS;
      directionalLight.position.set(sunX, CONFIG.SUN.HEIGHT, sunZ);

      // Update Atmosphären-Shader mit neuer Sonnen-Position
      if (atmosphereMesh?.userData) {
        const sunPosition = new THREE_INSTANCE.Vector3(sunX, CONFIG.SUN.HEIGHT, sunZ);
        
        if (atmosphereMesh.userData.atmosphereMaterial) {
          atmosphereMesh.userData.atmosphereMaterial.uniforms.uSunPosition.value.copy(sunPosition);
        }
        if (atmosphereMesh.userData.rayleighMaterial) {
          atmosphereMesh.userData.rayleighMaterial.uniforms.uSunPosition.value.copy(sunPosition);
        }
      }

      // Update Ozean-Shader mit neuer Sonnen-Position
      if (earthMesh?.userData?.oceanShader) {
        earthMesh.userData.oceanShader.uniforms.uSunPosition.value.set(sunX, CONFIG.SUN.HEIGHT, sunZ);
      }

      // Stadtlichter-Intensität mit Tag/Nacht synchronisieren (optional)
      if (CONFIG.DAY_NIGHT_CYCLE.SYNC_CITY_LIGHTS && earthMesh) {
        // Berechne Nacht-Seite basierend auf Sonnenwinkel
        const nightIntensity = Math.max(0, -Math.cos(sunAngle));
        earthMesh.material.emissiveIntensity = 
          CONFIG.EARTH.EMISSIVE_INTENSITY * (0.5 + nightIntensity * 0.5) +
          Math.sin(elapsedTime * CONFIG.EARTH.EMISSIVE_PULSE_SPEED) * CONFIG.EARTH.EMISSIVE_PULSE_AMPLITUDE;
      } else if (earthMesh) {
        // Standard Pulsation ohne Zyklus-Sync
        earthMesh.material.emissiveIntensity =
          CONFIG.EARTH.EMISSIVE_INTENSITY +
          Math.sin(elapsedTime * CONFIG.EARTH.EMISSIVE_PULSE_SPEED) *
            CONFIG.EARTH.EMISSIVE_PULSE_AMPLITUDE;
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

// ===== Public API =====
export const { initThreeEarth, cleanup } = ThreeEarthManager;

/**
 * Public API für externe Kontrolle
 */
export const EarthSystemAPI = {
  /**
   * Fliege zu geografischen Koordinaten
   * @param {number} lat - Breitengrad (-90 bis 90)
   * @param {number} lon - Längengrad (-180 bis 180)
   * @param {number} zoom - Zoom-Level (4-30)
   * @param {number} duration - Dauer in Sekunden
   */
  flyToLocation: (lat, lon, zoom = 8, duration = 2.0) => {
    if (typeof flyToLocation === "function") {
      flyToLocation(lat, lon, zoom, duration);
    } else {
      log.warn("Earth system not initialized");
    }
  },

  /**
   * Fliege zu vordefiniertem Preset
   * @param {string} presetName - Name des Presets (hero, portfolio, about, contact)
   */
  flyToPreset: (presetName) => {
    if (typeof flyToPreset === "function") {
      flyToPreset(presetName);
    } else {
      log.warn("Earth system not initialized");
    }
  },

  /**
   * Aktiviere/Deaktiviere automatischen Tag/Nacht-Zyklus
   * @param {boolean} enabled - Aktivierungsstatus
   * @param {number} speedMultiplier - Geschwindigkeitsfaktor (1 = Echtzeit)
   */
  setDayNightCycle: (enabled, speedMultiplier = 10) => {
    CONFIG.DAY_NIGHT_CYCLE.ENABLED = enabled;
    CONFIG.DAY_NIGHT_CYCLE.SPEED_MULTIPLIER = speedMultiplier;
    log.info(
      `Day/Night cycle ${enabled ? "enabled" : "disabled"} (speed: ${speedMultiplier}x)`
    );
  },

  /**
   * Triggere Meteoritenregen-Event
   */
  triggerMeteorShower: () => {
    if (shootingStarManager) {
      shootingStarManager.triggerMeteorShower();
    } else {
      log.warn("ShootingStarManager not initialized");
    }
  },

  /**
   * Zugriff auf Konfiguration
   */
  getConfig: () => CONFIG,

  /**
   * Update Konfiguration
   * @param {object} updates - Objekt mit Konfigurations-Updates
   */
  updateConfig: (updates) => {
    Object.assign(CONFIG, updates);
    log.info("Configuration updated", updates);
  },
};

export default ThreeEarthManager;
