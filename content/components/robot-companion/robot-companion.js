/**
 * KI Roboter Begleiter - Extended Edition
 * Eine leichte, interaktive Komponente für die Webseite.
 */

class RobotCompanion {
  constructor() {
    this.containerId = 'robot-companion-container';
    this.state = {
      isOpen: false,
      hasGreeted: false,
      isTyping: false
    };

    // Patrol State
    this.patrol = {
      active: true,
      x: 0,
      y: 0,
      direction: 1,
      speed: 0.3,
      isPaused: false,
      bouncePhase: 0
    };

    this.motion = {
      baseSpeed: 0.3,
      dashSpeed: 1.2,
      dashChance: 0.0015,
      dashDuration: 900,
      dashUntil: 0
    };

    this.avoid = {
      active: false,
      startTime: 0,
      duration: 650,
      p0: { x: 0, y: 0 },
      p1: { x: 0, y: 0 },
      p2: { x: 0, y: 0 },
      p3: { x: 0, y: 0 },
      cooldownUntil: 0
    };

    this.updatePatrol = this.updatePatrol.bind(this);
    this.animationState = 'idle'; // idle, moving, thinking, working
    this._mousePos = { x: 0, y: 0 };
    this._prevDashActive = false;

    // Erweiterte Antworten-Datenbank
    this.knowledgeBase = {
      start: {
        text: 'Hallo! Ich bin Cyber, dein virtueller Assistent. 🤖 Wie kann ich dir heute helfen?',
        options: [
          { label: 'Was kannst du?', action: 'skills' },
          { label: 'Projekte zeigen', action: 'projects' },
          { label: 'Über den Dev', action: 'about' },
          { label: 'Fun & Extras', action: 'extras' }
        ]
      },
      skills: {
        text: 'Ich wurde mit HTML, CSS und reinem JavaScript gebaut! Mein Erschaffer beherrscht aber noch viel mehr: React, Node.js, Python und UI/UX Design. Möchtest du Details?',
        options: [
          { label: 'Tech Stack ansehen', url: '/pages/about/about.html#skills' },
          { label: 'Zurück', action: 'start' }
        ]
      },
      about: {
        text: 'Hinter dieser Seite steckt ein leidenschaftlicher Entwickler, der sauberen Code und modernes Design liebt. 👨‍💻',
        options: [
          { label: 'Zur Bio', url: '/pages/about/about.html' },
          { label: 'Kontakt aufnehmen', action: 'contact' },
          { label: 'Zurück', action: 'start' }
        ]
      },
      projects: {
        text: 'Wir haben einige spannende Projekte hier! Von Web-Apps bis zu Design-Experimenten. Wirf einen Blick in die Galerie.',
        options: [
          { label: 'Zur Galerie', url: '/pages/projekte/projekte.html' },
          { label: 'Ein Zufallsprojekt?', action: 'randomProject' },
          { label: 'Zurück', action: 'start' }
        ]
      },
      contact: {
        text: 'Du findest Kontaktmöglichkeiten im Footer der Seite oder im Impressum. Ich kann dich dorthin scrollen!',
        options: [
          { label: 'Zum Footer scrollen', action: 'scrollFooter' },
          { label: 'Social Media?', action: 'socials' },
          { label: 'Alles klar', action: 'start' }
        ]
      },
      socials: {
        text: 'Vernetze dich gerne! Hier sind die Profile:',
        options: [
          { label: 'GitHub', url: 'https://github.com', target: '_blank' },
          { label: 'LinkedIn', url: 'https://linkedin.com', target: '_blank' },
          { label: 'Zurück', action: 'contact' }
        ]
      },
      extras: {
        text: 'Ein bisschen Spaß muss sein! Was möchtest du?',
        options: [
          { label: 'Witz erzählen', action: 'joke' },
          { label: 'Weltraum Fakt', action: 'fact' },
          { label: 'Zurück', action: 'start' }
        ]
      },
      joke: {
        text: [
          'Was macht ein Pirat am Computer? Er drückt die Enter-Taste! 🏴‍☠️',
          'Warum gehen Geister nicht in den Regen? Damit sie nicht nass werden... nein, damit sie nicht "ge-löscht" werden!',
          'Ein SQL Query kommt in eine Bar, geht zu zwei Tischen und fragt: "Darf ich mich joinen?"',
          'Wie nennt man einen Bumerang, der nicht zurückkommt? Stock.'
        ],
        options: [
          { label: 'Noch einer!', action: 'joke' },
          { label: 'Genug gelacht', action: 'start' }
        ]
      },
      fact: {
        text: [
          'Wusstest du? Ein Tag auf der Venus ist länger als ein Jahr auf der Venus. 🪐',
          'Der Weltraum ist völlig still. Es gibt keine Atmosphäre, die Schall überträgt.',
          'Neutronensterne sind so dicht, dass ein Teelöffel davon 6 Milliarden Tonnen wiegen würde!',
          'Es gibt mehr Sterne im Universum als Sandkörner an allen Stränden der Erde.'
        ],
        options: [
          { label: 'Wow, noch einer!', action: 'fact' },
          { label: 'Zurück', action: 'start' }
        ]
      },
      randomProject: {
        // Logik wird unten in handleAction speziell behandelt, dies ist ein Fallback
        text: 'Ich suche etwas raus...',
        options: []
      }
    };

    this.init();
    this.setupFooterOverlapCheck();
  }

