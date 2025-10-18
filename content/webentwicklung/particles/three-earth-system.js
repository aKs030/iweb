/**
 * Three.js Earth System - Cinematic 3D WebGL Earth Visualization
 *
 * Professional Earth visualization with cinematischer Look:
 * - Realistic PBR Earth textures with subtle city lights pulsation
 * - Dynamic cloud layer with slow, realistic drift rotation
 * - Day/Night Toggle System with smooth orbital camera transitions
 * - Multi-Layer Atmosphere (Rayleigh & Mie Scattering)
 * - Ocean Specular Reflections based on sun position
 * - Cinematic camera flight system with arc movement and adaptive easing
 * - Meteor shower events with configurable trajectories
 * - Procedural starfield with parallax and subtle twinkling
 * - Mouse wheel zoom control for detailed inspection
 * - Section-responsive camera presets with smooth transitions
 * - Integrated performance monitor with adaptive quality scaling
 * - Texture loading manager with progress bar
 *
 * NEW in v7.0 CINEMATIC (2025-10-06):
 * - Complete CONFIG overhaul for professional, cinematic look
 * - Unified timing values: Faster, smoother camera transitions (1.4s base)
 * - Distance-adaptive transitions: Short flights 1.5s, long flights ~2.5s
 * - Enhanced easing: easeInOutQuart for camera, easeOutQuart for orbit
 * - Optimized camera presets: Closer positions, more dynamic angles
 * - Arc-curve zoom: Prevents close-up during long camera flights
 * - Cinematic lighting system: Balanced day/night with color temperature
 * - Smoothed transform animations: Earth rotation with progressive easing
 * - Harmonized speeds: Cloud drift 0.0006, Stars twinkle 0.25
 * - Performance: Reduced ambient light, optimized layer intensities
 *
 * v6.0.0 Features:
 * - Day/Night Toggle System with orbital camera flights
 * - Arc Movement during day↔night transitions
 * - Adaptive Lighting: Complete day vs. atmospheric night
 * - Enhanced City Lights: 4.0x intensity, warm color
 *
 * Uses shared-particle-system for parallax synchronization and effects.
 *
 * @author Portfolio System
 * @version 7.0.0-cinematic
 * @created 2025-10-03
 * @last-modified 2025-10-06
 */
import {
  createLogger,
  getElementById,
  onResize,
  TimerManager,
} from "../shared-utilities.js";
import {
  getSharedState,
  loadThreeJS,
  registerParticleSystem,
  sharedCleanupManager,
  sharedParallaxManager,
  ShootingStarManager,
  unregisterParticleSystem,
} from "./shared-particle-system.js";

const log = createLogger("threeEarthSystem");
const earthTimers = new TimerManager();

// ===== CINEMATIC CONFIGURATION v7.0 =====
// Komplett neu optimiert für professionellen, cinematischen Look
// Einheitliche Timing-Werte, smoothe Transitions, konsistente Speeds
const CONFIG = {
  EARTH: {
    RADIUS: 3.5,
    SEGMENTS: 64,
    BUMP_SCALE: 0.006, // Subtile Oberflächenstruktur
    EMISSIVE_INTENSITY: 0.15, // Dezente City Lights
    EMISSIVE_PULSE_SPEED: 0.25, // Langsame, cinematische Pulsation
    EMISSIVE_PULSE_AMPLITUDE: 0.05, // Subtile Amplitude
  },
  CLOUDS: {
    ALTITUDE: 0.03,
    ROTATION_SPEED: 0.0006, // Sehr langsamer, realistischer Drift (~180s/Umdrehung)
    OPACITY: 0.25, // Transparente, realistische Wolken
  },
  ATMOSPHERE: {
    SCALE: 1.012, // Dünne, subtile Atmosphäre
    GLOW_COLOR: 0x4488ff,
    FRESNEL_POWER: 4.8, // Scharfer Rand-Glow
    INTENSITY: 0.1, // Sehr subtiler Basis-Glow
    // Multi-Layer Scattering - Realistische Werte
    RAYLEIGH_SCALE: 1.025,
    MIE_SCALE: 1.015,
    RAYLEIGH_COLOR: 0x3366dd,
    MIE_COLOR: 0xffcc88,
    RAYLEIGH_INTENSITY: 0.06,
    MIE_INTENSITY: 0.03,
    SCATTERING_STRENGTH: 0.15,
  },
  OCEAN: {
    SHININESS: 90.0, // Weiche, realistische Highlights
    SPECULAR_INTENSITY: 0.4,
    SPECULAR_COLOR: 0xeeffff,
  },
  SUN: {
    RADIUS: 12, // Weiche Beleuchtung aus großer Distanz
    HEIGHT: 2.5,
    INTENSITY: 1.6, // Ausbalancierte Intensität
    // ROTATION_SPEED: Wird nur bei CONFIG.DAY_NIGHT_CYCLE.ENABLED verwendet
    // Bei deaktiviertem Zyklus: Sonne folgt Kamera-Orbit (updateCameraPosition)
    ROTATION_SPEED: 0.0004,
  },
  LIGHTING: {
    // Cinematische Tag/Nacht-Beleuchtung
    DAY: {
      AMBIENT_INTENSITY: 1.2, // Reduziert für mehr Kontrast (1.5 → 1.2)
      AMBIENT_COLOR: 0x505050, // Etwas wärmer als 0x404040
      SUN_INTENSITY: 1.6, // Aus CONFIG.SUN.INTENSITY
    },
    NIGHT: {
      AMBIENT_INTENSITY: 0.25, // Reduziert für dramatischeren Look (0.3 → 0.25)
      AMBIENT_COLOR: 0x202040, // Kühlerer Ton für Nacht
      SUN_INTENSITY: 0.3, // Reduziert für subtileres Mondlicht (0.4 → 0.3)
    },
  },
  DAY_NIGHT_CYCLE: {
    ENABLED: false,
    SPEED_MULTIPLIER: 10,
    SYNC_CITY_LIGHTS: true,
    SECTION_MODES: {
      hero: { mode: "day", sunAngle: 0 },
      features: { mode: "day", sunAngle: 0 },
      about: { mode: "toggle", sunAngle: Math.PI },
    },
  },
  STARS: {
    COUNT: 2500, // Ausbalanciertes Sternenfeld
    TWINKLE_SPEED: 0.25, // Langsames, subtiles Funkeln
  },
  MOON: {
    RADIUS: 0.95, // Relativ zur Erde (ca. 27% der Erde)
    DISTANCE: 25, // Abstand von Erde in Szenen-Einheiten
    ORBIT_SPEED: 0.0002, // Langsame Rotation um eigene Achse
    SEGMENTS: 48, // Etwas weniger Polygone als Erde
    BUMP_SCALE: 0.012, // Stärkere Krater
  },
  CAMERA: {
    FOV: 40, // Leicht erhöht für cinematischeren Look
    NEAR: 0.1,
    FAR: 1000,
    ZOOM_MIN: 5,
    ZOOM_MAX: 25,
    LERP_FACTOR: 0.04, // Noch sanftere Bewegung für cinematische Fahrten
    // Cinematische Preset-Positionen - Dynamische Kamerafahrten mit Variation
    PRESETS: {
      hero: {
        x: -3,
        y: 2,
        z: 16,
        lookAt: { x: 0, y: -1, z: 0 }, // Blick auf Erde von links-oben
        earthRotation: 0,
        target: "earth",
      },
      features: {
        x: 4,
        y: 4,
        z: 12, // Näher ran, von rechts-oben
        lookAt: { x: 0, y: 1, z: -6 }, // Blick auf Mond
        earthRotation: 0,
        target: "moon",
      },
      about: {
        x: -2,
        y: 1,
        z: 18, // Weiter weg, von links
        lookAt: { x: 0, y: 0, z: 0 }, // Blick auf Erde
        earthRotation: Math.PI,
        target: "earth",
      },
    },
    // Cinematische Transitions mit deutlichem Arc
    TRANSITION_DURATION: 2.5, // Längere Dauer für ausgedehnte Fahrten
    TRANSITION_DURATION_MULTIPLIER: 0.012, // Mehr Distanz-Einfluss für variierende Geschwindigkeit
    ARC_HEIGHT_BASE: 0.8, // Deutlicher Arc für Flug-Gefühl
    ARC_HEIGHT_MULTIPLIER: 1.2, // Starker Arc bei weiten Fahrten
  },
  METEOR_EVENTS: {
    BASE_FREQUENCY: 0.002,
    SHOWER_FREQUENCY: 0.015,
    SHOWER_DURATION: 150,
    SHOWER_COOLDOWN: 1500,
    MAX_SIMULTANEOUS: 2,
    TRAJECTORIES: [
      { start: { x: -80, y: 50, z: -40 }, end: { x: 80, y: -40, z: 50 } },
      { start: { x: 80, y: 60, z: -30 }, end: { x: -70, y: -35, z: 55 } },
      { start: { x: -70, y: 65, z: 50 }, end: { x: 75, y: -50, z: -60 } },
    ],
  },
  PERFORMANCE: {
    PIXEL_RATIO: Math.min(window.devicePixelRatio, 1.5),
    TARGET_FPS: 50,
    DRS_DOWN_THRESHOLD: 45,
    DRS_UP_THRESHOLD: 55,
  },
  QUALITY_LEVELS: {
    HIGH: {
      minFPS: 45,
      features: {
        multiLayerAtmosphere: true,
        oceanReflections: true,
        cloudLayer: true,
        cityLightsPulse: true,
        meteorShowers: true,
      },
    },
    MEDIUM: {
      minFPS: 25,
      features: {
        multiLayerAtmosphere: false,
        oceanReflections: true,
        cloudLayer: true,
        cityLightsPulse: false,
        meteorShowers: true,
      },
    },
    LOW: {
      minFPS: 0,
      features: {
        multiLayerAtmosphere: false,
        oceanReflections: false,
        cloudLayer: false,
        cityLightsPulse: false,
        meteorShowers: false,
      },
    },
  },
  PATHS: {
    TEXTURES: {
      DAY: "/content/img/earth/textures/earth_day.webp",
      NIGHT: "/content/img/earth/textures/earth_night.webp",
      NORMAL: "/content/img/earth/textures/earth_normal.webp",
      BUMP: "/content/img/earth/textures/earth_bump.webp",
      CLOUDS: "/content/img/earth/textures/earth_clouds_1024.png",
      MOON: "/content/img/earth/textures/moon_texture.webp",
      MOON_BUMP: "/content/img/earth/textures/moon_bump.webp",
    },
  },
};

