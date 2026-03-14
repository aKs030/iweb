/**
 * KI Roboter Begleiter
 *  * @version 2.0.1
 */
// @ts-check

import { RobotCollision } from './modules/robot-collision.js';
import { RobotAnimation } from './modules/robot-animation.js';
import { RobotChat } from './modules/robot-chat.js';
import { RobotEmotions } from './modules/robot-emotions.js';
import { RobotContextReactions } from './modules/robot-context-reactions.js';
import { createLogger } from '../../core/logger.js';
import { TimerManager } from '../../core/utils.js';
import { menuOpen, searchOpen, uiStore } from '../../core/ui-store.js';
import { ROBOT_ACTIONS, ROBOT_EVENTS } from './constants/events.js';
import { RobotStateManager } from './state/RobotStateManager.js';
import { RobotDOMBuilder } from './dom/RobotDOMBuilder.js';
import {
  checkTypewriterCollision,
  getFooterElement,
  getTypewriterElement,
  setupFooterOverlapCheck,
  setupMobileViewportHandler,
  setupChatInputViewportHandlers,
} from './runtime/robot-layout.js';
import {
  getPageContext,
  maybeTriggerContextReaction,
  setupPageContextMorphing,
  setupSectionChangeDetection,
  setupSectionObservers,
  updatePageContextAttribute,
} from './runtime/robot-page-context.js';
import {
  hydrateInteractiveFeatures,
  setupProgressiveHydration,
} from './runtime/robot-hydration.js';

const log = createLogger('RobotCompanion');

