/**
 * Three.js Earth System - 3D WebGL Earth with Stars, Clouds & Atmosphere
 *
 * High-Quality 3D Earth visualization featuring:
 * - Realistic PBR Earth textures (Day/Night/Bump/Normal Maps)
 * - Dynamic, separate cloud layer with distinct rotation
 * - Procedural atmospheric glow using a custom shader (Fresnel effect)
 * - Procedural starfield with parallax scrolling and twinkling effects
 * - Interactive mouse controls for manual Earth rotation
 * - Scroll-based camera controls and section-responsive animations
 * - Integrated performance monitor (FPS) for easy debugging
 * - Occasional shooting stars for added visual flair
 *
 * Uses shared-particle-system for parallax synchronization and effects.
 *
 * @author Portfolio System
 * @version 3.0.0
 * @created 2025-10-03
 */

// Three.js Earth System - High Quality Version
import {
  getSharedState,
  registerParticleSystem,
  sharedCleanupManager,
  sharedParallaxManager,
  unregisterParticleSystem,
  ShootingStarManager, // NEW: Import the new shooting star manager
} from "./shared-particle-system.js";

// ===== Shared Utilities Import =====
import {
  createLogger,
  getElementById,
  onResize,
  onScroll,
  throttle,
  TimerManager,
} from "../shared-utilities.js";

const log = createLogger("threeEarthSystem");

// Timer Manager for Three.js Earth System
const earthTimers = new TimerManager();

// ===== Performance: Math Constants (Standard 3D-Pattern) =====
const TWO_PI = Math.PI * 2;
const PI_THIRD = Math.PI * 0.3;
const EARTH_RADIUS = 3.5;

// ===== Global Variables =====
let scene, camera, renderer, earthMesh, starField, cloudMesh, atmosphereMesh;
let earthGeometry = null; // Reference for explicit disposal
let sectionObserver = null;
let animationFrameId = null;
let currentSection = "hero";
let isMobileDevice = false; // Device-detection cache
let performanceMonitor = null; // NEW: Performance monitor instance
let shootingStarManager = null; // NEW: Shooting star manager instance

// Camera and Animation States
let cameraTarget = { x: 0, y: 0, z: 5 };
const cameraPosition = { x: 0, y: 0, z: 5 };
let cameraRotation = { x: 0, y: 0 };

// NEW: Mouse Interaction State
const mouseState = {
  isDragging: false,
  previousMouseX: 0,
  previousMouseY: 0,
  targetRotationY: 0,
  targetRotationX: 0,
  autoRotation: true,
};

