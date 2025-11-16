/**
 * Three.js Earth System - Optimized 3D WebGL Earth Visualization
 * Lightweight cleanup and documentation update.
 * @version 8.2.3
 * @last-modified 2025-11-08
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

const log = createLogger('threeEarthSystem');
const earthTimers = new TimerManager();

// ===== OPTIMIZED CONFIGURATION =====

const CONFIG = {
  EARTH: {
    RADIUS: 3.5,
    SEGMENTS: 64,
    BUMP_SCALE: 0.008,
    EMISSIVE_INTENSITY: 0.2,
    EMISSIVE_PULSE_SPEED: 0.3,
    EMISSIVE_PULSE_AMPLITUDE: 0.08
  },
  CLOUDS: {
    ALTITUDE: 0.03,
    ROTATION_SPEED: 0.0008,
    OPACITY: 0.3
  },
  ATMOSPHERE: {
    SCALE: 1.015,
    FRESNEL_POWER: 4.5,
    RAYLEIGH_SCALE: 1.028,
    MIE_SCALE: 1.018,
    RAYLEIGH_COLOR: 0x4488ff,
    MIE_COLOR: 0xffbb66,
    RAYLEIGH_INTENSITY: 0.08,
    MIE_INTENSITY: 0.04,
    SCATTERING_STRENGTH: 0.18
  },
  OCEAN: {
    SHININESS: 100.0,
    SPECULAR_INTENSITY: 0.5,
    SPECULAR_COLOR: 0xffffff
  },
  SUN: {
    RADIUS: 15,
    HEIGHT: 3.0,
    INTENSITY: 1.8
  },
  LIGHTING: {
    DAY: {
      AMBIENT_INTENSITY: 1.4,
      AMBIENT_COLOR: 0x606060,
      SUN_INTENSITY: 1.8
    },
    NIGHT: {
      AMBIENT_INTENSITY: 0.3,
      AMBIENT_COLOR: 0x202845,
      SUN_INTENSITY: 0.35
    }
  },
  STARS: {
    COUNT: 3000,
    TWINKLE_SPEED: 0.3,
    ANIMATION: {
      DURATION: 3500,
      CAMERA_SETTLE_DELAY: 2200,
      MIN_UPDATE_INTERVAL: 100,
      CARD_FADE_START: 0.7,
      CARD_FADE_END: 0.95,
      SPREAD_XY: 0.6,
      SPREAD_Z: 0.3,
      LERP_FACTOR: 0.08
    }
  },
  MOON: {
    RADIUS: 0.95,
    DISTANCE: 25,
    ORBIT_SPEED: 0.00025,
    SEGMENTS: 48,
    BUMP_SCALE: 0.015
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
        lookAt: { x: 0, y: -0.5, z: 0 }
      },
      features: {
        x: 7.0,
        y: 5.5,
        z: 7.5,
        lookAt: { x: 0, y: 0.5, z: 0 }
      },
      about: {
        x: -3.2,
        y: 3.0,
        z: 9.5,
        lookAt: { x: 0, y: 0, z: 0 }
      }
    },
    TRANSITION_DURATION: 1.8
  },
  SHOOTING_STARS: {
    BASE_FREQUENCY: 0.003,
    SHOWER_FREQUENCY: 0.02,
    SHOWER_DURATION: 180,
    SHOWER_COOLDOWN: 1200,
    MAX_SIMULTANEOUS: 3
  },
  PERFORMANCE: {
    PIXEL_RATIO: Math.min(window.devicePixelRatio, 2.0),
    TARGET_FPS: 55,
    DRS_DOWN_THRESHOLD: 48,
    DRS_UP_THRESHOLD: 58
  },
  QUALITY_LEVELS: {
    HIGH: {
      minFPS: 48,
      multiLayerAtmosphere: true,
      oceanReflections: true,
      cloudLayer: true,
      meteorShowers: true
    },
    MEDIUM: {
      minFPS: 28,
      multiLayerAtmosphere: false,
      oceanReflections: true,
      cloudLayer: true,
      meteorShowers: true
    },
    LOW: {
      minFPS: 0,
      multiLayerAtmosphere: false,
      oceanReflections: false,
      cloudLayer: false,
      meteorShowers: false
    }
  },
  PATHS: {
    TEXTURES: {
      DAY: '/content/img/earth/textures/earth_day.webp',
      NIGHT: '/content/img/earth/textures/earth_night.webp',
      NORMAL: '/content/img/earth/textures/earth_normal.webp',
      BUMP: '/content/img/earth/textures/earth_bump.webp',
      CLOUDS: '/content/img/earth/textures/earth_clouds_1024.png',
      MOON: '/content/img/earth/textures/moon_texture.webp',
      MOON_BUMP: '/content/img/earth/textures/moon_bump.webp'
    }
  }
};

// ===== Global State =====

let scene, camera, renderer, earthMesh, moonMesh, starField, cloudMesh, atmosphereMesh;
let directionalLight, ambientLight, THREE_INSTANCE;
let dayMaterial, nightMaterial;
let sectionObserver, animationFrameId;
let currentSection = 'hero';
let currentQualityLevel = 'HIGH';
let isMobileDevice = false;
let frameCount = 0;
let performanceMonitor, shootingStarManager;
// Timestamp of the last explicit mode switch (ms since epoch). Used to
// debounce successive toggles when the user scrolls quickly.
let _lastModeSwitchAt = 0;
const _MODE_SWITCH_DEBOUNCE_MS = 700;

const cameraTarget = { x: 0, y: 0, z: 10 };
const cameraPosition = { x: 0, y: 0, z: 10 };
const mouseState = { zoom: 10 };
let cameraOrbitAngle = 0;
let targetOrbitAngle = 0;

// Star animation state
let starOriginalPositions = null;
let starTargetPositions = null;
let starAnimationState = {
  active: false,
  rafId: null,
  lastUpdateTime: 0,
  startTime: 0,
  positionsUpdated: false,
  updateScheduled: false
};

// ===== Shooting Star Manager (Integrated) =====

class ShootingStarManager {
  constructor(scene, THREE) {
    this.scene = scene;
    this.THREE = THREE;
    this.activeStars = [];
    this.isShowerActive = false;
    this.showerTimer = 0;
    this.showerCooldownTimer = 0;
    this.disabled = false;
  }

  createShootingStar() {
    if (this.activeStars.length >= CONFIG.SHOOTING_STARS.MAX_SIMULTANEOUS) return;

    try {
      const geometry = new this.THREE.SphereGeometry(0.05, 8, 8);
      const material = new this.THREE.MeshBasicMaterial({
        color: 0xfffdef,
        transparent: true,
        opacity: 1.0
      });
      const star = new this.THREE.Mesh(geometry, material);

      const startPos = {
        x: (Math.random() - 0.5) * 100,
        y: 20 + Math.random() * 20,
        z: -50 - Math.random() * 50
      };
      const velocity = new this.THREE.Vector3(
        (Math.random() - 0.9) * 0.2,
        (Math.random() - 0.6) * -0.2,
        0
      );

      star.position.set(startPos.x, startPos.y, startPos.z);
      star.scale.set(1, 1, 2 + Math.random() * 3);
      star.lookAt(star.position.clone().add(velocity));

      this.activeStars.push({
        mesh: star,
        velocity,
        lifetime: 300 + Math.random() * 200,
        age: 0
      });

      this.scene.add(star);
    } catch (error) {
      log.error('Failed to create shooting star:', error);
    }
  }

  update() {
    if (this.disabled) return;

    // Shower logic
    if (this.isShowerActive) {
      this.showerTimer++;
      if (this.showerTimer >= CONFIG.SHOOTING_STARS.SHOWER_DURATION) {
        this.isShowerActive = false;
        this.showerCooldownTimer = CONFIG.SHOOTING_STARS.SHOWER_COOLDOWN;
      }
    }

    if (this.showerCooldownTimer > 0) {
      this.showerCooldownTimer--;
    }

    // Spawn new stars
    const spawnChance = this.isShowerActive
      ? CONFIG.SHOOTING_STARS.SHOWER_FREQUENCY
      : CONFIG.SHOOTING_STARS.BASE_FREQUENCY;

    if (Math.random() < spawnChance) {
      this.createShootingStar();
    }

    // Update existing stars
    for (let i = this.activeStars.length - 1; i >= 0; i--) {
      const star = this.activeStars[i];
      star.age++;
      star.mesh.position.add(star.velocity);

      // Fade out
      const fadeStart = star.lifetime * 0.7;
      if (star.age > fadeStart) {
        const fadeProgress = (star.age - fadeStart) / (star.lifetime - fadeStart);
        star.mesh.material.opacity = 1 - fadeProgress;
      }

      // Remove dead stars
      if (star.age > star.lifetime) {
        this.scene.remove(star.mesh);
        star.mesh.geometry.dispose();
        star.mesh.material.dispose();
        this.activeStars.splice(i, 1);
      }
    }
  }

  triggerShower() {
    if (this.isShowerActive || this.showerCooldownTimer > 0) return;
    this.isShowerActive = true;
    this.showerTimer = 0;
    log.info('🌠 Meteor shower triggered!');
  }

  cleanup() {
    this.activeStars.forEach((star) => {
      this.scene.remove(star.mesh);
      star.mesh.geometry?.dispose();
      star.mesh.material?.dispose();
    });
    this.activeStars = [];
  }
}

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
      log.info('Initializing Three.js Earth System v8.2.1');
      registerParticleSystem('three-earth', { type: 'three-earth' });

      THREE_INSTANCE = await loadThreeJS();
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

    performanceMonitor?.cleanup();
    shootingStarManager?.cleanup();
    sectionObserver?.disconnect();
    earthTimers.clearAll();
    sharedCleanupManager.cleanupSystem('three-earth');

    if (scene) {
      scene.traverse(disposeObject);
      while (scene.children.length > 0) {
        scene.remove(scene.children[0]);
      }
    }

    if (renderer) {
      renderer.dispose();
      renderer.forceContextLoss();
    }

    [dayMaterial, nightMaterial].forEach(disposeMaterial);

    // Reset all state
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
        null;
    dayMaterial = nightMaterial = null;
    currentSection = 'hero';
    frameCount = 0;
    starOriginalPositions = starTargetPositions = null;
    starAnimationState = {
      active: false,
      rafId: null,
      startTime: 0,
      positionsUpdated: false,
      updateScheduled: false
    };

    unregisterParticleSystem('three-earth');
    log.info('Cleanup complete');
  };

  function disposeObject(obj) {
    obj.geometry?.dispose();
    if (Array.isArray(obj.material)) {
      obj.material.forEach(disposeMaterial);
    } else {
      disposeMaterial(obj.material);
    }
  }

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
    showErrorState(container, error);
  }

  return { initThreeEarth, cleanup };
})();

// ===== Scene Setup =====

async function setupScene(container) {
  isMobileDevice = window.matchMedia('(max-width: 768px)').matches;

  scene = new THREE_INSTANCE.Scene();

  const aspectRatio = container.clientWidth / container.clientHeight;
  camera = new THREE_INSTANCE.PerspectiveCamera(
    CONFIG.CAMERA.FOV,
    aspectRatio,
    CONFIG.CAMERA.NEAR,
    CONFIG.CAMERA.FAR
  );

  renderer = new THREE_INSTANCE.WebGLRenderer({
    canvas: container.querySelector('canvas') || undefined,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance'
  });

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
}

// ===== Starfield =====

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
  starGeometry.setAttribute('position', new THREE_INSTANCE.BufferAttribute(positions, 3));
  starGeometry.setAttribute('color', new THREE_INSTANCE.BufferAttribute(colors, 3));
  starGeometry.setAttribute('size', new THREE_INSTANCE.BufferAttribute(sizes, 1));

  const starMaterial = new THREE_INSTANCE.ShaderMaterial({
    uniforms: {
      time: { value: 0.0 },
      twinkleSpeed: { value: CONFIG.STARS.TWINKLE_SPEED }
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
    vertexColors: true
  });

  starField = new THREE_INSTANCE.Points(starGeometry, starMaterial);
  scene.add(starField);

  starOriginalPositions = new Float32Array(positions);
  log.info(`Starfield created: ${starCount} stars`);
}

function setupStarParallax() {
  const parallaxHandler = (progress) => {
    if (!starField || starAnimationState.active) return;
    starField.rotation.y = progress * Math.PI * 0.2;
    starField.position.z = Math.sin(progress * Math.PI) * 15;
  };
  sharedParallaxManager.addHandler(parallaxHandler, 'three-earth-stars');
}

// ===== Star Animation =====

function getCardPositions() {
  if (!camera) return [];

  const featuresSection = getElementById('features');
  if (!featuresSection) return [];

  const cards = featuresSection.querySelectorAll('.card');
  const positions = [];

  if (cards.length === 0) {
    // Fallback grid
    for (let i = 0; i < 9; i++) {
      const row = Math.floor(i / 3);
      const col = i % 3;
      positions.push({
        x: (col - 1) * 8,
        y: (1 - row) * 6 + 2,
        z: -2
      });
    }
    return positions;
  }

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  cards.forEach((card) => {
    const rect = card.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > viewportHeight) return;

    const ndcX = ((rect.left + rect.width / 2) / viewportWidth) * 2 - 1;
    const ndcY = -(((rect.top + rect.height / 2) / viewportHeight) * 2 - 1);

    const targetZ = -2;
    const vector = new THREE_INSTANCE.Vector3(ndcX, ndcY, 0);
    vector.unproject(camera);

    const direction = vector.sub(camera.position).normalize();
    const distance = (targetZ - camera.position.z) / direction.z;
    const worldPos = camera.position.clone().add(direction.multiplyScalar(distance));

    positions.push({ x: worldPos.x, y: worldPos.y, z: targetZ });
  });

  return positions;
}

function animateStarsToCards() {
  if (!starField || !starOriginalPositions || starAnimationState.active) {
    return;
  }

  // Hide cards initially
  const cards = document.querySelectorAll('#features .card');
  cards.forEach((card) => {
    card.style.transition = 'none';
    card.style.opacity = '0';
  });

  starAnimationState.active = true;
  starAnimationState.startTime = performance.now();
  starAnimationState.positionsUpdated = false;
  starAnimationState.updateScheduled = false;

  const initialPositions = getCardPositions();
  if (initialPositions.length === 0) {
    starAnimationState.active = false;
    return;
  }

  const positions = starField.geometry.attributes.position.array;
  const starCount = positions.length / 3;
  starTargetPositions = new Float32Array(starCount * 3);

  const calculateTargets = (cardPositions) => {
    const cfg = CONFIG.STARS.ANIMATION;
    for (let i = 0; i < starCount; i++) {
      const i3 = i * 3;
      const targetCard = cardPositions[i % cardPositions.length];

      starTargetPositions[i3] = targetCard.x + (Math.random() - 0.5) * cfg.SPREAD_XY;
      starTargetPositions[i3 + 1] = targetCard.y + (Math.random() - 0.5) * cfg.SPREAD_XY;
      starTargetPositions[i3 + 2] = targetCard.z + (Math.random() - 0.5) * cfg.SPREAD_Z;
    }
  };

  calculateTargets(initialPositions);

  // Update positions after camera stabilizes
  setTimeout(() => {
    if (starAnimationState.active && !starAnimationState.positionsUpdated) {
      const updatedPositions = getCardPositions();
      if (updatedPositions.length > 0) {
        calculateTargets(updatedPositions);
        starAnimationState.positionsUpdated = true;
      }
    }
  }, CONFIG.STARS.ANIMATION.CAMERA_SETTLE_DELAY);

  animateStarTransformation(cards);
}

function animateStarTransformation(cards) {
  const cfg = CONFIG.STARS.ANIMATION;

  function animate() {
    if (!starAnimationState.active || !starField || !starTargetPositions) {
      starAnimationState.active = false;
      return;
    }

    const elapsed = performance.now() - starAnimationState.startTime;
    const progress = Math.min(elapsed / cfg.DURATION, 1);
    const eased = easeInOutCubic(progress);

    const positions = starField.geometry.attributes.position.array;
    const starCount = positions.length / 3;

    for (let i = 0; i < starCount; i++) {
      const i3 = i * 3;
      const targetX =
        starOriginalPositions[i3] + (starTargetPositions[i3] - starOriginalPositions[i3]) * eased;
      const targetY =
        starOriginalPositions[i3 + 1] +
        (starTargetPositions[i3 + 1] - starOriginalPositions[i3 + 1]) * eased;
      const targetZ =
        starOriginalPositions[i3 + 2] +
        (starTargetPositions[i3 + 2] - starOriginalPositions[i3 + 2]) * eased;

      positions[i3] += (targetX - positions[i3]) * cfg.LERP_FACTOR;
      positions[i3 + 1] += (targetY - positions[i3 + 1]) * cfg.LERP_FACTOR;
      positions[i3 + 2] += (targetZ - positions[i3 + 2]) * cfg.LERP_FACTOR;
    }

    starField.geometry.attributes.position.needsUpdate = true;

    // Fade in cards
    if (progress >= cfg.CARD_FADE_START && progress <= cfg.CARD_FADE_END) {
      const fadeProgress =
        (progress - cfg.CARD_FADE_START) / (cfg.CARD_FADE_END - cfg.CARD_FADE_START);
      const cardOpacity = easeInOutCubic(fadeProgress);
      cards.forEach((card) => (card.style.opacity = cardOpacity.toString()));
    } else if (progress > cfg.CARD_FADE_END) {
      cards.forEach((card) => (card.style.opacity = '1'));
    }

    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      starAnimationState.active = false;
      cards.forEach((card) => (card.style.transition = ''));
      log.info('Star transformation complete');
    }
  }

  animate();
}

function resetStarsToOriginal() {
  if (!starField || !starOriginalPositions) return;

  starAnimationState.active = false;
  starAnimationState.positionsUpdated = false;
  starAnimationState.updateScheduled = false;

  const cards = document.querySelectorAll('#features .card');
  cards.forEach((card) => {
    card.style.opacity = '0';
    card.style.transition = 'opacity 0.5s ease';
  });

  const positions = starField.geometry.attributes.position.array;
  positions.set(starOriginalPositions);
  starField.geometry.attributes.position.needsUpdate = true;

  starTargetPositions = null;
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// ===== Lighting =====

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

// ===== Earth System =====

async function createEarthSystem() {
  const loadingManager = new THREE_INSTANCE.LoadingManager();
  loadingManager.onProgress = (url, itemsLoaded, itemsTotal) => {
    const progress = itemsLoaded / itemsTotal;
    showLoadingState(document.getElementById('threeEarthContainer'), progress);
  };
  loadingManager.onLoad = () => {
    setTimeout(() => hideLoadingState(document.getElementById('threeEarthContainer')), 500);
  };

  const textureLoader = new THREE_INSTANCE.TextureLoader(loadingManager);

  const [dayTexture, nightTexture, normalTexture, bumpTexture] = await Promise.all([
    textureLoader.loadAsync(CONFIG.PATHS.TEXTURES.DAY),
    textureLoader.loadAsync(CONFIG.PATHS.TEXTURES.NIGHT),
    textureLoader.loadAsync(CONFIG.PATHS.TEXTURES.NORMAL),
    textureLoader.loadAsync(CONFIG.PATHS.TEXTURES.BUMP)
  ]);

  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  [dayTexture, nightTexture, normalTexture, bumpTexture].forEach((tex) => {
    if (tex) tex.anisotropy = Math.min(maxAniso, isMobileDevice ? 4 : 16);
  });

  dayMaterial = new THREE_INSTANCE.MeshStandardMaterial({
    map: dayTexture,
    normalMap: normalTexture,
    bumpMap: bumpTexture,
    bumpScale: CONFIG.EARTH.BUMP_SCALE,
    roughness: 0.7,
    metalness: 0.0
  });

  nightMaterial = new THREE_INSTANCE.MeshStandardMaterial({
    map: dayTexture,
    normalMap: normalTexture,
    bumpMap: bumpTexture,
    bumpScale: CONFIG.EARTH.BUMP_SCALE,
    roughness: 0.7,
    metalness: 0.0,
    emissive: 0xffcc66,
    emissiveMap: nightTexture,
    emissiveIntensity: CONFIG.EARTH.EMISSIVE_INTENSITY * 4.0
  });

  const earthGeometry = new THREE_INSTANCE.SphereGeometry(
    CONFIG.EARTH.RADIUS,
    CONFIG.EARTH.SEGMENTS,
    CONFIG.EARTH.SEGMENTS
  );
  earthMesh = new THREE_INSTANCE.Mesh(earthGeometry, dayMaterial);
  earthMesh.position.set(0, -6.0, 0);
  earthMesh.scale.set(1.5, 1.5, 1.5);
  earthMesh.userData.currentMode = 'day';
  earthMesh.userData.targetPosition = new THREE_INSTANCE.Vector3(0, -6.0, 0);
  earthMesh.userData.targetScale = 1.5;
  earthMesh.userData.targetRotation = 0;

  scene.add(earthMesh);
}

// ===== Moon System =====

async function createMoonSystem() {
  const textureLoader = new THREE_INSTANCE.TextureLoader();

  const [moonTexture, moonBumpTexture] = await Promise.all([
    textureLoader.loadAsync(CONFIG.PATHS.TEXTURES.MOON).catch(() => null),
    textureLoader.loadAsync(CONFIG.PATHS.TEXTURES.MOON_BUMP).catch(() => null)
  ]);

  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  if (moonTexture) moonTexture.anisotropy = Math.min(maxAniso, isMobileDevice ? 4 : 16);
  if (moonBumpTexture) moonBumpTexture.anisotropy = Math.min(maxAniso, isMobileDevice ? 4 : 16);

  const moonMaterial = new THREE_INSTANCE.MeshStandardMaterial({
    map: moonTexture,
    bumpMap: moonBumpTexture,
    bumpScale: CONFIG.MOON.BUMP_SCALE,
    roughness: 0.9,
    metalness: 0.0,
    color: moonTexture ? 0xffffff : 0xaaaaaa
  });

  const moonLOD = new THREE_INSTANCE.LOD();

  // High detail
  const moonGeometryHigh = new THREE_INSTANCE.SphereGeometry(
    CONFIG.MOON.RADIUS,
    CONFIG.MOON.SEGMENTS,
    CONFIG.MOON.SEGMENTS
  );
  moonLOD.addLevel(new THREE_INSTANCE.Mesh(moonGeometryHigh, moonMaterial), 0);

  // Medium detail
  const moonGeometryMed = new THREE_INSTANCE.SphereGeometry(CONFIG.MOON.RADIUS, 28, 28);
  moonLOD.addLevel(new THREE_INSTANCE.Mesh(moonGeometryMed, moonMaterial), 15);

  // Low detail
  const moonGeometryLow = new THREE_INSTANCE.SphereGeometry(CONFIG.MOON.RADIUS, 16, 16);
  moonLOD.addLevel(new THREE_INSTANCE.Mesh(moonGeometryLow, moonMaterial), 40);

  moonLOD.position.set(CONFIG.MOON.DISTANCE, 2, -10);
  moonLOD.userData.targetPosition = new THREE_INSTANCE.Vector3(CONFIG.MOON.DISTANCE, 2, -10);
  moonLOD.userData.targetScale = 1.0;

  scene.add(moonLOD);
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
      side: THREE_INSTANCE.DoubleSide
    });

    const cloudGeometry = new THREE_INSTANCE.SphereGeometry(
      CONFIG.EARTH.RADIUS + CONFIG.CLOUDS.ALTITUDE,
      CONFIG.EARTH.SEGMENTS,
      CONFIG.EARTH.SEGMENTS
    );
    return new THREE_INSTANCE.Mesh(cloudGeometry, cloudMaterial);
  } catch (error) {
    log.warn('Cloud texture failed to load:', error);
    return new THREE_INSTANCE.Object3D();
  }
}

// ===== Atmosphere =====

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
    }
  `;

  const fragmentShader = `
    varying vec3 vNormal;
    varying vec3 vWorldPosition;
    uniform vec3 uRayleighColor;
    uniform vec3 uMieColor;
    uniform float uPower;
    uniform float uRayleighIntensity;
    uniform float uMieIntensity;
    uniform float uScatteringStrength;
    
    void main() {
      vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
      float fresnel = pow(1.0 - abs(dot(vNormal, viewDirection)), uPower);
      
      vec3 rayleighScatter = uRayleighColor * fresnel * uRayleighIntensity;
      vec3 mieScatter = uMieColor * fresnel * uMieIntensity;
      
      vec3 finalColor = (rayleighScatter + mieScatter) * uScatteringStrength;
      float alpha = fresnel * (uRayleighIntensity + uMieIntensity * 0.5);
      
      gl_FragColor = vec4(finalColor, alpha);
    }
  `;

  const atmosphereMaterial = new THREE_INSTANCE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uRayleighColor: { value: new THREE_INSTANCE.Color(CONFIG.ATMOSPHERE.RAYLEIGH_COLOR) },
      uMieColor: { value: new THREE_INSTANCE.Color(CONFIG.ATMOSPHERE.MIE_COLOR) },
      uPower: { value: CONFIG.ATMOSPHERE.FRESNEL_POWER },
      uRayleighIntensity: { value: CONFIG.ATMOSPHERE.RAYLEIGH_INTENSITY },
      uMieIntensity: { value: CONFIG.ATMOSPHERE.MIE_INTENSITY },
      uScatteringStrength: { value: CONFIG.ATMOSPHERE.SCATTERING_STRENGTH }
    },
    blending: THREE_INSTANCE.AdditiveBlending,
    transparent: true,
    side: THREE_INSTANCE.BackSide,
    depthWrite: false
  });

  const atmosphere = new THREE_INSTANCE.Mesh(
    new THREE_INSTANCE.SphereGeometry(
      CONFIG.EARTH.RADIUS * CONFIG.ATMOSPHERE.SCALE,
      CONFIG.EARTH.SEGMENTS,
      CONFIG.EARTH.SEGMENTS
    ),
    atmosphereMaterial
  );

  return atmosphere;
}

// ===== Camera System =====

function setupCameraSystem() {
  updateCameraForSection('hero');
}

let cameraTransition = null;

function updateCameraForSection(sectionName) {
  const preset = CONFIG.CAMERA.PRESETS[sectionName];
  if (preset) {
    flyToPreset(sectionName);
  } else {
    log.warn(`No preset for '${sectionName}', using hero`);
    flyToPreset('hero');
  }
}

function flyToPreset(presetName) {
  const preset = CONFIG.CAMERA.PRESETS[presetName];
  if (!preset) return;

  if (cameraTransition) {
    earthTimers.clearTimeout(cameraTransition);
    cameraTransition = null;
  }

  const startPos = { ...cameraTarget };
  const startZoom = mouseState.zoom;
  const startLookAt = camera.userData.currentLookAt || new THREE_INSTANCE.Vector3(0, 0, 0);
  const endLookAt = new THREE_INSTANCE.Vector3(preset.lookAt.x, preset.lookAt.y, preset.lookAt.z);

  const duration = CONFIG.CAMERA.TRANSITION_DURATION * 1000;
  const startTime = performance.now();

  function transitionStep() {
    const elapsed = performance.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased =
      progress < 0.5
        ? 8 * progress * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 4) / 2;

    cameraTarget.x = startPos.x + (preset.x - startPos.x) * eased;
    cameraTarget.y = startPos.y + (preset.y - startPos.y) * eased;
    mouseState.zoom = startZoom + (preset.z - startZoom) * eased;

    if (camera) {
      const blendedLookAt = new THREE_INSTANCE.Vector3().lerpVectors(startLookAt, endLookAt, eased);
      camera.lookAt(blendedLookAt);
      camera.userData.currentLookAt = blendedLookAt.clone();
    }

    if (progress < 1) {
      cameraTransition = earthTimers.setTimeout(transitionStep, 16);
    } else {
      cameraTransition = null;
      if (camera) camera.userData.currentLookAt = endLookAt.clone();
    }
  }

  transitionStep();
}

// ===== Section Detection =====

function setupSectionDetection() {
  // Section selector extended to include the footer trigger zone
  const sections = Array.from(document.querySelectorAll('section[id], div#footer-trigger-zone'));
  if (sections.length === 0) return;

  // Helper to map DOM id to logical section id
  const mapId = (id) => (id === 'footer-trigger-zone' ? 'site-footer' : id);

  const OBSERVER_THRESHOLDS = Array.from({ length: 21 }, (_, i) => i / 20);

  sectionObserver = new IntersectionObserver(
    (entries) => {
      // Determine the entry with the largest intersectionRatio (most visible)
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

          // Kamera- und Layout-Updates immer durchführen
          updateCameraForSection(newSection);

          // Modus (Tag/Nacht) NUR wechseln, wenn die Navigation in eine
          // Richtung geht: von 'features' (Sektion 2) nach 'about' (Sektion 3).
          // Rückwärts-Scroll (about -> features) löst keinen Moduswechsel aus.
          const isFeaturesToAbout = previousSection === 'features' && newSection === 'about';

          updateEarthForSection(newSection, { allowModeSwitch: isFeaturesToAbout });

          if (newSection === 'features') {
            animateStarsToCards();
          } else if (previousSection === 'features') {
            resetStarsToOriginal();
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
      // Sektor 3
      earth: { pos: { x: -1, y: -0.5, z: -1 }, scale: 1.0, rotation: Math.PI },
      moon: { pos: { x: -45, y: -45, z: -90 }, scale: 0.4 },
      mode: 'night'
    },
    contact: {
      // Sektor 4 (für site-footer)
      earth: { pos: { x: 0, y: -1.5, z: 0 }, scale: 1.1, rotation: Math.PI / 2 },
      moon: { pos: { x: -45, y: -45, z: -90 }, scale: 0.4 },
      mode: 'day'
    }
  };

  // Map 'site-footer' to the 'contact' config
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

  // Removed previous toggle logic; 'about' uses a fixed mode defined in config.
  const _targetMode = config.mode;

  // Only switch day/night when explicitly allowed (e.g. scrolling from
  // 'features' to 'about'). To allow repeating the visual change on every
  // such transition (user reported it only switched once), we toggle the
  // current mode on each allowed transition instead of skipping when the
  // mode already equals the target.
  if (allowModeSwitch) {
    // Toggle mode each time the condition is met
    const newMode = earthMesh.userData.currentMode === 'night' ? 'day' : 'night';
    earthMesh.material = newMode === 'day' ? dayMaterial : nightMaterial;
    earthMesh.material.needsUpdate = true;
    earthMesh.userData.currentMode = newMode;

    targetOrbitAngle = newMode === 'day' ? 0 : Math.PI;
  }

  // Update lighting
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

// ===== User Controls =====

function setupUserControls(container) {
  const onWheel = (e) => {
    mouseState.zoom -= e.deltaY * 0.01;
    mouseState.zoom = Math.max(
      CONFIG.CAMERA.ZOOM_MIN,
      Math.min(CONFIG.CAMERA.ZOOM_MAX, mouseState.zoom)
    );
  };

  container.addEventListener('wheel', onWheel, { passive: true });

  sharedCleanupManager.addCleanupFunction(
    'three-earth',
    () => container.removeEventListener('wheel', onWheel),
    'wheel control'
  );
}

// ===== Animation Loop =====

function startAnimationLoop() {
  const clock = new THREE_INSTANCE.Clock();

  function animate() {
    animationFrameId = requestAnimationFrame(animate);
    frameCount++;
    const elapsedTime = clock.getElapsedTime();

    // Update rotations
    if (cloudMesh) cloudMesh.rotation.y += CONFIG.CLOUDS.ROTATION_SPEED;
    if (moonMesh) moonMesh.rotation.y += CONFIG.MOON.ORBIT_SPEED;

    // Update starfield
    if (starField) starField.material.uniforms.time.value = elapsedTime;

    // Emissive pulse for night mode
    if (earthMesh?.userData.currentMode === 'night' && frameCount % 2 === 0) {
      const baseIntensity = CONFIG.EARTH.EMISSIVE_INTENSITY * 4.0;
      const pulseAmount =
        Math.sin(elapsedTime * CONFIG.EARTH.EMISSIVE_PULSE_SPEED) *
        CONFIG.EARTH.EMISSIVE_PULSE_AMPLITUDE *
        2;
      earthMesh.material.emissiveIntensity = baseIntensity + pulseAmount;
    }

    updateCameraPosition();
    updateObjectTransforms();

    if (shootingStarManager) shootingStarManager.update();
    if (performanceMonitor) performanceMonitor.update();

    renderer.render(scene, camera);
  }

  function updateCameraPosition() {
    const lerpFactor = CONFIG.CAMERA.LERP_FACTOR;
    const angleDiff = targetOrbitAngle - cameraOrbitAngle;
    const progress = Math.min(Math.abs(angleDiff) / Math.PI, 1);
    const eased = 1 - Math.pow(1 - progress, 4);
    const easingFactor = 0.06 + eased * 0.12;

    cameraOrbitAngle += angleDiff * easingFactor;

    const radius = mouseState.zoom;
    const finalX = cameraTarget.x + Math.sin(cameraOrbitAngle) * radius * 0.75;
    const finalY = cameraTarget.y;
    const finalZ = Math.cos(cameraOrbitAngle) * radius;

    cameraPosition.x += (finalX - cameraPosition.x) * lerpFactor;
    cameraPosition.y += (finalY - cameraPosition.y) * lerpFactor;
    cameraPosition.z += (finalZ - cameraPosition.z) * lerpFactor;
    camera.position.set(cameraPosition.x, cameraPosition.y, cameraPosition.z);

    camera.lookAt(0, 0, 0);
  }

  function updateObjectTransforms() {
    if (!earthMesh) return;

    // Earth position and scale
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

    // Earth rotation
    if (earthMesh.userData.targetRotation !== undefined) {
      const rotDiff = earthMesh.userData.targetRotation - earthMesh.rotation.y;
      if (Math.abs(rotDiff) > 0.001) {
        earthMesh.rotation.y += rotDiff * 0.06;
      }
    }

    // Cloud sync
    if (cloudMesh && earthMesh) {
      cloudMesh.position.copy(earthMesh.position);
      cloudMesh.scale.copy(earthMesh.scale);
    }

    // Moon position and scale
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

// ===== UI State =====

function showLoadingState(container, progress) {
  container?.classList.add('loading');
  const loadingElement = container?.querySelector('.three-earth-loading');
  if (loadingElement) loadingElement.classList.remove('hidden');
  const progressBar = container?.querySelector('.loading-progress-bar');
  const progressText = container?.querySelector('.loading-progress-text');
  if (progressBar) progressBar.style.width = `${progress * 100}%`;
  if (progressText) progressText.textContent = `${Math.round(progress * 100)}%`;
}

function hideLoadingState(container) {
  container?.classList.remove('loading');
  const loadingElement = container?.querySelector('.three-earth-loading');
  if (loadingElement) loadingElement.classList.add('hidden');
}

function showErrorState(container, error) {
  container?.classList.add('error');
  container?.classList.remove('loading');
  const errorElement = container?.querySelector('.three-earth-error');
  if (errorElement) {
    errorElement.classList.remove('hidden');
    const errorText = errorElement.querySelector('p');
    if (errorText) {
      errorText.textContent = `WebGL Error: ${error.message || 'Unknown error'}`;
    }
  }
}

// ===== Performance Monitor =====

class PerformanceMonitor {
  constructor(parentContainer) {
    this.element = document.createElement('div');
    this.element.className = 'three-earth-performance-overlay';
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
    const _mem = renderer.info.memory;
    const render = renderer.info.render;
    this.element.innerHTML = `
      FPS: ${Math.round(this.fps)} | 
      Calls: ${render.calls} | Tris: ${(render.triangles / 1000).toFixed(1)}k | 
      PR: ${this.currentPixelRatio.toFixed(2)}
    `;
  }

  adjustResolution() {
    this.adjustQualityLevel();

    if (this.fps < 10) {
      this.currentPixelRatio = 0.5;
      renderer.setPixelRatio(this.currentPixelRatio);
      return;
    }

    if (this.fps < CONFIG.PERFORMANCE.DRS_DOWN_THRESHOLD && this.currentPixelRatio > 0.5) {
      this.currentPixelRatio = Math.max(0.5, this.currentPixelRatio - 0.15);
      renderer.setPixelRatio(this.currentPixelRatio);
    } else if (
      this.fps > CONFIG.PERFORMANCE.DRS_UP_THRESHOLD &&
      this.currentPixelRatio < CONFIG.PERFORMANCE.PIXEL_RATIO
    ) {
      this.currentPixelRatio = Math.min(
        CONFIG.PERFORMANCE.PIXEL_RATIO,
        this.currentPixelRatio + 0.05
      );
      renderer.setPixelRatio(this.currentPixelRatio);
    }
  }

  adjustQualityLevel() {
    const prevLevel = currentQualityLevel;

    if (this.fps < CONFIG.QUALITY_LEVELS.MEDIUM.minFPS) {
      currentQualityLevel = 'LOW';
    } else if (this.fps < CONFIG.QUALITY_LEVELS.HIGH.minFPS) {
      currentQualityLevel = 'MEDIUM';
    } else {
      currentQualityLevel = 'HIGH';
    }

    if (prevLevel !== currentQualityLevel) {
      this.applyQualitySettings();
    }
  }

  applyQualitySettings() {
    const level = CONFIG.QUALITY_LEVELS[currentQualityLevel];
    if (cloudMesh) cloudMesh.visible = level.cloudLayer;
    if (shootingStarManager) shootingStarManager.disabled = !level.meteorShowers;
  }

  cleanup() {
    this.element?.parentNode?.removeChild(this.element);
  }
}

// ===== Public API =====

export const { initThreeEarth, cleanup } = ThreeEarthManager;

export const EarthSystemAPI = {
  flyToPreset: (presetName) => {
    if (typeof flyToPreset === 'function') {
      flyToPreset(presetName);
    }
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
