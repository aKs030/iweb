import { debounce } from '../utils/common-utils.js';

/**
 * Enhanced Animation Engine - Optimized Animation System
 * Hochperformantes Animation-System mit GPU-Beschleunigung
 * @author Abdulkerim Sesli
 * @version 3.3 - Cleaned and Optimized
 *
 * Unterstützte Attribute:
 * - data-animation | data-animate: Name/Typ der Animation (z.B. slideInLeft, fadeInUp, scaleIn)
 * - data-delay: Startverzögerung in Millisekunden (z.B. 300)
 * - data-duration: Dauer in Sekunden oder Millisekunden (z.B. 0.6 oder 600ms)
 * - data-easing: CSS Easing-String (z.B. ease-out, cubic-bezier(...))
 * - data-threshold: Sichtbarkeits-Schwelle (0..1) für IntersectionObserver
 * - data-reset: true/false überschreibt die globale repeatOnScroll-Strategie
 * - data-once: ohne Wert oder true = nur einmal animieren, false = mehrfach möglich
 * 
 * Unterstützte CSS-Klassen: 
 * .animate-on-scroll, .slide-in-left, .slide-in-right, .slide-in-up, .fade-in, .scale-in
 */

class EnhancedAnimationEngine {
  constructor(options = {}) {
    // Device-spezifische Performance-Optimierungen
    const isDesktop = window.matchMedia?.('(min-width: 900px)').matches;
    const isMobile = window.matchMedia?.('(max-width: 768px)').matches;
    
    // Cache device detection für Performance
    this._isMobile = isMobile;
    this._isDesktop = isDesktop;
    
    // Adaptive Performance-Einstellungen
    let threshold = 0.15;
    let rootMargin = '50px';
    
    if (isDesktop) {
      threshold = 0.25;
      rootMargin = '20px';
    } else if (isMobile) {
      threshold = 0.1;
      rootMargin = '80px';
    }
    
    this.options = {
      threshold,
      rootMargin,
      maxAnimations: isMobile ? 12 : 20,
      repeatOnScroll: false,
      suppressWarnings: false,
      allowComplex: !isMobile,
      performanceOptimized: true,
      ...options
    };
    
    // Interne State-Verwaltung
    this.activeAnimations = new Map();
    this.intersectionObserver = null;
    this.mutationObserver = null;
    this.animationQueue = new Set();
    this.observed = new WeakSet();
    this.animatedOnce = new WeakSet();
    
    // CSS-Selektoren für animierbare Elemente
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
    
    // Erlaubte Animationstypen (Performance-optimiert)
    this._animationTypes = null;
    this.options.allowedAnimations = Array.isArray(options.allowedAnimations) 
      ? options.allowedAnimations 
      : this._getDefaultAllowedAnimations();
    
    this._warnedAnimations = new Set();
    this._queueScheduled = false;
    
    this.init();
  }

  /**
   * Standard-Animationsliste basierend auf Performance-Optionen
   */
  _getDefaultAllowedAnimations() {
    const baseAnimations = [
      'fadeIn', 'fadeOut', 'slideInLeft', 'slideInRight', 'slideInUp', 'slideInDown',
      'zoomIn', 'zoomOut', 'fadeInUp', 'scaleIn', 'flipInX', 'flipInY', 
      'bounceIn', 'elasticIn', 'rotateIn', 'crt'
    ];
    return baseAnimations;
  }

  /**
   * Lazy-Loading der Animation Types Map mit Mobile-Optimierungen
   */
  ensureAnimationTypes() {
    if (this._animationTypes) return this._animationTypes;
    
    const isMobile = this._isMobile; // Verwende gecachte Device-Detection
    const baseDuration = isMobile ? 0.4 : 0.6;
    const slidesDuration = isMobile ? 0.5 : 0.7;
    const complexDuration = isMobile ? 0.4 : 0.6;
    
    this._animationTypes = new Map([
      ['animate-on-scroll', { type: 'fade-in', duration: baseDuration, delay: 0, easing: 'ease-out', threshold: 0.15, reset: false }],
      ['slide-in-left', { type: 'slide-in-left', duration: slidesDuration, delay: 0, easing: 'ease-out', threshold: 0.15, reset: false }],
      ['slide-in-right', { type: 'slide-in-right', duration: slidesDuration, delay: 0, easing: 'ease-out', threshold: 0.15, reset: false }],
      ['slide-in-up', { type: 'slide-in-up', duration: slidesDuration, delay: 0, easing: 'ease-out', threshold: 0.15, reset: false }],
      ['fade-in', { type: 'fade-in', duration: baseDuration, delay: 0, easing: 'ease-out', threshold: 0.15, reset: false }],
      ['scale-in', { type: 'scale-in', duration: complexDuration, delay: 0, easing: 'ease-out', threshold: 0.15, reset: false }]
    ]);
    
    return this._animationTypes;
  }

