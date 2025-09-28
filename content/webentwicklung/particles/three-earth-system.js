// Three.js Earth System - Erweiterte Version mit Kamera-Effekten
import { getElementById, throttle } from '../utils/common-utils.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('threeEarthSystem');

// ===== Globale Variablen =====
let isInitialized = false;
let cleanupFunctions = [];
let scene, camera, renderer, earthMesh, cloudMesh, composer;
let starField, nebulae; // Sterne-System
let animationFrameId = null;
let currentSection = 'hero';
let sectionObserver = null;

// Kamera und Animation States
let cameraTarget = { x: 0, y: 0, z: 5 };
let cameraPosition = { x: 0, y: 0, z: 5 };
let cameraRotation = { x: 0, y: 0 };
let scrollProgress = 0;
let isScrollBased = true;

// Performance States
let isLowPerformanceMode = false;
let lodLevel = 1; // 1 = hoch, 2 = medium, 3 = niedrig
let lastFrameTime = 0;
let performanceWarningCount = 0; // Verhindert Spam-Warnings
let lastPerformanceCheck = 0;

// ===== Three.js Earth System Manager =====
const ThreeEarthManager = (() => {
  const initThreeEarth = async () => {
    if (isInitialized) {
      log.debug('Three.js Earth system already initialized');
      return cleanup;
    }

    const container = getElementById('threeEarthContainer');
    if (!container) {
      log.warn('Three.js Earth container not found');
      const noOpCleanup = () => {};
      return noOpCleanup;
    }

    try {
      log.info('Initializing Three.js Earth system');

      // Loading State aktivieren
      showLoadingState(container);

      // Three.js laden
      const THREE = await loadThreeJS();
      if (!THREE) {
        throw new Error('Three.js failed to load from all sources');
      }

      // Performance-Detection
      detectPerformanceCapabilities();

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
      setupSectionDetection(container);

      // Animation Loop starten
      startAnimationLoop(THREE);

      // Resize Handler
      setupResizeHandler();

      // Loading State verstecken
      hideLoadingState(container);

      isInitialized = true;
      log.info('Three.js Earth system initialized successfully');

      return cleanup;
    } catch (error) {
      log.error('Failed to initialize Three.js Earth system:', error);
      showErrorState(container, error);
      const noOpCleanup = () => {};
      return noOpCleanup;
    }
  };

  const cleanup = () => {
    log.info('Cleaning up Three.js Earth system');

    // Animation stoppen
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }

    // Cleanup-Funktionen aufrufen
    cleanupFunctions.forEach((fn) => {
      try {
        fn();
      } catch (error) {
        log.error('Error during cleanup:', error);
      }
    });

    // Three.js Objekte disposal
    if (scene) {
      scene.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((material) => material.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
    }

    if (renderer) {
      renderer.dispose();
    }

    if (composer) {
      composer.dispose();
    }

    // Observer disconnecten
    if (sectionObserver) {
      sectionObserver.disconnect();
      sectionObserver = null;
    }

    cleanupFunctions = [];
    isInitialized = false;
    currentSection = 'hero';
  };

  return { initThreeEarth, cleanup };
})();

// ===== Three.js ES Module Loading =====
async function loadThreeJS() {
  try {
    // Prüfen ob Three.js bereits verfügbar ist
    if (window.THREE) {
      log.debug('Three.js already available');
      return window.THREE;
    }

    // ES Module Loading Strategy (empfohlen für r150+)
    const moduleLoadingSources = [
      // 1. Lokales ES Module
      '/content/webentwicklung/lib/three/build/three.module.js',
      // 2. CDN ES Module Fallback
      'https://unpkg.com/three@0.150.0/build/three.module.js',
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
    log.info('ES Module loading failed, trying legacy script loading');
    const legacySources = [
      '/content/webentwicklung/lib/three/build/three.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/three.js/r150/three.min.js',
      'https://unpkg.com/three@0.150.0/build/three.min.js',
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

    throw new Error('All Three.js loading sources failed');
  } catch (error) {
    log.error('Error loading Three.js:', error);
    return null;
  }
}

// Helper function für einzelne Quelle
function loadFromSource(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.crossOrigin = 'anonymous';

    script.onload = () => {
      if (window.THREE) {
        resolve(window.THREE);
      } else {
        reject(new Error('THREE not available after loading'));
      }
    };

    script.onerror = (error) => {
      reject(
        new Error(`Script loading failed: ${error.message || 'Unknown error'}`)
      );
    };

    // Timeout nach 8 Sekunden pro Quelle
    const timeout = setTimeout(() => {
      reject(new Error('Loading timeout'));
    }, 8000);

    script.onload = () => {
      clearTimeout(timeout);
      if (window.THREE) {
        resolve(window.THREE);
      } else {
        reject(new Error('THREE not available after loading'));
      }
    };

    script.onerror = (error) => {
      clearTimeout(timeout);
      reject(
        new Error(`Script loading failed: ${error.message || 'Unknown error'}`)
      );
    };

    document.head.appendChild(script);
  });
}

