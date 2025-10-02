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
 * @version 2.0.0 (teilweise migriert auf shared system)
 * @created 2025-10-02
 */

// Three.js Earth System - High Quality Version
import {
  getElementById,
  throttle,
  TimerManager,
} from "../utils/common-utils.js";
import {
  onResize,
  onScroll,
  setupPointerEvents,
} from "../utils/event-management.js";
import { createLogger } from "../utils/logger.js";
import {
  getSharedState,
  registerParticleSystem,
  sharedCleanupManager,
  sharedParallaxManager,
  unregisterParticleSystem,
} from "./shared-particle-system.js";

const log = createLogger("threeEarthSystem");

// Timer Manager für Three.js Earth System
const earthTimers = new TimerManager();

// ===== Globale Variablen =====
let scene, camera, renderer, earthMesh, composer;
let currentSection = "hero";
let sectionObserver = null;
let animationFrameId = null;

// Kamera und Animation States
let cameraTarget = { x: 0, y: 0, z: 5 };
const cameraPosition = { x: 0, y: 0, z: 5 };
let cameraRotation = { x: 0, y: 0 };
let scrollProgress = 0;
let isScrollBased = true;

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

      // Controls und UX
      setupUserControls(container);

      // Postprocessing
      await setupPostprocessing(THREE);

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
      const objectsToDispose = [];
      scene.traverse((child) => {
        objectsToDispose.push(child);

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

    // Composer disposal
    if (composer) {
      composer.dispose();
      log.debug("Effect composer disposed");
    }

    // Observer disconnecten
    if (sectionObserver) {
      sectionObserver.disconnect();
      sectionObserver = null;
    }

    // Timer cleanup
    earthTimers.clearAll();

    // Global references zurücksetzen
    scene = null;
    camera = null;
    renderer = null;
    earthMesh = null;
    composer = null;
    currentSection = "hero";
    if (sectionObserver) {
      sectionObserver.disconnect();
      sectionObserver = null;
    }
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }

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
      // 1. Lokales ES Module
      "/content/webentwicklung/lib/three/build/three.module.js",
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

    // Timeout nach 8 Sekunden pro Quelle
    const timeout = setTimeout(() => {
      reject(new Error("Loading timeout"));
    }, 8000);

    script.onload = () => {
      clearTimeout(timeout);
      if (window.THREE) {
        resolve(window.THREE);
      } else {
        reject(new Error("THREE not available after loading"));
      }
    };

    script.onerror = (error) => {
      clearTimeout(timeout);
      reject(
        new Error(`Script loading failed: ${error.message || "Unknown error"}`)
      );
    };

    document.head.appendChild(script);
  });
}

// ===== Scene Setup =====
async function setupScene(THREE, container) {
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

  // Renderer-Optimierungen
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // Color Management - Kompatibilität für verschiedene Three.js Versionen
  if (THREE.ColorManagement && renderer.outputColorSpace !== undefined) {
    // Three.js r150+
    renderer.outputColorSpace = THREE.SRGBColorSpace;
  } else if (renderer.outputEncoding !== undefined) {
    // Three.js r140-r149
    renderer.outputEncoding = THREE.sRGBEncoding;
  }

  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;

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
  context.rotate(Math.PI / 4);
  context.fillRect(-rayWidth / 2, -rayLength * 0.6, rayWidth, rayLength * 1.2);
  context.fillRect(-rayLength * 0.6, -rayWidth / 2, rayLength * 1.2, rayWidth);
  context.restore();

  // Three.js Textur erstellen
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;

  return texture;
}

