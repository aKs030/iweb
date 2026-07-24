/**
 * KI Roboter Begleiter
 * @version 2.0.1
 */

/**
 * @typedef {import('../../core/types.js').DOMCache} DOMCache
 * @typedef {import('../../core/types.js').EventListenerRegistry} EventListenerRegistry
 * @typedef {import('../../core/types.js').OverlayController} OverlayController
 * @typedef {import('../../core/types.js').PageContext} PageContext
 * @typedef {import('../../core/types.js').RobotMood} RobotMood
 * @typedef {import('../../core/types.js').TimerID} TimerID
 */

// augment global window with our custom fields
/**
 * @typedef {Window & typeof globalThis & {
 *   ROBOT_USER_NAME?: string;
 *   ROBOT_NO_COOKIES?: boolean | '1';
 * }} RobotWindow
 */

import { RobotAnimation } from "./modules/robot-animation.js";
import { RobotChat } from "./modules/robot-chat.js";
import { createLogger } from "../../core/logger.js";
import { createObserver, loadHeadStylesheet, TimerManager } from "../../core/utils/index.js";
import { activeOverlay } from "../../core/state/overlay-state.js";
import {
  closeOverlay,
  OVERLAY_MODES,
  initOverlayManager,
  registerOverlayController,
} from "../../core/overlay-manager.js";
import { ROBOT_EVENTS } from "./constants/events.js";
import { RobotStateManager } from "./state/RobotStateManager.js";
import { RobotDOMBuilder } from "./dom/RobotDOMBuilder.js";
import {
  clearRobotUserName,
  getRobotUserName,
  hydrateRobotUserNameFromUrl,
  writeRobotUserName,
} from "./modules/name-identity.js";

const log = createLogger("RobotCompanion");
const ROBOT_BASE_CSS_URL = "/content/components/robot-companion/robot-companion.css";
const ROBOT_BASE_CSS_URLS = [
  "/content/components/robot-companion/styles/theme.css",
  "/content/components/robot-companion/styles/layout.css",
  "/content/components/robot-companion/styles/avatar.css",
  ROBOT_BASE_CSS_URL,
];
const ROBOT_CHAT_CSS_URL = "/content/components/robot-companion/styles/chat.css";
const ROBOT_MOTION_CSS_URL = "/content/components/robot-companion/styles/animations.css";
const ROBOT_HIDDEN_STORAGE_KEY = "robot-companion-hidden";

/**
 * Robot Companion Class
 * Main controller for the AI robot companion
 */
export class RobotCompanion {
  containerId = "robot-companion-container";

