/**
 * Three.js Card System - Integrated WebGL Particle System with Orchestration
 *
 * Complete card rotation & particle animation system:
 * - Template Loading & Management
 * - IntersectionObserver for trigger detection
 * - Scroll & Touch event handling
 * - Three.js WebGL particle animations
 * - Forward (Particles → Cards) & Reverse (Cards → Particles)
 * - Scroll-snap orchestration
 * - Mobile & Touch optimization
 *
 * Features:
 * - GPU-optimiertes BufferGeometry mit InstancedMesh
 * - Adaptive Partikel-Count: Desktop 150, Mobile 60
 * - Twinkle-Effekt via Shader (wie Earth Starfield)
 * - Smooth Easing: ease-out-cubic für Formation
 * - Performance-aware: DPR-Capping, LOD-System
 * - Cleanup via TimerManager & SharedCleanupManager
 * - Race Condition Prevention
 * - Memory Leak Prevention
 * - Error Handling mit Fallbacks
 *
 * @author Portfolio System
 * @version 2.0.0 - Integrated Orchestration
 * @created 2025-10-14
 * @updated 2025-10-15 - Full Integration
 */

import {
  createLogger,
  EVENTS,
  fire,
  getElementById,
  onResize,
  shuffle as shuffleArray,
  throttle,
  TimerManager,
} from "../shared-utilities.js";
import {
  loadThreeJS,
  registerParticleSystem,
  sharedCleanupManager,
  unregisterParticleSystem,
} from "./shared-particle-system.js";

const log = createLogger("threeCardSystem");
const cardTimers = new TimerManager();

// ===== ORCHESTRATION CONFIGURATION =====
const SECTION_ID = "features";
const TEMPLATE_IDS = ["kart-1", "kart-2", "kart-3", "kart-4"];
const TEMPLATE_URL = "/pages/card/karten.html";

// Animation Thresholds - Optimiert für gleichmäßige Übergänge
const THRESHOLDS = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];
const SNAP_THRESHOLD = 0.6; // Forward Animation früher für sanfteren Übergang
const REVERSE_THRESHOLD = 0.5; // Reverse Animation bei 50% für symmetrisches Verhalten
const SCROLL_THROTTLE = 80; // ms - Reduziert für reaktivere Übergänge
const TOUCH_THROTTLE = 40; // ms - Reduziert für flüssigere Touch-Steuerung

// ===== PARTICLE CONFIGURATION =====
// Synchron mit karten-star-animation.css & Earth-System
const CONFIG = {
  PARTICLES: {
    COUNT_DESKTOP: 150,
    COUNT_MOBILE: 60,
    SIZE: 2.2, // Three.js Units - optimiert für gleichmäßige Verteilung
    COLOR: 0x098bff, // Portfolio Blue
    OPACITY: 0.75, // Leicht reduziert für sanftere Übergänge
    TWINKLE_SPEED: 0.2, // Langsamer für ruhigere Animation
    TWINKLE_AMPLITUDE: 0.4, // Reduziert für gleichmäßigeres Erscheinungsbild
  },
  ANIMATION: {
    FORWARD_DURATION: 2500, // ms - Länger für gleichmäßigere Bewegung
    REVERSE_DURATION: 1800, // ms - Ausgewogen für sanfte Rückfahrt
    EASING: {
      FORWARD: "easeOutCubic", // Sanft beschleunigend
      REVERSE: "easeInCubic", // Sanft abbremsend
    },
  },
  CAMERA: {
    FOV: 45, // Reduziert für weniger perspektivische Verzerrung
    NEAR: 0.1,
    FAR: 100,
    POSITION: { x: 0, y: 0, z: 20 }, // Zentral ausgerichtet für gleichmäßige Sicht
  },
  RENDERER: {
    ALPHA: true,
    ANTIALIAS: true,
    MAX_DPR: 2, // Performance: Cap bei 2x
  },
  PERFORMANCE: {
    REDUCED_MOTION_FALLBACK: true,
    RAF_THROTTLE: false, // Kein Throttling für smooth 60fps
  },
};

// ===== Easing Functions - Optimiert für gleichmäßige Kamerabewegung =====
const Easing = {
  // Sanfter Übergang ohne abrupte Beschleunigung
  easeOutCubic: (t) => {
    const t1 = t - 1;
    return t1 * t1 * t1 + 1;
  },
  // Gleichmäßigerer Start
  easeInCubic: (t) => {
    return t * t * t;
  },
  // Alternative: Noch sanfterer Übergang (Ease-In-Out)
  easeInOutQuad: (t) => {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  },
};

// ===== Module State =====
let threeInstance = null; // Singleton Three.js Instance
const animationState = {
  isAnimating: false,
  mode: null, // 'forward' | 'reverse'
  startTime: null,
  rafId: null,
  idleRafId: null, // RAF ID for idle render loop
  frameCount: 0, // Debug: Zähle Frames
};

// ===== Orchestration State =====
let templateOrder = [];
let currentTemplateIndex = 0;
let templatesLoaded = false;
let hasAnimated = false;
let isReversing = false;
let reverseTriggered = false;
let intersectionObserver = null;
let observerCleanup = null;

// Scroll/Snap Orchestration State
let pendingSnap = false;
let targetSectionEl = null;

/**
 * ThreeCardSystem - Main Class
 */
class ThreeCardSystem {
  constructor(container, THREE) {
    this.container = container;
    this.THREE = THREE;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.particles = null;
    this.particleData = [];
    this.resizeHandler = null;
    this.mounted = false;

    log.info("ThreeCardSystem instantiated");
  }

