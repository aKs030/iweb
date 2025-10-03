/**
 * Three.js Earth System - 3D WebGL Erde mit Sternen
 *
 * High-Quality 3D-Erdvisualisierung mit:
 * - Realistische Erdtexturen (Day/Night/Bump/Normal Maps)
 * - Prozedurales Sternfeld mit custom Texturen
 * - Scroll-basierte Kamera-Controls
 * - Section-responsive Animationsübergänge
 * - Performance-optimiertes Rendering
 *
 * Verwendet shared-particle-system für Parallax-Synchronisation.
 *
 * @author Portfolio System
 * @version 2.5.0
 * @created 2025-10-02
 */

// Three.js Earth System - High Quality Version
import {
  getSharedState,
  registerParticleSystem,
  sharedCleanupManager,
  sharedParallaxManager,
  unregisterParticleSystem,
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

// Timer Manager für Three.js Earth System
const earthTimers = new TimerManager();

// ===== Performance: Math-Konstanten (Standard 3D-Pattern) =====
const TWO_PI = Math.PI * 2;
const PI_THIRD = Math.PI * 0.3;
const PI_QUARTER = Math.PI / 4;

// ===== Globale Variablen =====
let scene, camera, renderer, earthMesh, starField;
let earthGeometry = null; // Referenz für explizites Disposal
let sectionObserver = null;
let animationFrameId = null;
let currentSection = "hero";
let isMobileDevice = false; // Device-Detection Cache

// Kamera und Animation States
let cameraTarget = { x: 0, y: 0, z: 5 };
const cameraPosition = { x: 0, y: 0, z: 5 };
let cameraRotation = { x: 0, y: 0 };

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
      const noOpCleanup = () => {};
      return noOpCleanup;
    }

    try {
      log.info("Initializing Three.js Earth system");

      // System registrieren
      registerParticleSystem("three-earth", { type: "three-earth" });

      // Loading State aktivieren
      showLoadingState(container);

      // Three.js laden
      const THREE = await loadThreeJS();
      if (!THREE) {
        throw new Error("Three.js failed to load from all sources");
      }

      // Scene Setup
      await setupScene(THREE, container);

      // Earth-Geometrie und -Material erstellen
      await createEarthSystem(THREE);

      // Kamera-System initialisieren
      setupCameraSystem(THREE);

      // Scroll-basierte Controls aktivieren
      setupUserControls();

      // Section-Detection aktivieren
      setupSectionDetection();

      // Animation Loop starten
      startAnimationLoop(THREE);

      // Resize Handler
      setupResizeHandler();

      // Loading State verstecken
      hideLoadingState(container);

      log.info("Three.js Earth system initialized successfully");

      return cleanup;
    } catch (error) {
      log.error("Failed to initialize Three.js Earth system:", error);

      // Emergency cleanup bei Initialisierungsfehler
      try {
        if (renderer) {
          renderer.dispose();
          renderer = null;
        }
        if (scene) {
          scene = null;
        }
        if (camera) {
          camera = null;
        }
        // Shared cleanup ausführen
        sharedCleanupManager.cleanupSystem("three-earth");
      } catch (emergencyError) {
        log.error("Emergency cleanup failed:", emergencyError);
      }

      showErrorState(container, error);
      const noOpCleanup = () => {};
      return noOpCleanup;
    }
  };

  const cleanup = () => {
    log.info("Cleaning up Three.js Earth system");

    // Animation stoppen
    const sharedState = getSharedState();
    if (sharedState.animationFrameId) {
      cancelAnimationFrame(sharedState.animationFrameId);
      sharedState.animationFrameId = null;
    }

    // Shared cleanup ausführen
    sharedCleanupManager.cleanupSystem("three-earth");

    // Erweiterte Three.js Memory Cleanup
    if (scene) {
      // Tiefe Bereinigung aller Scene-Objekte
      scene.traverse((child) => {
        // Geometry disposal
        if (child.geometry) {
          child.geometry.dispose();
          log.debug("Disposed geometry for:", child.name || child.type);
        }

        // Material disposal (Single und Array)
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((material, idx) => {
              disposeMaterial(material, `${child.name || child.type}_${idx}`);
            });
          } else {
            disposeMaterial(child.material, child.name || child.type);
          }
        }

        // Light disposal (optional cleanup)
        if (child.isLight) {
          log.debug("Disposed light:", child.type);
        }
      });

      // Scene komplett leeren
      while (scene.children.length > 0) {
        scene.remove(scene.children[0]);
      }
    }

    // Renderer disposal
    if (renderer) {
      // WebGL Context freigeben
      const gl = renderer.getContext();
      if (gl && gl.getExtension("WEBGL_lose_context")) {
        gl.getExtension("WEBGL_lose_context").loseContext();
      }

      renderer.dispose();
      renderer.forceContextLoss();
      log.debug("Renderer disposed and context lost");
    }

    // Observer disconnecten
    if (sectionObserver) {
      sectionObserver.disconnect();
      sectionObserver = null;
    }

    // Animation Frame cleanup
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }

    // Timer cleanup
    earthTimers.clearAll();

    // Explicit geometry disposal
    if (earthGeometry) {
      earthGeometry.dispose();
      earthGeometry = null;
      log.debug("Earth geometry explicitly disposed");
    }

    // Global references zurücksetzen
    scene = null;
    camera = null;
    renderer = null;
    earthMesh = null;
    starField = null;
    currentSection = "hero";

    // System aus shared state entfernen
    unregisterParticleSystem("three-earth");

    log.info("Three.js Earth system cleanup completed");
  };

  // Helper function für Material Disposal
  function disposeMaterial(material, name = "unknown") {
    try {
      // Standard Texturen
      const textureMaps = [
        "map",
        "normalMap",
        "bumpMap",
        "specularMap",
        "emissiveMap",
        "alphaMap",
        "roughnessMap",
        "metalnessMap",
      ];
      textureMaps.forEach((mapName) => {
        if (material[mapName]) material[mapName].dispose();
      });

      // Shader-spezifische Texturen
      if (material.uniforms) {
        Object.values(material.uniforms).forEach((uniform) => {
          if (uniform.value?.isTexture) {
            uniform.value.dispose();
          }
        });
      }

      material.dispose();
      log.debug("Disposed material for:", name);
    } catch (error) {
      log.error("Error disposing material:", name, error);
    }
  }

  return { initThreeEarth, cleanup };
})();