  constructor() {
    // Initialize DOM Builder
    /** @type {RobotDOMBuilder} */
    this.domBuilder = new RobotDOMBuilder();

    // Initialize State Manager
    /** @type {RobotStateManager} */
    this.stateManager = new RobotStateManager();

    /** @type {TimerManager} */
    this.timerManager = new TimerManager("RobotCompanion");

    /** @type {any} */
    this._agentService = null;
    /** @type {Promise<any>|null} */
    this._agentFeaturesPromise = null;
    /** @type {Promise<any>|null} */
    this._intelligenceModulePromise = null;
    /** @type {Promise<void>|null} */
    this._interactiveModulesPromise = null;
    /** @type {Promise<any>|null} */
    this._baseStylesPromise = null;
    /** @type {Promise<any>|null} */
    this._chatStylesPromise = null;
    /** @type {Promise<any>|null} */
    this._motionStylesPromise = null;
    /** @type {string} */
    this._agentIdentitySyncedFor = "";
    /** @type {boolean} */
    this._imageUploadHydrated = false;
    /** @type {RobotAnimation} */
    this.animationModule = new RobotAnimation(this);
    /** @type {import('./modules/robot-collision.js').RobotCollision|null} */
    this.collisionModule = null;
    /** @type {RobotChat} */
    this.chatModule = new RobotChat(this);
    /** @type {import('./modules/robot-intelligence.js').RobotIntelligence|null} */
    this.intelligenceModule = null;
    /** @type {import('./modules/robot-emotions.js').RobotEmotions|null} */
    this.emotionsModule = null;
    /** @type {import('./modules/robot-context-reactions.js').RobotContextReactions|null} */
    this.contextReactionsModule = null;

    /** @type {boolean} Flag to prevent footer overlap check from overriding keyboard adjustment */
    this.isKeyboardAdjustmentActive = false;
    /** @type {boolean} Hide local bubble text so chat responses stay Cloudflare-AI only */
    this.disableLocalBubbleTexts = true;

    /** @type {number} Store initial layout height for detecting keyboard */
    this.initialLayoutHeight = typeof globalThis !== "undefined" ? globalThis.innerHeight : 0;

    /** @type {PageContext|null} */
    this.currentObservedContext = null;
    /** @type {ReturnType<typeof createObserver>|null} */
    this._sectionObserver = null;
    /** @type {ResizeObserver|null} */
    this._footerLayoutObserver = null;
    /** @type {Element|null} */
    this._observedFooterEl = null;
    /** @type {PageContext|null} */
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
    this._overlayStateCleanup = null;
    /** @type {(() => void)|null} */
    this._overlayControllerCleanup = null;
    /** @type {EventListener|null} */
    this._handleViewportResize = null;
    /** @type {EventListener|null} */
    this._onHeroTypingEnd = null;
    /** @type {EventListener|null} */
    this._scrollListener = null;
    /** @type {EventListener|null} */
    this._contentCollisionHandler = null;

    /** @type {EventListenerRegistry} */
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

    /** @type {TimerID | null} */
    this._scrollTimeout = null;

    // Load analytics from storage and calculate mood
    if (typeof this.stateManager.loadFromStorage === "function") {
      this.stateManager.loadFromStorage();
    }
    const mood = this.calculateMood();
    this.stateManager.setState({ mood });

    // Only hydrate identity from the URL here. Agent/network sync is deferred
    // until the first real AI interaction.
    this.hydrateNameFromUrl();

    /** @type {Set<string>} */
    this.easterEggFound = new Set(JSON.parse(localStorage.getItem("robot-easter-eggs") || "[]"));

    /** @type {DOMCache} */
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
   * @returns {Promise<any>}
   */
  async getAgentService() {
    if (!this._agentService) {
      const { AIAgentService } = await import(/* webpackIgnore: true */ "./ai-agent-service.js");
      this._agentService = new AIAgentService();
    }
    return this._agentService;
  }

  hydrateNameFromUrl() {
    return hydrateRobotUserNameFromUrl().name;
  }

  async syncIdentityToAgentService(agentService = null) {
    const currentName = getRobotUserName();
    if (!currentName || this._agentIdentitySyncedFor === currentName) {
      return currentName;
    }

    try {
      const service = agentService || (await this.getAgentService());
      service?.setUserName?.(currentName);
      const rememberPromise = service?.remember?.("name", currentName);
      if (rememberPromise && typeof rememberPromise.catch === "function") {
        await rememberPromise.catch(() => {});
      }
      this._agentIdentitySyncedFor = currentName;
      return currentName;
    } catch {
      return currentName;
    }
  }

  async ensureIntelligenceModule() {
    if (this.intelligenceModule) {
      return this.intelligenceModule;
    }

    if (!this._intelligenceModulePromise) {
      this._intelligenceModulePromise = import("./modules/robot-intelligence.js")
        .then(({ RobotIntelligence }) => {
          this.intelligenceModule = new RobotIntelligence(this);
          return this.intelligenceModule;
        })
        .catch(error => {
          this._intelligenceModulePromise = null;
          throw error;
        });
    }

    return this._intelligenceModulePromise;
  }

  async ensureInteractiveModules() {
    if (this._interactiveModulesPromise) {
      return this._interactiveModulesPromise;
    }

    this._interactiveModulesPromise = Promise.all([
      this.collisionModule
        ? Promise.resolve(this.collisionModule)
        : import("./modules/robot-collision.js").then(({ RobotCollision }) => {
            this.collisionModule = new RobotCollision(this);
            return this.collisionModule;
          }),
      this.emotionsModule
        ? Promise.resolve(this.emotionsModule)
        : import("./modules/robot-emotions.js").then(({ RobotEmotions }) => {
            this.emotionsModule = new RobotEmotions(this);
            return this.emotionsModule;
          }),
      this.contextReactionsModule
        ? Promise.resolve(this.contextReactionsModule)
        : import("./modules/robot-context-reactions.js").then(({ RobotContextReactions }) => {
            this.contextReactionsModule = new RobotContextReactions(this);
            return this.contextReactionsModule;
          }),
    ])
      .then(() => {})
      .catch(error => {
        this._interactiveModulesPromise = null;
        throw error;
      });

    return this._interactiveModulesPromise;
  }

  async prepareAgentFeatures() {
    if (!this._agentFeaturesPromise) {
      this._agentFeaturesPromise = Promise.all([
        this.ensureIntelligenceModule(),
        this.getAgentService(),
      ])
        .then(([, agentService]) => agentService)
        .catch(error => {
          this._agentFeaturesPromise = null;
          throw error;
        });
    }

    const agentService = await this._agentFeaturesPromise;
    await this.syncIdentityToAgentService(agentService);
    return agentService;
  }

  /**
   * Ensure a user name is present, falling back to URL parameter and
   * prompting if necessary.  If a new name is chosen we'll also update
   * the query string so the link can be shared between browsers.
   */
  async setUserName(name, options = {}) {
    const { persist = true } = options;
    const { name: norm } = writeRobotUserName(name, { syncUrl: true });
    if (!norm) return "";

    this._agentIdentitySyncedFor = "";

    if (persist) {
      try {
        await this.prepareAgentFeatures();
      } catch {
        /* ignore */
      }
    }

    return norm;
  }

  async clearUserName(options = {}) {
    const { clearUrl = true } = options;
    clearRobotUserName({ clearUrl });
    this._agentIdentitySyncedFor = "";

    try {
      this._agentService?.clearUserIdentity?.({ clearUrl: false });
    } catch {
      /* ignore */
    }

    return "";
  }

  async ensureName() {
    const existing = getRobotUserName();
    if (existing) return existing;
    return this.hydrateNameFromUrl();
  }

  getFooterElement() {
    if (this.dom.footer && document.contains(this.dom.footer)) {
      return this.dom.footer;
    }

    // Prefer the fixed footer inside <site-footer>, then fallback targets.
    this.dom.footer =
      document.querySelector("site-footer .site-footer") ||
      document.querySelector("footer.site-footer") ||
      document.querySelector("site-footer");
    return this.dom.footer || null;
  }

  getTypewriterElement() {
    if (this._typeWriterEl && document.contains(this._typeWriterEl)) {
      return this._typeWriterEl;
    }

    this._typeWriterEl = document.querySelector(".typewriter-title");
    return this._typeWriterEl || null;
  }

  checkTypewriterCollision() {
    const typeWriter = this.getTypewriterElement();
    if (!typeWriter || !this.dom?.container || !this.collisionModule) return;

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
    const footerEvents = ["footer:loaded", "footer:expanded", "footer:collapsed"];

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
      if (this.animationModule.searchAnimation && this.animationModule.searchAnimation.active) {
        // Ensure bottom is reset so transform works from base position
        if (this.dom.container.style.bottom) {
          this.dom.container.style.bottom = "";
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
      if (pageCtx === "gallery") {
        ticking = false;
        return;
      }

      const footerGap = 8;
      this.dom.container.style.removeProperty("bottom");
      const computedBottom = parseFloat(getComputedStyle(this.dom.container).bottom);
      const baseBottom = Number.isFinite(computedBottom) ? computedBottom : 30;

      const footer = this.getFooterElement();
      if (!footer) {
        this.dom.container.style.bottom = `${Math.round(baseBottom)}px`;
        ticking = false;
        return;
      }

      const viewportHeight = globalThis.innerHeight || document.documentElement.clientHeight || 0;
      const fRect = footer.getBoundingClientRect();
      const anchoredBottom = Math.max(baseBottom, viewportHeight - fRect.top + footerGap);

      this.dom.container.style.bottom = `${Math.round(anchoredBottom)}px`;

      if (!this.chatModule.isOpen && this.collisionModule) {
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

    if (typeof globalThis !== "undefined") {
      globalThis.addEventListener("scroll", requestTick, { passive: true });
      globalThis.addEventListener("resize", requestTick, { passive: true });
      footerEvents.forEach(eventName => document.addEventListener(eventName, requestTick));
      // Registriere Listener für Cleanup
      this._eventListeners.scroll.push({
        target: globalThis,
        handler: requestTick,
      });
      this._eventListeners.resize.push({
        target: globalThis,
        handler: requestTick,
      });
      footerEvents.forEach(eventName => {
        this._eventListeners.dom.push({
          target: document,
          event: eventName,
          handler: requestTick,
        });
      });
    }

    if (typeof ResizeObserver !== "undefined") {
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

  setupContentCollisionAvoidance() {
    if (!this.dom.container || typeof globalThis === "undefined") return;

    let frame = 0;
    const update = () => {
      frame = 0;
      const container = this.dom.container;
      if (!container || globalThis.innerWidth > 640 || this.chatModule.isOpen) {
        container?.classList.remove("robot-companion--content-collision");
        return;
      }

      const robotRect = container.getBoundingClientRect();
      const protectedElements = document.querySelectorAll(
        "main h1, main h2, main form, main [role='search'], main input, main textarea"
      );
      let overlaps = false;

      for (const element of protectedElements) {
        const rect = element.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > globalThis.innerHeight) continue;
        const padding = 12;
        if (
          robotRect.left < rect.right + padding &&
          robotRect.right > rect.left - padding &&
          robotRect.top < rect.bottom + padding &&
          robotRect.bottom > rect.top - padding
        ) {
          overlaps = true;
          break;
        }
      }

      container.classList.toggle("robot-companion--content-collision", overlaps);
    };

    const requestUpdate = () => {
      if (frame) return;
      frame = this._requestAnimationFrame(update);
    };

    this._contentCollisionHandler = requestUpdate;
    globalThis.addEventListener("scroll", requestUpdate, { passive: true });
    globalThis.addEventListener("resize", requestUpdate, { passive: true });
    this._eventListeners.scroll.push({ target: globalThis, handler: requestUpdate });
    this._eventListeners.resize.push({ target: globalThis, handler: requestUpdate });
    requestUpdate();
  }

  setupMobileViewportHandler() {
    if (typeof globalThis === "undefined" || !globalThis.visualViewport) return;

    this._handleViewportResize = () => {
      // Skip if search animation is active
      if (this.animationModule.searchAnimation && this.animationModule.searchAnimation.active) {
        return;
      }

      if (!this.dom.window || !this.dom.container) return;

      // If chat is closed, ensure we clean up state and do nothing else
      if (!this.chatModule.isOpen) {
        if (this.isKeyboardAdjustmentActive) {
          this.isKeyboardAdjustmentActive = false;
          this.dom.container.style.bottom = "";
          this.dom.window.style.bottom = "";
          this.dom.window.style.maxHeight = "";
        }
        return;
      }

      // Use initialLayoutHeight if available to detect shrink-resize behaviors
      const referenceHeight =
        this.initialLayoutHeight ||
        (typeof globalThis !== "undefined" ? globalThis.innerHeight : 0);
      const visualHeight =
        typeof globalThis !== "undefined" && globalThis.visualViewport
          ? globalThis.visualViewport.height
          : referenceHeight;
      const heightDiff = referenceHeight - visualHeight;
      const isInputFocused = document.activeElement === this.dom.input;

      // Threshold: > 150px difference usually implies keyboard.
      // Also trigger if input is focused and difference is measurable (>50px).
      const isKeyboardOverlay = heightDiff > 150 || (isInputFocused && heightDiff > 50);

      if (isKeyboardOverlay) {
        // Keyboard is open (overlay mode or partial resize).
        // Keep the chat window above the keyboard area.
        this.isKeyboardAdjustmentActive = true;

        const safeMargin = 10;
        const maxWindowHeight = visualHeight - safeMargin * 2;
        this.dom.window.style.maxHeight = `${maxWindowHeight}px`;
        this.dom.window.style.bottom = `${Math.max(8, heightDiff + safeMargin)}px`;
      } else {
        // Keyboard is closed
        this.isKeyboardAdjustmentActive = false;

        // Reset styles to allow CSS / footer overlap logic to take over
        this.dom.container.style.bottom = "";
        this.dom.window.style.bottom = "";
        this.dom.window.style.maxHeight = "";
      }
    };

    if (typeof globalThis !== "undefined" && globalThis.visualViewport) {
      globalThis.visualViewport.addEventListener("resize", this._handleViewportResize);
      globalThis.visualViewport.addEventListener("scroll", this._handleViewportResize);
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
      this.dom.input.addEventListener("focus", handleResize);
      this.dom.input.addEventListener("blur", blurHandler);
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

    initOverlayManager();
    this.loadCSS();
    this.createDOM();
    this.registerOverlayController();
    this.setupOverlayStateSync();
    this.setupProgressiveHydration();
  }

  registerOverlayController() {
    if (this._overlayControllerCleanup) return;

    /** @type {OverlayController} */
    const robotOverlayController = {
      open: () => this.chatModule.applyOverlayState(true),
      close: ({ restoreFocus = true } = {}) => {
        if (!this.chatModule.isOpen) return;
        return this.chatModule.applyOverlayState(false, { restoreFocus });
      },
      getInteractiveRoots: () => {
        return [this.dom.window, this.dom.container].filter(
          element => element instanceof HTMLElement && element.isConnected
        );
      },
      getFocusTrapRoots: () => {
        return [this.dom.window].filter(
          element => element instanceof HTMLElement && element.isConnected
        );
      },
      getPrimaryFocusTarget: () => {
        const target = this.dom.input || this.dom.closeBtn || this.dom.window || null;
        return target instanceof HTMLElement && target.isConnected ? target : null;
      },
      getRestoreFocusTarget: () => {
        const avatar = this.dom.avatar;
        return avatar instanceof HTMLElement && avatar.isConnected ? avatar : null;
      },
    };

    this._overlayControllerCleanup = registerOverlayController(
      OVERLAY_MODES.ROBOT_CHAT,
      robotOverlayController
    );
  }

  setupOverlayStateSync() {
    if (this._overlayStateCleanup) return;

    const syncOverlayState = mode => {
      if (!this.dom.container) return;
      const menuOpen = mode === OVERLAY_MODES.MENU;

      this.dom.container.classList.toggle("robot-companion--menu-open", menuOpen);
      if (menuOpen) {
        this.chatModule.hideBubble();
      }

      if (this.chatModule.isOpen && mode !== OVERLAY_MODES.ROBOT_CHAT) {
        void this.chatModule.applyOverlayState(false, { restoreFocus: false });
      }
    };

    this._overlayStateCleanup = activeOverlay.subscribe(syncOverlayState);
  }

  setupProgressiveHydration() {
    if (!this.dom.container || this.isHydrated) return;

    this.dom.container.dataset.hydrated = "false";

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
      void this.hydrateInteractiveFeatures();
    };

    if (typeof globalThis !== "undefined" && "IntersectionObserver" in globalThis) {
      this._hydrationObserver = new IntersectionObserver(
        entries => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              hydrateNow();
            }
          });
        },
        {
          rootMargin: "180px 0px",
          threshold: [0.01, 0.2],
        }
      );
      this._hydrationObserver.observe(this.dom.container);
      this._hydrationFallbackTimer = /** @type {TimerID} */ (this._setTimeout(hydrateNow, 7000));
      return;
    }

    hydrateNow();
  }

  async hydrateInteractiveFeatures() {
    if (this.isHydrated || !this.dom.container) return;
    this.isHydrated = true;
    this.dom.container.dataset.hydrated = "true";

    try {
      await this.ensureInteractiveModules();
    } catch (error) {
      log.warn("RobotCompanion: interactive module hydration failed", error);
    }

    this.attachEvents();
    if (this.collisionModule) {
      this.setupFooterOverlapCheck();
    }
    this.setupContentCollisionAvoidance();
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
      this.contextReactionsModule?.startMonitoring?.();
      this.contextReactionsModule?.setupIdleReaction?.(60000);
    }, 3000);