// ===== Global State Variables =====
// Scene & Core Objects
let scene,
  camera,
  renderer,
  earthMesh,
  moonMesh,
  starField,
  cloudMesh,
  atmosphereMesh,
  rayleighAtmosphereMesh;

let directionalLight = null;
let ambientLight = null;
let THREE_INSTANCE = null;

// Starfield Animation State
let starOriginalPositions = null; // Original positions
let starTargetPositions = null; // Card target positions
let starAnimating = false;

// Materials & Modes
let dayMaterial = null;
let nightMaterial = null;
let lastAboutMode = null;

// System State
let sectionObserver = null;
let animationFrameId = null;
let currentSection = "hero";
let currentQualityLevel = "HIGH";
let isMobileDevice = false;
let frameCount = 0;

// Managers & Effects
let performanceMonitor = null;
let shootingStarManager = null;
let sunPositionVector = null;

// Camera State
const cameraTarget = { x: 0, y: 0, z: 10 };
const cameraPosition = { x: 0, y: 0, z: 10 };
let cameraOrbitAngle = 0;
let targetOrbitAngle = 0;

// User Interaction
const mouseState = { zoom: 10 };

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
      log.info("Initializing Three.js Earth system v6.0.0");
      registerParticleSystem("three-earth", { type: "three-earth" });

      THREE_INSTANCE = await loadThreeJS();
      if (!THREE_INSTANCE) {
        throw new Error("Three.js failed to load from all sources");
      }

      showLoadingState(container, 0); // Show initial loading state

      await setupScene(container);
      await createEarthSystem();

      // Mond-System mit LOD erstellen
      moonMesh = await createMoonSystem();

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
      shootingStarManager = new ShootingStarManager(
        scene,
        THREE_INSTANCE,
        CONFIG.METEOR_EVENTS
      );
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

    // Dispose globale Materials
    if (dayMaterial) {
      disposeMaterial(dayMaterial);
      dayMaterial = null;
    }
    if (nightMaterial) {
      disposeMaterial(nightMaterial);
      nightMaterial = null;
    }

    scene =
      camera =
      renderer =
      earthMesh =
      moonMesh =
      starField =
      cloudMesh =
      atmosphereMesh =
      directionalLight =
      ambientLight =
      rayleighAtmosphereMesh =
        null;
    currentSection = "hero";
    lastAboutMode = null;
    cameraOrbitAngle = 0;
    targetOrbitAngle = 0;
    frameCount = 0;
    sunPositionVector = null;

    // Cleanup Star Animation State
    starOriginalPositions = null;
    starTargetPositions = null;
    starAnimating = false;

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
    // Dispose Textures und andere Properties
    Object.values(material).forEach((value) => {
      if (value && typeof value.dispose === "function") {
        value.dispose();
      }
    });

    // Für ShaderMaterial: Dispose auch Uniforms (falls Texturen)
    if (material.uniforms) {
      Object.values(material.uniforms).forEach((uniform) => {
        if (uniform.value && typeof uniform.value.dispose === "function") {
          uniform.value.dispose();
        }
      });
    }

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

  // Speichere Original-Positionen für spätere Transformation
  starOriginalPositions = new Float32Array(positions);

  log.info(`Starfield created with ${starCount} stars`);
}

function setupStarParallax() {
  const parallaxHandler = (progress) => {
    if (!starField || starAnimating) return; // Skip parallax während Animation
    starField.rotation.y = progress * Math.PI * 0.2;
    starField.position.z = Math.sin(progress * Math.PI) * 15;
  };
  sharedParallaxManager.addHandler(parallaxHandler, "three-earth-stars");
}

