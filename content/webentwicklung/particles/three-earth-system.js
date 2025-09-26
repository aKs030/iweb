// Three.js Earth System - Erweiterte Version mit Kamera-Effekten
import { getElementById, throttle } from '../utils/common-utils.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('threeEarthSystem');

// ===== Globale Variablen =====
let isInitialized = false;
let cleanupFunctions = [];
let scene, camera, renderer, earthMesh, cloudMesh, composer;
let animationFrameId = null;
let currentSection = 'hero';
let sectionObserver = null;

// Kamera und Animation States
let cameraTarget = { x: 0, y: 0, z: 5 };
let cameraPosition = { x: 0, y: 0, z: 5 };
let cameraRotation = { x: 0, y: 0 };
let scrollProgress = 0;
let isScrollBased = true; // true = scroll-basiert, false = free camera

// Performance States
let isLowPerformanceMode = false;
let lodLevel = 1; // 1 = hoch, 2 = medium, 3 = niedrig
let lastFrameTime = 0;

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
    cleanupFunctions.forEach(fn => {
      try {
        fn();
      } catch (error) {
        log.error('Error during cleanup:', error);
      }
    });
    
    // Three.js Objekte disposal
    if (scene) {
      scene.traverse(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(material => material.dispose());
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
      'https://unpkg.com/three@0.150.0/build/three.module.js'
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
      'https://unpkg.com/three@0.150.0/build/three.min.js'
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
      reject(new Error(`Script loading failed: ${error.message || 'Unknown error'}`));
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
      reject(new Error(`Script loading failed: ${error.message || 'Unknown error'}`));
    };
    
    document.head.appendChild(script);
  });
}

// ===== Performance Detection =====
function detectPerformanceCapabilities() {
  // Mobile Detection
  const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                   window.matchMedia('(max-width: 768px), (pointer: coarse)').matches;
  
  // Performance-basierte LOD-Einstellungen
  if (isMobile) {
    isLowPerformanceMode = true;
    lodLevel = 3;
    log.info('Low performance mode enabled (mobile device)');
  } else {
    // WebGL Performance Test
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    
    if (gl) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      const renderer = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : '';
      
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
    powerPreference: isLowPerformanceMode ? 'low-power' : 'high-performance'
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
    pixelRatio: renderer.getPixelRatio()
  });
}