// ===== Performance Detection =====
function detectPerformanceCapabilities() {
  // Mobile Detection
  const isMobile =
    /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    ) || window.matchMedia('(max-width: 768px), (pointer: coarse)').matches;

  // Performance-basierte LOD-Einstellungen
  if (isMobile) {
    isLowPerformanceMode = true;
    lodLevel = 3;
    log.info('Low performance mode enabled (mobile device)');
  } else {
    // WebGL Performance Test
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

    if (gl) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      const renderer = debugInfo
        ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
        : '';

      if (renderer.includes('Intel') || renderer.includes('Software')) {
        isLowPerformanceMode = true;
        lodLevel = 2;
        log.info('Medium performance mode enabled (integrated graphics)');
      } else {
        lodLevel = 1;
        log.info('High performance mode enabled');
      }
    }
  }

  // Memory-basierte Anpassungen
  if (navigator.deviceMemory && navigator.deviceMemory < 4) {
    isLowPerformanceMode = true;
    lodLevel = Math.max(lodLevel, 2);
    log.info('Performance adjusted for low memory device');
  }
}

// ===== Scene Setup =====
async function setupScene(THREE, container) {
  // Scene erstellen
  scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x000511, 20, 100);

  // Kamera erstellen mit cinematic FOV
  const aspectRatio = container.clientWidth / container.clientHeight;
  camera = new THREE.PerspectiveCamera(35, aspectRatio, 0.1, 1000); // Cinematic 35mm FOV

  // Renderer erstellen mit Performance-Optimierungen
  renderer = new THREE.WebGLRenderer({
    antialias: !isLowPerformanceMode,
    alpha: true,
    powerPreference: isLowPerformanceMode ? 'low-power' : 'high-performance',
  });

  // Pixel Ratio optimieren
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setClearColor(0x000000, 0); // Transparent für Overlay

  // Renderer-Optimierungen
  renderer.shadowMap.enabled = !isLowPerformanceMode;
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
    log.debug('Using legacy Three.js compatibility mode');
  }

  container.appendChild(renderer.domElement);

  // Beleuchtung Setup
  setupLighting(THREE);

  log.debug('Scene setup completed', {
    performance: isLowPerformanceMode ? 'low' : 'high',
    lod: lodLevel,
    pixelRatio: renderer.getPixelRatio(),
  });
}

// ===== Beleuchtung Setup =====
function setupLighting(THREE) {
  // Hauptlichtquelle (Sonne)
  const sunLight = new THREE.DirectionalLight(
    0xffffff,
    isLowPerformanceMode ? 1.5 : 2.0
  );
  sunLight.position.set(5, 3, 5);
  sunLight.castShadow = !isLowPerformanceMode;

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
  if (!isLowPerformanceMode) {
    const rimLight = new THREE.DirectionalLight(0x4477ff, 0.8);
    rimLight.position.set(-5, 2, -5);
    scene.add(rimLight);
  }

  // Sterne im Hintergrund (nur high performance)
  if (!isLowPerformanceMode) {
    createStarField(THREE);
  }
}