  /**
   * Initialisiert Three.js Scene, Camera, Renderer
   */
  async init() {
    if (this.mounted) {
      log.warn("System already mounted");
      return false;
    }

    try {
      // Scene Setup
      this.scene = new this.THREE.Scene();

      // Camera Setup
      const rect = this.container.getBoundingClientRect();
      const aspect = rect.width / rect.height;
      this.camera = new this.THREE.PerspectiveCamera(
        CONFIG.CAMERA.FOV,
        aspect,
        CONFIG.CAMERA.NEAR,
        CONFIG.CAMERA.FAR
      );
      this.camera.position.set(
        CONFIG.CAMERA.POSITION.x,
        CONFIG.CAMERA.POSITION.y,
        CONFIG.CAMERA.POSITION.z
      );
      this.camera.lookAt(0, 0, 0);

      log.debug("Camera setup:", {
        fov: CONFIG.CAMERA.FOV,
        aspect,
        position: CONFIG.CAMERA.POSITION,
        lookAt: { x: 0, y: 0, z: 0 },
      });

      // Renderer Setup
      const dpr = Math.min(
        window.devicePixelRatio || 1,
        CONFIG.RENDERER.MAX_DPR
      );
      this.renderer = new this.THREE.WebGLRenderer({
        alpha: CONFIG.RENDERER.ALPHA,
        antialias: CONFIG.RENDERER.ANTIALIAS,
      });
      this.renderer.setSize(rect.width, rect.height);
      this.renderer.setPixelRatio(dpr);
      this.renderer.setClearColor(0x000000, 0); // Transparent

      // Append Canvas with correct class for CSS styling
      this.renderer.domElement.className = "starfield-canvas";
      // Note: Don't override CSS with inline styles - let karten-star-animation.css control z-index
      this.renderer.domElement.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
      `;

      // Ensure container has position: relative
      const containerStyle = window.getComputedStyle(this.container);
      if (containerStyle.position === "static") {
        this.container.style.position = "relative";
        log.debug("Set container position to relative");
      }

      this.container.appendChild(this.renderer.domElement);

      log.debug("Canvas appended to DOM:", {
        canvasWidth: this.renderer.domElement.width,
        canvasHeight: this.renderer.domElement.height,
        canvasClassName: this.renderer.domElement.className,
        containerChildren: this.container.children.length,
      });

      // Resize Handler
      this.resizeHandler = onResize(() => this.handleResize());

      this.mounted = true;
      log.info("✅ Three.js Card System initialized", {
        width: rect.width,
        height: rect.height,
        dpr,
      });

      // Register im Shared System
      registerParticleSystem("cardSystem", this);
      sharedCleanupManager.addCleanupFunction(
        "cardSystem",
        () => this.cleanup(),
        "Three.js Card System Cleanup"
      );

      return true;
    } catch (error) {
      log.error("Failed to initialize Three.js Card System:", error);
      return false;
    }
  }

  /**
   * Erstellt Partikel-System mit BufferGeometry
   * @param {string} mode - 'forward' | 'reverse'
   */
  createParticles(mode = "forward") {
    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    const particleCount = isMobile
      ? CONFIG.PARTICLES.COUNT_MOBILE
      : CONFIG.PARTICLES.COUNT_DESKTOP;

    const cards = this.container.querySelectorAll(".card");

    log.info("Looking for cards in container:", {
      containerTag: this.container.tagName,
      containerId: this.container.id,
      containerClass: this.container.className,
      cardsFound: cards.length,
      containerHTML: this.container.innerHTML.substring(0, 200),
    });

    if (!cards.length) {
      log.error("❌ No cards found for particle creation - cannot animate");
      log.info(
        "Container structure:",
        this.container.innerHTML.substring(0, 500)
      );

      // Fallback: Erstelle zentral verteilte Partikel ohne Card-Targets
      log.warn("⚠️ Using fallback: center-distributed particles");
      return this.createFallbackParticles(mode, particleCount);
    }

    // Berechne Card-Positionen in Three.js Koordinaten
    const canvasRect = this.renderer.domElement.getBoundingClientRect();

    const cardPositions = Array.from(cards).map((card) => {
      const cardRect = card.getBoundingClientRect();

      // Berechne Zentrum der Card relativ zum Canvas (in Pixeln)
      const centerXPx = cardRect.left + cardRect.width / 2 - canvasRect.left;
      const centerYPx = cardRect.top + cardRect.height / 2 - canvasRect.top;

      // Normalisiere zu [-1, 1] NDC (Normalized Device Coordinates)
      const ndcX = (centerXPx / canvasRect.width) * 2 - 1;
      const ndcY = -((centerYPx / canvasRect.height) * 2 - 1); // Y invertiert

      // Berechne World-Space Position basierend auf Camera FOV
      const distance = CONFIG.CAMERA.POSITION.z;
      const vFOV = (CONFIG.CAMERA.FOV * Math.PI) / 180; // Zu Radians
      const height = 2 * Math.tan(vFOV / 2) * distance;
      const width = height * (canvasRect.width / canvasRect.height);

      const worldX = ndcX * (width / 2);
      const worldY = ndcY * (height / 2);

      // Card Dimensionen in World-Space
      const worldWidth = (cardRect.width / canvasRect.width) * width;
      const worldHeight = (cardRect.height / canvasRect.height) * height;

      return {
        x: worldX,
        y: worldY,
        width: worldWidth,
        height: worldHeight,
      };
    });

    log.debug(
      "Card positions in 3D space:",
      cardPositions.map((pos, i) => ({
        card: i,
        x: pos.x.toFixed(2),
        y: pos.y.toFixed(2),
        width: pos.width.toFixed(2),
        height: pos.height.toFixed(2),
      }))
    );

    // BufferGeometry für Partikel
    const geometry = new this.THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const targets = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    const twinkleOffsets = new Float32Array(particleCount);

    this.particleData = [];

    // Berechne sichtbaren Bereich basierend auf Camera FOV
    const distance = CONFIG.CAMERA.POSITION.z;
    const vFOV = (CONFIG.CAMERA.FOV * Math.PI) / 180;
    const viewHeight = 2 * Math.tan(vFOV / 2) * distance;
    const viewWidth = viewHeight * (canvasRect.width / canvasRect.height);

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;

      // Forward: Random → Card, Reverse: Card → Random
      let startX, startY, targetX, targetY;

      if (mode === "forward") {
        // Start: Gleichmäßig verteilt über gesamten Viewport (kein Überlauf)
        startX = (Math.random() - 0.5) * viewWidth * 1.0; // Genau im Viewport
        startY = (Math.random() - 0.5) * viewHeight * 1.0;

        // Target: Random Card + gleichmäßige Position innerhalb Card
        const targetCard =
          cardPositions[Math.floor(Math.random() * cardPositions.length)];
        targetX = targetCard.x + (Math.random() - 0.5) * targetCard.width * 0.9; // 90% der Card-Breite
        targetY =
          targetCard.y + (Math.random() - 0.5) * targetCard.height * 0.9;
      } else {
        // Reverse: Card → Gleichmäßig über Viewport
        const startCard =
          cardPositions[Math.floor(Math.random() * cardPositions.length)];
        startX = startCard.x + (Math.random() - 0.5) * startCard.width * 0.9;
        startY = startCard.y + (Math.random() - 0.5) * startCard.height * 0.9;

        targetX = (Math.random() - 0.5) * viewWidth * 1.0; // Gleichmäßige Verteilung
        targetY = (Math.random() - 0.5) * viewHeight * 1.0;
      }

      // Positions (Start)
      positions[i3] = startX;
      positions[i3 + 1] = startY;
      positions[i3 + 2] = 0;

      // Targets
      targets[i3] = targetX;
      targets[i3 + 1] = targetY;
      targets[i3 + 2] = 0;

      // Color (Portfolio Blue mit minimaler Variation für Gleichmäßigkeit)
      const color = new this.THREE.Color(CONFIG.PARTICLES.COLOR);
      color.offsetHSL(0, 0, (Math.random() - 0.5) * 0.15); // ±7.5% Lightness - reduziert
      colors[i3] = color.r;
      colors[i3 + 1] = color.g;
      colors[i3 + 2] = color.b;

      // Size - Engere Variation für gleichmäßigeres Erscheinungsbild
      sizes[i] = CONFIG.PARTICLES.SIZE * (0.7 + Math.random() * 0.6); // 0.7-1.3x - reduziert

      // Twinkle Phase Offset - Gleichmäßig verteilt
      twinkleOffsets[i] = Math.random() * Math.PI * 2;

      // Store Data für Animation
      this.particleData.push({
        startX,
        startY,
        targetX,
        targetY,
        size: sizes[i],
        twinkleOffset: twinkleOffsets[i],
      });
    }

    // Debug: Log erste paar Partikel
    if (this.particleData.length > 0) {
      log.debug(
        "Sample particle data (first 3):",
        this.particleData.slice(0, 3).map((p) => ({
          start: `(${p.startX.toFixed(2)}, ${p.startY.toFixed(2)})`,
          target: `(${p.targetX.toFixed(2)}, ${p.targetY.toFixed(2)})`,
        }))
      );
    }

    geometry.setAttribute(
      "position",
      new this.THREE.BufferAttribute(positions, 3)
    );
    geometry.setAttribute("target", new this.THREE.BufferAttribute(targets, 3));
    geometry.setAttribute("color", new this.THREE.BufferAttribute(colors, 3));
    geometry.setAttribute("size", new this.THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute(
      "twinkleOffset",
      new this.THREE.BufferAttribute(twinkleOffsets, 1)
    );

    // Custom Shader Material (mit Twinkle-Effekt)
    const material = new this.THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        opacity: { value: CONFIG.PARTICLES.OPACITY },
        twinkleSpeed: { value: CONFIG.PARTICLES.TWINKLE_SPEED },
        twinkleAmplitude: { value: CONFIG.PARTICLES.TWINKLE_AMPLITUDE },
      },
      vertexShader: `
        attribute float size;
        attribute vec3 target;
        attribute float twinkleOffset;
        varying vec3 vColor;
        varying float vTwinkleOffset;
        
        void main() {
          vColor = color;
          vTwinkleOffset = twinkleOffset;
          
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * 100.0 * (1.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform float opacity;
        uniform float twinkleSpeed;
        uniform float twinkleAmplitude;
        varying vec3 vColor;
        varying float vTwinkleOffset;
        
        void main() {
          // Circular Point Shape
          vec2 center = gl_PointCoord - vec2(0.5);
          float dist = length(center);
          if (dist > 0.5) discard;
          
          // Twinkle Effect (sin-based wie Earth)
          float twinkle = (sin(time * twinkleSpeed + vTwinkleOffset) + 1.0) / 2.0;
          float finalOpacity = opacity * (1.0 - twinkleAmplitude + twinkle * twinkleAmplitude);
          
          // Soft Edge Falloff
          float alpha = smoothstep(0.5, 0.0, dist) * finalOpacity;
          
          gl_FragColor = vec4(vColor, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      vertexColors: true,
    });

    log.debug("Shader material created with config:", {
      opacity: CONFIG.PARTICLES.OPACITY,
      size: CONFIG.PARTICLES.SIZE,
      color: `#${CONFIG.PARTICLES.COLOR.toString(16)}`,
      particleCount,
    });

    this.particles = new this.THREE.Points(geometry, material);
    this.scene.add(this.particles);

    log.info(
      `✨ Created ${particleCount} particles in ${mode} mode (mobile: ${isMobile})`
    );

    // Immediate first render to ensure particles are visible
    this.renderer.render(this.scene, this.camera);
    log.debug("Initial render complete - particles should be visible now");

    return true;
  }

  /**
   * Fallback: Erstellt zentral verteilte Partikel ohne Card-Targets
   * @param {string} mode - 'forward' | 'reverse'
   * @param {number} particleCount - Anzahl der Partikel
   */
  createFallbackParticles(mode = "forward", particleCount = 150) {
    log.info(`Creating ${particleCount} fallback particles (mode: ${mode})`);

    const geometry = new this.THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const targets = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    const twinkleOffsets = new Float32Array(particleCount);

    this.particleData = [];

    // Berechne sichtbaren Bereich basierend auf Camera FOV (gleiche Logik wie createParticles)
    const canvasRect = this.renderer.domElement.getBoundingClientRect();
    const distance = CONFIG.CAMERA.POSITION.z;
    const vFOV = (CONFIG.CAMERA.FOV * Math.PI) / 180;
    const viewHeight = 2 * Math.tan(vFOV / 2) * distance;
    const viewWidth = viewHeight * (canvasRect.width / canvasRect.height);

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;

      let startX, startY, targetX, targetY;

      if (mode === "forward") {
        // Start: Gleichmäßig über gesamten Viewport verteilt
        startX = (Math.random() - 0.5) * viewWidth * 1.0;
        startY = (Math.random() - 0.5) * viewHeight * 1.0;

        // Target: Zentrum mit gleichmäßiger Streuung
        targetX = (Math.random() - 0.5) * viewWidth * 0.5;
        targetY = (Math.random() - 0.5) * viewHeight * 0.5;
      } else {
        // Reverse: Zentrum → Gleichmäßig über Viewport
        startX = (Math.random() - 0.5) * viewWidth * 0.5;
        startY = (Math.random() - 0.5) * viewHeight * 0.5;

        targetX = (Math.random() - 0.5) * viewWidth * 1.0;
        targetY = (Math.random() - 0.5) * viewHeight * 1.0;
      }

      positions[i3] = startX;
      positions[i3 + 1] = startY;
      positions[i3 + 2] = 0;

      targets[i3] = targetX;
      targets[i3 + 1] = targetY;
      targets[i3 + 2] = 0;

      // Color - Reduzierte Variation für Gleichmäßigkeit
      const color = new this.THREE.Color(CONFIG.PARTICLES.COLOR);
      color.offsetHSL(0, 0, (Math.random() - 0.5) * 0.15);
      colors[i3] = color.r;
      colors[i3 + 1] = color.g;
      colors[i3 + 2] = color.b;

      sizes[i] = CONFIG.PARTICLES.SIZE * (0.7 + Math.random() * 0.6);
      twinkleOffsets[i] = Math.random() * Math.PI * 2;

      this.particleData.push({
        startX,
        startY,
        targetX,
        targetY,
        size: sizes[i],
        twinkleOffset: twinkleOffsets[i],
      });
    }

    geometry.setAttribute(
      "position",
      new this.THREE.BufferAttribute(positions, 3)
    );
    geometry.setAttribute("target", new this.THREE.BufferAttribute(targets, 3));
    geometry.setAttribute("color", new this.THREE.BufferAttribute(colors, 3));
    geometry.setAttribute("size", new this.THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute(
      "twinkleOffset",
      new this.THREE.BufferAttribute(twinkleOffsets, 1)
    );

    // Same shader as normal particles
    const material = new this.THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        opacity: { value: CONFIG.PARTICLES.OPACITY },
        twinkleSpeed: { value: CONFIG.PARTICLES.TWINKLE_SPEED },
        twinkleAmplitude: { value: CONFIG.PARTICLES.TWINKLE_AMPLITUDE },
      },
      vertexShader: `
        attribute float size;
        attribute vec3 target;
        attribute float twinkleOffset;
        varying vec3 vColor;
        varying float vTwinkleOffset;
        
        void main() {
          vColor = color;
          vTwinkleOffset = twinkleOffset;
          
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * 100.0 * (1.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform float opacity;
        uniform float twinkleSpeed;
        uniform float twinkleAmplitude;
        varying vec3 vColor;
        varying float vTwinkleOffset;
        
        void main() {
          vec2 center = gl_PointCoord - vec2(0.5);
          float dist = length(center);
          if (dist > 0.5) discard;
          
          float twinkle = (sin(time * twinkleSpeed + vTwinkleOffset) + 1.0) / 2.0;
          float finalOpacity = opacity * (1.0 - twinkleAmplitude + twinkle * twinkleAmplitude);
          float alpha = smoothstep(0.5, 0.0, dist) * finalOpacity;
          
          gl_FragColor = vec4(vColor, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      vertexColors: true,
    });

    this.particles = new this.THREE.Points(geometry, material);
    this.scene.add(this.particles);

    log.info(`✨ Created ${particleCount} fallback particles`);
    return true;
  }

  /**
   * Startet Animation (Forward oder Reverse)
   * @param {string} mode - 'forward' | 'reverse'
   * @returns {Promise<boolean>} Resolves when animation completes
   */
  startAnimation(mode = "forward") {
    // Stop idle render loop if running
    if (animationState.idleRafId) {
      cancelAnimationFrame(animationState.idleRafId);
      animationState.idleRafId = null;
      log.debug("Stopped idle render loop for new animation");
    }

    if (animationState.isAnimating) {
      log.warn(
        `Animation already running (${animationState.mode}), stopping previous before starting ${mode}`
      );
      this.stopAnimation();
    }

    // Bei Reverse: Cleanup alte Partikel (von Forward)
    if (mode === "reverse") {
      this.cleanupParticles();
    }

    // Erstelle neue Partikel
    if (!this.createParticles(mode)) {
      log.error("Failed to create particles");
      return Promise.resolve(false);
    }

    animationState.isAnimating = true;
    animationState.mode = mode;
    animationState.startTime = performance.now();
    animationState.frameCount = 0;

    log.info(`🎬 Starting ${mode} animation`);

    // Return Promise that resolves when animation completes
    return new Promise((resolve) => {
      const onComplete = () => {
        this.container.removeEventListener(
          "three-card-animation-complete",
          onComplete
        );
        resolve(true);
      };
      this.container.addEventListener(
        "three-card-animation-complete",
        onComplete
      );
      this.animate();
    });
  }

  /**
   * Animation Loop
   */
  animate() {
    if (!animationState.isAnimating) {
      log.debug("Animation stopped - isAnimating is false");
      return;
    }

    animationState.frameCount++;

    const now = performance.now();
    const elapsed = now - animationState.startTime;
    const duration =
      animationState.mode === "forward"
        ? CONFIG.ANIMATION.FORWARD_DURATION
        : CONFIG.ANIMATION.REVERSE_DURATION;
    const progress = Math.min(elapsed / duration, 1);

    // Easing
    const easing =
      animationState.mode === "forward"
        ? Easing.easeOutCubic
        : Easing.easeInCubic;
    const eased = easing(progress);

    // Debug erste, jedes 30. und letzte Frame
    if (
      progress === 0 ||
      animationState.frameCount % 30 === 0 ||
      progress === 1
    ) {
      log.debug(
        `Animation frame #${animationState.frameCount}: progress=${(progress * 100).toFixed(1)}%, eased=${eased.toFixed(3)}, elapsed=${elapsed.toFixed(0)}ms`
      );
    }

    // Update Partikel-Positionen
    if (this.particles) {
      const positions = this.particles.geometry.attributes.position.array;

      for (let i = 0; i < this.particleData.length; i++) {
        const i3 = i * 3;
        const data = this.particleData[i];

        // Interpoliere Position
        positions[i3] = data.startX + (data.targetX - data.startX) * eased;
        positions[i3 + 1] = data.startY + (data.targetY - data.startY) * eased;
      }

      this.particles.geometry.attributes.position.needsUpdate = true;

      // Update Shader Uniforms
      this.particles.material.uniforms.time.value = now / 1000;

      // Opacity Fade während Reverse
      if (animationState.mode === "reverse") {
        this.particles.material.uniforms.opacity.value =
          CONFIG.PARTICLES.OPACITY * (1 - progress * 0.3); // -30% fade
      }
    }

    // Render Scene
    this.renderer.render(this.scene, this.camera);

    // Continue oder beenden
    if (progress < 1) {
      animationState.rafId = requestAnimationFrame(() => this.animate());
    } else {
      this.onAnimationComplete();
    }
  }

