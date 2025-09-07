/**
 * Enhanced Animation Engine - Erweiterte Animationssystem
 * Leistungsoptimierte Animationen mit GPU-Beschleunigung
 * @author Abdulkerim Sesli
 * @version 2.0
 */

class EnhancedAnimationEngine {
  constructor() {
    this.activeAnimations = new Map();
    this.observers = new Map();
    this.performanceMode = this.detectPerformanceMode();
    this.init();
  }

  init() {
    this.setupIntersectionObserver();
    this.setupMutationObserver();
    this.setupPerformanceMonitoring();
    this.setupAnimationCleanup();
    this.scanForAnimations();
  }

  /**
   * Performance-Modus erkennen
   */
  detectPerformanceMode() {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const isLowEnd = connection?.effectiveType === 'slow-2g' || connection?.effectiveType === '2g';
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isLowPowerMode = navigator.deviceMemory && navigator.deviceMemory < 2;
    
    if (prefersReducedMotion || isLowEnd || isLowPowerMode) {
      return 'reduced';
    }
    
    const gpu = this.detectGPU();
    return gpu.tier > 1 ? 'high' : 'standard';
  }

  detectGPU() {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    
    if (!gl) return { tier: 0, vendor: 'unknown' };
    
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    const vendor = debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : 'unknown';
    const renderer = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : 'unknown';
    
    // Einfache GPU-Tier-Erkennung
    let tier = 1;
    if (renderer.includes('RTX') || renderer.includes('Apple') || renderer.includes('AMD')) {
      tier = 3;
    } else if (renderer.includes('GTX') || renderer.includes('Radeon')) {
      tier = 2;
    }
    
    return { tier, vendor, renderer };
  }

