/**
 * Three.js Card System - WebGL Particle Constellation Animation
 *
 * Professional particle system for card materialization effects:
 * - Three.js-basierte Partikel statt Canvas2D für bessere Performance
 * - Synchron mit karten-rotation.js Animation States
 * - Partikel formieren sich zu Card-Konturen (Forward Animation)
 * - Cards dematerialisieren zu Partikeln (Reverse Animation)
 * - Integriert mit shared-particle-system für Cleanup & Koordination
 * - Wiederverwendung von Earth-System Patterns (LOD, Timing, Easing)
 *
 * Features:
 * - GPU-optimiertes BufferGeometry mit InstancedMesh
 * - Adaptive Partikel-Count: Desktop 150, Mobile 60
 * - Twinkle-Effekt via Shader (wie Earth Starfield)
 * - Smooth Easing: ease-out-cubic für Formation
 * - Performance-aware: DPR-Capping, LOD-System
 * - Cleanup via TimerManager & SharedCleanupManager
 *
 * @author Portfolio System
 * @version 1.0.0
 * @created 2025-10-14
 */

import { createLogger, onResize, TimerManager } from '../shared-utilities.js';
import {
  registerParticleSystem,
  sharedCleanupManager,
  unregisterParticleSystem,
} from './shared-particle-system.js';

const log = createLogger('threeCardSystem');
const cardTimers = new TimerManager();