// ===== Star-to-Cards Transformation =====
function getCardPositions() {
  if (!camera) {
    log.warn("Camera not initialized");
    return [];
  }

  const featuresSection = getElementById("features");
  if (!featuresSection) {
    log.warn("Features section not found");
    return [];
  }

  const cards = featuresSection.querySelectorAll(".card");
  const positions = [];

  if (cards.length === 0) {
    log.warn("No cards found in features section, using fallback grid");
    // Fallback: Grid-Layout in 3D-Space (vor der Kamera)
    const gridCols = 3;
    const spacingX = 8;
    const spacingY = 6;
    const baseZ = -2; // Vor der Kamera

    for (let i = 0; i < 9; i++) {
      const row = Math.floor(i / gridCols);
      const col = i % gridCols;
      positions.push({
        x: (col - 1) * spacingX,
        y: (1 - row) * spacingY + 2, // Leicht nach oben versetzt
        z: baseZ,
      });
    }
  } else {
    // Konvertiere 2D-Karten-Positionen zu 3D-Welt-Koordinaten
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    cards.forEach((card) => {
      const rect = card.getBoundingClientRect();

      // Normalisierte Device Coordinates (NDC): -1 bis +1
      const ndcX = ((rect.left + rect.width / 2) / viewportWidth) * 2 - 1;
      const ndcY = -(((rect.top + rect.height / 2) / viewportHeight) * 2 - 1); // Y invertiert

      // Erstelle 3D-Vektor in NDC-Space
      const targetZ = -2; // Tiefe vor der Kamera (näher als Mond bei z: -5)
      const vector = new THREE_INSTANCE.Vector3(ndcX, ndcY, 0);

      // Unproject: NDC → Welt-Koordinaten
      vector.unproject(camera);

      // Richtungsvektor von Kamera zum unprojektierten Punkt
      const direction = vector.sub(camera.position).normalize();

      // Berechne Distanz, um auf die gewünschte Z-Ebene zu kommen
      // Wir wollen die Sterne auf der Ebene z = targetZ haben
      const distance = (targetZ - camera.position.z) / direction.z;

      // Finale Position: Kamera-Position + Richtung * Distanz
      const worldPos = camera.position
        .clone()
        .add(direction.multiplyScalar(distance));

      positions.push({
        x: worldPos.x,
        y: worldPos.y,
        z: targetZ,
      });
    });

    log.info(`Found ${cards.length} cards, converted to 3D world positions:`, {
      camera: {
        x: camera.position.x.toFixed(2),
        y: camera.position.y.toFixed(2),
        z: camera.position.z.toFixed(2),
      },
      firstThreePositions: positions.slice(0, 3).map((p) => ({
        x: p.x.toFixed(2),
        y: p.y.toFixed(2),
        z: p.z.toFixed(2),
      })),
    });
  }

  return positions;
}

function animateStarsToCards() {
  if (!starField || !starOriginalPositions) {
    log.warn("Cannot animate: starField or originalPositions missing");
    return;
  }

  // Verhindere mehrfache gleichzeitige Animationen
  if (starAnimating) {
    log.debug("Star animation already in progress, skipping");
    return;
  }

  // Karten sind bereits via CSS versteckt (opacity: 0)
  const cards = document.querySelectorAll("#features .card");
  cards.forEach((card) => {
    card.style.transition = "none"; // Disable CSS transitions for smooth JS animation
  });

  // Starte Animation SOFORT mit initial berechneten Positionen
  starAnimating = true;
  log.info(
    "Starting star-to-cards transformation immediately (positions will update)"
  );

  // Initial: Berechne Positionen mit aktueller Kamera (kann noch ungenau sein)
  const cardPositions = getCardPositions();
  if (cardPositions.length === 0) {
    log.warn("No card positions found, skipping animation");
    starAnimating = false;
    return;
  }

  // Berechne initiale Ziel-Positionen
  const positions = starField.geometry.attributes.position.array;
  const starCount = positions.length / 3;
  starTargetPositions = new Float32Array(starCount * 3);

  const calculateTargets = (positions) => {
    for (let i = 0; i < starCount; i++) {
      const i3 = i * 3;
      const targetCard = positions[i % positions.length];

      const spreadXY = 0.8;
      const spreadZ = 0.5;

      starTargetPositions[i3] = targetCard.x + (Math.random() - 0.5) * spreadXY;
      starTargetPositions[i3 + 1] =
        targetCard.y + (Math.random() - 0.5) * spreadXY;
      starTargetPositions[i3 + 2] =
        targetCard.z + (Math.random() - 0.5) * spreadZ;
    }
  };

  calculateTargets(cardPositions);

  // Nach 2s: Aktualisiere Ziel-Positionen mit stabiler Kamera (77% von 2.6s)
  setTimeout(() => {
    if (starAnimating) {
      const updatedPositions = getCardPositions();
      if (updatedPositions.length > 0) {
        log.info("Updating star targets with stabilized camera position");
        calculateTargets(updatedPositions);
      }
    }
  }, 2000);

  animateStarTransformation();
}

function animateStarTransformation() {
  if (!starAnimating || !starField || !starTargetPositions) {
    log.warn("Cannot start transformation: missing required data");
    starAnimating = false;
    return;
  }

  const duration = 4000; // 4 Sekunden (langsamer für dramatischen Effekt)
  const fadeStartProgress = 0.75; // Karten starten Fade-in erst bei 75% (Sterne fast da!)
  const fadeEndProgress = 1.0; // Karten vollständig sichtbar bei 100%
  const startTime = performance.now();

  const cards = document.querySelectorAll("#features .card");

  function animate() {
    // Safety checks
    if (!starAnimating || !starField || !starTargetPositions) {
      starAnimating = false;
      return;
    }

    const elapsed = performance.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Easing function für Sterne
    const eased = easeInOutCubic(progress);

    // Interpoliere Sterne-Positionen
    const positions = starField.geometry.attributes.position.array;
    const starCount = positions.length / 3;

    for (let i = 0; i < starCount; i++) {
      const i3 = i * 3;
      positions[i3] =
        starOriginalPositions[i3] +
        (starTargetPositions[i3] - starOriginalPositions[i3]) * eased;
      positions[i3 + 1] =
        starOriginalPositions[i3 + 1] +
        (starTargetPositions[i3 + 1] - starOriginalPositions[i3 + 1]) * eased;
      positions[i3 + 2] =
        starOriginalPositions[i3 + 2] +
        (starTargetPositions[i3 + 2] - starOriginalPositions[i3 + 2]) * eased;
    }

    starField.geometry.attributes.position.needsUpdate = true;

    // Fade-in der Karten während Sterne sich nähern
    if (progress >= fadeStartProgress && progress <= fadeEndProgress) {
      const fadeProgress =
        (progress - fadeStartProgress) / (fadeEndProgress - fadeStartProgress);
      const cardOpacity = easeInOutCubic(fadeProgress);

      cards.forEach((card) => {
        card.style.opacity = cardOpacity.toString();
      });
    } else if (progress > fadeEndProgress) {
      // Stelle sicher, dass Karten vollständig sichtbar sind
      cards.forEach((card) => {
        card.style.opacity = "1";
      });
    }

    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      log.info("Star transformation complete - cards fully visible");
      starAnimating = false;
    }
  }

  animate();
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function resetStarsToOriginal() {
  if (!starField || !starOriginalPositions) {
    log.debug("Cannot reset stars: starField or originalPositions missing");
    return;
  }

  // Stoppe laufende Animation
  starAnimating = false;

  // Verstecke Karten wieder für nächste Animation
  const cards = document.querySelectorAll("#features .card");
  cards.forEach((card) => {
    card.style.opacity = "0";
    card.style.transition = "opacity 0.5s ease"; // Smooth fade-out beim Verlassen
  });

  // Sofortiges Reset auf Original-Positionen
  const positions = starField.geometry.attributes.position.array;
  for (let i = 0; i < positions.length; i++) {
    positions[i] = starOriginalPositions[i];
  }
  starField.geometry.attributes.position.needsUpdate = true;

  // Cleanup
  starTargetPositions = null;

  log.info("Stars reset to original positions");
}