// ===== Erweitertes Sternenfeld-System =====
function createStarField(THREE) {
  // Verschiedene Stern-Schichten für Tiefe
  const starLayers = [
    {
      name: 'distant',
      count: isLowPerformanceMode ? 800 : 3000,
      distance: 80,
      size: 0.15,
    },
    {
      name: 'medium',
      count: isLowPerformanceMode ? 300 : 1200,
      distance: 60,
      size: 0.3,
    },
    {
      name: 'close',
      count: isLowPerformanceMode ? 200 : 800,
      distance: 40,
      size: 0.6,
    },
  ];

  starField = new THREE.Group();

  starLayers.forEach((layer, layerIndex) => {
    const starsGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(layer.count * 3);
    const colors = new Float32Array(layer.count * 3);
    const sizes = new Float32Array(layer.count);
    const twinkle = new Float32Array(layer.count);

    for (let i = 0; i < layer.count; i++) {
      const i3 = i * 3;

      // Realistische Stern-Verteilung (mehr Sterne in der Milchstraßen-Ebene)
      let phi, theta;
      if (Math.random() < 0.6) {
        // Milchstraßen-Band (60% der Sterne)
        phi = (Math.random() - 0.5) * 0.5 + Math.PI / 2; // Schmales Band
        theta = Math.random() * Math.PI * 2;
      } else {
        // Gleichmäßige Verteilung (40% der Sterne)
        phi = Math.acos(2 * Math.random() - 1);
        theta = Math.random() * Math.PI * 2;
      }

      const radius = layer.distance + Math.random() * 20;

      positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i3 + 2] = radius * Math.cos(phi);

      // Realistische Stern-Spektralklassen
      const color = new THREE.Color();
      const stellarClass = Math.random();

      if (stellarClass < 0.6) {
        // Normale Sterne (meist weiß-gelblich) - Subtile Farben
        const hue = 0.08 + Math.random() * 0.05; // Sehr leicht gelblich
        const saturation = 0.1 + Math.random() * 0.15; // Sehr geringe Sättigung
        const lightness = 0.8 + Math.random() * 0.15; // Helle, aber nicht überstrahlende Sterne
        color.setHSL(hue, saturation, lightness);
      } else if (stellarClass < 0.8) {
        // Leicht bläuliche Sterne - Sehr subtil
        const hue = 0.55 + Math.random() * 0.05; // Leicht bläulich
        const saturation = 0.08 + Math.random() * 0.12; // Minimale Sättigung
        const lightness = 0.85 + Math.random() * 0.1;
        color.setHSL(hue, saturation, lightness);
      } else if (stellarClass < 0.95) {
        // Leicht rötliche Sterne - Sehr subtil
        const hue = 0.02 + Math.random() * 0.02; // Minimal rötlich
        const saturation = 0.15 + Math.random() * 0.15; // Geringe Sättigung
        const lightness = 0.7 + Math.random() * 0.2;
        color.setHSL(hue, saturation, lightness);
      } else {
        // Seltene helle Sterne - Immer noch subtil
        const hue = 0.58 + Math.random() * 0.03; // Leicht bläulich
        const saturation = 0.2 + Math.random() * 0.15; // Mäßige Sättigung
        const lightness = 0.9 + Math.random() * 0.05;
        color.setHSL(hue, saturation, lightness);
      }

      colors[i3] = color.r;
      colors[i3 + 1] = color.g;
      colors[i3 + 2] = color.b;

      // Größenvariationen basierend auf Helligkeitsklasse
      const magnitude = Math.random();
      if (magnitude < 0.05) {
        sizes[i] = layer.size * (3.5 + Math.random() * 2.5); // Seltene helle Riesen
      } else if (magnitude < 0.15) {
        sizes[i] = layer.size * (2.2 + Math.random() * 0.8); // Mittelhelle Sterne
      } else {
        sizes[i] = layer.size * (1.2 + Math.random() * 1.3); // Normale Hauptreihensterne
      }

      // Twinkle-Parameter für Animation
      twinkle[i] = Math.random() * Math.PI * 2;
    }

    starsGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(positions, 3)
    );
    starsGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    starsGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    starsGeometry.setAttribute(
      'twinkle',
      new THREE.BufferAttribute(twinkle, 1)
    );

    // Erweiterte Shader für realistische Sterne
    const starsMaterial = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        pixelRatio: { value: window.devicePixelRatio },
        twinkleIntensity: { value: layerIndex === 0 ? 0.15 : 0.25 }, // Sehr subtiles Twinkle
        brightnessVariation: { value: 0.2 }, // Reduzierte Helligkeitsvariation
      },
      vertexShader: `
        uniform float time;
        uniform float pixelRatio;
        uniform float twinkleIntensity;
        
        attribute float size;
        attribute float twinkle;
        attribute vec3 color;
        
        varying vec3 vColor;
        varying float vTwinkle;
        
        void main() {
          vColor = color;
          
          // Twinkle-Animation mit verschiedenen Frequenzen
          float twinklePhase = twinkle + time * (0.5 + sin(twinkle) * 0.3);
          vTwinkle = 0.7 + sin(twinklePhase) * twinkleIntensity;
          
          // Dynamische Größenberechnung
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          
          // Größe basierend auf Entfernung und Twinkle
          float finalSize = size * vTwinkle * pixelRatio;
          finalSize *= (300.0 / -mvPosition.z); // Entfernungsbasierte Skalierung
          
          gl_PointSize = finalSize;
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform float brightnessVariation;
        
        varying vec3 vColor;
        varying float vTwinkle;
        
        void main() {
          // Weicher Kreis mit Glow-Effekt
          vec2 center = gl_PointCoord - 0.5;
          float distance = length(center);
          
          // Stern-Form mit dezenten Cross-Spikes für sehr helle Sterne
          float alpha = 1.0 - smoothstep(0.2, 0.6, distance);
          
          // Sehr subtile Kreuz-Spikes nur für hellste Sterne
          if (vTwinkle > 0.95) {
            float spike1 = 1.0 - smoothstep(0.0, 0.03, abs(center.x));
            float spike2 = 1.0 - smoothstep(0.0, 0.03, abs(center.y));
            alpha += (spike1 + spike2) * 0.1 * smoothstep(0.3, 0.6, distance);
          }
          
          // Sanfte Helligkeitsvariation über Zeit
          float brightness = vTwinkle * (0.9 + sin(time * 1.5 + gl_PointCoord.x * 8.0) * brightnessVariation * 0.5);
          
          vec3 finalColor = vColor * brightness;
          
          gl_FragColor = vec4(finalColor, alpha * vTwinkle * 0.8);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const stars = new THREE.Points(starsGeometry, starsMaterial);
    stars.name = `starLayer_${layer.name}`;
    starField.add(stars);
  });

  // Schwache Nebel-Effekte hinzufügen
  createNebulae(THREE);

  scene.add(starField);

  const totalStars = starLayers.reduce((sum, layer) => sum + layer.count, 0);
  log.debug(
    `Created enhanced star field with ${totalStars} stars in ${starLayers.length} layers`
  );
}

// ===== Nebel-Effekte erstellen =====
function createNebulae(THREE) {
  if (isLowPerformanceMode) return; // Keine Nebel bei niedriger Performance

  nebulae = new THREE.Group();

  // Verschiedene Nebel-Typen
  const nebulaTypes = [
    { color: new THREE.Color(0.8, 0.3, 0.9), size: 15, opacity: 0.08 }, // Violett
    { color: new THREE.Color(0.3, 0.8, 0.9), size: 18, opacity: 0.06 }, // Cyan
    { color: new THREE.Color(0.9, 0.6, 0.3), size: 12, opacity: 0.04 }, // Orange
    { color: new THREE.Color(0.4, 0.9, 0.5), size: 20, opacity: 0.05 }, // Grün
  ];

  nebulaTypes.forEach((type, index) => {
    const geometry = new THREE.SphereGeometry(type.size, 16, 16);

    const material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        color: { value: type.color },
        opacity: { value: type.opacity },
      },
      vertexShader: `
        varying vec3 vPosition;
        void main() {
          vPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform vec3 color;
        uniform float opacity;
        varying vec3 vPosition;
        
        // Simple noise function
        float noise(vec3 pos) {
          return fract(sin(dot(pos.xyz, vec3(12.9898, 78.233, 45.164))) * 43758.5453);
        }
        
        void main() {
          vec3 pos = vPosition + time * 0.1;
          float n = noise(pos * 0.5) * noise(pos * 1.2) * noise(pos * 2.0);
          
          float alpha = n * opacity * (1.0 - length(vPosition) / 20.0);
          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const nebula = new THREE.Mesh(geometry, material);

    // Positioniere Nebel in verschiedenen Bereichen des Himmels
    const angle = (index / nebulaTypes.length) * Math.PI * 2;
    nebula.position.set(
      Math.cos(angle) * 70,
      (Math.random() - 0.5) * 30,
      Math.sin(angle) * 70
    );

    nebulae.add(nebula);
  });

  starField.add(nebulae);
  log.debug(`Created ${nebulaTypes.length} nebulae effects`);
}

