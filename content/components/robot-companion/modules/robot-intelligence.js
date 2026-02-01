export class RobotIntelligence {
  constructor(robot) {
    this.robot = robot;
    this.mouse = { x: 0, y: 0, lastX: 0, lastY: 0, speed: 0 };
    this.lastMoveTime = Date.now();

    this.scroll = { lastY: 0, speed: 0, direction: 'down' };
    this.lastScrollTime = Date.now();
    this.scrollBackAndForth = 0;
    this.lastScrollDirection = 'down';

    this.lastInteractionTime = Date.now();
    this.isIdle = false;

    // Context-based proactive tips
    this.contextTipsShown = new Set();
    this.pageTimeTracking = {};
    this.currentContext = null;

    // Scroll-based element tracking
    this.elementHighlights = new Map();
    this.lastHighlightedElement = null;
    this.scrollPositionTracking = {
      lastPosition: 0,
      direction: 'down',
      elementsInView: new Set(),
    };
    this._lastElementCheck = 0;

    // Event-Listener Handler f\u00fcr Cleanup speichern
    this._handlers = {
      mousemove: (e) => this.handleMouseMove(e),
      scroll: () => this.handleScroll(),
      mousedown: () => this.resetIdle(),
      keydown: () => this.resetIdle(),
      touchstart: () => this.resetIdle(),
    };

    this.setupListeners();

    // Check idle state every 10 seconds
    this._idleCheckInterval = setInterval(() => this.checkIdle(), 10000);

    // Check for proactive tips every 15 seconds
    this._proactiveTipsInterval = setInterval(
      () => this.checkProactiveTips(),
      15000,
    );

    // Keyword map for intelligent scanning
    this.interestMap = {
      tech: [
        'react',
        'javascript',
        'typescript',
        'three.js',
        'webgl',
        'css',
        'html',
        'node.js',
        'api',
      ],
      creative: [
        'photography',
        'design',
        'art',
        'music',
        'creative',
        'ui/ux',
        'animation',
      ],
      gaming: ['game', 'play', 'score', 'unity', 'unreal', 'godot'],
      backend: ['database', 'sql', 'server', 'cloud', 'docker', 'kubernetes'],
    };

    // Pre-compile regex patterns for performance
    this.keywordRegexMap = {};
    for (const [category, keywords] of Object.entries(this.interestMap)) {
      this.keywordRegexMap[category] = keywords.map((keyword) => {
        const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(`\\b${escapedKeyword}\\b`, 'i');
      });
    }
  }

  setupListeners() {
    // Passive listener for performance
    document.addEventListener('mousemove', this._handlers.mousemove, {
      passive: true,
    });
    document.addEventListener('scroll', this._handlers.scroll, {
      passive: true,
    });
    ['mousedown', 'keydown', 'touchstart'].forEach((evt) => {
      document.addEventListener(evt, this._handlers[evt], { passive: true });
    });
  }

  destroy() {
    // Entferne alle Event-Listener
    document.removeEventListener('mousemove', this._handlers.mousemove);
    document.removeEventListener('scroll', this._handlers.scroll);
    ['mousedown', 'keydown', 'touchstart'].forEach((evt) => {
      document.removeEventListener(evt, this._handlers[evt]);
    });

    // Stoppe Idle-Check Interval
    if (this._idleCheckInterval) {
      clearInterval(this._idleCheckInterval);
      this._idleCheckInterval = null;
    }

    // Stoppe Proactive Tips Interval
    if (this._proactiveTipsInterval) {
      clearInterval(this._proactiveTipsInterval);
      this._proactiveTipsInterval = null;
    }

    // Clear Referenzen
    this._handlers = null;
  }

  resetIdle() {
    this.lastInteractionTime = Date.now();
    if (this.isIdle) {
      this.isIdle = false;
      // Optional: Wake up reaction?
    }
  }

  checkIdle() {
    if (this.robot.chatModule.isOpen) return;

    const now = Date.now();
    const idleTime = now - this.lastInteractionTime;

    // If idle for > 60 seconds
    if (idleTime > 60000 && !this.isIdle) {
      this.isIdle = true;
      this.triggerIdleReaction();
    }
  }

  handleMouseMove(e) {
    this.resetIdle();
    const now = Date.now();
    const dt = now - this.lastMoveTime;

    // Calculate speed every 100ms
    if (dt > 100) {
      const dist = Math.hypot(
        e.clientX - this.mouse.lastX,
        e.clientY - this.mouse.lastY,
      );
      this.mouse.speed = dist / dt; // pixels per ms

      this.mouse.lastX = e.clientX;
      this.mouse.lastY = e.clientY;
      this.lastMoveTime = now;

      // High speed detection (> 3px/ms is very fast)
      if (this.mouse.speed > 3.5) {
        this.triggerHecticReaction();
      }
    }
  }

  handleScroll() {
    this.resetIdle();
    const now = Date.now();
    const dt = now - this.lastScrollTime;

    if (dt > 100) {
      const scrollY =
        typeof globalThis !== 'undefined' ? globalThis.scrollY : 0;
      const dist = Math.abs(scrollY - this.scroll.lastY);
      const speed = dist / dt;

      // Detect scroll direction
      const currentDirection = scrollY > this.scroll.lastY ? 'down' : 'up';

      // Track scroll position for element detection
      this.scrollPositionTracking.lastPosition = scrollY;
      this.scrollPositionTracking.direction = currentDirection;

      // Check for interesting elements in viewport
      this.checkElementsInViewport();

      // Detect back-and-forth scrolling (frustration indicator)
      if (currentDirection !== this.lastScrollDirection) {
        this.scrollBackAndForth++;

        // If user scrolls back and forth 5+ times in short period, offer help
        if (this.scrollBackAndForth >= 5) {
          this.triggerFrustrationHelp();
          this.scrollBackAndForth = 0;
        }
      }

      this.lastScrollDirection = currentDirection;
      this.scroll.lastY = scrollY;
      this.scroll.lastScrollTime = now;

      if (speed > 5) {
        this.triggerScrollReaction();
      }

      // Reset back-and-forth counter after 3 seconds of no direction change
      setTimeout(() => {
        if (this.scrollBackAndForth > 0) {
          this.scrollBackAndForth = Math.max(0, this.scrollBackAndForth - 1);
        }
      }, 3000);
    }
  }

  /**
   * Check for interesting elements in the viewport and highlight them
   */
  checkElementsInViewport() {
    if (this.robot.chatModule.isOpen) return;

    // Throttle checks - only run every 500ms
    const now = Date.now();
    if (this._lastElementCheck && now - this._lastElementCheck < 500) return;
    this._lastElementCheck = now;

    // Define interesting selectors based on context
    const interestingSelectors = this.getInterestingSelectors();
    if (!interestingSelectors.length) return;

    const viewportHeight = window.innerHeight || 0;
    const viewportMiddle = viewportHeight / 2;

    interestingSelectors.forEach(({ selector, message, animation }) => {
      const elements = document.querySelectorAll(selector);

      elements.forEach((element) => {
        const rect = element.getBoundingClientRect();
        const isInViewport = rect.top >= 0 && rect.bottom <= viewportHeight;
        const isNearMiddle =
          Math.abs(rect.top + rect.height / 2 - viewportMiddle) < 100;

        // Element is in viewport and near middle
        if (isInViewport && isNearMiddle) {
          const elementId = this.getElementId(element);

          // Don't highlight same element twice
          if (this.elementHighlights.has(elementId)) return;

          // Don't show too many highlights
          if (this.elementHighlights.size >= 3) return;

          // 30% chance to highlight
          if (Math.random() > 0.3) return;

          this.highlightElement(element, message, animation);
          this.elementHighlights.set(elementId, Date.now());

          // Clean up old highlights after 30 seconds
          setTimeout(() => {
            this.elementHighlights.delete(elementId);
          }, 30000);
        }
      });
    });
  }

  /**
   * Get interesting selectors based on current context
   */
  getInterestingSelectors() {
    const context = this.robot.getPageContext();

    const selectorsByContext = {
      projects: [
        {
          selector: '.project-card:not(.robot-highlighted)',
          message: '👀 Schau dir dieses Projekt an! Es ist richtig cool!',
          animation: 'excitement',
        },
        {
          selector: '.tech-stack:not(.robot-highlighted)',
          message: '⚡ Interessante Technologien hier!',
          animation: 'point',
        },
      ],
      gallery: [
        {
          selector: '.gallery-item:not(.robot-highlighted)',
          message: '📸 Wow, tolles Bild!',
          animation: 'excitement',
        },
      ],
      hero: [
        {
          selector: '.typewriter-title:not(.robot-highlighted)',
          message: '✨ Willkommen auf der Seite!',
          animation: 'wave',
        },
      ],
      about: [
        {
          selector: '.skill-item:not(.robot-highlighted)',
          message: '💪 Beeindruckende Skills!',
          animation: 'point',
        },
      ],
    };

    return selectorsByContext[context] || [];
  }

  /**
   * Generate unique ID for an element
   */
  getElementId(element) {
    if (element.id) return element.id;

    // Generate ID based on element position and content
    const rect = element.getBoundingClientRect();
    const content = element.textContent?.substring(0, 20) || '';
    return `${rect.top}-${rect.left}-${content}`;
  }

  /**
   * Highlight an element and show message
   */
  async highlightElement(element, message, animation) {
    if (!element || this.robot.chatModule.isOpen) return;

    // Add highlight class
    element.classList.add('robot-highlight');
    element.classList.add('robot-highlighted');

    // Show message
    this.robot.chatModule.showBubble(message);

    // Play animation based on type
    switch (animation) {
      case 'excitement':
        await this.robot.animationModule.playExcitementAnimation();
        break;
      case 'point':
        await this.robot.animationModule.pointAtElement(element);
        break;
      case 'wave':
        this.robot.dom.avatar?.classList.add('waving');
        setTimeout(() => {
          this.robot.dom.avatar?.classList.remove('waving');
        }, 1000);
        break;
    }

    // Remove highlight after 3 seconds
    setTimeout(() => {
      element.classList.remove('robot-highlight');
      this.robot.chatModule.hideBubble();
    }, 3000);
  }

  triggerHecticReaction() {
    if (this.robot.chatModule.isOpen || Math.random() > 0.05) return; // Low chance

    const texts = [
      'Whoa, nicht so schnell! 🏎️',
      'Alles okay? Du wirkst eilig! 💨',
      'Ich werde schwindelig... 😵‍💫',
      'Suchst du etwas Bestimmtes? 🔍',
    ];

    const text = texts[Math.floor(Math.random() * texts.length)];
    this.robot.chatModule.showBubble(text);
    setTimeout(() => this.robot.chatModule.hideBubble(), 2500);
  }

  /**
   * Scan visible text for keywords
   * @returns {string|null} detected category
   */
  scanForKeywords() {
    // Optimization: Use textContent instead of innerText to avoid reflow
    // We assume the relevant keywords are in the first 10k characters
    const visibleText = (document.body.textContent || '')
      .slice(0, 10000)
      .toLowerCase();

    // Count matches
    const scores = { tech: 0, creative: 0, gaming: 0, backend: 0 };
    let maxScore = 0;
    let bestCategory = null;

    for (const [category, regexPatterns] of Object.entries(
      this.keywordRegexMap,
    )) {
      for (const regex of regexPatterns) {
        if (regex.test(visibleText)) {
          scores[category]++;
        }
      }
      if (scores[category] > maxScore) {
        maxScore = scores[category];
        bestCategory = category;
      }
    }

    return maxScore > 0 ? bestCategory : null;
  }

  /**
   * Check for proactive tips based on context and user behavior
   */
  checkProactiveTips() {
    if (this.robot.chatModule.isOpen) return;

    const context = this.robot.getPageContext();

    // Track time spent on each context
    if (context !== this.currentContext) {
      this.currentContext = context;
      this.pageTimeTracking[context] = Date.now();
    }

    const timeOnPage =
      Date.now() - (this.pageTimeTracking[context] || Date.now());
    const tipKey = `${context}-${Math.floor(timeOnPage / 30000)}`; // Every 30 seconds

    // Don't show same tip twice
    if (this.contextTipsShown.has(tipKey)) return;

    // Only show tips after user has been on page for at least 20 seconds
    if (timeOnPage < 20000) return;

    // 20% chance to show tip
    if (Math.random() > 0.2) return;

    // Try intelligent keyword scan first
    const detectedCategory = this.scanForKeywords();
    let tip = null;

    if (detectedCategory) {
      const keywordTips = {
        tech: [
          '⚡ Ich sehe, du interessierst dich für Tech! Frag mich nach dem Stack dieser Seite.',
          '💻 React, WebGL, Node.js... ich liebe diese Themen! Soll ich dir mehr erzählen?',
          '🔍 Wusstest du, dass dieser Bot auf einer modernen Microservices-Architektur läuft?',
        ],
        creative: [
          '🎨 Scheint, als hättest du ein Auge für Design! Gefallen dir die Animationen?',
          '✨ Diese UI wurde mit viel Liebe zum Detail gestaltet. Frag mich nach den CSS-Tricks!',
          '📸 Fotografie ist Kunst. Möchtest du wissen, wie die Galerie optimiert ist?',
        ],
        gaming: [
          '🎮 Gamer erkannt! Hast du schon das versteckte Minispiel gefunden?',
          '🕹️ Lust auf eine Runde Tic-Tac-Toe? Sag einfach "Spiel Tic Tac Toe"!',
        ],
        backend: [
          '⚙️ Backend-Interesse? Ich laufe auf Cloudflare Workers!',
          '☁️ Skalierbarkeit ist wichtig. Frag mich, wie diese Seite gehostet wird.',
        ],
      };

      const categoryTips = keywordTips[detectedCategory];
      if (categoryTips && Math.random() < 0.6) {
        // 60% chance to use keyword tip
        tip = categoryTips[Math.floor(Math.random() * categoryTips.length)];
      }
    }

    // Fallback to context-based tip
    if (!tip) {
      tip = this.getContextualTip(context, timeOnPage);
    }

    if (tip) {
      this.contextTipsShown.add(tipKey);
      this.robot.chatModule.showBubble(tip);
      setTimeout(() => this.robot.chatModule.hideBubble(), 8000);
    }
  }

  /**
   * Get contextual tip based on current page context
   */
  getContextualTip(context, timeOnPage) {
    const tips = {
      projects: [
        '💡 Tipp: Klick auf ein Projekt für mehr Details und den Source Code!',
        '🔍 Wusstest du? Du kannst die Projekte nach Technologie filtern!',
        '⚡ Diese Projekte nutzen moderne Web-Technologien wie React und Three.js!',
        '🎯 Suchst du nach einem bestimmten Projekt? Frag mich einfach!',
      ],
      gallery: [
        '📸 Tipp: Alle Bilder sind optimiert für schnelles Laden!',
        '🎨 Die Galerie nutzt Lazy Loading für beste Performance!',
        '🖼️ Möchtest du mehr über die Fotografie-Techniken erfahren?',
        '✨ Jedes Bild wurde sorgfältig ausgewählt und bearbeitet!',
      ],
      hero: [
        '👋 Willkommen! Ich kann dir helfen, die Seite zu erkunden!',
        '🚀 Scroll nach unten, um mehr über die Projekte zu erfahren!',
        '💬 Hast du Fragen? Klick einfach auf mich!',
        '🎯 Diese Seite wurde mit modernen Web-Technologien gebaut!',
      ],
      about: [
        '📚 Hier erfährst du mehr über den Entwickler!',
        '💼 Interessiert an den Skills und Erfahrungen?',
        '🎓 Möchtest du mehr über den Werdegang erfahren?',
      ],
      footer: [
        '📧 Du kannst über das Kontaktformular Kontakt aufnehmen!',
        '🔗 Vergiss nicht, die Social-Media-Links zu checken!',
        '⬆️ Möchtest du zurück nach oben? Ich kann dir helfen!',
      ],
    };

    const contextTips = tips[context] || tips.hero;

    // For longer page visits, show more advanced tips
    if (timeOnPage > 60000) {
      const advancedTips = [
        '🤖 Ich lerne ständig dazu! Frag mich nach technischen Details!',
        '💡 Wusstest du? Ich kann dir Code-Beispiele erklären!',
        '🎮 Ich habe auch ein paar Mini-Games! Frag mich danach!',
      ];
      return advancedTips[Math.floor(Math.random() * advancedTips.length)];
    }

    return contextTips[Math.floor(Math.random() * contextTips.length)];
  }

  /**
   * Trigger help when user seems frustrated
   */
  triggerFrustrationHelp() {
    if (this.robot.chatModule.isOpen || Math.random() > 0.7) return;

    const helpMessages = [
      '🤔 Suchst du etwas Bestimmtes? Ich kann dir helfen!',
      '💡 Brauchst du Hilfe beim Navigieren? Frag mich einfach!',
      '🎯 Kann ich dir bei der Suche helfen?',
      '👋 Hey! Scheint als würdest du etwas suchen. Wie kann ich helfen?',
    ];

    const message =
      helpMessages[Math.floor(Math.random() * helpMessages.length)];
    this.robot.chatModule.showBubble(message);
    setTimeout(() => this.robot.chatModule.hideBubble(), 6000);
  }

  triggerScrollReaction() {
    if (this.robot.chatModule.isOpen || Math.random() > 0.1) return;

    const texts = [
      'Wuiiii! 🎢',
      'Abwärts! 👇',
      'Nicht so schnell scrollen! 📄',
      'Habe ich etwas verpasst? 👀',
    ];
    const text = texts[Math.floor(Math.random() * texts.length)];
    this.robot.chatModule.showBubble(text);
    setTimeout(() => this.robot.chatModule.hideBubble(), 2000);
  }

  triggerIdleReaction() {
    // 30% chance to react on idle
    if (Math.random() > 0.3) return;

    const texts = [
      'Bist du noch da? 😴',
      'Langweilig... 🎵',
      'Brauchst du Hilfe? 👋',
      'Psst... ich bin noch hier! 🤖',
    ];
    const text = texts[Math.floor(Math.random() * texts.length)];
    this.robot.chatModule.showBubble(text);
    setTimeout(() => this.robot.chatModule.hideBubble(), 4000);

    // Maybe look at user
    this.robot.animationModule.triggerRandomIdleAnimation();
  }
}