    if (this.collisionModule) {
      this._setTimeout(() => {
        this.animationModule.startTypeWriterKnockbackAnimation();
      }, 50);
    }

    this._onHeroTypingEnd = () => {
      try {
        this.checkTypewriterCollision();
      } catch (err) {
        log.warn("RobotCompanion: hero typing end handler failed", err);
      }
    };
    document.addEventListener(ROBOT_EVENTS.HERO_TYPING_END, this._onHeroTypingEnd);
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
              log.warn("RobotCompanion: scroll handler collision check failed", err);
            }
          }, 220)
        );
      });
    };

    if (typeof globalThis !== "undefined") {
      globalThis.addEventListener("scroll", this._scrollListener, {
        passive: true,
      });
      // Registriere Listener für Cleanup
      this._eventListeners.scroll.push({
        target: globalThis,
        handler: this._scrollListener,
      });
    }

    const _onNavContextCheck = () => this.maybeTriggerContextReaction();
    window.addEventListener("hashchange", _onNavContextCheck, {
      passive: true,
    });
    window.addEventListener("popstate", _onNavContextCheck, { passive: true });
    this._eventListeners.dom.push({
      target: window,
      event: "hashchange",
      handler: _onNavContextCheck,
    });
    this._eventListeners.dom.push({
      target: window,
      event: "popstate",
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

    window.addEventListener("page:changed", onPageChanged, { passive: true });
    this._eventListeners.dom.push({
      target: window,
      event: "page:changed",
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
      hero: "home",
      features: "home",
      home: "home",
      projects: "projects",
      about: "about",
      gallery: "gallery",
      blog: "blog",
      videos: "videos",
      contact: "contact",
      legal: "legal",
      footer: "home", // keep default position when at footer
      default: "home",
    };

    const mapped = contextMap[ctx] || "home";
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
        container.style.transform = "translate3d(0px, 0px, 0)";

        // When returning to home via SPA navigation, re-trigger entry animation.
        // Skip initial load (prev === undefined) — the hydration callback handles that.
        if (mapped === "home" && prev !== undefined && this.collisionModule) {
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

      log.debug("Robot morph context →", mapped);
    }
  }

  destroy() {
    void closeOverlay(OVERLAY_MODES.ROBOT_CHAT, {
      reason: "component-disconnect",
      restoreFocus: false,
    });

    // Module Cleanup
    this.chatModule?.destroy();
    this.animationModule?.destroy();
    this.intelligenceModule?.destroy();
    this.collisionModule?.destroy();
    this.contextReactionsModule?.destroy();
    if (this.emotionsModule?.destroy) this.emotionsModule.destroy();
    this._imageUploadHydrated = false;
    this._agentFeaturesPromise = null;
    this._intelligenceModulePromise = null;
    this._interactiveModulesPromise = null;
    this._agentIdentitySyncedFor = "";

    if (this._overlayStateCleanup) {
      this._overlayStateCleanup();
      this._overlayStateCleanup = null;
    }
    if (this._overlayControllerCleanup) {
      this._overlayControllerCleanup();
      this._overlayControllerCleanup = null;
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
    // Zentrale Event-Listener Cleanup
    if (this._eventListeners) {
      // Scroll Listeners
      this._eventListeners.scroll.forEach(({ target, handler }) => {
        target.removeEventListener("scroll", handler);
      });

      // Resize Listeners
      this._eventListeners.resize.forEach(({ target, handler }) => {
        target.removeEventListener("resize", handler);
      });

      // Visual Viewport Listeners
      this._eventListeners.visualViewportResize.forEach(({ target, handler }) => {
        target.removeEventListener("resize", handler);
      });
      this._eventListeners.visualViewportScroll.forEach(({ target, handler }) => {
        target.removeEventListener("scroll", handler);
      });

      // Input Listeners
      if (this._eventListeners.inputFocus) {
        const { target, handler } = this._eventListeners.inputFocus;
        target.removeEventListener("focus", handler);
      }
      if (this._eventListeners.inputBlur) {
        const { target, handler } = this._eventListeners.inputBlur;
        target.removeEventListener("blur", handler);
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
   * @returns {RobotMood}
   */
  calculateMood() {
    const hour = new Date().getHours();
    const state = this.stateManager.getState();
    const { sessions, interactions } = state.analytics;

    if (hour >= 0 && hour < 6) return "night-owl";
    if (hour >= 6 && hour < 10) return "sleepy";
    if (hour >= 10 && hour < 17) {
      return sessions > 10 || interactions > 50 ? "enthusiastic" : "energetic";
    }
    if (hour >= 17 && hour < 22) return "relaxed";
    return "night-owl";
  }

  trackInteraction() {
    this.stateManager.trackInteraction();
    const { analytics } = this.stateManager.getState();
    const interactions = analytics.interactions;

    if (interactions === 10 && !this.easterEggFound.has("first-10")) {
      this.unlockEasterEgg(
        "first-10",
        "🎉 Wow, 10 Interaktionen! Du bist hartnäckig! Hier ist ein Geschenk: Ein geheimes Mini-Game wurde freigeschaltet! 🎮"
      );
    }
    if (interactions === 50 && !this.easterEggFound.has("first-50")) {
      this.unlockEasterEgg(
        "first-50",
        "🏆 50 Interaktionen! Du bist ein echter Power-User! Respekt! 💪"
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
    localStorage.setItem("robot-easter-eggs", JSON.stringify([...this.easterEggFound]));
    this.chatModule.showBubble(message);
    this._setTimeout(() => this.chatModule.hideBubble(), 10000);
  }

  /**
   * Track section visit for analytics
   * @param {PageContext} context - Page context
   */
  trackSectionVisit(context) {
    this.stateManager.trackSectionVisit(context);
    const { analytics } = this.stateManager.getState();

    const allSections = ["hero", "features", "section3", "projects", "gallery", "footer"];
    const visitedAll = allSections.every(s => analytics.sectionsVisited.includes(s));
    if (visitedAll && !this.easterEggFound.has("explorer")) {
      this.unlockEasterEgg("explorer", "🗺️ Du hast alle Bereiche erkundet! Echter Explorer! 🧭");
    }
  }

  loadCSS() {
    if (!this._baseStylesPromise) {
      this._baseStylesPromise = Promise.all(
        ROBOT_BASE_CSS_URLS.map(href =>
          loadHeadStylesheet(href, {
            injectedBy: "robot-companion",
          })
        )
      );
    }
    return this._baseStylesPromise;
  }

  loadMotionCSS() {
    if (globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) {
      return Promise.resolve(null);
    }

    if (!this._motionStylesPromise) {
      this._motionStylesPromise = loadHeadStylesheet(ROBOT_MOTION_CSS_URL, {
        injectedBy: "robot-companion-motion",
      });
    }
    return this._motionStylesPromise;
  }

  loadChatCSS() {
    const styles = [];
    if (!this._chatStylesPromise) {
      this._chatStylesPromise = loadHeadStylesheet(ROBOT_CHAT_CSS_URL, {
        injectedBy: "robot-companion-chat",
      });
    }
    styles.push(this._chatStylesPromise);
    styles.push(this.loadMotionCSS());
    return Promise.all(styles);
  }

  createDOM() {
    // Use DOM Builder for XSS-safe element creation
    const container = this.domBuilder.createContainer();
    document.body.appendChild(container);

    // Cache DOM references
    this.dom.container = container;
    this.dom.floatWrapper = container.querySelector(".robot-float-wrapper");
    this.dom.bubble = document.getElementById("robot-bubble");
    this.dom.bubbleText = document.getElementById("robot-bubble-text");
    this.dom.bubbleClose = container.querySelector(".robot-bubble-close");
    this.dom.avatar = container.querySelector(".robot-avatar");
    this.dom.visibilityToggle = container.querySelector(".robot-visibility-toggle");
    this.dom.svg = container.querySelector(".robot-svg");
    this.dom.eyes = container.querySelector(".robot-eyes");
    this.dom.lids = container.querySelectorAll(".robot-lid");
    this.dom.pupils = container.querySelectorAll(".robot-pupil");
    this.dom.antenna = container.querySelector(".robot-antenna-light");
    this.dom.flame = container.querySelector(".robot-flame");
    this.dom.legs = container.querySelector(".robot-legs");
    this.dom.arms = {
      left: container.querySelector(".robot-arm.left"),
      right: container.querySelector(".robot-arm.right"),
    };
    this.dom.particles = container.querySelector(".robot-particles");
    this.dom.thinking = container.querySelector(".robot-thinking");
    this.dom.magnifyingGlass = container.querySelector(".robot-magnifying-glass");
    this.dom.mouth = container.querySelector(".robot-mouth");

    const anim = /** @type {any} */ (this.animationModule);
    // flame colours may need adjustment after DOM creation
    anim.ensureFlameColors();
    this._requestAnimationFrame(() => anim.startIdleEyeMovement());
    this.setRobotHidden(localStorage.getItem(ROBOT_HIDDEN_STORAGE_KEY) === "true", {
      persist: false,
    });
  }

  ensureChatWindowCreated() {
    if (this.dom.window) return;

    const chatWindow = this.domBuilder.createChatWindow();
    document.body.appendChild(chatWindow);

    this.dom.window = chatWindow;
    this.dom.messages = document.getElementById("robot-messages");
    this.dom.inputArea = document.getElementById("robot-input-area");
    this.dom.input = /** @type {HTMLInputElement} */ (document.getElementById("robot-chat-input"));
    this.dom.sendBtn = /** @type {HTMLButtonElement} */ (
      document.getElementById("robot-chat-send")
    );
    this.dom.stopBtn = /** @type {HTMLButtonElement|null} */ (
      document.getElementById("robot-chat-stop")
    );
    this.dom.closeBtn = chatWindow.querySelector(".chat-close-btn");
    this.dom.memoryBtn = /** @type {HTMLButtonElement|null} */ (
      document.getElementById("robot-chat-settings")
    );

    this.attachChatEvents();
    this.setupChatInputViewportHandlers();
  }

  async ensureImageUploadHydrated() {
    if (this._imageUploadHydrated) return true;

    const imageUploadInput = /** @type {HTMLInputElement|null} */ (
      document.getElementById("robot-image-upload")
    );
    if (!imageUploadInput) return false;

    const _onImageChange = e => {
      const file = e.target.files?.[0];
      if (file) {
        this.chatModule.handleImageUpload(file);
        imageUploadInput.value = "";
      }
    };

    imageUploadInput.addEventListener("change", _onImageChange);
    this._eventListeners.dom.push({
      target: imageUploadInput,
      event: "change",
      handler: _onImageChange,
    });

    this._imageUploadHydrated = true;
    return true;
  }

  async openImageUploadPicker() {
    const isReady = await this.ensureImageUploadHydrated();
    if (!isReady) return;

    const imageUploadInput = /** @type {HTMLInputElement|null} */ (
      document.getElementById("robot-image-upload")
    );
    imageUploadInput?.click();
  }

  attachEvents() {
    const _onAvatarClick = () => this.handleAvatarClick();
    this.dom.avatar.addEventListener("click", _onAvatarClick);
    this._eventListeners.dom.push({
      target: this.dom.avatar,
      event: "click",
      handler: _onAvatarClick,
    });

    if (this.dom.visibilityToggle) {
      const _onVisibilityToggle = event => {
        event.stopPropagation();
        this.setRobotHidden(!this.dom.container.classList.contains("robot-companion--hidden"));
      };
      this.dom.visibilityToggle.addEventListener("click", _onVisibilityToggle);
      this._eventListeners.dom.push({
        target: this.dom.visibilityToggle,
        event: "click",
        handler: _onVisibilityToggle,
      });
    }

    const _onBubbleClose = e => {
      e.stopPropagation();
      const ctx = this.getPageContext();
      this.chatModule.lastGreetedContext = ctx;
      this.chatModule.clearBubbleSequence();
      this.chatModule.hideBubble();
    };
    this.dom.bubbleClose.addEventListener("click", _onBubbleClose);
    this._eventListeners.dom.push({
      target: this.dom.bubbleClose,
      event: "click",
      handler: _onBubbleClose,
    });

    // Search Events
    const _onSearchOpened = () => {
      this.animationModule.startSearchAnimation();
    };
    const _onSearchClosed = () => {
      this.animationModule.stopSearchAnimation();
    };

    window.addEventListener("search:opened", _onSearchOpened);
    window.addEventListener("search:closed", _onSearchClosed);

    this._eventListeners.dom.push({
      target: window,
      event: "search:opened",
      handler: _onSearchOpened,
    });
    this._eventListeners.dom.push({
      target: window,
      event: "search:closed",
      handler: _onSearchClosed,
    });
  }

  setRobotHidden(hidden, { persist = true } = {}) {
    if (!this.dom.container) return;
    const isHidden = Boolean(hidden);
    this.dom.container.classList.toggle("robot-companion--hidden", isHidden);

    if (this.dom.visibilityToggle) {
      this.dom.visibilityToggle.textContent = isHidden ? "KI" : "×";
      this.dom.visibilityToggle.setAttribute(
        "aria-label",
        isHidden ? "Roboter wieder einblenden" : "Roboter ausblenden"
      );
      this.dom.visibilityToggle.title = isHidden
        ? "Roboter wieder einblenden"
        : "Roboter ausblenden";
    }

    if (persist) {
      localStorage.setItem(ROBOT_HIDDEN_STORAGE_KEY, String(isHidden));
    }
  }

  attachChatEvents() {
    if (!this.dom.window) return;

    const _onCloseBtnClick = e => {
      e.stopPropagation();
      this.toggleChat(false);
    };
    this.dom.closeBtn.addEventListener("click", _onCloseBtnClick);
    this._eventListeners.dom.push({
      target: this.dom.closeBtn,
      event: "click",
      handler: _onCloseBtnClick,
    });

    if (this.dom.sendBtn) {
      const _onSendBtn = () => this.handleUserMessage();
      this.dom.sendBtn.addEventListener("click", _onSendBtn);
      this._eventListeners.dom.push({
        target: this.dom.sendBtn,
        event: "click",
        handler: _onSendBtn,
      });
    }

    if (this.dom.stopBtn) {
      const _onStopBtn = () => this.chatModule.stopActiveResponse();
      this.dom.stopBtn.addEventListener("click", _onStopBtn);
      this._eventListeners.dom.push({
        target: this.dom.stopBtn,
        event: "click",
        handler: _onStopBtn,
      });
    }

    if (this.dom.input) {
      const _onInputKeydown = e => {
        if (e.isComposing) return;
        if (e.key === "Enter") {
          e.preventDefault();
          this.handleUserMessage();
        }
      };
      this.dom.input.addEventListener("keydown", _onInputKeydown);
      this._eventListeners.dom.push({
        target: this.dom.input,
        event: "keydown",
        handler: _onInputKeydown,
      });

      const _onInput = () => this.chatModule.syncComposerState();
      this.dom.input.addEventListener("input", _onInput);
      this._eventListeners.dom.push({
        target: this.dom.input,
        event: "input",
        handler: _onInput,
      });
    }

    if (this.dom.memoryBtn) {
      const _onMemoryBtnClick = () => {
        void this.chatModule.showMemoryManager();
      };
      this.dom.memoryBtn.addEventListener("click", _onMemoryBtnClick);
      this._eventListeners.dom.push({
        target: this.dom.memoryBtn,
        event: "click",
        handler: _onMemoryBtnClick,
      });
    }

    const imageBtn = document.getElementById("robot-image-btn");

    if (imageBtn) {
      const _onImageBtnClick = () => {
        void this.openImageUploadPicker();
      };
      imageBtn.addEventListener("click", _onImageBtnClick);
      this._eventListeners.dom.push({
        target: imageBtn,
        event: "click",
        handler: _onImageBtnClick,
      });
    }

    this.chatModule.syncComposerState();
  }

  /**
   * Get current page context based on URL and visible sections
   * @returns {PageContext}
   */
  getPageContext() {
    try {
      if (this.currentObservedContext) return this.currentObservedContext;

      const path = (window.location && window.location.pathname) || "";
      const file = path.split("/").pop() || "";
      const lower = path.toLowerCase();
      const midY = (window.innerHeight || 0) / 2;

      /**
       * @param {string} selector
       * @returns {boolean}
       */
      const sectionCheck = selector => {
        try {
          const el = document.querySelector(selector);
          if (!el) return false;
          const r = el.getBoundingClientRect();
          return r.top <= midY && r.bottom >= midY;
        } catch {
          return false;
        }
      };

      /** @type {PageContext} */
      let context = "default";

      if (sectionCheck("#hero")) context = "hero";
      else if (sectionCheck("#features")) context = "features";
      else if (sectionCheck("#section3")) context = "about";
      else if (sectionCheck("site-footer") || sectionCheck("footer")) context = "footer";
      else if (lower.includes("projekte")) context = "projects";
      else if (lower.includes("gallery") || lower.includes("fotos")) context = "gallery";
      else if (lower.includes("videos")) context = "videos";
      else if (lower.includes("blog")) context = "blog";
      else if (lower.includes("contact") || lower.includes("kontakt")) context = "contact";
      else if (lower.includes("datenschutz") || lower.includes("impressum")) context = "legal";
      else if (lower.includes("about") || lower.includes("abdul-sesli")) {
        if (file !== "index.html") context = "about";
      } else if (lower === "/" || file === "index.html" || file === "") context = "home";
      else {
        const h1 = document.querySelector("h1");
        if (h1) {
          const h1Text = (h1.textContent || "").toLowerCase();
          if (h1Text.includes("projekt")) context = "projects";
          else if (h1Text.includes("foto") || h1Text.includes("galerie")) context = "gallery";
          else if (h1Text.includes("video")) context = "videos";
        }
      }

      this.trackSectionVisit(context);
      return context;
    } catch {
      return "default";
    }
  }

  setupSectionObservers() {
    if (this._sectionObserver) return;
    /** @type {Array<{selector: string, ctx: PageContext}>} */
    const sectionMap = [
      { selector: "#hero", ctx: "hero" },
      { selector: "#features", ctx: "features" },
      { selector: "#section3", ctx: "about" },
      { selector: "site-footer", ctx: "footer" },
      { selector: "footer", ctx: "footer" },
    ];

    this._sectionObserver = createObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting && entry.intersectionRatio > 0.35) {
            const match = sectionMap.find(s => entry.target.matches(s.selector));
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
      { threshold: [0.35, 0.5, 0.75] }
    );

    sectionMap.forEach(s => {
      const el = document.querySelector(s.selector);
      if (el && this._sectionObserver) this._sectionObserver.observe(el);
    });
  }

  // ─── Chat Module Proxy Methods (used by collision/animation/intelligence modules) ───
  toggleChat(force) {
    if (force ?? !this.chatModule.isOpen) {
      void this.loadChatCSS();
    }
    return this.chatModule.toggleChat(force);
  }
  handleAvatarClick() {
    void this.loadChatCSS();
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