// ===== Three.js Earth System Manager =====
const ThreeEarthManager = (() => {
  const initThreeEarth = async () => {
    const sharedState = getSharedState();
    if (sharedState.isInitialized && sharedState.systems.has("three-earth")) {
      log.debug("Three.js Earth system already initialized");
      return cleanup;
    }

    const container = getElementById("threeEarthContainer");
    if (!container) {
      log.warn("Three.js Earth container not found");
      return () => {};
    }

    try {
      log.info("Initializing Three.js Earth system v3.0");
      registerParticleSystem("three-earth", { type: "three-earth" });
      showLoadingState(container);

      const THREE = await loadThreeJS();
      if (!THREE) throw new Error("Three.js failed to load from all sources");

      await setupScene(THREE, container);
      await createEarthSystem(THREE);
      
      // NEW: Create new visual components
      cloudMesh = await createCloudLayer(THREE);
      earthMesh.add(cloudMesh); // Als Child der Erde - skaliert automatisch mit
      
      atmosphereMesh = createAtmosphere(THREE);
      earthMesh.add(atmosphereMesh); // Als Child der Erde - perfekte Synchronisation

      setupCameraSystem();
      setupUserControls(container);
      setupSectionDetection();
      
      // NEW: Initialize performance monitor and shooting stars
      performanceMonitor = new PerformanceMonitor(container);
      shootingStarManager = new ShootingStarManager(scene, THREE);
      shootingStarManager.start();

      startAnimationLoop(THREE);
      setupResizeHandler();
      hideLoadingState(container);

      log.info("Three.js Earth system initialized successfully");
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
    
    // NEW: Cleanup new components
    if (performanceMonitor) performanceMonitor.cleanup();
    if (shootingStarManager) shootingStarManager.cleanup();

    sharedCleanupManager.cleanupSystem("three-earth");

    if (scene) {
      scene.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((material) => disposeMaterial(material));
          } else {
            disposeMaterial(child.material);
          }
        }
      });
      while (scene.children.length > 0) scene.remove(scene.children[0]);
    }

    if (renderer) {
      const gl = renderer.getContext();
      if (gl && gl.getExtension("WEBGL_lose_context")) {
        gl.getExtension("WEBGL_lose_context").loseContext();
      }
      renderer.dispose();
      renderer.forceContextLoss();
    }

    if (sectionObserver) sectionObserver.disconnect();
    earthTimers.clearAll();
    if (earthGeometry) earthGeometry.dispose();

    scene = camera = renderer = earthMesh = starField = cloudMesh = atmosphereMesh = null;
    currentSection = "hero";
    
    unregisterParticleSystem("three-earth");
    log.info("Three.js Earth system cleanup completed");
  };

  function handleInitializationError(container, error) {
    try {
      if (renderer) renderer.dispose();
      sharedCleanupManager.cleanupSystem("three-earth");
    } catch (emergencyError) {
      log.error("Emergency cleanup failed:", emergencyError);
    }
    showErrorState(container, error);
  }
  
  function disposeMaterial(material) {
    try {
      const textureMaps = ["map", "normalMap", "bumpMap", "specularMap", "emissiveMap", "alphaMap", "roughnessMap", "metalnessMap"];
      textureMaps.forEach((mapName) => {
        if (material[mapName]) material[mapName].dispose();
      });
      if (material.uniforms) {
        Object.values(material.uniforms).forEach((uniform) => {
          if (uniform.value?.isTexture) uniform.value.dispose();
        });
      }
      material.dispose();
    } catch (e) {
      log.error("Error disposing material:", e);
    }
  }

  return { initThreeEarth, cleanup };
})();

