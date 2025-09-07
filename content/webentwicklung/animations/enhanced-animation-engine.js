/**
 * Enhanced Animation Engine - Optimized Animation System
 * Hochperformantes Animation-System mit GPU-Beschleunigung
 * @author Abdulkerim Sesli
 * @version 3.2 - Performance Optimized
 */

class EnhancedAnimationEngine {
  constructor(options = {}) {
    this.options = {
      threshold: 0.15, // Leicht erhöht für weniger false triggers
      rootMargin: '50px',
      maxAnimations: 20, // Limit für gleichzeitige Animationen
      repeatOnScroll: false, // Elemente bei Verlassen zurücksetzen, um erneut zu animieren
      ...options
    };
    
    this.activeAnimations = new Map();
    this.intersectionObserver = null;
    this.mutationObserver = null;
    this.performanceMode = this.detectPerformanceMode();
    this.animationQueue = new Set(); // Queue für verzögerte Animationen
    
    // Optimierte Animation Types - nur die wirklich verwendeten
    this.animationTypes = new Map([
      ['animate-on-scroll', { type: 'fade-in', duration: 0.6, delay: 0, easing: 'ease-out', threshold: 0.15, reset: false }],
      ['slide-in-left', { type: 'slide-in-left', duration: 0.7, delay: 0, easing: 'ease-out', threshold: 0.15, reset: false }],
      ['slide-in-right', { type: 'slide-in-right', duration: 0.7, delay: 0, easing: 'ease-out', threshold: 0.15, reset: false }],
      ['slide-in-up', { type: 'slide-in-up', duration: 0.7, delay: 0, easing: 'ease-out', threshold: 0.15, reset: false }],
      ['fade-in', { type: 'fade-in', duration: 0.6, delay: 0, easing: 'ease-out', threshold: 0.15, reset: false }],
      ['scale-in', { type: 'scale-in', duration: 0.6, delay: 0, easing: 'ease-out', threshold: 0.15, reset: false }]
    ]);
    
    this.init();
  }

  /**
   * Initialisierung
   */
  init() {
    this.setupIntersectionObserver();
    this.setupMutationObserver();
    this.setupAnimationCleanup();
    this.scanForAnimations();
  }

  /**
   * IntersectionObserver Setup - Optimiert
   */
  setupIntersectionObserver() {
    if (!window.IntersectionObserver) {
      console.warn('IntersectionObserver not supported');
      return;
    }

    this.intersectionObserver = new IntersectionObserver(
      (entries) => this.handleIntersection(entries),
      {
        threshold: this.options.threshold,
        rootMargin: this.options.rootMargin
      }
    );
  }

  /**
   * Intersection Handler - Performance optimiert
   */
  handleIntersection(entries) {
    // Batch-Verarbeitung für bessere Performance
    const visibleEntries = entries.filter(entry => entry.isIntersecting);
    const hiddenEntries = entries.filter(entry => !entry.isIntersecting);

    // Sichtbare Elemente animieren
    if (visibleEntries.length > 0) {
      this.batchTriggerAnimations(visibleEntries);
    }

    // Reset für hidden Elemente nur wenn nötig
    hiddenEntries.forEach(entry => {
      const animationData = this.getAnimationData(entry.target);
      if (this.options.repeatOnScroll || animationData?.reset) {
        this.resetAnimation(entry.target);
      }
    });
  }

  /**
   * Batch-Animation Trigger für bessere Performance
   */
  batchTriggerAnimations(entries) {
    // Limit für gleichzeitige Animationen prüfen
    if (this.activeAnimations.size >= this.options.maxAnimations) {
      entries.slice(this.options.maxAnimations - this.activeAnimations.size)
        .forEach(entry => this.animationQueue.add(entry.target));
      return;
    }

    entries.forEach(entry => {
      const element = entry.target;
      const animationData = this.getAnimationData(element);
      if (animationData) {
        this.triggerAnimation(element, animationData);
      }
    });
  }

  /**
   * Performance-Modus erkennen - Vereinfacht
   */
  detectPerformanceMode() {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return 'reduced';
    
    const connection = navigator.connection;
    const isSlowConnection = connection?.effectiveType === 'slow-2g' || connection?.effectiveType === '2g';
    const isLowMemory = navigator.deviceMemory && navigator.deviceMemory < 4;
    
    return (isSlowConnection || isLowMemory) ? 'reduced' : 'standard';
  }

