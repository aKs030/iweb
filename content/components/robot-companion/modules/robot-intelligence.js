export class RobotIntelligence {
  constructor(robot) {
    this.robot = robot;
    this.mouse = { x: 0, y: 0, lastX: 0, lastY: 0, speed: 0 };
    this.lastMoveTime = Date.now();

    this.scroll = { lastY: 0, speed: 0 };
    this.lastScrollTime = Date.now();

    this.lastInteractionTime = Date.now();
    this.isIdle = false;

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

      this.scroll.lastY = scrollY;
      this.scroll.lastScrollTime = now;

      if (speed > 5) {
        this.triggerScrollReaction();
      }
    }
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