// ===== Three.js ES Module Loading =====
async function loadThreeJS() {
  try {
    // Prüfen ob Three.js bereits verfügbar ist
    if (window.THREE) {
      log.debug("Three.js already available");
      return window.THREE;
    }

    // ES Module Loading Strategy (empfohlen für r150+)
    const moduleLoadingSources = [
      // 1. Lokales ES Module (Production - minified)
      "/content/webentwicklung/lib/three/build/three.module.min.js",
      // 2. CDN ES Module Fallback
      "https://unpkg.com/three@0.150.0/build/three.module.js",
    ];

    for (const src of moduleLoadingSources) {
      try {
        log.debug(`Attempting to load Three.js ES Module from: ${src}`);
        const THREE = await import(src);

        // ES Modules exportieren alles unter dem default export
        const ThreeJS = THREE.default || THREE;
        if (ThreeJS?.WebGLRenderer) {
          log.info(`Three.js ES Module loaded successfully from: ${src}`);
          // Für Kompatibilität auch im window verfügbar machen
          window.THREE = ThreeJS;
          return ThreeJS;
        }
      } catch (error) {
        log.warn(`Failed to load ES Module from ${src}:`, error);
        continue; // Try next source
      }
    }

    // Fallback zu Legacy Script Loading (für Kompatibilität)
    log.info("ES Module loading failed, trying legacy script loading");
    const legacySources = [
      "/content/webentwicklung/lib/three/build/three.min.js",
      "https://cdnjs.cloudflare.com/ajax/libs/three.js/r150/three.min.js",
      "https://unpkg.com/three@0.150.0/build/three.min.js",
    ];

    for (const src of legacySources) {
      try {
        log.debug(`Attempting to load Three.js script from: ${src}`);
        const THREE = await loadFromSource(src);
        if (THREE) {
          log.info(`Three.js loaded successfully from: ${src} (legacy mode)`);
          return THREE;
        }
      } catch (error) {
        log.warn(`Failed to load from ${src}:`, error);
        continue;
      }
    }

    throw new Error("All Three.js loading sources failed");
  } catch (error) {
    log.error("Error loading Three.js:", error);
    return null;
  }
}

// Helper function für einzelne Quelle
function loadFromSource(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.crossOrigin = "anonymous";

    // Timeout nach 8 Sekunden pro Quelle (mit earthTimers für konsistentes Cleanup)
    const timeout = earthTimers.setTimeout(() => {
      reject(new Error("Loading timeout"));
    }, 8000);

    script.onload = () => {
      earthTimers.clearTimeout(timeout);
      if (window.THREE) {
        resolve(window.THREE);
      } else {
        reject(new Error("THREE not available after loading"));
      }
    };

    script.onerror = (error) => {
      earthTimers.clearTimeout(timeout);
      reject(
        new Error(`Script loading failed: ${error.message || "Unknown error"}`)
      );
    };

    document.head.appendChild(script);
  });
}