  /**
   * Prüft, ob ein Element innerhalb eines Bereichs liegt, der Animationen deaktiviert
   */
  isOptedOut(element) {
    if (!element || typeof element.closest !== 'function') return false;
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
   * Intersection Handler - Batch-Verarbeitung für bessere Performance
   */
  handleIntersection(entries) {
    const visibleEntries = entries.filter(entry => entry.isIntersecting);
    const hiddenEntries = entries.filter(entry => !entry.isIntersecting);

    // Sichtbare Elemente animieren
    if (visibleEntries.length > 0) {
      this.batchTriggerAnimations(visibleEntries);
    }

    // Reset für versteckte Elemente (nur wenn kein data-once gesetzt ist)
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
   * Triggert Animationen in Batches für bessere Performance
   */
  batchTriggerAnimations(entries) {
    const maxAnimations = this.options.maxAnimations;
    
    if (this.activeAnimations.size >= maxAnimations) {
      // Queue überfüllte Animationen für später
      entries.slice(maxAnimations - this.activeAnimations.size)
        .forEach(entry => this.animationQueue.add(entry.target));
      return;
    }

    entries.forEach(entry => {
      const element = entry.target;
      const animationData = this.getAnimationData(element);
      if (!animationData) return;
      
      const ratio = typeof entry.intersectionRatio === 'number' ? entry.intersectionRatio : 0;
      const threshold = typeof animationData.threshold === 'number' 
        ? animationData.threshold 
        : this.options.threshold;
        
      if (ratio >= threshold) {
        this.triggerAnimation(element, animationData);
      }
    });
  }

  /**
   * Setup MutationObserver mit Performance-Optimierungen
   */
  setupMutationObserver() {
    if (!window.MutationObserver) return;

    const pendingAdded = new Set();
    const pendingAttrTargets = new Set();
    const engineSelector = this.engineSelector;
    
    const scheduleIdle = (callback) => {
      if (window.requestIdleCallback) {
        return window.requestIdleCallback(callback, { timeout: 120 });
      }
      return setTimeout(callback, 0);
    };

    const isElementNode = (node) => node?.nodeType === 1;
    
    const processAddedElement = (element) => {
      if (!isElementNode(element) || this.isOptedOut(element)) return;
      
      this.scanElement(element);
      
      // Scan Nachkommen-Elemente
      const descendants = element.querySelectorAll?.(engineSelector);
      if (descendants?.length) {
        Array.from(descendants).forEach(child => {
          if (!this.isOptedOut(child)) {
            this.scanElement(child);
          }
        });
      }
    };
    
    const processAttributeTarget = (element) => {
      if (!isElementNode(element)) return;
      
      if (this.isOptedOut(element)) {
        this.resetAnimation(element);
        this.unobserveElement(element);
        return;
      }
      
      if (element.matches?.(engineSelector)) {
        this.scanElement(element);
      } else {
        this.resetAnimation(element);
        this.unobserveElement(element);
      }
    };

    this.mutationObserver = new MutationObserver((mutations) => {
      // Sammle alle Änderungen
      mutations.forEach(mutation => {
        if (mutation.type === 'childList' && mutation.addedNodes?.length) {
          mutation.addedNodes.forEach(node => {
            if (isElementNode(node)) {
              pendingAdded.add(node);
            }
          });
        }
        
        if (mutation.type === 'attributes' && isElementNode(mutation.target)) {
          pendingAttrTargets.add(mutation.target);
        }
      });
      
      // Debounced Processing
      if (!this._debouncedMutation) {
        this._debouncedMutation = debounce(() => {
          scheduleIdle(() => {
            // Verarbeite alle gesammelten Änderungen
            Array.from(pendingAdded).forEach(processAddedElement);
            Array.from(pendingAttrTargets).forEach(processAttributeTarget);
            
            // Zurücksetzen für nächste Batch
            pendingAdded.clear();
            pendingAttrTargets.clear();
          });
        }, 100);
      }
      
      this._debouncedMutation();
    });

    this.mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [
        'data-animate', 'data-animation', 'data-delay', 'data-duration',
        'data-easing', 'data-threshold', 'data-once', 'data-reset', 'class'
      ]
    });
  }

