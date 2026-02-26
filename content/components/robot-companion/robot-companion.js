/**
 * KI Roboter Begleiter
 *  * @version 2.0.1
 */
// @ts-check

import { RobotGames } from './robot-games.js';
import { RobotCollision } from './modules/robot-collision.js';
import { RobotAnimation } from './modules/robot-animation.js';
import { RobotChat } from './modules/robot-chat.js';
import { RobotIntelligence } from './modules/robot-intelligence.js';
import { RobotEmotions } from './modules/robot-emotions.js';
import { RobotContextReactions } from './modules/robot-context-reactions.js';
import { robotCompanionTexts } from './robot-companion-texts.js';
import { createLogger } from '../../core/logger.js';
import { createObserver, TimerManager } from '../../core/utils.js';
import { ROBOT_EVENTS } from './constants/events.js';
import { RobotStateManager } from './state/RobotStateManager.js';
import { RobotDOMBuilder } from './dom/RobotDOMBuilder.js';

const log = createLogger('RobotCompanion');

/**
 * @typedef {import('/content/core/types.js').TimerID} TimerID
 * @typedef {import('/content/core/types.js').RobotState} RobotState
 * @typedef {import('/content/core/types.js').RobotAnalytics} RobotAnalytics
 * @typedef {import('/content/core/types.js').DOMCache} DOMCache
 * @typedef {import('/content/core/types.js').EventListenerRegistry} EventListenerRegistry
 * @typedef {import('/content/core/types.js').TimerRegistry} TimerRegistry
 * @typedef {import('/content/core/types.js').PageContext} PageContext
 * @typedef {import('/content/core/types.js').RobotMood} RobotMood
 */

/**
 * Robot Companion Class
 * Main controller for the AI robot companion
 */
export class RobotCompanion {
  containerId = 'robot-companion-container';
  /** @type {Object} */
  texts = {};

  constructor() {
    this.texts = robotCompanionTexts;

    // Initialize DOM Builder
    /** @type {RobotDOMBuilder} */
    this.domBuilder = new RobotDOMBuilder();

    // Initialize State Manager
    /** @type {RobotStateManager} */
    this.stateManager = new RobotStateManager();

    /** @type {TimerManager} */
    this.timerManager = new TimerManager('RobotCompanion');

    /** @type {import('./ai-service.js').AIService|null} */
    this.aiService = null;
    /** @type {RobotGames} */
    this.gameModule = new RobotGames(this);
    /** @type {RobotAnimation} */
    this.animationModule = new RobotAnimation(this);
    /** @type {RobotCollision} */
    this.collisionModule = new RobotCollision(this);
    /** @type {RobotChat} */
    this.chatModule = new RobotChat(this);
    /** @type {RobotIntelligence} */
    this.intelligenceModule = new RobotIntelligence(this);
    /** @type {RobotEmotions} */
    this.emotionsModule = new RobotEmotions(this);
    /** @type {RobotContextReactions} */
    this.contextReactionsModule = new RobotContextReactions(this);

    /** @type {boolean} Flag to prevent footer overlap check from overriding keyboard adjustment */
    this.isKeyboardAdjustmentActive = false;

    /** @type {number} Store initial layout height for detecting keyboard */
    this.initialLayoutHeight =
      typeof globalThis !== 'undefined' ? globalThis.innerHeight : 0;

    /** @type {import('/content/core/types.js').PageContext|null} */
    this.currentObservedContext = null;
    /** @type {ReturnType<typeof createObserver>|null} */
    this._sectionObserver = null;
    /** @type {ResizeObserver|null} */
    this._footerLayoutObserver = null;
    /** @type {Element|null} */
    this._observedFooterEl = null;
    /** @type {import('/content/core/types.js').PageContext|null} */
    this._lastKnownContext = null;
    /** @type {Element|null} */
    this._typeWriterEl = null;

    /** @type {import('/content/core/types.js').EventListenerRegistry} */
    this._eventListeners = {
      scroll: [],
      resize: [],
      visualViewportResize: [],
      visualViewportScroll: [],
      inputFocus: null,
      inputBlur: null,
      heroTypingEnd: null,
      dom: [],
    };

    /** @type {import('/content/core/types.js').TimerID | null} */
    this._scrollTimeout = null;

    // Load analytics from storage and calculate mood
    this.stateManager.loadFromStorage();
    const mood = this.calculateMood();
    this.stateManager.setState({ mood });

    // Legacy properties for backward compatibility (deprecated)
    /** @type {import('/content/core/types.js').RobotAnalytics} */
    this.analytics = this.stateManager.getState().analytics;
    /** @type {import('/content/core/types.js').RobotMood} */
    this.mood = mood;

    /** @type {Set<string>} */
    this.easterEggFound = new Set(
      JSON.parse(localStorage.getItem('robot-easter-eggs') || '[]'),
    );

    /** @type {import('/content/core/types.js').DOMCache} */
    this.dom = {};

    this.applyTexts();
  }