  setupFooterOverlapCheck() {
    // Use a getter or query inside the check function to ensure we always get the current footer
    // (Footer might be injected dynamically)
    
    const checkOverlap = () => {
      const container = document.getElementById(this.containerId);
      const footer = document.querySelector('footer') || document.querySelector('#site-footer');
      
      if (!container || !footer) return;
      
      // Reset to default to measure natural position
      container.style.bottom = ''; 
      
      const rect = container.getBoundingClientRect();
      const fRect = footer.getBoundingClientRect();
      
      // Calculate overlap: (Container Bottom) - (Footer Top - Margin)
      // We want at least 30px distance from footer
      // If footer is minimized (fixed), we need to respect its visual top
      const overlap = Math.max(0, rect.bottom - fRect.top);
      
      if (overlap > 0) {
        // If overlap is detected, push it up
        container.style.bottom = `${30 + overlap}px`;
      } else {
        // If no overlap (e.g. scrolled back up), ensure we reset to CSS default if needed
        // But since we reset at start of function, this is implicit.
      }
    };

    // Initial check
    requestAnimationFrame(checkOverlap);

    // Check on scroll and resize
    window.addEventListener('scroll', () => requestAnimationFrame(checkOverlap), { passive: true });
    window.addEventListener('resize', () => requestAnimationFrame(checkOverlap), { passive: true });
    
    // Check when footer loads
    document.addEventListener('footer:loaded', checkOverlap);
    
    // Polling for robustness
    setInterval(checkOverlap, 500);
  }