  /**
   * Animation Complete Handler
   */
  onAnimationComplete() {
    log.info(
      `✅ ${animationState.mode} animation complete - ${animationState.frameCount} frames rendered`
    );

    // Bei Forward: Partikel behalten (werden über CSS ausgeblendet)
    // Bei Reverse: Partikel sofort entfernen
    if (animationState.mode === "reverse") {
      this.cleanupParticles();
    } else {
      // Forward: Halte Partikel an Zielposition und starte Idle-Render
      log.debug("Keeping particles for CSS fade-out, starting idle render");
      this.startIdleRender();
    }

    animationState.isAnimating = false;

    // Event für externe Listener
    const event = new CustomEvent("three-card-animation-complete", {
      detail: { mode: animationState.mode },
      bubbles: true,
    });
    this.container.dispatchEvent(event);

    animationState.mode = null;
    animationState.startTime = null;
    animationState.frameCount = 0;
  }

  /**
   * Cleanup Partikel (intern)
   */
  cleanupParticles() {
    if (this.particles) {
      this.scene.remove(this.particles);
      this.particles.geometry.dispose();
      this.particles.material.dispose();
      this.particles = null;
      log.debug("Particles cleaned up");
    }
    this.particleData = [];
  }

  /**
   * Idle Render Loop - Hält Partikel sichtbar mit Twinkle-Effekt
   * Wird nach Forward-Animation gestartet, bis Reverse beginnt
   */
  startIdleRender() {
    // Cancel existing idle loop if running
    if (animationState.idleRafId) {
      cancelAnimationFrame(animationState.idleRafId);
      animationState.idleRafId = null;
    }

    const idleLoop = () => {
      // Stoppe wenn neue Animation startet oder System nicht mounted
      if (animationState.isAnimating || !this.mounted || !this.particles) {
        animationState.idleRafId = null;
        return;
      }

      // Update Twinkle-Effekt
      if (
        this.particles &&
        this.particles.material &&
        this.particles.material.uniforms
      ) {
        this.particles.material.uniforms.time.value = performance.now() / 1000;
      }

      // Render Scene
      this.renderer.render(this.scene, this.camera);

      // Continue Loop
      animationState.idleRafId = requestAnimationFrame(idleLoop);
    };

    log.debug("Starting idle render loop for particle twinkle");
    animationState.idleRafId = requestAnimationFrame(idleLoop);
  }

