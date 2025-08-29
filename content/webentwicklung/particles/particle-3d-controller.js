/**
 * 3D Particle Controller - Manages 3D animations and effects for the particle system
 * Provides various 3D animation types: rotate, float, pulse, parallax, spiral
 * Features GPU acceleration hints, adaptive quality, and cross-browser compatibility
 */

export class Particle3DController {
  constructor(canvas, particles, options = {}) {
    this.canvas = canvas;
    this.particles = particles;
    this.effect = 'none';
    this.enabled = false;
    this.time = 0;
    
    // 3D Configuration
    this.config = {
      perspective: 800,
      depth: 500,
      rotationSpeed: 0.01,
      floatAmplitude: 20,
      floatSpeed: 0.005,
      pulseSpeed: 0.008,
      spiralRadius: 150,
      spiralSpeed: 0.004,
      parallaxFactor: 0.3,
      ...options
    };

    // Performance settings
    this.quality = {
      adaptive: true,
      targetFPS: 60,
      minQuality: 0.3,
      maxQuality: 1.0,
      currentQuality: 1.0
    };

    // Animation state
    this.animationState = {
      rotationX: 0,
      rotationY: 0,
      rotationZ: 0,
      floatOffset: 0,
      pulsePhase: 0,
      spiralPhase: 0
    };

    // Feature detection
    this.supports3D = this.detectSupport();
    this.centerX = 0;
    this.centerY = 0;
    this.centerZ = 0;

    this.updateCenter();
  }

  /**
   * Detect 3D support capabilities
   */
  detectSupport() {
    try {
      // Check for basic 3D transform support
      const testEl = document.createElement('div');
      testEl.style.transform = 'translateZ(0)';
      const hasTransforms = testEl.style.transform !== '';
      
      // Check for requestAnimationFrame
      const hasRAF = typeof requestAnimationFrame === 'function';
      
      // Check canvas performance
      const ctx = this.canvas.getContext('2d');
      const hasCanvas = !!ctx;
      
      return hasTransforms && hasRAF && hasCanvas;
    } catch {
      return false;
    }
  }

  /**
   * Update the center point for 3D transformations
   */
  updateCenter() {
    this.centerX = this.canvas.width / 2;
    this.centerY = this.canvas.height / 2;
    this.centerZ = 0;
  }

  /**
   * Set the active 3D effect
   * @param {string} effect - The effect type: 'none', 'rotate', 'float', 'pulse', 'parallax', 'spiral'
   */
  setEffect(effect) {
    const validEffects = ['none', 'rotate', 'float', 'pulse', 'parallax', 'spiral'];
    
    if (!validEffects.includes(effect)) {
      console.warn(`Invalid 3D effect: ${effect}. Valid effects:`, validEffects);
      return;
    }
    
    this.effect = effect;
    this.enabled = effect !== 'none' && this.supports3D;
    
    // Reset animation state when changing effects
    this.animationState = {
      rotationX: 0,
      rotationY: 0,
      rotationZ: 0,
      floatOffset: 0,
      pulsePhase: 0,
      spiralPhase: 0
    };
  }

  /**
   * Update 3D transformations for all particles
   * @param {number} deltaTime - Time elapsed since last frame
   * @param {number} fps - Current FPS for adaptive quality
   */
  update(deltaTime, fps = 60) {
    if (!this.enabled || this.effect === 'none') return;

    this.time += deltaTime;
    
    // Adaptive quality based on performance
    if (this.quality.adaptive) {
      this.updateQuality(fps);
    }

    // Update animation state
    this.updateAnimationState(deltaTime);

    // Apply 3D transformations to particles
    for (let i = 0; i < this.particles.length; i++) {
      this.transformParticle(this.particles[i], i);
    }
  }

  /**
   * Update animation state based on current effect
   * @param {number} deltaTime - Time elapsed since last frame
   */
  updateAnimationState(deltaTime) {
    const dt = deltaTime * this.quality.currentQuality;

    switch (this.effect) {
      case 'rotate':
        this.animationState.rotationX += this.config.rotationSpeed * dt;
        this.animationState.rotationY += this.config.rotationSpeed * dt * 0.7;
        this.animationState.rotationZ += this.config.rotationSpeed * dt * 0.5;
        break;
        
      case 'float':
        this.animationState.floatOffset += this.config.floatSpeed * dt;
        break;
        
      case 'pulse':
        this.animationState.pulsePhase += this.config.pulseSpeed * dt;
        break;
        
      case 'spiral':
        this.animationState.spiralPhase += this.config.spiralSpeed * dt;
        break;
    }
  }

