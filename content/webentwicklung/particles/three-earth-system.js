/**
 * Three.js Earth System - Cinematic 3D WebGL Earth Visualization
 * 
 * FIXES v8.1:
 * - Star-to-Cards Animation: Optimized timing and position calculation
 * - Material Disposal: Proper cleanup to prevent memory leaks
 * - Performance: Reduced unnecessary updates, optimized syncing
 * - Camera Transitions: Consistent easing functions
 * 
 * @version 8.1.0-fixed
 * @last-modified 2025-10-26
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

// ===== OPTIMIZED CONFIGURATION v8.1 =====
const CONFIG = {
  EARTH: {
    RADIUS: 3.5,
    SEGMENTS: 64,
    BUMP_SCALE: 0.008,
    EMISSIVE_INTENSITY: 0.2,
    EMISSIVE_PULSE_SPEED: 0.3,
    EMISSIVE_PULSE_AMPLITUDE: 0.08,
  },
  CLOUDS: {
    ALTITUDE: 0.03,
    ROTATION_SPEED: 0.0008,
    OPACITY: 0.3,
  },
  ATMOSPHERE: {
    SCALE: 1.015,
    GLOW_COLOR: 0x5599ff,
    FRESNEL_POWER: 4.5,
    INTENSITY: 0.12,
    RAYLEIGH_SCALE: 1.028,
    MIE_SCALE: 1.018,
    RAYLEIGH_COLOR: 0x4488ff,
    MIE_COLOR: 0xffbb66,
    RAYLEIGH_INTENSITY: 0.08,
    MIE_INTENSITY: 0.04,
    SCATTERING_STRENGTH: 0.18,
    G_PARAMETER: 0.78,
  },
  OCEAN: {
    SHININESS: 100.0,
    SPECULAR_INTENSITY: 0.5,
    SPECULAR_COLOR: 0xffffff,
  },
  SUN: {
    RADIUS: 15,
    HEIGHT: 3.0,
    INTENSITY: 1.8,
    ROTATION_SPEED: 0.0005,
  },
  LIGHTING: {
    DAY: {
      AMBIENT_INTENSITY: 1.4,
      AMBIENT_COLOR: 0x606060,
      SUN_INTENSITY: 1.8,
    },
    NIGHT: {
      AMBIENT_INTENSITY: 0.3,
      AMBIENT_COLOR: 0x202845,
      SUN_INTENSITY: 0.35,
    },
  },
  DAY_NIGHT_CYCLE: {
    ENABLED: false,
    SPEED_MULTIPLIER: 12,
    SYNC_CITY_LIGHTS: true,
    SECTION_MODES: {
      hero: { mode: "day", sunAngle: 0 },
      features: { mode: "day", sunAngle: 0 },
      about: { mode: "toggle", sunAngle: Math.PI },
    },
  },
  STARS: {
    COUNT: 3000,
    TWINKLE_SPEED: 0.3,
    // ✅ NEUE ANIMATION CONFIG
    ANIMATION: {
      DURATION: 3500, // 3.5s - schneller für bessere UX
      CAMERA_SETTLE_DELAY: 1800, // 1.8s - warte auf stabile Kamera
      CARD_FADE_START: 0.70, // Bei 70% starten Karten Fade-in
      CARD_FADE_END: 0.95, // Bei 95% vollständig sichtbar
      SPREAD_XY: 0.6, // Reduziert für kompaktere Cluster
      SPREAD_Z: 0.3, // Reduziert für mehr Tiefe
      LERP_FACTOR: 0.08, // Smootheres Lerping
    }
  },
  MOON: {
    RADIUS: 0.95,
    DISTANCE: 25,
    ORBIT_SPEED: 0.00025,
    SEGMENTS: 48,
    BUMP_SCALE: 0.015,
  },
  CAMERA: {
    FOV: 45,
    NEAR: 0.1,
    FAR: 1000,
    ZOOM_MIN: 5,
    ZOOM_MAX: 25,
    LERP_FACTOR: 0.06,
    PRESETS: {
      hero: {
        x: -6.5,
        y: 4.8,
        z: 10.5,
        lookAt: { x: 0, y: -0.5, z: 0 },
        earthRotation: 0,
        target: 'earth',
      },
      features: {
        x: 7.0,
        y: 5.5,
        z: 7.5,
        lookAt: { x: 0, y: 0.5, z: 0 },
        earthRotation: 0,
        target: 'earth',
      },
      about: {
        x: -3.2,
        y: 3.0,
        z: 9.5,
        lookAt: { x: 0, y: 0, z: 0 },
        earthRotation: Math.PI,
        target: 'earth',
      },
    },
    TRANSITION_DURATION: 1.8,
    TRANSITION_DURATION_MULTIPLIER: 0.018,
    ARC_HEIGHT_BASE: 1.5,
    ARC_HEIGHT_MULTIPLIER: 0.1,
  },
  METEOR_EVENTS: {
    BASE_FREQUENCY: 0.003,
    SHOWER_FREQUENCY: 0.02,
    SHOWER_DURATION: 180,
    SHOWER_COOLDOWN: 1200,
    MAX_SIMULTANEOUS: 3,
    TRAJECTORIES: [
      { start: { x: -80, y: 50, z: -40 }, end: { x: 80, y: -40, z: 50 } },
      { start: { x: 80, y: 60, z: -30 }, end: { x: -70, y: -35, z: 55 } },
      { start: { x: -70, y: 65, z: 50 }, end: { x: 75, y: -50, z: -60 } },
    ],
  },
  PERFORMANCE: {
    PIXEL_RATIO: Math.min(window.devicePixelRatio, 2.0),
    TARGET_FPS: 55,
    DRS_DOWN_THRESHOLD: 48,
    DRS_UP_THRESHOLD: 58,
  },
  QUALITY_LEVELS: {
    HIGH: {
      minFPS: 48,
      features: {
        multiLayerAtmosphere: true,
        oceanReflections: true,
        cloudLayer: true,
        cityLightsPulse: true,
        meteorShowers: true,
      },
    },
    MEDIUM: {
      minFPS: 28,
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
let scene, camera, renderer, earthMesh, moonMesh, starField, cloudMesh, atmosphereMesh, rayleighAtmosphereMesh;
let directionalLight = null;
let ambientLight = null;
let THREE_INSTANCE = null;

// ✅ OPTIMIERTE Starfield Animation State
let starOriginalPositions = null;
let starTargetPositions = null;
let starAnimationState = {
  active: false,
  startTime: 0,
  positionsUpdated: false,
  updateScheduled: false,
};

let dayMaterial = null;
let nightMaterial = null;
let lastAboutMode = null;

let sectionObserver = null;
let animationFrameId = null;
let currentSection = "hero";
let currentQualityLevel = "HIGH";
let isMobileDevice = false;
let frameCount = 0;

let performanceMonitor = null;
let shootingStarManager = null;
let sunPositionVector = null;

const cameraTarget = { x: 0, y: 0, z: 10 };
const cameraPosition = { x: 0, y: 0, z: 10 };
let cameraOrbitAngle = 0;
let targetOrbitAngle = 0;

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
      log.info("Initializing Three.js Earth system v8.1.0");
      registerParticleSystem("three-earth", { type: "three-earth" });

      THREE_INSTANCE = await loadThreeJS();
      if (!THREE_INSTANCE) {
        throw new Error("Three.js failed to load from all sources");
      }

      showLoadingState(container, 0);

      await setupScene(container);
      await createEarthSystem();

      moonMesh = await createMoonSystem();
      cloudMesh = await createCloudLayer();
      cloudMesh.position.copy(earthMesh.position);
      cloudMesh.scale.copy(earthMesh.scale);
      scene.add(cloudMesh);

      atmosphereMesh = createAtmosphere();
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

    if (dayMaterial) {
      disposeMaterial(dayMaterial);
      dayMaterial = null;
    }
    if (nightMaterial) {
      disposeMaterial(nightMaterial);
      nightMaterial = null;
    }

    scene = camera = renderer = earthMesh = moonMesh = starField = cloudMesh = 
      atmosphereMesh = directionalLight = ambientLight = rayleighAtmosphereMesh = null;
    currentSection = "hero";
    lastAboutMode = null;
    cameraOrbitAngle = 0;
    targetOrbitAngle = 0;
    frameCount = 0;
    sunPositionVector = null;

    starOriginalPositions = null;
    starTargetPositions = null;
    starAnimationState = {
      active: false,
      startTime: 0,
      positionsUpdated: false,
      updateScheduled: false,
    };

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
    if (!material) return;
    
    const textureProperties = [
      'map', 'normalMap', 'bumpMap', 'envMap', 
      'lightMap', 'aoMap', 'emissiveMap', 'alphaMap',
      'metalnessMap', 'roughnessMap', 'displacementMap'
    ];
    
    textureProperties.forEach(prop => {
      if (material[prop] && typeof material[prop].dispose === 'function') {
        material[prop].dispose();
        material[prop] = null;
      }
    });
    
    if (material.uniforms) {
      Object.keys(material.uniforms).forEach(uniformName => {
        const uniform = material.uniforms[uniformName];
        if (uniform.value && typeof uniform.value.dispose === 'function') {
          uniform.value.dispose();
          uniform.value = null;
        }
      });
    }
    
    try {
      material.dispose();
    } catch (error) {
      console.warn('Error disposing material:', error);
    }
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
  if (!container) {
    throw new Error('Container element is required');
  }
  
  try {
    isMobileDevice = window.matchMedia("(max-width: 768px)").matches;
    
    if (!THREE_INSTANCE) {
      throw new Error('Three.js instance not available');
    }
    
    scene = new THREE_INSTANCE.Scene();
    
    const aspectRatio = container.clientWidth / container.clientHeight;
    if (!isFinite(aspectRatio) || aspectRatio <= 0) {
      throw new Error('Invalid container dimensions');
    }
    
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
    
    const gl = renderer.getContext();
    if (!gl) {
      throw new Error('WebGL context could not be created');
    }
    
    renderer.setPixelRatio(CONFIG.PERFORMANCE.PIXEL_RATIO);
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE_INSTANCE.SRGBColorSpace;
    renderer.toneMapping = THREE_INSTANCE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.8;

    container.appendChild(renderer.domElement);

    createStarField();
    setupStarParallax();
    setupLighting();
    
    log.info("Scene setup completed successfully");
    return true;
    
  } catch (error) {
    console.error('Scene setup failed:', error);
    showWebGLErrorMessage(container, error);
    return false;
  }
}

// ===== Starfield & Parallax =====
function createStarField() {
  const starCount = isMobileDevice ? CONFIG.STARS.COUNT / 2 : CONFIG.STARS.COUNT;
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
  starGeometry.setAttribute("position", new THREE_INSTANCE.BufferAttribute(positions, 3));
  starGeometry.setAttribute("color", new THREE_INSTANCE.BufferAttribute(colors, 3));
  starGeometry.setAttribute("size", new THREE_INSTANCE.BufferAttribute(sizes, 1));

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

  starOriginalPositions = new Float32Array(positions);

  log.info(`Starfield created with ${starCount} stars`);
}

function setupStarParallax() {
  const parallaxHandler = (progress) => {
    if (!starField || starAnimationState.active) return;
    starField.rotation.y = progress * Math.PI * 0.2;
    starField.position.z = Math.sin(progress * Math.PI) * 15;
  };
  sharedParallaxManager.addHandler(parallaxHandler, "three-earth-stars");
}

// ===== ✅ OPTIMIERTE Star-to-Cards Transformation =====
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
    log.warn("No cards found, using fallback grid");
    const gridCols = 3;
    const spacingX = 8;
    const spacingY = 6;
    const baseZ = -2;

    for (let i = 0; i < 9; i++) {
      const row = Math.floor(i / gridCols);
      const col = i % gridCols;
      positions.push({
        x: (col - 1) * spacingX,
        y: (1 - row) * spacingY + 2,
        z: baseZ,
      });
    }
    return positions;
  }

  // ✅ VERBESSERT: Warte bis Karten im Viewport sichtbar sind
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  cards.forEach((card) => {
    const rect = card.getBoundingClientRect();
    
    // ✅ Skip Cards außerhalb des Viewports
    if (rect.bottom < 0 || rect.top > viewportHeight) {
      return;
    }

    const ndcX = ((rect.left + rect.width / 2) / viewportWidth) * 2 - 1;
    const ndcY = -(((rect.top + rect.height / 2) / viewportHeight) * 2 - 1);

    const targetZ = -2;
    const vector = new THREE_INSTANCE.Vector3(ndcX, ndcY, 0);
    vector.unproject(camera);

    const direction = vector.sub(camera.position).normalize();
    const distance = (targetZ - camera.position.z) / direction.z;
    const worldPos = camera.position.clone().add(direction.multiplyScalar(distance));

    positions.push({
      x: worldPos.x,
      y: worldPos.y,
      z: targetZ,
    });
  });

  if (positions.length > 0) {
    log.info(`Calculated ${positions.length} card positions in viewport`);
  }

  return positions;
}

function animateStarsToCards() {
  if (!starField || !starOriginalPositions) {
    log.warn("Cannot animate: starField or originalPositions missing");
    return;
  }

  if (starAnimationState.active) {
    log.debug("Star animation already in progress, skipping");
    return;
  }

  // ✅ Verstecke Karten initial
  const cards = document.querySelectorAll("#features .card");
  cards.forEach((card) => {
    card.style.transition = "none";
    card.style.opacity = "0";
  });

  starAnimationState.active = true;
  starAnimationState.startTime = performance.now();
  starAnimationState.positionsUpdated = false;
  starAnimationState.updateScheduled = false;

  log.info("Starting star-to-cards transformation");

  // ✅ Berechne initiale Positionen SOFORT
  const initialPositions = getCardPositions();
  if (initialPositions.length === 0) {
    log.warn("No initial card positions, aborting animation");
    starAnimationState.active = false;
    return;
  }

  const positions = starField.geometry.attributes.position.array;
  const starCount = positions.length / 3;
  starTargetPositions = new Float32Array(starCount * 3);

  const calculateTargets = (cardPositions) => {
    const animCfg = CONFIG.STARS.ANIMATION;
    for (let i = 0; i < starCount; i++) {
      const i3 = i * 3;
      const targetCard = cardPositions[i % cardPositions.length];

      starTargetPositions[i3] = targetCard.x + (Math.random() - 0.5) * animCfg.SPREAD_XY;
      starTargetPositions[i3 + 1] = targetCard.y + (Math.random() - 0.5) * animCfg.SPREAD_XY;
      starTargetPositions[i3 + 2] = targetCard.z + (Math.random() - 0.5) * animCfg.SPREAD_Z;
    }
  };

  calculateTargets(initialPositions);

  // ✅ Schedule Position-Update nach Kamera-Stabilisierung
  if (!starAnimationState.updateScheduled) {
    starAnimationState.updateScheduled = true;
    setTimeout(() => {
      if (starAnimationState.active && !starAnimationState.positionsUpdated) {
        const updatedPositions = getCardPositions();
        if (updatedPositions.length > 0) {
          log.info("Updating star targets with stabilized camera");
          calculateTargets(updatedPositions);
          starAnimationState.positionsUpdated = true;
        }
      }
    }, CONFIG.STARS.ANIMATION.CAMERA_SETTLE_DELAY);
  }

  animateStarTransformation(cards);
}

function animateStarTransformation(cards) {
  if (!starAnimationState.active || !starField || !starTargetPositions) {
    starAnimationState.active = false;
    return;
  }

  const animCfg = CONFIG.STARS.ANIMATION;
  const duration = animCfg.DURATION;

  function animate() {
    if (!starAnimationState.active || !starField || !starTargetPositions) {
      starAnimationState.active = false;
      return;
    }

    const elapsed = performance.now() - starAnimationState.startTime;
    const progress = Math.min(elapsed / duration, 1);

    // ✅ Optimiertes Easing
    const eased = easeInOutCubic(progress);

    // ✅ Interpoliere Sterne-Positionen mit Lerp
    const positions = starField.geometry.attributes.position.array;
    const starCount = positions.length / 3;
    const lerpFactor = animCfg.LERP_FACTOR;

    for (let i = 0; i < starCount; i++) {
      const i3 = i * 3;
      const targetX = starOriginalPositions[i3] + 
        (starTargetPositions[i3] - starOriginalPositions[i3]) * eased;
      const targetY = starOriginalPositions[i3 + 1] + 
        (starTargetPositions[i3 + 1] - starOriginalPositions[i3 + 1]) * eased;
      const targetZ = starOriginalPositions[i3 + 2] + 
        (starTargetPositions[i3 + 2] - starOriginalPositions[i3 + 2]) * eased;

      // Smooth Lerp für flüssigere Bewegung
      positions[i3] += (targetX - positions[i3]) * lerpFactor;
      positions[i3 + 1] += (targetY - positions[i3 + 1]) * lerpFactor;
      positions[i3 + 2] += (targetZ - positions[i3 + 2]) * lerpFactor;
    }

    starField.geometry.attributes.position.needsUpdate = true;

    // ✅ Karten Fade-in während Sterne sich nähern
    if (progress >= animCfg.CARD_FADE_START && progress <= animCfg.CARD_FADE_END) {
      const fadeProgress = 
        (progress - animCfg.CARD_FADE_START) / 
        (animCfg.CARD_FADE_END - animCfg.CARD_FADE_START);
      const cardOpacity = easeInOutCubic(fadeProgress);

      cards.forEach((card) => {
        card.style.opacity = cardOpacity.toString();
      });
    } else if (progress > animCfg.CARD_FADE_END) {
      cards.forEach((card) => {
        card.style.opacity = "1";
      });
    }

    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      log.info("Star transformation complete");
      starAnimationState.active = false;
      
      // ✅ Re-enable CSS transitions für Karten
      cards.forEach((card) => {
        card.style.transition = "";
      });
    }
  }

  animate();
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function resetStarsToOriginal() {
  if (!starField || !starOriginalPositions) {
    return;
  }

  starAnimationState.active = false;
  starAnimationState.positionsUpdated = false;
  starAnimationState.updateScheduled = false;

  const cards = document.querySelectorAll("#features .card");
  cards.forEach((card) => {
    card.style.opacity = "0";
    card.style.transition = "opacity 0.5s ease";
  });

  const positions = starField.geometry.attributes.position.array;
  for (let i = 0; i < positions.length; i++) {
    positions[i] = starOriginalPositions[i];
  }
  starField.geometry.attributes.position.needsUpdate = true;

  starTargetPositions = null;

  log.info("Stars reset to original positions");
}

// ===== Cinematic Lighting Setup =====
function setupLighting() {
  directionalLight = new THREE_INSTANCE.DirectionalLight(0xffffff, CONFIG.SUN.INTENSITY);
  directionalLight.position.set(CONFIG.SUN.RADIUS, CONFIG.SUN.HEIGHT, 0);
  scene.add(directionalLight);

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
    setTimeout(() => {
      hideLoadingState(document.getElementById("threeEarthContainer"));
    }, 500);
  };

  const textureLoader = new THREE_INSTANCE.TextureLoader(loadingManager);

  const loadTexture = (path, name) => {
    return textureLoader.loadAsync(path).catch((error) => {
      log.error(`Failed to load texture '${name}' from ${path}:`, error);
      return null;
    });
  };

  const [dayTexture, nightTexture, normalTexture, bumpTexture] = await Promise.all([
    loadTexture(CONFIG.PATHS.TEXTURES.DAY, "day"),
    loadTexture(CONFIG.PATHS.TEXTURES.NIGHT, "night"),
    loadTexture(CONFIG.PATHS.TEXTURES.NORMAL, "normal"),
    loadTexture(CONFIG.PATHS.TEXTURES.BUMP, "bump"),
  ]);

  if (!dayTexture) {
    throw new Error("Failed to load critical day texture");
  }

  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  [dayTexture, nightTexture, normalTexture, bumpTexture].forEach((tex) => {
    if (tex) tex.anisotropy = Math.min(maxAniso, isMobileDevice ? 4 : 16);
  });

  dayMaterial = new THREE_INSTANCE.MeshStandardMaterial({
    map: dayTexture,
    normalMap: normalTexture,
    normalScale: new THREE_INSTANCE.Vector2(1.0, 1.0),
    bumpMap: bumpTexture,
    bumpScale: CONFIG.EARTH.BUMP_SCALE,
    roughness: 0.7,
    metalness: 0.0,
    emissive: 0x000000,
    emissiveIntensity: 0,
  });

  nightMaterial = new THREE_INSTANCE.MeshStandardMaterial({
    map: dayTexture,
    normalMap: normalTexture,
    normalScale: new THREE_INSTANCE.Vector2(1.0, 1.0),
    bumpMap: bumpTexture,
    bumpScale: CONFIG.EARTH.BUMP_SCALE,
    roughness: 0.7,
    metalness: 0.0,
    emissive: 0xffcc66,
    emissiveMap: nightTexture,
    emissiveIntensity: CONFIG.EARTH.EMISSIVE_INTENSITY * 4.0,
  });

  const earthMaterial = dayMaterial;

  const applyOceanShader = (material) => {
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uSunPosition = {
        value: new THREE_INSTANCE.Vector3(CONFIG.SUN.RADIUS, CONFIG.SUN.HEIGHT, 0),
      };
      shader.uniforms.uOceanShininess = { value: CONFIG.OCEAN.SHININESS };
      shader.uniforms.uOceanSpecularIntensity = { value: CONFIG.OCEAN.SPECULAR_INTENSITY };
      shader.uniforms.uOceanSpecularColor = {
        value: new THREE_INSTANCE.Color(CONFIG.OCEAN.SPECULAR_COLOR),
      };

      shader.fragmentShader = `
        uniform vec3 uSunPosition;
        uniform float uOceanShininess;
        uniform float uOceanSpecularIntensity;
        uniform vec3 uOceanSpecularColor;
      ` + shader.fragmentShader;

      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <roughness_fragment>",
        `
        #include <roughness_fragment>
        
        vec3 baseColor = diffuseColor.rgb;
        float oceanMask = step(baseColor.r + baseColor.g + baseColor.b, 0.4);
        
        if (oceanMask > 0.5) {
          vec3 sunDirection = normalize(uSunPosition);
          vec3 viewDirection = normalize(vViewPosition);
          vec3 reflectDirection = reflect(-sunDirection, normal);
          
          float specular = pow(max(dot(viewDirection, reflectDirection), 0.0), uOceanShininess);
          specular *= uOceanSpecularIntensity;
          
          diffuseColor.rgb += uOceanSpecularColor * specular;
        }
        `
      );

      material.userData.oceanShader = shader;
    };
  };

  applyOceanShader(dayMaterial);
  applyOceanShader(nightMaterial);

  const earthGeometry = new THREE_INSTANCE.SphereGeometry(
    CONFIG.EARTH.RADIUS,
    CONFIG.EARTH.SEGMENTS,
    CONFIG.EARTH.SEGMENTS
  );
  earthMesh = new THREE_INSTANCE.Mesh(earthGeometry, earthMaterial);

  earthMesh.userData.currentMode = "day";
  earthMesh.position.set(0, -6.0, 0);
  earthMesh.scale.set(1.5, 1.5, 1.5);
  earthMesh.rotation.y = 0;

  earthMesh.userData.targetPosition = new THREE_INSTANCE.Vector3(0, -6.0, 0);
  earthMesh.userData.targetScale = 1.5;
  earthMesh.userData.targetRotation = 0;
  earthMesh.userData.emissivePulseEnabled = true;
  earthMesh.userData.baseEmissiveIntensity = 0;

  scene.add(earthMesh);
}

// ===== Moon System Creation =====
async function createMoonSystem() {
  const loadingManager = new THREE_INSTANCE.LoadingManager();
  const textureLoader = new THREE_INSTANCE.TextureLoader(loadingManager);

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
  if (moonTexture) moonTexture.anisotropy = Math.min(maxAniso, isMobileDevice ? 4 : 16);
  if (moonBumpTexture) moonBumpTexture.anisotropy = Math.min(maxAniso, isMobileDevice ? 4 : 16);

  const moonMaterial = new THREE_INSTANCE.MeshStandardMaterial({
    map: moonTexture || null,
    bumpMap: moonBumpTexture || null,
    bumpScale: CONFIG.MOON.BUMP_SCALE,
    roughness: 0.9,
    metalness: 0.0,
    color: moonTexture ? 0xffffff : 0xaaaaaa,
  });

  const moonLOD = new THREE_INSTANCE.LOD();

  const moonGeometryHigh = new THREE_INSTANCE.SphereGeometry(
    CONFIG.MOON.RADIUS,
    CONFIG.MOON.SEGMENTS,
    CONFIG.MOON.SEGMENTS
  );
  const moonMeshHigh = new THREE_INSTANCE.Mesh(moonGeometryHigh, moonMaterial);
  moonLOD.addLevel(moonMeshHigh, 0);

  const moonGeometryMed = new THREE_INSTANCE.SphereGeometry(
    CONFIG.MOON.RADIUS,
    Math.floor(CONFIG.MOON.SEGMENTS * 0.6),
    Math.floor(CONFIG.MOON.SEGMENTS * 0.6)
  );
  const moonMeshMed = new THREE_INSTANCE.Mesh(moonGeometryMed, moonMaterial);
  moonLOD.addLevel(moonMeshMed, 15);

  const moonGeometryLow = new THREE_INSTANCE.SphereGeometry(
    CONFIG.MOON.RADIUS,
    Math.floor(CONFIG.MOON.SEGMENTS * 0.35),
    Math.floor(CONFIG.MOON.SEGMENTS * 0.35)
  );
  const moonMeshLow = new THREE_INSTANCE.Mesh(moonGeometryLow, moonMaterial);
  moonLOD.addLevel(moonMeshLow, 40);

  moonLOD.position.set(CONFIG.MOON.DISTANCE, 2, -10);
  moonLOD.scale.set(1, 1, 1);

  moonLOD.userData.targetPosition = new THREE_INSTANCE.Vector3(CONFIG.MOON.DISTANCE, 2, -10);
  moonLOD.userData.targetScale = 1.0;
  moonLOD.userData.orbitAngle = 0;

  scene.add(moonLOD);
  log.info("Moon system with LOD created successfully");

  return moonLOD;
}

async function createCloudLayer() {
  const textureLoader = new THREE_INSTANCE.TextureLoader();
  try {
    const cloudTexture = await textureLoader.loadAsync(CONFIG.PATHS.TEXTURES.CLOUDS);
    cloudTexture.wrapS = THREE_INSTANCE.RepeatWrapping;
    cloudTexture.wrapT = THREE_INSTANCE.RepeatWrapping;
    cloudTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();

    const cloudMaterial = new THREE_INSTANCE.MeshStandardMaterial({
      map: cloudTexture,
      transparent: true,
      opacity: CONFIG.CLOUDS.OPACITY,
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
    clouds.renderOrder = 1;
    log.info("Cloud layer created successfully");
    return clouds;
  } catch (error) {
    log.warn("Could not load cloud texture, skipping cloud layer.", error);
    return new THREE_INSTANCE.Object3D();
  }
}

function createAtmosphere() {
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
        vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
        float fresnel = pow(1.0 - abs(dot(vNormal, viewDirection)), uPower);
        
        float rayleighFactor = fresnel * uRayleighIntensity;
        vec3 rayleighScatter = uRayleighColor * rayleighFactor;
        
        vec3 toSun = normalize(uSunPosition - vWorldPosition);
        float sunAlignment = max(0.0, dot(viewDirection, toSun));
        
        float g = 0.76;
        float g2 = g * g;
        float mieFactor = (1.0 - g2) / pow(1.0 + g2 - 2.0 * g * sunAlignment, 1.5);
        mieFactor *= fresnel * uMieIntensity;
        
        vec3 mieScatter = uMieColor * mieFactor;
        
        vec3 finalColor = (rayleighScatter + mieScatter) * uScatteringStrength;
        
        float alpha = fresnel * (uRayleighIntensity + uMieIntensity * 0.5);
        
        gl_FragColor = vec4(finalColor, alpha);
    }`;

  const atmosphereMaterial = new THREE_INSTANCE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uRayleighColor: { value: new THREE_INSTANCE.Color(CONFIG.ATMOSPHERE.RAYLEIGH_COLOR) },
      uMieColor: { value: new THREE_INSTANCE.Color(CONFIG.ATMOSPHERE.MIE_COLOR) },
      uPower: { value: CONFIG.ATMOSPHERE.FRESNEL_POWER },
      uRayleighIntensity: { value: CONFIG.ATMOSPHERE.RAYLEIGH_INTENSITY },
      uMieIntensity: { value: CONFIG.ATMOSPHERE.MIE_INTENSITY },
      uScatteringStrength: { value: CONFIG.ATMOSPHERE.SCATTERING_STRENGTH },
      uSunPosition: { value: new THREE_INSTANCE.Vector3(CONFIG.SUN.RADIUS, CONFIG.SUN.HEIGHT, 0) },
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
  atmosphere.renderOrder = 2;

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
        vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
        float fresnel = pow(1.0 - abs(dot(vNormal, viewDirection)), uPower);
        
        float rayleighFactor = fresnel * uRayleighIntensity;
        vec3 rayleighScatter = uRayleighColor * rayleighFactor;
        
        vec3 toSun = normalize(uSunPosition - vWorldPosition);
        float sunAlignment = max(0.0, dot(viewDirection, toSun));
        
        float g = 0.76;
        float g2 = g * g;
        float mieFactor = (1.0 - g2) / pow(1.0 + g2 - 2.0 * g * sunAlignment, 1.5);
        mieFactor *= fresnel * uMieIntensity * 0.3;
        
        vec3 mieScatter = uMieColor * mieFactor;
        
        vec3 finalColor = (rayleighScatter + mieScatter) * uScatteringStrength;
        
        float alpha = fresnel * (uRayleighIntensity + uMieIntensity * 0.15);
        
        gl_FragColor = vec4(finalColor, alpha);
    }`;

  const rayleighMaterial = new THREE_INSTANCE.ShaderMaterial({
    vertexShader,
    fragmentShader: rayleighFragmentShader,
    uniforms: {
      uRayleighColor: { value: new THREE_INSTANCE.Color(CONFIG.ATMOSPHERE.RAYLEIGH_COLOR) },
      uMieColor: { value: new THREE_INSTANCE.Color(CONFIG.ATMOSPHERE.MIE_COLOR) },
      uPower: { value: CONFIG.ATMOSPHERE.FRESNEL_POWER * 0.8 },
      uRayleighIntensity: { value: CONFIG.ATMOSPHERE.RAYLEIGH_INTENSITY * 0.6 },
      uMieIntensity: { value: CONFIG.ATMOSPHERE.MIE_INTENSITY },
      uScatteringStrength: { value: CONFIG.ATMOSPHERE.SCATTERING_STRENGTH * 0.7 },
      uSunPosition: { value: new THREE_INSTANCE.Vector3(CONFIG.SUN.RADIUS, CONFIG.SUN.HEIGHT, 0) },
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
  rayleighLayer.renderOrder = 2.5;

  const atmosphereGroup = new THREE_INSTANCE.Group();
  atmosphereGroup.add(atmosphere);
  atmosphereGroup.add(rayleighLayer);

  rayleighAtmosphereMesh = rayleighLayer;

  atmosphereGroup.userData.atmosphereMaterial = atmosphereMaterial;
  atmosphereGroup.userData.rayleighMaterial = rayleighMaterial;

  return atmosphereGroup;
}

// ===== Camera & Section Updates =====
function setupCameraSystem() {
  updateCameraForSection("hero");
}

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

function flyToPreset(presetName) {
  const preset = CONFIG.CAMERA.PRESETS[presetName];
  if (!preset) {
    log.warn(`Camera preset '${presetName}' not found`);
    return;
  }

  if (cameraTransition) {
    earthTimers.clearTimeout(cameraTransition);
    cameraTransition = null;
  }

  const startPos = { ...cameraTarget };
  const startZoom = mouseState.zoom;

  const startLookAt = camera.userData.currentLookAt || new THREE_INSTANCE.Vector3(0, 0, 0);
  const endLookAt = new THREE_INSTANCE.Vector3(preset.lookAt.x, preset.lookAt.y, preset.lookAt.z);

  const distance = Math.sqrt(
    Math.pow(preset.x - startPos.x, 2) +
    Math.pow(preset.y - startPos.y, 2) +
    Math.pow(preset.z - startZoom, 2)
  );

  const baseDuration = CONFIG.CAMERA.TRANSITION_DURATION;
  const adaptiveDuration = Math.max(
    1.5,
    Math.min(4.5, baseDuration + distance * CONFIG.CAMERA.TRANSITION_DURATION_MULTIPLIER)
  );
  const duration = adaptiveDuration * 1000;
  const startTime = performance.now();

  log.debug(
    `Camera flight to '${presetName}': distance=${distance.toFixed(1)}, duration=${adaptiveDuration.toFixed(1)}s`
  );

  function transitionStep() {
    const elapsed = performance.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);

    const eased = progress < 0.5
      ? 8 * progress * progress * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 4) / 2;

    cameraTarget.x = startPos.x + (preset.x - startPos.x) * eased;
    cameraTarget.y = startPos.y + (preset.y - startPos.y) * eased;

    const zoomDistance = Math.abs(preset.z - startZoom);

    if (zoomDistance > 8) {
      const arcPeak = Math.max(startZoom, preset.z) * 1.12;
      if (progress < 0.5) {
        const arcEased = easeOutQuad(progress * 2);
        mouseState.zoom = startZoom + (arcPeak - startZoom) * arcEased;
      } else {
        const arcEased = easeInQuad((progress - 0.5) * 2);
        mouseState.zoom = arcPeak + (preset.z - arcPeak) * arcEased;
      }
    } else {
      mouseState.zoom = startZoom + (preset.z - startZoom) * eased;
    }

    if (camera) {
      const blendedLookAt = new THREE_INSTANCE.Vector3().lerpVectors(startLookAt, endLookAt, eased);
      camera.lookAt(blendedLookAt);
      camera.userData.currentLookAt = blendedLookAt.clone();
    }

    if (progress < 1) {
      cameraTransition = earthTimers.setTimeout(transitionStep, 16);
    } else {
      cameraTransition = null;
      if (camera) {
        camera.userData.currentLookAt = endLookAt.clone();
      }
      log.debug(`Camera transition to '${presetName}' complete`);
    }
  }

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

            if (newSection === "features") {
              log.info("Features section entered, starting star animation");

              const cards = document.querySelectorAll("#features .card");
              if (cards.length === 0) {
                log.warn("No cards found, skipping animation");
              } else {
                animateStarsToCards();
              }
            } else if (previousSection === "features") {
              log.info("Leaving features section, resetting stars");
              resetStarsToOriginal();
            }

            document.querySelector(".three-earth-container")?.setAttribute("data-section", newSection);
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
      moon: { pos: { x: -45, y: -45, z: -90 }, scale: 0.4 },
      mode: "day",
    },
    features: {
      earth: { pos: { x: -7, y: -2, z: -4 }, scale: 0.7, rotation: 0 },
      moon: { pos: { x: 1, y: 2, z: -5 }, scale: 1.1 },
      mode: "day",
    },
    about: {
      earth: { pos: { x: -1, y: -0.5, z: -1 }, scale: 1.0, rotation: Math.PI },
      moon: { pos: { x: -45, y: -45, z: -90 }, scale: 0.4 },
      mode: "toggle",
    },
  };
  const config = configs[sectionName] || configs.hero;

  if (config.earth.pos) {
    earthMesh.userData.targetPosition = new THREE_INSTANCE.Vector3(
      config.earth.pos.x,
      config.earth.pos.y,
      config.earth.pos.z
    );
  }
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

  let targetMode = config.mode;

  if (sectionName === "about" && config.mode === "toggle") {
    if (lastAboutMode === null) {
      targetMode = "night";
    } else {
      targetMode = lastAboutMode === "day" ? "night" : "day";
    }

    lastAboutMode = targetMode;

    log.info(`🔄 About section toggle: ${targetMode.toUpperCase()} mode`);
  } else {
    targetMode = earthMesh.userData.currentMode;
    log.debug(`Section ${sectionName}: Keeping current mode (${targetMode.toUpperCase()})`);
  }

  if (earthMesh.userData.currentMode !== targetMode) {
    const newMaterial = targetMode === "day" ? dayMaterial : nightMaterial;

    if (!newMaterial) {
      log.error(`Material for mode '${targetMode}' not found!`);
      return;
    }

    earthMesh.material = newMaterial;
    earthMesh.material.needsUpdate = true;
    earthMesh.userData.currentMode = targetMode;

    if (targetMode === "day") {
      targetOrbitAngle = 0;
      earthMesh.userData.targetRotation = 0;
      log.info("✅ Material switched to: DAY mode");
    } else {
      targetOrbitAngle = Math.PI;
      earthMesh.userData.targetRotation = earthMesh.rotation.y + Math.PI;
      log.info("✅ Material switched to: NIGHT mode");
    }
  }

  if (directionalLight && ambientLight) {
    const currentMode = earthMesh.userData.currentMode;

    if (currentMode === "day") {
      directionalLight.intensity = CONFIG.LIGHTING.DAY.SUN_INTENSITY;
      ambientLight.intensity = CONFIG.LIGHTING.DAY.AMBIENT_INTENSITY;
      ambientLight.color.setHex(CONFIG.LIGHTING.DAY.AMBIENT_COLOR);
    } else {
      directionalLight.intensity = CONFIG.LIGHTING.NIGHT.SUN_INTENSITY;
      ambientLight.intensity = CONFIG.LIGHTING.NIGHT.AMBIENT_INTENSITY;
      ambientLight.color.setHex(CONFIG.LIGHTING.NIGHT.AMBIENT_COLOR);
      directionalLight.position.set(CONFIG.SUN.RADIUS, CONFIG.SUN.HEIGHT, 0);

      if (earthMesh?.material?.userData?.oceanShader) {
        earthMesh.material.userData.oceanShader.uniforms.uSunPosition.value.set(
          CONFIG.SUN.RADIUS * 0.25,
          CONFIG.SUN.HEIGHT,
          0
        );
      }
    }

    log.debug(`Cinematic Lights: ${currentMode.toUpperCase()}`);
  }
}

// ===== User Controls =====
function setupUserControls(container) {
  const onWheel = (e) => {
    mouseState.zoom -= e.deltaY * 0.01;
    mouseState.zoom = Math.max(CONFIG.CAMERA.ZOOM_MIN, Math.min(CONFIG.CAMERA.ZOOM_MAX, mouseState.zoom));
  };

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

  sunPositionVector = new THREE_INSTANCE.Vector3();

  function animate() {
    animationFrameId = requestAnimationFrame(animate);
    frameCount++;
    const elapsedTime = clock.getElapsedTime();
    const lerpFactor = CONFIG.CAMERA.LERP_FACTOR;

    if (cloudMesh && cloudMesh.rotation) {
      cloudMesh.rotation.y += CONFIG.CLOUDS.ROTATION_SPEED;
    }

    if (moonMesh && moonMesh.rotation) {
      moonMesh.rotation.y += CONFIG.MOON.ORBIT_SPEED;
    }

    if (directionalLight) {
      let sunAngle;

      if (CONFIG.DAY_NIGHT_CYCLE.ENABLED) {
        const cycleSpeed = CONFIG.SUN.ROTATION_SPEED * CONFIG.DAY_NIGHT_CYCLE.SPEED_MULTIPLIER;
        sunAngle = elapsedTime * cycleSpeed;
      } else {
        sunAngle = directionalLight.position.x !== 0
          ? Math.atan2(directionalLight.position.z, directionalLight.position.x)
          : 0;
      }

      const sunX = Math.cos(sunAngle) * CONFIG.SUN.RADIUS;
      const sunZ = Math.sin(sunAngle) * CONFIG.SUN.RADIUS;
      directionalLight.position.set(sunX, CONFIG.SUN.HEIGHT, sunZ);

      if (atmosphereMesh?.userData) {
        sunPositionVector.set(sunX, CONFIG.SUN.HEIGHT, sunZ);

        if (atmosphereMesh.userData.atmosphereMaterial) {
          atmosphereMesh.userData.atmosphereMaterial.uniforms.uSunPosition.value.copy(sunPositionVector);
        }
        if (atmosphereMesh.userData.rayleighMaterial) {
          atmosphereMesh.userData.rayleighMaterial.uniforms.uSunPosition.value.copy(sunPositionVector);
        }
      }

      if (CONFIG.DAY_NIGHT_CYCLE.ENABLED && earthMesh?.material?.userData?.oceanShader) {
        earthMesh.material.userData.oceanShader.uniforms.uSunPosition.value.set(
          sunX,
          CONFIG.SUN.HEIGHT,
          sunZ
        );
      }

      if (
        earthMesh &&
        earthMesh.userData.emissivePulseEnabled &&
        earthMesh.userData.currentMode === "night" &&
        earthMesh.material?.emissiveIntensity !== undefined &&
        frameCount % 2 === 0
      ) {
        const baseIntensity = CONFIG.EARTH.EMISSIVE_INTENSITY * 4.0;
        const pulseAmount =
          Math.sin(elapsedTime * CONFIG.EARTH.EMISSIVE_PULSE_SPEED) *
          CONFIG.EARTH.EMISSIVE_PULSE_AMPLITUDE * 2;

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
    const angleDiff = targetOrbitAngle - cameraOrbitAngle;

    const rawProgress = Math.min(Math.abs(angleDiff) / Math.PI, 1);
    const easedProgress = 1 - Math.pow(1 - rawProgress, 4);
    const easingFactor = 0.06 + easedProgress * 0.12;

    cameraOrbitAngle += angleDiff * easingFactor;

    cameraTarget.z = mouseState.zoom;
    const radius = mouseState.zoom;

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

    const adaptiveLerp = flightProgress > 0.15 ? lerpFactor * 1.8 : lerpFactor;
    cameraPosition.x += (finalX - cameraPosition.x) * adaptiveLerp;
    cameraPosition.y += (finalY - cameraPosition.y) * adaptiveLerp;
    cameraPosition.z += (finalZ - cameraPosition.z) * adaptiveLerp;
    camera.position.set(cameraPosition.x, cameraPosition.y, cameraPosition.z);

    const lookAtOffset = flightProgress * 0.5;
    camera.lookAt(lookAtOffset, 0, 0);

    if (directionalLight && earthMesh?.userData.currentMode === "day") {
      const sunX = Math.sin(cameraOrbitAngle) * CONFIG.SUN.RADIUS;
      const sunZ = Math.cos(cameraOrbitAngle) * CONFIG.SUN.RADIUS;
      directionalLight.position.set(sunX, CONFIG.SUN.HEIGHT, sunZ);

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
        const progress = Math.abs(rotDiff) / Math.PI;
        const easing = 1 - Math.pow(1 - Math.min(progress, 1), 3);
        const speed = 0.06 + easing * 0.06;
        earthMesh.rotation.y += rotDiff * speed;
      } else {
        earthMesh.rotation.y = earthMesh.userData.targetRotation;
      }
    }

    if (cloudMesh && earthMesh) {
      if (!cloudMesh.userData.lastSync) {
        cloudMesh.userData.lastSync = {
          position: new THREE_INSTANCE.Vector3(),
          scale: 0,
          rotationX: 0,
          rotationZ: 0,
        };
        cloudMesh.position.copy(earthMesh.position);
        cloudMesh.scale.copy(earthMesh.scale);
        cloudMesh.userData.lastSync.position.copy(earthMesh.position);
        cloudMesh.userData.lastSync.scale = earthMesh.scale.x;
        cloudMesh.userData.lastSync.rotationX = earthMesh.rotation.x;
        cloudMesh.userData.lastSync.rotationZ = earthMesh.rotation.z;
      }

      const lastSync = cloudMesh.userData.lastSync;

      const posDiff = earthMesh.position.distanceToSquared(lastSync.position);
      if (posDiff > 0.00001) {
        cloudMesh.position.copy(earthMesh.position);
        lastSync.position.copy(earthMesh.position);
      }

      if (Math.abs(earthMesh.scale.x - lastSync.scale) > 0.001) {
        cloudMesh.scale.copy(earthMesh.scale);
        lastSync.scale = earthMesh.scale.x;
      }

      if (Math.abs(earthMesh.rotation.x - lastSync.rotationX) > 0.001) {
        cloudMesh.rotation.x = earthMesh.rotation.x;
        lastSync.rotationX = earthMesh.rotation.x;
      }
      if (Math.abs(earthMesh.rotation.z - lastSync.rotationZ) > 0.001) {
        cloudMesh.rotation.z = earthMesh.rotation.z;
        lastSync.rotationZ = earthMesh.rotation.z;
      }
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
  sharedCleanupManager.addCleanupFunction("three-earth", resizeCleanup, "resize handler cleanup");
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

function showWebGLErrorMessage(container, error) {
  const errorDiv = document.createElement('div');
  errorDiv.className = 'three-earth-error';
  errorDiv.innerHTML = `
    <h3>WebGL Error</h3>
    <p>Die 3D-Visualisierung konnte nicht geladen werden.</p>
    <details>
      <summary>Technische Details</summary>
      <pre>${error.message}</pre>
    </details>
    <p>
      <small>Mögliche Lösungen:</small><br>
      • Browser aktualisieren<br>
      • Hardware-Beschleunigung aktivieren<br>
      • Anderen Browser verwenden
    </p>
  `;
  
  const existingError = container.querySelector('.three-earth-error');
  if (existingError) {
    existingError.remove();
  }
  
  container.appendChild(errorDiv);
}

// ===== Performance Monitor =====
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
    this.adjustQualityLevel();

    if (this.fps < 10 && currentQualityLevel !== "LOW") {
      log.error(`Critical FPS (${this.fps.toFixed(1)}), switching to LOW quality mode`);
      return;
    }

    if (this.fps < 10) {
      this.currentPixelRatio = 0.5;
      renderer.setPixelRatio(this.currentPixelRatio);
      log.error(`Critical FPS (${this.fps.toFixed(1)}), emergency pixel ratio reduction`);
      return;
    }

    if (this.fps < CONFIG.PERFORMANCE.DRS_DOWN_THRESHOLD && this.currentPixelRatio > 0.5) {
      this.currentPixelRatio = Math.max(0.5, this.currentPixelRatio - 0.15);
      renderer.setPixelRatio(this.currentPixelRatio);
      log.warn(`Low FPS (${this.fps.toFixed(1)}), reducing pixel ratio`);
    } else if (this.fps > CONFIG.PERFORMANCE.DRS_UP_THRESHOLD && this.currentPixelRatio < CONFIG.PERFORMANCE.PIXEL_RATIO) {
      this.currentPixelRatio = Math.min(CONFIG.PERFORMANCE.PIXEL_RATIO, this.currentPixelRatio + 0.05);
      renderer.setPixelRatio(this.currentPixelRatio);
      log.info(`Good FPS (${this.fps.toFixed(1)}), increasing pixel ratio`);
    }
  }

  adjustQualityLevel() {
    const prevLevel = currentQualityLevel;

    if (this.fps < CONFIG.QUALITY_LEVELS.MEDIUM.minFPS) {
      currentQualityLevel = "LOW";
    } else if (this.fps < CONFIG.QUALITY_LEVELS.HIGH.minFPS) {
      currentQualityLevel = "MEDIUM";
    } else {
      currentQualityLevel = "HIGH";
    }

    if (prevLevel !== currentQualityLevel) {
      log.warn(`Quality level changed: ${prevLevel} → ${currentQualityLevel} (FPS: ${this.fps.toFixed(1)})`);
      this.applyQualitySettings();
    }
  }

  applyQualitySettings() {
    const features = CONFIG.QUALITY_LEVELS[currentQualityLevel].features;

    if (rayleighAtmosphereMesh) {
      rayleighAtmosphereMesh.visible = features.multiLayerAtmosphere;
      log.debug(`Multi-Layer Atmosphere: ${features.multiLayerAtmosphere ? "ON" : "OFF"}`);
    }

    if (cloudMesh) {
      cloudMesh.visible = features.cloudLayer;
      log.debug(`Cloud Layer: ${features.cloudLayer ? "ON" : "OFF"}`);
    }

    if (earthMesh?.material?.userData?.oceanShader) {
      earthMesh.material.userData.oceanShader.uniforms.uOceanSpecularIntensity.value =
        features.oceanReflections ? CONFIG.OCEAN.SPECULAR_INTENSITY : 0.0;
      log.debug(`Ocean Reflections: ${features.oceanReflections ? "ON" : "OFF"}`);
    }

    if (earthMesh?.userData?.emissivePulseEnabled !== undefined) {
      earthMesh.userData.emissivePulseEnabled = features.cityLightsPulse;
      log.debug(`City Lights Pulse: ${features.cityLightsPulse ? "ON" : "OFF"}`);
    }

    if (shootingStarManager) {
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

export const EarthSystemAPI = {
  flyToPreset: (presetName) => {
    if (typeof flyToPreset === "function") {
      flyToPreset(presetName);
    } else {
      log.warn("Earth system not initialized");
    }
  },

  setDayNightCycle: (enabled, speedMultiplier = 10) => {
    CONFIG.DAY_NIGHT_CYCLE.ENABLED = enabled;
    CONFIG.DAY_NIGHT_CYCLE.SPEED_MULTIPLIER = speedMultiplier;
    log.info(`Day/Night cycle ${enabled ? "enabled" : "disabled"} (speed: ${speedMultiplier}x)`);
  },

  triggerMeteorShower: () => {
    if (shootingStarManager) {
      shootingStarManager.triggerMeteorShower();
    } else {
      log.warn("ShootingStarManager not initialized");
    }
  },

  getConfig: () => CONFIG,

  updateConfig: (updates) => {
    Object.assign(CONFIG, updates);
    log.info("Configuration updated", updates);
  },
};

export default ThreeEarthManager;