// ===== Scene Setup =====
async function setupScene(THREE, container) {
  // Device-Detection beim Init (wird bei Resize aktualisiert)
  isMobileDevice = window.matchMedia("(max-width: 768px)").matches;

  // Scene erstellen
  scene = new THREE.Scene();

  // Kamera erstellen mit cinematic FOV
  const aspectRatio = container.clientWidth / container.clientHeight;
  camera = new THREE.PerspectiveCamera(35, aspectRatio, 0.1, 1000); // Cinematic 35mm FOV

  // Renderer erstellen mit hoher Qualität
  renderer = new THREE.WebGLRenderer({
    canvas: container.querySelector("canvas") || undefined,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });

  // Pixel Ratio optimieren
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setClearColor(0x000000, 0); // Transparent für Overlay

  // Renderer-Optimierungen für PBR (Physically Based Rendering)
  // Shadow System deaktiviert - keine Schatten-Empfänger in Scene (nur Erde + Sterne)
  renderer.shadowMap.enabled = false;

  // Physikalisch korrekte Beleuchtung aktivieren (neue Three.js API)
  renderer.useLegacyLights = false; // false = physikalisch korrekte Lichter

  // Color Management - Kompatibilität für verschiedene Three.js Versionen
  if (THREE.ColorManagement && renderer.outputColorSpace !== undefined) {
    // Three.js r150+
    renderer.outputColorSpace = THREE.SRGBColorSpace;
  } else if (renderer.outputEncoding !== undefined) {
    // Three.js r140-r149
    renderer.outputEncoding = THREE.sRGBEncoding;
  }

  // Tone Mapping deaktiviert - Scene hat keine HDR-Texturen oder dynamische Lichter
  // NoToneMapping ist Standard und verursacht keinen Overhead

  // Frustum Culling aktivieren - Kompatibilität für verschiedene Three.js Versionen
  if (renderer.setFaceCulling) {
    renderer.setFaceCulling(THREE.CullFaceBack);
  } else {
    // Fallback für ältere Three.js Versionen
    renderer.setRenderTarget = renderer.setRenderTarget || (() => {});
    log.debug("Using legacy Three.js compatibility mode");
  }

  container.appendChild(renderer.domElement);

  // Dezentes Sternsystem erstellen
  createStarField(THREE);

  // Parallax-Scrolling für Sterne setup
  setupStarParallax();

  // Beleuchtung Setup
  setupLighting(THREE);

  log.debug("Scene setup completed", {
    pixelRatio: renderer.getPixelRatio(),
  });
}

// ===== Runde Stern-Textur erstellen =====
function createStarTexture(THREE) {
  const canvas = document.createElement("canvas");
  const size = 64; // Textur-Größe
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext("2d");
  const center = size / 2;

  // Hintergrund transparent
  context.clearRect(0, 0, size, size);

  // Haupt-Stern (radialer Gradient mit höherer Intensität)
  const mainGradient = context.createRadialGradient(
    center,
    center,
    0,
    center,
    center,
    center * 0.7
  );
  mainGradient.addColorStop(0.0, "rgba(255, 255, 255, 1.0)"); // Helles Zentrum
  mainGradient.addColorStop(0.2, "rgba(255, 255, 255, 0.9)"); // Stärkerer Übergang
  mainGradient.addColorStop(0.5, "rgba(255, 255, 255, 0.4)"); // Sichtbarerer Rand
  mainGradient.addColorStop(0.7, "rgba(255, 255, 255, 0.1)"); // Erweiterte Sichtbarkeit
  mainGradient.addColorStop(1.0, "rgba(255, 255, 255, 0.0)"); // Transparenter Rand

  context.fillStyle = mainGradient;
  context.beginPath();
  context.arc(center, center, center * 0.7, 0, Math.PI * 2); // Größerer Stern-Kern
  context.fill();

  // Stern-Strahlen (heller und länger)
  context.fillStyle = "rgba(255, 255, 255, 0.6)"; // Hellere Strahlen
  const rayWidth = 1.5; // Breitere Strahlen
  const rayLength = center * 0.9; // Längere Strahlen

  // Vertikaler Strahl
  context.fillRect(
    center - rayWidth / 2,
    center - rayLength,
    rayWidth,
    rayLength * 2
  );
  // Horizontaler Strahl
  context.fillRect(
    center - rayLength,
    center - rayWidth / 2,
    rayLength * 2,
    rayWidth
  );

  // Zusätzliche diagonale Strahlen für realistischeren Effekt
  context.save();
  context.translate(center, center);
  context.rotate(PI_QUARTER);
  context.fillRect(-rayWidth / 2, -rayLength * 0.6, rayWidth, rayLength * 1.2);
  context.fillRect(-rayLength * 0.6, -rayWidth / 2, rayLength * 1.2, rayWidth);
  context.restore();

  // Three.js Textur erstellen
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;

  return texture;
}

