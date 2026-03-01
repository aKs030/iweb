/**
 * Robot Context Reactions Module
 * Handles context-aware reactions to user behavior
 * @version 1.0.0
 */

export class RobotContextReactions {
  constructor(robot) {
    this.robot = robot;
    this.lastScrollY = 0;
    this.scrollVelocity = 0;
    this.isMonitoring = false;
    /** @type {Array<{target: EventTarget, event: string, handler: Function}>} */
    this._listeners = [];
  }

  /**
   * Show a random message from array
   * @param {string[]} messages
   * @param {number} duration
   * @private
   */
  _showRandomMessage(messages, duration = 3000) {
    const randomMessage = messages[Math.floor(Math.random() * messages.length)];
    this.robot.chatModule?.showBubble(randomMessage);

    this.robot._setTimeout(() => {
      this.robot.chatModule?.hideBubble();
    }, duration);
  }

  /**
   * Start monitoring user behavior
   */
  startMonitoring() {
    if (this.isMonitoring) return;
    this.isMonitoring = true;

    this.setupScrollMonitoring();
    this.setupFormMonitoring();
    this.setupErrorMonitoring();
  }

  /**
   * Stop monitoring and cleanup
   */
  stopMonitoring() {
    this.isMonitoring = false;
    this._listeners.forEach(({ target, event, handler }) => {
      target.removeEventListener(event, handler);
    });
    this._listeners = [];
  }

  /**
   * @private
   * @param {EventTarget} target
   * @param {string} event
   * @param {Function} handler
   * @param {Object} [options]
   */
  _addEventListener(target, event, handler, options) {
    target.addEventListener(event, handler, options);
    this._listeners.push({ target, event, handler });
  }

  /**
   * Monitor scroll speed and react
   */
  setupScrollMonitoring() {
    let lastTime = Date.now();

    const handleScroll = () => {
      if (!this.isMonitoring) return;

      const currentY = window.scrollY;
      const currentTime = Date.now();
      const deltaY = Math.abs(currentY - this.lastScrollY);
      const deltaTime = currentTime - lastTime;

      // Calculate velocity (pixels per millisecond)
      this.scrollVelocity = deltaY / Math.max(1, deltaTime);

      // Fast scroll detected (> 3 pixels per ms)
      if (this.scrollVelocity > 3 && !this.robot.chatModule?.isOpen) {
        this.reactToFastScroll();
      }

      this.lastScrollY = currentY;
      lastTime = currentTime;
    };

    this._addEventListener(window, 'scroll', handleScroll, { passive: true });
  }

  /**
   * React to fast scrolling
   */
  reactToFastScroll() {
    if (!this.robot.emotionsModule) return;

    this.robot.emotionsModule.showScared();

    const messages = [
      'Wow, so schnell! 😱',
      'Langsam! Mir wird schwindelig! 🌀',
      'Warte auf mich! 💨',
      'Nicht so hastig! 😵',
    ];

    this._showRandomMessage(messages, 2000);
  }

  /**
   * Monitor form submissions
   */
  setupFormMonitoring() {
    const onFormSubmit = (e) => {
      if (!this.isMonitoring) return;
      const form = e.target;
      if (form && form.tagName === 'FORM') {
        this.reactToFormSubmit();
      }
    };
    this._addEventListener(document, 'submit', onFormSubmit);

    const onFormSuccess = () => {
      if (this.isMonitoring) this.reactToFormSuccess();
    };
    this._addEventListener(window, 'form:success', onFormSuccess);

    const onFormError = () => {
      if (this.isMonitoring) this.reactToFormError();
    };
    this._addEventListener(window, 'form:error', onFormError);
  }

  /**
   * React to form submission
   */
  reactToFormSubmit() {
    if (!this.robot.emotionsModule) return;

    this.robot.emotionsModule.showWorkingHard();
    this.robot.chatModule?.showBubble('Einen Moment... ⏳');
  }

  /**
   * React to successful form submission
   */
  reactToFormSuccess() {
    if (!this.robot.emotionsModule) return;

    this.robot.emotionsModule.celebrate();
    this.robot.emotionsModule.applaud(2000);

    const messages = [
      'Perfekt! Das hat geklappt! 🎉',
      'Geschafft! Super gemacht! ✨',
      'Erfolgreich gesendet! 🚀',
      'Toll! Alles erledigt! 🎊',
    ];

    this._showRandomMessage(messages, 3000);
  }