// ===== Dezentes Sternsystem =====
function createStarField(THREE) {
  const starGeometry = new THREE.BufferGeometry();
  const starCount = 1500; // Dezente Anzahl von Sternen

  // Positionen für Sterne generieren
  const positions = new Float32Array(starCount * 3);
  const colors = new Float32Array(starCount * 3);
  const sizes = new Float32Array(starCount);

  // Sterne in Kugel um die Szene verteilen
  for (let i = 0; i < starCount; i++) {
    const i3 = i * 3;

    // Zufällige Position auf Kugel-Oberfläche
    const radius = 100 + Math.random() * 200; // Verschiedene Entfernungen
    const theta = Math.random() * Math.PI * 2; // Azimuth
    const phi = Math.acos(2 * Math.random() - 1); // Polar

    positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
    positions[i3 + 2] = radius * Math.cos(phi);

    // Stern-Farben (heller für bessere Sichtbarkeit)
    const colorVariation = 0.9 + Math.random() * 0.1;
    colors[i3] = colorVariation; // R
    colors[i3 + 1] = colorVariation * (0.95 + Math.random() * 0.05); // G
    colors[i3 + 2] = colorVariation * (0.9 + Math.random() * 0.1); // B

    // Stern-Größen (deutlich größer für bessere Sichtbarkeit)
    sizes[i] =
      Math.random() < 0.15
        ? 4.0 + Math.random() * 6.0
        : 2.0 + Math.random() * 3.0;
  }

  starGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(positions, 3)
  );
  starGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  starGeometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

  // Runde Stern-Textur erstellen
  const starTexture = createStarTexture(THREE);

  // Stern-Material mit runder Textur (optimiert für Sichtbarkeit)
  const starMaterial = new THREE.PointsMaterial({
    size: 3.0, // Größerer Basis-Size
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    opacity: 0.9, // Höhere Opacity
    blending: THREE.AdditiveBlending,
    map: starTexture,
    alphaTest: 0.05, // Niedrigerer alphaTest für mehr Sichtbarkeit
  });

  // Stern-Mesh erstellen und zur Szene hinzufügen
  const starField = new THREE.Points(starGeometry, starMaterial);
  starField.name = "starField";
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
  // Parallax-Handler zum shared system hinzufügen
  const parallaxHandler = (progress, scrollY) => {
    try {
      const starField = scene?.getObjectByName("starField");
      if (!starField) return;

      // Parallax-Bewegung für Sternfeld (harmonisch mit atmospheric-sky-system)
      // Subtile Y-Rotation basierend auf Scroll-Position
      const parallaxRotationY = progress * Math.PI * 0.3; // Reduzierte Rotation für natürlicheren Effekt
      starField.rotation.y =
        (starField.userData.baseRotationY || 0) + parallaxRotationY;

      // Zusätzliche X-Rotation für 3D-Effekt
      const parallaxRotationX = Math.sin(progress * Math.PI * 2) * 0.1; // Subtile Neigung
      starField.rotation.x = parallaxRotationX;

      // Subtile Z-Position-Änderung für Tiefeneffekt (parallel zu CSS-Sternen)
      const parallaxZ = Math.sin(progress * Math.PI) * 15; // Sanftere Bewegung
      starField.position.z = parallaxZ;

      // Y-Position-Änderung für vertikale Parallax (wie bei CSS-Sternen)
      const parallaxY = scrollY * 0.02; // Sehr subtil, wie im atmospheric-sky-system
      starField.position.y = parallaxY;

      // Opacity-Variation basierend auf Scroll-Position
      if (starField.material) {
        const baseOpacity = starField.userData.baseOpacity || 0.9;
        const scrollOpacity =
          baseOpacity * (0.7 + Math.sin(progress * Math.PI) * 0.3);
        starField.material.opacity = Math.max(
          0.4,
          Math.min(1.0, scrollOpacity)
        );
      }
    } catch (error) {
      log.error("Star parallax error:", error);
    }
  };

  // Initial setup
  const starField = scene?.getObjectByName("starField");
  if (starField) {
    starField.userData.baseRotationY = starField.rotation.y;
    starField.userData.baseOpacity = starField.material?.opacity || 0.9;
  }

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
  const sunLight = new THREE.DirectionalLight(0xffffff, 2.0);
  sunLight.position.set(5, 3, 5);
  sunLight.castShadow = true;

  if (sunLight.castShadow) {
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 50;
  }

  scene.add(sunLight);

  // Umgebungslicht
  const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
  scene.add(ambientLight);

  // Rim Light für cinematischen Effekt
  const rimLight = new THREE.DirectionalLight(0x4477ff, 0.8);
  rimLight.position.set(-5, 2, -5);
  scene.add(rimLight);
}