  /**
   * Safe timeout wrapper for automatic cleanup
   * @param {Function} callback - Callback function
   * @param {number} delay - Delay in milliseconds
   * @returns {ReturnType<typeof setTimeout>} Timeout ID
   */
  _setTimeout(callback, delay) {
    return this.timerManager.setTimeout(callback, delay);
  }

  /**
   * Safe interval wrapper for automatic cleanup
   * @param {Function} callback - Callback function
   * @param {number} delay - Delay in milliseconds
   * @returns {ReturnType<typeof setInterval>} Interval ID
   */
  _setInterval(callback, delay) {
    return this.timerManager.setInterval(callback, delay);
  }

  /**
   * Clear timeout and remove from registry
   * @param {ReturnType<typeof setTimeout>} id - Timeout ID
   */
  _clearTimeout(id) {
    this.timerManager.clearTimeout(id);
  }

  /**
   * Clear interval and remove from registry
   * @param {ReturnType<typeof setInterval>} id - Interval ID
   */
  _clearInterval(id) {
    this.timerManager.clearInterval(id);
  }

  applyTexts() {
    const src = this.texts || {};
    const chat = /** @type {any} */ (this.chatModule);

    chat.knowledgeBase = src.knowledgeBase ||
      chat.knowledgeBase || { start: { text: 'Hallo!', options: [] } };
    chat.contextGreetings = src.contextGreetings ||
      chat.contextGreetings || { default: [] };
    chat.moodGreetings = src.moodGreetings ||
      chat.moodGreetings || {
        normal: ['Hey! Wie kann ich helfen?', 'Hi! Was brauchst du?'],
      };
    chat.startMessageSuffix =
      src.startMessageSuffix || chat.startMessageSuffix || {};
    chat.initialBubblePools =
      src.initialBubblePools || chat.initialBubblePools || [];
    chat.initialBubbleSequenceConfig = src.initialBubbleSequenceConfig ||
      chat.initialBubbleSequenceConfig || {
        steps: 4,
        displayDuration: 10000,
        pausesAfter: [0, 20000, 20000, 0],
      };
  }

  /**
   * Lazy load the AI Service
   * @returns {Promise<import('./ai-service.js').AIService>}
   */
  async getAIService() {
    if (!this.aiService) {
      const { AIService } = await import('./ai-service.js');
      this.aiService = new AIService();
    }
    return this.aiService;
  }

  getFooterElement() {
    if (this.dom.footer && document.contains(this.dom.footer)) {
      return this.dom.footer;
    }

    // prefer custom element; fall back to legacy <footer> tag if present
    // prefer the <site-footer> custom element; page markup should always
    // include it now that the ID has been removed.
    this.dom.footer = document.querySelector('site-footer');
    return this.dom.footer || null;
  }

  getTypewriterElement() {
    if (this._typeWriterEl && document.contains(this._typeWriterEl)) {
      return this._typeWriterEl;
    }

    this._typeWriterEl = document.querySelector('.typewriter-title');
    return this._typeWriterEl || null;
  }

  checkTypewriterCollision() {
    const typeWriter = this.getTypewriterElement();
    if (!typeWriter || !this.dom?.container) return;

    const twRect = typeWriter.getBoundingClientRect();
    const robotWidth = 80;
    const initialLeft =
      (typeof globalThis !== 'undefined' ? globalThis.innerWidth : 0) -
      30 -
      robotWidth;
    const maxLeft = initialLeft - 20;
    this.collisionModule.checkForTypewriterCollision(twRect, maxLeft);
  }

  maybeTriggerContextReaction(currentContext = null) {
    if (this.chatModule.isOpen) return;

    const nextContext = currentContext || this.getPageContext();
    if (!nextContext) return;

    if (!this._lastKnownContext) {
      this._lastKnownContext = nextContext;
      return;
    }

    if (
      nextContext === this._lastKnownContext ||
      nextContext === this.chatModule.lastGreetedContext
    ) {
      return;
    }

    this._lastKnownContext = nextContext;
    this.contextReactionsModule?.reactToSection(nextContext);

    this._setTimeout(() => {
      if (this.getPageContext() === nextContext && !this.chatModule.isOpen) {
        this.chatModule.startInitialBubbleSequence();
      }
    }, 2000);
  }

