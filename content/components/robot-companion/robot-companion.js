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
            <path d="M30,60 L70,60 L65,90 L35,90 Z" fill="#0f172a" stroke="#40e0d0" stroke-width="2" />
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

  scrollToBottom() {
    this.dom.messages.scrollTop = this.dom.messages.scrollHeight;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new RobotCompanion());
} else {
  new RobotCompanion();
}