// ===== Three.js ES Module Loading (unchanged from original) =====
async function loadThreeJS() {
    try {
        if (window.THREE) return window.THREE;
        const sources = [
            "/content/webentwicklung/lib/three/build/three.module.min.js",
            "https://cdn.jsdelivr.net/npm/three@0.150.0/build/three.module.js"
        ];
        for (const src of sources) {
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
        throw new Error("All Three.js loading sources failed");
    } catch (error) {
        log.error("Error loading Three.js:", error);
        return null;
    }
}

// ===== Scene Setup =====
async function setupScene(THREE, container) {
  isMobileDevice = window.matchMedia("(max-width: 768px)").matches;
  scene = new THREE.Scene();
  const aspectRatio = container.clientWidth / container.clientHeight;
  camera = new THREE.PerspectiveCamera(35, aspectRatio, 0.1, 1000);
  renderer = new THREE.WebGLRenderer({
    canvas: container.querySelector("canvas") || undefined,
    antialias: true, alpha: true, powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setClearColor(0x000000, 0);
  renderer.useLegacyLights = false;
  if (THREE.ColorManagement) renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);
  createStarField(THREE);
  setupStarParallax();
  setupLighting(THREE);
}

// ===== Starfield & Parallax (unchanged from original, minor logging improvements) =====
function createStarField(THREE) {
    const starCount = 1500;
    const starGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
        const i3 = i * 3;
        const radius = 100 + Math.random() * 200;
        const theta = Math.random() * TWO_PI;
        const phi = Math.acos(2 * Math.random() - 1);
        positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
        positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
        positions[i3 + 2] = radius * Math.cos(phi);
    }
    starGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const starMaterial = new THREE.PointsMaterial({
        size: 1.5, sizeAttenuation: true, color: 0xffffff, transparent: true,
        opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    starField = new THREE.Points(starGeometry, starMaterial);
    starField.name = "starField";
    scene.add(starField);
    log.debug(`Created star field with ${starCount} stars`);
    sharedCleanupManager.addCleanupFunction("three-earth", () => {
        if (starField) {
            scene.remove(starField);
            starGeometry.dispose();
            starMaterial.dispose();
        }
    }, "star field cleanup");
}

function setupStarParallax() {
  const parallaxHandler = (progress) => {
    if (!starField) return;
    starField.rotation.y = progress * PI_THIRD;
    starField.rotation.x = Math.sin(progress * TWO_PI) * 0.1;
    starField.position.z = Math.sin(progress * Math.PI) * 15;
  };
  sharedParallaxManager.addHandler(parallaxHandler, "three-earth-stars");
  sharedCleanupManager.addCleanupFunction(
    "three-earth", () => sharedParallaxManager.removeHandler(parallaxHandler), "star parallax handler"
  );
}

// ===== Lighting Setup =====
function setupLighting(THREE) {
  const directionalLight = new THREE.DirectionalLight(0xfff8f0, 3.5);
  directionalLight.position.set(5, 3, 5);
  scene.add(directionalLight);
  
  scene.add(new THREE.AmbientLight(0x8899bb, 0.8));
  scene.add(new THREE.HemisphereLight(0x8899ff, 0x332211, 0.5));
}

// ===== Earth System Creation =====
async function createEarthSystem(THREE) {
  earthGeometry = new THREE.SphereGeometry(EARTH_RADIUS, 128, 128);
  const earthMaterial = await createEarthMaterial(THREE);
  earthMesh = new THREE.Mesh(earthGeometry, earthMaterial);
  earthMesh.position.set(0, -4.5, 0);
  scene.add(earthMesh);
}

// ===== Cloud Layer (Deaktiviert) =====
async function createCloudLayer(THREE) {
    log.debug("Cloud layer skipped (texture not available)");
    return new THREE.Object3D();
}

// ===== Atmospheric Glow =====
function createAtmosphere(THREE) {
    const vertexShader = `
        varying vec3 vNormal;
        varying vec3 vPosition;
        void main() {
            vNormal = normalize(normalMatrix * normal);
            vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `;
    const fragmentShader = `
        varying vec3 vNormal;
        varying vec3 vPosition;
        uniform vec3 uGlowColor;
        uniform float uPower;
        uniform float uIntensity;
        void main() {
            // Echter Fresnel-Effekt: Berechne View-Richtung zur Kamera
            vec3 viewDirection = normalize(-vPosition);
            float fresnel = pow(1.0 - dot(vNormal, viewDirection), uPower);
            gl_FragColor = vec4(uGlowColor, 1.0) * fresnel * uIntensity;
        }
    `;
    const atmosphereMaterial = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
            uGlowColor: { value: new THREE.Color(0x4488cc) }, // Noch dunkleres Blau
            uPower: { value: isMobileDevice ? 5.0 : 4.0 },     // Sehr scharf = dünner Rand
            uIntensity: { value: 0.25 }                         // Sehr subtil
        },
        blending: THREE.AdditiveBlending,
        transparent: true,
        side: THREE.BackSide,
        depthWrite: false,
    });

    // Atmosphäre: Nur 2% größer als Erde für hauchzarten Glow
    const atmosphere = new THREE.Mesh(
        new THREE.SphereGeometry(EARTH_RADIUS * 1.02, 64, 64),
        atmosphereMaterial
    );
    
    // Render-Reihenfolge: Atmosphäre wird zuletzt gerendert (über der Erde)
    atmosphere.renderOrder = 1;
    
    log.info("Atmospheric glow created (radius: " + (EARTH_RADIUS * 1.02).toFixed(2) + ", ultra-subtle)");
    return atmosphere;
}