// ===== Dezentes Sternsystem mit Performance-Optimierungen =====
function createStarField(THREE) {
  const starGeometry = new THREE.BufferGeometry();
  const starCount = 1500;

  // Optimierte Buffer-Geometrie
  const positions = new Float32Array(starCount * 3);
  const colors = new Float32Array(starCount * 3);
  const sizes = new Float32Array(starCount);

  // Sterne in Kugel um die Szene verteilen
  for (let i = 0; i < starCount; i++) {
    const i3 = i * 3;

    // Zufällige Position auf Kugel-Oberfläche
    const radius = 100 + Math.random() * 200;
    const theta = Math.random() * TWO_PI;
    const phi = Math.acos(2 * Math.random() - 1);

    positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
    positions[i3 + 2] = radius * Math.cos(phi);

    // Stern-Farben
    const colorVariation = 0.9 + Math.random() * 0.1;
    colors[i3] = colorVariation;
    colors[i3 + 1] = colorVariation * (0.95 + Math.random() * 0.05);
    colors[i3 + 2] = colorVariation * (0.9 + Math.random() * 0.1);

    // Stern-Größen (deutlich größer für bessere Sichtbarkeit)
    sizes[i] =
      Math.random() < 0.15
        ? 4.0 + Math.random() * 6.0
        : 2.0 + Math.random() * 3.0;
  }

  // Static Draw für unveränderliche Geometrie (Performance)
  starGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(positions, 3).setUsage(THREE.StaticDrawUsage)
  );
  starGeometry.setAttribute(
    "color",
    new THREE.BufferAttribute(colors, 3).setUsage(THREE.StaticDrawUsage)
  );
  starGeometry.setAttribute(
    "size",
    new THREE.BufferAttribute(sizes, 1).setUsage(THREE.StaticDrawUsage)
  );

  // Bounding Sphere für Frustum Culling
  starGeometry.computeBoundingSphere();

  // Runde Stern-Textur erstellen
  const starTexture = createStarTexture(THREE);

  // Optimiertes Material mit Additive Blending
  const starMaterial = new THREE.PointsMaterial({
    size: 3.0, // Größerer Basis-Size
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    opacity: 0.9, // Höhere Opacity
    blending: THREE.AdditiveBlending,
    depthWrite: false, // Performance: Kein Depth Writing bei transparenten Partikeln
    map: starTexture,
    alphaTest: 0.05, // Niedrigerer alphaTest für mehr Sichtbarkeit
  });

  // Stern-Mesh erstellen und zur Szene hinzufügen
  starField = new THREE.Points(starGeometry, starMaterial);
  starField.name = "starField";
  starField.frustumCulled = true; // Enable frustum culling für Performance
  scene.add(starField);

  log.debug(`Created subtle star field with ${starCount} stars`);

  // Cleanup-Funktion hinzufügen
  sharedCleanupManager.addCleanupFunction(
    "three-earth",
    () => {
      if (starField) {
        scene.remove(starField);
        starGeometry.dispose();
        starMaterial.dispose();
        if (starTexture) {
          starTexture.dispose();
        }
        log.debug("Star field disposed");
      }
    },
    "star field cleanup"
  );
}

// ===== Parallax-Scrolling für Sterne =====
function setupStarParallax() {
  // Konstanten statt userData Properties
  const BASE_ROTATION_Y = 0;
  const BASE_OPACITY = 0.9;

  // Parallax-Handler zum shared system hinzufügen
  const parallaxHandler = (progress, scrollY) => {
    try {
      if (!starField) return;

      // Parallax-Bewegung für Sternfeld
      const parallaxRotationY = progress * PI_THIRD;
      starField.rotation.y = BASE_ROTATION_Y + parallaxRotationY;

      // Zusätzliche X-Rotation für 3D-Effekt
      const parallaxRotationX = Math.sin(progress * TWO_PI) * 0.1;
      starField.rotation.x = parallaxRotationX;

      // Subtile Z-Position-Änderung für Tiefeneffekt
      const parallaxZ = Math.sin(progress * Math.PI) * 15;
      starField.position.z = parallaxZ;

      // Y-Position-Änderung für vertikale Parallax
      const parallaxY = scrollY * 0.02;
      starField.position.y = parallaxY;

      // Opacity-Variation basierend auf Scroll-Position
      if (starField.material) {
        const scrollOpacity =
          BASE_OPACITY * (0.7 + Math.sin(progress * Math.PI) * 0.3);
        starField.material.opacity = Math.max(
          0.4,
          Math.min(1.0, scrollOpacity)
        );
      }
    } catch (error) {
      log.error("Star parallax error:", error);
    }
  };

  sharedParallaxManager.addHandler(parallaxHandler, "three-earth-stars");

  sharedCleanupManager.addCleanupFunction(
    "three-earth",
    () => sharedParallaxManager.removeHandler(parallaxHandler),
    "star parallax handler"
  );

  log.debug("Star parallax setup completed");
}