  setupFooterOverlapCheck() {
    let ticking = false;

    const ensureObservedFooter = () => {
      if (!this._footerLayoutObserver) return;
      const footer = this.getFooterElement();
      if (!footer || this._observedFooterEl === footer) return;

      if (this._observedFooterEl) {
        try {
          this._footerLayoutObserver.unobserve(this._observedFooterEl);
        } catch {
          /* ignore */
        }
      }

      this._footerLayoutObserver.observe(footer);
      this._observedFooterEl = footer;
    };

    const checkOverlap = () => {
      // Skip if search animation is active
      if (
        this.animationModule.searchAnimation &&
        this.animationModule.searchAnimation.active
      ) {
        // Ensure bottom is reset so transform works from base position
        if (this.dom.container.style.bottom) {
          this.dom.container.style.bottom = '';
        }
        ticking = false;
        return;
      }

      // If keyboard adjustment is active, skip overlap check to prevent overriding style.bottom
      if (this.isKeyboardAdjustmentActive) {
        ticking = false;
        return;
      }

      if (!this.dom.container) return;

      const footer = this.getFooterElement();
      if (!footer) return;

      this.dom.container.style.bottom = '';
      const rect = this.dom.container.getBoundingClientRect();
      const fRect = footer.getBoundingClientRect();
      const overlap = Math.max(0, rect.bottom - fRect.top);

      if (overlap > 0) {
        this.dom.container.style.bottom = `${30 + overlap}px`;
      }

      if (!this.chatModule.isOpen) {
        this.collisionModule.scanForCollisions();
      }
      ticking = false;
      ensureObservedFooter();
    };

    const requestTick = () => {
      if (!ticking) {
        requestAnimationFrame(checkOverlap);
        ticking = true;
      }
    };

    if (typeof globalThis !== 'undefined') {
      globalThis.addEventListener('scroll', requestTick, { passive: true });
      globalThis.addEventListener('resize', requestTick, { passive: true });
      // Registriere Listener für Cleanup
      this._eventListeners.scroll.push({
        target: globalThis,
        handler: requestTick,
      });
      this._eventListeners.resize.push({
        target: globalThis,
        handler: requestTick,
      });
    }

    if (typeof ResizeObserver !== 'undefined') {
      if (this._footerLayoutObserver) {
        this._footerLayoutObserver.disconnect();
      }
      this._footerLayoutObserver = new ResizeObserver(() => requestTick());
      this._footerLayoutObserver.observe(document.documentElement);
      if (this.dom.container) {
        this._footerLayoutObserver.observe(this.dom.container);
      }
      ensureObservedFooter();
    }

    requestTick();
  }

  setupMobileViewportHandler() {
    if (typeof globalThis === 'undefined' || !globalThis.visualViewport) return;

    this._handleViewportResize = () => {
      // Skip if search animation is active
      if (
        this.animationModule.searchAnimation &&
        this.animationModule.searchAnimation.active
      ) {
        return;
      }

      if (!this.dom.window || !this.dom.container) return;

      // If chat is closed, ensure we clean up state and do nothing else
      if (!this.chatModule.isOpen) {
        if (this.isKeyboardAdjustmentActive) {
          this.isKeyboardAdjustmentActive = false;
          this.dom.container.style.bottom = '';
          this.dom.window.style.maxHeight = '';
        }
        return;
      }

      // Use initialLayoutHeight if available to detect shrink-resize behaviors
      const referenceHeight =
        this.initialLayoutHeight ||
        (typeof globalThis !== 'undefined' ? globalThis.innerHeight : 0);
      const visualHeight =
        typeof globalThis !== 'undefined' && globalThis.visualViewport
          ? globalThis.visualViewport.height
          : referenceHeight;
      const heightDiff = referenceHeight - visualHeight;
      const isInputFocused = document.activeElement === this.dom.input;

      // Threshold: > 150px difference usually implies keyboard.
      // Also trigger if input is focused and difference is measurable (>50px).
      const isKeyboardOverlay =
        heightDiff > 150 || (isInputFocused && heightDiff > 50);

      if (isKeyboardOverlay) {
        // Keyboard is open (overlay mode or partial resize)
        this.isKeyboardAdjustmentActive = true;

        if (this.dom.controls) {
          this.dom.controls.classList.add('hide-controls-mobile');
        }

        const safeMargin = 10;
        const maxWindowHeight = visualHeight - safeMargin * 2;
        this.dom.window.style.maxHeight = `${maxWindowHeight}px`;

        requestAnimationFrame(() => {
          if (!this.dom.window) return;
          const currentHeight = this.dom.window.offsetHeight;
          const spaceAboveKeyboard = visualHeight;
          const freeSpace = Math.max(0, spaceAboveKeyboard - currentHeight);
          const verticalPadding = freeSpace / 2;

          const centeredBottom = heightDiff + verticalPadding;
          this.dom.container.style.bottom = `${centeredBottom}px`;
        });

        // Fallback initial set to ensure it jumps up immediately
        this.dom.container.style.bottom = `${heightDiff + 10}px`;
      } else {
        // Keyboard is closed
        this.isKeyboardAdjustmentActive = false;

        if (this.dom.controls && !isInputFocused) {
          this.dom.controls.classList.remove('hide-controls-mobile');
        }

        // Reset styles to allow CSS / footer overlap logic to take over
        this.dom.container.style.bottom = '';
        this.dom.window.style.maxHeight = '';
      }
    };

    if (typeof globalThis !== 'undefined' && globalThis.visualViewport) {
      globalThis.visualViewport.addEventListener(
        'resize',
        this._handleViewportResize,
      );
      globalThis.visualViewport.addEventListener(
        'scroll',
        this._handleViewportResize,
      );
      // Registriere Listener für Cleanup
      this._eventListeners.visualViewportResize.push({
        target: globalThis.visualViewport,
        handler: this._handleViewportResize,
      });
      this._eventListeners.visualViewportScroll.push({
        target: globalThis.visualViewport,
        handler: this._handleViewportResize,
      });
    }

    this.setupChatInputViewportHandlers();
  }