  /**
   * Setup Animation Cleanup für Lifecycle-Events
   */
  setupAnimationCleanup() {
    // Pausiere/Fortsetze Animationen bei Sichtbarkeitsänderung
    document.addEventListener('visibilitychange', () => {
      const playState = document.hidden ? 'paused' : 'running';
      
      this.activeAnimations.forEach((_, element) => {
        if (element?.style) {
          element.style.animationPlayState = playState;
        }
      });
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
    this.selectAnimatedElements().forEach(element => this.scanElement(element));
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

  /**
   * Scannt ein Element und fügt es zur Beobachtung hinzu falls animierbar
   */
  scanElement(element) {
    if (element.nodeType !== 1 || this.isOptedOut(element)) return;

    const animationData = this.getAnimationData(element);
    if (animationData) {
      this.observeElement(element);
    }
  }

  /**
   * Extrahiert Animation-Daten aus Element-Attributen oder CSS-Klassen
   */
  getAnimationData(element) {
    if (this.isOptedOut(element)) return null;
    
    // Data-Attribute haben Priorität
    if (element.dataset.animate) {
      return this.parseDataAttribute(element, 'animate');
    }
    
    if (element.dataset.animation) {
      return this.parseDataAttribute(element, 'animation');
    }

    // Fallback auf CSS-Klassen
    return this.parseClassBasedAnimation(element);
  }

  /**
   * Parsiert CSS-Klassen-basierte Animationen
   */
  parseClassBasedAnimation(element) {
    const animationTypes = this.ensureAnimationTypes();
    
    for (const className of element.classList) {
      const config = animationTypes.get(className);
      if (config) {
        const hasResetAttr = Object.hasOwn(element.dataset, 'reset');
        const reset = hasResetAttr 
          ? (element.dataset.reset === 'true') 
          : (this.options.repeatOnScroll || config.reset);
        const once = Object.hasOwn(element.dataset, 'once') 
          ? (element.dataset.once !== 'false') 
          : false;
          
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

  /**
   * Animation-Alias Map für Normalisierung verschiedener Schreibweisen
   */
  _getAnimationAliasMap() {
    return new Map([
      // Slide-Varianten
      ['slideinfromtop', 'slideInDown'],
      ['slideinfrombottom', 'slideInUp'],
      ['slideinfromleft', 'slideInLeft'],
      ['slideinfromright', 'slideInRight'],
      ['slide-in-from-top', 'slideInDown'],
      ['slide-in-from-bottom', 'slideInUp'],
      ['slide-in-from-left', 'slideInLeft'],
      ['slide-in-from-right', 'slideInRight'],
      // Einfache Namen
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
      // Projekt-spezifische Aliases
      ['morphheight', 'scaleIn'],
      ['scaleincenter', 'scaleIn']
    ]);
  }

  /**
   * Parsiert data-animate oder data-animation Attribute
   */
  parseDataAttribute(element, attribute) {
    const raw = element.dataset[attribute] || '';
    const aliasMap = this._getAnimationAliasMap();
    
    const normalizedKey = raw.toString().replace(/\s+/g, '').toLowerCase();
    const animationType = aliasMap.get(normalizedKey) || raw;

    // Reset-Strategie: data-reset überschreibt globale repeatOnScroll-Einstellung
    const hasResetAttr = Object.hasOwn(element.dataset, 'reset');
    const reset = hasResetAttr 
      ? (element.dataset.reset === 'true') 
      : this.options.repeatOnScroll;
    const once = Object.hasOwn(element.dataset, 'once') 
      ? (element.dataset.once !== 'false') 
      : false;
      
    return {
      type: animationType,
      duration: parseFloat(element.dataset.duration) || 0.6,
      delay: parseFloat(element.dataset.delay) || 0,
      easing: element.dataset.easing || 'ease-out',
      threshold: parseFloat(element.dataset.threshold) || 0.15,
      reset,
      once
    };
  }

  /**
   * Dauer-Konvertierung: String/Number -> Millisekunden
   */
  toMs(value) {
    if (value == null) return 0;
    
    if (typeof value === 'string') {
      const trimmed = value.trim().toLowerCase();
      if (trimmed.endsWith('ms')) return parseFloat(trimmed);
      if (trimmed.endsWith('s')) return parseFloat(trimmed) * 1000;
      
      const number = parseFloat(trimmed);
      if (!Number.isFinite(number)) return 0;
      return number > 10 ? number : number * 1000;
    }
    
    if (typeof value === 'number') {
      return value > 10 ? value : value * 1000;
    }
    
    return 0;
  }

  /**
   * Triggert Animation mit Performance-Optimierungen
   */
  triggerAnimation(element, animationData) {
    if (this.activeAnimations.has(element)) return;

    const delay = animationData.delay || 0;
    const duration = this.toMs(animationData.duration);
    
    // GPU-Beschleunigung mit will-change Throttling
    this._enableWillChange(element);

    // Animation-Klasse bestimmen
    const animationType = this._resolveAnimationType(animationData.type);
    const animationClass = animationType.startsWith('animate-') 
      ? animationType 
      : `animate-${animationType}`;

    // Animation-Trigger-Funktion
    const executeAnimation = () => {
      window.requestAnimationFrame(() => {
        if (!element?.style || !element?.classList) return;
        
        // Inline-Styles für Dauer/Easing setzen
        if (duration > 0) {
          element.style.animationDuration = `${duration}ms`;
          element.style.transitionDuration = `${duration}ms`;
        }
        if (animationData.easing) {
          element.style.animationTimingFunction = animationData.easing;
          element.style.transitionTimingFunction = animationData.easing;
        }
        
        // Animationsklassen hinzufügen
        element.classList.add(animationClass, 'animated');
        this.activeAnimations.set(element, animationData);
        
        // Bei data-once: Element nur einmal animieren
        if (animationData.once) {
          this.animatedOnce.add(element);
          element.dataset.animatedOnce = 'true';
          this.unobserveElement(element);
        }
        
        // Animation Queue verarbeiten
        this.processAnimationQueue();
      });
    };

    // Delay-Handling
    if (delay > 0) {
      this._scheduleDelayedAnimation(executeAnimation, delay);
    } else {
      executeAnimation();
    }

    // Cleanup nach Animation
    setTimeout(() => {
      this._cleanupWillChange(element);
    }, delay + duration);
  }

  /**
   * Aktiviert will-change mit Performance-Throttling
   */
  _enableWillChange(element) {
    if (!this._willChangeElements) {
      this._willChangeElements = new Set();
    }
    
    const MAX_WILL_CHANGE = 8;
    
    if (this._willChangeElements.size < MAX_WILL_CHANGE && element?.style) {
      element.style.willChange = 'transform, opacity';
      element.style.transform = 'translateZ(0)';
      this._willChangeElements.add(element);
    }
  }

  /**
   * Bereinigt will-change Property
   */
  _cleanupWillChange(element) {
    window.requestAnimationFrame(() => {
      if (element?.style?.willChange) {
        element.style.willChange = '';
        this._willChangeElements?.delete(element);
      }
    });
  }

  /**
   * Löst Animation-Typ auf und wendet Fallbacks an
   */
  _resolveAnimationType(type) {
    const baseType = type || 'fadeIn';
    
    // Performance-Fallbacks für komplexe Animationen
    const performanceFallbacks = {
      fadeInUp: 'fadeIn',
      bounceIn: 'scaleIn',
      elasticIn: 'scaleIn'
    };
    
    const allowedAnimations = this.options.allowedAnimations;
    
    // Verwende Fallback wenn Animation nicht erlaubt ist
    if (!allowedAnimations.includes(baseType) && performanceFallbacks[baseType]) {
      return performanceFallbacks[baseType];
    }
    
    return baseType;
  }

  /**
   * Plant verzögerte Animation mit requestAnimationFrame-Kette
   */
  _scheduleDelayedAnimation(callback, delayMs) {
    const startTime = performance.now();
    
    const checkDelay = (currentTime) => {
      if (currentTime - startTime >= delayMs) {
        callback();
      } else {
        requestAnimationFrame(checkDelay);
      }
    };
    
    requestAnimationFrame(checkDelay);
  }

  /**
   * Verarbeitet die Animation Queue in Batches
   */
  processAnimationQueue() {
    if (this.animationQueue.size === 0) return;
    if (this.activeAnimations.size >= this.options.maxAnimations) return;
    if (this._queueScheduled) return;
    
    this._queueScheduled = true;
    
    const schedule = (callback) => {
      if (window.requestIdleCallback) {
        return window.requestIdleCallback(callback, { timeout: 120 });
      }
      return requestAnimationFrame(callback);
    };
    
    schedule(() => {
      const BATCH_SIZE = 4;
      let processed = 0;
      
      while (this.animationQueue.size && 
             processed < BATCH_SIZE && 
             this.activeAnimations.size < this.options.maxAnimations) {
        
        const element = this.animationQueue.values().next().value;
        this.animationQueue.delete(element);
        
        const animationData = this.getAnimationData(element);
        if (animationData) {
          this.triggerAnimation(element, animationData);
        }
        
        processed++;
      }
      
      this._queueScheduled = false;
      
      // Weitere Verarbeitung falls noch Elemente in der Queue sind
      if (this.animationQueue.size > 0) {
        this.processAnimationQueue();
      }
    });
  }

  /**
   * Private Hilfsmethode: Entfernt Animationsklassen von einem Element
   */
  _removeAnimationClasses(element) {
    if (!element?.classList) return;
    
    const animationData = this.activeAnimations.get(element);
    
    if (animationData) {
      const baseType = animationData.type || 'fadeIn';
      const animationClass = baseType.startsWith('animate-') 
        ? baseType 
        : `animate-${baseType}`;
      element.classList.remove(animationClass, 'animated');
      this.activeAnimations.delete(element);
    } else {
      // Fallback: Entferne alle animate-* Klassen
      const animateClasses = Array.from(element.classList)
        .filter(className => className.startsWith('animate-'));
      if (animateClasses.length > 0) {
        element.classList.remove(...animateClasses);
      }
      element.classList.remove('animated');
    }
    
    // Legacy-Kompatibilität für is-visible Pattern
    if (element.classList.contains('animate-element')) {
      element.classList.remove('is-visible');
    }
  }

  /**
   * Setzt Animation eines Elements zurück
   */
  resetAnimation(element) {
    this._removeAnimationClasses(element);
    // Queue verarbeiten nach Reset
    this.processAnimationQueue();
  }

  /**
   * Setzt globale Wiederholungsstrategie
   */
  setRepeatOnScroll(enabled) {
    this.options.repeatOnScroll = !!enabled;
  }

  /**
   * Öffentliche API: Animiert alle Elemente in einem Container sofort
   */
  animateElementsIn(container, { force = true } = {}) {
    try {
      const elements = this.selectAnimatedElements(container);
      
      elements.forEach(element => {
        const animationData = this.getAnimationData(element);
        if (!animationData) return;
        
        if (force || !this.activeAnimations.has(element)) {
          // Reset vor neuer Animation nur bei force
          if (force) {
            this.resetAnimation(element);
          }
          this.triggerAnimation(element, animationData);
        }
      });
    } catch {
      // Graceful degradation bei Fehlern
    }
  }

  /**
   * Öffentliche API: Setzt alle Animationen in einem Container zurück
   */
  resetElementsIn(container) {
    try {
      const elements = this.selectAnimatedElements(container);
      elements.forEach(element => this._removeAnimationClasses(element));
    } catch {
      // Graceful degradation bei Fehlern
    }
  }

  /**
   * Öffentliche API: Scannt nach neuen animierbaren Elementen
   */
  scan() {
    this.scanForAnimations();
  }

  /**
   * Fallback-Methode: Re-scan aller Animationen (Alias für scan)
   */
  forceCurrentSectionAnimations() {
    return this.scan();
  }

  /**
   * Cleanup: Bereinigt alle Observer und Referenzen
   */
  cleanup() {
    // Observer deaktivieren
    this.intersectionObserver?.disconnect();
    this.mutationObserver?.disconnect();
    
    // Referenzen bereinigen
    this.activeAnimations.clear();
    this.animationQueue.clear();
    
    // Will-change Properties aufräumen
    if (this._willChangeElements) {
      this._willChangeElements.forEach(element => {
        if (element?.style) {
          element.style.willChange = '';
        }
      });
      this._willChangeElements.clear();
    }
  }
}

// ES6 Module Export
export { EnhancedAnimationEngine };

// Bedingte Auto-Initialisierung für globale Verwendung
if (typeof window !== 'undefined' && window.AUTO_INIT_ANIMATIONS === true) {
  window.enhancedAnimationEngine = new EnhancedAnimationEngine();
}