// ===== Cinematic Lighting Setup =====
function setupLighting() {
  // Sonne - rotiert mit Kamera-Orbit für konsistente Beleuchtung
  directionalLight = new THREE_INSTANCE.DirectionalLight(
    0xffffff,
    CONFIG.SUN.INTENSITY
  );
  directionalLight.position.set(CONFIG.SUN.RADIUS, CONFIG.SUN.HEIGHT, 0);
  scene.add(directionalLight);

  // Umgebungslicht: Initial für Tag-Modus (cinematische Werte)
  ambientLight = new THREE_INSTANCE.AmbientLight(
    CONFIG.LIGHTING.DAY.AMBIENT_COLOR,
    CONFIG.LIGHTING.DAY.AMBIENT_INTENSITY
  );
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

  // Textur-Loading mit Error-Handling
  const loadTexture = (path, name) => {
    return textureLoader.loadAsync(path).catch((error) => {
      log.error(`Failed to load texture '${name}' from ${path}:`, error);
      return null;
    });
  };

  const [dayTexture, nightTexture, normalTexture, bumpTexture] =
    await Promise.all([
      loadTexture(CONFIG.PATHS.TEXTURES.DAY, "day"),
      loadTexture(CONFIG.PATHS.TEXTURES.NIGHT, "night"),
      loadTexture(CONFIG.PATHS.TEXTURES.NORMAL, "normal"),
      loadTexture(CONFIG.PATHS.TEXTURES.BUMP, "bump"),
    ]);

  // Prüfe ob kritische Texturen geladen wurden
  if (!dayTexture) {
    throw new Error("Failed to load critical day texture");
  }

  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  [dayTexture, nightTexture, normalTexture, bumpTexture].forEach((tex) => {
    if (tex) tex.anisotropy = Math.min(maxAniso, isMobileDevice ? 4 : 16);
  });

  // ===== ZWEI SEPARATE MATERIALS: Day-Only und Night-Only =====

  // DAY MATERIAL: Nur Day-Textur, keine Emissive (City Lights)
  dayMaterial = new THREE_INSTANCE.MeshStandardMaterial({
    map: dayTexture,
    normalMap: normalTexture,
    normalScale: new THREE_INSTANCE.Vector2(1.0, 1.0),
    bumpMap: bumpTexture,
    bumpScale: CONFIG.EARTH.BUMP_SCALE,
    roughness: 0.7,
    metalness: 0.0,
    emissive: 0x000000, // Kein Emissive bei Tag
    emissiveIntensity: 0,
  });

  // NIGHT MATERIAL: Night-Textur als Map + als Emissive für City Lights
  nightMaterial = new THREE_INSTANCE.MeshStandardMaterial({
    map: dayTexture, // Basis-Textur bleibt Day (für Geo-Details)
    normalMap: normalTexture,
    normalScale: new THREE_INSTANCE.Vector2(1.0, 1.0),
    bumpMap: bumpTexture,
    bumpScale: CONFIG.EARTH.BUMP_SCALE,
    roughness: 0.7,
    metalness: 0.0,
    emissive: 0xffcc66, // Hellere, wärmere City Lights (war 0xffaa44)
    emissiveMap: nightTexture,
    emissiveIntensity: CONFIG.EARTH.EMISSIVE_INTENSITY * 4.0, // Viel heller: 2.5x → 4.0x
  });

  // AKTUELLES MATERIAL: Startet mit Day
  const earthMaterial = dayMaterial;

  // ===== Ocean Shader Injection Function (für beide Materials) =====
  const applyOceanShader = (material) => {
    material.onBeforeCompile = (shader) => {
      // Uniforms für Ozean-Highlights hinzufügen
      shader.uniforms.uSunPosition = {
        value: new THREE_INSTANCE.Vector3(
          CONFIG.SUN.RADIUS,
          CONFIG.SUN.HEIGHT,
          0
        ),
      };
      shader.uniforms.uOceanShininess = { value: CONFIG.OCEAN.SHININESS };
      shader.uniforms.uOceanSpecularIntensity = {
        value: CONFIG.OCEAN.SPECULAR_INTENSITY,
      };
      shader.uniforms.uOceanSpecularColor = {
        value: new THREE_INSTANCE.Color(CONFIG.OCEAN.SPECULAR_COLOR),
      };

      // WICHTIG: MeshStandardMaterial hat BEREITS vViewPosition varying!
      // Wir müssen es NICHT neu deklarieren, nur nutzen.

      // Fragment Shader: Füge nur Uniforms am Anfang hinzu (KEIN varying!)
      shader.fragmentShader =
        `
        uniform vec3 uSunPosition;
        uniform float uOceanShininess;
        uniform float uOceanSpecularIntensity;
        uniform vec3 uOceanSpecularColor;
      ` + shader.fragmentShader;

      // Fragment Shader: Füge Ozean-Reflexionen NACH roughness_fragment hinzu
      // KONSOLIDIERT: Eine einzige Injection statt zwei separate
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <roughness_fragment>",
        `
        #include <roughness_fragment>
        
        // Ozean-Erkennung: Dunkle Pixel in Day-Textur sind Wasser
        vec3 baseColor = diffuseColor.rgb;
        float oceanMask = step(baseColor.r + baseColor.g + baseColor.b, 0.4);
        
        if (oceanMask > 0.5) {
          // Berechne Spekulare Reflexion (Phong-Modell)
          vec3 sunDirection = normalize(uSunPosition);
          vec3 viewDirection = normalize(vViewPosition);
          vec3 reflectDirection = reflect(-sunDirection, normal);
          
          float specular = pow(max(dot(viewDirection, reflectDirection), 0.0), uOceanShininess);
          specular *= uOceanSpecularIntensity;
          
          // Füge Ocean Specular zu diffuseColor hinzu
          diffuseColor.rgb += uOceanSpecularColor * specular;
        }
        `
      );

      // Speichere Shader-Referenz für Uniform-Updates
      material.userData.oceanShader = shader;
    };
  };

  // Wende Ocean Shader auf BEIDE Materials an
  applyOceanShader(dayMaterial);
  applyOceanShader(nightMaterial);

  const earthGeometry = new THREE_INSTANCE.SphereGeometry(
    CONFIG.EARTH.RADIUS,
    CONFIG.EARTH.SEGMENTS,
    CONFIG.EARTH.SEGMENTS
  );
  earthMesh = new THREE_INSTANCE.Mesh(earthGeometry, earthMaterial);

  // Speichere aktuellen Mode in userData
  earthMesh.userData.currentMode = "day"; // Initial: Tag-Modus

  // Initiale Position und Scale für Hero-Section setzen
  earthMesh.position.set(0, -6.0, 0);
  earthMesh.scale.set(1.5, 1.5, 1.5);
  earthMesh.rotation.y = 0; // Initiale Rotation: Tag-Seite vorne

  // Target-Werte für Transitions speichern (WICHTIG: Vector3 für lerp()-Kompatibilität!)
  earthMesh.userData.targetPosition = new THREE_INSTANCE.Vector3(0, -6.0, 0);
  earthMesh.userData.targetScale = 1.5;
  earthMesh.userData.targetRotation = 0; // Target Y-Rotation für schnelle Drehung
  earthMesh.userData.emissivePulseEnabled = true; // Performance Toggle für City Lights Pulsation
  earthMesh.userData.baseEmissiveIntensity = 0; // Tag: Keine City Lights

  scene.add(earthMesh);
}

