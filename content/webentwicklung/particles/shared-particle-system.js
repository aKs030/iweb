/**
 * Shared Particle System - Common infrastructure for Three.js visual effects
 * 
 * FIXES v2.1.2:
 * - Fixed missing closing braces in registerSystem/unregisterSystem
 * - Fixed incomplete ternary operator in ShootingStarManager
 * - Improved error handling and logging
 * 
 * @version 2.1.2-fixed
 * @last-modified 2025-10-26
 */

import { createLogger, throttle } from "../shared-utilities.js";

const log = createLogger("sharedParticleSystem");

// ===== Shared Configuration =====

export const SHARED_CONFIG = {
  PERFORMANCE: {
    THROTTLE_MS: 20,
  },
  SCROLL: {
    CSS_PROPERTY_PREFIX: "--scroll-",
  },
};

// ===== Shared State Management =====

class SharedParticleState {
  constructor() {
    this.systems = new Map();
    this.isInitialized = false;
  }

  registerSystem(name, instance) {
    this.systems.set(name, instance);
  }

  unregisterSystem(name) {
    this.systems.delete(name);
  }

  reset() {
    this.systems.clear();
    this.isInitialized = false;
  }
}

const sharedState = new SharedParticleState();

// ===== Parallax Manager =====

export class SharedParallaxManager {
  constructor() {
    this.isActive = false;
    this.handlers = new Set();
    this.scrollHandler = null;
  }

  addHandler(handler, name = "anonymous") {
    this.handlers.add({ handler, name });
    if (!this.isActive) this.activate();
  }

  removeHandler(handler) {
    const handlerObj = Array.from(this.handlers).find((h) => h.handler === handler);
    if (handlerObj) this.handlers.delete(handlerObj);
    if (this.handlers.size === 0) this.deactivate();
  }

  activate() {
    if (this.isActive) return;

    this.scrollHandler = throttle(() => {
      const scrollY = window.pageYOffset;
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      const scrollableHeight = Math.max(1, documentHeight - windowHeight);
      const progress = Math.min(1, Math.max(0, scrollY / scrollableHeight));

      document.documentElement.style.setProperty(
        `${SHARED_CONFIG.SCROLL.CSS_PROPERTY_PREFIX}progress`,
        progress.toFixed(4)
      );

      this.handlers.forEach(({ handler }) => handler(progress));
    }, SHARED_CONFIG.PERFORMANCE.THROTTLE_MS);

    window.addEventListener("scroll", this.scrollHandler, { passive: true });
    this.isActive = true;
    this.scrollHandler();
  }

  deactivate() {
    if (!this.isActive) return;
    window.removeEventListener("scroll", this.scrollHandler);
    this.isActive = false;
    this.handlers.clear();
  }
}

// ===== Cleanup Manager =====

export class SharedCleanupManager {
  constructor() {
    this.cleanupFunctions = new Map();
  }

  addCleanupFunction(systemName, cleanupFn, description = "anonymous") {
    if (!this.cleanupFunctions.has(systemName)) {
      this.cleanupFunctions.set(systemName, []);
    }

    this.cleanupFunctions.get(systemName).push({ fn: cleanupFn, description });
    log.debug(`Cleanup function '${description}' added for system '${systemName}'.`);
  }

  cleanupSystem(systemName) {
    const systemCleanups = this.cleanupFunctions.get(systemName);
    if (!systemCleanups) return;

    log.info(`Cleaning up system: ${systemName} (${systemCleanups.length} functions)`);

    systemCleanups.forEach(({ fn, description }) => {
      try {
        fn();
      } catch (e) {
        log.error(`Error during cleanup of '${description}' in '${systemName}':`, e);
      }
    });

    this.cleanupFunctions.delete(systemName);
  }

  cleanupAll() {
    log.info("Starting global cleanup of all registered systems.");
    this.cleanupFunctions.forEach((_, systemName) => this.cleanupSystem(systemName));
    sharedParallaxManager.deactivate();
    sharedState.reset();
    log.info("Global cleanup completed.");
  }
}

// ===== Shooting Star Manager =====

export class ShootingStarManager {
  constructor(scene, THREE, config = {}) {
    this.scene = scene;
    this.THREE = THREE;
    this.activeStars = [];
    this.timeoutId = null;

    this.config = config || {
      BASE_FREQUENCY: 0.003,
      SHOWER_FREQUENCY: 0.02,
      SHOWER_DURATION: 180,
      SHOWER_COOLDOWN: 1800,
      MAX_SIMULTANEOUS: 3,
      TRAJECTORIES: [
        { start: { x: -100, y: 50, z: -50 }, end: { x: 100, y: -50, z: 50 } },
        { start: { x: 100, y: 60, z: -40 }, end: { x: -80, y: -40, z: 60 } },
        { start: { x: -80, y: 70, z: 60 }, end: { x: 90, y: -60, z: -70 } },
      ],
    };

    this.isShowerActive = false;
    this.showerTimer = 0;
    this.showerCooldownTimer = 0;
    this.disabled = false;

    log.debug("ShootingStarManager initialized with meteor shower support.");
  }

  start() {
    log.debug("ShootingStarManager started");
  }