  /**
   * Transform individual particle based on current effect
   * @param {Object} particle - Particle object to transform
   * @param {number} index - Particle index for variation
   */
  transformParticle(particle, index) {
    // Store original 2D position if not stored
    if (!particle._original) {
      particle._original = { x: particle.x, y: particle.y };
      particle.z = particle.z || Math.random() * this.config.depth - this.config.depth / 2;
    }

    // Reset to original position
    let x = particle._original.x;
    let y = particle._original.y;
    let z = particle.z || 0;
    let scale = 1;
    let alpha = 1;

    switch (this.effect) {
      case 'rotate':
        ({ x, y, z } = this.applyRotation(x, y, z, index));
        break;
        
      case 'float':
        ({ x, y, z, alpha } = this.applyFloat(x, y, z, index));
        break;
        
      case 'pulse':
        ({ scale, alpha } = this.applyPulse(x, y, z, index));
        break;
        
      case 'parallax':
        ({ x, y } = this.applyParallax(x, y, z, index));
        break;
        
      case 'spiral':
        ({ x, y, z } = this.applySpiral(x, y, z, index));
        break;
    }

    // Project 3D coordinates to 2D canvas
    const projected = this.project3DTo2D(x, y, z);
    
    // Update particle properties
    particle.x = projected.x;
    particle.y = projected.y;
    particle._3d = {
      scale: projected.scale * scale,
      alpha: alpha,
      depth: z
    };
  }

  /**
   * Apply rotation transformation
   */
  applyRotation(x, y, z, _index) {
    // Translate to center
    x -= this.centerX;
    y -= this.centerY;
    
    // Apply rotation around center
    const cosX = Math.cos(this.animationState.rotationX);
    const sinX = Math.sin(this.animationState.rotationX);
    const cosY = Math.cos(this.animationState.rotationY);
    const sinY = Math.sin(this.animationState.rotationY);
    const cosZ = Math.cos(this.animationState.rotationZ);
    const sinZ = Math.sin(this.animationState.rotationZ);
    
    // Rotation around Y axis
    const newX = x * cosY + z * sinY;
    let newZ = -x * sinY + z * cosY;
    
    // Rotation around X axis
    const newY = y * cosX - newZ * sinX;
    newZ = y * sinX + newZ * cosX;
    
    // Rotation around Z axis
    const finalX = newX * cosZ - newY * sinZ;
    const finalY = newX * sinZ + newY * cosZ;
    
    // Translate back
    return {
      x: finalX + this.centerX,
      y: finalY + this.centerY,
      z: newZ
    };
  }

  /**
   * Apply floating transformation
   */
  applyFloat(x, y, z, index) {
    const frequency = 1 + (index % 5) * 0.2; // Vary frequency per particle
    const amplitude = this.config.floatAmplitude * (0.5 + (index % 3) * 0.25);
    
    const floatY = y + Math.sin(this.animationState.floatOffset * frequency) * amplitude;
    const floatZ = z + Math.cos(this.animationState.floatOffset * frequency) * amplitude * 0.5;
    
    // Fade particles based on depth
    const alpha = 0.3 + 0.7 * (1 - Math.abs(floatZ) / this.config.depth);
    
    return { x, y: floatY, z: floatZ, alpha: Math.max(0.1, alpha) };
  }

  /**
   * Apply pulse transformation
   */
  applyPulse(x, y, z, index) {
    const frequency = 1 + (index % 4) * 0.3;
    const pulse = Math.sin(this.animationState.pulsePhase * frequency);
    
    const scale = 0.8 + 0.4 * (pulse + 1) / 2; // Scale between 0.8 and 1.2
    const alpha = 0.6 + 0.4 * (pulse + 1) / 2; // Alpha between 0.6 and 1.0
    
    return { scale, alpha };
  }