  /**
   * React to form error
   */
  reactToFormError() {
    if (!this.robot.emotionsModule) return;

    this.robot.emotionsModule.setMouthExpression('sad');
    this.robot.emotionsModule.shakeNo();

    const messages = [
      'Ups! Da ist etwas schiefgelaufen... 😔',
      'Oh nein! Versuch es nochmal! 🔧',
      'Fehler! Lass uns das nochmal prüfen... ❌',
      'Hmm, das hat nicht geklappt... 🤔',
    ];

    this._showRandomMessage(messages, 3000);

    this.robot._setTimeout(() => {
      this.robot.emotionsModule?.setMouthExpression('neutral');
    }, 3000);
  }

  /**
   * Monitor for errors
   */
  setupErrorMonitoring() {
    const onError = (e) => {
      if (!this.isMonitoring) return;
      if (e.error && !this.robot.chatModule?.isOpen) {
        this.reactToError();
      }
    };
    this._addEventListener(window, 'error', onError);
  }

  /**
   * React to page error
   */
  reactToError() {
    if (!this.robot.emotionsModule) return;

    this.robot.emotionsModule.showConfused();

    this.robot._setTimeout(() => {
      this.robot.emotionsModule?.setMouthExpression('neutral');
    }, 2000);
  }

  /**
   * Point to an element on the page
   * @param {HTMLElement} element
   * @param {string} message
   */
  pointToElement(element, message = 'Schau hier! 👉') {
    if (!element || !this.robot.dom.container) return;

    if (this.robot.dom.avatar) {
      this.robot.dom.avatar.classList.add('pointing');
    }

    element.classList.add('robot-highlight');
    this.robot.chatModule?.showBubble(message);

    this.robot._setTimeout(() => {
      this.robot.dom.avatar?.classList.remove('pointing');
      element.classList.remove('robot-highlight');
      this.robot.chatModule?.hideBubble();
    }, 3000);
  }

  /**
   * React to long page visit (idle)
   * @param {number} idleTime - Time in ms
   */
  setupIdleReaction(idleTime = 60000) {
    let idleTimer = null;

    const resetTimer = () => {
      if (idleTimer) this.robot._clearTimeout(idleTimer);

      idleTimer = this.robot._setTimeout(() => {
        if (!this.isMonitoring || this.robot.chatModule?.isOpen) return;
        this.reactToIdle();
      }, idleTime);
    };

    ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach(
      (event) => {
        this._addEventListener(document, event, resetTimer, { passive: true });
      },
    );

    resetTimer();
  }

  /**
   * React to user being idle
   */
  reactToIdle() {
    if (!this.robot.emotionsModule) return;

    this.robot.emotionsModule.sleep(5000);

    const messages = [
      'Zzz... 😴',
      'Bin kurz eingenickt... 💤',
      'Alles okay? Brauchst du Hilfe? 🥱',
    ];

    this._showRandomMessage(messages, 3000);
  }

  /**
   * React to specific page sections
   * @param {string} section - Section name
   */
  reactToSection(section) {
    if (!this.robot.emotionsModule) return;

    const reactions = {
      projects: () => {
        this.robot.emotionsModule.setMouthExpression('happy');
        this.robot.chatModule?.showBubble(
          'Schau dir die coolen Projekte an! 💻',
        );
      },
      gallery: () => {
        this.robot.emotionsModule.spawnHearts(2);
        this.robot.chatModule?.showBubble('Tolle Bilder! 📸');
      },
      contact: () => {
        this.robot.emotionsModule.salute();
        this.robot.chatModule?.showBubble('Lass uns in Kontakt bleiben! ✉️');
      },
      about: () => {
        this.robot.emotionsModule.nodYes();
        this.robot.chatModule?.showBubble('Lerne mehr über den Entwickler! 👨‍💻');
      },
    };

    const reaction = reactions[section];
    if (reaction) {
      reaction();

      this.robot._setTimeout(() => {
        this.robot.chatModule?.hideBubble();
        this.robot.emotionsModule?.setMouthExpression('neutral');
      }, 3000);
    }
  }

  /**
   * Destroy and cleanup
   */
  destroy() {
    this.stopMonitoring();
  }
}