  /**
   * Stoppt Animation manuell
   */
  stopAnimation() {
    if (animationState.rafId) {
      cancelAnimationFrame(animationState.rafId);
      animationState.rafId = null;
    }

    if (animationState.idleRafId) {
      cancelAnimationFrame(animationState.idleRafId);
      animationState.idleRafId = null;
    }

    if (this.particles) {
      this.scene.remove(this.particles);
      this.particles.geometry.dispose();
      this.particles.material.dispose();
      this.particles = null;
    }

    this.particleData = [];
    animationState.isAnimating = false;
    animationState.mode = null;

    log.debug("Animation stopped");
  }

  /**
   * Resize Handler
   */
  handleResize() {
    if (!this.mounted || !this.camera || !this.renderer) return;

    const rect = this.container.getBoundingClientRect();
    const aspect = rect.width / rect.height;

    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(rect.width, rect.height);

    log.debug("Resized to:", { width: rect.width, height: rect.height });
  }

  /**
   * Cleanup & Dispose
   */
  cleanup() {
    log.info("Starting cleanup...");

    this.stopAnimation();
    cardTimers.clearAll();

    if (this.resizeHandler) {
      this.resizeHandler(); // Unsubscribe vom onResize
      this.resizeHandler = null;
    }

    if (this.renderer) {
      if (this.renderer.domElement && this.renderer.domElement.parentNode) {
        this.renderer.domElement.parentNode.removeChild(
          this.renderer.domElement
        );
      }
      this.renderer.dispose();
      this.renderer = null;
    }

    this.scene = null;
    this.camera = null;
    this.mounted = false;

    unregisterParticleSystem("cardSystem");
    log.info("✅ Cleanup complete");
  }
}