// ===== Beleuchtung Setup =====
function setupLighting(THREE) {
  // Hauptlichtquelle (Sonne)
  const sunLight = new THREE.DirectionalLight(0xfff8f0, 3.5);
  sunLight.position.set(5, 3, 5);
  // castShadow deaktiviert - keine Schatten-Empfänger in Scene

  scene.add(sunLight);

  // Umgebungslicht
  const ambientLight = new THREE.AmbientLight(0x8899bb, 0.8);
  scene.add(ambientLight);

  // Hemisphere Light
  const hemiLight = new THREE.HemisphereLight(0x8899ff, 0x332211, 0.5);
  hemiLight.position.set(0, 50, 0);
  scene.add(hemiLight);

  // Rim Light für cinematischen Effekt
  const rimLight = new THREE.DirectionalLight(0x6699ff, 0.6);
  rimLight.position.set(-5, 2, -5);
  scene.add(rimLight);

  log.debug("PBR lighting setup completed");
}

// ===== Earth-System erstellen =====
async function createEarthSystem(THREE) {
  const earthRadius = 3.5;
  const segments = 128;

  earthGeometry = new THREE.SphereGeometry(earthRadius, segments, segments);

  // Earth-Material erstellen
  const earthMaterial = await createEarthMaterial(THREE);

  earthMesh = new THREE.Mesh(earthGeometry, earthMaterial);
  // Position wird dynamisch durch Section-Configs gesetzt (siehe updateEarthForSection)
  earthMesh.position.set(0, -4.5, 0); // Initial Hero-Position
  // castShadow/receiveShadow deaktiviert - keine Schatten in Scene
  scene.add(earthMesh);

  log.debug("Earth system created", { segments });
}

// ===== Earth-Material erstellen =====
async function createEarthMaterial(THREE) {
  const textureLoader = new THREE.TextureLoader();

  try {
    log.debug("Attempting to load Earth textures...");

    // Texturen laden mit kurzen Timeouts für schnellen Fallback
    const promises = [];

    // Day texture - essentiell
    promises.push(
      loadTextureWithFallback(
        textureLoader,
        "/content/img/earth/textures/earth_day.webp",
        2000
      )
    );

    // Alle Texturen laden (hohe Qualität)
    promises.push(
      loadTextureWithFallback(
        textureLoader,
        "/content/img/earth/textures/earth_night.webp",
        2000
      )
    );
    promises.push(
      loadTextureWithFallback(
        textureLoader,
        "/content/img/earth/textures/earth_normal.webp",
        2000
      )
    );
    promises.push(
      loadTextureWithFallback(
        textureLoader,
        "/content/img/earth/textures/earth_bump.webp",
        2000
      )
    );

    const textures = await Promise.allSettled(promises);
    const [dayTexture, nightTexture, normalTexture, bumpTexture] = textures.map(
      (result) => (result.status === "fulfilled" ? result.value : null)
    );

    // Erweiterte Texture-Status Logging
    const loadedCount = textures.filter(
      (result) => result.status === "fulfilled"
    ).length;
    const failedCount = textures.filter(
      (result) => result.status === "rejected"
    ).length;

    if (loadedCount > 0) {
      log.info(
        `Successfully loaded ${loadedCount}/${promises.length} earth textures`
      );
      if (failedCount > 0) {
        log.warn(
          `Failed to load ${failedCount}/${promises.length} textures, continuing with available ones`
        );
        // Log spezifische Fehler für Debugging
        textures.forEach((result, index) => {
          if (result.status === "rejected") {
            const textureNames = ["day", "night", "normal", "bump"];
            const currentName = textureNames[index] || `texture_${index}`;
            log.debug(
              `${currentName} texture error:`,
              result.reason?.message || result.reason
            );
          }
        });
      }
    } else {
      log.warn(
        "All earth textures failed to load, falling back to procedural material"
      );
      return createProceduralEarthMaterial(THREE);
    }

    // Debug: Detaillierter Texture-Status
    log.debug("Detailed texture loading results:", {
      dayTexture: !!dayTexture,
      nightTexture: !!nightTexture,
      normalTexture: !!normalTexture,
      bumpTexture: !!bumpTexture,
      totalLoaded: loadedCount,
    });

    // Material basierend auf verfügbaren Texturen
    let material;

    if (dayTexture) {
      // PBR Material für realistisches Rendering
      const materialConfig = {
        map: dayTexture,

        // Physikalisch korrekte Werte
        roughness: 0.9,
        metalness: 0.0,

        // Normal Maps für Oberflächendetails
        displacementScale: 0.0,
        normalScale: new THREE.Vector2(1.5, 1.5),

        // Environment Mapping
        envMapIntensity: 0.3,

        // Night Texture als emissive Map
        emissive: 0xffffff,
        emissiveIntensity: nightTexture ? 0.15 : 0.0,
      };

      // Texturen hinzufügen wenn verfügbar
      if (nightTexture) {
        materialConfig.emissiveMap = nightTexture;
        log.debug("Night texture applied as emissive map");
      }
      if (normalTexture) {
        materialConfig.normalMap = normalTexture;
        log.debug("Normal map applied");
      }
      if (bumpTexture) {
        materialConfig.bumpMap = bumpTexture;
        materialConfig.bumpScale = 0.02;
        log.debug("Bump map applied");
      }

      material = new THREE.MeshStandardMaterial(materialConfig);
      log.info("Using PBR MeshStandardMaterial for realistic Earth rendering");
    } else {
      // Fallback zu prozeduralem Material
      material = createProceduralEarthMaterial(THREE);
    }

    // Texture-Optimierungen mit device-basierter Anisotropic Filtering
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const anisotropy = isMobileDevice
      ? Math.min(maxAniso, 4)
      : Math.min(maxAniso, 16);

    [dayTexture, nightTexture, normalTexture, bumpTexture].forEach(
      (texture) => {
        if (texture) {
          texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
          texture.generateMipmaps = true;
          texture.minFilter = THREE.LinearMipmapLinearFilter;
          texture.magFilter = THREE.LinearFilter;
          texture.anisotropy = anisotropy;
          texture.needsUpdate = true;
        }
      }
    );

    log.debug(
      `Applied ${anisotropy}x anisotropic filtering (device: ${isMobileDevice ? "mobile" : "desktop"})`
    );

    return material;
  } catch (error) {
    log.warn("Failed to load textures, using procedural material:", error);
    return createProceduralEarthMaterial(THREE);
  }
}