/**
 * @typedef {import('../../core/types.js').TimerID} TimerID
 * @typedef {import('../../core/types.js').RobotState} RobotState
 * @typedef {import('../../core/types.js').RobotAnalytics} RobotAnalytics
 * @typedef {import('../../core/types.js').DOMCache} DOMCache
 * @typedef {import('../../core/types.js').EventListenerRegistry} EventListenerRegistry
 * @typedef {import('../../core/types.js').TimerRegistry} TimerRegistry
 * @typedef {import('../../core/types.js').PageContext} PageContext
 * @typedef {import('../../core/types.js').RobotMood} RobotMood
 * @typedef {import('./modules/robot-intelligence.js').RobotIntelligence} RobotIntelligence
 * @typedef {ReturnType<typeof import('../../core/utils.js').createObserver>} ObserverHandle
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

    /** @type {import('../../core/types.js').PageContext|null} */
    this.currentObservedContext = null;
    /** @type {ObserverHandle|null} */
    this._sectionObserver = null;
    /** @type {ResizeObserver|null} */
    this._footerLayoutObserver = null;
    /** @type {Element|null} */
    this._observedFooterEl = null;
    /** @type {import('../../core/types.js').PageContext|null} */
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
    /** @type {(() => void)|null} */
    this._footerStateUnsubscribe = null;

    /** @type {import('../../core/types.js').EventListenerRegistry} */
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

    /** @type {import('../../core/types.js').TimerID | null} */
    this._scrollTimeout = null;

    // Initialize session analytics and calculate mood
    this.stateManager.initializeSessionState();
    const mood = this.calculateMood();
    this.stateManager.setState({ mood });

    /** @type {Set<string>} Session-only easter egg tracking */
    this.easterEggFound = new Set();

    /** @type {import('../../core/types.js').DOMCache} */
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

  peekAgentService() {
    return this._agentService;
  }

  getFooterElement() {
    return getFooterElement(this);
  }

  getTypewriterElement() {
    return getTypewriterElement(this);
  }

  checkTypewriterCollision() {
    return checkTypewriterCollision(this);
  }

  maybeTriggerContextReaction(currentContext = null) {
    return maybeTriggerContextReaction(this, currentContext);
  }

  setupFooterOverlapCheck() {
    return setupFooterOverlapCheck(this);
  }

  setupMobileViewportHandler() {
    return setupMobileViewportHandler(this);
  }

  setupChatInputViewportHandlers() {
    return setupChatInputViewportHandlers(this);
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

    const syncFromMenuState = (isMenuOpen) => {
      if (!this.dom.container) return;
      const menuIsOpen = Boolean(isMenuOpen);

      this.dom.container.classList.toggle(
        'robot-companion--menu-open',
        menuIsOpen,
      );
      if (!menuIsOpen) return;

      this.chatModule.hideBubble();
      if (this.chatModule.isOpen) {
        this.toggleChat(false);
      }
    };

    const syncFromSearchState = (isSearchOpen) => {
      if (!this.dom.container) return;

      if (isSearchOpen) {
        this.animationModule.startSearchAnimation();
        return;
      }

      this.animationModule.stopSearchAnimation();
    };

    const stopMenuSync = menuOpen.subscribe(syncFromMenuState);
    const stopSearchSync = searchOpen.subscribe(syncFromSearchState);

    this._uiUnsubscribe = () => {
      stopMenuSync();
      stopSearchSync();
    };
  }

  setupProgressiveHydration() {
    return setupProgressiveHydration(this);
  }

  hydrateInteractiveFeatures() {
    return hydrateInteractiveFeatures(this);
  }

  setupSectionChangeDetection() {
    return setupSectionChangeDetection(this);
  }

  /**
   * View Transitions Morphing – set `data-page-context` on the container so
   * the CSS position rules kick in. During SPA navigations the attribute
   * changes *inside* `document.startViewTransition()`, which causes the
   * browser to smoothly morph the robot from old → new position.
   */
  setupPageContextMorphing() {
    return setupPageContextMorphing(this);
  }

  /**
   * Resolve current page context and apply it as a data attribute.
   * When the context actually changes (SPA navigation), reset patrol
   * and collision state so the robot settles cleanly in its new position.
   * @private
   */
  _updatePageContextAttribute() {
    return updatePageContextAttribute(this);
  }

  destroy() {
    // Module Cleanup
    this.chatModule?.destroy();
    this._agentService?.destroy?.();
    this.animationModule?.destroy();
    this.intelligenceModule?.destroy();
    this.collisionModule?.destroy();
    this.contextReactionsModule?.destroy();
    if (this.emotionsModule?.destroy) this.emotionsModule.destroy();

    if (this._uiUnsubscribe) {
      this._uiUnsubscribe();
      this._uiUnsubscribe = null;
    }
    if (this._footerStateUnsubscribe) {
      this._footerStateUnsubscribe();
      this._footerStateUnsubscribe = null;
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
   * @returns {import('../../core/types.js').RobotMood}
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

    const interactions = this.stateManager.getState().analytics.interactions;

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
    this.chatModule.showBubble(message);
    this._setTimeout(() => this.chatModule.hideBubble(), 10000);
  }

  /**
   * Track section visit for analytics
   * @param {import('../../core/types.js').PageContext} context - Page context
   */
  trackSectionVisit(context) {
    this.stateManager.trackSectionVisit(context);
    const { sectionsVisited } = this.stateManager.getState().analytics;

    const allSections = [
      'hero',
      'features',
      'section3',
      'projects',
      'gallery',
      'footer',
    ];
    const visitedAll = allSections.every((s) => sectionsVisited.includes(s));
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
    this.dom.profileStatus = document.getElementById(
      'robot-chat-profile-status',
    );
    this.dom.memoriesBtn = /** @type {HTMLButtonElement|null} */ (
      document.getElementById('robot-chat-memories')
    );
    this.dom.editMemoryBtn = /** @type {HTMLButtonElement|null} */ (
      document.getElementById('robot-chat-edit-memory')
    );
    this.dom.switchProfileBtn = /** @type {HTMLButtonElement|null} */ (
      document.getElementById('robot-chat-switch-profile')
    );
    this.dom.disconnectProfileBtn = /** @type {HTMLButtonElement|null} */ (
      document.getElementById('robot-chat-disconnect-profile')
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
      this.chatModule.hideBubble();
    };
    this.dom.bubbleClose.addEventListener('click', _onBubbleClose);
    this._eventListeners.dom.push({
      target: this.dom.bubbleClose,
      event: 'click',
      handler: _onBubbleClose,
    });

    const _onHistoryCleared = () => {
      this.chatModule.clearHistory();
    };
    document.addEventListener(
      ROBOT_EVENTS.CHAT_HISTORY_CLEARED,
      _onHistoryCleared,
    );

    this._eventListeners.dom.push({
      target: document,
      event: ROBOT_EVENTS.CHAT_HISTORY_CLEARED,
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

    if (this.dom.editMemoryBtn) {
      const _onEditMemoryBtnClick = () =>
        this.chatModule.handleAction(ROBOT_ACTIONS.EDIT_PROFILE);
      this.dom.editMemoryBtn.addEventListener('click', _onEditMemoryBtnClick);
      this._eventListeners.dom.push({
        target: this.dom.editMemoryBtn,
        event: 'click',
        handler: _onEditMemoryBtnClick,
      });
    }

    if (this.dom.switchProfileBtn) {
      const _onSwitchProfileBtnClick = () =>
        this.chatModule.handleAction(ROBOT_ACTIONS.SWITCH_PROFILE);
      this.dom.switchProfileBtn.addEventListener(
        'click',
        _onSwitchProfileBtnClick,
      );
      this._eventListeners.dom.push({
        target: this.dom.switchProfileBtn,
        event: 'click',
        handler: _onSwitchProfileBtnClick,
      });
    }

    if (this.dom.disconnectProfileBtn) {
      const _onDisconnectProfileBtnClick = () =>
        this.chatModule.handleAction(ROBOT_ACTIONS.DISCONNECT_PROFILE);
      this.dom.disconnectProfileBtn.addEventListener(
        'click',
        _onDisconnectProfileBtnClick,
      );
      this._eventListeners.dom.push({
        target: this.dom.disconnectProfileBtn,
        event: 'click',
        handler: _onDisconnectProfileBtnClick,
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
   * @returns {import('../../core/types.js').PageContext}
   */
  getPageContext() {
    return getPageContext(this);
  }

  setupSectionObservers() {
    return setupSectionObservers(this);
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
