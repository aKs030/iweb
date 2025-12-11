/**
 * KI Roboter Begleiter - Extended Edition (Optimized)
 * Performance-Optimierungen: DOM-Caching, RequestAnimationFrame-Nutzung, Refactoring.
 */

import { GeminiService } from './gemini-service.js';
import { RobotGames } from './robot-games.js';

class RobotCompanion {
  constructor() {
    this.containerId = 'robot-companion-container';
    // Referenz auf globale Texte sicherstellen
    this.texts = (window && window.robotCompanionTexts) || {};

    this.gemini = new GeminiService();
    this.gameModule = new RobotGames(this); // Initialize games module

    this.state = {
      isOpen: false,
      lastGreetedContext: null,
      isTyping: false,
    };

    // Context greeting dedupe & observed section tracking
    this.contextGreetingHistory = {}; // ctx -> Set of used greetings
    this.currentObservedContext = null; // from IntersectionObserver

    // Observer handle
    this._sectionObserver = null;

    // Mood & Analytics System
    this.analytics = {
      sessions: parseInt(localStorage.getItem('robot-sessions') || '0') + 1,
      sectionsVisited: [],
      interactions: parseInt(localStorage.getItem('robot-interactions') || '0'),
      lastVisit: localStorage.getItem('robot-last-visit') || new Date().toISOString(),
    };
    localStorage.setItem('robot-sessions', this.analytics.sessions);
    localStorage.setItem('robot-last-visit', new Date().toISOString());

    this.mood = this.calculateMood();
    this.easterEggFound = new Set(JSON.parse(localStorage.getItem('robot-easter-eggs') || '[]'));

    // DOM Cache Struktur initialisieren
    this.dom = {};

    // Patrol State
    this.patrol = {
      active: false,
      x: 0,
      y: 0,
      direction: 1,
      speed: 0.3,
      isPaused: false,
      bouncePhase: 0,
    };

    // Start Animation State
    this.startAnimation = {
      active: false,
      phase: 'idle', // idle, approach, pause, knockback, landing
      startTime: 0,
      startX: 0,
      targetX: 0,
      duration: 1000,
      pauseUntil: 0,
      knockbackStartTime: 0,
      knockbackDuration: 600,
      knockbackStartX: 0,
      knockbackStartY: 0,
    };

    // Performance & Caching Konfiguration
    this.cacheConfig = {
      lastTypeWriterCheck: 0,
      typeWriterCheckInterval: 2000, // Nur alle 2 Sekunden nach dem Titel suchen, statt 60x pro Sekunde
      typeWriterRect: null,
    };

    this.motion = {
      baseSpeed: 0.3,
      dashSpeed: 1.2,
      dashChance: 0.0015,
      dashDuration: 900,
      dashUntil: 0,
    };

    this.updatePatrol = this.updatePatrol.bind(this);
    this._prevDashActive = false;

    // Tracking für deterministische Bubble-Reihenfolge (Pool-Rotation)
    this.initialBubblePoolCursor = [];

    // Idle eye animation
    this.eyeIdleOffset = { x: 0, y: 0 };
    this._eyeIdleTimer = null;
    this.eyeIdleConfig = {
      intervalMin: 3000,
      intervalMax: 8000,
      amplitudeX: 1.5,
      amplitudeY: 0.8,
      moveDuration: 800,
    };

    // Blinking config
    this.blinkConfig = {
      intervalMin: 2500,
      intervalMax: 7000,
      duration: 120,
    };
    this._blinkTimer = null;

    // Standard-Initialisierung der Texte
    this.applyTexts();

    this._bubbleSequenceTimers = [];
    this._sectionCheckInterval = null;
    this._scrollListener = null;

    // Laden, Anwenden, Starten
    this.loadTexts().then(() => {
      this.applyTexts();
      // Falls noch nicht initialisiert (Race Condition Prevention)
      if (!this.dom.container) this.init();
    });

    // Fallback init, falls loadTexts hängt oder Texte schon da sind
    if (window.robotCompanionTexts) {
      this.init();
    } else {
      // Kurzer Timeout als Fallback, damit der Bot auch ohne externe Texte erscheint
      setTimeout(() => {
        if (!this.dom.container) this.init();
      }, 500);
    }
  }

  applyTexts() {
    // Falls window.robotCompanionTexts inzwischen geladen wurde, nutze es
    const src = (window && window.robotCompanionTexts) || this.texts || {};

    this.knowledgeBase = src.knowledgeBase ||
      this.knowledgeBase || { start: { text: 'Hallo!', options: [] } };
    this.contextGreetings = src.contextGreetings || this.contextGreetings || { default: [] };
    this.moodGreetings = src.moodGreetings ||
      this.moodGreetings || {
        normal: ['Hey! Wie kann ich helfen?', 'Hi! Was brauchst du?'],
      };
    this.startMessageSuffix = src.startMessageSuffix || this.startMessageSuffix || {};
    this.initialBubbleGreetings = src.initialBubbleGreetings ||
      this.initialBubbleGreetings || ['Psst! Brauchst du Hilfe?'];
    this.initialBubblePools = src.initialBubblePools || this.initialBubblePools || [];
    this.initialBubbleSequenceConfig = src.initialBubbleSequenceConfig ||
      this.initialBubbleSequenceConfig || {
        steps: 4,
        displayDuration: 10000,
        pausesAfter: [0, 20000, 20000, 0],
      };
  }

  loadTexts() {
    return new Promise((resolve) => {
      if (window && window.robotCompanionTexts) {
        this.texts = window.robotCompanionTexts;
        resolve();
        return;
      }

      // Prüfen ob Script schon existiert
      if (document.querySelector('script[src*="robot-companion-texts.js"]')) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = '/content/components/robot-companion/robot-companion-texts.js';
      script.async = true;
      script.onload = () => {
        this.texts = (window && window.robotCompanionTexts) || {};
        resolve();
      };
      script.onerror = () => {
        // Fail silently -> Fallback Texte werden genutzt
        resolve();
      };
      document.head.appendChild(script);
    });
  }

  // Optimierter Footer Check mit Throttling via RequestAnimationFrame
  setupFooterOverlapCheck() {
    let ticking = false;

    const checkOverlap = () => {
      if (!this.dom.container) return;

      // Cache Footer lookup (assuming footer doesn't change often)
      if (!this.dom.footer) {
        this.dom.footer =
          document.querySelector('footer') || document.querySelector('#site-footer');
      }

      const footer = this.dom.footer;
      if (!footer) return;

      // Reset um natürliche Position zu messen
      this.dom.container.style.bottom = '';

      const rect = this.dom.container.getBoundingClientRect();
      const fRect = footer.getBoundingClientRect();

      const overlap = Math.max(0, rect.bottom - fRect.top);

      if (overlap > 0) {
        this.dom.container.style.bottom = `${30 + overlap}px`;
      }

      ticking = false;
    };

    const requestTick = () => {
      if (!ticking) {
        requestAnimationFrame(checkOverlap);
        ticking = true;
      }
    };

    // Listener
    window.addEventListener('scroll', requestTick, { passive: true });
    window.addEventListener('resize', requestTick, { passive: true });

    // Einmaliger Check
    requestAnimationFrame(checkOverlap);

    // Polling Intervall reduziert
    setInterval(requestTick, 1000);
  }