// ===== Earth-System erstellen =====
async function createEarthSystem(THREE) {
  // LOD-basierte Geometrie-Auflösung
  const earthRadius = 3.5; // Vergrößert für Horizont-Effekt
  let segments;

  switch (lodLevel) {
  case 1:
    segments = 128;
    break; // High quality
  case 2:
    segments = 64;
    break; // Medium quality
  case 3:
    segments = 32;
    break; // Low quality
  }

  const earthGeometry = new THREE.SphereGeometry(
    earthRadius,
    segments,
    segments
  );

  // Earth-Material mit optimierten Texturen
  const earthMaterial = await createEarthMaterial(THREE);

  earthMesh = new THREE.Mesh(earthGeometry, earthMaterial);
  earthMesh.position.y = -2.8; // Entsprechend der Größe nach unten für Horizont-Effekt
  earthMesh.castShadow = !isLowPerformanceMode;
  earthMesh.receiveShadow = !isLowPerformanceMode;
  scene.add(earthMesh);

  // Wolken-System (nur für high/medium performance)
  if (lodLevel <= 2) {
    await createCloudSystem(THREE, earthRadius);
  }

  // Atmosphäre
  createAtmosphere(THREE, earthRadius);

  log.debug('Earth system created', { segments, lodLevel });
}

// ===== Earth-Material erstellen =====
async function createEarthMaterial(THREE) {
  const textureLoader = new THREE.TextureLoader();

  try {
    log.debug('Attempting to load Earth textures...');

    // Texturen laden mit kurzen Timeouts für schnellen Fallback
    const promises = [];

    // Day texture - essentiell
    promises.push(
      loadTextureWithFallback(
        textureLoader,
        '/content/img/earth/textures/earth_day.jpg',
        2000
      )
    );

    // Zusätzliche Texturen nur bei High Performance
    if (lodLevel === 1) {
      promises.push(
        loadTextureWithFallback(
          textureLoader,
          '/content/img/earth/textures/earth_night.jpg',
          2000
        )
      );
      promises.push(
        loadTextureWithFallback(
          textureLoader,
          '/content/img/earth/textures/earth_normal.jpg',
          2000
        )
      );
      promises.push(
        loadTextureWithFallback(
          textureLoader,
          '/content/img/earth/textures/earth_bump.jpg',
          2000
        )
      );
    }

    const textures = await Promise.allSettled(promises);
    const [dayTexture, nightTexture, normalTexture, bumpTexture] = textures.map(
      (result) => (result.status === 'fulfilled' ? result.value : null)
    );

    // Debug: Texture-Status loggen
    log.debug('Texture loading results:', {
      dayTexture: !!dayTexture,
      nightTexture: !!nightTexture,
      normalTexture: !!normalTexture,
      bumpTexture: !!bumpTexture,
    });

    // Prüfen ob mindestens eine Textur geladen wurde
    const loadedTextures = textures.filter(
      (result) => result.status === 'fulfilled'
    ).length;

    if (loadedTextures === 0) {
      log.info('No textures loaded, using procedural Earth material');
      return createProceduralEarthMaterial(THREE);
    }

    log.debug(`Loaded ${loadedTextures} textures, creating material`);

    // Material basierend auf verfügbaren Texturen
    let material;

    if (dayTexture && lodLevel === 1 && nightTexture) {
      // Shader Material für Day/Night Cycle (nur high performance)
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
    log.warn('Failed to load textures, using procedural material:', error);
    return createProceduralEarthMaterial(THREE);
  }
}

// ===== Texture Loading mit Fallback und Timeout =====
async function loadTextureWithFallback(loader, url, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      log.warn(`Texture loading timeout: ${url}`);
      reject(new Error(`Timeout loading ${url}`));
    }, timeout);

    loader.load(
      url,
      (texture) => {
        clearTimeout(timer);
        resolve(texture);
      },
      undefined, // onProgress
      (error) => {
        clearTimeout(timer);
        log.warn(`Failed to load texture: ${url}`, error);
        reject(error);
      }
    );
  });
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