  triggerMeteorShower() {
    if (this.isShowerActive || this.showerCooldownTimer > 0) {
      log.debug("Meteor shower already active or in cooldown");
      return;
    }

    this.isShowerActive = true;
    this.showerTimer = 0;
    log.info("🌠 Meteor shower triggered!");
  }

  createShootingStar(trajectory = null) {
    if (this.activeStars.length >= this.config.MAX_SIMULTANEOUS) {
      return;
    }

    try {
      const geometry = new this.THREE.SphereGeometry(0.05, 8, 8);
      const material = new this.THREE.MeshBasicMaterial({
        color: 0xfffdef,
        transparent: true,
        opacity: 1.0,
      });
      const star = new this.THREE.Mesh(geometry, material);

      let startPos, velocity;

      if (trajectory && trajectory.start && trajectory.end) {
        startPos = trajectory.start;
        const direction = new this.THREE.Vector3(
          trajectory.end.x - trajectory.start.x,
          trajectory.end.y - trajectory.start.y,
          trajectory.end.z - trajectory.start.z
        ).normalize();
        velocity = direction.multiplyScalar(0.3 + Math.random() * 0.2);
      } else {
        startPos = {
          x: (Math.random() - 0.5) * 100,
          y: 20 + Math.random() * 20,
          z: -50 - Math.random() * 50,
        };
        velocity = new this.THREE.Vector3(
          (Math.random() - 0.9) * 0.2,
          (Math.random() - 0.6) * -0.2,
          0
        );
      }

      star.position.set(startPos.x, startPos.y, startPos.z);

      const stretchFactor = 2 + Math.random() * 3;
      star.scale.set(1, 1, stretchFactor);
      star.lookAt(star.position.clone().add(velocity));

      const lifetime = 300 + Math.random() * 200;

      this.activeStars.push({
        mesh: star,
        velocity,
        lifetime,
        age: 0,
        initialOpacity: 1.0,
      });

      this.scene.add(star);
    } catch (error) {
      log.error("Failed to create shooting star:", error);
    }
  }

  update() {
    if (this.disabled) return;

    if (this.isShowerActive) {
      this.showerTimer++;
      if (this.showerTimer >= this.config.SHOWER_DURATION) {
        this.isShowerActive = false;
        this.showerCooldownTimer = this.config.SHOWER_COOLDOWN;
        log.info("Meteor shower ended");
      }
    }

    if (this.showerCooldownTimer > 0) {
      this.showerCooldownTimer--;
    }

    const spawnChance = this.isShowerActive
      ? this.config.SHOWER_FREQUENCY
      : this.config.BASE_FREQUENCY;

    if (Math.random() < spawnChance) {
      const trajectory =
        this.config.TRAJECTORIES[Math.floor(Math.random() * this.config.TRAJECTORIES.length)];
      this.createShootingStar(trajectory);
    }

    for (let i = this.activeStars.length - 1; i >= 0; i--) {
      const star = this.activeStars[i];
      star.age++;
      star.mesh.position.add(star.velocity);

      const fadeStart = star.lifetime * 0.7;
      if (star.age > fadeStart) {
        const fadeProgress = (star.age - fadeStart) / (star.lifetime - fadeStart);
        star.mesh.material.opacity = star.initialOpacity * (1 - fadeProgress);
      }

      if (star.age > star.lifetime) {
        this.scene.remove(star.mesh);
        star.mesh.geometry.dispose();
        star.mesh.material.dispose();
        this.activeStars.splice(i, 1);
      }
    }
  }

  cleanup() {
    this.activeStars.forEach((star) => {
      this.scene.remove(star.mesh);
      star.mesh.geometry.dispose();
      star.mesh.material.dispose();
    });
    this.activeStars = [];
    log.debug("ShootingStarManager cleaned up.");
  }
}

// ===== Singleton Instances =====

export const sharedParallaxManager = new SharedParallaxManager();
export const sharedCleanupManager = new SharedCleanupManager();

// ===== Shared Three.js Loading =====

const THREE_PATHS = [
  "/content/webentwicklung/particles/three.module.js",
  "https://cdn.jsdelivr.net/npm/three@0.155.0/build/three.module.js",
];

export async function loadThreeJS() {
  if (window.THREE) {
    log.info("✅ Three.js already loaded (cached)");
    return window.THREE;
  }

  for (const src of THREE_PATHS) {
    try {
      log.info(`📦 Loading Three.js from: ${src}`);
      const THREE = await import(src);
      const ThreeJS = THREE.default || THREE;

      if (ThreeJS?.WebGLRenderer) {
        window.THREE = ThreeJS;
        log.info("✅ Three.js loaded successfully");
        return ThreeJS;
      } else {
        throw new Error("Invalid Three.js module - missing WebGLRenderer");
      }
    } catch (error) {
      log.warn(`Failed to load Three.js from ${src}:`, error);
    }
  }

  log.error("❌ Failed to load Three.js from all sources");
  throw new Error("Three.js could not be loaded from any source");
}

// ===== Public API =====

export function getSharedState() {
  return sharedState;
}

export function registerParticleSystem(name, instance) {
  sharedState.registerSystem(name, instance);
}

export function unregisterParticleSystem(name) {
  sharedState.unregisterSystem(name);
}