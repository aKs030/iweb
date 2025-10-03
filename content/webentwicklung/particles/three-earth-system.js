/**
 * Three.js Earth System - 3D WebGL Erde mit Sternen
 *
 * High-Quality 3D-Erdvisualisierung mit:
 * - Realistische Erdtexturen (Day/Night/Bump/Normal Maps)
 * - Prozedurales Sternfeld mit custom Texturen
 * - Scroll-basierte Kamera-Controls
 * - Section-responsive Animationsübergänge
 * - Performance-optimiertes Rendering
 * - Touch-Gesten und Inertia-basierte Controls
 *
 * Verwendet shared-particle-system für Parallax-Synchronisation.
 *
 * @author Portfolio System
 * @version 2.1.0
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
  setupPointerEvents,
  throttle,
  TimerManager,
} from "../shared-utilities.js";

const log = createLogger("threeEarthSystem");

// Timer Manager für Three.js Earth System
const earthTimers = new TimerManager();

// ===== Globale Variablen =====
let scene, camera, renderer, earthMesh;
let sectionObserver = null;
let animationFrameId = null;
let currentSection = "hero";

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

    // Global references zurücksetzen
    scene = null;
    camera = null;
    renderer = null;
    earthMesh = null;
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

  // Renderer-Optimierungen für PBR (Physically Based Rendering)
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  
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

  // Tone Mapping für realistische HDR-Farben
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0; // Reduziert für natürlichere Farben

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

// ===== Dezentes Sternsystem mit Performance-Optimierungen =====
function createStarField(THREE) {
  const starGeometry = new THREE.BufferGeometry();
  const starCount = 1500; // Dezente Anzahl von Sternen

  // ===== PERFORMANCE: Optimierte Buffer-Geometrie =====
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

  // ===== PERFORMANCE: Static Draw für unveränderliche Geometrie =====
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

  // ===== PERFORMANCE: Optimiertes Material mit Blending =====
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
  const starField = new THREE.Points(starGeometry, starMaterial);
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
  // Parallax-Handler zum shared system hinzufügen
  const parallaxHandler = (progress, scrollY) => {
    try {
      const starField = scene?.getObjectByName("starField");
      if (!starField) return;

      // Parallax-Bewegung für Sternfeld
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
      const parallaxY = scrollY * 0.02; // Sehr subtile vertikale Parallax-Bewegung
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
  // Hauptlichtquelle (Sonne) - Intensität für physicallyCorrectLights angepasst
  const sunLight = new THREE.DirectionalLight(0xfff8f0, 3.5); // Wärmeres Sonnenlicht, stärker für PBR
  sunLight.position.set(5, 3, 5);
  sunLight.castShadow = true;

  if (sunLight.castShadow) {
    sunLight.shadow.mapSize.width = 4096; // Höhere Auflösung für schärfere Schatten
    sunLight.shadow.mapSize.height = 4096;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 50;
    sunLight.shadow.bias = -0.0001; // Reduziert Shadow-Acne
    sunLight.shadow.radius = 2; // Weichere Schatten
  }

  scene.add(sunLight);

  // Umgebungslicht - stärker für PBR, simuliert Himmelsstreuung
  const ambientLight = new THREE.AmbientLight(0x8899bb, 0.8); // Leicht bläulicher Himmel, heller
  scene.add(ambientLight);

  // Hemisphere Light für realistischeren Himmel-/Boden-Übergang
  const hemiLight = new THREE.HemisphereLight(0x8899ff, 0x332211, 0.5);
  hemiLight.position.set(0, 50, 0);
  scene.add(hemiLight);

  // Rim Light für cinematischen Effekt - kühlerer Ton
  const rimLight = new THREE.DirectionalLight(0x6699ff, 0.6); // Kühlerer Blauton, reduziert
  rimLight.position.set(-5, 2, -5);
  scene.add(rimLight);
  
  log.debug("PBR lighting setup completed");
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
  // Position wird dynamisch durch Section-Configs gesetzt (siehe updateEarthForSection)
  earthMesh.position.set(0, -4.5, 0); // Initial Hero-Position
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

    if (dayTexture && nightTexture) {
      // Shader Material für Day/Night Cycle (high quality)
      material = new THREE.ShaderMaterial({
        uniforms: {
          dayTexture: { value: dayTexture },
          nightTexture: { value: nightTexture },
          normalTexture: { value: normalTexture },
          sunPosition: { value: new THREE.Vector3(5, 3, 5) },
          time: { value: 0 },
        },
        vertexShader: getEarthVertexShader(),
        fragmentShader: getEarthFragmentShader(),
      });
    } else if (dayTexture) {
      // PBR Material (MeshStandardMaterial) für realistisches Rendering
      const materialConfig = {
        map: dayTexture,
        
        // Physikalisch korrekte Werte für die Erde
        roughness: 0.9, // Erde ist nicht glänzend (Ozeane werden später via roughnessMap variiert)
        metalness: 0.0, // Erde ist nicht metallisch
        
        // Displacement & Normal Maps für Oberflächendetails
        displacementScale: 0.0, // Kein Displacement (würde Geometrie ändern)
        normalScale: new THREE.Vector2(1.5, 1.5), // Verstärkte Normal-Map für sichtbare Bergketten
        
        // Environment Mapping für Reflexionen
        envMapIntensity: 0.3, // Subtile Umgebungsreflexionen
        
        // Beleuchtung
        emissive: 0x000000, // Keine Eigenleuchten (Day-Texture)
        emissiveIntensity: 0.0,
      };

      // Nur hinzufügen wenn Texturen definiert sind
      if (normalTexture) {
        materialConfig.normalMap = normalTexture;
        log.debug("Normal map applied for surface details");
      }
      if (bumpTexture) {
        materialConfig.bumpMap = bumpTexture;
        materialConfig.bumpScale = 0.02; // Subtile Bump für zusätzliche Tiefe
        log.debug("Bump map applied for additional depth");
      }

      material = new THREE.MeshStandardMaterial(materialConfig);
      log.info("Using PBR MeshStandardMaterial for realistic Earth rendering");
    } else {
      // Fallback zu prozeduralem Material
      material = createProceduralEarthMaterial(THREE);
    }

    // Texture-Optimierungen für maximale Qualität
    [dayTexture, nightTexture, normalTexture, bumpTexture].forEach(
      (texture) => {
        if (texture) {
          texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
          texture.generateMipmaps = true;
          texture.minFilter = THREE.LinearMipmapLinearFilter;
          texture.magFilter = THREE.LinearFilter;
          // Maximale Anisotropie für schärfste Texturen
          texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
          texture.needsUpdate = true;
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
  // ===== OPTIMIERUNG: WebP-Support mit automatischem JPG-Fallback =====
  // Versuche zuerst WebP zu laden (58.9% kleiner), dann JPG als Fallback
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
      position: { x: 0, y: -1.8, z: 5 }, // Näher für bessere Detail-Sichtbarkeit
      rotation: { x: 0.2, y: 0 }, // Nach unten blicken für Horizont-Effekt
      fov: 45, // Ausgewogener FOV für natürliche Perspektive
    },
    features: {
      position: { x: -3, y: 2.5, z: 6.5 }, // Von links oben - elegante Diagonale
      rotation: { x: -0.3, y: 0.4 }, // Nach unten und leicht nach rechts gedreht
      fov: 42, // Ausgewogener FOV für natürliche Perspektive
    },
    about: {
      position: { x: 0, y: 1, z: 30 }, // Maximale Distanz für extrem kleine Erde
      rotation: { x: -0.15, y: 0 }, // Leicht nach unten für Überblick
      fov: 25, // Sehr enger FOV für maximalen Verkleinerungs-Effekt
    },
    contact: {
      position: { x: 0, y: 3, z: 8 }, // Von oben, weiter weg - "Gott-Perspektive"
      rotation: { x: -0.35, y: 0 }, // Nach unten blicken auf die Erde
      fov: 38, // Engerer FOV für fokussierten, meditativen Blick
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
// ===== Erweiterte User Controls mit Touch-Gesten & Smooth Dampening =====
function setupUserControls(container) {
  let isUserInteracting = false;
  const mouseStart = { x: 0, y: 0 };
  const cameraStart = { x: 0, y: 0 };

  // Touch-Gesten State
  let touchStartDistance = 0;
  let initialZoom = 5;
  let currentZoom = 5;
  let targetZoom = 5;

  // Velocity für Inertia
  let velocity = { x: 0, y: 0 };
  const dampingFactor = 0.95; // Smooth dampening
  const maxVelocity = 0.1;

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
    container.style.cursor = "grab";
    log.debug("Free camera mode enabled");
  }

  function enableScrollCamera() {
    isScrollBased = true;
    container.style.cursor = "";
    log.debug("Scroll-based camera mode enabled");
  }

  // Pinch-to-Zoom für Touch
  const handleTouchStart = (event) => {
    if (isScrollBased) return;

    if (event.touches.length === 2) {
      // Two-finger gestures
      const dx = event.touches[0].clientX - event.touches[1].clientX;
      const dy = event.touches[0].clientY - event.touches[1].clientY;
      touchStartDistance = Math.sqrt(dx * dx + dy * dy);
      initialZoom = currentZoom;
      event.preventDefault();
    } else if (event.touches.length === 1) {
      // Single touch drag
      isUserInteracting = true;
      mouseStart.x = event.touches[0].clientX;
      mouseStart.y = event.touches[0].clientY;
      cameraStart.x = cameraRotation.x;
      cameraStart.y = cameraRotation.y;
      velocity = { x: 0, y: 0 }; // Reset velocity
    }
  };

  const handleTouchMove = (event) => {
    if (!isScrollBased && event.touches.length === 2) {
      // Pinch-to-Zoom
      const dx = event.touches[0].clientX - event.touches[1].clientX;
      const dy = event.touches[0].clientY - event.touches[1].clientY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      const scale = touchStartDistance / distance;
      targetZoom = Math.max(2, Math.min(15, initialZoom * scale));
      event.preventDefault();
    } else if (isUserInteracting && event.touches.length === 1) {
      // Single touch drag with velocity tracking
      const clientX = event.touches[0].clientX;
      const clientY = event.touches[0].clientY;

      const deltaX = clientX - mouseStart.x;
      const deltaY = clientY - mouseStart.y;

      // Update velocity for inertia
      velocity.x = deltaX * 0.005;
      velocity.y = -deltaY * 0.005;

      cameraRotation.y = cameraStart.y + deltaX * 0.005;
      cameraRotation.x = Math.max(
        -Math.PI / 3,
        Math.min(Math.PI / 3, cameraStart.x - deltaY * 0.005)
      );

      event.preventDefault();
    }
  };

  const handleTouchEnd = (event) => {
    if (event.touches.length === 0) {
      isUserInteracting = false;
    }
  };

  // Touch/Mouse Interaction
  const handlePointerDown = (event) => {
    if (isScrollBased || event.touches) return; // Touch wird separat behandelt

    isUserInteracting = true;
    mouseStart.x = event.clientX;
    mouseStart.y = event.clientY;
    cameraStart.x = cameraRotation.x;
    cameraStart.y = cameraRotation.y;
    velocity = { x: 0, y: 0 }; // Reset velocity

    container.style.cursor = "grabbing";
  };

  const handlePointerMove = (event) => {
    if (!isUserInteracting || isScrollBased || event.touches) return;

    const clientX = event.clientX;
    const clientY = event.clientY;

    const deltaX = clientX - mouseStart.x;
    const deltaY = clientY - mouseStart.y;

    // Update velocity for inertia
    velocity.x = deltaX * 0.005;
    velocity.y = -deltaY * 0.005;

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

  // Mouse Wheel Zoom
  const handleWheel = (event) => {
    if (isScrollBased) return;

    event.preventDefault();
    const delta = event.deltaY * 0.01;
    targetZoom = Math.max(2, Math.min(15, targetZoom + delta));
  };

  // Inertia & Smooth Dampening Animation
  function updateInertia() {
    if (!isUserInteracting && !isScrollBased) {
      // Apply velocity with dampening
      if (Math.abs(velocity.x) > 0.001 || Math.abs(velocity.y) > 0.001) {
        cameraRotation.y += velocity.x;
        cameraRotation.x += velocity.y;

        // Clamp rotation
        cameraRotation.x = Math.max(
          -Math.PI / 3,
          Math.min(Math.PI / 3, cameraRotation.x)
        );

        // Apply dampening
        velocity.x *= dampingFactor;
        velocity.y *= dampingFactor;

        // Clamp velocity
        velocity.x = Math.max(-maxVelocity, Math.min(maxVelocity, velocity.x));
        velocity.y = Math.max(-maxVelocity, Math.min(maxVelocity, velocity.y));
      }

      // Smooth zoom interpolation
      if (Math.abs(currentZoom - targetZoom) > 0.01) {
        currentZoom += (targetZoom - currentZoom) * 0.1;
        cameraTarget.z = currentZoom;
      }
    }
  }

  // Touch Events (separate für bessere Kontrolle)
  container.addEventListener("touchstart", handleTouchStart, {
    passive: false,
  });
  container.addEventListener("touchmove", handleTouchMove, { passive: false });
  container.addEventListener("touchend", handleTouchEnd, { passive: false });
  container.addEventListener("wheel", handleWheel, { passive: false });

  // Pointer Events Setup mit shared utilities (nur für Maus)
  const pointerCleanup = setupPointerEvents(
    container,
    {
      onStart: handlePointerDown,
      onMove: handlePointerMove,
      onEnd: handlePointerUp,
    },
    { passive: false }
  );

  // Scroll Events Setup
  const scrollCleanup = onScroll(handleScroll);

  // Cleanup
  sharedCleanupManager.addCleanupFunction(
    "three-earth",
    () => {
      scrollCleanup();
      pointerCleanup();
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
      container.removeEventListener("wheel", handleWheel);
    },
    "user controls cleanup"
  );

  // Public API für Kontrolle
  window.ThreeEarthControls = {
    enableFreeCamera,
    enableScrollCamera,
    isScrollBased: () => isScrollBased,
    updateInertia, // Export für Animation-Loop
    getZoom: () => currentZoom,
    setZoom: (zoom) => {
      targetZoom = zoom;
    },
  };

  log.debug(
    "Enhanced user controls setup completed (Touch gestures, Inertia, Zoom)"
  );
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
      position: { x: 0, y: -4.5, z: 0 }, // Tief unten für Horizont-Effekt
      scale: 1.5, // Größer für bessere Detail-Sichtbarkeit der Texturen
      rotationSpeed: 0.0015, // Optimale Geschwindigkeit für realistische Erdrotation
      starTwinkle: 0.25, // Moderates Funkeln
      starBrightness: 0.9, // Nicht zu hell, damit Erde im Fokus bleibt
      starRotation: 0.00008,
    },
    features: {
      position: { x: 1, y: -1, z: -0.5 }, // Leicht rechts und unten, etwas zurück
      scale: 1.0, // Normal-Größe
      rotationSpeed: 0.0015,
      starTwinkle: 0.25,
      starBrightness: 0.9,
      starRotation: 0.00008,
    },
    about: {
      position: { x: 0, y: 0, z: -2 }, // Zentriert, leicht zurück
      scale: 0.35, // Extrem klein für maximalen "Pale Blue Dot"-Effekt
      rotationSpeed: 0.0008, // Noch langsamere Rotation
      starTwinkle: 0.5, // Maximales Sternen-Funkeln
      starBrightness: 1.2, // Maximale Sternenhelligkeit
      starRotation: 0.00008,
    },
    contact: {
      position: { x: 0, y: 0.5, z: -1 }, // Leicht oben, weiter hinten
      scale: 0.85, // Kleiner für "von oben"-Perspektive
      rotationSpeed: 0.0008,
      starTwinkle: 0.2,
      starBrightness: 0.85,
      starRotation: 0.00006,
    },
  };

  const config = sectionConfigs[sectionName] || sectionConfigs.hero;

  // Position Animation mit LERP (Ziel setzen)
  if (config.position) {
    earthMesh.userData.targetPosition = { ...config.position };
  }

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

// ===== Animation Loop mit Inertia-Updates =====
function startAnimationLoop(THREE) {
  const clock = new THREE.Clock();
  function animate() {
    animationFrameId = requestAnimationFrame(animate);

    const deltaTime = clock.getDelta();

    // Inertia & Smooth Controls Update
    if (window.ThreeEarthControls?.updateInertia) {
      window.ThreeEarthControls.updateInertia();
    }

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
      renderer.render(scene, camera);
    } catch (error) {
      log.error("Render error:", error);

      // Critical render failure, stop animation
      log.error("Critical render failure, stopping animation:", error);
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
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

    // Position LERP - smooth transition zwischen Sections
    if (earthMesh.userData.targetPosition) {
      const { targetPosition } = earthMesh.userData;
      earthMesh.position.lerp(
        new THREE.Vector3(targetPosition.x, targetPosition.y, targetPosition.z),
        0.03 // Etwas schneller als Scale für dynamischeren Effekt
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

export const { initThreeEarth, cleanup } = ThreeEarthManager;

// Default Export für Kompatibilität
export default ThreeEarthManager;