// ===== Beleuchtung Setup =====
function setupLighting(THREE) {
  // Hauptlichtquelle (Sonne)
  const sunLight = new THREE.DirectionalLight(0xffffff, isLowPerformanceMode ? 1.5 : 2.0);
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

// ===== Sternenfeld erstellen =====
function createStarField(THREE) {
  const starsGeometry = new THREE.BufferGeometry();
  const starCount = isLowPerformanceMode ? 500 : 2000;
  
  const positions = new Float32Array(starCount * 3);
  const colors = new Float32Array(starCount * 3);
  
  for (let i = 0; i < starCount; i++) {
    const i3 = i * 3;
    
    // Zufällige Position auf Kugel
    const radius = 50 + Math.random() * 50;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    
    positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
    positions[i3 + 2] = radius * Math.cos(phi);
    
    // Stern-Farben (verschiedene Spektralklassen)
    const color = new THREE.Color();
    const rand = Math.random();
    if (rand < 0.7) {
      color.setHSL(0.6, 0.3, 0.9); // Weiß-bläulich
    } else if (rand < 0.85) {
      color.setHSL(0.1, 0.8, 0.8); // Gelblich
    } else {
      color.setHSL(0.03, 0.9, 0.7); // Rötlich
    }
    
    colors[i3] = color.r;
    colors[i3 + 1] = color.g;
    colors[i3 + 2] = color.b;
  }
  
  starsGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  starsGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  
  const starsMaterial = new THREE.PointsMaterial({
    vertexColors: true,
    size: 0.5,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.8
  });
  
  const stars = new THREE.Points(starsGeometry, starsMaterial);
  scene.add(stars);
  
  log.debug(`Created star field with ${starCount} stars`);
}

// ===== Earth-System erstellen =====
async function createEarthSystem(THREE) {
  // LOD-basierte Geometrie-Auflösung
  const earthRadius = 3.5; // Vergrößert für Horizont-Effekt
  let segments;
  
  switch (lodLevel) {
  case 1: segments = 128; break; // High quality
  case 2: segments = 64; break;  // Medium quality
  case 3: segments = 32; break;  // Low quality
  }
  
  const earthGeometry = new THREE.SphereGeometry(earthRadius, segments, segments);
  
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
    promises.push(loadTextureWithFallback(textureLoader, '/content/img/earth/textures/earth_day.jpg', 2000));
    
    // Zusätzliche Texturen nur bei High Performance
    if (lodLevel === 1) {
      promises.push(loadTextureWithFallback(textureLoader, '/content/img/earth/textures/earth_night.jpg', 2000));
      promises.push(loadTextureWithFallback(textureLoader, '/content/img/earth/textures/earth_normal.jpg', 2000));
      promises.push(loadTextureWithFallback(textureLoader, '/content/img/earth/textures/earth_bump.jpg', 2000));
    }
    
    const textures = await Promise.allSettled(promises);
    const [dayTexture, nightTexture, normalTexture, bumpTexture] = textures.map(result => 
      result.status === 'fulfilled' ? result.value : null
    );
    
    // Prüfen ob mindestens eine Textur geladen wurde
    const loadedTextures = textures.filter(result => result.status === 'fulfilled').length;
    
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
          time: { value: 0 }
        },
        vertexShader: getEarthVertexShader(),
        fragmentShader: getEarthFragmentShader()
      });
    } else if (dayTexture) {
      // Standard Material mit Day Texture
      material = new THREE.MeshPhongMaterial({
        map: dayTexture,
        normalMap: normalTexture,
        bumpMap: bumpTexture,
        bumpScale: 0.1,
        shininess: 0.3,
        specular: 0x222222
      });
    } else {
      // Fallback zu prozeduralem Material
      material = createProceduralEarthMaterial(THREE);
    }
    
    // Texture-Optimierungen
    [dayTexture, nightTexture, normalTexture, bumpTexture].forEach(texture => {
      if (texture) {
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.generateMipmaps = true;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 4);
      }
    });
    
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
      resolution: { value: new THREE.Vector2(512, 512) }
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
    `
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
  const cloudRadius = earthRadius + 0.05;
  const segments = lodLevel === 1 ? 64 : 32;
  
  const cloudGeometry = new THREE.SphereGeometry(cloudRadius, segments, segments);
  
  // Prozedurales Wolken-Material
  const cloudMaterial = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      opacity: { value: 0.6 },
      cloudSpeed: { value: 0.5 }
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      
      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float time;
      uniform float opacity;
      uniform float cloudSpeed;
      
      varying vec2 vUv;
      varying vec3 vNormal;
      
      float noise(vec2 co) {
        return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
      }
      
      float fbm(vec2 uv) {
        float value = 0.0;
        float amplitude = 0.5;
        float frequency = 1.0;
        
        for (int i = 0; i < 4; i++) {
          value += amplitude * noise(uv * frequency + time * cloudSpeed);
          amplitude *= 0.5;
          frequency *= 2.0;
        }
        
        return value;
      }
      
      void main() {
        vec2 uv = vUv + time * cloudSpeed * 0.1;
        
        float clouds = fbm(uv * 8.0);
        clouds = smoothstep(0.4, 0.8, clouds);
        
        float alpha = clouds * opacity;
        
        // Fresnel für Atmosphäreneffekt
        float fresnel = 1.0 - dot(vNormal, vec3(0, 0, 1));
        alpha *= (1.0 - fresnel * 0.5);
        
        gl_FragColor = vec4(1.0, 1.0, 1.0, alpha);
      }
    `,
    transparent: true,
    side: THREE.DoubleSide
  });
  
  cloudMesh = new THREE.Mesh(cloudGeometry, cloudMaterial);
  cloudMesh.position.y = -2.8; // Gleiche Y-Position wie die Erde
  scene.add(cloudMesh);
  
  log.debug('Cloud system created');
}