// ===== ORCHESTRATION FUNCTIONS =====
// Scroll & Template Management Integration

/**
 * Bestimmt Scroll-Richtung basierend auf Section-Position
 */
function getScrollDirection(section) {
  const rect = section.getBoundingClientRect();
  const viewportCenter = window.innerHeight / 2;
  const sectionCenter = rect.top + rect.height / 2;

  if (rect.bottom < 0) return "next";
  if (rect.top > window.innerHeight) return "prev";

  return sectionCenter < viewportCenter ? "next" : "prev";
}

/**
 * Findet benachbarte Section
 */
function findSiblingSection(section, direction = "next") {
  const all = Array.from(document.querySelectorAll(".section"));
  const idx = all.indexOf(section);
  if (idx === -1) return null;

  const sibling =
    direction === "next" ? all[idx + 1] || null : all[idx - 1] || null;
  log.debug(
    `findSiblingSection: current=${section.id}, direction=${direction}, sibling=${sibling?.id || "none"}`
  );
  return sibling;
}

/**
 * Navigiert zur Ziel-Section nach Reverse-Animation
 */
function navigateToTarget() {
  const target = targetSectionEl;
  const shouldSnap = pendingSnap;

  targetSectionEl = null;
  pendingSnap = false;

  if (target && shouldSnap && document.contains(target)) {
    log.info(`➡️ Navigating to: #${target.id || "unknown"}`);
    target.scrollIntoView({ behavior: "auto", block: "start" });
  }
}