  init() {
    this.loadCSS();
    this.createDOM();
    this.attachEvents();

    // Initiale Begrüßung
    setTimeout(() => {
      if (!this.state.isOpen) {
        this.showBubble('Psst! Brauchst du Hilfe? 👋');
      }
    }, 5000);

    this.startPatrol();
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
    const container = document.createElement('div');
    container.id = this.containerId;

    const robotSVG = `
        <svg viewBox="0 0 100 100" class="robot-svg">
            <defs>
                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="2" result="blur"/>
                    <feComposite in="SourceGraphic" in2="blur" operator="over"/>
                </filter>
            </defs>
            <line x1="50" y1="15" x2="50" y2="25" stroke="#40e0d0" stroke-width="2" />
            <circle cx="50" cy="15" r="3" class="robot-antenna-light" fill="#ff4444" />
            <path d="M30,40 a20,20 0 0,1 40,0" fill="#1e293b" stroke="#40e0d0" stroke-width="2" />
            <rect x="30" y="40" width="40" height="15" fill="#1e293b" stroke="#40e0d0" stroke-width="2" />
            <g class="robot-eye">
                <circle cx="40" cy="42" r="4" fill="#40e0d0" filter="url(#glow)" />
                <circle cx="60" cy="42" r="4" fill="#40e0d0" filter="url(#glow)" />
            </g>
            <path class="robot-legs" d="M30,60 L70,60 L65,90 L35,90 Z" fill="#0f172a" stroke="#40e0d0" stroke-width="2" />
            <g class="robot-flame" style="opacity: 0;">
                <path d="M40,90 Q50,120 60,90 Q50,110 40,90" fill="#ff9900" />
                <path d="M45,90 Q50,110 55,90" fill="#ffff00" />
            </g>
            <g class="robot-particles" style="opacity: 0;">
                <circle class="particle" cx="20" cy="50" r="2" fill="#40e0d0" opacity="0.6">
                    <animate attributeName="cy" values="50;30;50" dur="2s" repeatCount="indefinite" />
                </circle>
                <circle class="particle" cx="80" cy="60" r="1.5" fill="#40e0d0" opacity="0.5">
                    <animate attributeName="cy" values="60;40;60" dur="2.5s" repeatCount="indefinite" />
                </circle>
                <circle class="particle" cx="15" cy="70" r="1" fill="#40e0d0" opacity="0.7">
                    <animate attributeName="cy" values="70;50;70" dur="1.8s" repeatCount="indefinite" />
                </circle>
            </g>
            <g class="robot-thinking" style="opacity: 0;">
                <circle cx="70" cy="20" r="8" fill="rgba(64, 224, 208, 0.2)" stroke="#40e0d0" stroke-width="1" />
                <text x="70" y="25" font-size="12" fill="#40e0d0" text-anchor="middle">?</text>
            </g>
            <circle cx="50" cy="70" r="5" fill="#2563eb" opacity="0.8">
                <animate attributeName="opacity" values="0.4;1;0.4" dur="2s" repeatCount="indefinite" />
            </circle>
            <path d="M28,65 Q20,75 28,85" fill="none" stroke="#64748b" stroke-width="3" stroke-linecap="round" />
            <path d="M72,65 Q80,75 72,85" fill="none" stroke="#64748b" stroke-width="3" stroke-linecap="round" />
        </svg>
        `;

    container.innerHTML = `
            <div class="robot-chat-window" id="robot-chat-window">
                <div class="chat-header">
                    <div class="chat-title">
                        <span class="chat-status-dot"></span>
                        Cyber Assistant
                    </div>
                    <button class="chat-close-btn">&times;</button>
                </div>
                <div class="chat-messages" id="robot-messages"></div>
                <div class="chat-controls" id="robot-controls"></div>
            </div>
            
            <div class="robot-bubble" id="robot-bubble">
                <span id="robot-bubble-text">Hallo!</span>
                <div class="robot-bubble-close">&times;</div>
            </div>
            
            <div class="robot-avatar">
                ${robotSVG}
            </div>
        `;

    document.body.appendChild(container);

    this.dom = {
      window: document.getElementById('robot-chat-window'),
      bubble: document.getElementById('robot-bubble'),
      bubbleText: document.getElementById('robot-bubble-text'),
      bubbleClose: container.querySelector('.robot-bubble-close'),
      messages: document.getElementById('robot-messages'),
      controls: document.getElementById('robot-controls'),
      avatar: container.querySelector('.robot-avatar'),
      svg: container.querySelector('.robot-svg'),
      eyes: container.querySelector('.robot-eye'),
      flame: container.querySelector('.robot-flame'),
      legs: container.querySelector('.robot-legs'),
      particles: container.querySelector('.robot-particles'),
      thinking: container.querySelector('.robot-thinking'),
      closeBtn: container.querySelector('.chat-close-btn')
    };
  }

