import { createLogger } from '../../../core/logger.js';

const log = createLogger('RobotIntelligence');

export class RobotIntelligence {
  constructor(robot) {
    this.robot = robot;
    this.mouse = { x: 0, y: 0, lastX: 0, lastY: 0, speed: 0 };
    this.lastMoveTime = Date.now();

    this.lastScrollY = 0;
    this.lastScrollTime = Date.now();
    this.scrollBackAndForth = 0;
    this.lastScrollDirection = 'down';
    this._scrollDecayTimer = null;

    this.lastInteractionTime = Date.now();
    this.isIdle = false;

    this.workerEnabled = false;
    this.decisionWorker = null;
    this._onWorkerMessage = (event) => this.handleWorkerDecision(event?.data);
    this._onWorkerError = (event) => this.handleWorkerError(event);

    // Event-Listener Handler f\u00fcr Cleanup speichern
    this._handlers = {
      mousemove: (e) => this.handleMouseMove(e),
      scroll: () => this.handleScroll(),
      mousedown: () => this.resetIdle(),
      keydown: () => this.resetIdle(),
      touchstart: () => this.resetIdle(),
    };

    this.setupDecisionWorker();
    this.setupListeners();

    // Check idle state every 10 seconds
    this._idleCheckInterval = this.robot._setInterval(
      () => this.checkIdle(),
      10000,
    );
  }

  setupDecisionWorker() {
    if (typeof Worker === 'undefined') return;

    try {
      this.decisionWorker = new Worker(
        new URL('../workers/robot-intelligence.worker.js', import.meta.url),
        { type: 'module' },
      );
      this.decisionWorker.addEventListener('message', this._onWorkerMessage);
      this.decisionWorker.addEventListener('error', this._onWorkerError);
      this.decisionWorker.postMessage({ type: 'init', now: Date.now() });
      this.workerEnabled = true;
    } catch (error) {
      this.workerEnabled = false;
      this.decisionWorker = null;
      log.warn('Worker init failed, falling back to main-thread logic:', error);
    }
  }

  postToWorker(payload) {
    if (!this.workerEnabled || !this.decisionWorker) return;
    try {
      this.decisionWorker.postMessage(payload);
    } catch (error) {
      log.warn('Failed to post robot intelligence payload to worker:', error);
      this.workerEnabled = false;
    }
  }

  handleWorkerError(event) {
    log.warn('Robot intelligence worker error:', event?.message || event);
    this.workerEnabled = false;
  }

  handleWorkerDecision(message) {
    if (!message || typeof message !== 'object') return;
    if (this.robot.chatModule.isOpen) return;

    switch (message.type) {
      case 'hectic':
        this.triggerHecticReaction();
        break;
      case 'scroll-fast':
        this.triggerScrollReaction();
        break;
      case 'frustration':
        this.triggerFrustrationHelp();
        break;
      case 'idle':
        this.isIdle = true;
        this.triggerIdleReaction();
        break;
      case 'idle-reset':
        this.isIdle = false;
        break;
      default:
        break;
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
    if (this._handlers) {
      document.removeEventListener('mousemove', this._handlers.mousemove);
      document.removeEventListener('scroll', this._handlers.scroll);
      ['mousedown', 'keydown', 'touchstart'].forEach((evt) => {
        document.removeEventListener(evt, this._handlers[evt]);
      });
    }

    // Stoppe Idle-Check Interval
    if (this._idleCheckInterval) {
      this.robot._clearInterval(this._idleCheckInterval);
      this._idleCheckInterval = null;
    }

    if (this._scrollDecayTimer) {
      this.robot._clearTimeout(this._scrollDecayTimer);
      this._scrollDecayTimer = null;
    }

    if (this.decisionWorker) {
      try {
        this.decisionWorker.removeEventListener(
          'message',
          this._onWorkerMessage,
        );
        this.decisionWorker.removeEventListener('error', this._onWorkerError);
        this.decisionWorker.terminate();
      } catch {
        /* ignore */
      }
      this.decisionWorker = null;
    }
    this.workerEnabled = false;

    // Clear Referenzen
    this._handlers = null;
  }

  resetIdle() {
    this.lastInteractionTime = Date.now();
    if (this.isIdle) {
      this.isIdle = false;
      // Optional: Wake up reaction?
    }
    this.postToWorker({ type: 'activity', now: Date.now() });
  }

  checkIdle() {
    if (this.workerEnabled) {
      this.postToWorker({
        type: 'idle-check',
        now: Date.now(),
        chatOpen: this.robot.chatModule.isOpen,
      });
      return;
    }

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
    if (this.workerEnabled) {
      this.postToWorker({
        type: 'mousemove',
        now: Date.now(),
        x: e.clientX,
        y: e.clientY,
        chatOpen: this.robot.chatModule.isOpen,
      });
      return;
    }

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
    const scrollY = globalThis.scrollY || 0;
    const currentDirection = scrollY > this.lastScrollY ? 'down' : 'up';

    if (this.workerEnabled) {
      const dt = now - this.lastScrollTime;
      if (dt > 100) {
        this.lastScrollTime = now;
        this.lastScrollY = scrollY;
      }

      this.postToWorker({
        type: 'scroll',
        now,
        scrollY,
        chatOpen: this.robot.chatModule.isOpen,
      });
      return;
    }

    const dt = now - this.lastScrollTime;

    if (dt > 100) {
      const dist = Math.abs(scrollY - this.lastScrollY);
      const speed = dist / dt;

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
      this.lastScrollY = scrollY;
      this.lastScrollTime = now;

      if (speed > 5) {
        this.triggerScrollReaction();
      }

      // Reset back-and-forth counter after 3 seconds of no direction change
      if (this._scrollDecayTimer)
        this.robot._clearTimeout(this._scrollDecayTimer);
      this._scrollDecayTimer = this.robot._setTimeout(() => {
        if (this.scrollBackAndForth > 0) {
          this.scrollBackAndForth = Math.max(0, this.scrollBackAndForth - 1);
        }
        this._scrollDecayTimer = null;
      }, 3000);
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
    this.robot._setTimeout(() => this.robot.chatModule.hideBubble(), 2500);
  }

  triggerFrustrationHelp() {
    if (this.robot.chatModule.isOpen || Math.random() > 0.7) return;

    const helpMessages = [
      '🤔 Suchst du etwas Bestimmtes? Ich kann dir helfen!',
      '💡 Brauchst du Hilfe beim Navigieren? Frag mich einfach!',
      '🎯 Kann ich dir bei der Suche helfen?',
    ];

    const message =
      helpMessages[Math.floor(Math.random() * helpMessages.length)];
    this.robot.chatModule.showBubble(message);
    this.robot._setTimeout(() => this.robot.chatModule.hideBubble(), 6000);
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
    this.robot._setTimeout(() => this.robot.chatModule.hideBubble(), 2000);
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
    this.robot._setTimeout(() => this.robot.chatModule.hideBubble(), 4000);

    // Maybe look at user
    this.robot.animationModule.triggerRandomIdleAnimation();
  }
}