/**
 * Template Loading & Management
 */
async function ensureTemplates(section) {
  if (templatesLoaded) {
    log.debug("Templates already loaded");
    return true;
  }

  const url = section?.dataset.featuresSrc || TEMPLATE_URL;
  log.debug(`Loading templates from: ${url}`);

  const existing = TEMPLATE_IDS.filter((id) => getElementById(id));
  if (existing.length > 0) {
    log.info(`Found ${existing.length} existing templates`);
    templatesLoaded = true;
    fire(EVENTS.FEATURES_TEMPLATES_LOADED);
    return true;
  }

  try {
    const res = await fetch(url, { credentials: "same-origin" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const wrap = document.createElement("div");
    wrap.style.display = "none";
    wrap.innerHTML = await res.text();
    document.body.appendChild(wrap);

    const foundAfterLoad = TEMPLATE_IDS.filter((id) => getElementById(id));
    log.info(`Templates loaded: ${foundAfterLoad.length} templates`);

    templatesLoaded = true;
    fire(EVENTS.FEATURES_TEMPLATES_LOADED);
    return true;
  } catch (error) {
    log.error(`Failed to load templates: ${error.message}`);
    fire(EVENTS.FEATURES_TEMPLATES_ERROR, { error, url });
    return false;
  }
}

/**
 * ARIA Live Region für Screen Reader
 */
function createLiveRegion(section, templateId, LIVE_LABEL_PREFIX) {
  let live = section.querySelector("[data-feature-rotation-live]");
  if (!live) {
    live = document.createElement("div");
    live.setAttribute("data-feature-rotation-live", "");
    live.setAttribute("aria-live", "polite");
    live.setAttribute("aria-atomic", "true");
    live.className = "sr-only";
    live.style.cssText =
      "position:absolute;width:1px;height:1px;margin:-1px;border:0;padding:0;clip:rect(0 0 0 0);overflow:hidden;";
    section.appendChild(live);
  }
  live.textContent = `${LIVE_LABEL_PREFIX}: ${templateId}`;
  return live;
}

/**
 * Mount Initial Cards
 */
function mountInitialCards(section) {
  if (!section) {
    log.warn("Section not found for initial cards");
    return false;
  }

  if (section.dataset.currentTemplate) {
    log.debug("Cards already mounted");
    return true;
  }

  if (!templateOrder.length) {
    log.warn("No templates in order array");
    return false;
  }

  const tpl = getElementById(templateOrder[currentTemplateIndex]);
  if (!tpl) {
    log.warn(`Template ${templateOrder[currentTemplateIndex]} not found`);
    return false;
  }

  const LIVE_LABEL_PREFIX = section.dataset.liveLabel || "Feature";
  const frag = tpl.content ? document.importNode(tpl.content, true) : null;

  section.replaceChildren(frag || tpl.cloneNode(true));
  createLiveRegion(
    section,
    templateOrder[currentTemplateIndex],
    LIVE_LABEL_PREFIX
  );
  section.dataset.currentTemplate = templateOrder[currentTemplateIndex];

  section.classList.add("cards-hidden");

  log.info(`Cards mounted (hidden): ${templateOrder[currentTemplateIndex]}`);
  fire(EVENTS.FEATURES_CHANGE, {
    index: currentTemplateIndex,
    total: templateOrder.length,
  });
  return true;
}

/**
 * Forward Animation Orchestrator
 */
async function applyForwardAnimation(section) {
  if (
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    log.info("⏩ Reduced motion: Skipping particle animation");
    section.classList.remove("starfield-animating");
    section.classList.add("cards-visible");
    fire(
      EVENTS.TEMPLATE_MOUNTED,
      { templateId: section.dataset.currentTemplate },
      section
    );
    return;
  }

  log.info("🌟 Starting Three.js WebGL Starfield Animation");

  section.classList.add("starfield-animating");

  try {
    const container = section;

    if (!container || !document.body.contains(container)) {
      throw new Error("Container not found or not in DOM");
    }

    const success = await startForwardAnimation(container);

    if (!success) {
      throw new Error("startForwardAnimation returned false");
    }

    log.info("✨ WebGL Starfield formation complete");
    section.classList.remove("starfield-animating");
    section.classList.add("cards-visible");

    fire(
      EVENTS.TEMPLATE_MOUNTED,
      { templateId: section.dataset.currentTemplate },
      section
    );
  } catch (error) {
    log.error("WebGL Starfield animation failed:", error);

    section.classList.remove("starfield-animating");
    section.classList.add("cards-visible");

    try {
      cleanupThreeCardSystem();
    } catch (cleanupError) {
      log.warn("Cleanup after error failed:", cleanupError);
    }

    fire(
      EVENTS.TEMPLATE_MOUNTED,
      { templateId: section.dataset.currentTemplate },
      section
    );
  }
}

/**
 * Reverse Animation Orchestrator
 */
async function applyReverseAnimation(section) {
  if (isReversing) {
    log.debug("⚠️ Reverse animation already running, skipping duplicate call");
    return;
  }

  log.info("🔄 Starting Three.js REVERSE Starfield Animation");
  isReversing = true;

  document.body.classList.add("starfield-active");

  section.classList.remove("cards-visible");
  section.classList.add("cards-materializing", "starfield-animating");

  if (
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    log.info("⏩ Reduced motion: Skipping particle animation");

    document.body.classList.remove("starfield-active");
    hasAnimated = false;
    isReversing = false;
    reverseTriggered = false;
    section.classList.remove("starfield-animating", "cards-materializing");
    section.classList.add("cards-hidden");

    navigateToTarget();
    return;
  }

  try {
    await startReverseAnimation();

    log.info("🔄 Three.js Reverse complete - cards hidden");

    document.body.classList.remove("starfield-active");
    hasAnimated = false;
    isReversing = false;
    reverseTriggered = false;

    section.classList.remove(
      "starfield-animating",
      "cards-materializing",
      "cards-visible"
    );
    section.classList.add("cards-hidden");

    navigateToTarget();
  } catch (error) {
    log.error("Three.js Reverse animation failed:", error);

    document.body.classList.remove("starfield-active");
    hasAnimated = false;
    isReversing = false;
    reverseTriggered = false;
    section.classList.remove("starfield-animating", "cards-materializing");
    section.classList.add("cards-hidden");

    try {
      cleanupThreeCardSystem();
    } catch (cleanupError) {
      log.warn("Cleanup after reverse error failed:", cleanupError);
    }

    navigateToTarget();
  }
}

/**
 * Trigger Reverse Animation
 */
function triggerReverse(section, source = "unknown") {
  if (!section || !document.body.contains(section)) {
    log.warn(
      `⏭️ Cannot trigger reverse: section not in DOM (source=${source})`
    );
    return false;
  }

  // Enhanced guard: Check animation state too
  if (reverseTriggered || isReversing || animationState.isAnimating) {
    log.debug(
      `⏭️ Reverse already triggered/running (source=${source}, isAnimating=${animationState.isAnimating}), skipping`
    );
    return false;
  }

  if (!hasAnimated) {
    log.debug(
      `⏭️ Forward animation not completed yet, skipping reverse trigger from ${source}`
    );
    return false;
  }

  reverseTriggered = true;

  const direction = getScrollDirection(section);

  targetSectionEl = findSiblingSection(section, direction);
  pendingSnap = !!targetSectionEl;

  log.info(
    `🔄 TRIGGER REVERSE (${source}): direction=${direction}, target=${
      targetSectionEl?.id || "none"
    }, willSnap=${pendingSnap}`
  );

  applyReverseAnimation(section).catch((error) => {
    log.error("Reverse animation promise rejected:", error);
  });

  return true;
}

/**
 * IntersectionObserver Setup
 */
function setupObserver(section) {
  if (!section) {
    log.warn("Section not found for observer");
    return () => {};
  }

  // Pre-initialize Three.js system (non-blocking)
  // Verhindert "System not initialized" Warning bei erstem Animation-Call
  if (!threeInstance || !threeInstance.mounted) {
    log.debug("Pre-initializing Three.js system...");
    initThreeCardSystem(section).catch((error) => {
      log.warn("Pre-initialization failed (will retry on animation):", error);
    });
  }

  if (intersectionObserver) {
    intersectionObserver.disconnect();
    intersectionObserver = null;
  }

  intersectionObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.target !== section) continue;

        const ratio = entry.intersectionRatio;
        const isVisible = entry.isIntersecting;

        log.debug(
          `📊 Intersection: visible=${isVisible}, ratio=${ratio.toFixed(
            3
          )}, hasAnimated=${hasAnimated}, isReversing=${isReversing}`
        );

        if (hasAnimated && !isReversing && !reverseTriggered && !isVisible) {
          log.info(
            "📊 IO: Section left viewport (ratio=0) - triggering reverse"
          );
          triggerReverse(section, "IntersectionObserver-NotVisible");
          return;
        }

        if (
          hasAnimated &&
          !isReversing &&
          !reverseTriggered &&
          ratio < REVERSE_THRESHOLD &&
          ratio > 0
        ) {
          triggerReverse(section, "IntersectionObserver");
          return;
        }

        if (
          isVisible &&
          ratio >= SNAP_THRESHOLD &&
          !hasAnimated &&
          !isReversing &&
          !animationState.isAnimating
        ) {
          if (section.dataset.currentTemplate) {
            log.info(
              `🚀 TRIGGERING FORWARD: Snap complete (${ratio.toFixed(3)})`
            );
            hasAnimated = true;

            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                applyForwardAnimation(section).catch((error) => {
                  log.error("Forward animation promise rejected:", error);
                  hasAnimated = false;
                });
              });
            });
          }
        }
      }
    },
    { threshold: THRESHOLDS }
  );

  intersectionObserver.observe(section);

  const handleScroll = throttle(() => {
    if (!hasAnimated || isReversing || reverseTriggered) {
      return;
    }

    const rect = section.getBoundingClientRect();
    const viewportHeight = window.innerHeight;

    const isInViewport = rect.bottom > 0 && rect.top < viewportHeight;

    if (!isInViewport) {
      log.debug("📐 Section out of viewport - triggering reverse immediately");
      triggerReverse(section, "ScrollHandler-OutOfView");
      return;
    }

    const visibleHeight = Math.max(
      0,
      Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0)
    );
    const visibleRatio = rect.height > 0 ? visibleHeight / rect.height : 0;

    log.debug(
      `📐 Scroll check: ratio=${visibleRatio.toFixed(3)}, threshold=${REVERSE_THRESHOLD}`
    );

    if (visibleRatio < REVERSE_THRESHOLD && visibleRatio > 0) {
      triggerReverse(section, "ScrollHandler");
    }
  }, SCROLL_THROTTLE);

  const handleTouchMove = throttle(() => {
    if (!hasAnimated || isReversing || reverseTriggered) return;

    const rect = section.getBoundingClientRect();
    const viewportHeight = window.innerHeight;

    const isInViewport = rect.bottom > 0 && rect.top < viewportHeight;

    if (!isInViewport) {
      log.debug(
        "👆 Touch: Section out of viewport - triggering reverse immediately"
      );
      triggerReverse(section, "TouchHandler-OutOfView");
      return;
    }

    const visibleHeight = Math.max(
      0,
      Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0)
    );
    const visibleRatio = rect.height > 0 ? visibleHeight / rect.height : 0;

    if (visibleRatio < REVERSE_THRESHOLD && visibleRatio > 0) {
      triggerReverse(section, "TouchHandler");
    }
  }, TOUCH_THROTTLE);

  window.addEventListener("scroll", handleScroll, { passive: true });
  window.addEventListener("touchmove", handleTouchMove, { passive: true });

  observerCleanup = () => {
    if (intersectionObserver) {
      intersectionObserver.disconnect();
      intersectionObserver = null;
    }
    window.removeEventListener("scroll", handleScroll);
    window.removeEventListener("touchmove", handleTouchMove);
    log.debug("Observer cleanup complete");
  };

  return observerCleanup;
}

