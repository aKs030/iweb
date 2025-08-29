import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Particle3DController, init3DController } from '../../content/webentwicklung/particles/particle-3d-controller.js';

// Mock canvas and particles for testing
const createMockCanvas = () => {
  const canvas = {
    width: 800,
    height: 600,
    getContext: vi.fn(() => ({
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      scale: vi.fn(),
      globalAlpha: 1
    }))
  };
  return canvas;
};

const createMockParticles = (count = 5) => {
  const particles = [];
  for (let i = 0; i < count; i++) {
    particles.push({
      x: Math.random() * 800,
      y: Math.random() * 600,
      s: 1 + Math.random() * 2,
      vx: (Math.random() - 0.5) * 1.2,
      vy: (Math.random() - 0.5) * 1.2
    });
  }
  return particles;
};

describe('Particle3DController', () => {
  let controller;
  let canvas;
  let particles;

  beforeEach(() => {
    canvas = createMockCanvas();
    particles = createMockParticles();
    controller = new Particle3DController(canvas, particles);
  });

  afterEach(() => {
    controller?.reset();
  });

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      expect(controller.canvas).toBe(canvas);
      expect(controller.particles).toBe(particles);
      expect(controller.effect).toBe('none');
      expect(controller.enabled).toBe(false);
    });

    it('should detect 3D support capabilities', () => {
      expect(typeof controller.supports3D).toBe('boolean');
    });

    it('should update center coordinates', () => {
      controller.updateCenter();
      expect(controller.centerX).toBe(400); // canvas.width / 2
      expect(controller.centerY).toBe(300); // canvas.height / 2
      expect(controller.centerZ).toBe(0);
    });
  });

  describe('Effect Management', () => {
    it('should set valid 3D effects', () => {
      const validEffects = ['none', 'rotate', 'float', 'pulse', 'parallax', 'spiral'];
      
      validEffects.forEach(effect => {
        controller.setEffect(effect);
        expect(controller.effect).toBe(effect);
      });
    });

    it('should not set invalid effects', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      controller.setEffect('invalid-effect');
      expect(controller.effect).toBe('none');
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it('should enable controller when setting non-none effect', () => {
      controller.setEffect('rotate');
      expect(controller.enabled).toBe(controller.supports3D);
    });

    it('should reset animation state when changing effects', () => {
      controller.setEffect('rotate');
      controller.animationState.rotationX = 1.5;
      
      controller.setEffect('float');
      expect(controller.animationState.rotationX).toBe(0);
    });
  });

  describe('Animation Updates', () => {
    beforeEach(() => {
      controller.setEffect('rotate');
    });

    it('should update animation state based on delta time', () => {
      const initialRotationX = controller.animationState.rotationX;
      controller.update(16.67, 60); // ~60fps
      
      expect(controller.animationState.rotationX).toBeGreaterThan(initialRotationX);
    });

    it('should not update when disabled', () => {
      controller.setEffect('none');
      const initialState = { ...controller.animationState };
      
      controller.update(16.67, 60);
      expect(controller.animationState).toEqual(initialState);
    });

    it('should apply quality adaptation based on FPS', () => {
      controller.quality.adaptive = true;
      const initialQuality = controller.quality.currentQuality;
      
      // Simulate low FPS
      controller.update(33.33, 30); // 30fps
      expect(controller.quality.currentQuality).toBeLessThanOrEqual(initialQuality);
    });
  });

  describe('3D Transformations', () => {
    beforeEach(() => {
      controller.setEffect('rotate');
    });

    it('should project 3D coordinates to 2D', () => {
      const result = controller.project3DTo2D(100, 100, 50);
      
      expect(result).toHaveProperty('x');
      expect(result).toHaveProperty('y');
      expect(result).toHaveProperty('scale');
      expect(result.scale).toBeGreaterThan(0);
    });

    it('should handle coordinates behind camera', () => {
      const result = controller.project3DTo2D(100, 100, -1000);
      
      expect(result.x).toBe(controller.centerX);
      expect(result.y).toBe(controller.centerY);
      expect(result.scale).toBe(0.1);
    });

    it('should transform particles with rotation effect', () => {
      const particle = particles[0];
      const originalX = particle.x;
      const originalY = particle.y;
      
      controller.transformParticle(particle, 0);
      
      expect(particle._original).toBeDefined();
      expect(particle._original.x).toBe(originalX);
      expect(particle._original.y).toBe(originalY);
      expect(particle._3d).toBeDefined();
    });

    it('should apply different transformations for different effects', () => {
      const particle = particles[0];
      
      // Test float effect
      controller.setEffect('float');
      controller.transformParticle(particle, 0);
      const floatTransform = { ...particle._3d };
      
      // Test pulse effect
      controller.setEffect('pulse');
      controller.transformParticle(particle, 0);
      const pulseTransform = { ...particle._3d };
      
      // Transformations should be different
      expect(floatTransform).not.toEqual(pulseTransform);
    });
  });

  describe('Configuration Management', () => {
    it('should return current configuration', () => {
      const config = controller.getConfig();
      
      expect(config).toHaveProperty('perspective');
      expect(config).toHaveProperty('depth');
      expect(config).toHaveProperty('rotationSpeed');
    });

    it('should update configuration', () => {
      const newConfig = { rotationSpeed: 0.02, depth: 1000 };
      controller.updateConfig(newConfig);
      
      expect(controller.config.rotationSpeed).toBe(0.02);
      expect(controller.config.depth).toBe(1000);
    });
  });

  describe('Reset Functionality', () => {
    it('should reset all state and clear particle 3D properties', () => {
      controller.setEffect('rotate');
      controller.update(16.67, 60);
      
      // Transform a particle to set 3D properties
      const particle = particles[0];
      controller.transformParticle(particle, 0);
      
      expect(particle._original).toBeDefined();
      expect(particle._3d).toBeDefined();
      
      controller.reset();
      
      expect(controller.time).toBe(0);
      expect(controller.animationState.rotationX).toBe(0);
      expect(particle._original).toBeUndefined();
      expect(particle._3d).toBeUndefined();
    });
  });
});

describe('init3DController', () => {
  let bgRoot;
  let canvas;
  let particles;

  beforeEach(() => {
    // Mock DOM elements
    bgRoot = {
      _particle3DController: null,
      getAttribute: vi.fn(() => null)
    };
    canvas = createMockCanvas();
    particles = createMockParticles();
    
    // Reset global object
    delete window.particle3DControls;
  });

  it('should create and attach controller to background element', () => {
    const controller = init3DController(bgRoot, canvas, particles);
    
    expect(controller).toBeInstanceOf(Particle3DController);
    expect(bgRoot._particle3DController).toBe(controller);
  });

  it('should return null for invalid parameters', () => {
    expect(init3DController(null, canvas, particles)).toBe(null);
    expect(init3DController(bgRoot, null, particles)).toBe(null);
    expect(init3DController(bgRoot, canvas, null)).toBe(null);
  });

  it('should set effect from data attribute', () => {
    bgRoot.getAttribute = vi.fn(() => 'rotate');
    
    const controller = init3DController(bgRoot, canvas, particles);
    
    // The effect should be set even if 3D support detection fails in test environment
    expect(controller.effect).toBe('rotate');
    // Enabled state depends on 3D support detection
    expect(controller.enabled).toBe(controller.supports3D);
  });

  it('should create global controls', () => {
    init3DController(bgRoot, canvas, particles);
    
    expect(window.particle3DControls).toBeDefined();
    expect(typeof window.particle3DControls.setGlobalEffect).toBe('function');
    expect(typeof window.particle3DControls.getControllers).toBe('function');
  });
});