  /**
   * Intersection Observer Setup
   */
  setupIntersectionObserver() {
    if (!window.IntersectionObserver) return;

    const options = {
      root: null,
      rootMargin: '20px',
      threshold: [0, 0.1, 0.5, 1.0]
    };

    this.intersectionObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const element = entry.target;
        const animationData = this.getAnimationData(element);
        
        if (!animationData) return;

        if (entry.isIntersecting && entry.intersectionRatio >= (animationData.threshold || 0.1)) {
          this.triggerAnimation(element, animationData);
        } else if (animationData.reset && !entry.isIntersecting) {
          this.resetAnimation(element);
        }
      });
    }, options);
  }

  /**
   * Mutation Observer für dynamische Inhalte
   */
  setupMutationObserver() {
    if (!window.MutationObserver) return;

    this.mutationObserver = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === 1) { // Element node
            this.scanElement(node);
          }
        });
      });
    });

    this.mutationObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  /**
   * Performance Monitoring
   */
  setupPerformanceMonitoring() {
    let frameCount = 0;
    let lastTime = performance.now();

    const checkPerformance = () => {
      frameCount++;
      const currentTime = performance.now();
      
      if (currentTime - lastTime >= 1000) {
        const fps = Math.round(frameCount * 1000 / (currentTime - lastTime));
        
        if (fps < 30 && this.performanceMode !== 'reduced') {
          console.warn('Low FPS detected, switching to reduced animation mode');
          this.performanceMode = 'reduced';
          this.optimizeActiveAnimations();
        }
        
        frameCount = 0;
        lastTime = currentTime;
      }
      
      requestAnimationFrame(checkPerformance);
    };

    requestAnimationFrame(checkPerformance);
  }

  /**
   * Animation Cleanup
   */
  setupAnimationCleanup() {
    // Cleanup bei Page Visibility Change
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.pauseAllAnimations();
      } else {
        this.resumeAllAnimations();
      }
    });

    // Cleanup bei Window Unload
    window.addEventListener('beforeunload', () => {
      this.cleanup();
    });
  }

  /**
   * Alle Animationen scannen
   */
  scanForAnimations() {
    const animatedElements = document.querySelectorAll([
      '[data-animate]',
      '.animate-on-scroll',
      '.slide-in-left',
      '.slide-in-right',
      '.slide-in-up',
      '.slide-in-down',
      '.fade-in',
      '.scale-in',
      '.rotate-in',
      '.flip-in-x',
      '.flip-in-y',
      '.bounce-in',
      '.elastic-in',
      '.zoom-in',
      '.blur-in',
      '.glow-in'
    ].join(','));

    animatedElements.forEach(element => this.scanElement(element));
  }

  scanElement(element) {
    if (element.nodeType !== 1) return;

    const animationData = this.getAnimationData(element);
    if (!animationData) return;

    // Bereits beobachtet?
    if (this.observers.has(element)) return;

    // Element zur Beobachtung hinzufügen
    this.intersectionObserver?.observe(element);
    this.observers.set(element, animationData);

    // Immediate Trigger wenn bereits sichtbar
    const rect = element.getBoundingClientRect();
    const isVisible = rect.top < window.innerHeight && rect.bottom > 0;
    
    if (isVisible && !animationData.delay) {
      setTimeout(() => this.triggerAnimation(element, animationData), 100);
    }
  }

  /**
   * Animation Data aus Element extrahieren
   */
  getAnimationData(element) {
    // Custom data-animate Attribute
    const customData = element.dataset.animate;
    if (customData) {
      try {
        return JSON.parse(customData);
      } catch (e) {
        return { type: customData };
      }
    }

    // CSS-Klassen-basierte Animation
    const classList = Array.from(element.classList);
    
    for (const className of classList) {
      if (this.animationTypes[className]) {
        return {
          type: className,
          duration: this.parseDataAttribute(element, 'duration') || 600,
          delay: this.parseDataAttribute(element, 'delay') || 0,
          easing: element.dataset.easing || 'ease-out',
          threshold: this.parseDataAttribute(element, 'threshold') || 0.1,
          reset: element.dataset.reset === 'true'
        };
      }
    }

    return null;
  }

  parseDataAttribute(element, attr) {
    const value = element.dataset[attr];
    return value ? parseInt(value, 10) : null;
  }

  /**
   * Animation Typen Definition
   */
  get animationTypes() {
    return {
      'slide-in-left': {
        keyframes: [
          { transform: 'translateX(-100px)', opacity: 0 },
          { transform: 'translateX(0)', opacity: 1 }
        ],
        options: { duration: 600, easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)' }
      },
      'slide-in-right': {
        keyframes: [
          { transform: 'translateX(100px)', opacity: 0 },
          { transform: 'translateX(0)', opacity: 1 }
        ],
        options: { duration: 600, easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)' }
      },
      'slide-in-up': {
        keyframes: [
          { transform: 'translateY(50px)', opacity: 0 },
          { transform: 'translateY(0)', opacity: 1 }
        ],
        options: { duration: 600, easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)' }
      },
      'slide-in-down': {
        keyframes: [
          { transform: 'translateY(-50px)', opacity: 0 },
          { transform: 'translateY(0)', opacity: 1 }
        ],
        options: { duration: 600, easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)' }
      },
      'fade-in': {
        keyframes: [
          { opacity: 0 },
          { opacity: 1 }
        ],
        options: { duration: 500, easing: 'ease-out' }
      },
      'scale-in': {
        keyframes: [
          { transform: 'scale(0.8)', opacity: 0 },
          { transform: 'scale(1)', opacity: 1 }
        ],
        options: { duration: 500, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }
      },
      'rotate-in': {
        keyframes: [
          { transform: 'rotate(-180deg) scale(0.8)', opacity: 0 },
          { transform: 'rotate(0deg) scale(1)', opacity: 1 }
        ],
        options: { duration: 700, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }
      },
      'flip-in-x': {
        keyframes: [
          { transform: 'perspective(400px) rotateX(-90deg)', opacity: 0 },
          { transform: 'perspective(400px) rotateX(0deg)', opacity: 1 }
        ],
        options: { duration: 600, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }
      },
      'flip-in-y': {
        keyframes: [
          { transform: 'perspective(400px) rotateY(-90deg)', opacity: 0 },
          { transform: 'perspective(400px) rotateY(0deg)', opacity: 1 }
        ],
        options: { duration: 600, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }
      },
      'bounce-in': {
        keyframes: [
          { transform: 'scale(0.3)', opacity: 0 },
          { transform: 'scale(1.05)', opacity: 0.8 },
          { transform: 'scale(0.9)', opacity: 0.9 },
          { transform: 'scale(1)', opacity: 1 }
        ],
        options: { duration: 800, easing: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)' }
      },
      'elastic-in': {
        keyframes: [
          { transform: 'scale(0)', opacity: 0 },
          { transform: 'scale(1.25)', opacity: 0.8 },
          { transform: 'scale(0.85)', opacity: 0.9 },
          { transform: 'scale(1.1)', opacity: 0.95 },
          { transform: 'scale(1)', opacity: 1 }
        ],
        options: { duration: 1000, easing: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)' }
      },
      'zoom-in': {
        keyframes: [
          { transform: 'scale(0.5)', opacity: 0, filter: 'blur(5px)' },
          { transform: 'scale(1)', opacity: 1, filter: 'blur(0px)' }
        ],
        options: { duration: 600, easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)' }
      },
      'blur-in': {
        keyframes: [
          { filter: 'blur(10px)', opacity: 0 },
          { filter: 'blur(0px)', opacity: 1 }
        ],
        options: { duration: 800, easing: 'ease-out' }
      },
      'glow-in': {
        keyframes: [
          { 
            opacity: 0, 
            transform: 'scale(0.9)',
            boxShadow: '0 0 0 rgba(7, 161, 255, 0)' 
          },
          { 
            opacity: 1, 
            transform: 'scale(1)',
            boxShadow: '0 0 20px rgba(7, 161, 255, 0.3)' 
          }
        ],
        options: { duration: 700, easing: 'ease-out' }
      }
    };
  }

  /**
   * Animation auslösen
   */
  triggerAnimation(element, animationData) {
    if (this.activeAnimations.has(element)) return;

    const animationType = this.animationTypes[animationData.type];
    if (!animationType) return;

    // Performance-Optimierung
    if (this.performanceMode === 'reduced') {
      element.style.opacity = '1';
      element.style.transform = 'none';
      return;
    }

    // Animation-Optionen zusammenstellen
    const options = {
      ...animationType.options,
      duration: animationData.duration || animationType.options.duration,
      easing: animationData.easing || animationType.options.easing,
      delay: animationData.delay || 0
    };

    // GPU-Beschleunigung aktivieren
    element.style.willChange = 'transform, opacity, filter';
    
    // Animation starten
    const animation = element.animate(animationType.keyframes, options);
    
    this.activeAnimations.set(element, animation);

    // Cleanup nach Animation
    animation.addEventListener('finish', () => {
      element.style.willChange = '';
      this.activeAnimations.delete(element);
      
      // Element als animiert markieren
      element.classList.add('animated');
      
      // Callback ausführen
      if (animationData.callback && typeof window[animationData.callback] === 'function') {
        window[animationData.callback](element);
      }
    });

    // Error Handling
    animation.addEventListener('cancel', () => {
      element.style.willChange = '';
      this.activeAnimations.delete(element);
    });
  }

  /**
   * Animation zurücksetzen
   */
  resetAnimation(element) {
    const animation = this.activeAnimations.get(element);
    if (animation) {
      animation.cancel();
      this.activeAnimations.delete(element);
    }

    element.style.willChange = '';
    element.style.opacity = '';
    element.style.transform = '';
    element.style.filter = '';
    element.classList.remove('animated');
  }

  /**
   * Alle Animationen pausieren
   */
  pauseAllAnimations() {
    this.activeAnimations.forEach(animation => {
      if (animation.playState === 'running') {
        animation.pause();
      }
    });
  }

  /**
   * Alle Animationen fortsetzen
   */
  resumeAllAnimations() {
    this.activeAnimations.forEach(animation => {
      if (animation.playState === 'paused') {
        animation.play();
      }
    });
  }

  /**
   * Aktive Animationen optimieren
   */
  optimizeActiveAnimations() {
    this.activeAnimations.forEach((animation, element) => {
      if (this.performanceMode === 'reduced') {
        animation.cancel();
        element.style.opacity = '1';
        element.style.transform = 'none';
      }
    });
  }

  /**
   * Manuell Animation auslösen
   */
  animate(element, type, options = {}) {
    const animationData = {
      type,
      ...options
    };
    
    this.triggerAnimation(element, animationData);
  }

  /**
   * Animationssequenz erstellen
   */
  sequence(animations, delay = 100) {
    animations.forEach((animation, index) => {
      setTimeout(() => {
        this.animate(animation.element, animation.type, animation.options);
      }, index * delay);
    });
  }

  /**
   * Staggered Animation (zeitversetzt)
   */
  stagger(elements, type, options = {}) {
    const staggerDelay = options.staggerDelay || 100;
    
    elements.forEach((element, index) => {
      const animationData = {
        type,
        delay: (options.delay || 0) + (index * staggerDelay),
        ...options
      };
      
      this.triggerAnimation(element, animationData);
    });
  }

  /**
   * Timeline Animation
   */
  timeline(keyframes, duration = 1000) {
    return new Promise((resolve) => {
      const steps = keyframes.length;
      const stepDuration = duration / steps;
      
      keyframes.forEach((keyframe, index) => {
        setTimeout(() => {
          if (keyframe.action && typeof keyframe.action === 'function') {
            keyframe.action();
          }
          
          if (index === steps - 1) {
            resolve();
          }
        }, index * stepDuration);
      });
    });
  }

  /**
   * Cleanup
   */
  cleanup() {
    this.activeAnimations.forEach(animation => animation.cancel());
    this.activeAnimations.clear();
    
    this.intersectionObserver?.disconnect();
    this.mutationObserver?.disconnect();
    
    this.observers.clear();
  }

  /**
   * Debug-Informationen
   */
  getDebugInfo() {
    return {
      performanceMode: this.performanceMode,
      activeAnimations: this.activeAnimations.size,
      observedElements: this.observers.size,
      gpu: this.detectGPU()
    };
  }
}

// Auto-Initialisierung
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    window.enhancedAnimationEngine = new EnhancedAnimationEngine();
  });
}

// ES6 Module Export
export { EnhancedAnimationEngine };
export default EnhancedAnimationEngine;