// ===== Public API =====

/**
 * Initialisiert Three.js Card System
 * @param {HTMLElement} container - Features Section Element
 * @returns {Promise<boolean>}
 */
export async function initThreeCardSystem(container) {
  if (!container) {
    log.error("Container is required");
    return false;
  }

  // Check for reduced motion preference
  if (
    CONFIG.PERFORMANCE.REDUCED_MOTION_FALLBACK &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    log.info("Reduced motion detected, skipping Three.js initialization");
    return false;
  }

  // Lazy-load Three.js
  const THREE = await loadThreeJS();
  if (!THREE) {
    log.error("Failed to load Three.js");
    return false;
  }

  // Erstelle neue Instanz (oder reaktiviere existing)
  if (!threeInstance || !threeInstance.mounted) {
    threeInstance = new ThreeCardSystem(container, THREE);
    const success = await threeInstance.init();
    if (!success) {
      threeInstance = null;
      return false;
    }
  }

  return true;
}

/**
 * Startet Forward Animation (Partikel → Cards)
 * @param {HTMLElement} container - Container oder Section Element
 * @returns {Promise<boolean>}
 */
export async function startForwardAnimation(container) {
  if (!threeInstance || !threeInstance.mounted) {
    log.warn("System not initialized, initializing now...");
    const success = await initThreeCardSystem(container);
    if (!success) {
      log.error("Failed to initialize system for forward animation");
      return false;
    }
  }

  return threeInstance.startAnimation("forward");
}