  /**
   * Apply parallax transformation
   */
  applyParallax(x, y, z, _index) {
    // Simulate mouse position or use center
    const mouseX = this.centerX;
    const mouseY = this.centerY;
    
    // Calculate parallax offset based on depth
    const depthFactor = z / this.config.depth;
    const parallaxX = (mouseX - this.centerX) * depthFactor * this.config.parallaxFactor;
    const parallaxY = (mouseY - this.centerY) * depthFactor * this.config.parallaxFactor;
    
    return {
      x: x + parallaxX,
      y: y + parallaxY
    };
  }

  /**
   * Apply spiral transformation
   */
  applySpiral(x, y, z, index) {
    const phase = this.animationState.spiralPhase + (index * Math.PI * 2) / this.particles.length;
    const radius = this.config.spiralRadius * (0.5 + 0.5 * Math.sin(phase * 0.5));
    
    const spiralX = this.centerX + Math.cos(phase) * radius;
    const spiralY = this.centerY + Math.sin(phase) * radius;
    const spiralZ = z + Math.sin(phase * 2) * 50;
    
    return { x: spiralX, y: spiralY, z: spiralZ };
  }

  /**
   * Project 3D coordinates to 2D canvas coordinates
   * @param {number} x - 3D X coordinate
   * @param {number} y - 3D Y coordinate
   * @param {number} z - 3D Z coordinate
   * @returns {Object} Projected 2D coordinates and scale
   */
  project3DTo2D(x, y, z) {
    const perspective = this.config.perspective;
    const distance = perspective + z;
    
    if (distance <= 0) {
      // Behind camera, project to edge
      return { x: this.centerX, y: this.centerY, scale: 0.1 };
    }
    
    const scale = perspective / distance;
    
    return {
      x: this.centerX + (x - this.centerX) * scale,
      y: this.centerY + (y - this.centerY) * scale,
      scale: Math.max(0.1, Math.min(2, scale))
    };
  }

  /**
   * Update quality based on performance
   * @param {number} fps - Current FPS
   */
  updateQuality(fps) {
    const targetFPS = this.quality.targetFPS;
    
    if (fps < targetFPS * 0.8) {
      // Reduce quality if FPS is too low
      this.quality.currentQuality = Math.max(
        this.quality.minQuality,
        this.quality.currentQuality * 0.95
      );
    } else if (fps > targetFPS * 1.1) {
      // Increase quality if FPS is good
      this.quality.currentQuality = Math.min(
        this.quality.maxQuality,
        this.quality.currentQuality * 1.02
      );
    }
  }

  /**
   * Get the current configuration
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * Update configuration
   * @param {Object} newConfig - Configuration to merge
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Reset 3D state for all particles
   */
  reset() {
    this.time = 0;
    this.animationState = {
      rotationX: 0,
      rotationY: 0,
      rotationZ: 0,
      floatOffset: 0,
      pulsePhase: 0,
      spiralPhase: 0
    };
    
    // Clear 3D properties from particles
    for (const particle of this.particles) {
      delete particle._original;
      delete particle._3d;
      delete particle.z;
    }
  }
}

/**
 * Initialize 3D controller and attach to background element
 * @param {HTMLElement} bgRoot - Background container element
 * @param {HTMLCanvasElement} canvas - Canvas element
 * @param {Array} particles - Particles array
 * @returns {Particle3DController} The controller instance
 */
export function init3DController(bgRoot, canvas, particles) {
  if (!bgRoot || !canvas || !particles) return null;
  
  const controller = new Particle3DController(canvas, particles);
  
  // Check for 3D effect data attribute and set it
  const effectAttr = bgRoot.getAttribute('data-3d-effect');
  if (effectAttr) {
    controller.setEffect(effectAttr);
  }
  
  // Attach controller to background element for external access
  bgRoot._particle3DController = controller;
  
  // Set up global controls
  if (!window.particle3DControls) {
    window.particle3DControls = {
      setGlobalEffect(effect) {
        const controllers = document.querySelectorAll('.global-particle-background');
        controllers.forEach(bg => {
          if (bg._particle3DController) {
            bg._particle3DController.setEffect(effect);
          }
        });
      },
      
      getControllers() {
        const controllers = [];
        document.querySelectorAll('.global-particle-background').forEach(bg => {
          if (bg._particle3DController) {
            controllers.push(bg._particle3DController);
          }
        });
        return controllers;
      }
    };
  }
  
  return controller;
}