/**
 * KI Roboter Begleiter
 *  * @version 2.0.1
 */
// @ts-check

import { RobotCollision } from './modules/robot-collision.js';
import { RobotAnimation } from './modules/robot-animation.js';
import { RobotChat } from './modules/robot-chat.js';
import { RobotIntelligence } from './modules/robot-intelligence.js';
import { RobotEmotions } from './modules/robot-emotions.js';
import { RobotContextReactions } from './modules/robot-context-reactions.js';
import { createLogger } from '../../core/logger.js';
import { createObserver, TimerManager } from '../../core/utils.js';
import { uiStore } from '../../core/ui-store.js';
import { ROBOT_ACTIONS, ROBOT_EVENTS } from './constants/events.js';
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

  constructor() {
    // Initialize DOM Builder
    /** @type {RobotDOMBuilder} */
    this.domBuilder = new RobotDOMBuilder();

    // Initialize State Manager
    /** @type {RobotStateManager} */
    this.stateManager = new RobotStateManager();

    /** @type {TimerManager} */
    this.timerManager = new TimerManager('RobotCompanion');

    /** @type {import('./ai-agent-service.js').AIAgentService|null} */
    this._agentService = null;
    /** @type {RobotAnimation} */
    this.animationModule = new RobotAnimation(this);
    /** @type {RobotCollision} */
    this.collisionModule = new RobotCollision(this);
    /** @type {RobotChat} */
    this.chatModule = new RobotChat(this);
    /** @type {RobotIntelligence|null} */
    this.intelligenceModule = null;
    /** @type {RobotEmotions} */
    this.emotionsModule = new RobotEmotions(this);
    /** @type {RobotContextReactions} */
    this.contextReactionsModule = new RobotContextReactions(this);

    /** @type {boolean} Flag to prevent footer overlap check from overriding keyboard adjustment */
    this.isKeyboardAdjustmentActive = false;
    /** @type {boolean} Hide local bubble text so chat responses stay Cloudflare-AI only */
    this.disableLocalBubbleTexts = true;

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
    /** @type {IntersectionObserver|null} */
    this._hydrationObserver = null;
    /** @type {TimerID|null} */
    this._hydrationFallbackTimer = null;
    /** @type {boolean} */
    this.isHydrated = false;
    /** @type {(() => void)|null} */
    this._uiUnsubscribe = null;

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
   * Safe requestAnimationFrame wrapper for automatic cleanup
   * @param {Function} callback - Callback function
   * @returns {number} Animation frame ID
   */
  _requestAnimationFrame(callback) {
    return this.timerManager.requestAnimationFrame(callback);
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

  /**
   * Cancel animation frame and remove from registry
   * @param {number} id - Animation frame ID
   */
  _cancelAnimationFrame(id) {
    this.timerManager.cancelAnimationFrame(id);
  }

  /**
   * Lazy load the AI Agent Service (tool-calling, memory, streaming)
   * @returns {Promise<import('./ai-agent-service.js').AIAgentService>}
   */
  async getAgentService() {
    if (!this._agentService) {
      const { AIAgentService } = await import(
        /* webpackIgnore: true */ './ai-agent-service.js'
      );
      this._agentService = new AIAgentService();
    }
    return this._agentService;
  }

  getFooterElement() {
    if (this.dom.footer && document.contains(this.dom.footer)) {
      return this.dom.footer;
    }

    // Prefer the fixed footer inside <site-footer>, then fallback targets.
    this.dom.footer =
      document.querySelector('site-footer .site-footer') ||
      document.querySelector('footer.site-footer') ||
      document.querySelector('site-footer');
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
    this.collisionModule.checkForTypewriterCollision(twRect);
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
        this.chatModule.lastGreetedContext = nextContext;
      }
    }, 2000);
  }

  setupFooterOverlapCheck() {
    let ticking = false;
    const footerEvents = [
      'footer:loaded',
      'footer:expanded',
      'footer:collapsed',
    ];

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

      if (!this.dom.container) {
        ticking = false;
        return;
      }

      // When positioned via 'top' (e.g. gallery), skip footer overlap entirely
      const pageCtx = this.dom.container.dataset.pageContext;
      if (pageCtx === 'gallery') {
        ticking = false;
        return;
      }

      const footerGap = 8;
      this.dom.container.style.removeProperty('bottom');
      const computedBottom = parseFloat(
        getComputedStyle(this.dom.container).bottom,
      );
      const baseBottom = Number.isFinite(computedBottom) ? computedBottom : 30;

      const footer = this.getFooterElement();
      if (!footer) {
        this.dom.container.style.bottom = `${Math.round(baseBottom)}px`;
        ticking = false;
        return;
      }

      const viewportHeight =
        globalThis.innerHeight || document.documentElement.clientHeight || 0;
      const fRect = footer.getBoundingClientRect();
      const anchoredBottom = Math.max(
        baseBottom,
        viewportHeight - fRect.top + footerGap,
      );

      this.dom.container.style.bottom = `${Math.round(anchoredBottom)}px`;

      if (!this.chatModule.isOpen) {
        this.collisionModule.scanForCollisions();
      }
      ticking = false;
      ensureObservedFooter();
    };

    const requestTick = () => {
      if (!ticking) {
        this._requestAnimationFrame(checkOverlap);
        ticking = true;
      }
    };

    if (typeof globalThis !== 'undefined') {
      globalThis.addEventListener('scroll', requestTick, { passive: true });
      globalThis.addEventListener('resize', requestTick, { passive: true });
      footerEvents.forEach((eventName) =>
        document.addEventListener(eventName, requestTick),
      );
      // Registriere Listener für Cleanup
      this._eventListeners.scroll.push({
        target: globalThis,
        handler: requestTick,
      });
      this._eventListeners.resize.push({
        target: globalThis,
        handler: requestTick,
      });
      footerEvents.forEach((eventName) => {
        this._eventListeners.dom.push({
          target: document,
          event: eventName,
          handler: requestTick,
        });
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
          this.dom.window.style.bottom = '';
          this.dom.window.style.top = '';
          this.dom.window.style.maxHeight = '';
          this.dom.window.classList.remove('keyboard-open');
          document.body.classList.remove('robot-keyboard-open');
        }
        return;
      }

      const visualViewport = globalThis.visualViewport;
      if (!visualViewport) return;

      // Use visualViewport properties to perfectly track iOS Safari's shifting layout
      const visualHeight = visualViewport.height;
      const visualOffsetTop = visualViewport.offsetTop;
      const layoutHeight = globalThis.innerHeight;

      const isInputFocused = document.activeElement === this.dom.input;
      const heightDiff = layoutHeight - visualHeight;

      // Threshold: > 150px difference usually implies keyboard.
      // Also trigger if input is focused and there is a measurable offset/height change.
      const isKeyboardOverlay =
        heightDiff > 150 ||
        (isInputFocused && (heightDiff > 50 || visualOffsetTop > 0));

      if (isKeyboardOverlay) {
        // Keyboard is open. Keep the chat window exactly framed within the visualViewport.
        this.isKeyboardAdjustmentActive = true;
        this.dom.window.classList.add('keyboard-open');
        document.body.classList.add('robot-keyboard-open');

        const safeMargin = 8;

        // Disable bottom alignment because iOS layout viewport pushes it off screen.
        // Instead, pin exactly from the visualViewport's top.
        this.dom.window.style.bottom = 'auto';
        this.dom.window.style.top = `${visualOffsetTop + safeMargin}px`;

        // Lock max-height to remaining visual space
        const maxWindowHeight = visualHeight - safeMargin * 2;
        this.dom.window.style.maxHeight = `${maxWindowHeight}px`;
        this.dom.window.style.height = `${maxWindowHeight}px`;

        // Scroll to bottom immediately so the input remains visible
        this._setTimeout(() => this.chatModule.scrollToBottom(), 10);
      } else {
        // Keyboard is closed
        this.isKeyboardAdjustmentActive = false;
        this.dom.window.classList.remove('keyboard-open');
        document.body.classList.remove('robot-keyboard-open');

        // Reset styles to allow CSS / footer overlap logic to take over
        this.dom.container.style.bottom = '';
        this.dom.window.style.bottom = '';
        this.dom.window.style.top = '';
        this.dom.window.style.maxHeight = '';
        this.dom.window.style.height = '';
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
      const blurHandler = () => this._setTimeout(handleResize, 200);
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
    this.setupSharedUIStateSync();
    this.setupProgressiveHydration();
  }

  setupSharedUIStateSync() {
    if (this._uiUnsubscribe) return;

    const syncFromUIState = (state) => {
      if (!this.dom.container) return;
      const menuOpen = Boolean(state?.menuOpen);

      this.dom.container.classList.toggle(
        'robot-companion--menu-open',
        menuOpen,
      );
      if (!menuOpen) return;

      this.chatModule.hideBubble();
      if (this.chatModule.isOpen) {
        this.toggleChat(false);
      }
    };

    this._uiUnsubscribe = uiStore.subscribe(syncFromUIState);
  }

  setupProgressiveHydration() {
    if (!this.dom.container || this.isHydrated) return;

    this.dom.container.dataset.hydrated = 'false';

    const hydrateNow = () => {
      if (this.isHydrated) return;
      if (this._hydrationObserver) {
        this._hydrationObserver.disconnect();
        this._hydrationObserver = null;
      }
      if (this._hydrationFallbackTimer) {
        this._clearTimeout(this._hydrationFallbackTimer);
        this._hydrationFallbackTimer = null;
      }
      this.hydrateInteractiveFeatures();
    };

    if (
      typeof globalThis !== 'undefined' &&
      'IntersectionObserver' in globalThis
    ) {
      this._hydrationObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              hydrateNow();
            }
          });
        },
        {
          rootMargin: '180px 0px',
          threshold: [0.01, 0.2],
        },
      );
      this._hydrationObserver.observe(this.dom.container);
      this._hydrationFallbackTimer = /** @type {TimerID} */ (
        this._setTimeout(hydrateNow, 7000)
      );
      return;
    }

    hydrateNow();
  }

  hydrateInteractiveFeatures() {
    if (this.isHydrated || !this.dom.container) return;
    this.isHydrated = true;
    this.dom.container.dataset.hydrated = 'true';

    if (!this.intelligenceModule) {
      this.intelligenceModule = new RobotIntelligence(this);
    }

    this.attachEvents();
    this.setupFooterOverlapCheck();
    this.setupMobileViewportHandler();

    this._setTimeout(() => {
      const ctx = this.getPageContext();
      if (!this.chatModule.isOpen && !this.chatModule.lastGreetedContext) {
        this.chatModule.lastGreetedContext = ctx;
      }
    }, 5000);

    this.setupSectionChangeDetection();
    this.setupPageContextMorphing();

    // Start context-aware reactions monitoring
    this._setTimeout(() => {
      this.contextReactionsModule.startMonitoring();
      this.contextReactionsModule.setupIdleReaction(60000);
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

    uiStore.setState({ robotHydrated: true });
  }

  setupSectionChangeDetection() {
    this.setupSectionObservers();
    this._lastKnownContext = this.getPageContext();

    let rafPending = false;
    this._scrollListener = () => {
      if (rafPending) return;
      rafPending = true;

      this._requestAnimationFrame(() => {
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

  /**
   * View Transitions Morphing – set `data-page-context` on the container so
   * the CSS position rules kick in. During SPA navigations the attribute
   * changes *inside* `document.startViewTransition()`, which causes the
   * browser to smoothly morph the robot from old → new position.
   */
  setupPageContextMorphing() {
    // Set initial context immediately
    this._updatePageContextAttribute();

    // Re-evaluate after every SPA page swap dispatched by view-transitions.js
    /** @type {() => void} */
    const onPageChanged = () => this._updatePageContextAttribute();

    window.addEventListener('page:changed', onPageChanged, { passive: true });
    this._eventListeners.dom.push({
      target: window,
      event: 'page:changed',
      handler: onPageChanged,
    });
  }

  /**
   * Resolve current page context and apply it as a data attribute.
   * When the context actually changes (SPA navigation), reset patrol
   * and collision state so the robot settles cleanly in its new position.
   * @private
   */
  _updatePageContextAttribute() {
    const ctx = this.getPageContext();
    const container = this.dom?.container;
    if (!container) return;

    // Map the granular section contexts to the broader page-level ones
    // used in the CSS morph rules.
    /** @type {Record<string, string>} */
    const contextMap = {
      hero: 'home',
      features: 'home',
      home: 'home',
      projects: 'projects',
      about: 'about',
      gallery: 'gallery',
      blog: 'blog',
      videos: 'videos',
      contact: 'contact',
      legal: 'legal',
      footer: 'home', // keep default position when at footer
      default: 'home',
    };

    const mapped = contextMap[ctx] || 'home';
    const prev = container.dataset.pageContext;

    if (prev !== mapped) {
      container.dataset.pageContext = mapped;

      // Clear typewriter ref – it may not exist on the new page
      this._typeWriterEl = null;

      // Reset patrol to prevent leftover offsets from the old page
      if (this.animationModule) {
        this.animationModule.patrol.x = 0;
        this.animationModule.patrol.y = 0;
        this.animationModule.patrol.isPaused = false;
        container.style.transform = 'translate3d(0px, 0px, 0)';

        // When returning to home via SPA navigation, re-trigger entry animation.
        // Skip initial load (prev === undefined) — the hydration callback handles that.
        if (mapped === 'home' && prev !== undefined) {
          this._setTimeout(() => {
            this.animationModule.startTypeWriterKnockbackAnimation();
          }, 300);
        }
      }

      // Invalidate collision caches
      if (this.collisionModule) {
        this.collisionModule._lastCollisionCheck = 0;
        this.collisionModule._lastObstacleUpdate = 0;
      }

      log.debug('Robot morph context →', mapped);
    }
  }

  destroy() {
    // Module Cleanup
    this.chatModule?.destroy();
    this.animationModule?.destroy();
    this.intelligenceModule?.destroy();
    this.collisionModule?.destroy();
    this.contextReactionsModule?.destroy();
    if (this.emotionsModule?.destroy) this.emotionsModule.destroy();

    if (this._uiUnsubscribe) {
      this._uiUnsubscribe();
      this._uiUnsubscribe = null;
    }

    if (this._hydrationObserver) {
      this._hydrationObserver.disconnect();
      this._hydrationObserver = null;
    }
    if (this._hydrationFallbackTimer) {
      this._clearTimeout(this._hydrationFallbackTimer);
      this._hydrationFallbackTimer = null;
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
    uiStore.setState({ robotHydrated: false, robotChatOpen: false });

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
    if (hour >= 10 && hour < 17) {
      return sessions > 10 || interactions > 50 ? 'enthusiastic' : 'energetic';
    }
    if (hour >= 17 && hour < 22) return 'relaxed';
    return 'night-owl';
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
    // flame colours may need adjustment after DOM creation
    anim.ensureFlameColors();
    this._requestAnimationFrame(() => anim.startIdleEyeMovement());
  }

  ensureChatWindowCreated() {
    if (this.dom.window) return;

    const chatWindow = this.domBuilder.createChatWindow();
    document.body.appendChild(chatWindow);

    this.dom.window = chatWindow;
    this.dom.messages = document.getElementById('robot-messages');
    this.dom.inputArea = document.getElementById('robot-input-area');
    this.dom.input = /** @type {HTMLInputElement} */ (
      document.getElementById('robot-chat-input')
    );
    this.dom.sendBtn = /** @type {HTMLButtonElement} */ (
      document.getElementById('robot-chat-send')
    );
    this.dom.closeBtn = chatWindow.querySelector('.chat-close-btn');
    this.dom.memoriesBtn = /** @type {HTMLButtonElement|null} */ (
      document.getElementById('robot-chat-memories')
    );
    this.dom.deleteUserBtn = /** @type {HTMLButtonElement|null} */ (
      document.getElementById('robot-chat-delete-user')
    );

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
    const _onHistoryCleared = () => {
      this.chatModule.clearHistory();
    };
    document.addEventListener('robot:history:cleared', _onHistoryCleared);

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
    this._eventListeners.dom.push({
      target: document,
      event: 'robot:history:cleared',
      handler: _onHistoryCleared,
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
      const _onInputKeydown = (e) => {
        if (e.isComposing) return;
        if (e.key === 'Enter') {
          e.preventDefault();
          this.handleUserMessage();
        }
      };
      this.dom.input.addEventListener('keydown', _onInputKeydown);
      this._eventListeners.dom.push({
        target: this.dom.input,
        event: 'keydown',
        handler: _onInputKeydown,
      });

      const _onInput = () => this.chatModule.syncComposerState();
      this.dom.input.addEventListener('input', _onInput);
      this._eventListeners.dom.push({
        target: this.dom.input,
        event: 'input',
        handler: _onInput,
      });
    }

    if (this.dom.memoriesBtn) {
      const _onMemoriesBtnClick = () =>
        this.chatModule.handleAction(ROBOT_ACTIONS.SHOW_MEMORIES);
      this.dom.memoriesBtn.addEventListener('click', _onMemoriesBtnClick);
      this._eventListeners.dom.push({
        target: this.dom.memoriesBtn,
        event: 'click',
        handler: _onMemoriesBtnClick,
      });
    }

    if (this.dom.deleteUserBtn) {
      const _onDeleteUserBtnClick = () =>
        this.chatModule.handleAction(ROBOT_ACTIONS.DELETE_CLOUDFLARE_USER);
      this.dom.deleteUserBtn.addEventListener('click', _onDeleteUserBtnClick);
      this._eventListeners.dom.push({
        target: this.dom.deleteUserBtn,
        event: 'click',
        handler: _onDeleteUserBtnClick,
      });
    }

    // Image upload handling
    const imageUploadInput = document.getElementById('robot-image-upload');
    const imageBtn = document.getElementById('robot-image-btn');

    if (imageBtn && imageUploadInput) {
      const _onImageBtnClick = () => imageUploadInput.click();
      imageBtn.addEventListener('click', _onImageBtnClick);
      this._eventListeners.dom.push({
        target: imageBtn,
        event: 'click',
        handler: _onImageBtnClick,
      });

      const _onImageChange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
          this.chatModule.handleImageUpload(file);
          /** @type {HTMLInputElement} */ (imageUploadInput).value = ''; // Reset for re-upload
        }
      };
      imageUploadInput.addEventListener('change', _onImageChange);
      this._eventListeners.dom.push({
        target: imageUploadInput,
        event: 'change',
        handler: _onImageChange,
      });
    }

    this.chatModule.syncComposerState();
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
      else if (lower.includes('videos')) context = 'videos';
      else if (lower.includes('blog')) context = 'blog';
      else if (lower.includes('contact') || lower.includes('kontakt'))
        context = 'contact';
      else if (lower.includes('datenschutz') || lower.includes('impressum'))
        context = 'legal';
      else if (lower.includes('about') || lower.includes('abdul-sesli')) {
        if (file !== 'index.html') context = 'about';
      } else if (lower === '/' || file === 'index.html' || file === '')
        context = 'home';
      else {
        const h1 = document.querySelector('h1');
        if (h1) {
          const h1Text = (h1.textContent || '').toLowerCase();
          if (h1Text.includes('projekt')) context = 'projects';
          else if (h1Text.includes('foto') || h1Text.includes('galerie'))
            context = 'gallery';
          else if (h1Text.includes('video')) context = 'videos';
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

  // ─── Chat Module Proxy Methods (used by collision/animation/intelligence modules) ───
  toggleChat(force) {
    return this.chatModule.toggleChat(force);
  }
  handleAvatarClick() {
    return this.chatModule.handleAvatarClick();
  }
  handleUserMessage() {
    return this.chatModule.handleUserMessage();
  }
  addMessage(text, type) {
    return this.chatModule.addMessage(text, type);
  }
  handleAction(action) {
    return this.chatModule.handleAction(action);
  }
  showBubble(text) {
    return this.chatModule.showBubble(text);
  }
  hideBubble() {
    return this.chatModule.hideBubble();
  }
  scrollToBottom() {
    return this.chatModule.scrollToBottom();
  }
  clearBubbleSequence() {
    return this.chatModule.clearBubbleSequence();
  }

  /**
   * Async initialization - moved out of constructor for testability
   * @returns {Promise<void>}
   */
  async initialize() {
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