/**
 * Startet Reverse Animation (Cards → Partikel)
 * @returns {Promise<boolean>}
 */
export async function startReverseAnimation() {
  if (!threeInstance || !threeInstance.mounted) {
    log.error("System not initialized for reverse animation");
    return false;
  }

  return threeInstance.startAnimation("reverse");
}

/**
 * Stoppt laufende Animation
 */
export function stopAnimation() {
  if (threeInstance) {
    threeInstance.stopAnimation();
  }
}

/**
 * Cleanup & Dispose
 */
export function cleanupThreeCardSystem() {
  if (threeInstance) {
    threeInstance.cleanup();
    threeInstance = null;
  }
}

/**
 * Haupt-Initialisierung für FeatureRotation System
 * Integriert Template-Loading, Observer-Setup und Animation-Orchestrierung
 * @returns {Promise<boolean>}
 */
export async function initFeatureRotation() {
  log.info("Initializing Integrated FeatureRotation System");

  const section = getElementById(SECTION_ID);
  if (!section) {
    log.error(`Features section '#${SECTION_ID}' not found!`);
    return false;
  }

  try {
    // 1. Templates laden
    log.debug("Step 1: Loading templates...");
    const templatesOk = await ensureTemplates(section);
    if (!templatesOk) {
      log.error("Failed to load templates");
      return false;
    }

    // 2. Prüfe verfügbare Templates
    log.debug("Step 2: Checking for available templates...");
    const availableTemplates = TEMPLATE_IDS.filter((id) => {
      const found = getElementById(id);
      log.debug(`  - ${id}: ${found ? "✅ found" : "❌ missing"}`);
      return found;
    });

    if (availableTemplates.length === 0) {
      log.error(`No templates found! Searched for: ${TEMPLATE_IDS.join(", ")}`);
      return false;
    }

    // 3. Order shuffeln
    log.debug("Step 3: Shuffling template order...");
    templateOrder = shuffleArray([...availableTemplates]);
    log.info(
      `Template order: ${templateOrder.join(", ")} (${templateOrder.length} templates)`
    );

    // 4. Cards mounten
    log.debug("Step 4: Mounting initial cards...");
    const mountSuccess = mountInitialCards(section);
    if (!mountSuccess) {
      log.error("Failed to mount initial cards");
      return false;
    }

    // 5. Observer starten
    log.debug("Step 5: Starting observer...");
    setupObserver(section);

    log.info("✅ Integrated FeatureRotation System initialized successfully");
    return true;
  } catch (error) {
    log.error("Failed to initialize:", error);
    return false;
  }
}

/**
 * Vollständiges Cleanup des Systems
 * Bereinigt alle Resources, Event Listener und State
 */
export function destroyFeatureRotation() {
  log.info("Destroying Integrated FeatureRotation System...");

  // 1. Observer cleanup
  if (observerCleanup) {
    try {
      observerCleanup();
    } catch (error) {
      log.warn("Observer cleanup error:", error);
    }
    observerCleanup = null;
  }

  // 2. IntersectionObserver cleanup
  if (intersectionObserver) {
    try {
      intersectionObserver.disconnect();
    } catch (error) {
      log.warn("IO disconnect error:", error);
    }
    intersectionObserver = null;
  }

  // 3. Three.js cleanup
  try {
    cleanupThreeCardSystem();
  } catch (error) {
    log.warn("Three.js cleanup error:", error);
  }

  // 4. Remove body classes
  try {
    document.body.classList.remove("starfield-active");
  } catch (error) {
    log.warn("Body class removal error:", error);
  }

  // 6. State reset
  hasAnimated = false;
  isReversing = false;
  reverseTriggered = false;
  pendingSnap = false;
  targetSectionEl = null;
  templatesLoaded = false;
  templateOrder = [];
  currentTemplateIndex = 0;

  log.info("✅ Integrated FeatureRotation System destroyed");
}

// ===== Auto-Initialization =====
// Nur wenn als Hauptmodul geladen (nicht als Import)
if (typeof window !== "undefined" && !window.FeatureRotationIntegrated) {
  window.FeatureRotationIntegrated = {
    init: initFeatureRotation,
    destroy: destroyFeatureRotation,
    getState: () => ({
      hasAnimated,
      isReversing,
      reverseTriggered,
      templatesLoaded,
      templateOrder: [...templateOrder],
      currentTemplateIndex,
    }),
  };

  // Auto-Init bei DOMContentLoaded
  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      () => {
        initFeatureRotation().catch((error) => {
          log.error("Auto-initialization failed:", error);
        });
      },
      { once: true }
    );
  } else {
    // DOM already loaded
    initFeatureRotation().catch((error) => {
      log.error("Auto-initialization failed:", error);
    });
  }
}