// ===== CONFIGURATION =====
// Synchron mit karten-star-animation.css & Earth-System
const CONFIG = {
  PARTICLES: {
    COUNT_DESKTOP: 150,
    COUNT_MOBILE: 60,
    SIZE: 0.08, // Three.js Units (relativ zu Card-Container Scale)
    COLOR: 0x098bff, // Portfolio Blue
    OPACITY: 0.8,
    TWINKLE_SPEED: 0.25, // Wie Earth Starfield
    TWINKLE_AMPLITUDE: 0.5,
  },
  ANIMATION: {
    FORWARD_DURATION: 1400, // ms - Synchron mit CSS (1400ms)
    REVERSE_DURATION: 800, // ms - Schneller für snappier feel
    EASING: {
      FORWARD: 'easeOutCubic', // Approximation von ease-out-expo
      REVERSE: 'easeInCubic', // Beschleunigt zum Ende
    },
  },
  CAMERA: {
    FOV: 50,
    NEAR: 0.1,
    FAR: 100,
    POSITION: { x: 0, y: 0, z: 15 }, // Zentriert über Card-Grid
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

// ===== Easing Functions =====
const Easing = {
  easeOutCubic: (t) => 1 - Math.pow(1 - t, 3),
  easeInCubic: (t) => t * t * t,
  easeOutExpo: (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
};

// ===== Module State =====
let threeInstance = null; // Singleton Three.js Instance
let animationState = {
  isAnimating: false,
  mode: null, // 'forward' | 'reverse'
  startTime: null,
  rafId: null,
};

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

    log.info('ThreeCardSystem instantiated');
  }

  /**
   * Initialisiert Three.js Scene, Camera, Renderer
   */
  async init() {
    if (this.mounted) {
      log.warn('System already mounted');
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

      // Append Canvas
      this.renderer.domElement.className = 'three-card-canvas';
      this.renderer.domElement.style.cssText = `
        position: absolute;
        inset: 0;
        z-index: 1001;
        pointer-events: none;
      `;
      this.container.appendChild(this.renderer.domElement);

      // Resize Handler
      this.resizeHandler = onResize(() => this.handleResize());

      this.mounted = true;
      log.info('✅ Three.js Card System initialized', {
        width: rect.width,
        height: rect.height,
        dpr,
      });

      // Register im Shared System
      registerParticleSystem('cardSystem', this);
      sharedCleanupManager.addCleanupFunction(
        'cardSystem',
        () => this.cleanup(),
        'Three.js Card System Cleanup'
      );

      return true;
    } catch (error) {
      log.error('Failed to initialize Three.js Card System:', error);
      return false;
    }
  }

  /**
   * Erstellt Partikel-System mit BufferGeometry
   * @param {string} mode - 'forward' | 'reverse'
   */
  createParticles(mode = 'forward') {
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    const particleCount = isMobile
      ? CONFIG.PARTICLES.COUNT_MOBILE
      : CONFIG.PARTICLES.COUNT_DESKTOP;

    const cards = this.container.querySelectorAll('.card');

    if (!cards.length) {
      log.warn('No cards found for particle creation');
      return false;
    }

    // Berechne Card-Positionen in Three.js Koordinaten
    const cardPositions = Array.from(cards).map((card) => {
      const cardRect = card.getBoundingClientRect();
      const containerRect = this.container.getBoundingClientRect();

      // Normalisiere zu [-1, 1] Viewport-Space
      const x =
        ((cardRect.left + cardRect.width / 2 - containerRect.left) /
          containerRect.width) *
          2 -
        1;
      const y = -(
        ((cardRect.top + cardRect.height / 2 - containerRect.top) /
          containerRect.height) *
          2 -
        1
      );

      // Scale zu Three.js World-Space (Camera sieht ~10 Units bei z=15)
      const worldScale = 10;
      return {
        x: x * worldScale * (containerRect.width / containerRect.height),
        y: y * worldScale,
        width: (cardRect.width / containerRect.width) * worldScale * 2,
        height: (cardRect.height / containerRect.height) * worldScale * 2,
      };
    });

    log.debug('Card positions in 3D space:', cardPositions);

    // BufferGeometry für Partikel
    const geometry = new this.THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const targets = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    const twinkleOffsets = new Float32Array(particleCount);

    this.particleData = [];

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;

      // Forward: Random → Card, Reverse: Card → Random
      let startX, startY, targetX, targetY;

      if (mode === 'forward') {
        // Start: Random über gesamte Viewport
        startX = (Math.random() - 0.5) * 20;
        startY = (Math.random() - 0.5) * 15;

        // Target: Random Card + Position innerhalb Card
        const targetCard =
          cardPositions[Math.floor(Math.random() * cardPositions.length)];
        targetX = targetCard.x + (Math.random() - 0.5) * targetCard.width;
        targetY = targetCard.y + (Math.random() - 0.5) * targetCard.height;
      } else {
        // Reverse: Card → Random
        const startCard =
          cardPositions[Math.floor(Math.random() * cardPositions.length)];
        startX = startCard.x + (Math.random() - 0.5) * startCard.width;
        startY = startCard.y + (Math.random() - 0.5) * startCard.height;

        targetX = (Math.random() - 0.5) * 20;
        targetY = (Math.random() - 0.5) * 15;
      }

      // Positions (Start)
      positions[i3] = startX;
      positions[i3 + 1] = startY;
      positions[i3 + 2] = 0;

      // Targets
      targets[i3] = targetX;
      targets[i3 + 1] = targetY;
      targets[i3 + 2] = 0;

      // Color (Portfolio Blue mit leichter Variation)
      const color = new this.THREE.Color(CONFIG.PARTICLES.COLOR);
      color.offsetHSL(0, 0, (Math.random() - 0.5) * 0.2); // ±10% Lightness
      colors[i3] = color.r;
      colors[i3 + 1] = color.g;
      colors[i3 + 2] = color.b;

      // Size
      sizes[i] = CONFIG.PARTICLES.SIZE * (0.5 + Math.random() * 1.5); // 0.5-2.0x

      // Twinkle Phase Offset
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

    geometry.setAttribute(
      'position',
      new this.THREE.BufferAttribute(positions, 3)
    );
    geometry.setAttribute('target', new this.THREE.BufferAttribute(targets, 3));
    geometry.setAttribute('color', new this.THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new this.THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute(
      'twinkleOffset',
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

    this.particles = new this.THREE.Points(geometry, material);
    this.scene.add(this.particles);

    log.info(
      `✨ Created ${particleCount} particles in ${mode} mode (mobile: ${isMobile})`
    );
    return true;
  }

  /**
   * Startet Animation (Forward oder Reverse)
   * @param {string} mode - 'forward' | 'reverse'
   */
  startAnimation(mode = 'forward') {
    if (animationState.isAnimating) {
      log.warn('Animation already running, stopping previous');
      this.stopAnimation();
    }

    // Erstelle neue Partikel
    if (!this.createParticles(mode)) {
      log.error('Failed to create particles');
      return false;
    }

    animationState.isAnimating = true;
    animationState.mode = mode;
    animationState.startTime = performance.now();

    log.info(`🎬 Starting ${mode} animation`);
    this.animate();

    return true;
  }

  /**
   * Animation Loop
   */
  animate() {
    if (!animationState.isAnimating) return;

    const now = performance.now();
    const elapsed = now - animationState.startTime;
    const duration =
      animationState.mode === 'forward'
        ? CONFIG.ANIMATION.FORWARD_DURATION
        : CONFIG.ANIMATION.REVERSE_DURATION;
    const progress = Math.min(elapsed / duration, 1);

    // Easing
    const easing =
      animationState.mode === 'forward'
        ? Easing.easeOutCubic
        : Easing.easeInCubic;
    const eased = easing(progress);

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
      if (animationState.mode === 'reverse') {
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
    log.info(`✅ ${animationState.mode} animation complete`);

    // Cleanup Partikel
    if (this.particles) {
      this.scene.remove(this.particles);
      this.particles.geometry.dispose();
      this.particles.material.dispose();
      this.particles = null;
    }

    this.particleData = [];
    animationState.isAnimating = false;

    // Event für karten-rotation.js
    const event = new CustomEvent('three-card-animation-complete', {
      detail: { mode: animationState.mode },
      bubbles: true,
    });
    this.container.dispatchEvent(event);

    animationState.mode = null;
    animationState.startTime = null;
  }

  /**
   * Stoppt laufende Animation
   */
  stopAnimation() {
    if (animationState.rafId) {
      cancelAnimationFrame(animationState.rafId);
      animationState.rafId = null;
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

    log.debug('Animation stopped');
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

    log.debug('Resized to:', { width: rect.width, height: rect.height });
  }

  /**
   * Cleanup & Dispose
   */
  cleanup() {
    log.info('Starting cleanup...');

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

    unregisterParticleSystem('cardSystem');
    log.info('✅ Cleanup complete');
  }
}

// ===== Public API =====

/**
 * Initialisiert Three.js Card System
 * @param {HTMLElement} container - Features Section Element
 * @returns {Promise<boolean>}
 */
export async function initThreeCardSystem(container) {
  if (!container) {
    log.error('Container is required');
    return false;
  }

  // Check for reduced motion preference
  if (
    CONFIG.PERFORMANCE.REDUCED_MOTION_FALLBACK &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    log.info('Reduced motion detected, skipping Three.js initialization');
    return false;
  }

  // Lazy-load Three.js
  const THREE = await loadThreeJS();
  if (!THREE) {
    log.error('Failed to load Three.js');
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
 * @param {HTMLElement} container - Features Section
 * @returns {boolean}
 */
export function startForwardAnimation(container) {
  if (!threeInstance || !threeInstance.mounted) {
    log.warn('System not initialized, attempting init...');
    // Async init aber sync return - nicht ideal, aber kompatibel mit bestehendem Code
    initThreeCardSystem(container).then((success) => {
      if (success) threeInstance.startAnimation('forward');
    });
    return false;
  }

  return threeInstance.startAnimation('forward');
}

/**
 * Startet Reverse Animation (Cards → Partikel)
 * @returns {boolean}
 */
export function startReverseAnimation() {
  if (!threeInstance || !threeInstance.mounted) {
    log.warn('System not initialized');
    return false;
  }

  return threeInstance.startAnimation('reverse');
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
 * Lazy-Load Three.js Library
 * @returns {Promise<object|null>}
 */
async function loadThreeJS() {
  try {
    // Import via ES6 Module (nutzt existing three.module.min.js)
    const THREE = await import(
      '/content/webentwicklung/lib/three/build/three.module.min.js'
    );
    log.info('✅ Three.js loaded successfully');
    return THREE;
  } catch (error) {
    log.error('Failed to load Three.js:', error);
    return null;
  }
}

// ===== Export für Testing/Debugging =====
export function getThreeInstance() {
  return threeInstance;
}

export function getAnimationState() {
  return { ...animationState };
}