  setupChatInputViewportHandlers() {
    if (this.dom.input && this._handleViewportResize) {
      const handleResize = this._handleViewportResize;
      const blurHandler = () => setTimeout(handleResize, 200);
      this.dom.input.addEventListener('focus', handleResize);
      this.dom.input.addEventListener('blur', blurHandler);
      // Registriere Listener für Cleanup
      this._eventListeners.inputFocus = {
        target: this.dom.input,
        handler: handleResize,
      };
      this._eventListeners.inputBlur = {
        target: this.dom.input,
        handler: blurHandler,
      };
    }
  }

  init() {
    if (this.dom.container) return;

    this.loadCSS();
    this.createDOM();
    this.attachEvents();
    this.setupFooterOverlapCheck();
    this.setupMobileViewportHandler();

    this._setTimeout(() => {
      const ctx = this.getPageContext();
      if (!this.chatModule.isOpen && !this.chatModule.lastGreetedContext) {
        const showSequenceChance = 0.9;
        const chat = /** @type {any} */ (this.chatModule);
        if (
          chat.initialBubblePools &&
          chat.initialBubblePools.length > 0 &&
          Math.random() < showSequenceChance
        ) {
          this.chatModule.startInitialBubbleSequence();
        } else {
          const ctxArr =
            chat.contextGreetings[ctx] || chat.contextGreetings.default || [];
          let finalGreet = 'Hallo!';
          if (ctxArr.length && Math.random() < 0.7) {
            const ctxMsg = String(
              ctxArr[Math.floor(Math.random() * ctxArr.length)] || '',
            ).trim();
            finalGreet = ctxMsg;
          }
          this.chatModule.showBubble(finalGreet);
          this.chatModule.lastGreetedContext = ctx;
        }
      }
    }, 5000);

    this.setupSectionChangeDetection();

    // Start context-aware reactions monitoring
    this._setTimeout(() => {
      this.contextReactionsModule.startMonitoring();
      this.contextReactionsModule.setupIdleReaction(60000); // 1 minute idle
    }, 3000);

    this._setTimeout(() => {
      this.animationModule.startTypeWriterKnockbackAnimation();
    }, 50);

    this._onHeroTypingEnd = () => {
      try {
        this.checkTypewriterCollision();
      } catch (err) {
        log.warn('RobotCompanion: hero typing end handler failed', err);
      }
    };
    document.addEventListener(
      ROBOT_EVENTS.HERO_TYPING_END,
      this._onHeroTypingEnd,
    );
    this._eventListeners.heroTypingEnd = {
      target: document,
      handler: this._onHeroTypingEnd,
    };
  }