// ===== Texture Loading mit Retry und Exponential Backoff =====
async function loadTextureWithFallback(
  loader,
  url,
  timeout = 5000,
  maxRetries = 3
) {
  // WebP-Support mit automatischem JPG-Fallback
  const webpUrl = url.replace(/\.jpg$/, ".webp");
  const formats = [
    { url: webpUrl, format: "WebP", description: "modern compressed format" },
    { url: url, format: "JPG", description: "legacy format" },
  ];

  // Format-basierter Retry-Loop
  for (const { url: formatUrl, format, description } of formats) {
    let attempts = 0;
    const baseDelay = 1000; // 1 Sekunde Basis-Verzögerung

    while (attempts < maxRetries) {
      try {
        log.debug(`Attempting to load ${format} texture: ${formatUrl}`);
        const texture = await loadTextureWithTimeout(
          loader,
          formatUrl,
          timeout
        );
        log.info(
          `✅ Successfully loaded ${format} texture (${description}): ${formatUrl}`
        );
        return texture;
      } catch (error) {
        attempts++;
        log.warn(
          `Texture loading attempt ${attempts}/${maxRetries} failed for ${format}: ${formatUrl}`,
          error
        );

        if (attempts >= maxRetries) {
          log.warn(
            `All attempts failed for ${format}: ${formatUrl}, trying next format...`
          );
          break; // Try next format
        }

        // Exponential backoff: 1s, 2s, 4s
        const delay = baseDelay * Math.pow(2, attempts - 1);
        log.debug(
          `Retrying ${format} texture load in ${delay}ms: ${formatUrl}`
        );
        await sleep(delay);
      }
    }
  }

  // Alle Formate fehlgeschlagen
  log.error(`All texture formats failed for: ${url}`);
  throw new Error(`Failed to load texture in any format: ${url}`);
}

// Helper function für einzelnen Load-Versuch mit TimerManager
function loadTextureWithTimeout(loader, url, timeout) {
  return new Promise((resolve, reject) => {
    const timer = earthTimers.setTimeout(() => {
      log.warn(`Texture loading timeout: ${url}`);
      reject(new Error(`Timeout loading ${url}`));
    }, timeout);

    loader.load(
      url,
      (texture) => {
        earthTimers.clearTimeout(timer);
        resolve(texture);
      },
      undefined, // onProgress
      (error) => {
        earthTimers.clearTimeout(timer);
        reject(error);
      }
    );
  });
}

// Helper function für Verzögerung mit TimerManager
function sleep(ms) {
  return earthTimers.sleep(ms);
}

// ===== Prozedurales Earth-Material (Fallback) =====
function createProceduralEarthMaterial(THREE) {
  return new THREE.MeshStandardMaterial({
    color: 0x2d5a8a,
    roughness: 0.9,
    metalness: 0.0,
    emissive: 0x1a3a5a,
    emissiveIntensity: 0.1,
  });
}

// ===== Kamera-System Setup =====
function setupCameraSystem() {
  // Initial Kamera-Position
  updateCameraForSection("hero");

  log.debug("Camera system setup completed");
}

// ===== Kamera für Section anpassen =====
function updateCameraForSection(sectionName) {
  const cameraConfigs = {
    hero: {
      position: { x: 0, y: -1.8, z: 5 },
      rotation: { x: 0.2, y: 0 },
      fov: 45,
    },
    features: {
      position: { x: -3, y: 2.5, z: 6.5 },
      rotation: { x: -0.3, y: 0.4 },
      fov: 42,
    },
    about: {
      position: { x: 0, y: 1, z: 30 },
      rotation: { x: -0.15, y: 0 },
      fov: 25,
    },
  };

  const config = cameraConfigs[sectionName] || cameraConfigs.hero;

  // Ziel-Position und -Rotation setzen (LERP-Animation)
  cameraTarget = config.position;
  cameraRotation = config.rotation;

  // FOV anpassen
  if (camera && camera.fov !== config.fov) {
    camera.fov = config.fov;
    camera.updateProjectionMatrix();
  }

  log.debug(`Camera updated for section: ${sectionName}`, config);
}