// ===== Moon System Creation mit LOD =====
async function createMoonSystem() {
  const loadingManager = new THREE_INSTANCE.LoadingManager();
  const textureLoader = new THREE_INSTANCE.TextureLoader(loadingManager);

  // Mond-Texturen laden
  const loadTexture = (path, name) => {
    return textureLoader.loadAsync(path).catch((error) => {
      log.error(`Failed to load moon texture '${name}' from ${path}:`, error);
      return null;
    });
  };

  const [moonTexture, moonBumpTexture] = await Promise.all([
    loadTexture(CONFIG.PATHS.TEXTURES.MOON, "moon"),
    loadTexture(CONFIG.PATHS.TEXTURES.MOON_BUMP, "moon_bump"),
  ]);

  if (!moonTexture) {
    log.warn("Moon texture failed to load, creating basic moon");
  }

  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  if (moonTexture) {
    moonTexture.anisotropy = Math.min(maxAniso, isMobileDevice ? 4 : 16);
  }
  if (moonBumpTexture) {
    moonBumpTexture.anisotropy = Math.min(maxAniso, isMobileDevice ? 4 : 16);
  }

  // Mond-Material mit Texturen
  const moonMaterial = new THREE_INSTANCE.MeshStandardMaterial({
    map: moonTexture || null,
    bumpMap: moonBumpTexture || null,
    bumpScale: CONFIG.MOON.BUMP_SCALE,
    roughness: 0.9, // Mond ist sehr rau
    metalness: 0.0,
    color: moonTexture ? 0xffffff : 0xaaaaaa, // Fallback-Farbe wenn keine Textur
  });

  // LOD-System für Mond (3 Qualitätsstufen)
  const moonLOD = new THREE_INSTANCE.LOD();

  // High Quality (nah)
  const moonGeometryHigh = new THREE_INSTANCE.SphereGeometry(
    CONFIG.MOON.RADIUS,
    CONFIG.MOON.SEGMENTS,
    CONFIG.MOON.SEGMENTS
  );
  const moonMeshHigh = new THREE_INSTANCE.Mesh(moonGeometryHigh, moonMaterial);
  moonLOD.addLevel(moonMeshHigh, 0);

  // Medium Quality (mittel)
  const moonGeometryMed = new THREE_INSTANCE.SphereGeometry(
    CONFIG.MOON.RADIUS,
    Math.floor(CONFIG.MOON.SEGMENTS * 0.6),
    Math.floor(CONFIG.MOON.SEGMENTS * 0.6)
  );
  const moonMeshMed = new THREE_INSTANCE.Mesh(moonGeometryMed, moonMaterial);
  moonLOD.addLevel(moonMeshMed, 15);

  // Low Quality (weit)
  const moonGeometryLow = new THREE_INSTANCE.SphereGeometry(
    CONFIG.MOON.RADIUS,
    Math.floor(CONFIG.MOON.SEGMENTS * 0.35),
    Math.floor(CONFIG.MOON.SEGMENTS * 0.35)
  );
  const moonMeshLow = new THREE_INSTANCE.Mesh(moonGeometryLow, moonMaterial);
  moonLOD.addLevel(moonMeshLow, 40);

  // Positioniere Mond relativ zur Szene (nicht als Child von Erde)
  moonLOD.position.set(CONFIG.MOON.DISTANCE, 2, -10);
  moonLOD.scale.set(1, 1, 1);

  // UserData für Animationen
  moonLOD.userData.targetPosition = new THREE_INSTANCE.Vector3(
    CONFIG.MOON.DISTANCE,
    2,
    -10
  );
  moonLOD.userData.targetScale = 1.0;
  moonLOD.userData.orbitAngle = 0; // Für optionale Orbit-Animation

  scene.add(moonLOD);
  log.info("Moon system with LOD created successfully");

  return moonLOD;
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
      uScatteringStrength: {
        value: CONFIG.ATMOSPHERE.SCATTERING_STRENGTH * 0.7,
      },
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

  // Globale Referenz für Performance Toggle
  rayleighAtmosphereMesh = rayleighLayer;

  // Speichere Shader-Referenzen für Updates
  atmosphereGroup.userData.atmosphereMaterial = atmosphereMaterial;
  atmosphereGroup.userData.rayleighMaterial = rayleighMaterial;

  return atmosphereGroup;
}

// ===== Camera & Section Updates =====
function setupCameraSystem() {
  updateCameraForSection("hero");
}

// Kamera-Steuerung mit Presets und Smooth Transitions
let cameraTransition = null;

function updateCameraForSection(sectionName) {
  const preset = CONFIG.CAMERA.PRESETS[sectionName];

  if (preset) {
    flyToPreset(sectionName);
  } else {
    log.warn(`No camera preset for section '${sectionName}', using hero`);
    flyToPreset("hero");
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

  // LookAt-Blending: Start und End LookAt
  const startLookAt =
    camera.userData.currentLookAt || new THREE_INSTANCE.Vector3(0, 0, 0);
  const endLookAt = new THREE_INSTANCE.Vector3(
    preset.lookAt.x,
    preset.lookAt.y,
    preset.lookAt.z
  );

  // Berechne Distanz für adaptive Transition-Dauer
  const distance = Math.sqrt(
    Math.pow(preset.x - startPos.x, 2) +
      Math.pow(preset.y - startPos.y, 2) +
      Math.pow(preset.z - startZoom, 2)
  );

  // Adaptive Dauer: Basis + distanzbasiert (min 1.5s, max 4.5s)
  const baseDuration = CONFIG.CAMERA.TRANSITION_DURATION;
  const adaptiveDuration = Math.max(
    1.5,
    Math.min(
      4.5,
      baseDuration + distance * CONFIG.CAMERA.TRANSITION_DURATION_MULTIPLIER
    )
  );
  const duration = adaptiveDuration * 1000; // ms
  const startTime = performance.now();

  log.debug(
    `Camera flight to '${presetName}': distance=${distance.toFixed(1)}, duration=${adaptiveDuration.toFixed(1)}s, target=${preset.target || "earth"}`
  );

  function transitionStep() {
    const elapsed = performance.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Easing: easeInOutQuart (smoothere Beschleunigung/Verzögerung)
    const eased =
      progress < 0.5
        ? 8 * progress * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 4) / 2;

    // Interpoliere Position mit smoothem Easing
    cameraTarget.x = startPos.x + (preset.x - startPos.x) * eased;
    cameraTarget.y = startPos.y + (preset.y - startPos.y) * eased;

    // Cinematische Zoom-Kurve: Arc-Movement für weite Flüge
    const zoomDistance = Math.abs(preset.z - startZoom);

    if (zoomDistance > 8) {
      // Weite Flüge: Bogen-Kurve (erst raus, dann zum Ziel)
      const arcPeak = Math.max(startZoom, preset.z) * 1.12; // 12% über Maximum
      if (progress < 0.5) {
        // Erste Hälfte: Start → Arc-Peak
        const arcEased = easeOutQuad(progress * 2);
        mouseState.zoom = startZoom + (arcPeak - startZoom) * arcEased;
      } else {
        // Zweite Hälfte: Arc-Peak → Ziel
        const arcEased = easeInQuad((progress - 0.5) * 2);
        mouseState.zoom = arcPeak + (preset.z - arcPeak) * arcEased;
      }
    } else {
      // Kurze Flüge: Direkte Interpolation
      mouseState.zoom = startZoom + (preset.z - startZoom) * eased;
    }

    // LookAt-Blending: Sanftes Überblenden zwischen Start- und Ziel-LookAt
    if (camera) {
      const blendedLookAt = new THREE_INSTANCE.Vector3().lerpVectors(
        startLookAt,
        endLookAt,
        eased
      );
      camera.lookAt(blendedLookAt);
      camera.userData.currentLookAt = blendedLookAt.clone();
    }

    if (progress < 1) {
      cameraTransition = earthTimers.setTimeout(transitionStep, 16); // ~60fps
    } else {
      cameraTransition = null;
      // Finale LookAt speichern
      if (camera) {
        camera.userData.currentLookAt = endLookAt.clone();
      }
      log.debug(`Camera transition to '${presetName}' complete`);
    }
  }

  // Helper Easing Functions für Arc-Movement
  function easeOutQuad(t) {
    return t * (2 - t);
  }
  function easeInQuad(t) {
    return t * t;
  }

  transitionStep();
}