// ===== Earth Material Creation (Browser-Cache-optimiert) =====
async function createEarthMaterial(THREE) {
    const textureLoader = new THREE.TextureLoader();
    
    try {
        log.debug("Loading Earth textures...");
        
        // Lade Texturen parallel - Browser nutzt Cache automatisch
        const texturePromises = [
            new Promise((resolve, reject) => {
                textureLoader.load(
                    "/content/img/earth/textures/earth_day.webp",
                    resolve,
                    undefined,
                    reject
                );
            }),
            new Promise((resolve, reject) => {
                textureLoader.load(
                    "/content/img/earth/textures/earth_night.webp",
                    resolve,
                    undefined,
                    reject
                );
            }),
            new Promise((resolve, reject) => {
                textureLoader.load(
                    "/content/img/earth/textures/earth_normal.webp",
                    resolve,
                    undefined,
                    reject
                );
            }),
            new Promise((resolve, reject) => {
                textureLoader.load(
                    "/content/img/earth/textures/earth_bump.webp",
                    resolve,
                    undefined,
                    reject
                );
            }),
        ];

        const [dayTexture, nightTexture, normalTexture, bumpTexture] = await Promise.all(texturePromises);

        const material = new THREE.MeshStandardMaterial({
            map: dayTexture,
            normalMap: normalTexture,
            bumpMap: bumpTexture,
            bumpScale: 0.02,
            roughness: 0.9,
            metalness: 0.0,
            emissive: 0xffffff,
            emissiveMap: nightTexture,
            emissiveIntensity: 0.15,
        });

        const maxAniso = renderer.capabilities.getMaxAnisotropy();
        const anisotropy = isMobileDevice ? 4 : 16;
        [dayTexture, nightTexture, normalTexture, bumpTexture].forEach(tex => {
            if (tex) {
                tex.anisotropy = Math.min(maxAniso, anisotropy);
                tex.needsUpdate = true;
            }
        });
        
        log.info("Earth material created successfully with all textures");
        return material;
    } catch (error) {
        log.warn("Failed to load PBR textures, using procedural material:", error);
        return new THREE.MeshStandardMaterial({ color: 0x2d5a8a, roughness: 0.9 });
    }
}


// ===== Camera & Section Updates (unchanged) =====
function setupCameraSystem() {
  updateCameraForSection("hero");
}

function updateCameraForSection(sectionName) {
  const configs = {
    hero: { pos: { x: 0, y: -1.8, z: 5 }, rot: { x: 0.2, y: 0 }, fov: 45 },
    features: { pos: { x: -3, y: 2.5, z: 6.5 }, rot: { x: -0.3, y: 0.4 }, fov: 42 },
    about: { pos: { x: 0, y: 1, z: 30 }, rot: { x: -0.15, y: 0 }, fov: 25 },
  };
  const config = configs[sectionName] || configs.hero;
  cameraTarget = config.pos;
  cameraRotation = config.rot;
  if (camera.fov !== config.fov) {
    camera.fov = config.fov;
    camera.updateProjectionMatrix();
  }
}

function setupSectionDetection() {
  const sections = document.querySelectorAll("section[id]");
  if (sections.length === 0) return;
  sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const newSection = entry.target.id;
        if (newSection !== currentSection) {
          currentSection = newSection;
          updateCameraForSection(newSection);
          updateEarthForSection(newSection);
        }
      }
    });
  }, { rootMargin: "-20% 0px -20% 0px", threshold: 0.3 });
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
    if (config.pos) earthMesh.userData.targetPosition = config.pos;
    earthMesh.userData.targetScale = config.scale;

    // Atmosphäre und Clouds sind jetzt Children der Erde - keine separate Position nötig
}


// ===== User Controls & Interaction =====
function setupUserControls(container) {
  const handleScroll = throttle(() => {
    if (mouseState.autoRotation) {
      const scrollProgress = calculateScrollProgress();
      mouseState.targetRotationY = scrollProgress * TWO_PI;
    }
  }, 16);

  const scrollCleanup = onScroll(handleScroll);
  
  // NEW: Mouse drag controls
  const onMouseDown = (e) => {
    mouseState.isDragging = true;
    mouseState.autoRotation = false;
    mouseState.previousMouseX = e.clientX;
    mouseState.previousMouseY = e.clientY;
    container.classList.add('is-dragging');
  };
  
  const onMouseMove = (e) => {
    if (!mouseState.isDragging) return;
    const deltaX = e.clientX - mouseState.previousMouseX;
    const deltaY = e.clientY - mouseState.previousMouseY;
    
    mouseState.targetRotationY += deltaX * 0.005;
    mouseState.targetRotationX += deltaY * 0.005;
    
    // Clamp vertical rotation to avoid flipping
    mouseState.targetRotationX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, mouseState.targetRotationX));
    
    mouseState.previousMouseX = e.clientX;
    mouseState.previousMouseY = e.clientY;
  };

  const onMouseUp = () => {
    mouseState.isDragging = false;
    container.classList.remove('is-dragging');
    // Optional: Re-enable auto-rotation after a delay
    earthTimers.setTimeout(() => { mouseState.autoRotation = true; }, 5000);
  };

  container.addEventListener('mousedown', onMouseDown);
  container.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);

  sharedCleanupManager.addCleanupFunction("three-earth", () => {
    scrollCleanup();
    container.removeEventListener('mousedown', onMouseDown);
    container.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  }, "user controls cleanup");
}