  // Mobile Keyboard Handling (Virtual Viewport API)
  setupMobileViewportHandler() {
    // If Visual Viewport API is not supported, we can't do much
    if (!window.visualViewport) return;

    const handleResize = () => {
      // Only act if chat is open
      if (!this.state.isOpen || !this.dom.window) return;

      // Detection Strategy:
      // If the keyboard is overlaying content (not resizing layout),
      // the layout viewport (window.innerHeight) remains large (e.g. 800px),
      // but the visual viewport shrinks (e.g. 500px).
      // We check for a significant discrepancy.
      const layoutHeight = window.innerHeight;
      const visualHeight = window.visualViewport.height;
      const heightDiff = layoutHeight - visualHeight;

      // Threshold: 150px (typical keyboard is >250px)
      const isKeyboardOverlay = heightDiff > 150;

      if (isKeyboardOverlay) {
        // Keyboard is open and overlaying. We must push the chat window up.
        // Standard mobile bottom is ~90px. We add the hidden height.
        // We use Math.max to prevent negative bottom if something is weird.
        const baseBottom = 90;
        const newBottom = baseBottom + heightDiff;

        this.dom.window.style.bottom = `${newBottom}px`;

        // Also ensure the window fits in the remaining space
        // visualHeight is the visible space.
        // We leave 10px margin top.
        // The effective available height for the chat window is visualHeight - 10 (top) - 90 (bottom space reserved).
        // However, since we pushed bottom up by heightDiff, the window is now sitting 'on' the keyboard.
        // The available space is visualHeight.
        // Let's cap max-height to visualHeight - 20px.
        this.dom.window.style.maxHeight = `${visualHeight - 20}px`;
      } else {
        // Reset to CSS defaults
        this.dom.window.style.bottom = '';
        this.dom.window.style.maxHeight = '';
      }
    };

    window.visualViewport.addEventListener('resize', handleResize);
    window.visualViewport.addEventListener('scroll', handleResize);

    // Also trigger update when chat opens
    const originalToggle = this.toggleChat.bind(this);
    this.toggleChat = (forceState) => {
        originalToggle(forceState);
        if (this.state.isOpen) {
             // Delay slightly to allow keyboard animation / layout settle
             setTimeout(handleResize, 100);
             setTimeout(handleResize, 300);
        } else {
            // Reset when closing
            if (this.dom.window) {
                this.dom.window.style.bottom = '';
                this.dom.window.style.maxHeight = '';
            }
        }
    };
  }

  init() {
    // Verhindert mehrfache Initialisierung
    if (this.dom.container) return;

    this.loadCSS();
    this.createDOM();
    this.attachEvents();
    this.setupFooterOverlapCheck();
    this.setupMobileViewportHandler();

    // Begrüßungslogik - only once on page load
    setTimeout(() => {
      const ctx = this.getPageContext();
      if (!this.state.isOpen && !this.state.lastGreetedContext) {
        const showSequenceChance = 0.9;
        if (
          this.initialBubblePools &&
          this.initialBubblePools.length > 0 &&
          Math.random() < showSequenceChance
        ) {
          this.startInitialBubbleSequence();
        } else {
          const greet =
            this.initialBubbleGreetings && this.initialBubbleGreetings.length > 0
              ? this.initialBubbleGreetings[
                  Math.floor(Math.random() * this.initialBubbleGreetings.length)
                ]
              : 'Hallo!';
          const ctxArr = this.contextGreetings[ctx] || this.contextGreetings.default || [];
          let finalGreet = greet;
          if (ctxArr.length && Math.random() < 0.7) {
            const ctxMsg = String(ctxArr[Math.floor(Math.random() * ctxArr.length)] || '').trim();
            finalGreet = ctxMsg; // Use context greeting directly if chosen
          }
          this.showBubble(finalGreet);
          this.state.lastGreetedContext = ctx;
        }
      }
    }, 5000);

    // Section change detection
    this.setupSectionChangeDetection();

    // Start with dramatic animation if TypeWriter exists
    setTimeout(() => {
      this.startTypeWriterKnockbackAnimation();
    }, 1500);

    // Listen for TypeWriter typing end events so we can detect close-by typing and trigger collisions
    this._onHeroTypingEnd = (ev) => {
      try {
        const typeWriter = document.querySelector('.typewriter-title');
        if (!typeWriter || !this.dom || !this.dom.container) return;
        const twRect = typeWriter.getBoundingClientRect();
        const robotWidth = 80;
        const initialLeft = window.innerWidth - 30 - robotWidth;
        const maxLeft = initialLeft - 20;
        // If the typed line overlaps the robot, trigger the dedicated collision response
        this.checkForTypewriterCollision(twRect, maxLeft);
      } catch (e) {}
    };
    document.addEventListener('hero:typingEnd', this._onHeroTypingEnd);
  }