  /**
   * Mutation Observer - Optimiert für bessere Performance
   */
  setupMutationObserver() {
    if (!window.MutationObserver) return;

    // Throttle für Mutation Observer um Performance zu verbessern
    let mutationTimeout;
    this.mutationObserver = new MutationObserver((mutations) => {
      clearTimeout(mutationTimeout);
      mutationTimeout = setTimeout(() => {
        const addedElements = new Set();
        mutations.forEach(mutation => {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === 1) {
              addedElements.add(node);
            }
          });
        });
        addedElements.forEach(element => this.scanElement(element));
      }, 100); // Debounce um Batch-Verarbeitung zu ermöglichen
    });

    this.mutationObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
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
   * Alle Animationen scannen - Optimierte Selektoren
   */
  scanForAnimations() {
    const animatedElements = document.querySelectorAll([
      '[data-animate]',
      '[data-animation]',
      '.animate-on-scroll',
      '.slide-in-left',
      '.slide-in-right', 
      '.slide-in-up',
      '.fade-in',
      '.scale-in'
    ].join(','));

    animatedElements.forEach(element => this.scanElement(element));
  }

  /**
   * Selektiert animierbare Elemente innerhalb eines Containers
   */
  selectAnimatedElements(container = document) {
    return container.querySelectorAll([
      '[data-animate]',
      '[data-animation]',
      '.animate-on-scroll',
      '.slide-in-left',
      '.slide-in-right',
      '.slide-in-up',
      '.fade-in',
      '.scale-in'
    ].join(','));
  }

  scanElement(element) {
    if (element.nodeType !== 1) return;

    const animationData = this.getAnimationData(element);
    if (!animationData) return;

    // Element zur Beobachtung hinzufügen
    this.intersectionObserver?.observe(element);
  }

  getAnimationData(element) {
    // Data-Attribute prüfen
    if (element.dataset.animate) {
      return this.parseDataAttribute(element, 'animate');
    }
    
    if (element.dataset.animation) {
      return this.parseDataAttribute(element, 'animation');
    }

    // CSS-Klassen basierte Animationen - optimiert mit Map
    const classList = element.classList;
    for (const className of classList) {
      const config = this.animationTypes.get(className);
      if (config) {
        // Reset-Strategie: data-reset überschreibt, sonst global repeatOnScroll oder config.reset
        const hasResetAttr = Object.hasOwn(element.dataset, 'reset');
        const reset = hasResetAttr ? (element.dataset.reset === 'true') : (this.options.repeatOnScroll || config.reset);
        return {
          type: config.type,
          duration: parseFloat(element.dataset.duration) || config.duration,
          delay: parseFloat(element.dataset.delay) || config.delay,
          easing: element.dataset.easing || config.easing,
          threshold: parseFloat(element.dataset.threshold) || config.threshold,
          reset
        };
      }
    }

    return null;
  }

  parseDataAttribute(element, attribute) {
    const raw = element.dataset[attribute] || '';
    // Normalisierung: camelCase/Varianten -> unsere Utility-Klassen
    const aliasMap = new Map([
      // slide variants
      ['slideinfromtop', 'slideInDown'],
      ['slideinfrombottom', 'slideInUp'],
      ['slideinfromleft', 'slideInLeft'],
      ['slideinfromright', 'slideInRight'],
      ['slide-in-from-top', 'slideInDown'],
      ['slide-in-from-bottom', 'slideInUp'],
      ['slide-in-from-left', 'slideInLeft'],
      ['slide-in-from-right', 'slideInRight'],
      // simple names
      ['fadein', 'fadeIn'],
      ['fade-in', 'fadeIn'],
      ['scalein', 'scaleIn'],
      ['scale-in', 'scaleIn'],
      ['flipinx', 'flipInX'],
      ['flipiny', 'flipInY'],
      ['rotateindownleft', 'rotateIn'],
      ['rotatein', 'rotateIn'],
      ['bounceinup', 'bounceIn'],
      ['elasticin', 'elasticIn'],
      ['zoomin', 'zoomIn'],
      ['blurin', 'blurIn'],
      ['glowin', 'glowIn'],
      // project-specific
      ['greeting', 'fadeInUp'],
      ['morphheight', 'scaleIn'],
      ['scaleincenter', 'scaleIn'],
    ]);

    const key = raw.toString().replace(/\s+/g, '').toLowerCase();
    const normalized = aliasMap.get(key) || raw;

    // Reset-Strategie: data-reset überschreibt, sonst global repeatOnScroll
    const hasResetAttr = Object.hasOwn(element.dataset, 'reset');
    const reset = hasResetAttr ? (element.dataset.reset === 'true') : this.options.repeatOnScroll;

    return {
      type: normalized,
      duration: parseFloat(element.dataset.duration) || 0.6,
      delay: parseFloat(element.dataset.delay) || 0,
      easing: element.dataset.easing || 'ease-out',
      threshold: parseFloat(element.dataset.threshold) || 0.15,
      reset
    };
  }

  /**
   * Öffentliche API: Animationen einer Section/Container sofort auslösen
   */
  animateElementsIn(container, { force = true } = {}) {
    try {
      const elements = this.selectAnimatedElements(container);
      elements.forEach(el => {
        const data = this.getAnimationData(el) || { type: 'fadeIn', duration: 0.6, delay: 0, easing: 'ease-out', threshold: 0.15, reset: false };
        if (force) {
          // Sofort animieren, unabhängig vom Observer
          this.triggerAnimation(el, data);
        } else {
          this.intersectionObserver?.observe(el);
        }
      });
    } catch {
      /* noop */
    }
  }

  /**
   * Öffentliche API: Animationen in Container zurücksetzen (für Re-Entry Effekte)
   */
  resetElementsIn(container) {
    try {
      const elements = this.selectAnimatedElements(container);
      elements.forEach(el => {
        const data = this.getAnimationData(el) || this.activeAnimations.get(el);
        if (data) {
          const base = data.type || 'fadeIn';
          const cls = base.startsWith('animate-') ? base : `animate-${base}`;
          el.classList.remove(cls, 'animated');
          this.activeAnimations.delete(el);
        }
        // Kompatibilität: Pattern mit is-visible unterstützen
        if (el.classList.contains('animate-element')) {
          el.classList.remove('is-visible');
        }
      });
    } catch {
      /* noop */
    }
  }

  /**
   * Animation triggern - Performance optimiert
   */
  triggerAnimation(element, animationData) {
    if (this.activeAnimations.has(element)) return;

    // Performance-Modus berücksichtigen
    if (this.performanceMode === 'reduced') {
      element.classList.add('animated');
      return;
    }

    // GPU-Acceleration aktivieren
    element.style.willChange = 'transform, opacity';
    element.style.transform = 'translateZ(0)';

    // Animation-Klasse hinzufügen
    // Erlaube bereits vollqualifizierte Klassen (beginnt mit animate-)
    const base = animationData.type || 'fadeIn';
    const animationClass = base.startsWith('animate-') ? base : `animate-${base}`;
    
    const triggerFn = () => {
      element.classList.add(animationClass, 'animated');
      this.activeAnimations.set(element, animationData);
      
      // Queue verarbeiten wenn Platz frei wird
      this.processAnimationQueue();
    };

    if (animationData.delay > 0) {
      setTimeout(triggerFn, animationData.delay);
    } else {
      triggerFn();
    }

    // Cleanup nach Animation
    setTimeout(() => {
      element.style.willChange = 'auto';
    }, animationData.delay + (animationData.duration * 1000));
  }

  /**
   * Animation Queue verarbeiten
   */
  processAnimationQueue() {
    if (this.animationQueue.size === 0) return;
    if (this.activeAnimations.size >= this.options.maxAnimations) return;

    const element = this.animationQueue.values().next().value;
    this.animationQueue.delete(element);
    
    const animationData = this.getAnimationData(element);
    if (animationData) {
      this.triggerAnimation(element, animationData);
    }
  }

  /**
   * Animation zurücksetzen
   */
  resetAnimation(element) {
    const animationData = this.activeAnimations.get(element);
    if (!animationData) {
      // Fallback: trotzdem Klassen entfernen, falls vorhanden
      const classes = Array.from(element.classList).filter(c => c.startsWith('animate-'));
      if (classes.length) element.classList.remove(...classes);
      element.classList.remove('animated');
      return;
    }

    const base = animationData.type || 'fadeIn';
    const animationClass = base.startsWith('animate-') ? base : `animate-${base}`;
    element.classList.remove(animationClass, 'animated');
    this.activeAnimations.delete(element);
    
    // Queue verarbeiten
    this.processAnimationQueue();
  }

  /**
   * Globale Wiederholungsstrategie umschalten
   */
  setRepeatOnScroll(enabled) {
    this.options.repeatOnScroll = !!enabled;
  }

  /**
   * Alle Animationen pausieren
   */
  pauseAllAnimations() {
    this.activeAnimations.forEach((_, element) => {
      element.style.animationPlayState = 'paused';
    });
  }

  /**
   * Alle Animationen fortsetzen
   */
  resumeAllAnimations() {
    this.activeAnimations.forEach((_, element) => {
      element.style.animationPlayState = 'running';
    });
  }

  /**
   * Scan-Methode für externe Verwendung
   */
  scan() {
    this.scanForAnimations();
  }

  /**
   * Cleanup - Memory Leak Prevention
   */
  cleanup() {
    this.intersectionObserver?.disconnect();
    this.mutationObserver?.disconnect();
    this.activeAnimations.clear();
    this.animationQueue.clear();
  }
}

// Export für ES6 Module
export { EnhancedAnimationEngine };

// Auto-Initialisierung nur wenn explizit gewünscht
if (typeof window !== 'undefined' && window.AUTO_INIT_ANIMATIONS === true) {
  try {
    window.enhancedAnimationEngine = new EnhancedAnimationEngine();
    console.warn('🎬 Enhanced Animation Engine auto-initialized');
  } catch (error) {
    console.error('Failed to auto-initialize Enhanced Animation Engine:', error);
  }
}