// ===== Earth-System erstellen =====
async function createEarthSystem(THREE) {
  // Hohe Qualität - feste Werte
  const earthRadius = 3.5; // Vergrößert für Horizont-Effekt
  const segments = 128;

  const earthGeometry = new THREE.SphereGeometry(
    earthRadius,
    segments,
    segments
  );

  // Earth-Material erstellen
  const earthMaterial = await createEarthMaterial(THREE);

  earthMesh = new THREE.Mesh(earthGeometry, earthMaterial);
  earthMesh.position.y = -2.8; // Entsprechend der Größe nach unten für Horizont-Effekt
  earthMesh.castShadow = true;
  earthMesh.receiveShadow = true;
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
        "/content/img/earth/textures/earth_day.jpg",
        2000
      )
    );

    // Alle Texturen laden (hohe Qualität)
    promises.push(
      loadTextureWithFallback(
        textureLoader,
        "/content/img/earth/textures/earth_night.jpg",
        2000
      )
    );
    promises.push(
      loadTextureWithFallback(
        textureLoader,
        "/content/img/earth/textures/earth_normal.jpg",
        2000
      )
    );
    promises.push(
      loadTextureWithFallback(
        textureLoader,
        "/content/img/earth/textures/earth_bump.jpg",
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

    if (dayTexture && nightTexture) {
      // Shader Material für Day/Night Cycle (high quality)
      material = new THREE.ShaderMaterial({
        uniforms: {
          dayTexture: { value: dayTexture },
          nightTexture: { value: nightTexture },
          normalTexture: { value: normalTexture },
          sunPosition: { value: new THREE.Vector3(5, 3, 5) },
          atmosphereThickness: { value: 0.1 },
          time: { value: 0 },
        },
        vertexShader: getEarthVertexShader(),
        fragmentShader: getEarthFragmentShader(),
      });
    } else if (dayTexture) {
      // Standard Material mit Day Texture - nur definierte Texturen verwenden
      const materialConfig = {
        map: dayTexture,
        bumpScale: 0.1,
        shininess: 0.3,
        specular: 0x222222,
      };

      // Nur hinzufügen wenn Texturen definiert sind
      if (normalTexture) {
        materialConfig.normalMap = normalTexture;
      }
      if (bumpTexture) {
        materialConfig.bumpMap = bumpTexture;
      }

      material = new THREE.MeshPhongMaterial(materialConfig);
    } else {
      // Fallback zu prozeduralem Material
      material = createProceduralEarthMaterial(THREE);
    }

    // Texture-Optimierungen
    [dayTexture, nightTexture, normalTexture, bumpTexture].forEach(
      (texture) => {
        if (texture) {
          texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
          texture.generateMipmaps = true;
          texture.minFilter = THREE.LinearMipmapLinearFilter;
          texture.magFilter = THREE.LinearFilter;
          texture.anisotropy = Math.min(
            renderer.capabilities.getMaxAnisotropy(),
            4
          );
        }
      }
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
  let attempts = 0;
  const baseDelay = 1000; // 1 Sekunde Basis-Verzögerung

  while (attempts < maxRetries) {
    try {
      return await loadTextureWithTimeout(loader, url, timeout);
    } catch (error) {
      attempts++;
      log.warn(
        `Texture loading attempt ${attempts}/${maxRetries} failed: ${url}`,
        error
      );

      if (attempts >= maxRetries) {
        log.error(`All texture loading attempts failed: ${url}`);
        throw error;
      }

      // Exponential backoff: 1s, 2s, 4s
      const delay = baseDelay * Math.pow(2, attempts - 1);
      log.info(`Retrying texture load in ${delay}ms: ${url}`);
      await sleep(delay);
    }
  }
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

// ===== Prozedurales Earth-Material =====
function createProceduralEarthMaterial(THREE) {
  return new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      resolution: { value: new THREE.Vector2(512, 512) },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vPosition;
      
      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float time;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vPosition;
      
      // Noise functions
      float noise(vec2 co) {
        return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
      }
      
      vec3 oceanColor = vec3(0.1, 0.3, 0.8);
      vec3 landColor = vec3(0.3, 0.6, 0.2);
      vec3 desertColor = vec3(0.8, 0.7, 0.3);
      vec3 mountainColor = vec3(0.5, 0.4, 0.3);
      
      void main() {
        vec2 uv = vUv;
        
        // Kontinental-Noise
        float continent = noise(uv * 4.0);
        float detail = noise(uv * 16.0) * 0.5;
        float terrain = continent + detail * 0.3;
        
        vec3 color;
        if (terrain < 0.4) {
          color = oceanColor;
        } else if (terrain < 0.6) {
          color = mix(oceanColor, landColor, (terrain - 0.4) * 5.0);
        } else if (terrain < 0.8) {
          color = mix(landColor, desertColor, (terrain - 0.6) * 5.0);
        } else {
          color = mix(desertColor, mountainColor, (terrain - 0.8) * 5.0);
        }
        
        // Atmosphärischer Effekt am Rand
        float fresnel = dot(vNormal, vec3(0, 0, 1));
        fresnel = pow(1.0 - fresnel, 2.0);
        color = mix(color, vec3(0.2, 0.5, 1.0), fresnel * 0.3);
        
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });
}

// ===== Earth Vertex Shader =====
function getEarthVertexShader() {
  return `
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vSunDirection;
    varying vec3 vPosition;
    
    uniform vec3 sunPosition;
    
    void main() {
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);
      vPosition = position;
      
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vSunDirection = normalize(sunPosition - worldPosition.xyz);
      
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;
}

// ===== Earth Fragment Shader =====
function getEarthFragmentShader() {
  return `
    uniform sampler2D dayTexture;
    uniform sampler2D nightTexture;
    uniform sampler2D normalTexture;
    uniform float time;
    
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vSunDirection;
    varying vec3 vPosition;
    
    void main() {
      vec3 dayColor = texture2D(dayTexture, vUv).rgb;
      vec3 nightColor = texture2D(nightTexture, vUv).rgb;
      
      // Normal mapping
      vec3 normalColor = texture2D(normalTexture, vUv).rgb;
      vec3 normal = normalize(vNormal + (normalColor - 0.5) * 0.1);
      
      // Day/Night transition
      float sunFactor = dot(normal, vSunDirection);
      float dayNightMix = smoothstep(-0.1, 0.1, sunFactor);
      
      vec3 color = mix(nightColor * 0.3, dayColor, dayNightMix);
      
      // Atmosphärischer Rim-Effekt
      float fresnel = 1.0 - dot(normal, vec3(0, 0, 1));
      fresnel = pow(fresnel, 2.0);
      color = mix(color, vec3(0.3, 0.6, 1.0), fresnel * 0.2);
      
      gl_FragColor = vec4(color, 1.0);
    }
  `;
}

// ===== Kamera-System Setup =====
function setupCameraSystem(THREE) {
  // Initial Kamera-Position
  updateCameraForSection("hero");

  // LERP-basierte Kamera-Animation
  const lerpFactor = 0.05; // Smooth interpolation

  function updateCameraPosition() {
    // Position LERP
    cameraPosition.x += (cameraTarget.x - cameraPosition.x) * lerpFactor;
    cameraPosition.y += (cameraTarget.y - cameraPosition.y) * lerpFactor;
    cameraPosition.z += (cameraTarget.z - cameraPosition.z) * lerpFactor;

    // Rotation LERP für cinematischen Pitch
    camera.position.set(cameraPosition.x, cameraPosition.y, cameraPosition.z);
    camera.rotation.x += (cameraRotation.x - camera.rotation.x) * lerpFactor;
    camera.rotation.y += (cameraRotation.y - camera.rotation.y) * lerpFactor;

    // Look-at mit leichter lateraler Bewegung
    const lookAtTarget = new THREE.Vector3(
      Math.sin(Date.now() * 0.0005) * 0.1, // Subtile X-Bewegung
      Math.sin(Date.now() * 0.0008) * 0.05, // Subtile Y-Bewegung
      0
    );
    camera.lookAt(lookAtTarget);
  }

  // In Animation Loop integrieren
  sharedCleanupManager.addCleanupFunction(
    "three-earth",
    () => {
      // Cleanup für Kamera-System (falls nötig)
    },
    "camera system cleanup"
  );

  window.updateCameraPosition = updateCameraPosition; // Für Animation Loop

  log.debug("Camera system setup completed");
}

// ===== Kamera für Section anpassen =====
function updateCameraForSection(sectionName) {
  const cameraConfigs = {
    hero: {
      position: { x: 0, y: -1.5, z: 6 }, // Y nach unten für Horizont-Effekt
      rotation: { x: 0.15, y: 0 }, // Leicht nach unten blicken
      fov: 45, // Weiterer FOV für dramatischen Effekt
    },
    features: {
      position: { x: 2, y: 1, z: 6 },
      rotation: { x: -0.1, y: 0 },
      fov: 40,
    },
    about: {
      position: { x: -1, y: 2, z: 7 },
      rotation: { x: -0.2, y: 0.1 },
      fov: 45,
    },
    contact: {
      position: { x: 0, y: -1, z: 10 },
      rotation: { x: 0.1, y: 0 },
      fov: 30,
    },
  };

  const config = cameraConfigs[sectionName] || cameraConfigs.hero;

  // Ziel-Position und -Rotation setzen (wird via LERP erreicht)
  cameraTarget = { ...config.position };
  cameraRotation = { ...config.rotation };

  // FOV anpassen
  if (camera && camera.fov !== config.fov) {
    camera.fov = config.fov;
    camera.updateProjectionMatrix();
  }

  log.debug(`Camera updated for section: ${sectionName}`, config);
}

// ===== User Controls Setup =====
function setupUserControls(container) {
  let isUserInteracting = false;
  const mouseStart = { x: 0, y: 0 };
  const cameraStart = { x: 0, y: 0 };

  // Scroll-basierte Controls (Standard)
  const handleScroll = throttle(() => {
    if (!isScrollBased) return;

    const scrollY = window.pageYOffset;
    const windowHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;
    scrollProgress = Math.min(
      1,
      Math.max(0, scrollY / Math.max(1, documentHeight - windowHeight))
    );

    // Earth-Rotation basierend auf Scroll
    if (earthMesh) {
      earthMesh.rotation.y = scrollProgress * Math.PI * 2;
    }
  }, 16);

  // Mouse Controls für freie Kamera (optional)
  function enableFreeCamera() {
    isScrollBased = false;
    log.debug("Free camera mode enabled");
  }

  function enableScrollCamera() {
    isScrollBased = true;
    log.debug("Scroll-based camera mode enabled");
  }

  // Touch/Mouse Interaction
  const handlePointerDown = (event) => {
    if (isScrollBased) return;

    isUserInteracting = true;
    mouseStart.x = event.clientX || event.touches[0].clientX;
    mouseStart.y = event.clientY || event.touches[0].clientY;
    cameraStart.x = cameraRotation.x;
    cameraStart.y = cameraRotation.y;

    container.style.cursor = "grabbing";
  };

  const handlePointerMove = (event) => {
    if (!isUserInteracting || isScrollBased) return;

    const clientX = event.clientX || event.touches[0].clientX;
    const clientY = event.clientY || event.touches[0].clientY;

    const deltaX = clientX - mouseStart.x;
    const deltaY = clientY - mouseStart.y;

    cameraRotation.y = cameraStart.y + deltaX * 0.005;
    cameraRotation.x = Math.max(
      -Math.PI / 3,
      Math.min(Math.PI / 3, cameraStart.x - deltaY * 0.005)
    );
  };

  const handlePointerUp = () => {
    isUserInteracting = false;
    container.style.cursor = "grab";
  };

  // Pointer Events Setup mit shared utilities
  const pointerCleanup = setupPointerEvents(
    container,
    {
      onStart: handlePointerDown,
      onMove: handlePointerMove,
      onEnd: handlePointerUp,
    },
    { passive: false }
  ); // Nicht-passive für preventDefault

  // Scroll Events Setup
  const scrollCleanup = onScroll(handleScroll);

  // Cleanup
  sharedCleanupManager.addCleanupFunction(
    "three-earth",
    () => {
      scrollCleanup();
      pointerCleanup();
    },
    "user controls cleanup"
  );

  // Public API für Kontrolle
  window.ThreeEarthControls = {
    enableFreeCamera,
    enableScrollCamera,
    isScrollBased: () => isScrollBased,
  };

  log.debug("User controls setup completed");
}

// ===== Postprocessing Setup =====
async function setupPostprocessing(THREE) {
  try {
    // EffectComposer dynamisch laden (falls verfügbar)
    if (window.THREE.EffectComposer) {
      composer = new THREE.EffectComposer(renderer);

      // Render Pass
      const renderPass = new THREE.RenderPass(scene, camera);
      composer.addPass(renderPass);

      // Film Grain Pass (cinematic effect)
      if (window.THREE.FilmPass) {
        const filmPass = new THREE.FilmPass(0.5, 0.125, 2048, false);
        composer.addPass(filmPass);
      }

      // Bloom Pass (für Atmosphäre)
      if (window.THREE.UnrealBloomPass) {
        const bloomPass = new THREE.UnrealBloomPass(
          new THREE.Vector2(window.innerWidth, window.innerHeight),
          0.5, // strength
          0.8, // radius
          0.1 // threshold
        );
        composer.addPass(bloomPass);
      }

      log.debug("Postprocessing setup completed");
    }
  } catch (error) {
    log.warn("Postprocessing setup failed, continuing without:", error);
  }
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
  setTimeout(() => {
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
      scale: 1.0,
      rotationSpeed: 0.002,
      starTwinkle: 0.3,
      starBrightness: 1.0, // Hellere Sterne
      starRotation: 0.0001,
    },
    features: {
      scale: 1.2,
      rotationSpeed: 0.001,
      starTwinkle: 0.25,
      starBrightness: 0.9, // Heller als vorher
      starRotation: 0.00008,
    },
    about: {
      scale: 0.8,
      rotationSpeed: 0.003,
      starTwinkle: 0.35,
      starBrightness: 1.0,
      starRotation: 0.00012,
    },
    contact: {
      scale: 1.5,
      rotationSpeed: 0.0005,
      starTwinkle: 0.2,
      starBrightness: 0.85, // Heller als vorher
      starRotation: 0.00006,
    },
  };

  const config = sectionConfigs[sectionName] || sectionConfigs.hero;

  // Scale Animation mit LERP
  earthMesh.userData.targetScale = config.scale;
  earthMesh.userData.rotationSpeed = config.rotationSpeed;

  // Stern-System für Section anpassen
  updateStarFieldForSection(config);

  log.debug(`Earth updated for section: ${sectionName}`, config);
}

function updateStarFieldForSection(config) {
  const starField = scene?.getObjectByName("starField");
  if (!starField || !starField.material) return;

  // Stern-Parameter für Section setzen
  starField.userData.twinkleIntensity = config.starTwinkle;
  starField.userData.brightness = config.starBrightness;
  starField.userData.rotationSpeed = config.starRotation;

  // Basis-Helligkeit setzen
  starField.material.opacity = config.starBrightness * 0.8;
}

// ===== Animation Loop =====
function startAnimationLoop(THREE) {
  const clock = new THREE.Clock();
  function animate() {
    animationFrameId = requestAnimationFrame(animate);

    const deltaTime = clock.getDelta();

    // Earth Updates mit Scale-Animation
    updateEarthRotation();
    updateEarthScale(deltaTime);

    // Subtile Stern-Animation
    updateStarField(clock.getElapsedTime());

    // Kamera-Position Update (LERP)
    if (window.updateCameraPosition) {
      window.updateCameraPosition();
    }

    // Rendern
    renderFrame();
  }

  function renderFrame() {
    try {
      if (composer) {
        composer.render();
      } else {
        renderer.render(scene, camera);
      }
    } catch (error) {
      log.error("Render error:", error);

      // Simple fallback: disable composer and retry
      composer = null;
      try {
        renderer.render(scene, camera);
      } catch (fallbackError) {
        log.error(
          "Critical render failure, stopping animation:",
          fallbackError
        );
        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId);
          animationFrameId = null;
        }
      }
    }
  }

  function updateEarthRotation() {
    if (!earthMesh) return;

    if (isScrollBased) {
      // Bereits in scroll handler gesetzt
    } else {
      earthMesh.rotation.y += earthMesh.userData.rotationSpeed || 0.002;
    }

    // Scale LERP
    if (earthMesh.userData.targetScale) {
      const { targetScale } = earthMesh.userData;
      earthMesh.scale.lerp(
        new THREE.Vector3(targetScale, targetScale, targetScale),
        0.02
      );
    }
  }

  function updateEarthScale(deltaTime) {
    if (!earthMesh) return;

    // Erweiterte Scale-Animation mit verbessertem Easing
    const targetScale = earthMesh.userData.targetScale || 1.0;
    const currentScale = earthMesh.scale.x;
    const scaleDiff = targetScale - currentScale;

    if (Math.abs(scaleDiff) > 0.001) {
      // Exponential easing für natürlichere Animation
      const lerpFactor = Math.min(deltaTime * 4.0, 1.0);
      const easedFactor = 1 - Math.pow(1 - lerpFactor, 3); // Ease out cubic
      const newScale = currentScale + scaleDiff * easedFactor;
      earthMesh.scale.set(newScale, newScale, newScale);
    }
  }

  function updateStarField(elapsedTime) {
    const starField = scene?.getObjectByName("starField");
    if (!starField) return;

    // Section-spezifische Parameter verwenden
    const twinkleIntensity = starField.userData.twinkleIntensity || 0.2;
    const brightness = starField.userData.brightness || 0.9;
    const rotationSpeed = starField.userData.rotationSpeed || 0.0001;

    // Subtile Rotation des gesamten Sternfeldes
    starField.rotation.y = elapsedTime * rotationSpeed;

    // Funkeln-Effekt durch Opacity-Variation (verstärkt für bessere Sichtbarkeit)
    if (starField.material) {
      // Kombiniertes Funkeln mit verschiedenen Frequenzen für natürlicheren Effekt
      const mainTwinkle = Math.sin(elapsedTime * 0.5) * twinkleIntensity;
      const fastTwinkle =
        Math.sin(elapsedTime * 2.0) * (twinkleIntensity * 0.3);
      const combined = brightness * (0.7 + mainTwinkle + fastTwinkle);
      starField.material.opacity = Math.max(0.4, Math.min(1.0, combined));
    }
  }

  // Rendering wird in der vorherigen renderFrame() Funktion durchgeführt

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

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    renderer.setSize(width, height);

    if (composer) {
      composer.setSize(width, height);
    }

    log.debug("Three.js resized", { width, height });
  };

  // Resize Event mit shared utility (inkl. Throttling)
  const resizeCleanup = onResize(handleResize, 100);

  sharedCleanupManager.addCleanupFunction(
    "three-earth",
    resizeCleanup,
    "resize handler cleanup"
  );
}

// ===== Public API & Module Export =====
/**
 * Initialisiert das Three.js Earth System mit 3D-Erde und Sternen
 * @returns {Promise<Function>} Cleanup-Funktion für das System
 */
export async function initThreeEarth() {
  log.debug("Initializing Three.js Earth system");

  const container = getElementById("threeEarthContainer");
  if (!container) {
    log.warn("Three.js Earth container element not found");
    return () => {}; // Konsistenter Return: immer eine Cleanup-Funktion
  }

  return await ThreeEarthManager.initThreeEarth();
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
      }. CSS-Fallback wird verwendet.`;
    }
  }

  log.error("Error state activated:", error);

  // Accessibility announcement
  if (window.announce) {
    window.announce(
      "3D-Darstellung konnte nicht geladen werden. Vereinfachte Ansicht wird verwendet.",
      { assertive: true }
    );
  }
}

export const { cleanup } = ThreeEarthManager;

// Default Export für Kompatibilität
export default {
  initThreeEarth,
  cleanup,
};