  attachEvents() {
    this.dom.avatar.addEventListener('click', () => this.toggleChat());
    this.dom.closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleChat(false);
    });
    this.dom.bubbleClose.addEventListener('click', (e) => {
      e.stopPropagation();
      this.hideBubble();
    });

    // pointer follow for the eyes (mouse + pointer fallback)
    this._mouseMoveHandler = (e) => {
      this._mousePos.x = e.clientX;
      this._mousePos.y = e.clientY;
      if (!this._eyeRAF) {
        this._eyeRAF = requestAnimationFrame(() => this._updateEyeFollow());
      }
    };
    const prefersCoarse = typeof window !== 'undefined' && (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    if (!prefersCoarse) {
      document.addEventListener('mousemove', this._mouseMoveHandler);
    } else {
      // For touch, use pointer events but with throttling to avoid jitter
      let last = 0;
      this._pointerHandler = (ev) => {
        if (ev.pointerType === 'touch') {
          const now = performance.now();
          if (now - last < 100) return; // throttle
          last = now;
          this._mousePos.x = ev.clientX;
          this._mousePos.y = ev.clientY;
          if (!this._eyeRAF) this._eyeRAF = requestAnimationFrame(() => this._updateEyeFollow());
        }
      };
      document.addEventListener('pointermove', this._pointerHandler, { passive: true });
    }
  }

  _updateEyeFollow() {
    this._eyeRAF = null;
    const eyeMax = 4; // max px offset
    const avatar = this.dom.avatar;
    const eyes = this.dom.eyes;
    if (!avatar || !eyes) return;

    const rect = avatar.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = this._mousePos.x - cx;
    const dy = this._mousePos.y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = (dx / dist) * Math.min(Math.abs(dx), eyeMax);
    const ny = (dy / dist) * Math.min(Math.abs(dy), eyeMax * 0.6);

    eyes.style.transform = `translate(${nx}px, ${ny}px)`;
  }

  // Cubic Bézier interpolation helper
  _cubicBezier(t, p0, p1, p2, p3) {
    const tt = t * t;
    const ttt = tt * t;
    const u = 1 - t;
    const uu = u * u;
    const uuu = uu * u;
    return {
      x: uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
      y: uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y
    };
  }

  startAvoid(twRect, dir, maxLeft) {
    // Avoid only once per cooldown period
    const now = performance.now();
    if (this.avoid.cooldownUntil && now < this.avoid.cooldownUntil) return;
    this.avoid.cooldownUntil = now + 900; // 900ms cooldown

    const p0x = this.patrol.x;
    const p0y = this.patrol.y;
    // Attempt to advance a bit further while dodging but not cross the maxLeft
    const remaining = dir > 0 ? maxLeft - this.patrol.x : this.patrol.x;
    const advance = Math.min(64, Math.max(32, remaining));
    const p3x = Math.min(maxLeft, Math.max(0, this.patrol.x + advance * dir));
    // Decide whether to go up or down based on available space (prefer up)
    const preferUp = twRect.top > 200; // if typewriter is not close to top, go above
    const vertical = (preferUp ? -1 : 1) * (60 + Math.random() * 30);
    // Controls points offer curve — p1 moves outwards and up, p2 brings it back
    const p1x = p0x + (advance * 0.35) * dir;
    const p1y = p0y + vertical * 1.1;
    const p2x = p0x + (advance * 0.75) * dir;
    const p2y = p0y + vertical * 0.55;

    this.avoid.p0 = { x: p0x, y: p0y };
    this.avoid.p1 = { x: p1x, y: p1y };
    this.avoid.p2 = { x: p2x, y: p2y };
    this.avoid.p3 = { x: p3x, y: p0y };
    // spawn a small burst at start of avoidance
    this.spawnParticleBurst(6, { direction: this.patrol.direction, strength: 0.9 });
    this.avoid.active = true;
    this.avoid.startTime = now;
    this.avoid.duration = 520 + Math.random() * 400; // vary duration between ~520-920ms
    this.animationState = 'avoiding';
  }

  spawnParticleBurst(count = 6, { direction = 0, strength = 1 } = {}) {
    const container = document.getElementById(this.containerId);
    if (!container) return;

    const avatar = this.dom.avatar;
    const rect = avatar.getBoundingClientRect();
    const baseX = rect.left + rect.width / 2;
    const baseY = rect.top + rect.height * 0.75;

    for (let i = 0; i < count; i++) {
      const el = document.createElement('div');
      el.className = 'robot-burst-particle';
      container.appendChild(el);

      const seed = Math.random();
      const angleSpread = (Math.PI / 3); // 60deg spread
      const baseAngle = direction === 0 ? -Math.PI / 2 : (direction > 0 ? -Math.PI / 4 : (-3 * Math.PI) / 4);
      const angle = baseAngle + (Math.random() - 0.5) * angleSpread;
      const distance = 40 + Math.random() * 30;
      const dx = Math.cos(angle) * distance * strength;
      const dy = Math.sin(angle) * distance * strength - (10 * strength);

      // position inside container (absolute, using viewport coords), convert to container coords
      const cRect = container.getBoundingClientRect();
      const left = baseX - cRect.left - 3; // -half particle
      const top = baseY - cRect.top - 3;
      el.style.left = left + 'px';
      el.style.top = top + 'px';

      // staggered start
      setTimeout(() => {
        el.style.transform = `translate(${dx}px, ${dy}px) scale(${0.5 + Math.random() * 0.6})`;
        el.style.opacity = '0';
        // trailing blur for faster ones
        if (Math.random() < 0.15) el.style.filter = 'blur(1px)';
      }, Math.random() * 80);

      // cleanup
      setTimeout(() => {
        el.remove();
      }, 900 + Math.random() * 600);
    }
  }

  setAvatarState({ moving = false, dashing = false } = {}) {
    const avatar = this.dom?.avatar;
    if (!avatar) return;
    avatar.classList.toggle('is-moving', moving);
    avatar.classList.toggle('is-dashing', dashing);
  }

  toggleChat(forceState) {
    const newState = forceState !== undefined ? forceState : !this.state.isOpen;

    if (newState) {
      this.dom.window.classList.add('open');
      this.state.isOpen = true;
      this.hideBubble();

      if (this.dom.messages.children.length === 0) {
        this.handleAction('start');
      }
    } else {
      this.dom.window.classList.remove('open');
      this.state.isOpen = false;
    }
  }

  showBubble(text) {
    if (this.state.isOpen) return;
    this.dom.bubbleText.textContent = text;
    this.dom.bubble.classList.add('visible');
  }

  hideBubble() {
    this.dom.bubble.classList.remove('visible');
  }

  // Hilfsfunktion: Typing Indicator anzeigen
  showTyping() {
    if (this.state.isTyping) return;
    this.state.isTyping = true;

    const typingDiv = document.createElement('div');
    typingDiv.className = 'typing-indicator';
    typingDiv.id = 'robot-typing';
    typingDiv.innerHTML = `
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
        `;
    this.dom.messages.appendChild(typingDiv);
    this.scrollToBottom();
  }

  removeTyping() {
    const typingDiv = document.getElementById('robot-typing');
    if (typingDiv) {
      typingDiv.remove();
    }
    this.state.isTyping = false;
  }

  addMessage(text, type = 'bot') {
    const msg = document.createElement('div');
    msg.className = `message ${type}`;
    msg.innerHTML = text; // innerHTML für Links im Text erlaubt
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
        this.clearControls();

        // Kurze Verzögerung bevor der Bot "tippt"
        setTimeout(() => {
          if (opt.url) {
            window.open(opt.url, opt.target || '_self');
            // Nach Redirect Optionen wiederherstellen oder zum Start
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
    // Spezialfälle
    if (actionKey === 'scrollFooter') {
      document.querySelector('footer')?.scrollIntoView({ behavior: 'smooth' });
      this.showTyping();
      setTimeout(() => {
        this.removeTyping();
        this.addMessage('Ich habe dich nach unten gebracht! 👇', 'bot');
        setTimeout(() => this.handleAction('start'), 2000);
      }, 1000);
      return;
    }

    if (actionKey === 'randomProject') {
      const projects = [
        '/pages/projekte/projekte.html'
        // Hier könnten echte Projekt-URLs stehen, fallback zur Übersicht
      ];
      const randomUrl = projects[Math.floor(Math.random() * projects.length)];
      window.location.href = randomUrl;
      return;
    }

    const data = this.knowledgeBase[actionKey];
    if (!data) return;

    // Bot "tippt"
    this.showTyping();

    // Nod to show reaction
    this.dom.avatar.classList.add('nod');
    setTimeout(() => this.dom.avatar.classList.remove('nod'), 650);

    // Simuliere Lese-/Tippzeit basierend auf Textlänge
    const responseText = Array.isArray(data.text)
      ? data.text[Math.floor(Math.random() * data.text.length)]
      : data.text;

    const typingTime = Math.min(Math.max(responseText.length * 15, 800), 2000);

    setTimeout(() => {
      this.removeTyping();
      this.addMessage(responseText, 'bot');

      if (data.options) {
        this.addOptions(data.options);
      }
    }, typingTime);
  }

  startPatrol() {
    requestAnimationFrame(this.updatePatrol);
  }

  updatePatrol() {
    if (!this.patrol.active) return;

    const container = document.getElementById(this.containerId);
    if (!container) {
      requestAnimationFrame(this.updatePatrol);
      return;
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

    // Calculate limits
    const robotWidth = 80;
    const initialLeft = window.innerWidth - 30 - robotWidth;
    let maxLeft = initialLeft - 20; // Default: stop 20px from left edge

    const typeWriter = document.querySelector('.typewriter-title');
    let twRect = null;
    if (typeWriter) {
      twRect = typeWriter.getBoundingClientRect();
      // We want to stop 50px before TypeWriter
      // x < initialLeft - twRect.right - 50
      const limit = initialLeft - twRect.right - 50;
      if (limit < maxLeft) maxLeft = limit;
    }

    if (maxLeft < 0) maxLeft = 0;

    // Random direction change (0.5% chance per frame)
    if (Math.random() < 0.005 && this.patrol.x > 50 && this.patrol.x < maxLeft - 50) {
      this.patrol.direction *= -1;
    }

    // Start avoidance if we are about to hit the TypeWriter area
    const now = performance.now();
    const approachingLimit = (this.patrol.direction > 0 && this.patrol.x + 10 >= maxLeft - 20) || (this.patrol.direction < 0 && this.patrol.x - 10 <= 20);
    if (typeWriter && twRect && approachingLimit && !this.avoid.active && now > this.avoid.cooldownUntil) {
      this.startAvoid(twRect, this.patrol.direction, maxLeft);
    }

    if (now > this.motion.dashUntil && Math.random() < this.motion.dashChance) {
      this.motion.dashUntil = now + this.motion.dashDuration;
    }

    const dashActive = now < this.motion.dashUntil;
    // detect dash start/stop to spawn bursts
    if (dashActive && !this._prevDashActive) {
      // dash just started
      this.spawnParticleBurst(6, { strength: 1.2 });
    } else if (!dashActive && this._prevDashActive) {
      // dash ended
      this.spawnParticleBurst(3, { strength: 0.8 });
    }
    this._prevDashActive = dashActive;

    // Organic speed variation + dash boost
    const baseSpeed = this.motion.baseSpeed + Math.sin(now / 800) * 0.2;
    const currentSpeed = baseSpeed * (dashActive ? this.motion.dashSpeed : 1);

    // Update x
    this.patrol.x += currentSpeed * this.patrol.direction;

    // If avoiding, compute bezier progression
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

    // Update bounce (vertical movement)
    this.patrol.bouncePhase += dashActive ? 0.08 : 0.05;
    this.patrol.y = Math.sin(this.patrol.bouncePhase) * (dashActive ? 4 : 3);

    // Set animation state
    this.animationState = 'moving';

    // Visual updates: Face direction & Flame & Particles
    this.setAvatarState({ moving: true, dashing: dashActive });
    // direction 1 (Left) -> Tilt left (-5deg), Eyes left (-3px)
    // direction -1 (Right) -> Tilt right (5deg), Eyes right (3px)
    if (this.dom.svg) {
      const baseTilt = this.patrol.direction > 0 ? -5 : 5;
      const tiltIntensity = this.avoid.active ? 1.6 : (dashActive ? 1.2 : 1);
      const tilt = baseTilt * tiltIntensity;
      this.dom.svg.style.transform = `rotate(${tilt}deg)`;
      this.dom.svg.style.transition = 'transform 0.4s ease';
    }
    if (this.dom.eyes) {
      const eyeOffset = this.patrol.direction > 0 ? -3 : 3;
      const eyeIntensity = this.avoid.active ? 1.4 : (dashActive ? 1.2 : 1);
      this.dom.eyes.style.transform = `translateX(${eyeOffset * eyeIntensity}px)`;
      this.dom.eyes.style.transition = 'transform 0.4s ease';
    }
    if (this.dom.flame) {
      // stronger flame during dodge/dash
      const flameIntensity = this.avoid.active ? 1.1 : (dashActive ? 1 : 0.6);
      this.dom.flame.style.opacity = flameIntensity;
      this.dom.flame.style.transform = `scale(${1 + (flameIntensity - 0.6) * 0.25})`;
    }
    if (this.dom.particles) {
      this.dom.particles.style.opacity = dashActive || this.avoid.active ? '0.9' : '0.5';
    }
    const isMoving = Math.abs(currentSpeed) > 0.02;
    if (this.dom.legs) {
      this.dom.legs.classList.toggle('wiggle', dashActive || isMoving);
    }
    if (this.dom.legs) {
      this.dom.legs.classList.toggle('wiggle', dashActive || Math.abs(this.patrol.direction) === 1);
    }

    // Check bounds
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
      // Random pause (increased chance and duration)
      if (Math.random() < 0.005) {
        this.pausePatrol(3000 + Math.random() * 4000);
      }
    }

    const containerRotation = this.avoid.active ? (this.patrol.direction > 0 ? -6 : 6) : (dashActive ? (this.patrol.direction > 0 ? -4 : 4) : 0);
    container.style.transform = `translate3d(-${this.patrol.x}px, ${this.patrol.y}px, 0) rotate(${containerRotation}deg)`;
    requestAnimationFrame(this.updatePatrol);
  }

  pausePatrol(ms) {
    this.patrol.isPaused = true;
    this.animationState = 'idle';
    this.motion.dashUntil = 0;
    this.setAvatarState({ moving: false, dashing: false });
    if (this.dom.flame) {
      this.dom.flame.style.opacity = '0';
    }
    if (this.dom.particles) {
      this.dom.particles.style.opacity = '0';
    }
    // Show thinking bubble during pause
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
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new RobotCompanion());
} else {
  new RobotCompanion();
}
