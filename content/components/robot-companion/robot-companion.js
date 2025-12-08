/**
 * KI Roboter Begleiter - Extended Edition (Optimized)
 * Performance-Optimierungen: DOM-Caching, RequestAnimationFrame-Nutzung, Refactoring.
 */

import { GeminiService } from './gemini-service.js';

class RobotCompanion {
  constructor() {
    this.containerId = 'robot-companion-container';
    // Referenz auf globale Texte sicherstellen
    this.texts = (window && window.robotCompanionTexts) || {};
    
    this.gemini = new GeminiService();

    this.state = {
      isOpen: false,
      hasGreeted: false,
      isTyping: false,
    };

    // DOM Cache Struktur initialisieren
    this.dom = {};

    // Patrol State
    this.patrol = {
      active: true,
      x: 0,
      y: 0,
      direction: 1,
      speed: 0.3,
      isPaused: false,
      bouncePhase: 0,
    };

    // Performance & Caching Konfiguration
    this.cacheConfig = {
      lastTypeWriterCheck: 0,
      typeWriterCheckInterval: 2000, // Nur alle 2 Sekunden nach dem Titel suchen, statt 60x pro Sekunde
      typeWriterRect: null
    };

    this.motion = {
      baseSpeed: 0.3,
      dashSpeed: 1.2,
      dashChance: 0.0015,
      dashDuration: 900,
      dashUntil: 0,
    };

    this.avoid = {
      active: false,
      startTime: 0,
      duration: 650,
      p0: { x: 0, y: 0 },
      p1: { x: 0, y: 0 },
      p2: { x: 0, y: 0 },
      p3: { x: 0, y: 0 },
      cooldownUntil: 0,
    };

    this.updatePatrol = this.updatePatrol.bind(this);
    this._prevDashActive = false;

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

    // Laden, Anwenden, Starten
    this.loadTexts().then(() => {
      this.applyTexts();
      // Falls noch nicht initialisiert (Race Condition Prevention)
      if (!this.dom.container) this.init();
      
      // AI suggestion disabled to save API quota
      // setTimeout(() => this.fetchAndShowSuggestion(), 5000);
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

    this.knowledgeBase = src.knowledgeBase || this.knowledgeBase || { start: { text: 'Hallo!', options: [] } };
    this.contextGreetings = src.contextGreetings || this.contextGreetings || { default: [] };
    this.startMessageSuffix = src.startMessageSuffix || this.startMessageSuffix || {};
    this.initialBubbleGreetings = src.initialBubbleGreetings || this.initialBubbleGreetings || ['Psst! Brauchst du Hilfe? 👋'];
    this.initialBubblePools = src.initialBubblePools || this.initialBubblePools || [];
    this.initialBubbleSequenceConfig = src.initialBubbleSequenceConfig || this.initialBubbleSequenceConfig || {
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
          this.dom.footer = document.querySelector('footer') || document.querySelector('#site-footer');
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

  init() {
    // Verhindert mehrfache Initialisierung
    if (this.dom.container) return;

    this.loadCSS();
    this.createDOM();
    this.attachEvents();
    this.setupFooterOverlapCheck();

    // Begrüßungslogik
    setTimeout(() => {
      if (!this.state.isOpen && !this.state.hasGreeted) {
        const showSequenceChance = 0.9;
        if (this.initialBubblePools && this.initialBubblePools.length > 0 && Math.random() < showSequenceChance) {
          this.startInitialBubbleSequence();
        } else {
          const greet = this.initialBubbleGreetings[Math.floor(Math.random() * this.initialBubbleGreetings.length)];
          const ctx = this.getPageContext();
          const ctxArr = this.contextGreetings[ctx] || this.contextGreetings.default || [];
          let finalGreet = greet;

          if (ctxArr.length && Math.random() < 0.7) {
            const ctxMsg = String(ctxArr[Math.floor(Math.random() * ctxArr.length)] || '').trim();
            finalGreet = `${String(greet || '').trim()} ${ctxMsg}`.trim();
          }
          this.showBubble(finalGreet);
          this.state.hasGreeted = true;
        }
      }
    }, 5000);

    this.startPatrol();
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
            <div class="robot-bubble" id="robot-bubble">
                <span id="robot-bubble-text">Hallo!</span>
                <div class="robot-bubble-close">&times;</div>
            </div>
            <div class="robot-avatar">${robotSVG}</div>
        `;

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
      this.state.hasGreeted = true;
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

  // ... (startIdleEyeMovement, stopIdleEyeMovement, updateEyesTransform, startBlinkLoop, stopBlinkLoop, doBlink, clearBubbleSequence, startInitialBubbleSequence - diese sind meist okay, nur DOM Zugriff ist jetzt via this.dom.x) ...

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
    if (this._eyeIdleTimer) { clearTimeout(this._eyeIdleTimer); this._eyeIdleTimer = null; }
    this.eyeIdleOffset.x = 0; this.eyeIdleOffset.y = 0;
    this.updateEyesTransform();
  }

  updateEyesTransform() {
    if (!this.dom || !this.dom.eyes) return;
    let eyeOffset = (typeof this.patrol !== 'undefined' && this.patrol.direction > 0) ? -3 : 3;
    const eyeIntensity = (this.avoid && this.avoid.active) ? 1.4 : (this.motion && this.motion.dashUntil > performance.now()) ? 1.2 : 1;
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
      const delay = this.blinkConfig.intervalMin + Math.random() * (this.blinkConfig.intervalMax - this.blinkConfig.intervalMin);
      this._blinkTimer = setTimeout(() => { this.doBlink(); schedule(); }, delay);
    };
    schedule();
  }

  stopBlinkLoop() {
    if (this._blinkTimer) { clearTimeout(this._blinkTimer); this._blinkTimer = null; }
  }

  doBlink() {
    if (!this.dom || !this.dom.eyes) return;
    const lids = this.dom.eyes.querySelectorAll('.robot-lid');
    if (!lids.length) return;
    lids.forEach((l) => l.classList.add('is-blink'));
    setTimeout(() => { lids.forEach((l) => l.classList.remove('is-blink')); }, (this.blinkConfig.duration || 120) + 20);
  }

  clearBubbleSequence() {
    if (!this._bubbleSequenceTimers) return;
    this._bubbleSequenceTimers.forEach(t => clearTimeout(t));
    this._bubbleSequenceTimers = [];
  }

  startInitialBubbleSequence() {
    this.clearBubbleSequence();
    const pools = this.initialBubblePools || [];
    const steps = Math.min(pools.length, this.initialBubbleSequenceConfig.steps || pools.length);
    if (!steps) return;

    const picks = [];
    const ctx = this.getPageContext();
    const ctxArr = (this.contextGreetings && this.contextGreetings[ctx]) || [];

    for (let i = 0; i < steps; i++) {
      let pool = pools[i] && pools[i].length ? [...pools[i]] : [...this.initialBubbleGreetings];
      if (ctxArr.length > 0 && Math.random() < 0.6) pool = pool.concat(ctxArr);
      const pick = pool[Math.floor(Math.random() * pool.length)];
      picks.push(String(pick || '').trim());
    }
    if (picks.length === 0) return;

    const showMs = this.initialBubbleSequenceConfig.displayDuration || 10000;
    const pauses = this.initialBubbleSequenceConfig.pausesAfter || [];

    const schedule = (index) => {
      if (this.state.isOpen) return;
      if (index >= picks.length) { this.state.hasGreeted = true; return; }

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
      if (this.state.hasGreeted || this.state.isOpen) return;
      
      const ctx = this.getPageContext();
      const behavior = {
          page: ctx,
          interests: [ctx]
      };

      try {
          const suggestion = await this.gemini.getSuggestion(behavior);
          if (suggestion && !this.state.isOpen) {
              this.showBubble(suggestion);
              setTimeout(() => this.hideBubble(), 8000);
          }
      } catch (e) {
          // Silent fail
      }
  }

  _cubicBezier(t, p0, p1, p2, p3) {
    const u = 1 - t;
    const tt = t * t, uu = u * u;
    const uuu = uu * u, ttt = tt * t;
    return {
      x: uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
      y: uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y,
    };
  }

  startAvoid(twRect, dir, maxLeft) {
    const now = performance.now();
    if (this.avoid.cooldownUntil && now < this.avoid.cooldownUntil) return;
    this.avoid.cooldownUntil = now + 900;

    const p0x = this.patrol.x;
    const p0y = this.patrol.y;
    const remaining = dir > 0 ? maxLeft - this.patrol.x : this.patrol.x;
    const advance = Math.min(64, Math.max(32, remaining));
    const p3x = Math.min(maxLeft, Math.max(0, this.patrol.x + advance * dir));

    // Safety check for twRect
    const topSafe = twRect ? twRect.top > 200 : true;
    const vertical = (topSafe ? -1 : 1) * (60 + Math.random() * 30);

    this.avoid.p0 = { x: p0x, y: p0y };
    this.avoid.p1 = { x: p0x + advance * 0.35 * dir, y: p0y + vertical * 1.1 };
    this.avoid.p2 = { x: p0x + advance * 0.75 * dir, y: p0y + vertical * 0.55 };
    this.avoid.p3 = { x: p3x, y: p0y };

    this.spawnParticleBurst(6, { direction: this.patrol.direction, strength: 0.9 });
    this.avoid.active = true;
    this.avoid.startTime = now;
    this.avoid.duration = 520 + Math.random() * 400;
    this.animationState = 'avoiding';
  }

  getPageContext() {
     // ... logic stays same, it's efficient enough as it runs rarely ...
    try {
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
        } catch (x) { return false; }
      };

      if (sectionCheck('#hero')) return 'hero';
      if (sectionCheck('#features')) return 'features';
      if (sectionCheck('#about')) return 'about';
      if (sectionCheck('#footer-container') || sectionCheck('footer')) return 'footer';
      if (lower.includes('projekte') || file.includes('projekte')) return 'projects';
      if (lower.includes('gallery') || file.includes('gallery')) return 'gallery';
      if (lower.includes('about') || file.includes('about')) return 'about';
      if (lower.includes('karten') || file.includes('cards')) return 'cards';
      if (lower === '/' || file === 'index.html' || lower.includes('home')) return 'home';

      const h1 = document.querySelector('h1');
      if (h1) {
          const h1Text = (h1.textContent || '').toLowerCase();
          if (h1Text.includes('projekt')) return 'projects';
          if (h1Text.includes('foto') || h1Text.includes('galerie')) return 'gallery';
          if (h1Text.includes('über') || h1Text.includes('about')) return 'about';
      }
      return 'default';
    } catch (e) { return 'default'; }
  }

  spawnParticleBurst(count = 6, { direction = 0, strength = 1 } = {}) {
    if (!this.dom.container) return;
    const rect = this.dom.avatar.getBoundingClientRect();
    const baseX = rect.left + rect.width / 2;
    const baseY = rect.top + rect.height * 0.75;
    const cRect = this.dom.container.getBoundingClientRect();

    for (let i = 0; i < count; i++) {
      const el = document.createElement('div');
      el.className = 'robot-burst-particle';
      this.dom.container.appendChild(el); // Append cached container

      const angleSpread = Math.PI / 3;
      const baseAngle = direction === 0 ? -Math.PI / 2 : direction > 0 ? -Math.PI / 4 : (-3 * Math.PI) / 4;
      const angle = baseAngle + (Math.random() - 0.5) * angleSpread;
      const distance = 40 + Math.random() * 30;
      const dx = Math.cos(angle) * distance * strength;
      const dy = Math.sin(angle) * distance * strength - 10 * strength;

      el.style.left = (baseX - cRect.left - 3) + 'px';
      el.style.top = (baseY - cRect.top - 3) + 'px';

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
      this.state.hasGreeted = true;
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
      this.showTyping();

      try {
          // Collect context (last 5 messages)
          const history = []; 
          // Simple history extraction could be added here if needed
          
          const response = await this.gemini.generateResponse(text, history);
          this.removeTyping();
          this.addMessage(response, 'bot');
      } catch (e) {
          this.removeTyping();
          this.addMessage("Fehler bei der Verbindung.", 'bot');
      }
  }

  async handleSummarize() {
      this.toggleChat(true);
      this.showTyping();
      const content = document.body.innerText;
      const summary = await this.gemini.summarizePage(content);
      this.removeTyping();
      this.addMessage("Zusammenfassung dieser Seite:", 'bot');
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
            this.handleAction(opt.action);
          }
        }, 300);
      };
      this.dom.controls.appendChild(btn);
    });
  }

  handleAction(actionKey) {
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
        // Fallback or logic
        this.addMessage("Ich suche ein Projekt...", 'bot');
        return;
    }

    const data = this.knowledgeBase[actionKey];
    if (!data) return;

    this.showTyping();
    this.dom.avatar.classList.add('nod');
    setTimeout(() => this.dom.avatar.classList.remove('nod'), 650);

    let responseText = Array.isArray(data.text) ? data.text[Math.floor(Math.random() * data.text.length)] : data.text;
    if (actionKey === 'start') {
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

  startPatrol() {
    requestAnimationFrame(this.updatePatrol);
  }

  updatePatrol() {
    if (!this.patrol.active) return;
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

    const approachingLimit = (this.patrol.direction > 0 && this.patrol.x + 10 >= maxLeft - 20) ||
                             (this.patrol.direction < 0 && this.patrol.x - 10 <= 20);

    if (this.dom.typeWriter && twRect && approachingLimit && !this.avoid.active && now > this.avoid.cooldownUntil) {
      this.startAvoid(twRect, this.patrol.direction, maxLeft);
    }

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

    if (this.avoid.active) {
      const t = Math.min(1, (now - this.avoid.startTime) / this.avoid.duration);
      const pt = this._cubicBezier(t, this.avoid.p0, this.avoid.p1, this.avoid.p2, this.avoid.p3);
      this.patrol.x = pt.x;
      this.patrol.y = pt.y;
      if (t >= 1) {
        this.avoid.active = false;
        this.animationState = 'moving';
      }
    }

    this.patrol.bouncePhase += dashActive ? 0.08 : 0.05;
    this.patrol.y = Math.sin(this.patrol.bouncePhase) * (dashActive ? 4 : 3);
    this.animationState = 'moving';

    this.setAvatarState({ moving: true, dashing: dashActive });

    if (this.dom.svg) {
      const baseTilt = this.patrol.direction > 0 ? -5 : 5;
      const tiltIntensity = this.avoid.active ? 1.6 : dashActive ? 1.2 : 1;
      this.dom.svg.style.transform = `rotate(${baseTilt * tiltIntensity}deg)`;
      // Optimization: Inline style is fine here, class transition handles smoothness
    }
    if (this.dom.eyes) this.updateEyesTransform();
    if (this.dom.flame) {
      const flameIntensity = this.avoid.active ? 1.1 : dashActive ? 1 : 0.6;
      this.dom.flame.style.opacity = flameIntensity;
      this.dom.flame.style.transform = `scale(${1 + (flameIntensity - 0.6) * 0.25})`;
    }
    if (this.dom.particles) {
      this.dom.particles.style.opacity = dashActive || this.avoid.active ? '0.9' : '0.5';
    }

    const isMoving = Math.abs(currentSpeed) > 0.02;
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

    const containerRotation = this.avoid.active ? (this.patrol.direction > 0 ? -6 : 6) : (dashActive ? (this.patrol.direction > 0 ? -4 : 4) : 0);

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
      setTimeout(() => { if (this.dom.thinking) this.dom.thinking.style.opacity = '0'; }, ms * 0.6);
    }
    setTimeout(() => { this.patrol.isPaused = false; }, ms);
  }

  scrollToBottom() {
    this.dom.messages.scrollTop = this.dom.messages.scrollHeight;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new RobotCompanion());
} else {
  new RobotCompanion();
}