function calculateScrollProgress() {
    const scrollY = window.pageYOffset;
    const windowHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;
    return Math.min(1, Math.max(0, scrollY / Math.max(1, documentHeight - windowHeight)));
}


// ===== Animation Loop =====
function startAnimationLoop(THREE) {
  const clock = new THREE.Clock();
  const lerpFactor = 0.05;

  function animate() {
    animationFrameId = requestAnimationFrame(animate);
    const elapsedTime = clock.getElapsedTime();

    // LERP rotations for smooth interaction
    if (earthMesh) {
      earthMesh.rotation.y += (mouseState.targetRotationY - earthMesh.rotation.y) * lerpFactor;
      earthMesh.rotation.x += (mouseState.targetRotationX - earthMesh.rotation.x) * lerpFactor;
    }

    // NEW: Animate cloud layer independently
    if (cloudMesh && cloudMesh.rotation) {
      cloudMesh.rotation.y = elapsedTime * 0.015;
      cloudMesh.rotation.x = elapsedTime * 0.005;
    }

    // Update camera position
    updateCameraPosition(lerpFactor, elapsedTime);

    // Update object positions (Earth, Clouds, Atmosphere)
    updateObjectTransforms();
    
    // NEW: Update other systems
    if (shootingStarManager) shootingStarManager.update();
    if (performanceMonitor) performanceMonitor.update();

    renderer.render(scene, camera);
  }

  function updateCameraPosition(lerpFactor) {
    cameraPosition.x += (cameraTarget.x - cameraPosition.x) * lerpFactor;
    cameraPosition.y += (cameraTarget.y - cameraPosition.y) * lerpFactor;
    cameraPosition.z += (cameraTarget.z - cameraPosition.z) * lerpFactor;
    camera.position.set(cameraPosition.x, cameraPosition.y, cameraPosition.z);
    camera.rotation.x += (cameraRotation.x - camera.rotation.x) * lerpFactor;
    camera.rotation.y += (cameraRotation.y - camera.rotation.y) * lerpFactor;
    camera.lookAt(0, 0, 0);
  }
  
  function updateObjectTransforms() {
      // Nur earthMesh wird transformiert - Atmosphäre & Clouds folgen automatisch als Children
      if (!earthMesh) return;
      
      // Position LERP
      if (earthMesh.userData.targetPosition) {
          earthMesh.position.lerp(earthMesh.userData.targetPosition, 0.03);
      }
      
      // Scale LERP
      if (earthMesh.userData.targetScale) {
          const scaleDiff = earthMesh.userData.targetScale - earthMesh.scale.x;
          if (Math.abs(scaleDiff) > 0.001) {
              const newScale = earthMesh.scale.x + scaleDiff * 0.05;
              earthMesh.scale.set(newScale, newScale, newScale);
          }
      }
  }

  animate();
}

// ===== Resize Handler (unchanged) =====
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

// ===== UI State Management (unchanged) =====
function showLoadingState(container) {
  container.classList.add("loading");
  const loadingElement = container.querySelector(".three-earth-loading");
  if (loadingElement) loadingElement.classList.remove("hidden");
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
    if (errorText) errorText.textContent = `WebGL-Fehler: ${error.message || "Unbekannter Fehler"}.`;
  }
}

// ===== NEW: Performance Monitor Class =====
class PerformanceMonitor {
    constructor(parentContainer) {
        this.element = document.createElement('div');
        this.element.className = 'three-earth-performance-overlay';
        parentContainer.appendChild(this.element);

        this.frame = 0;
        this.lastTime = performance.now();
        this.fps = 0;
        log.debug("Performance monitor initialized.");
    }

    update() {
        this.frame++;
        const time = performance.now();
        if (time >= this.lastTime + 1000) {
            this.fps = (this.frame * 1000) / (time - this.lastTime);
            this.lastTime = time;
            this.frame = 0;
            this.element.textContent = `FPS: ${Math.round(this.fps)}`;
        }
    }

    cleanup() {
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        log.debug("Performance monitor cleaned up.");
    }
}


export const { initThreeEarth, cleanup } = ThreeEarthManager;
export default ThreeEarthManager;