// ===== Scroll-basierte Controls =====
function setupUserControls() {
  // Scroll-basierte Earth-Rotation
  const handleScroll = throttle(() => {
    const scrollY = window.pageYOffset;
    const windowHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;
    const scrollProgress = Math.min(
      1,
      Math.max(0, scrollY / Math.max(1, documentHeight - windowHeight))
    );

    // Earth-Rotation basierend auf Scroll
    if (earthMesh) {
      earthMesh.rotation.y = scrollProgress * TWO_PI;
    }
  }, 16);

  // Scroll Events Setup
  const scrollCleanup = onScroll(handleScroll);

  // Cleanup
  sharedCleanupManager.addCleanupFunction(
    "three-earth",
    () => {
      scrollCleanup();
    },
    "user controls cleanup"
  );

  log.debug("Scroll-based controls setup completed");
}

// ===== Section Detection Setup =====
function setupSectionDetection() {
  const sections = document.querySelectorAll("section[id]");
  if (sections.length === 0) {
    log.warn("No sections found for detection");
    return;
  }

  const observerOptions = {
    root: null,
    rootMargin: "-20% 0px -20% 0px",
    threshold: 0.3,
  };

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
  }, observerOptions);

  sections.forEach((section) => {
    sectionObserver.observe(section);
  });

  // Initial section detection
  earthTimers.setTimeout(() => {
    const initialSection = document.querySelector("#hero") || sections[0];
    if (initialSection) {
      currentSection = initialSection.id;
      updateCameraForSection(currentSection);
      updateEarthForSection(currentSection);
    }
  }, 100);

  log.debug("Section detection setup completed");
}

// ===== Earth für Section anpassen =====
function updateEarthForSection(sectionName) {
  if (!earthMesh) return;

  const sectionConfigs = {
    hero: {
      position: { x: 0, y: -6.0, z: 0 },
      scale: 1.5,
      starTwinkle: 0.25,
      starBrightness: 0.9,
      starRotation: 0.00008,
    },
    features: {
      position: { x: 1, y: -1, z: -0.5 },
      scale: 1.0,
      starTwinkle: 0.25,
      starBrightness: 0.9,
      starRotation: 0.00008,
    },
    about: {
      position: { x: 0, y: 0, z: -2 },
      scale: 0.35,
      starTwinkle: 0.5,
      starBrightness: 1.2,
      starRotation: 0.00008,
    },
  };

  const config = sectionConfigs[sectionName] || sectionConfigs.hero;

  // Position & Scale Animation (LERP)
  if (config.position) {
    earthMesh.userData.targetPosition = config.position;
  }

  earthMesh.userData.targetScale = config.scale;

  // Stern-System für Section anpassen
  updateStarFieldForSection(config);

  log.debug(`Earth updated for section: ${sectionName}`, config);
}

function updateStarFieldForSection(config) {
  if (!starField || !starField.material) return;

  // Stern-Parameter für Section
  starField.userData.twinkleIntensity = config.starTwinkle;
  starField.userData.brightness = config.starBrightness;
  starField.userData.rotationSpeed = config.starRotation;

  starField.material.opacity = config.starBrightness * 0.8;
}