// ===== Wolken-System erstellen =====
async function createCloudSystem(THREE, earthRadius) {
  const cloudRadius = earthRadius + 0.08; // Leicht erhöht für besseren Effekt

  // Verbesserte LOD-basierte Segmente
  let segments;
  switch (lodLevel) {
  case 1:
    segments = 96;
    break;
  case 2:
    segments = 64;
    break;
  default:
    segments = 32;
    break;
  }

  const cloudGeometry = new THREE.SphereGeometry(
    cloudRadius,
    segments,
    segments
  );

  // Optimiertes prozedurales Wolken-Material
  const cloudMaterial = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      opacity: { value: 0.7 },
      cloudSpeed: { value: 0.3 },
      cloudDensity: { value: 0.8 },
      windDirection: { value: new THREE.Vector2(1.0, 0.2) },
      atmosphereColor: { value: new THREE.Color(0.9, 0.95, 1.0) },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vWorldPosition;
      
      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPos.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float time;
      uniform float opacity;
      uniform float cloudSpeed;
      uniform float cloudDensity;
      uniform vec2 windDirection;
      uniform vec3 atmosphereColor;
      
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vWorldPosition;
      
      // Verbesserte Noise-Funktionen
      vec2 hash22(vec2 p) {
        p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
        return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
      }
      
      float noise(vec2 p) {
        const float K1 = 0.366025404; // (sqrt(3)-1)/2
        const float K2 = 0.211324865; // (3-sqrt(3))/6
        
        vec2 i = floor(p + (p.x + p.y) * K1);
        vec2 a = p - i + (i.x + i.y) * K2;
        vec2 o = step(a.yx, a.xy);
        vec2 b = a - o + K2;
        vec2 c = a - 1.0 + 2.0 * K2;
        
        vec3 h = max(0.5 - vec3(dot(a, a), dot(b, b), dot(c, c)), 0.0);
        vec3 n = h * h * h * h * vec3(dot(a, hash22(i + 0.0)), dot(b, hash22(i + o)), dot(c, hash22(i + 1.0)));
        
        return dot(n, vec3(70.0));
      }
      
      float fbm(vec2 uv, int octaves) {
        float value = 0.0;
        float amplitude = 0.5;
        float frequency = 1.0;
        
        for (int i = 0; i < octaves; i++) {
          value += amplitude * noise(uv * frequency);
          amplitude *= 0.5;
          frequency *= 1.9;
        }
        
        return value;
      }
      
      void main() {
        // Dynamische UV-Koordinaten mit Windrichtung
        vec2 windUV = vUv + time * cloudSpeed * 0.08 * windDirection;
        vec2 detailUV = vUv + time * cloudSpeed * 0.15 * windDirection.yx;
        
        // Multi-Layer-Wolken mit verschiedenen Frequenzen
        float baseClouds = fbm(windUV * 4.0, 3);
        float detailClouds = fbm(detailUV * 12.0, 2) * 0.3;
        float microDetails = fbm(windUV * 24.0, 1) * 0.1;
        
        float clouds = baseClouds + detailClouds + microDetails;
        clouds = smoothstep(0.35, 0.85, clouds * cloudDensity);
        
        // Höhenbasierte Dichte-Variation
        float heightFactor = smoothstep(-0.5, 0.5, vWorldPosition.y);
        clouds *= heightFactor;
        
        // Fresnel-Effekt für Atmosphäre
        float fresnel = 1.0 - dot(normalize(vNormal), vec3(0, 0, 1));
        fresnel = pow(fresnel, 1.5);
        
        // Alpha-Berechnung mit Atmosphäre-Integration
        float alpha = clouds * opacity;
        alpha *= (1.0 - fresnel * 0.4); // Reduzierter Fresnel-Effekt
        
        // Atmosphärische Farbanpassung
        vec3 cloudColor = mix(vec3(1.0), atmosphereColor, fresnel * 0.3);
        
        gl_FragColor = vec4(cloudColor, alpha);
      }
    `,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false, // Performance-Optimierung für Transparenz
    blending: THREE.NormalBlending,
  });

  cloudMesh = new THREE.Mesh(cloudGeometry, cloudMaterial);
  cloudMesh.position.y = -2.8; // Gleiche Y-Position wie die Erde
  scene.add(cloudMesh);

  log.debug('Cloud system created');
}

// ===== Atmosphäre erstellen =====
function createAtmosphere(_THREE, _earthRadius) {
  // Atmosphäre komplett deaktiviert - Early Return
  log.debug('Atmosphere creation disabled - no blue atmosphere around Earth');
}

// ===== Kamera-System Setup =====
function setupCameraSystem(THREE) {
  // Initial Kamera-Position
  updateCameraForSection('hero');

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
  cleanupFunctions.push(() => {
    // Cleanup für Kamera-System (falls nötig)
  });

  window.updateCameraPosition = updateCameraPosition; // Für Animation Loop

  log.debug('Camera system setup completed');
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
  let mouseStart = { x: 0, y: 0 };
  let cameraStart = { x: 0, y: 0 };

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

    if (cloudMesh) {
      cloudMesh.rotation.y = scrollProgress * Math.PI * 1.5;
    }
  }, 16);

  window.addEventListener('scroll', handleScroll, { passive: true });

  // Mouse Controls für freie Kamera (optional)
  function enableFreeCamera() {
    isScrollBased = false;
    log.debug('Free camera mode enabled');
  }

  function enableScrollCamera() {
    isScrollBased = true;
    log.debug('Scroll-based camera mode enabled');
  }

  // Touch/Mouse Interaction
  const handlePointerDown = (event) => {
    if (isScrollBased) return;

    isUserInteracting = true;
    mouseStart.x = event.clientX || event.touches[0].clientX;
    mouseStart.y = event.clientY || event.touches[0].clientY;
    cameraStart.x = cameraRotation.x;
    cameraStart.y = cameraRotation.y;

    container.style.cursor = 'grabbing';
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
    container.style.cursor = 'grab';
  };

  // Event Listeners
  container.addEventListener('mousedown', handlePointerDown);
  container.addEventListener('mousemove', handlePointerMove);
  container.addEventListener('mouseup', handlePointerUp);
  container.addEventListener('mouseleave', handlePointerUp);

  // Touch Events
  container.addEventListener('touchstart', handlePointerDown, {
    passive: true,
  });
  container.addEventListener('touchmove', handlePointerMove, { passive: true });
  container.addEventListener('touchend', handlePointerUp);

  // Cleanup
  cleanupFunctions.push(() => {
    window.removeEventListener('scroll', handleScroll);
    container.removeEventListener('mousedown', handlePointerDown);
    container.removeEventListener('mousemove', handlePointerMove);
    container.removeEventListener('mouseup', handlePointerUp);
    container.removeEventListener('mouseleave', handlePointerUp);
    container.removeEventListener('touchstart', handlePointerDown);
    container.removeEventListener('touchmove', handlePointerMove);
    container.removeEventListener('touchend', handlePointerUp);
  });

  // Public API für Kontrolle
  window.ThreeEarthControls = {
    enableFreeCamera,
    enableScrollCamera,
    isScrollBased: () => isScrollBased,
  };

  log.debug('User controls setup completed');
}

// ===== Zoom Controls erstellen =====
// ===== Postprocessing Setup =====
async function setupPostprocessing(THREE) {
  if (isLowPerformanceMode) {
    log.debug('Postprocessing disabled for performance');
    return;
  }

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

      log.debug('Postprocessing setup completed');
    }
  } catch (error) {
    log.warn('Postprocessing setup failed, continuing without:', error);
  }
}

// ===== Section Detection Setup =====
function setupSectionDetection(_container) {
  const sections = document.querySelectorAll('section[id]');
  if (sections.length === 0) {
    log.warn('No sections found for detection');
    return;
  }

  const observerOptions = {
    root: null,
    rootMargin: '-20% 0px -20% 0px',
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
    const initialSection = document.querySelector('#hero') || sections[0];
    if (initialSection) {
      currentSection = initialSection.id;
      updateCameraForSection(currentSection);
      updateEarthForSection(currentSection);
    }
  }, 100);

  log.debug('Section detection setup completed');
}

// ===== Earth für Section anpassen =====
// ===== Earth für Section anpassen =====
function updateEarthForSection(sectionName) {
  if (!earthMesh) return;

  const sectionConfigs = {
    hero: {
      scale: 1.0,
      rotationSpeed: 0.002,
      starTwinkle: 0.2,
      starBrightness: 0.9,
      nebulaOpacity: 0.4,
    },
    features: {
      scale: 1.2,
      rotationSpeed: 0.001,
      starTwinkle: 0.15,
      starBrightness: 0.8,
      nebulaOpacity: 0.3,
    },
    about: {
      scale: 0.8,
      rotationSpeed: 0.003,
      starTwinkle: 0.25,
      starBrightness: 1.0,
      nebulaOpacity: 0.5,
    },
    contact: {
      scale: 1.5,
      rotationSpeed: 0.0005,
      starTwinkle: 0.1,
      starBrightness: 0.7,
      nebulaOpacity: 0.2,
    },
  };

  const config = sectionConfigs[sectionName] || sectionConfigs.hero;

  // Scale Animation mit LERP
  earthMesh.userData.targetScale = config.scale;
  earthMesh.userData.rotationSpeed = config.rotationSpeed;

  // Sterne-Konfiguration anpassen
  if (starField) {
    starField.children.forEach((starLayer) => {
      if (starLayer.material?.uniforms) {
        if (starLayer.material.uniforms.twinkleIntensity) {
          starLayer.material.uniforms.twinkleIntensity.value =
            config.starTwinkle;
        }
        if (starLayer.material.uniforms.brightnessVariation) {
          starLayer.material.uniforms.brightnessVariation.value =
            config.starBrightness;
        }
      }
    });
  }

  // Nebel-Opacity anpassen
  if (nebulae) {
    nebulae.children.forEach((nebula) => {
      if (nebula.material?.uniforms?.opacity) {
        const baseOpacity = nebula.material.uniforms.opacity.value;
        nebula.material.uniforms.opacity.value =
          baseOpacity * config.nebulaOpacity;
      }
    });
  }

  log.debug(`Earth and stars updated for section: ${sectionName}`, config);
}

// ===== Animation Loop =====
function startAnimationLoop(THREE) {
  const clock = new THREE.Clock();
  let frameCount = 0;
  let atmosphereUpdateCounter = 0;

  function animate() {
    animationFrameId = requestAnimationFrame(animate);

    const deltaTime = clock.getDelta();
    const elapsedTime = clock.getElapsedTime();

    // Performance Monitoring
    frameCount++;
    if (frameCount % 60 === 0) {
      checkPerformance();
    }

    // Earth Updates mit Scale-Animation
    updateEarthRotation();
    updateEarthScale(deltaTime);

    // Cloud Updates
    updateClouds(elapsedTime);

    // Sterne Updates mit verbesserter Performance
    updateStars(elapsedTime);
    updateStarsForSection();

    // Atmosphäre Updates (weniger häufig für Performance)
    atmosphereUpdateCounter++;
    if (atmosphereUpdateCounter % 2 === 0) {
      // Jeder 2. Frame
      updateAtmosphereEffects(elapsedTime, deltaTime);
    }

    // Kamera-Position Update (LERP)
    if (window.updateCameraPosition) {
      window.updateCameraPosition();
    }

    // Shader-Uniforms aktualisieren
    updateShaderUniforms(elapsedTime);

    // Rendern
    renderFrame();

    // LOD Culling für entfernte Objekte (nur mobile)
    if (isLowPerformanceMode) {
      performLODCulling();
    }
  }

  // Spezialisierte Update-Funktionen für Atmosphäre
  function updateAtmosphereEffects(elapsedTime, _deltaTime) {
    scene.traverse((child) => {
      // Atmosphäre-Material Updates
      if (child.material?.uniforms?.time) {
        child.material.uniforms.time.value = elapsedTime;

        // Sonnenposition über Zeit animieren
        if (child.material.uniforms.sunPosition) {
          const sunAngle = elapsedTime * 0.02;
          child.material.uniforms.sunPosition.value.set(
            Math.cos(sunAngle) * 5,
            Math.sin(sunAngle * 0.5) * 3 + 2,
            Math.sin(sunAngle) * 5
          );
        }

        // Turbidität basierend auf Tageszeit
        if (child.material.uniforms.turbidity) {
          const timeOfDay = (Math.sin(elapsedTime * 0.01) + 1) * 0.5;
          child.material.uniforms.turbidity.value = 1.8 + timeOfDay * 0.8;
        }

        // Atmosphärische Intensität pulsieren lassen
        if (child.material.uniforms.intensity) {
          const baseIntensity = 1.4; // Basis-Wert
          const pulse = Math.sin(elapsedTime * 0.3) * 0.1 + 1;
          child.material.uniforms.intensity.value = baseIntensity * pulse;
        }
      }
    });
  }

  function renderFrame() {
    try {
      if (composer && !isLowPerformanceMode) {
        composer.render();
      } else {
        renderer.render(scene, camera);
      }
    } catch (error) {
      log.error('Render error:', error);
      // Fallback zu standard rendering
      renderer.render(scene, camera);
    }
  }

  function checkPerformance() {
    const currentTime = performance.now();
    if (lastFrameTime > 0) {
      const frameDuration = currentTime - lastFrameTime;
      const fps = 1000 / frameDuration;

      // Performance-Checks nur alle 3 Sekunden zur Spam-Vermeidung
      if (currentTime - lastPerformanceCheck < 3000) {
        lastFrameTime = currentTime;
        return;
      }
      lastPerformanceCheck = currentTime;

      // Automatische Qualitätsanpassung mit begrenzten Warnings
      if (fps < 20 && lodLevel < 3) {
        lodLevel = Math.min(3, lodLevel + 1); // Erhöhe LOD Level (reduziere Qualität)
        if (performanceWarningCount < 2) {
          // Max 2 Warnings zur Console-Spam-Vermeidung
          log.warn(`Performance niedrig (${Math.round(fps)} FPS), Qualität auf LOD ${lodLevel} reduziert`);
          performanceWarningCount++;
        }
        // Shader-Komplexität reduzieren
        scene.traverse((child) => {
          if (child.material?.defines) {
            child.material.defines.LOW_QUALITY = true;
            child.material.needsUpdate = true;
          }
        });
      } else if (fps > 55 && lodLevel > 1) {
        lodLevel = Math.max(1, lodLevel - 1); // Reduziere LOD Level (erhöhe Qualität)
        if (performanceWarningCount > 0) {
          performanceWarningCount--; // Reset warning counter bei Verbesserung
        }
        log.info(
          `Performance verbessert (${Math.round(fps)} FPS), Qualität auf LOD ${lodLevel} erhöht`
        );
        // Low quality flags entfernen
        scene.traverse((child) => {
          if (child.material?.defines?.LOW_QUALITY) {
            delete child.material.defines.LOW_QUALITY;
            child.material.needsUpdate = true;
          }
        });
      }
    }
    lastFrameTime = currentTime;
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
      const targetScale = earthMesh.userData.targetScale;
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

  function updateStarsForSection() {
    // Dynamische Sterne-Updates basierend auf aktueller Sektion
    if (!starField || !window.currentSection) return;

    const sectionName = window.currentSection;
    const sectionConfigs = {
      hero: { twinkleSpeed: 0.8, brightness: 0.9 },
      features: { twinkleSpeed: 0.6, brightness: 0.8 },
      about: { twinkleSpeed: 1.0, brightness: 1.0 },
      contact: { twinkleSpeed: 0.4, brightness: 0.7 },
    };

    const config = sectionConfigs[sectionName] || sectionConfigs.hero;

    starField.children.forEach((starLayer, layerIndex) => {
      if (starLayer.material?.uniforms) {
        // Twinkle-Speed basierend auf Layer-Distanz
        const layerMultiplier = (layerIndex + 1) * 0.3;
        if (starLayer.material.uniforms.time) {
          starLayer.material.uniforms.twinkleSpeed = {
            value: config.twinkleSpeed * layerMultiplier,
          };
        }

        // Brightness-Anpassung
        if (starLayer.material.uniforms.brightnessVariation) {
          starLayer.material.uniforms.brightnessVariation.value =
            config.brightness;
        }
      }
    });
  }

  function updateClouds(elapsedTime) {
    if (!cloudMesh) return;

    cloudMesh.rotation.y += 0.001;

    // Wolken-Material Zeit-Update
    if (cloudMesh.material.uniforms?.time) {
      cloudMesh.material.uniforms.time.value = elapsedTime;
    }
  }

  // ===== Sterne Updates =====
  function updateStars(elapsedTime) {
    if (!starField) return;

    // Sterne-Material Uniforms aktualisieren
    starField.children.forEach((child) => {
      if (child.material?.uniforms?.time) {
        child.material.uniforms.time.value = elapsedTime;
      }
    });

    // Nebel animieren (falls vorhanden)
    if (nebulae) {
      nebulae.children.forEach((nebula, index) => {
        if (nebula.material?.uniforms?.time) {
          nebula.material.uniforms.time.value = elapsedTime;
        }

        // Sanfte Rotation der Nebel
        nebula.rotation.y += 0.001 * (index + 1);
        nebula.rotation.z += 0.0005 * (index + 1);
      });
    }

    // Parallax-Effekt für Sterne basierend auf Kamera-Bewegung
    if (camera) {
      const parallaxStrength = 0.02;
      starField.rotation.x = camera.rotation.x * parallaxStrength;
      starField.rotation.y = camera.rotation.y * parallaxStrength;
    }
  }

  function updateShaderUniforms(elapsedTime) {
    scene.traverse((child) => {
      if (child.material?.uniforms?.time) {
        child.material.uniforms.time.value = elapsedTime;
      }
    });
  }

  // Rendering wird in der vorherigen renderFrame() Funktion durchgeführt

  animate();
  log.debug('Animation loop started');
}

// ===== LOD Culling für Performance =====
function performLODCulling() {
  scene.traverse((child) => {
    if (child.isMesh) {
      // Objekte > 50 Einheiten entfernen
      const distance = camera.position.distanceTo(child.position);

      if (distance > 50) {
        child.visible = false;
      } else {
        child.visible = true;

        // Material-LOD basierend auf Entfernung
        if (child.material && distance > 20) {
          // Reduzierte Shader-Qualität bei Entfernung
          if (child.material.uniforms?.quality) {
            child.material.uniforms.quality.value = 0.5;
          }
        }
      }
    }
  });
}

// ===== Resize Handler =====
function setupResizeHandler() {
  const handleResize = throttle(() => {
    const container = getElementById('threeEarthContainer');
    if (!container || !camera || !renderer) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    renderer.setSize(width, height);

    if (composer) {
      composer.setSize(width, height);
    }

    log.debug('Three.js resized', { width, height });
  }, 100);

  window.addEventListener('resize', handleResize);

  cleanupFunctions.push(() => {
    window.removeEventListener('resize', handleResize);
  });
}

// ===== Public API & Module Export =====
export async function initThreeEarth() {
  log.debug('Initializing Three.js Earth system');

  const container = getElementById('threeEarthContainer');
  if (!container) {
    log.warn('Three.js Earth container element not found');
    return () => {}; // Konsistenter Return: immer eine Cleanup-Funktion
  }

  return await ThreeEarthManager.initThreeEarth();
}

// ===== UI State Management =====
function showLoadingState(container) {
  container.classList.add('loading');

  const loadingElement = container.querySelector('.three-earth-loading');
  const errorElement = container.querySelector('.three-earth-error');

  if (loadingElement) loadingElement.classList.remove('hidden');
  if (errorElement) errorElement.classList.add('hidden');

  log.debug('Loading state activated');
}

function hideLoadingState(container) {
  container.classList.remove('loading');

  const loadingElement = container.querySelector('.three-earth-loading');
  if (loadingElement) loadingElement.classList.add('hidden');

  log.debug('Loading state deactivated');
}

function showErrorState(container, error) {
  container.classList.add('error');
  container.classList.remove('loading');

  const loadingElement = container.querySelector('.three-earth-loading');
  const errorElement = container.querySelector('.three-earth-error');

  if (loadingElement) loadingElement.classList.add('hidden');
  if (errorElement) {
    errorElement.classList.remove('hidden');

    // Error message aktualisieren
    const errorText = errorElement.querySelector('p');
    if (errorText) {
      errorText.textContent = `WebGL-Fehler: ${
        error.message || 'Unbekannter Fehler'
      }. CSS-Fallback wird verwendet.`;
    }
  }

  log.error('Error state activated:', error);

  // Accessibility announcement
  if (window.announce) {
    window.announce(
      '3D-Darstellung konnte nicht geladen werden. Vereinfachte Ansicht wird verwendet.',
      { assertive: true }
    );
  }
}

export const cleanup = ThreeEarthManager.cleanup;

// Default Export für Kompatibilität
export default {
  initThreeEarth,
  cleanup,
};
