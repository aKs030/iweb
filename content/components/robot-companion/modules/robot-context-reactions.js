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

    setTimeout(() => {
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
   * Stop monitoring
   */
  stopMonitoring() {
    this.isMonitoring = false;
    // Cleanup listeners if needed
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
      this.scrollVelocity = deltaY / deltaTime;

      // Fast scroll detected (> 3 pixels per ms)
      if (this.scrollVelocity > 3 && !this.robot.chatModule?.isOpen) {
        this.reactToFastScroll();
      }

      this.lastScrollY = currentY;
      lastTime = currentTime;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
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
    document.addEventListener('submit', (e) => {
      if (!this.isMonitoring) return;

      const form = e.target;
      // Check if it's a form element
      if (form && form.tagName === 'FORM') {
        this.reactToFormSubmit();
      }
    });

    // Listen for custom success events
    window.addEventListener('form:success', () => {
      this.reactToFormSuccess();
    });

    window.addEventListener('form:error', () => {
      this.reactToFormError();
    });
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

    setTimeout(() => {
      this.robot.emotionsModule?.setMouthExpression('neutral');
    }, 3000);
  }

  /**
   * Monitor for errors
   */
  setupErrorMonitoring() {
    window.addEventListener('error', (e) => {
      if (!this.isMonitoring) return;

      // Only react to visible errors (not background scripts)
      if (e.error && !this.robot.chatModule?.isOpen) {
        this.reactToError();
      }
    });
  }

  /**
   * React to page error
   */
  reactToError() {
    if (!this.robot.emotionsModule) return;

    this.robot.emotionsModule.showConfused();

    setTimeout(() => {
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

    // Animate pointing
    if (this.robot.dom.avatar) {
      this.robot.dom.avatar.classList.add('pointing');
    }

    // Highlight element
    element.classList.add('robot-highlight');

    // Show message
    this.robot.chatModule?.showBubble(message);

    // Cleanup after 3 seconds
    setTimeout(() => {
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
      if (idleTimer) clearTimeout(idleTimer);

      idleTimer = setTimeout(() => {
        if (!this.isMonitoring || this.robot.chatModule?.isOpen) return;

        this.reactToIdle();
      }, idleTime);
    };

    // Reset on user activity
    ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach(
      (event) => {
        document.addEventListener(event, resetTimer, { passive: true });
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

      setTimeout(() => {
        this.robot.chatModule?.hideBubble();
        this.robot.emotionsModule?.setMouthExpression('neutral');
      }, 3000);
    }
  }
}