// ===== Atmosphäre erstellen =====
function createAtmosphere(THREE, earthRadius) {
  const atmosphereRadius = earthRadius + 0.3;
  const segments = lodLevel === 1 ? 64 : 32;
  
  const atmosphereGeometry = new THREE.SphereGeometry(atmosphereRadius, segments, segments);
  
  const atmosphereMaterial = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      intensity: { value: 1.0 }
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vPosition;
      
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float time;
      uniform float intensity;
      
      varying vec3 vNormal;
      varying vec3 vPosition;
      
      void main() {
        float fresnel = 1.0 - dot(vNormal, vec3(0, 0, 1));
        fresnel = pow(fresnel, 3.0);
        
        vec3 atmosphereColor = vec3(0.3, 0.6, 1.0);
        float alpha = fresnel * intensity * 0.6;
        
        gl_FragColor = vec4(atmosphereColor, alpha);
      }
    `,
    transparent: true,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending
  });
  
  const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
  atmosphere.position.y = -2.8; // Gleiche Y-Position wie die Erde
  scene.add(atmosphere);
  
  log.debug('Atmosphere created');
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
      fov: 45 // Weiterer FOV für dramatischen Effekt
    },
    features: {
      position: { x: 2, y: 1, z: 6 },
      rotation: { x: -0.1, y: 0 },
      fov: 40
    },
    about: {
      position: { x: -1, y: 2, z: 7 },
      rotation: { x: -0.2, y: 0.1 },
      fov: 45
    },
    contact: {
      position: { x: 0, y: -1, z: 10 },
      rotation: { x: 0.1, y: 0 },
      fov: 30
    }
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
    scrollProgress = Math.min(1, Math.max(0, scrollY / Math.max(1, documentHeight - windowHeight)));
    
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
    cameraRotation.x = Math.max(-Math.PI/3, Math.min(Math.PI/3, cameraStart.x - deltaY * 0.005));
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
  container.addEventListener('touchstart', handlePointerDown, { passive: true });
  container.addEventListener('touchmove', handlePointerMove, { passive: true });
  container.addEventListener('touchend', handlePointerUp);
  
  // Zoom Controls (Buttons)
  createZoomControls(container);
  
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
    isScrollBased: () => isScrollBased
  };
  
  log.debug('User controls setup completed');
}

// ===== Zoom Controls erstellen =====
function createZoomControls(container) {
  const controlsContainer = document.createElement('div');
  controlsContainer.className = 'three-earth-controls';
  controlsContainer.innerHTML = `
    <button class="zoom-btn zoom-in" aria-label="Heranzoomen">+</button>
    <button class="zoom-btn zoom-out" aria-label="Herauszoomen">−</button>
    <button class="camera-mode-btn" aria-label="Kamera-Modus wechseln">📷</button>
  `;
  
  // Styles direkt hinzufügen
  const style = document.createElement('style');
  style.textContent = `
    .three-earth-controls {
      position: absolute;
      top: 20px;
      right: 20px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      z-index: 100;
    }
    
    .zoom-btn, .camera-mode-btn {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      border: 2px solid rgba(255, 255, 255, 0.3);
      background: rgba(0, 0, 0, 0.5);
      color: white;
      font-size: 18px;
      font-weight: bold;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
      backdrop-filter: blur(10px);
    }
    
    .zoom-btn:hover, .camera-mode-btn:hover {
      background: rgba(255, 255, 255, 0.1);
      border-color: rgba(255, 255, 255, 0.5);
      transform: scale(1.1);
    }
    
    .camera-mode-btn.scroll-mode {
      background: rgba(0, 150, 255, 0.5);
    }
    
    @media (max-width: 768px) {
      .three-earth-controls {
        top: 10px;
        right: 10px;
      }
      
      .zoom-btn, .camera-mode-btn {
        width: 35px;
        height: 35px;
        font-size: 16px;
      }
    }
  `;
  
  document.head.appendChild(style);
  container.appendChild(controlsContainer);
  
  // Event Handlers
  const zoomInBtn = controlsContainer.querySelector('.zoom-in');
  const zoomOutBtn = controlsContainer.querySelector('.zoom-out');
  const cameraModeBtn = controlsContainer.querySelector('.camera-mode-btn');
  
  zoomInBtn.addEventListener('click', () => {
    cameraTarget.z = Math.max(2, cameraTarget.z - 1);
    log.debug('Zoom in', cameraTarget.z);
  });
  
  zoomOutBtn.addEventListener('click', () => {
    cameraTarget.z = Math.min(20, cameraTarget.z + 1);
    log.debug('Zoom out', cameraTarget.z);
  });
  
  cameraModeBtn.addEventListener('click', () => {
    if (isScrollBased) {
      window.ThreeEarthControls.enableFreeCamera();
      cameraModeBtn.classList.remove('scroll-mode');
      cameraModeBtn.setAttribute('aria-label', 'Zu Scroll-Modus wechseln');
    } else {
      window.ThreeEarthControls.enableScrollCamera();
      cameraModeBtn.classList.add('scroll-mode');
      cameraModeBtn.setAttribute('aria-label', 'Zu freier Kamera wechseln');
    }
  });
  
  // Initial state
  cameraModeBtn.classList.add('scroll-mode');
  
  log.debug('Zoom controls created');
}

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
          0.1  // threshold
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
    threshold: 0.3
  };
  
  sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
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
  
  sections.forEach(section => {
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
function updateEarthForSection(sectionName) {
  if (!earthMesh) return;
  
  const sectionConfigs = {
    hero: {
      scale: 1.0,
      rotationSpeed: 0.002,
      atmosphereIntensity: 1.0
    },
    features: {
      scale: 1.2,
      rotationSpeed: 0.001,
      atmosphereIntensity: 0.8
    },
    about: {
      scale: 0.8,
      rotationSpeed: 0.003,
      atmosphereIntensity: 1.2
    },
    contact: {
      scale: 1.5,
      rotationSpeed: 0.0005,
      atmosphereIntensity: 0.6
    }
  };
  
  const config = sectionConfigs[sectionName] || sectionConfigs.hero;
  
  // Scale Animation mit LERP
  earthMesh.userData.targetScale = config.scale;
  earthMesh.userData.rotationSpeed = config.rotationSpeed;
  
  // Atmosphäre anpassen
  scene.traverse(child => {
    if (child.material?.uniforms?.intensity) {
      child.material.uniforms.intensity.value = config.atmosphereIntensity;
    }
  });
  
  log.debug(`Earth updated for section: ${sectionName}`, config);
}

// ===== Animation Loop =====
function startAnimationLoop(THREE) {
  const clock = new THREE.Clock();
  let frameCount = 0;
  
  function animate() {
    animationFrameId = requestAnimationFrame(animate);
    
    clock.getDelta(); // Consume delta time
    const elapsedTime = clock.getElapsedTime();
    
    // Performance Monitoring
    frameCount++;
    if (frameCount % 60 === 0) {
      checkPerformance();
    }
    
    // Earth Updates
    updateEarthRotation();
    
    // Cloud Updates
    updateClouds(elapsedTime);
    
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
  
  function checkPerformance() {
    const currentFrameTime = performance.now();
    const frameDuration = currentFrameTime - lastFrameTime;
    
    if (frameDuration > 33.33) { // < 30fps
      // Automatische LOD-Reduktion bei schlechter Performance
      if (!isLowPerformanceMode) {
        isLowPerformanceMode = true;
        log.info('Switched to low performance mode due to poor framerate');
      }
    }
    
    lastFrameTime = currentFrameTime;
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
      earthMesh.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.02);
    }
  }
  
  function updateClouds(elapsedTime) {
    if (!cloudMesh) return;
    
    cloudMesh.rotation.y += 0.001;
    
    // Wolken-Material Zeit-Update
    if (cloudMesh.material.uniforms?.time) {
      cloudMesh.material.uniforms.time.value = elapsedTime;
    }
  }
  
  function updateShaderUniforms(elapsedTime) {
    scene.traverse(child => {
      if (child.material?.uniforms?.time) {
        child.material.uniforms.time.value = elapsedTime;
      }
    });
  }
  
  function renderFrame() {
    if (composer) {
      composer.render();
    } else {
      renderer.render(scene, camera);
    }
  }
  
  animate();
  log.debug('Animation loop started');
}

// ===== LOD Culling für Performance =====
function performLODCulling() {
  scene.traverse(child => {
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
      errorText.textContent = `WebGL-Fehler: ${error.message || 'Unbekannter Fehler'}. CSS-Fallback wird verwendet.`;
    }
  }
  
  log.error('Error state activated:', error);
  
  // Accessibility announcement
  if (window.announce) {
    window.announce('3D-Darstellung konnte nicht geladen werden. Vereinfachte Ansicht wird verwendet.', { assertive: true });
  }
}

export const cleanup = ThreeEarthManager.cleanup;

// Default Export für Kompatibilität
export default {
  initThreeEarth,
  cleanup
};