  setupSectionChangeDetection() {
    this.setupSectionObservers();
    this._lastKnownContext = this.getPageContext();

    let rafPending = false;
    this._scrollListener = () => {
      if (rafPending) return;
      rafPending = true;

      requestAnimationFrame(() => {
        rafPending = false;
        if (this._scrollTimeout) {
          this._clearTimeout(this._scrollTimeout);
        }
        this._scrollTimeout = /** @type {TimerID} */ (
          this._setTimeout(() => {
            this.maybeTriggerContextReaction();
            try {
              this.checkTypewriterCollision();
            } catch (err) {
              log.warn(
                'RobotCompanion: scroll handler collision check failed',
                err,
              );
            }
          }, 220)
        );
      });
    };

    if (typeof globalThis !== 'undefined') {
      globalThis.addEventListener('scroll', this._scrollListener, {
        passive: true,
      });
      // Registriere Listener für Cleanup
      this._eventListeners.scroll.push({
        target: globalThis,
        handler: this._scrollListener,
      });
    }

    const _onNavContextCheck = () => this.maybeTriggerContextReaction();
    window.addEventListener('hashchange', _onNavContextCheck, {
      passive: true,
    });
    window.addEventListener('popstate', _onNavContextCheck, { passive: true });
    this._eventListeners.dom.push({
      target: window,
      event: 'hashchange',
      handler: _onNavContextCheck,
    });
    this._eventListeners.dom.push({
      target: window,
      event: 'popstate',
      handler: _onNavContextCheck,
    });

    this.maybeTriggerContextReaction(this._lastKnownContext);
  }

  destroy() {
    // Module Cleanup
    if (this.chatModule?.destroy) {
      this.chatModule.destroy();
    }
    this.chatModule?.clearBubbleSequence();
    const anim = /** @type {any} */ (this.animationModule);
    anim?.stopIdleEyeMovement();
    anim?.stopBlinkLoop();

    // Intelligence Modul Cleanup (Event-Listener entfernen)
    if (this.intelligenceModule?.destroy) {
      this.intelligenceModule.destroy();
    }

    // Collision Modul Cleanup (IntersectionObserver)
    if (this.collisionModule?.destroy) {
      this.collisionModule.destroy();
    }

    // Observer Cleanup
    if (this._sectionObserver) {
      this._sectionObserver.disconnect();
      this._sectionObserver = null;
    }
    if (this._footerLayoutObserver) {
      this._footerLayoutObserver.disconnect();
      this._footerLayoutObserver = null;
      this._observedFooterEl = null;
    }

    // State Manager Cleanup
    if (this.stateManager) {
      this.stateManager.destroy();
    }

    // Zentrale Event-Listener Cleanup
    if (this._eventListeners) {
      // Scroll Listeners
      this._eventListeners.scroll.forEach(({ target, handler }) => {
        target.removeEventListener('scroll', handler);
      });

      // Resize Listeners
      this._eventListeners.resize.forEach(({ target, handler }) => {
        target.removeEventListener('resize', handler);
      });

      // Visual Viewport Listeners
      this._eventListeners.visualViewportResize.forEach(
        ({ target, handler }) => {
          target.removeEventListener('resize', handler);
        },
      );
      this._eventListeners.visualViewportScroll.forEach(
        ({ target, handler }) => {
          target.removeEventListener('scroll', handler);
        },
      );

      // Input Listeners
      if (this._eventListeners.inputFocus) {
        const { target, handler } = this._eventListeners.inputFocus;
        target.removeEventListener('focus', handler);
      }
      if (this._eventListeners.inputBlur) {
        const { target, handler } = this._eventListeners.inputBlur;
        target.removeEventListener('blur', handler);
      }

      // Hero Typing End Listener
      if (this._eventListeners.heroTypingEnd) {
        const { target, handler } = this._eventListeners.heroTypingEnd;
        target.removeEventListener(ROBOT_EVENTS.HERO_TYPING_END, handler);
      }

      // DOM element listeners
      if (this._eventListeners.dom && this._eventListeners.dom.length) {
        this._eventListeners.dom.forEach(({ target, event, handler }) => {
          try {
            target.removeEventListener(event, handler);
          } catch {
            /* ignore */
          }
        });
      }

      // Clear alle Referenzen
      this._eventListeners = {
        scroll: [],
        resize: [],
        visualViewportResize: [],
        visualViewportScroll: [],
        inputFocus: null,
        inputBlur: null,
        heroTypingEnd: null,
        dom: [],
      };
    }

    // Zentrale Timer Cleanup
    if (this.timerManager) {
      this.timerManager.clearAll();
    }
    this._scrollTimeout = null;

    // DOM Cleanup
    if (this.dom.container && this.dom.container.parentNode) {
      this.dom.container?.remove();
    }
    if (this.dom.window && this.dom.window.parentNode) {
      this.dom.window?.remove();
    }
  }

  /**
   * Calculate current mood based on time and analytics
   * @returns {import('/content/core/types.js').RobotMood}
   */
  calculateMood() {
    const hour = new Date().getHours();
    const state = this.stateManager.getState();
    const { sessions, interactions } = state.analytics;

    if (hour >= 0 && hour < 6) return 'night-owl';
    if (hour >= 6 && hour < 10) return 'sleepy';
    if (hour >= 10 && hour < 17) return 'energetic';
    if (hour >= 17 && hour < 22) return 'relaxed';
    if (hour >= 22) return 'night-owl';
    if (sessions > 10 || interactions > 50) return 'enthusiastic';
    return 'normal';
  }

