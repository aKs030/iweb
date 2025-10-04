/**
 * Shared Particle System - Common infrastructure for Three.js visual effects
 *
 * Centralizes common functionalities for visual systems:
 * - Parallax scroll management with synchronous effects
 * - Resource cleanup management
 * - Performance-optimized state management
 * - NEW: A manager for creating occasional shooting stars
 *
 * @author Portfolio System
 * @version 2.0.0
 * @created 2025-10-03
 */

import { createLogger, throttle } from "../shared-utilities.js";

const log = createLogger("sharedParticleSystem");

// ===== Shared Configuration =====
export const SHARED_CONFIG = {
  PERFORMANCE: {
    THROTTLE_MS: 16, // 60fps
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
  registerSystem(name, instance) { this.systems.set(name, instance); }
  unregisterSystem(name) { this.systems.delete(name); }
  reset() { this.systems.clear(); this.isInitialized = false; }
}
const sharedState = new SharedParticleState();

// ===== Parallax Manager (Simplified from original) =====
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
    const handlerObj = Array.from(this.handlers).find(h => h.handler === handler);
    if (handlerObj) this.handlers.delete(handlerObj);
    if (this.handlers.size === 0) this.deactivate();
  }
  activate() {
    if (this.isActive) return;
    this.scrollHandler = throttle(() => {
      const progress = this.calculateScrollProgress();
      document.documentElement.style.setProperty(`${SHARED_CONFIG.SCROLL.CSS_PROPERTY_PREFIX}progress`, progress);
      this.handlers.forEach(({ handler }) => handler(progress));
    }, SHARED_CONFIG.PERFORMANCE.THROTTLE_MS);
    window.addEventListener("scroll", this.scrollHandler, { passive: true });
    this.isActive = true;
    this.scrollHandler(); // Initial call
  }
  deactivate() {
    if (!this.isActive) return;
    window.removeEventListener("scroll", this.scrollHandler);
    this.isActive = false;
    this.handlers.clear();
  }
  calculateScrollProgress() {
    const scrollY = window.pageYOffset;
    const windowHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;
    return Math.min(1, Math.max(0, scrollY / Math.max(1, documentHeight - windowHeight)));
  }
}

// ===== Cleanup Manager (Simplified from original) =====
export class SharedCleanupManager {
  constructor() {
    this.cleanupFunctions = new Map();
  }
  addCleanupFunction(systemName, cleanupFn, description = "anonymous") {
    if (!this.cleanupFunctions.has(systemName)) {
      this.cleanupFunctions.set(systemName, []);
    }
    this.cleanupFunctions.get(systemName).push({ fn: cleanupFn, description });
  }
  cleanupSystem(systemName) {
    const systemCleanups = this.cleanupFunctions.get(systemName);
    if (!systemCleanups) return;
    systemCleanups.forEach(({ fn }) => { try { fn(); } catch (e) { log.error('Cleanup error', e); }});
    this.cleanupFunctions.delete(systemName);
  }
  cleanupAll() {
    this.cleanupFunctions.forEach((_, systemName) => this.cleanupSystem(systemName));
    sharedParallaxManager.deactivate();
    sharedState.reset();
    log.info("Global cleanup completed");
  }
}

// ===== NEW: Shooting Star Manager =====
export class ShootingStarManager {
    constructor(scene, THREE) {
        this.scene = scene;
        this.THREE = THREE;
        this.activeStars = [];
        this.timeoutId = null;
        log.debug("ShootingStarManager initialized.");
    }

    start() {
        this.scheduleNextStar();
    }

    scheduleNextStar() {
        const delay = 10000 + Math.random() * 15000; // Every 10-25 seconds
        this.timeoutId = setTimeout(() => {
            this.createShootingStar();
            this.scheduleNextStar();
        }, delay);
    }

    createShootingStar() {
        const geometry = new this.THREE.SphereGeometry(0.05, 8, 8);
        const material = new this.THREE.MeshBasicMaterial({ color: 0xfffdef });
        const star = new this.THREE.Mesh(geometry, material);

        // Random starting position outside the view frustum
        star.position.set(
            (Math.random() - 0.5) * 100,
            20 + Math.random() * 20,
            -50 - Math.random() * 50
        );

        const velocity = new this.THREE.Vector3(
            (Math.random() - 0.9) * 0.2, // Move mostly left
            (Math.random() - 0.6) * -0.2, // Move mostly down
            0
        );

        const lifetime = 400 + Math.random() * 200; // Frames to live

        this.activeStars.push({ mesh: star, velocity, lifetime, age: 0 });
        this.scene.add(star);
    }

    update() {
        for (let i = this.activeStars.length - 1; i >= 0; i--) {
            const star = this.activeStars[i];
            star.age++;
            star.mesh.position.add(star.velocity);

            if (star.age > star.lifetime) {
                this.scene.remove(star.mesh);
                star.mesh.geometry.dispose();
                star.mesh.material.dispose();
                this.activeStars.splice(i, 1);
            }
        }
    }

    cleanup() {
        clearTimeout(this.timeoutId);
        this.activeStars.forEach(star => {
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

// ===== Public API =====
export function getSharedState() { return sharedState; }
export function registerParticleSystem(name, instance) { sharedState.registerSystem(name, instance); }
export function unregisterParticleSystem(name) { sharedState.unregisterSystem(name); }