// ===== Animation Loop =====
function startAnimationLoop(THREE) {
  const clock = new THREE.Clock();
  const lerpFactor = 0.05;

  // Wiederverwendbare Vector3 (Object-Pooling)
  const tempVector3 = new THREE.Vector3();
  const lookAtVector3 = new THREE.Vector3();

  function animate() {
    animationFrameId = requestAnimationFrame(animate);

    const deltaTime = clock.getDelta();
    const elapsedTime = clock.getElapsedTime();

    // Earth Updates (Position & Scale)
    updateEarthTransform(tempVector3, deltaTime);

    // Subtile Stern-Animation
    updateStarField(elapsedTime);

    // Kamera-Position Update (LERP)
    updateCameraPosition(lookAtVector3, lerpFactor, elapsedTime);

    // Rendern
    renderFrame();
  }

  function renderFrame() {
    try {
      renderer.render(scene, camera);
    } catch (error) {
      // Critical render failure, stop animation
      log.error("Critical render failure, stopping animation:", error);
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
    }
  }

  function updateEarthTransform(tempVector3, deltaTime) {
    if (!earthMesh) return;

    // Position LERP
    if (earthMesh.userData.targetPosition) {
      const { targetPosition } = earthMesh.userData;
      tempVector3.set(targetPosition.x, targetPosition.y, targetPosition.z);
      earthMesh.position.lerp(tempVector3, 0.03);
    }

    // Scale Animation mit Easing
    if (earthMesh.userData.targetScale) {
      const targetScale = earthMesh.userData.targetScale;
      const currentScale = earthMesh.scale.x;
      const scaleDiff = targetScale - currentScale;

      if (Math.abs(scaleDiff) > 0.001) {
        const lerpFactor = Math.min(deltaTime * 4.0, 1.0);
        const easedFactor = 1 - Math.pow(1 - lerpFactor, 3);
        const newScale = currentScale + scaleDiff * easedFactor;
        earthMesh.scale.set(newScale, newScale, newScale);
      }
    }
  }

  function updateCameraPosition(lookAtVector3, lerpFactor, elapsedTime) {
    // Position LERP
    cameraPosition.x += (cameraTarget.x - cameraPosition.x) * lerpFactor;
    cameraPosition.y += (cameraTarget.y - cameraPosition.y) * lerpFactor;
    cameraPosition.z += (cameraTarget.z - cameraPosition.z) * lerpFactor;

    // Rotation LERP
    camera.position.set(cameraPosition.x, cameraPosition.y, cameraPosition.z);
    camera.rotation.x += (cameraRotation.x - camera.rotation.x) * lerpFactor;
    camera.rotation.y += (cameraRotation.y - camera.rotation.y) * lerpFactor;

    // Look-at mit subtiler lateraler Bewegung
    lookAtVector3.set(
      Math.sin(elapsedTime * 0.5) * 0.1,
      Math.sin(elapsedTime * 0.8) * 0.05,
      0
    );
    camera.lookAt(lookAtVector3);
  }

  function updateStarField(elapsedTime) {
    if (!starField) return;

    // Section-spezifische Parameter
    const twinkleIntensity = starField.userData.twinkleIntensity || 0.2;
    const brightness = starField.userData.brightness || 0.9;
    const rotationSpeed = starField.userData.rotationSpeed || 0.0001;

    // Subtile Rotation
    starField.rotation.y = elapsedTime * rotationSpeed;

    // Funkeln-Effekt durch Opacity-Variation
    if (starField.material) {
      const mainTwinkle = Math.sin(elapsedTime * 0.5) * twinkleIntensity;
      const fastTwinkle =
        Math.sin(elapsedTime * 2.0) * (twinkleIntensity * 0.3);
      const combined = brightness * (0.7 + mainTwinkle + fastTwinkle);
      starField.material.opacity = Math.max(0.4, Math.min(1.0, combined));
    }
  }

  animate();
  log.debug("Animation loop started");
}

// ===== Resize Handler =====
function setupResizeHandler() {
  const handleResize = () => {
    const container = getElementById("threeEarthContainer");
    if (!container || !camera || !renderer) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    // Device-Detection aktualisieren (Device-Rotation)
    isMobileDevice = window.matchMedia("(max-width: 768px)").matches;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    renderer.setSize(width, height);

    log.debug("Three.js resized", { width, height, isMobile: isMobileDevice });
  };

  // Resize Event mit Throttling
  const resizeCleanup = onResize(handleResize, 100);

  sharedCleanupManager.addCleanupFunction(
    "three-earth",
    resizeCleanup,
    "resize handler cleanup"
  );
}

// ===== UI State Management =====
function showLoadingState(container) {
  container.classList.add("loading");

  const loadingElement = container.querySelector(".three-earth-loading");
  const errorElement = container.querySelector(".three-earth-error");

  if (loadingElement) loadingElement.classList.remove("hidden");
  if (errorElement) errorElement.classList.add("hidden");

  log.debug("Loading state activated");
}

function hideLoadingState(container) {
  container.classList.remove("loading");

  const loadingElement = container.querySelector(".three-earth-loading");
  if (loadingElement) loadingElement.classList.add("hidden");

  log.debug("Loading state deactivated");
}

function showErrorState(container, error) {
  container.classList.add("error");
  container.classList.remove("loading");

  const loadingElement = container.querySelector(".three-earth-loading");
  const errorElement = container.querySelector(".three-earth-error");

  if (loadingElement) loadingElement.classList.add("hidden");
  if (errorElement) {
    errorElement.classList.remove("hidden");

    // Error message aktualisieren
    const errorText = errorElement.querySelector("p");
    if (errorText) {
      errorText.textContent = `WebGL-Fehler: ${
        error.message || "Unbekannter Fehler"
      }.`;
    }
  }

  log.error("Error state activated:", error);

  // Accessibility announcement
  if (window.announce) {
    window.announce("3D-Darstellung konnte nicht geladen werden.", {
      assertive: true,
    });
  }
}

export const { initThreeEarth, cleanup } = ThreeEarthManager;

// Default Export für Kompatibilität
export default ThreeEarthManager;