  /**
   * Get mood-based greeting message
   * @returns {string}
   */
  getMoodGreeting() {
    const chat = /** @type {any} */ (this.chatModule);
    const greetings =
      chat.moodGreetings ||
      (typeof globalThis !== 'undefined' &&
        globalThis.robotCompanionTexts &&
        globalThis.robotCompanionTexts.moodGreetings) ||
      {};

    // Get current mood from state manager
    const currentMood = this.stateManager.getState().mood;
    const moodGreets = greetings[currentMood] ||
      greetings['normal'] || ['Hey! Wie kann ich helfen?'];
    return moodGreets[Math.floor(Math.random() * moodGreets.length)];
  }

  trackInteraction() {
    this.stateManager.trackInteraction();

    // Update legacy property for backward compatibility
    this.analytics = this.stateManager.getState().analytics;

    const interactions = this.analytics.interactions;

    if (interactions === 10 && !this.easterEggFound.has('first-10')) {
      this.unlockEasterEgg(
        'first-10',
        '🎉 Wow, 10 Interaktionen! Du bist hartnäckig! Hier ist ein Geschenk: Ein geheimes Mini-Game wurde freigeschaltet! 🎮',
      );
    }
    if (interactions === 50 && !this.easterEggFound.has('first-50')) {
      this.unlockEasterEgg(
        'first-50',
        '🏆 50 Interaktionen! Du bist ein echter Power-User! Respekt! 💪',
      );
    }
  }

  /**
   * Unlock easter egg achievement
   * @param {string} id - Easter egg ID
   * @param {string} message - Achievement message
   */
  unlockEasterEgg(id, message) {
    this.easterEggFound.add(id);
    localStorage.setItem(
      'robot-easter-eggs',
      JSON.stringify([...this.easterEggFound]),
    );
    this.chatModule.showBubble(message);
    this._setTimeout(() => this.chatModule.hideBubble(), 10000);
  }

  /**
   * Track section visit for analytics
   * @param {import('/content/core/types.js').PageContext} context - Page context
   */
  trackSectionVisit(context) {
    this.stateManager.trackSectionVisit(context);

    // Update legacy property for backward compatibility
    this.analytics = this.stateManager.getState().analytics;

    const allSections = [
      'hero',
      'features',
      'section3',
      'projects',
      'gallery',
      'footer',
    ];
    const visitedAll = allSections.every((s) =>
      this.analytics.sectionsVisited.includes(s),
    );
    if (visitedAll && !this.easterEggFound.has('explorer')) {
      this.unlockEasterEgg(
        'explorer',
        '🗺️ Du hast alle Bereiche erkundet! Echter Explorer! 🧭',
      );
    }
  }

