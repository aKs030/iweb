import { debounce } from './animation-utils.js';
/**
 * Enhanced Animation Engine - Optimized Animation System
 * Hochperformantes Animation-System mit GPU-Beschleunigung
 * @author Abdulkerim Sesli
 * @version 3.2 - Performance Optimized
 *
 * Unterstützte Attribute/Klassen:
 * - data-animation | data-animate: Name/Typ der Animation (Alias werden normalisiert, z.B. slideInLeft, fadeInUp, scaleIn)
 * - data-delay: Startverzögerung in Millisekunden (z.B. 300)
 * - data-duration: Dauer in Sekunden oder Millisekunden (z.B. 0.6 oder 600 bzw. "600ms"/"0.6s")
 * - data-easing: CSS Easing-String (z.B. ease-out, cubic-bezier(...))
 * - data-threshold: Sichtbarkeits-Schwelle (0..1) für IntersectionObserver
 * - data-reset: true/false überschreibt die globale repeatOnScroll-Strategie
 * - data-once: ohne Wert oder true = nur einmal animieren, false = mehrfach möglich
 * Zusätzlich werden folgende Klassen erkannt: .animate-on-scroll, .slide-in-left, .slide-in-right, .slide-in-up, .fade-in, .scale-in
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
    this.observed = new WeakSet(); // Beobachtete Elemente
    this.animatedOnce = new WeakSet(); // Elemente, die bereits einmal animiert wurden (data-once)
    this.engineSelector = [
      '[data-animate]',
      '[data-animation]',
      '.animate-on-scroll',
      '.slide-in-left',
      '.slide-in-right', 
      '.slide-in-up',
      '.fade-in',
      '.scale-in'
    ].join(',');
    
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
   * Prüft, ob ein Element innerhalb eines Bereichs liegt, der Animationen deaktiviert
   */
  isOptedOut(element) {
    const hasClosest = element && typeof element.closest === 'function';
    if (!hasClosest) return false;
    return !!element.closest('[data-animations="off"]');
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

    // Sichtbare Elemente animieren
    if (visibleEntries.length > 0) {
      this.batchTriggerAnimations(visibleEntries);
    }

    // Reset für hidden Elemente nur wenn nötig (nicht bei once)
    const hiddenEntries = entries.filter(entry => !entry.isIntersecting);
    hiddenEntries.forEach(entry => {
      const el = entry.target;
      const animationData = this.getAnimationData(el);
      const isOnce = !!animationData?.once;
      if (!isOnce && (this.options.repeatOnScroll || animationData?.reset)) {
        this.resetAnimation(el);
      }
    });
  }

  /**
   * Batch-Animation Trigger für bessere Performance
   */
  batchTriggerAnimations(entries) {
    // Limit für gleichzeitige Animationen prüfen (hart auf 6 begrenzt)
    const MAX_ANIM = 6;
    if (this.activeAnimations.size >= MAX_ANIM) {
      entries.slice(MAX_ANIM - this.activeAnimations.size)
        .forEach(entry => this.animationQueue.add(entry.target));
      return;
    }

    entries.forEach(entry => {
      const element = entry.target;
      const animationData = this.getAnimationData(element);
      if (!animationData) return;
      const ratio = typeof entry.intersectionRatio === 'number' ? entry.intersectionRatio : 0;
      const needed = typeof animationData.threshold === 'number' ? animationData.threshold : this.options.threshold;
      if (ratio >= needed) {
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
    const pendingAdded = new Set();
    const pendingAttrTargets = new Set();
    const engineSelector = this.engineSelector;
    const scheduleIdle = (cb) => (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function')
      ? window.requestIdleCallback(cb, { timeout: 120 })
      : setTimeout(cb, 0);

    const isElementNode = (n) => n && n.nodeType === 1;
    const processAdded = (element) => {
      if (!isElementNode(element) || this.isOptedOut(element)) return;
      this.scanElement(element);
      const descendants = element.querySelectorAll?.(engineSelector);
      if (descendants?.length) {
        for (const child of Array.from(descendants)) {
          if (!this.isOptedOut(child)) this.scanElement(child);
        }
      }
    };
    const processAttrTarget = (el) => {
      if (!isElementNode(el)) return;
      if (this.isOptedOut(el)) {
        this.resetAnimation(el);
        this.unobserveElement(el);
        return;
      }
      const matches = el.matches?.(engineSelector) === true;
      if (matches) {
        this.scanElement(el);
      } else {
        this.resetAnimation(el);
        this.unobserveElement(el);
      }
    };

    this.mutationObserver = new MutationObserver((mutations) => {
      clearTimeout(mutationTimeout);
      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes?.length) {
          for (const node of mutation.addedNodes) {
            if (isElementNode(node)) pendingAdded.add(node);
          }
        }
        if (mutation.type === 'attributes' && isElementNode(mutation.target)) {
          pendingAttrTargets.add(mutation.target);
        }
      }
      if (!this._debouncedMutation) {
        this._debouncedMutation = debounce(() => scheduleIdle(() => {
          const added = Array.from(pendingAdded);
          const attrTargets = Array.from(pendingAttrTargets);
          pendingAdded.clear();
          pendingAttrTargets.clear();
          for (const element of added) processAdded(element);
          for (const el of attrTargets) processAttrTarget(el);
        }), 100);
      }
      this._debouncedMutation();
    });

    this.mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [
        'data-animate',
        'data-animation',
        'data-delay',
        'data-duration',
        'data-easing',
        'data-threshold',
        'data-once',
        'data-reset',
        'class'
      ]
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
    const animatedElements = document.querySelectorAll(this.engineSelector);

    Array.from(animatedElements)
      .filter(el => !this.isOptedOut(el))
      .forEach(element => this.scanElement(element));
  }

  /**
   * Selektiert animierbare Elemente innerhalb eines Containers
   */
  selectAnimatedElements(container = document) {
    const list = container.querySelectorAll(this.engineSelector);
    return Array.from(list).filter(el => !this.isOptedOut(el));
  }

  // Beobachtung kapseln, doppelte Beobachtung vermeiden
  observeElement(element) {
    if (!element || this.observed.has(element)) return;
    this.intersectionObserver?.observe(element);
    this.observed.add(element);
  }

  unobserveElement(element) {
    if (!element) return;
    this.intersectionObserver?.unobserve(element);
    this.observed.delete(element);
  }

  scanElement(element) {
    if (element.nodeType !== 1) return;
    if (this.isOptedOut(element)) return;

    const animationData = this.getAnimationData(element);
    if (!animationData) return;

    // Element zur Beobachtung hinzufügen
    this.observeElement(element);
  }

  getAnimationData(element) {
    if (this.isOptedOut(element)) {
      return null;
    }
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
        const hasResetAttr = Object.hasOwn(element.dataset, 'reset');
        const reset = hasResetAttr ? (element.dataset.reset === 'true') : (this.options.repeatOnScroll || config.reset);
        const once = Object.hasOwn(element.dataset, 'once') ? (element.dataset.once !== 'false') : false;
        return {
          type: config.type,
          duration: parseFloat(element.dataset.duration) || config.duration,
          delay: parseFloat(element.dataset.delay) || config.delay,
          easing: element.dataset.easing || config.easing,
          threshold: parseFloat(element.dataset.threshold) || config.threshold,
          reset,
          once
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
      // karten-specific animations
      ['slideindown', 'slideInDown'],
      ['slideinup', 'slideInUp'],
      ['slideinleft', 'slideInLeft'],
      ['slideinright', 'slideInRight'],
    ]);

    const key = raw.toString().replace(/\s+/g, '').toLowerCase();
    const normalized = aliasMap.get(key) || raw;

    // Reset-Strategie: data-reset überschreibt, sonst global repeatOnScroll
    const hasResetAttr = Object.hasOwn(element.dataset, 'reset');
    const reset = hasResetAttr ? (element.dataset.reset === 'true') : this.options.repeatOnScroll;
    const once = Object.hasOwn(element.dataset, 'once') ? (element.dataset.once !== 'false') : false;
    return {
      type: normalized,
      duration: parseFloat(element.dataset.duration) || 0.6,
      delay: parseFloat(element.dataset.delay) || 0,
      easing: element.dataset.easing || 'ease-out',
      threshold: parseFloat(element.dataset.threshold) || 0.15,
      reset,
      once
    };
  }

  /**
   * Hilfsfunktion: Dauer in Millisekunden konvertieren
   * Akzeptiert Zahlen (Sekunden oder Millisekunden) und Strings ("600ms", "0.6s")
   */
  toMs(value) {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'string') {
      const v = value.trim().toLowerCase();
      if (v.endsWith('ms')) {
        return parseFloat(v);
      }
      if (v.endsWith('s')) {
        return parseFloat(v) * 1000;
      }
      const n = parseFloat(v);
      if (!Number.isFinite(n)) return 0;
      return n > 10 ? n : n * 1000;
    }
    if (typeof value === 'number') {
      return value > 10 ? value : value * 1000;
    }
    return 0;
  }

  /**
   * Öffentliche API: Animationen einer Section/Container sofort auslösen
   */
  animateElementsIn(container, { force = true } = {}) {
    try {
      const elements = this.selectAnimatedElements(container);
      elements.forEach(element => {
        const animationData = this.getAnimationData(element);
        if (animationData) {
          if (force || !this.activeAnimations.has(element)) {
            this.resetAnimation(element); // Reset erst falls nötig
            this.triggerAnimation(element, animationData);
          }
        }
      });
    } catch (error) {
      console.warn('animateElementsIn failed:', error);
    }
  }

  /**
   * Section-spezifisches Reset für Template-Wechsel
   */
  resetSection(section) {
    try {
      const elements = section.querySelectorAll('[data-animation], .animate, .animated');
      elements.forEach(element => {
        this.resetAnimation(element);
        this.unobserveElement(element);
      });
      
      // Re-scan nach Reset
      setTimeout(() => {
        this.scanElement(section);
        elements.forEach(element => {
          if (this.getAnimationData(element)) {
            this.observeElement(element);
          }
        });
      }, 10);
    } catch (error) {
      console.warn('resetSection failed:', error);
    }
  }  /**
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
      window.requestAnimationFrame(() => {
        element.classList.add('animated');
      });
      return;
    }

    // GPU-Acceleration aktivieren mit Throttling für will-change
    if (!this._willChangeElements) {
      this._willChangeElements = new Set();
    }
    const MAX_WILLCHANGE = 8;
    const setWillChange = () => {
      if (this._willChangeElements.size < MAX_WILLCHANGE) {
        element.style.willChange = 'transform, opacity';
        element.style.transform = 'translateZ(0)';
        this._willChangeElements.add(element);
      } else {
        // Wenn zu viele, später erneut versuchen
        setTimeout(setWillChange, 32);
      }
    };
    window.requestAnimationFrame(setWillChange);

    // Animation-Klasse hinzufügen
    // Erlaube bereits vollqualifizierte Klassen (beginnt mit animate-)
    const base = animationData.type || 'fadeIn';
    const animationClass = base.startsWith('animate-') ? base : `animate-${base}`;
    const durationMs = this.toMs(animationData.duration);

    // Nur performante Properties zulassen
    const allowed = ['fadeIn', 'fadeOut', 'slideInLeft', 'slideInRight', 'slideInUp', 'slideInDown', 'zoomIn', 'zoomOut'];
    if (!allowed.includes(base)) {
      console.warn('[EnhancedAnimationEngine] Nicht-performante Animation erkannt:', base, '– Nur transform/opacity empfohlen!');
    }

    const triggerFn = () => {
      window.requestAnimationFrame(() => {
        // Dauer/Easing optional als Inline-Styles setzen (nicht zwingend in CSS vorhanden)
        if (durationMs > 0) {
          element.style.animationDuration = `${durationMs}ms`;
          element.style.transitionDuration = `${durationMs}ms`;
        }
        if (animationData.easing) {
          element.style.animationTimingFunction = animationData.easing;
          element.style.transitionTimingFunction = animationData.easing;
        }
        element.classList.add(animationClass, 'animated');
        this.activeAnimations.set(element, animationData);
        if (animationData.once) {
          this.animatedOnce.add(element);
          element.dataset.animatedOnce = 'true';
          this.unobserveElement(element);
        }
        // Queue verarbeiten wenn Platz frei wird
        this.processAnimationQueue();
      });
    };

    if (animationData.delay > 0) {
      setTimeout(triggerFn, animationData.delay);
    } else {
      triggerFn();
    }

    // Cleanup nach Animation
    setTimeout(() => {
      window.requestAnimationFrame(() => {
        if (element.style.willChange) {
          element.style.willChange = '';
          this._willChangeElements?.delete(element);
        }
      });
    }, animationData.delay + durationMs);
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
   * Template-spezifische Animation Integration
   */
  handleTemplateChange(templateElement) {
    if (!templateElement) return;
    
    // Reset bestehende Animationen
    this.resetSection(templateElement);
    
    // Neue Animationen scannen und direkt starten
    setTimeout(() => {
      this.animateElementsIn(templateElement, { force: true });
    }, 100);
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