// ===== Section Detection & Earth Updates =====
function setupSectionDetection() {
  const sections = document.querySelectorAll("section[id]");
  if (sections.length === 0) return;

  sectionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const newSection = entry.target.id;
          if (newSection !== currentSection) {
            const previousSection = currentSection;
            currentSection = newSection;
            updateCameraForSection(newSection);
            updateEarthForSection(newSection);

            // Sterne-Transformation für Features Section
            if (newSection === "features") {
              log.info(
                "Features section entered, starting star animation immediately"
              );

              // Starte Animation SOFORT - parallel zur Kamera
              // Die Positionen werden nach 2s automatisch aktualisiert
              const cards = document.querySelectorAll("#features .card");
              if (cards.length === 0) {
                log.warn("No cards found, skipping animation");
              } else {
                animateStarsToCards(); // Startet sofort!
              }
            } else if (previousSection === "features") {
              // Zurück zu Original wenn wir features verlassen
              log.info("Leaving features section, resetting stars");
              resetStarsToOriginal();
            }

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
    hero: {
      earth: { pos: { x: 1, y: -2.5, z: -1 }, scale: 1.3, rotation: 0 },
      moon: { pos: { x: -45, y: -45, z: -90 }, scale: 0.4 }, // Mond versteckt
      mode: "day",
    },
    features: {
      earth: { pos: { x: -7, y: -2, z: -4 }, scale: 0.7, rotation: 0 }, // Erde im Hintergrund rechts
      moon: {
        pos: { x: 1, y: 2, z: -5 }, // Mond leicht rechts vor Kamera
        scale: 1.1,
      },
      mode: "day",
    },
    about: {
      earth: { pos: { x: -1, y: -0.5, z: -1 }, scale: 1.0, rotation: Math.PI },
      moon: { pos: { x: -45, y: -45, z: -90 }, scale: 0.4 }, // Mond versteckt
      mode: "toggle",
    },
  };
  const config = configs[sectionName] || configs.hero;

  // Erde Position & Scale
  if (config.earth.pos) {
    earthMesh.userData.targetPosition = new THREE_INSTANCE.Vector3(
      config.earth.pos.x,
      config.earth.pos.y,
      config.earth.pos.z
    );
  }
  earthMesh.userData.targetScale = config.earth.scale;
  earthMesh.userData.targetRotation = config.earth.rotation;

  // Mond Position & Scale (falls vorhanden)
  if (moonMesh && config.moon) {
    moonMesh.userData.targetPosition = new THREE_INSTANCE.Vector3(
      config.moon.pos.x,
      config.moon.pos.y,
      config.moon.pos.z
    );
    moonMesh.userData.targetScale = config.moon.scale;
  }

  // SPECIAL: About Section Toggle-System
  let targetMode = config.mode;

  if (sectionName === "about" && config.mode === "toggle") {
    // Toggle-Logik: Wechsel zwischen Tag und Nacht bei jedem Besuch
    if (lastAboutMode === null) {
      // Erster Besuch: Wechsel zu Nacht (da wir von hero mit Tag kommen)
      targetMode = "night";
    } else {
      // Jeder weitere Besuch: Toggle
      targetMode = lastAboutMode === "day" ? "night" : "day";
    }

    // Speichere für nächsten Toggle
    lastAboutMode = targetMode;

    log.info(`🔄 About section toggle: ${targetMode.toUpperCase()} mode`);
  } else {
    // Andere Sections (hero): BEHALTE aktuellen Mode
    // Ignoriere config.mode - Mode wird nur bei about geändert
    targetMode = earthMesh.userData.currentMode;
    log.debug(
      `Section ${sectionName}: Keeping current mode (${targetMode.toUpperCase()})`
    );
  }

  // MATERIAL SWAP: Tag <-> Nacht (oder beibehalten wenn nicht about)
  if (earthMesh.userData.currentMode !== targetMode) {
    // Nutze globale Material-Variablen
    const newMaterial = targetMode === "day" ? dayMaterial : nightMaterial;

    if (!newMaterial) {
      log.error(`Material for mode '${targetMode}' not found!`);
      return;
    }

    // Dispose altes Material wenn es weder dayMaterial noch nightMaterial ist (Memory Leak Prevention)
    const oldMaterial = earthMesh.material;
    if (
      oldMaterial &&
      oldMaterial !== dayMaterial &&
      oldMaterial !== nightMaterial
    ) {
      // Dispose Texturen und andere Ressourcen
      Object.values(oldMaterial).forEach((value) => {
        if (value && typeof value.dispose === "function") {
          value.dispose();
        }
      });
      // Für ShaderMaterial: Dispose auch Uniforms
      if (oldMaterial.uniforms) {
        Object.values(oldMaterial.uniforms).forEach((uniform) => {
          if (uniform.value && typeof uniform.value.dispose === "function") {
            uniform.value.dispose();
          }
        });
      }
      oldMaterial.dispose();
      log.debug("Disposed old material during mode switch");
    }

    earthMesh.material = newMaterial;
    earthMesh.material.needsUpdate = true; // Force Material Update
    earthMesh.userData.currentMode = targetMode;

    // 🎬 KAMERA-EFFEKT: Fliege zur entsprechenden Seite der Erde
    if (targetMode === "day") {
      targetOrbitAngle = 0; // Tag: Vorderseite (0°)
      // Erde dreht sich zurück zur Tag-Position
      earthMesh.userData.targetRotation = 0;
      log.info(
        "✅ Material switched to: DAY mode → Camera + Earth rotating to sunlit side"
      );
    } else {
      targetOrbitAngle = Math.PI; // Nacht: Rückseite (180°)
      // Erde dreht sich zur Nacht-Position (180° zusätzlich)
      earthMesh.userData.targetRotation = earthMesh.rotation.y + Math.PI;
      log.info(
        "✅ Material switched to: NIGHT mode → Camera + Earth rotating to dark side"
      );
    }
  } else {
    log.debug(`Material remains: ${targetMode.toUpperCase()} mode (no change)`);
  }

  // Cinematische Beleuchtung basierend auf Mode
  if (directionalLight && ambientLight) {
    const currentMode = earthMesh.userData.currentMode;

    if (currentMode === "day") {
      // TAG: Starke, warme Beleuchtung für klare Sicht
      directionalLight.intensity = CONFIG.LIGHTING.DAY.SUN_INTENSITY;
      ambientLight.intensity = CONFIG.LIGHTING.DAY.AMBIENT_INTENSITY;
      ambientLight.color.setHex(CONFIG.LIGHTING.DAY.AMBIENT_COLOR);
      // Sonnen-Position wird in updateCameraPosition() gesetzt (folgt Kamera-Orbit)
    } else {
      // NACHT: Reduzierte, kühle Beleuchtung für dramatischen Look
      directionalLight.intensity = CONFIG.LIGHTING.NIGHT.SUN_INTENSITY;
      ambientLight.intensity = CONFIG.LIGHTING.NIGHT.AMBIENT_INTENSITY;
      ambientLight.color.setHex(CONFIG.LIGHTING.NIGHT.AMBIENT_COLOR);
      // Nacht: Sonne an fixer Position (subtiles Mondlicht)
      directionalLight.position.set(CONFIG.SUN.RADIUS, CONFIG.SUN.HEIGHT, 0);

      // Ocean Shader mit reduzierter Intensität
      if (earthMesh?.material?.userData?.oceanShader) {
        earthMesh.material.userData.oceanShader.uniforms.uSunPosition.value.set(
          CONFIG.SUN.RADIUS * 0.25,
          CONFIG.SUN.HEIGHT,
          0
        );
      }
    }

    log.debug(
      `Cinematic Lights: ${currentMode.toUpperCase()} (sun: ${directionalLight.intensity.toFixed(1)}, ambient: ${ambientLight.intensity.toFixed(2)})`
    );
  }

  log.debug(
    `Section: ${sectionName}, Mode: ${earthMesh.userData.currentMode}, Scale: ${config.scale}, Rotation: ${((config.rotation * 180) / Math.PI).toFixed(0)}°`
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

  // Initialisiere wiederverwendbare Vector3 für Sun Position (Memory Optimization)
  sunPositionVector = new THREE_INSTANCE.Vector3();

  function animate() {
    animationFrameId = requestAnimationFrame(animate);
    frameCount++; // Frame-Counter für Throttling
    const elapsedTime = clock.getElapsedTime();
    const lerpFactor = CONFIG.CAMERA.LERP_FACTOR;

    // Erde rotiert nicht automatisch - nur via Section-Transition (updateEarthForSection)
    // Die Y-Rotation wird in updateObjectTransforms() animiert

    // Wolken driften unabhängig (separate Y-Rotation)
    if (cloudMesh && cloudMesh.rotation) {
      cloudMesh.rotation.y += CONFIG.CLOUDS.ROTATION_SPEED;
    }

    // Mond-Rotation (langsam um eigene Achse)
    if (moonMesh && moonMesh.rotation) {
      moonMesh.rotation.y += CONFIG.MOON.ORBIT_SPEED;
    }

    // Tag/Nacht-Zyklus: Section-basiert ODER automatisch
    if (directionalLight) {
      let sunAngle;

      if (CONFIG.DAY_NIGHT_CYCLE.ENABLED) {
        // Automatischer Zyklus mit beschleunigter Zeit (wenn aktiviert)
        const cycleSpeed =
          CONFIG.SUN.ROTATION_SPEED * CONFIG.DAY_NIGHT_CYCLE.SPEED_MULTIPLIER;
        sunAngle = elapsedTime * cycleSpeed;
      } else {
        // Section-basiert: Sonne folgt currentSection Mode
        // (wird in updateEarthForSection() gesetzt, hier nur Update für Shader)
        sunAngle =
          directionalLight.position.x !== 0
            ? Math.atan2(
                directionalLight.position.z,
                directionalLight.position.x
              )
            : 0;
      }

      const sunX = Math.cos(sunAngle) * CONFIG.SUN.RADIUS;
      const sunZ = Math.sin(sunAngle) * CONFIG.SUN.RADIUS;
      directionalLight.position.set(sunX, CONFIG.SUN.HEIGHT, sunZ);

      // Update Atmosphären-Shader mit neuer Sonnen-Position (wiederverwendbare Vector3)
      if (atmosphereMesh?.userData) {
        sunPositionVector.set(sunX, CONFIG.SUN.HEIGHT, sunZ);

        if (atmosphereMesh.userData.atmosphereMaterial) {
          atmosphereMesh.userData.atmosphereMaterial.uniforms.uSunPosition.value.copy(
            sunPositionVector
          );
        }
        if (atmosphereMesh.userData.rayleighMaterial) {
          atmosphereMesh.userData.rayleighMaterial.uniforms.uSunPosition.value.copy(
            sunPositionVector
          );
        }
      }

      // Update Ozean-Shader mit neuer Sonnen-Position (nur wenn automatischer Zyklus)
      if (
        CONFIG.DAY_NIGHT_CYCLE.ENABLED &&
        earthMesh?.material?.userData?.oceanShader
      ) {
        earthMesh.material.userData.oceanShader.uniforms.uSunPosition.value.set(
          sunX,
          CONFIG.SUN.HEIGHT,
          sunZ
        );
      }

      // Stadtlichter-Pulsation: Nur bei Night-Material (Tag-Material hat keine Emissive)
      // OPTIMIERUNG: Update nur jeden 2. Frame für bessere Performance
      if (
        earthMesh &&
        earthMesh.userData.emissivePulseEnabled &&
        earthMesh.userData.currentMode === "night" &&
        earthMesh.material?.emissiveIntensity !== undefined &&
        frameCount % 2 === 0 // Throttle auf jeden 2. Frame
      ) {
        const baseIntensity = CONFIG.EARTH.EMISSIVE_INTENSITY * 4.0; // Night Material Basis (erhöht von 2.5x)
        const pulseAmount =
          Math.sin(elapsedTime * CONFIG.EARTH.EMISSIVE_PULSE_SPEED) *
          CONFIG.EARTH.EMISSIVE_PULSE_AMPLITUDE *
          2; // Stärkere Pulsation bei Nacht

        // Pulsation auf Basis-Intensität anwenden
        earthMesh.material.emissiveIntensity = baseIntensity + pulseAmount;
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
    // Cinematische orbital rotation mit Easing (Day/Night Transitions)
    const angleDiff = targetOrbitAngle - cameraOrbitAngle;

    // Easing: easeOutQuart für smoothere Verzögerung
    const rawProgress = Math.min(Math.abs(angleDiff) / Math.PI, 1);
    const easedProgress = 1 - Math.pow(1 - rawProgress, 4);
    const easingFactor = 0.06 + easedProgress * 0.12; // 6% bis 18%

    cameraOrbitAngle += angleDiff * easingFactor;

    // Basis-Zoom aus mouseState
    cameraTarget.z = mouseState.zoom;
    const radius = mouseState.zoom;

    // Cinematische Arc-Bewegung: Kamera hebt sich während Flug an
    const flightProgress = Math.abs(angleDiff) / Math.PI;
    const arcBase = CONFIG.CAMERA.ARC_HEIGHT_BASE;
    const arcMult = CONFIG.CAMERA.ARC_HEIGHT_MULTIPLIER;
    const arcHeight =
      Math.sin(flightProgress * Math.PI) *
      radius *
      (arcBase + arcMult * Math.min(1, radius / 30));

    const finalX = cameraTarget.x + Math.sin(cameraOrbitAngle) * radius * 0.75;
    const finalY = cameraTarget.y + arcHeight;
    const finalZ = Math.cos(cameraOrbitAngle) * radius;

    // Adaptiver Lerp: Schneller während Flug, langsamer bei Ankunft
    const adaptiveLerp = flightProgress > 0.15 ? lerpFactor * 1.8 : lerpFactor;
    cameraPosition.x += (finalX - cameraPosition.x) * adaptiveLerp;
    cameraPosition.y += (finalY - cameraPosition.y) * adaptiveLerp;
    cameraPosition.z += (finalZ - cameraPosition.z) * adaptiveLerp;
    camera.position.set(cameraPosition.x, cameraPosition.y, cameraPosition.z);

    // Kamera schaut zur Erde mit leichtem Offset während Flug (cinematischer Look)
    const lookAtOffset = flightProgress * 0.5; // Slight offset während Bewegung
    camera.lookAt(lookAtOffset, 0, 0);

    // 🌞 SONNE FOLGT KAMERA: Bei Tag-Modus rotiert Sonne mit Kamera-Orbit
    // Dadurch ist die sichtbare Erd-Seite IMMER von der Sonne beleuchtet
    if (directionalLight && earthMesh?.userData.currentMode === "day") {
      const sunX = Math.sin(cameraOrbitAngle) * CONFIG.SUN.RADIUS;
      const sunZ = Math.cos(cameraOrbitAngle) * CONFIG.SUN.RADIUS;
      directionalLight.position.set(sunX, CONFIG.SUN.HEIGHT, sunZ);

      // Ocean Shader Update mit aktueller Sonnen-Position (mit Null-Check)
      if (earthMesh?.material?.userData?.oceanShader) {
        earthMesh.material.userData.oceanShader.uniforms.uSunPosition.value.set(
          sunX,
          CONFIG.SUN.HEIGHT,
          sunZ
        );
      }
    }
  }

  function updateObjectTransforms() {
    if (!earthMesh) return;

    // Cinematische Earth Position mit Lerp
    if (earthMesh.userData.targetPosition) {
      earthMesh.position.lerp(earthMesh.userData.targetPosition, 0.04); // Leicht erhöht für smootheren Look
    }

    // Cinematische Earth Scale mit Lerp
    if (earthMesh.userData.targetScale) {
      const scaleDiff = earthMesh.userData.targetScale - earthMesh.scale.x;
      if (Math.abs(scaleDiff) > 0.001) {
        const newScale = earthMesh.scale.x + scaleDiff * 0.06; // Erhöht von 0.05
        earthMesh.scale.set(newScale, newScale, newScale);
      }
    }

    // Cinematische Earth Rotation (Y-Achse für Day/Night Transitions)
    if (earthMesh.userData.targetRotation !== undefined) {
      const rotDiff = earthMesh.userData.targetRotation - earthMesh.rotation.y;

      if (Math.abs(rotDiff) > 0.001) {
        // Smoothe Rotation mit easeOutCubic für cinematischen Look
        const progress = Math.abs(rotDiff) / Math.PI;
        const easing = 1 - Math.pow(1 - Math.min(progress, 1), 3);
        const speed = 0.06 + easing * 0.06; // 6%-12% je nach Progress
        earthMesh.rotation.y += rotDiff * speed;
      } else {
        // Snapping bei Ankunft
        earthMesh.rotation.y = earthMesh.userData.targetRotation;
      }
    }

    // Synchronisiere Wolken mit Erde (da eigenständiges Scene-Objekt, nicht Child)
    // OPTIMIERUNG: Einfaches Copy - Earth Position/Scale ändert sich nur bei Section-Transitions
    if (cloudMesh && earthMesh) {
      // Initialisiere lastSync-Tracking mit wiederverwendbarer Vector3
      if (!cloudMesh.userData.lastSync) {
        cloudMesh.userData.lastSync = {
          position: new THREE_INSTANCE.Vector3(),
          scale: 0,
          rotationX: 0,
          rotationZ: 0,
        };
        // Initial Sync
        cloudMesh.position.copy(earthMesh.position);
        cloudMesh.scale.copy(earthMesh.scale);
        cloudMesh.userData.lastSync.position.copy(earthMesh.position);
        cloudMesh.userData.lastSync.scale = earthMesh.scale.x;
        cloudMesh.userData.lastSync.rotationX = earthMesh.rotation.x;
        cloudMesh.userData.lastSync.rotationZ = earthMesh.rotation.z;
      }

      const lastSync = cloudMesh.userData.lastSync;

      // Position-Sync: Direkte Distanz-Prüfung (schneller als equals() bei lerp-Animationen)
      const posDiff = earthMesh.position.distanceToSquared(lastSync.position);
      if (posDiff > 0.00001) {
        // Threshold für relevante Änderungen
        cloudMesh.position.copy(earthMesh.position);
        lastSync.position.copy(earthMesh.position);
      }

      // Scale-Sync
      if (Math.abs(earthMesh.scale.x - lastSync.scale) > 0.001) {
        cloudMesh.scale.copy(earthMesh.scale);
        lastSync.scale = earthMesh.scale.x;
      }

      // Rotation: Wolken behalten eigene Y-Rotation für Drift, kopiere nur X/Z
      if (Math.abs(earthMesh.rotation.x - lastSync.rotationX) > 0.001) {
        cloudMesh.rotation.x = earthMesh.rotation.x;
        lastSync.rotationX = earthMesh.rotation.x;
      }
      if (Math.abs(earthMesh.rotation.z - lastSync.rotationZ) > 0.001) {
        cloudMesh.rotation.z = earthMesh.rotation.z;
        lastSync.rotationZ = earthMesh.rotation.z;
      }
    }

    // Mond Transform Updates (Position & Scale mit Lerp)
    if (moonMesh) {
      // Position Lerp
      if (moonMesh.userData.targetPosition) {
        moonMesh.position.lerp(moonMesh.userData.targetPosition, 0.04);
      }

      // Scale Lerp
      if (moonMesh.userData.targetScale) {
        const moonScaleDiff = moonMesh.userData.targetScale - moonMesh.scale.x;
        if (Math.abs(moonScaleDiff) > 0.001) {
          const newMoonScale = moonMesh.scale.x + moonScaleDiff * 0.06;
          moonMesh.scale.set(newMoonScale, newMoonScale, newMoonScale);
        }
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
    if (errorText) {
      errorText.textContent = `WebGL Error: ${error.message || "Unknown error"}. Please try refreshing.`;
    }
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
    // SCHRITT 1: Quality-Level anpassen basierend auf FPS
    this.adjustQualityLevel();

    // SCHRITT 2: Pixel Ratio anpassen (nur bei kritischem FPS)
    if (this.fps < 10 && currentQualityLevel !== "LOW") {
      // Erst Quality auf LOW, dann Pixel Ratio reduzieren
      log.error(
        `Critical FPS (${this.fps.toFixed(1)}), switching to LOW quality mode`
      );
      return; // Quality-Wechsel wird beim nächsten Frame wirksam
    }

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

  adjustQualityLevel() {
    const prevLevel = currentQualityLevel;

    // Bestimme Quality-Level basierend auf FPS
    if (this.fps < CONFIG.QUALITY_LEVELS.MEDIUM.minFPS) {
      currentQualityLevel = "LOW";
    } else if (this.fps < CONFIG.QUALITY_LEVELS.HIGH.minFPS) {
      currentQualityLevel = "MEDIUM";
    } else {
      currentQualityLevel = "HIGH";
    }

    // Nur Aktion bei Level-Wechsel
    if (prevLevel !== currentQualityLevel) {
      log.warn(
        `Quality level changed: ${prevLevel} → ${currentQualityLevel} (FPS: ${this.fps.toFixed(1)})`
      );
      this.applyQualitySettings();
    }
  }

  applyQualitySettings() {
    const features = CONFIG.QUALITY_LEVELS[currentQualityLevel].features;

    // Multi-Layer Atmosphere Toggle
    if (rayleighAtmosphereMesh) {
      rayleighAtmosphereMesh.visible = features.multiLayerAtmosphere;
      log.debug(
        `Multi-Layer Atmosphere: ${features.multiLayerAtmosphere ? "ON" : "OFF"}`
      );
    }

    // Cloud Layer Toggle
    if (cloudMesh) {
      cloudMesh.visible = features.cloudLayer;
      log.debug(`Cloud Layer: ${features.cloudLayer ? "ON" : "OFF"}`);
    }

    // Ocean Reflections Toggle (via Shader Uniform mit Null-Check)
    if (earthMesh?.material?.userData?.oceanShader) {
      earthMesh.material.userData.oceanShader.uniforms.uOceanSpecularIntensity.value =
        features.oceanReflections ? CONFIG.OCEAN.SPECULAR_INTENSITY : 0.0;
      log.debug(
        `Ocean Reflections: ${features.oceanReflections ? "ON" : "OFF"}`
      );
    }

    // City Lights Pulse Toggle
    if (earthMesh?.userData?.emissivePulseEnabled !== undefined) {
      earthMesh.userData.emissivePulseEnabled = features.cityLightsPulse;
      log.debug(
        `City Lights Pulse: ${features.cityLightsPulse ? "ON" : "OFF"}`
      );
    }

    // Meteor Showers Toggle
    if (shootingStarManager) {
      // Nutze disabled-Flag für Performance Toggle
      shootingStarManager.disabled = !features.meteorShowers;
      log.debug(`Meteor Showers: ${features.meteorShowers ? "ON" : "OFF"}`);
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
   * Fliege zu vordefiniertem Preset
   * @param {string} presetName - Name des Presets (hero, features, about)
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