  setupSectionChangeDetection() {
    this.setupSectionObservers();
    let lastContext = this.getPageContext();

    const checkContextChange = () => {
      if (this.state.isOpen) return; // Don't greet if chat is open

      const currentContext = this.getPageContext();
      if (currentContext !== lastContext && currentContext !== this.state.lastGreetedContext) {
        lastContext = currentContext;

        // Wait a bit before greeting (user needs to settle in new section)
        setTimeout(() => {
          if (this.getPageContext() === currentContext && !this.state.isOpen) {
            this.startInitialBubbleSequence();
          }
        }, 2000);
      }
    };

    // Check on scroll with debounce
    let scrollTimeout;
    this._scrollListener = () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        checkContextChange();
        // Also check for collisions when user scrolls
        try {
          const tw = document.querySelector('.typewriter-title');
          if (tw && this.dom.container) {
            const twRect = tw.getBoundingClientRect();
            const robotWidth = 80;
            const initialLeft = window.innerWidth - 30 - robotWidth;
            const maxLeft = initialLeft - 20;
            this.checkForTypewriterCollision(twRect, maxLeft);
          }
        } catch (e) {}
      }, 500);
    };
    window.addEventListener('scroll', this._scrollListener, { passive: true });

    // Check periodically (backup)
    this._sectionCheckInterval = setInterval(checkContextChange, 3000);
  }

  destroy() {
    // Cleanup method to prevent memory leaks
    this.clearBubbleSequence();
    this.stopIdleEyeMovement();
    this.stopBlinkLoop();
    if (this._sectionObserver) {
      this._sectionObserver.disconnect();
      this._sectionObserver = null;
    }

    // Remove event listeners
    if (this._scrollListener) {
      window.removeEventListener('scroll', this._scrollListener);
      this._scrollListener = null;
    }

    // Remove TypeWriter typing end listener
    if (this._onHeroTypingEnd) {
      document.removeEventListener('hero:typingEnd', this._onHeroTypingEnd);
      this._onHeroTypingEnd = null;
    }

    // Clear intervals
    if (this._sectionCheckInterval) {
      clearInterval(this._sectionCheckInterval);
      this._sectionCheckInterval = null;
    }

    // Remove DOM
    if (this.dom.container && this.dom.container.parentNode) {
      this.dom.container.parentNode.removeChild(this.dom.container);
    }
  }

  calculateMood() {
    const hour = new Date().getHours();
    const { sessions, interactions } = this.analytics;

    // Special moods based on time
    if (hour >= 0 && hour < 6) return 'night-owl'; // 🦉 Nachteule
    if (hour >= 6 && hour < 10) return 'sleepy'; // 😴 Verschlafen
    if (hour >= 10 && hour < 17) return 'energetic'; // ⚡ Energiegeladen
    if (hour >= 17 && hour < 22) return 'relaxed'; // 😊 Entspannt
    if (hour >= 22) return 'night-owl';

    // Enthusiastic after many interactions
    if (sessions > 10 || interactions > 50) return 'enthusiastic'; // 🤩

    return 'normal';
  }

  getMoodGreeting() {
    // Ensure we use the latest loaded texts
    const greetings =
      this.moodGreetings ||
      (window.robotCompanionTexts && window.robotCompanionTexts.moodGreetings) ||
      {};
    const moodGreets = greetings[this.mood] || greetings['normal'] || ['Hey! Wie kann ich helfen?'];
    return moodGreets[Math.floor(Math.random() * moodGreets.length)];
  }

  trackInteraction(type = 'general') {
    this.analytics.interactions++;
    localStorage.setItem('robot-interactions', this.analytics.interactions);

    // Check for easter eggs
    if (this.analytics.interactions === 10 && !this.easterEggFound.has('first-10')) {
      this.unlockEasterEgg(
        'first-10',
        '🎉 Wow, 10 Interaktionen! Du bist hartnäckig! Hier ist ein Geschenk: Ein geheimes Mini-Game wurde freigeschaltet! 🎮',
      );
    }
    if (this.analytics.interactions === 50 && !this.easterEggFound.has('first-50')) {
      this.unlockEasterEgg(
        'first-50',
        '🏆 50 Interaktionen! Du bist ein echter Power-User! Respekt! 💪',
      );
    }
  }

  unlockEasterEgg(id, message) {
    this.easterEggFound.add(id);
    localStorage.setItem('robot-easter-eggs', JSON.stringify([...this.easterEggFound]));
    this.showBubble(message);
    setTimeout(() => this.hideBubble(), 10000);
  }

  trackSectionVisit(context) {
    if (!this.analytics.sectionsVisited.includes(context)) {
      this.analytics.sectionsVisited.push(context);

      // Easter egg: Visited all sections
      const allSections = ['hero', 'features', 'about', 'projects', 'gallery', 'footer'];
      const visitedAll = allSections.every((s) => this.analytics.sectionsVisited.includes(s));
      if (visitedAll && !this.easterEggFound.has('explorer')) {
        this.unlockEasterEgg('explorer', '🗺️ Du hast alle Bereiche erkundet! Echter Explorer! 🧭');
      }
    }
  }

  loadCSS() {
    if (!document.querySelector('link[href*="robot-companion.css"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = '/content/components/robot-companion/robot-companion.css'; // Pfad ggf. anpassen
      document.head.appendChild(link);
    }
  }

  createDOM() {
    const container = document.createElement('div');
    container.id = this.containerId;

    // SVG Strings optimiert (keine Änderungen am Inhalt, nur Struktur)
    const robotSVG = `
        <svg viewBox="0 0 100 100" class="robot-svg">
            <defs>
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="2" result="blur"/>
                <feComposite in="SourceGraphic" in2="blur" operator="over"/>
              </filter>
              <filter id="lidShadow" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="0" dy="1" stdDeviation="1.2" flood-color="#000000" flood-opacity="0.35" />
              </filter>
              <linearGradient id="lidGradient" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stop-color="#0b1220" stop-opacity="0.95" />
                <stop offset="100%" stop-color="#0f172a" stop-opacity="1" />
              </linearGradient>
            </defs>
            <line x1="50" y1="15" x2="50" y2="25" stroke="#40e0d0" stroke-width="2" />
            <circle cx="50" cy="15" r="3" class="robot-antenna-light" fill="#ff4444" />
            <path d="M30,40 a20,20 0 0,1 40,0" fill="#1e293b" stroke="#40e0d0" stroke-width="2" />
            <rect x="30" y="40" width="40" height="15" fill="#1e293b" stroke="#40e0d0" stroke-width="2" />
            <g class="robot-eye">
              <circle class="robot-pupil" cx="40" cy="42" r="4" fill="#40e0d0" filter="url(#glow)" />
              <path class="robot-lid" d="M34 36 C36 30 44 30 46 36 L46 44 C44 38 36 38 34 44 Z" fill="url(#lidGradient)" filter="url(#lidShadow)" />
              <circle class="robot-pupil" cx="60" cy="42" r="4" fill="#40e0d0" filter="url(#glow)" />
              <path class="robot-lid" d="M54 36 C56 30 64 30 66 36 L66 44 C64 38 56 38 54 44 Z" fill="url(#lidGradient)" filter="url(#lidShadow)" />
            </g>
            <path class="robot-legs" d="M30,60 L70,60 L65,90 L35,90 Z" fill="#0f172a" stroke="#40e0d0" stroke-width="2" />
            <g class="robot-flame" style="opacity: 0;">
                <path d="M40,90 Q50,120 60,90 Q50,110 40,90" fill="#ff9900" />
                <path d="M45,90 Q50,110 55,90" fill="#ffff00" />
            </g>
            <g class="robot-particles" style="opacity: 0;">
                <circle class="particle" cx="20" cy="50" r="2" fill="#40e0d0" opacity="0.6"><animate attributeName="cy" values="50;30;50" dur="2s" repeatCount="indefinite" /></circle>
                <circle class="particle" cx="80" cy="60" r="1.5" fill="#40e0d0" opacity="0.5"><animate attributeName="cy" values="60;40;60" dur="2.5s" repeatCount="indefinite" /></circle>
                <circle class="particle" cx="15" cy="70" r="1" fill="#40e0d0" opacity="0.7"><animate attributeName="cy" values="70;50;70" dur="1.8s" repeatCount="indefinite" /></circle>
            </g>
            <g class="robot-thinking" style="opacity: 0;">
                <circle cx="70" cy="20" r="8" fill="rgba(64, 224, 208, 0.2)" stroke="#40e0d0" stroke-width="1" />
                <text x="70" y="25" font-size="12" fill="#40e0d0" text-anchor="middle">?</text>
            </g>
            <circle cx="50" cy="70" r="5" fill="#2563eb" opacity="0.8"><animate attributeName="opacity" values="0.4;1;0.4" dur="2s" repeatCount="indefinite" /></circle>
            <path d="M28,65 Q20,75 28,85" fill="none" stroke="#64748b" stroke-width="3" stroke-linecap="round" />
            <path d="M72,65 Q80,75 72,85" fill="none" stroke="#64748b" stroke-width="3" stroke-linecap="round" />
        </svg>
    `;

    container.innerHTML = `
            <div class="robot-chat-window" id="robot-chat-window">
                <div class="chat-header">
                    <div class="chat-title"><span class="chat-status-dot"></span>Cyber Assistant</div>
                    <button class="chat-close-btn">&times;</button>
                </div>
                <div class="chat-messages" id="robot-messages"></div>
                <div class="chat-controls" id="robot-controls"></div>
                <div class="chat-input-area" id="robot-input-area">
                    <input type="text" id="robot-chat-input" placeholder="Frag mich etwas oder wähle eine Option..." />
                    <button id="robot-chat-send">➤</button>
                </div>
            </div>
            <div class="robot-float-wrapper">
                <div class="robot-bubble" id="robot-bubble">
                    <span id="robot-bubble-text">Hallo!</span>
                    <div class="robot-bubble-close">&times;</div>
                </div>
                <div class="robot-avatar">${robotSVG}</div>
            </div>
        `;

    // Initially hide the container to avoid flash at default right position
    container.style.opacity = '0';
    container.style.transition = 'opacity 220ms ease';
    document.body.appendChild(container);

    // Cache DOM Elements einmalig
    this.dom.container = container;
    this.dom.window = document.getElementById('robot-chat-window');
    this.dom.bubble = document.getElementById('robot-bubble');
    this.dom.bubbleText = document.getElementById('robot-bubble-text');
    this.dom.bubbleClose = container.querySelector('.robot-bubble-close');
    this.dom.messages = document.getElementById('robot-messages');
    this.dom.controls = document.getElementById('robot-controls');
    this.dom.inputArea = document.getElementById('robot-input-area');
    this.dom.input = document.getElementById('robot-chat-input');
    this.dom.sendBtn = document.getElementById('robot-chat-send');
    this.dom.avatar = container.querySelector('.robot-avatar');
    this.dom.svg = container.querySelector('.robot-svg');
    this.dom.eyes = container.querySelector('.robot-eye');
    this.dom.flame = container.querySelector('.robot-flame');
    this.dom.legs = container.querySelector('.robot-legs');
    this.dom.particles = container.querySelector('.robot-particles');
    this.dom.thinking = container.querySelector('.robot-thinking');
    this.dom.closeBtn = container.querySelector('.chat-close-btn');

    requestAnimationFrame(() => this.startIdleEyeMovement());
  }

  attachEvents() {
    this.dom.avatar.addEventListener('click', () => this.toggleChat());
    this.dom.closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleChat(false);
    });
    this.dom.bubbleClose.addEventListener('click', (e) => {
      e.stopPropagation();
      const ctx = this.getPageContext();
      this.state.lastGreetedContext = ctx;
      this.clearBubbleSequence();
      this.hideBubble();
    });

    if (this.dom.sendBtn) {
      this.dom.sendBtn.addEventListener('click', () => this.handleUserMessage());
    }

    if (this.dom.input) {
      this.dom.input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') this.handleUserMessage();
      });
    }
  }

  startIdleEyeMovement() {
    this.stopIdleEyeMovement();
    const cfg = this.eyeIdleConfig;
    const scheduleNext = () => {
      const delay = cfg.intervalMin + Math.random() * (cfg.intervalMax - cfg.intervalMin);
      this._eyeIdleTimer = setTimeout(() => {
        const targetX = (Math.random() * 2 - 1) * cfg.amplitudeX;
        const targetY = (Math.random() * 2 - 1) * cfg.amplitudeY;
        this.eyeIdleOffset.x = targetX;
        this.eyeIdleOffset.y = targetY;
        this.updateEyesTransform();
        const t = setTimeout(() => {
          this.eyeIdleOffset.x = 0;
          this.eyeIdleOffset.y = 0;
          this.updateEyesTransform();
          scheduleNext();
        }, cfg.moveDuration);
        this._eyeIdleTimer = t || this._eyeIdleTimer;
      }, delay);
    };
    scheduleNext();
  }

  stopIdleEyeMovement() {
    if (this._eyeIdleTimer) {
      clearTimeout(this._eyeIdleTimer);
      this._eyeIdleTimer = null;
    }
    this.eyeIdleOffset.x = 0;
    this.eyeIdleOffset.y = 0;
    this.updateEyesTransform();
  }

  updateEyesTransform() {
    if (!this.dom || !this.dom.eyes) return;
    const eyeOffset = typeof this.patrol !== 'undefined' && this.patrol.direction > 0 ? -3 : 3;
    const eyeIntensity =
      (this.startAnimation && this.startAnimation.active) || this.patrol.isPaused
        ? 1.4
        : this.motion && this.motion.dashUntil > performance.now()
          ? 1.2
          : 1;
    const baseX = eyeOffset * eyeIntensity;
    const totalX = baseX + (this.eyeIdleOffset.x || 0);
    const totalY = this.eyeIdleOffset.y || 0;
    this.dom.eyes.style.transform = `translate(${totalX}px, ${totalY}px)`;
    // Transition wird im CSS definiert oder hier gesetzt, idealerweise im CSS via Klasse, aber hier ok
    this.dom.eyes.style.transition = 'transform 0.6s ease';
  }

  startBlinkLoop() {
    this.stopBlinkLoop();
    const schedule = () => {
      const delay =
        this.blinkConfig.intervalMin +
        Math.random() * (this.blinkConfig.intervalMax - this.blinkConfig.intervalMin);
      this._blinkTimer = setTimeout(() => {
        this.doBlink();
        schedule();
      }, delay);
    };
    schedule();
  }

  stopBlinkLoop() {
    if (this._blinkTimer) {
      clearTimeout(this._blinkTimer);
      this._blinkTimer = null;
    }
  }

  doBlink() {
    if (!this.dom || !this.dom.eyes) return;
    const lids = this.dom.eyes.querySelectorAll('.robot-lid');
    if (!lids.length) return;
    lids.forEach((l) => l.classList.add('is-blink'));
    setTimeout(
      () => {
        lids.forEach((l) => l.classList.remove('is-blink'));
      },
      (this.blinkConfig.duration || 120) + 20,
    );
  }

  clearBubbleSequence() {
    if (!this._bubbleSequenceTimers) return;
    this._bubbleSequenceTimers.forEach((t) => clearTimeout(t));
    this._bubbleSequenceTimers = [];
  }

  getContextGreetingForContext(ctxArr, ctxKey) {
    if (!ctxArr || ctxArr.length === 0) return null;
    if (!this.contextGreetingHistory[ctxKey]) this.contextGreetingHistory[ctxKey] = new Set();
    const used = this.contextGreetingHistory[ctxKey];
    let candidates = ctxArr.filter((g) => !used.has(g));
    if (candidates.length === 0) {
      used.clear();
      candidates = ctxArr.slice();
    }
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    used.add(pick);
    return pick;
  }

  startInitialBubbleSequence() {
    this.clearBubbleSequence();
    const ctx = this.getPageContext();
    const ctxArr = (this.contextGreetings && this.contextGreetings[ctx]) || [];
    const pools = this.initialBubblePools || [];
    const maxSteps = this.initialBubbleSequenceConfig.steps || 3;

    // Sicherstellen, dass Cursor-Liste zur Pool-Länge passt
    if (
      !Array.isArray(this.initialBubblePoolCursor) ||
      this.initialBubblePoolCursor.length !== pools.length
    ) {
      this.initialBubblePoolCursor = new Array(pools.length).fill(0);
    }

    const picks = [];

    // Strategy: Immer Kontext-Gruß, wenn vorhanden; Pools zyklisch auffüllen
    const nextFromPool = (poolIdx) => {
      if (!pools.length) return null;
      const idx = poolIdx % pools.length;
      const pool = pools[idx];
      if (!pool || pool.length === 0) return null;
      const cursor = this.initialBubblePoolCursor[idx] || 0;
      const pick = pool[cursor % pool.length];
      this.initialBubblePoolCursor[idx] = (cursor + 1) % pool.length;
      return String(pick || '').trim();
    };

    const fillFromPools = (startIndex = 0) => {
      let poolIndex = startIndex;
      let attempts = 0;
      while (picks.length < maxSteps && attempts < maxSteps * 4) {
        const candidate = nextFromPool(poolIndex);
        poolIndex++;
        attempts++;
        if (candidate) picks.push(candidate);
      }
    };

    // 40% Chance: Start mit Mood Greeting als erstes Element
    if (Math.random() < 0.4) {
      const moodGreet = this.getMoodGreeting();
      if (moodGreet) picks.push(moodGreet);
    }

    if (ctxArr.length > 0) {
      const ctxPick = this.getContextGreetingForContext(ctxArr, ctx);
      if (ctxPick) picks.push(String(ctxPick || '').trim());
      fillFromPools(0);
    } else {
      // Kein Kontext-Gruß: Pools zyklisch füllen
      fillFromPools(0);
    }

    // Fallback: if no picks, use one initialBubbleGreeting
    if (
      picks.length === 0 &&
      this.initialBubbleGreetings &&
      this.initialBubbleGreetings.length > 0
    ) {
      const fallback =
        this.initialBubbleGreetings[Math.floor(Math.random() * this.initialBubbleGreetings.length)];
      picks.push(String(fallback || '').trim());
    }

    if (picks.length === 0) return;

    const showMs = this.initialBubbleSequenceConfig.displayDuration || 8000;
    const pauses = this.initialBubbleSequenceConfig.pausesAfter || [];

    const schedule = (index) => {
      if (this.state.isOpen) return;
      if (index >= picks.length) {
        this.state.lastGreetedContext = ctx;
        return;
      }

      this.showBubble(picks[index]);
      const t1 = setTimeout(() => {
        this.hideBubble();
        const pause = pauses[index] || 0;
        const delay = pause > 0 ? pause : 300;
        const t2 = setTimeout(() => schedule(index + 1), delay);
        this._bubbleSequenceTimers.push(t2);
      }, showMs);
      this._bubbleSequenceTimers.push(t1);
    };
    schedule(0);
  }

  async fetchAndShowSuggestion() {
    if (this.state.lastGreetedContext || this.state.isOpen) return;

    const ctx = this.getPageContext();
    const behavior = {
      page: ctx,
      interests: [ctx],
    };

    try {
      const suggestion = await this.gemini.getSuggestion(behavior);
      if (suggestion && !this.state.isOpen) {
        this.showBubble(suggestion);
        setTimeout(() => this.hideBubble(), 8000);
      }
    } catch {
      // Silent fail
    }
  }
  _cubicBezier(t, p0, p1, p2, p3) {
    const u = 1 - t;
    const tt = t * t,
      uu = u * u;
    const uuu = uu * u,
      ttt = tt * t;
    return {
      x: uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
      y: uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y,
    };
  }

  // Avoidance logic removed — the robot turns and pauses at section limits now.

  checkForTypewriterCollision(twRect, maxLeft) {
    const now = performance.now();
    if (!twRect) return false;
    // Allow collisions even if the robot recently changed direction.
    if (this.startAnimation && this.startAnimation.active) return false;
    if (!this.dom || !this.dom.container) return false;
    try {
      // Use the robot avatar or svg bounding box instead of the full container
      const sourceEl = this.dom.svg || this.dom.avatar || this.dom.container;
      const rRectRaw = sourceEl.getBoundingClientRect();
      // Shrink the rect slightly so the collision triggers only when the visible robot
      // (not the container/bubble) is actually overlapping the text
      const shrinkX = 10; // px horizontally
      const shrinkY = 6; // px vertically
      const rRect = {
        left: rRectRaw.left + shrinkX,
        right: rRectRaw.right - shrinkX,
        top: rRectRaw.top + shrinkY,
        bottom: rRectRaw.bottom - shrinkY,
      };
      const intersects = !(
        twRect.right < rRect.left ||
        twRect.left > rRect.right ||
        twRect.bottom < rRect.top ||
        twRect.top > rRect.bottom
      );
      if (!intersects) return false;
      // Require a minimal overlap in px so the robot and text truly touch (prevents early triggers)
      const overlapX = Math.min(twRect.right, rRect.right) - Math.max(twRect.left, rRect.left);
      const overlapY = Math.min(twRect.bottom, rRect.bottom) - Math.max(twRect.top, rRect.top);
      if (overlapX < 6 || overlapY < 6) return false;
      // Clamp maxLeft fallback
      const robotWidth = 80;
      const initialLeft = window.innerWidth - 30 - robotWidth;
      maxLeft = typeof maxLeft === 'number' ? maxLeft : initialLeft - 20;

      // Collision reaction: show bubble, particle burst and dramatic knockback movement
      const dir = rRect.left > twRect.right ? 1 : -1;
      const reactions = [
        'Autsch! 😵',
        'Ups! Das war hart! 💥',
        'Whoa! 😲',
        'Hey! Nicht schubsen! 😠',
      ];
      const reaction = reactions[Math.floor(Math.random() * reactions.length)];
      // Sprechblase mit dramatischer Reaktion
      this.showBubble(reaction);
      setTimeout(() => this.hideBubble(), 2500);
      // Große Partikel-Explosion
      this.spawnParticleBurst(18, { strength: 2.0, spread: 180 });
      // Trigger the dedicated typewriter collision knockback
      this.startTypewriterCollisionResponse(twRect, maxLeft);
      return true;
    } catch (e) {
      return false;
    }
  }

  // A dedicated response for collisions with the TypeWriter text.
  // This function triggers an immediate knockback animation, large particle burst and a tilt flip.
  startTypewriterCollisionResponse(twRect, maxLeft) {
    if (!this.dom || !this.dom.container) return;
    // Prevent overlapping animations
    if (this.startAnimation && this.startAnimation.active) return;
    const now = performance.now();

    // Setup knockback animation parameters (re-use existing startAnimation workflow)
    this.startAnimation.active = true;
    this.startAnimation.phase = 'knockback';
    this.startAnimation.knockbackStartTime = now;
    this.startAnimation.knockbackDuration = 700; // slightly longer for drama
    this.startAnimation.knockbackStartX = this.patrol.x;
    this.startAnimation.knockbackStartY = this.patrol.y;

    // Kick off the animation loop
    requestAnimationFrame(this.updateStartAnimation.bind(this));
  }

  getPageContext() {
    try {
      // First priority: IntersectionObserver hint
      if (this.currentObservedContext) return this.currentObservedContext;

      const path = (window.location && window.location.pathname) || '';
      const file = path.split('/').pop() || '';
      const lower = path.toLowerCase();
      const midY = (window.innerHeight || 0) / 2;

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

      let context = 'default';

      // Priority 1: Check visible sections on page (for index.html)
      if (sectionCheck('#hero')) context = 'hero';
      else if (sectionCheck('#features')) context = 'features';
      else if (sectionCheck('#about')) context = 'about';
      else if (sectionCheck('#footer-container') || sectionCheck('footer')) context = 'footer';
      // Priority 2: Check URL path for specific pages
      else if (lower.includes('projekte')) context = 'projects';
      else if (lower.includes('gallery') || lower.includes('fotos')) context = 'gallery';
      else if (lower.includes('about') && file !== 'index.html') context = 'about';
      else if (lower.includes('karten') || file === 'karten.html') context = 'cards';
      // Priority 3: Homepage detection
      else if (lower === '/' || file === 'index.html' || file === '') context = 'home';
      else {
        // Priority 4: Fallback - check h1
        const h1 = document.querySelector('h1');
        if (h1) {
          const h1Text = (h1.textContent || '').toLowerCase();
          if (h1Text.includes('projekt')) context = 'projects';
          else if (h1Text.includes('foto') || h1Text.includes('galerie')) context = 'gallery';
        }
      }

      // Track section visit for analytics
      this.trackSectionVisit(context);

      return context;
    } catch {
      return 'default';
    }
  }

  setupSectionObservers() {
    if (this._sectionObserver) return;
    const sectionMap = [
      { selector: '#hero', ctx: 'hero' },
      { selector: '#features', ctx: 'features' },
      { selector: '#about', ctx: 'about' },
      { selector: '#footer-container', ctx: 'footer' },
      { selector: 'footer', ctx: 'footer' },
    ];

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > 0.35) {
            const match = sectionMap.find((s) => entry.target.matches(s.selector));
            if (match) this.currentObservedContext = match.ctx;
          }
        });
      },
      { threshold: [0.35, 0.5, 0.75] },
    );

    sectionMap.forEach((s) => {
      const el = document.querySelector(s.selector);
      if (el) observer.observe(el);
    });

    this._sectionObserver = observer;
  }

  spawnParticleBurst(count = 6, { direction = 0, strength = 1, spread = null } = {}) {
    if (!this.dom.container) return;
    const rect = this.dom.avatar.getBoundingClientRect();
    const baseX = rect.left + rect.width / 2;
    const baseY = rect.top + rect.height * 0.75;
    const cRect = this.dom.container.getBoundingClientRect();

    for (let i = 0; i < count; i++) {
      const el = document.createElement('div');
      el.className = 'robot-burst-particle';
      // Size scale based on strength
      const size = 4 + Math.round(3 + Math.random() * 4) * Math.min(1.2, strength);
      el.style.width = `${size}px`;
      el.style.height = `${size}px`;
      if (strength > 1.5 && Math.random() < 0.35) {
        el.style.filter = 'blur(0.9px)';
        el.style.opacity = '0.9';
      }
      this.dom.container.appendChild(el); // Append cached container

      // Wenn spread gegeben ist (in Grad), verwende 360° Explosion
      let angle;
      if (spread !== null) {
        const spreadRad = (spread * Math.PI) / 180;
        const baseAngle = -Math.PI / 2; // Nach oben
        angle = baseAngle + (Math.random() - 0.5) * spreadRad;
      } else {
        const angleSpread = Math.PI / 3;
        const baseAngle =
          direction === 0 ? -Math.PI / 2 : direction > 0 ? -Math.PI / 4 : (-3 * Math.PI) / 4;
        angle = baseAngle + (Math.random() - 0.5) * angleSpread;
      }

      const distance = 40 + Math.random() * 30;
      const dx = Math.cos(angle) * distance * strength;
      const dy = Math.sin(angle) * distance * strength - 10 * strength;

      el.style.left = baseX - cRect.left - size / 2 + 'px';
      el.style.top = baseY - cRect.top - size / 2 + 'px';

      requestAnimationFrame(() => {
        el.style.transform = `translate(${dx}px, ${dy}px) scale(${0.5 + Math.random() * 0.6})`;
        el.style.opacity = '0';
        if (Math.random() < 0.15) el.style.filter = 'blur(1px)';
      });

      setTimeout(() => el.remove(), 900 + Math.random() * 600);
    }
  }

  setAvatarState({ moving = false, dashing = false } = {}) {
    if (!this.dom.avatar) return;
    // classList toggles are fast, no opt needed
    this.dom.avatar.classList.toggle('is-moving', moving);
    this.dom.avatar.classList.toggle('is-dashing', dashing);
  }

  toggleChat(forceState) {
    const newState = forceState !== undefined ? forceState : !this.state.isOpen;
    if (newState) {
      this.dom.window.classList.add('open');
      this.state.isOpen = true;
      this.clearBubbleSequence();
      this.hideBubble();
      this.stopIdleEyeMovement();
      this.stopBlinkLoop();
      const ctx = this.getPageContext();
      this.state.lastGreetedContext = ctx;
      if (this.dom.messages.children.length === 0) this.handleAction('start');
    } else {
      this.dom.window.classList.remove('open');
      this.state.isOpen = false;
      this.startIdleEyeMovement();
      this.startBlinkLoop();
    }
  }

  async handleUserMessage() {
    const text = this.dom.input.value.trim();
    if (!text) return;

    this.addMessage(text, 'user');
    this.dom.input.value = '';

    // Check for active mini-games
    if (this.gameModule.state.guessNumberActive) {
      this.gameModule.handleGuessNumber(text);
      return;
    }

    // Check for trivia answer
    if (text.startsWith('triviaAnswer_')) {
      const answerIdx = parseInt(text.split('_')[1]);
      this.gameModule.handleTriviaAnswer(answerIdx);
      return;
    }

    this.showTyping();
    this.trackInteraction('message');

    try {
      // Collect context (last 5 messages)
      const history = [];
      // Simple history extraction could be added here if needed

      const response = await this.gemini.generateResponse(text, history);
      this.removeTyping();
      this.addMessage(response, 'bot');
    } catch {
      this.removeTyping();
      this.addMessage('Fehler bei der Verbindung.', 'bot');
    }
  }

  async handleSummarize() {
    this.toggleChat(true);
    this.showTyping();
    const content = document.body.innerText;
    const summary = await this.gemini.summarizePage(content);
    this.removeTyping();
    this.addMessage('Zusammenfassung dieser Seite:', 'bot');
    this.addMessage(summary, 'bot');
  }

  showBubble(text) {
    if (this.state.isOpen) return;
    if (!this.dom.bubble || !this.dom.bubbleText) return;
    this.dom.bubbleText.textContent = String(text || '').trim();
    this.dom.bubble.classList.add('visible');
  }

  hideBubble() {
    if (this.dom.bubble) this.dom.bubble.classList.remove('visible');
  }

  showTyping() {
    if (this.state.isTyping) return;
    this.state.isTyping = true;
    const typingDiv = document.createElement('div');
    typingDiv.className = 'typing-indicator';
    typingDiv.id = 'robot-typing';
    typingDiv.innerHTML = `<span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>`;
    this.dom.messages.appendChild(typingDiv);
    this.scrollToBottom();
  }

  removeTyping() {
    const typingDiv = document.getElementById('robot-typing');
    if (typingDiv) typingDiv.remove();
    this.state.isTyping = false;
  }

  addMessage(text, type = 'bot') {
    const msg = document.createElement('div');
    msg.className = `message ${type}`;
    msg.innerHTML = String(text || '');
    this.dom.messages.appendChild(msg);
    this.scrollToBottom();
  }

  clearControls() {
    this.dom.controls.innerHTML = '';
  }

  addOptions(options) {
    this.clearControls();
    options.forEach((opt) => {
      const btn = document.createElement('button');
      btn.className = 'chat-option-btn';
      btn.textContent = opt.label;
      btn.onclick = () => {
        this.addMessage(opt.label, 'user');
        setTimeout(() => {
          if (opt.url) {
            window.open(opt.url, opt.target || '_self');
            if (opt.target === '_blank') this.handleAction('start');
          } else if (opt.action) {
            // Check for trivia answers
            if (opt.action.startsWith('triviaAnswer_')) {
              const answerIdx = parseInt(opt.action.split('_')[1]);
              this.gameModule.handleTriviaAnswer(answerIdx);
            } else {
              this.handleAction(opt.action);
            }
          }
        }, 300);
      };
      this.dom.controls.appendChild(btn);
    });
  }

  handleAction(actionKey) {
    this.trackInteraction('action');

    if (actionKey === 'summarizePage') {
      this.handleSummarize();
      return;
    }
    if (actionKey === 'scrollFooter') {
      this.dom.footer?.scrollIntoView({ behavior: 'smooth' });
      this.showTyping();
      setTimeout(() => {
        this.removeTyping();
        this.addMessage('Ich habe dich nach unten gebracht! 👇', 'bot');
        setTimeout(() => this.handleAction('start'), 2000);
      }, 1000);
      return;
    }
    if (actionKey === 'randomProject') {
      this.addMessage('Ich suche ein Projekt...', 'bot');
      return;
    }

    // Mini-Games
    if (actionKey === 'playTicTacToe') {
      this.gameModule.startTicTacToe();
      return;
    }
    if (actionKey === 'playTrivia') {
      this.gameModule.startTrivia();
      return;
    }
    if (actionKey === 'playGuessNumber') {
      this.gameModule.startGuessNumber();
      return;
    }
    if (actionKey === 'showMood') {
      this.showMoodInfo();
      return;
    }

    const data = this.knowledgeBase[actionKey];
    if (!data) return;

    this.showTyping();
    this.dom.avatar.classList.add('nod');
    setTimeout(() => this.dom.avatar.classList.remove('nod'), 650);

    let responseText = Array.isArray(data.text)
      ? data.text[Math.floor(Math.random() * data.text.length)]
      : data.text;

    // Inject mood greeting for start action
    if (actionKey === 'start' && Math.random() < 0.3) {
      responseText = this.getMoodGreeting();
    } else if (actionKey === 'start') {
      const ctx = this.getPageContext();
      const suffix = String(this.startMessageSuffix[ctx] || '').trim();
      if (suffix) responseText = `${String(responseText || '').trim()} ${suffix}`.trim();
    }

    const typingTime = Math.min(Math.max(responseText.length * 15, 800), 2000);
    setTimeout(() => {
      this.removeTyping();
      this.addMessage(responseText, 'bot');
      if (data.options) this.addOptions(data.options);
    }, typingTime);
  }

  startTypeWriterKnockbackAnimation() {
    // Check if TypeWriter exists
    const typeWriter = document.querySelector('.typewriter-title');
    if (!typeWriter || !this.dom.container) {
      // No TypeWriter, start normal patrol
      this.startPatrol();
      return;
    }

    const twRect = typeWriter.getBoundingClientRect();
    const robotWidth = 80;
    const windowWidth = window.innerWidth;

    // Compute absolute coordinates for robot left edge (in px from left)
    const initialLeft = windowWidth - 30 - robotWidth; // container right:30 (CSS)

    // Desired left near the TypeWriter's right edge + gap, clamped
    const gap = 24; // px gap between TypeWriter and robot
    let targetLeft;
    const spaceRight = windowWidth - twRect.right - 30; // space between TypeWriter right and container right
    if (spaceRight >= robotWidth + gap) {
      // Enough room to place robot to the right of the TypeWriter
      targetLeft = twRect.right + gap;
    } else {
      // Not enough room on the right -> place robot to the left of the TypeWriter
      targetLeft = twRect.left - robotWidth - gap;
    }
    // Ensure targetLeft is within visible area and not beyond initial left
    targetLeft = Math.max(8, Math.min(initialLeft - 20, targetLeft));

    // Start a bit to the right of target (closer to the page edge), but not beyond initial left
    const startOffset = 80; // px starting further right than target (not ganz rechts)
    let startLeft = Math.min(initialLeft, targetLeft + startOffset);

    // Convert to patrol.x (translate amount)
    const startX = Math.max(0, Math.round(initialLeft - startLeft));
    const targetX = Math.max(0, Math.round(initialLeft - targetLeft));

    this.startAnimation.active = true;
    this.startAnimation.phase = 'approach';
    this.startAnimation.startTime = performance.now();
    this.startAnimation.startX = startX;
    this.startAnimation.targetX = targetX;
    this.startAnimation.duration = 1000;

    this.patrol.x = startX;
    this.patrol.direction = 1;
    this.patrol.bouncePhase = 0;

    // Set initial transform immediately to avoid flash at right
    this.dom.container.style.transform = `translate3d(-${this.patrol.x}px, ${this.patrol.y}px, 0) rotate(0deg)`;
    // Reveal container once we've set starting transform
    this.dom.container.style.opacity = '1';
    requestAnimationFrame(this.updateStartAnimation.bind(this));
  }

  updateStartAnimation() {
    if (!this.startAnimation.active || !this.dom.container) {
      requestAnimationFrame(this.updateStartAnimation.bind(this));
      return;
    }

    const now = performance.now();

    if (this.startAnimation.phase === 'approach') {
      const elapsed = now - this.startAnimation.startTime;
      const t = Math.min(1, elapsed / this.startAnimation.duration);

      // Ease-in-out für flüssige Beschleunigung
      const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

      // Position interpolieren
      this.patrol.x =
        this.startAnimation.startX +
        (this.startAnimation.targetX - this.startAnimation.startX) * eased;

      // Bounce während der Fahrt
      this.patrol.bouncePhase += 0.08;
      this.patrol.y = Math.sin(this.patrol.bouncePhase) * 4;

      // Flammen werden stärker
      const flameIntensity = 0.8 + 0.6 * eased;
      if (this.dom.flame) {
        this.dom.flame.style.opacity = flameIntensity;
        this.dom.flame.style.transform = `scale(${1 + flameIntensity * 0.3})`;
      }

      // Dashing-Effekt ab 30%
      const isDashing = t > 0.3;
      if (isDashing && this.dom.particles) {
        this.dom.particles.style.opacity = '0.9';
      }

      // Animation state setzen
      this.setAvatarState({ moving: true, dashing: isDashing });

      // Leichte Neigung
      if (this.dom.svg) {
        this.dom.svg.style.transform = `rotate(-5deg)`;
      }

      // Container transform
      this.dom.container.style.transform = `translate3d(-${this.patrol.x}px, ${this.patrol.y}px, 0) rotate(-4deg)`;

      // Phase wechseln wenn angekommen
      if (t >= 1) {
        this.startAnimation.phase = 'pause';
        this.startAnimation.pauseUntil = now + 200;
        this.setAvatarState({ moving: false, dashing: false });
      }

      requestAnimationFrame(this.updateStartAnimation.bind(this));
      return;
    }

    if (this.startAnimation.phase === 'pause') {
      // Kurze Pause
      if (now >= this.startAnimation.pauseUntil) {
        // Sprechblase mit Reaktion
        const reactions = [
          'Autsch! 😵',
          'Ups! Das war hart! 💥',
          'Whoa! 😲',
          'Hey! Nicht schubsen! 😠',
        ];
        const reaction = reactions[Math.floor(Math.random() * reactions.length)];
        this.showBubble(reaction);
        setTimeout(() => this.hideBubble(), 2500);

        // Große Partikel-Explosion
        this.spawnParticleBurst(15, { strength: 2, spread: 180 });

        // Starte Knockback
        this.startAnimation.phase = 'knockback';
        this.startAnimation.knockbackStartTime = now;
        this.startAnimation.knockbackStartX = this.patrol.x;
        this.startAnimation.knockbackStartY = this.patrol.y;
      }

      requestAnimationFrame(this.updateStartAnimation.bind(this));
      return;
    }

    if (this.startAnimation.phase === 'knockback') {
      const elapsed = now - this.startAnimation.knockbackStartTime;
      const t = Math.min(1, elapsed / this.startAnimation.knockbackDuration);

      // Parabolischer Bogen für y (Höhe 50px)
      const arc = Math.sin(t * Math.PI) * 50;
      this.patrol.y = this.startAnimation.knockbackStartY - arc;

      // 200px Rückprall nach rechts
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      this.patrol.x = this.startAnimation.knockbackStartX - 200 * eased;

      // Kippt während des Flugs
      const rotation = -20 + t * 40; // von -20 bis +20 Grad
      if (this.dom.svg) {
        this.dom.svg.style.transform = `rotate(${rotation}deg)`;
      }

      // Container rotation für dramatischen Effekt
      const containerRot = 15 * Math.sin(t * Math.PI * 2);
      this.dom.container.style.transform = `translate3d(-${this.patrol.x}px, ${this.patrol.y}px, 0) rotate(${containerRot}deg)`;

      // Flammen aus während Flug
      if (this.dom.flame) {
        this.dom.flame.style.opacity = '0.2';
      }

      // Partikel während Flug
      if (t < 0.3 && this.dom.particles) {
        this.dom.particles.style.opacity = '1';
      }

      if (t >= 1) {
        // Landung
        this.startAnimation.phase = 'landing';
        this.spawnParticleBurst(8, { strength: 1.5 });

        // Reset to normal state
        setTimeout(() => {
          this.startAnimation.active = false;
          this.patrol.active = true;
          this.patrol.y = 0;
          if (this.dom.svg) {
            this.dom.svg.style.transform = 'rotate(0deg)';
          }
          this.startPatrol();
        }, 300);
      }

      requestAnimationFrame(this.updateStartAnimation.bind(this));
      return;
    }

    if (this.startAnimation.phase === 'landing') {
      // Warte auf normale Patrol
      if (!this.startAnimation.active) return;
      requestAnimationFrame(this.updateStartAnimation.bind(this));
    }
  }

  startPatrol() {
    this.patrol.active = true;
    if (this.dom && this.dom.container) this.dom.container.style.opacity = '1';
    requestAnimationFrame(this.updatePatrol);
  }

  updatePatrol() {
    // Optimization: Pause loop if tab is not visible
    if (document.hidden) {
       setTimeout(() => requestAnimationFrame(this.updatePatrol), 500);
       return;
    }

    if (!this.patrol.active || this.startAnimation.active) {
      if (!this.startAnimation.active) {
        requestAnimationFrame(this.updatePatrol);
      }
      return;
    }
    if (!this.dom.container) {
      requestAnimationFrame(this.updatePatrol);
      return;
    }

    // Optimization: Don't query typeWriter every frame.
    const now = performance.now();
    if (now - this.cacheConfig.lastTypeWriterCheck > this.cacheConfig.typeWriterCheckInterval) {
      this.dom.typeWriter = document.querySelector('.typewriter-title');
      this.cacheConfig.lastTypeWriterCheck = now;
      if (this.dom.typeWriter) {
        // Optional: Cache rect too if it doesn't move often,
        // but getting rect is usually necessary if layout changes
        // this.cacheConfig.typeWriterRect = this.dom.typeWriter.getBoundingClientRect();
      }
    }

    // Stop or idle in certain states
    const isHovering = this.dom.avatar && this.dom.avatar.matches(':hover');
    if (this.state.isOpen || this.patrol.isPaused || isHovering) {
      this.setAvatarState({ moving: false, dashing: false });
      if (this.dom.flame) this.dom.flame.style.opacity = '0';
      if (this.dom.particles) this.dom.particles.style.opacity = '0';
      requestAnimationFrame(this.updatePatrol);
      return;
    }

    const robotWidth = 80;
    const initialLeft = window.innerWidth - 30 - robotWidth;
    let maxLeft = initialLeft - 20;

    let twRect = null;
    if (this.dom.typeWriter) {
      twRect = this.dom.typeWriter.getBoundingClientRect();
      const limit = initialLeft - twRect.right - 50;
      if (limit < maxLeft) maxLeft = limit;
    }

    if (maxLeft < 0) maxLeft = 0;

    if (Math.random() < 0.005 && this.patrol.x > 50 && this.patrol.x < maxLeft - 50) {
      this.patrol.direction *= -1;
    }

    const approachingLimit =
      (this.patrol.direction > 0 && this.patrol.x + 10 >= maxLeft - 20) ||
      (this.patrol.direction < 0 && this.patrol.x - 10 <= 20);

    // Avoidance movement should not trigger for TypeWriter presence; collisions are handled directly.
    if (!this.dom.typeWriter && approachingLimit) {
      // Simple reaction: turn around and emit a small burst & pause
      this.patrol.direction *= -1;
      this.spawnParticleBurst(4, { direction: -this.patrol.direction, strength: 0.9 });
      this.pausePatrol(3000 + Math.random() * 3000);
    }

    // Also run collision detection each frame update, to detect overlaps while moving
    if (this.dom.typeWriter && twRect) {
      this.checkForTypewriterCollision(twRect, maxLeft);
    }

    // Collision detection is handled by checkForTypewriterCollision() to prevent duplicate handling

    if (now > this.motion.dashUntil && Math.random() < this.motion.dashChance) {
      this.motion.dashUntil = now + this.motion.dashDuration;
    }

    const dashActive = now < this.motion.dashUntil;
    if (dashActive && !this._prevDashActive) {
      this.spawnParticleBurst(6, { strength: 1.2 });
    } else if (!dashActive && this._prevDashActive) {
      this.spawnParticleBurst(3, { strength: 0.8 });
    }
    this._prevDashActive = dashActive;

    const baseSpeed = this.motion.baseSpeed + Math.sin(now / 800) * 0.2;
    const currentSpeed = baseSpeed * (dashActive ? this.motion.dashSpeed : 1);

    this.patrol.x += currentSpeed * this.patrol.direction;

    // No path-based sidestep anymore; keep `patrol.x`/`patrol.y` handled by main movement logic and pause behavior.

    this.patrol.bouncePhase += dashActive ? 0.08 : 0.05;
    this.patrol.y = Math.sin(this.patrol.bouncePhase) * (dashActive ? 4 : 3);
    this.animationState = 'moving';

    this.setAvatarState({ moving: true, dashing: dashActive });

    if (this.dom.svg) {
      const baseTilt = this.patrol.direction > 0 ? -5 : 5;
      const tiltIntensity =
        this.startAnimation && this.startAnimation.active ? 1.6 : dashActive ? 1.2 : 1;
      this.dom.svg.style.transform = `rotate(${baseTilt * tiltIntensity}deg)`;
      // Optimization: Inline style is fine here, class transition handles smoothness
    }
    if (this.dom.eyes) this.updateEyesTransform();
    if (this.dom.flame) {
      const flameIntensity =
        this.startAnimation && this.startAnimation.active ? 1.4 : dashActive ? 1.2 : 0.85;
      this.dom.flame.style.opacity = flameIntensity;
      this.dom.flame.style.transform = `scale(${1 + (flameIntensity - 0.7) * 0.4})`;
    }
    if (this.dom.particles) {
      this.dom.particles.style.opacity =
        dashActive || (this.startAnimation && this.startAnimation.active) ? '0.9' : '0.5';
    }

    if (this.dom.legs) {
      // Toggle wiggle class based on state (efficient)
      const shouldWiggle = dashActive || Math.abs(this.patrol.direction) === 1;
      if (this.dom.legs.classList.contains('wiggle') !== shouldWiggle) {
        this.dom.legs.classList.toggle('wiggle', shouldWiggle);
      }
    }

    if (this.patrol.x >= maxLeft) {
      this.patrol.x = maxLeft;
      this.patrol.direction = -1;
      this.pausePatrol(5000 + Math.random() * 5000);
      this.spawnParticleBurst(4, { direction: -1, strength: 1 });
    } else if (this.patrol.x <= 0) {
      this.patrol.x = 0;
      this.patrol.direction = 1;
      this.pausePatrol(5000 + Math.random() * 5000);
      this.spawnParticleBurst(4, { direction: 1, strength: 1 });
    } else {
      if (Math.random() < 0.005) {
        this.pausePatrol(3000 + Math.random() * 4000);
      }
    }

    const containerRotation =
      this.startAnimation && this.startAnimation.active
        ? this.patrol.direction > 0
          ? -6
          : 6
        : dashActive
          ? this.patrol.direction > 0
            ? -4
            : 4
          : 0;

    // Efficient transform update
    this.dom.container.style.transform = `translate3d(-${this.patrol.x}px, ${this.patrol.y}px, 0) rotate(${containerRotation}deg)`;

    requestAnimationFrame(this.updatePatrol);
  }

  pausePatrol(ms) {
    this.patrol.isPaused = true;
    this.animationState = 'idle';
    this.motion.dashUntil = 0;
    this.setAvatarState({ moving: false, dashing: false });
    if (this.dom.flame) this.dom.flame.style.opacity = '0';
    if (this.dom.particles) this.dom.particles.style.opacity = '0';
    if (this.dom.thinking && Math.random() < 0.3) {
      this.dom.thinking.style.opacity = '1';
      setTimeout(() => {
        if (this.dom.thinking) this.dom.thinking.style.opacity = '0';
      }, ms * 0.6);
    }
    setTimeout(() => {
      this.patrol.isPaused = false;
    }, ms);
  }

  scrollToBottom() {
    this.dom.messages.scrollTop = this.dom.messages.scrollHeight;
  }

  // ========== MINI-GAMES ==========

  showMoodInfo() {
    const moodEmojis = {
      'night-owl': '🦉',
      'sleepy': '😴',
      'energetic': '⚡',
      'relaxed': '😊',
      'enthusiastic': '🤩',
      'normal': '🤖',
    };

    const moodDescriptions = {
      'night-owl': 'Nachteule-Modus aktiv! Ich bin hellwach! 🌙',
      'sleepy': 'Etwas verschlafen heute... ☕',
      'energetic': 'Voller Energie und bereit für Action! 💪',
      'relaxed': 'Entspannt und gelassen unterwegs! 🌅',
      'enthusiastic': 'Super enthusiastisch - du bist ja Power-User! 🎉',
      'normal': 'Ganz normaler Roboter-Modus! 🤖',
    };

    const emoji = moodEmojis[this.mood] || '🤖';
    const desc = moodDescriptions[this.mood] || 'Normaler Modus';
    const stats = `
      📊 Deine Stats:
      • Sessions: ${this.analytics.sessions}
      • Interaktionen: ${this.analytics.interactions}
      • Easter Eggs: ${this.easterEggFound.size}
      • Mood: ${emoji} ${this.mood}
    `;

    this.addMessage(desc, 'bot');
    this.addMessage(stats, 'bot');
    setTimeout(() => this.handleAction('start'), 2000);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new RobotCompanion());
} else {
  new RobotCompanion();
}