  loadCSS() {
    if (!document.querySelector('link[href*="robot-companion.css"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = '/content/components/robot-companion/robot-companion.css';
      document.head.appendChild(link);
    }
  }

  createDOM() {
    // Use DOM Builder for XSS-safe element creation
    const container = this.domBuilder.createContainer();
    document.body.appendChild(container);

    // Cache DOM references
    this.dom.container = container;
    this.dom.floatWrapper = container.querySelector('.robot-float-wrapper');
    this.dom.bubble = document.getElementById('robot-bubble');
    this.dom.bubbleText = document.getElementById('robot-bubble-text');
    this.dom.bubbleClose = container.querySelector('.robot-bubble-close');
    this.dom.avatar = container.querySelector('.robot-avatar');
    this.dom.svg = container.querySelector('.robot-svg');
    this.dom.eyes = container.querySelector('.robot-eyes');
    this.dom.lids = container.querySelectorAll('.robot-lid');
    this.dom.pupils = container.querySelectorAll('.robot-pupil');
    this.dom.antenna = container.querySelector('.robot-antenna-light');
    this.dom.flame = container.querySelector('.robot-flame');
    this.dom.legs = container.querySelector('.robot-legs');
    this.dom.arms = {
      left: container.querySelector('.robot-arm.left'),
      right: container.querySelector('.robot-arm.right'),
    };
    this.dom.particles = container.querySelector('.robot-particles');
    this.dom.thinking = container.querySelector('.robot-thinking');
    this.dom.magnifyingGlass = container.querySelector(
      '.robot-magnifying-glass',
    );
    this.dom.mouth = container.querySelector('.robot-mouth');

    const anim = /** @type {any} */ (this.animationModule);
    requestAnimationFrame(() => anim.startIdleEyeMovement());
  }

  ensureChatWindowCreated() {
    if (this.dom.window) return;

    const chatWindow = this.domBuilder.createChatWindow();
    document.body.appendChild(chatWindow);

    this.dom.window = chatWindow;
    this.dom.messages = document.getElementById('robot-messages');
    this.dom.controls = document.getElementById('robot-controls');
    this.dom.inputArea = document.getElementById('robot-input-area');
    this.dom.input = /** @type {HTMLInputElement} */ (
      document.getElementById('robot-chat-input')
    );
    this.dom.sendBtn = /** @type {HTMLButtonElement} */ (
      document.getElementById('robot-chat-send')
    );
    this.dom.closeBtn = chatWindow.querySelector('.chat-close-btn');

    this.attachChatEvents();
    this.setupChatInputViewportHandlers();
  }

  attachEvents() {
    const _onAvatarClick = () => this.handleAvatarClick();
    this.dom.avatar.addEventListener('click', _onAvatarClick);
    this._eventListeners.dom.push({
      target: this.dom.avatar,
      event: 'click',
      handler: _onAvatarClick,
    });

    const _onBubbleClose = (e) => {
      e.stopPropagation();
      const ctx = this.getPageContext();
      this.chatModule.lastGreetedContext = ctx;
      this.chatModule.clearBubbleSequence();
      this.chatModule.hideBubble();
    };
    this.dom.bubbleClose.addEventListener('click', _onBubbleClose);
    this._eventListeners.dom.push({
      target: this.dom.bubbleClose,
      event: 'click',
      handler: _onBubbleClose,
    });

    // Search Events
    const _onSearchOpened = () => {
      this.animationModule.startSearchAnimation();
    };
    const _onSearchClosed = () => {
      this.animationModule.stopSearchAnimation();
    };

    window.addEventListener('search:opened', _onSearchOpened);
    window.addEventListener('search:closed', _onSearchClosed);

    this._eventListeners.dom.push({
      target: window,
      event: 'search:opened',
      handler: _onSearchOpened,
    });
    this._eventListeners.dom.push({
      target: window,
      event: 'search:closed',
      handler: _onSearchClosed,
    });
  }

  attachChatEvents() {
    if (!this.dom.window) return;

    const _onCloseBtnClick = (e) => {
      e.stopPropagation();
      this.toggleChat(false);
    };
    this.dom.closeBtn.addEventListener('click', _onCloseBtnClick);
    this._eventListeners.dom.push({
      target: this.dom.closeBtn,
      event: 'click',
      handler: _onCloseBtnClick,
    });

    if (this.dom.sendBtn) {
      const _onSendBtn = () => this.handleUserMessage();
      this.dom.sendBtn.addEventListener('click', _onSendBtn);
      this._eventListeners.dom.push({
        target: this.dom.sendBtn,
        event: 'click',
        handler: _onSendBtn,
      });
    }

    if (this.dom.input) {
      const _onInputKeypress = (e) => {
        if (e.key === 'Enter') this.handleUserMessage();
      };
      this.dom.input.addEventListener('keypress', _onInputKeypress);
      this._eventListeners.dom.push({
        target: this.dom.input,
        event: 'keypress',
        handler: _onInputKeypress,
      });

      const _onInputFocus = () => {
        if (this.dom.controls) {
          this.dom.controls.classList.add('hide-controls-mobile');
        }
      };
      this.dom.input.addEventListener('focus', _onInputFocus);
      this._eventListeners.dom.push({
        target: this.dom.input,
        event: 'focus',
        handler: _onInputFocus,
      });

      const _onInputBlur = () => {
        setTimeout(() => {
          if (this.dom.controls) {
            this.dom.controls.classList.remove('hide-controls-mobile');
          }
        }, 200);
      };
      this.dom.input.addEventListener('blur', _onInputBlur);
      this._eventListeners.dom.push({
        target: this.dom.input,
        event: 'blur',
        handler: _onInputBlur,
      });
    }
  }

  /**
   * Get current page context based on URL and visible sections
   * @returns {import('/content/core/types.js').PageContext}
   */
  getPageContext() {
    try {
      if (this.currentObservedContext) return this.currentObservedContext;

      const path = (window.location && window.location.pathname) || '';
      const file = path.split('/').pop() || '';
      const lower = path.toLowerCase();
      const midY = (window.innerHeight || 0) / 2;

      /**
       * @param {string} selector
       * @returns {boolean}
       */
      const sectionCheck = (selector) => {
        try {
          const el = document.querySelector(selector);
          if (!el) return false;
          const r = el.getBoundingClientRect();
          return r.top <= midY && r.bottom >= midY;
        } catch {
          return false;
        }
      };

      /** @type {import('/content/core/types.js').PageContext} */
      let context = 'default';

      if (sectionCheck('#hero')) context = 'hero';
      else if (sectionCheck('#features')) context = 'features';
      else if (sectionCheck('#section3')) context = 'about';
      else if (sectionCheck('site-footer') || sectionCheck('footer'))
        context = 'footer';
      else if (lower.includes('projekte')) context = 'projects';
      else if (lower.includes('gallery') || lower.includes('fotos'))
        context = 'gallery';
      else if (lower.includes('about') && file !== 'index.html')
        context = 'about';
      else if (lower === '/' || file === 'index.html' || file === '')
        context = 'home';
      else {
        const h1 = document.querySelector('h1');
        if (h1) {
          const h1Text = (h1.textContent || '').toLowerCase();
          if (h1Text.includes('projekt')) context = 'projects';
          else if (h1Text.includes('foto') || h1Text.includes('galerie'))
            context = 'gallery';
        }
      }

      this.trackSectionVisit(context);
      return context;
    } catch {
      return 'default';
    }
  }

  setupSectionObservers() {
    if (this._sectionObserver) return;
    /** @type {Array<{selector: string, ctx: import('/content/core/types.js').PageContext}>} */
    const sectionMap = [
      { selector: '#hero', ctx: 'hero' },
      { selector: '#features', ctx: 'features' },
      { selector: '#section3', ctx: 'about' },
      { selector: 'site-footer', ctx: 'footer' },
      { selector: 'footer', ctx: 'footer' },
    ];

    this._sectionObserver = createObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > 0.35) {
            const match = sectionMap.find((s) =>
              entry.target.matches(s.selector),
            );
            if (match) {
              if (this.currentObservedContext === match.ctx) return;
              this.currentObservedContext = match.ctx;
              // Update state manager
              this.stateManager.setState({ currentContext: match.ctx });
              this.maybeTriggerContextReaction(match.ctx);
            }
          }
        });
      },
      { threshold: [0.35, 0.5, 0.75] },
    );

    sectionMap.forEach((s) => {
      const el = document.querySelector(s.selector);
      if (el && this._sectionObserver) this._sectionObserver.observe(el);
    });
  }

  // Delegated methods to chat module
  /**
   * Fetch and show AI suggestion
   * @returns {Promise<boolean | void>}
   */
  fetchAndShowSuggestion() {
    return this.chatModule.fetchAndShowSuggestion();
  }

  /**
   * Toggle chat window
   * @param {boolean} [force] - Force open/close state
   */
  toggleChat(force) {
    return this.chatModule.toggleChat(force);
  }

  /**
   * Handle avatar click event
   */
  handleAvatarClick() {
    return this.chatModule.handleAvatarClick();
  }

  /**
   * Handle user message submission
   */
  handleUserMessage() {
    return this.chatModule.handleUserMessage();
  }

  /**
   * Add message to chat
   * @param {string} text - Message text
   * @param {'user'|'bot'} type - Message type
   */
  addMessage(text, type) {
    return this.chatModule.addMessage(text, type);
  }

  /**
   * Add option buttons to chat
   * @param {import('/content/core/types.js').ChatOption[]} options - Chat options
   */
  addOptions(options) {
    return this.chatModule.addOptions(options);
  }

  /**
   * Handle chat action
   * @param {string} action - Action identifier
   */
  handleAction(action) {
    return this.chatModule.handleAction(action);
  }

  /**
   * Show bubble message
   * @param {string} text - Bubble text
   */
  showBubble(text) {
    return this.chatModule.showBubble(text);
  }

  /**
   * Hide bubble message
   */
  hideBubble() {
    return this.chatModule.hideBubble();
  }

  /**
   * Scroll chat to bottom
   */
  scrollToBottom() {
    return this.chatModule.scrollToBottom();
  }

  /**
   * Start initial bubble sequence
   */
  startInitialBubbleSequence() {
    return this.chatModule.startInitialBubbleSequence();
  }

  /**
   * Clear bubble sequence
   */
  clearBubbleSequence() {
    return this.chatModule.clearBubbleSequence();
  }

  /**
   * Async initialization - moved out of constructor for testability
   * @returns {Promise<void>}
   */
  async initialize() {
    this.applyTexts();
    if (!this.dom.container) this.init();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener(
    'DOMContentLoaded',
    () => {
      const robot = new RobotCompanion();
      robot
        .initialize()
        .catch((e) =>
          log.error(
            'RobotCompanion init failed: ' +
              (e && e.message ? e.message : String(e)),
          ),
        );
    },
    { once: true },
  );
} else {
  const robot = new RobotCompanion();
  robot
    .initialize()
    .catch((e) =>
      log.error(
        'RobotCompanion init failed: ' +
          (e && e.message ? e.message : String(e)),
      ),
    );
}
