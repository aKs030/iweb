export class RobotAnimation {
  constructor(robot) {
    this.robot = robot;

    // Patrol State
    this.patrol = {
      active: false,
      x: 0,
      y: 0,
      direction: 1,
      isPaused: false,
      bouncePhase: 0,
    };

    // Start Animation State
    this.startAnimation = {
      active: false,
      phase: 'idle',
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

    // Performance & Caching Config
    this.cacheConfig = {
      lastTypeWriterCheck: 0,
      typeWriterCheckInterval: 2000,
      typeWriterRect: null,
    };

    this.motion = {
      baseSpeed: 0.3,
      dashSpeed: 1.2,
      dashChance: 0.0015,
      dashDuration: 900,
      dashUntil: 0,
    };

    this._prevDashActive = false;

    // Idle eye animation
    this.eyeIdleOffset = { x: 0, y: 0 };
    /** @type {ReturnType<typeof setTimeout> | null} */
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
    /** @type {ReturnType<typeof setTimeout> | null} */
    this._blinkTimer = null;

    // Search Animation State
    this.searchAnimation = {
      active: false,
      phase: 'idle',
      startTime: 0,
      startX: 0,
      startY: 0,
      targetX: 0,
      targetY: 0,
      hoverPhase: 0,
    };
    this.defaultMagnifyingGlassTransform =
      'translate(22, 82) rotate(-45) scale(0.9)';
    /** @type {number | null} */
    this.searchAnimationFrame = null;

    // Bind loop
    this.updatePatrol = this.updatePatrol.bind(this);
    this.updateStartAnimation = this.updateStartAnimation.bind(this);
    this.updateSearchAnimation = this.updateSearchAnimation.bind(this);

    this.thinkingActive = false;
    this.speakingActive = false;
    /** @type {ReturnType<typeof setTimeout> | null} */
    this._speakingTimer = null;

    // NOTE: flame DOM may not exist at constructor time; we moved the
    // suspicious colour-fixing logic into a dedicated helper that can be
    // invoked once the robot container has been built.
  }

  /**
   * Managed async wait using the robot's timer system (respects cleanup).
   * @param {number} ms
   */
  _wait(ms) {
    return new Promise((resolve) => this.robot._setTimeout(resolve, ms));
  }

  /**
   * Make sure flame paths have the correct fill colours and reset
   * opacity. Call after DOM references are cached.
   */
  ensureFlameColors() {
    if (this._flameInitDone) return;
    this._flameInitDone = true;
    if (this.robot.dom && this.robot.dom.flame) {
      // Fill colours are now set by CSS (.robot-flame path rules).
      // Only reset opacity/scale so nothing leaks from a previous session.
      this.robot.dom.flame.style.opacity = '0';
      this.robot.dom.flame.style.transform = 'scale(1)';
    }
  }

  /**
   * Shared AABB overlap test between the robot's visible hitbox and a rect.
   * Reused by naturalApproach and any caller that needs a precise "is touching" check.
   * @param {DOMRect} targetRect
   * @param {number} [shrinkX=10]
   * @param {number} [shrinkY=6]
   * @returns {boolean}
   */
  _robotIntersectsTypewriter(targetRect, shrinkX = 10, shrinkY = 6) {
    if (!targetRect || !this.robot.dom) return false;
    const sourceEl =
      this.robot.dom.svg || this.robot.dom.avatar || this.robot.dom.container;
    if (!sourceEl) return false;
    const rRaw = sourceEl.getBoundingClientRect();
    const rRect = {
      left: rRaw.left + shrinkX,
      right: rRaw.right - shrinkX,
      top: rRaw.top + shrinkY,
      bottom: rRaw.bottom - shrinkY,
    };
    const intersects = !(
      targetRect.right < rRect.left ||
      targetRect.left > rRect.right ||
      targetRect.bottom < rRect.top ||
      targetRect.top > rRect.bottom
    );
    if (!intersects) return false;
    const overlapX =
      Math.min(targetRect.right, rRect.right) -
      Math.max(targetRect.left, rRect.left);
    const overlapY =
      Math.min(targetRect.bottom, rRect.bottom) -
      Math.max(targetRect.top, rRect.top);
    return overlapX >= 6 && overlapY >= 6;
  }

  startSpeaking() {
    if (this.speakingActive) return;
    this.speakingActive = true;
    this.startSpeakingLoop();
  }

  stopSpeaking() {
    if (!this.speakingActive) return;
    this.speakingActive = false;
    if (this._speakingTimer) {
      this.robot._clearTimeout(this._speakingTimer);
      this._speakingTimer = null;
    }
    // Reset antenna color
    if (this.robot.dom.antenna) {
      const antenna = this.robot.dom.antenna;
      if (antenna) {
        antenna.style.fill = '';
        antenna.style.filter = '';
      }
    }
  }

  startSpeakingLoop() {
    if (!this.speakingActive) return;

    // Simulate "talking" by flashing antenna randomly
    const duration = 100 + Math.random() * 150;
    const isLit = Math.random() > 0.3;

    if (this.robot.dom.antenna) {
      const antenna = this.robot.dom.antenna;
      if (antenna) {
        if (isLit) {
          antenna.style.fill = '#40e0d0'; // Cyan
          antenna.style.filter = 'drop-shadow(0 0 8px #40e0d0)';
        } else {
          antenna.style.fill = '';
          antenna.style.filter = '';
        }
      }
    }

    // Check again before scheduling to prevent race condition
    if (!this.speakingActive) return;

    this._speakingTimer = this.robot._setTimeout(
      () => this.startSpeakingLoop(),
      duration + 50,
    );
  }

  startThinking() {
    if (this.thinkingActive) return;
    this.thinkingActive = true;

    if (this.robot.dom.antenna) {
      const antenna = this.robot.dom.antenna;
      if (antenna) {
        antenna.classList.add('is-thinking');
      }
    }

    if (this.robot.dom.eyes) {
      this.stopIdleEyeMovement();
      this.robot.dom.eyes.classList.add('is-thinking');
    }
  }

  stopThinking() {
    if (!this.thinkingActive) return;
    this.thinkingActive = false;

    if (this.robot.dom.antenna) {
      const antenna = this.robot.dom.antenna;
      if (antenna) {
        antenna.classList.remove('is-thinking');
      }
    }

    if (this.robot.dom.eyes) {
      this.robot.dom.eyes.classList.remove('is-thinking');
      this.startIdleEyeMovement();
    }
  }

  triggerKnockback() {
    if (!this.robot.dom.container) return;
    if (this.startAnimation.active) return;

    // Stop patrol – knockback takes over
    this.patrol.active = false;

    const now = performance.now();
    this.startAnimation.active = true;
    this.startAnimation.phase = 'knockback';
    this.startAnimation.knockbackStartTime = now;
    this.startAnimation.knockbackDuration = 900;
    this.startAnimation.knockbackStartX = this.patrol.x;
    this.startAnimation.knockbackStartY = this.patrol.y;
    // Random landing position so robot doesn't always end up at the same spot
    this.startAnimation.knockbackEndX = Math.round(10 + Math.random() * 70);

    this.robot._requestAnimationFrame(this.updateStartAnimation);
  }

  /**
   * Entry animation dispatcher – randomly picks one of several
   * entry animations each time the page loads for variety.
   */
  startTypeWriterKnockbackAnimation() {
    // Guard: don't restart if an entry animation is already running
    if (this.startAnimation.active) return;

    const typeWriter = document.querySelector('.typewriter-title');
    if (!typeWriter || !this.robot.dom.container) {
      if (this.robot.dom.container) {
        this.robot.dom.container.style.opacity = '1';
      }
      this.startPatrol();
      return;
    }

    const variants = [
      () => this._entryKnockback(typeWriter),
      () => this._entryDropIn(),
      () => this._entryZoomSpin(),
      () => this._entrySlideIn(),
      () => this._entryGlitchIn(),
    ];
    const pick = variants[Math.floor(Math.random() * variants.length)];
    pick();
  }

  // ── Entry Animation Variants ──────────────────────────────────

  /** @param {string[]} arr */
  _randomPick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  /** Original: Robot appears at default position and naturally patrols to text */
  _entryKnockback(typeWriter) {
    const twRect = typeWriter.getBoundingClientRect();
    const robotWidth = 80;
    const windowWidth =
      typeof globalThis !== 'undefined' ? globalThis.innerWidth : 0;
    const initialLeft = windowWidth - 30 - robotWidth;

    const gap = 12;
    const spaceRight = windowWidth - twRect.right - 30;
    let targetLeft =
      spaceRight >= robotWidth + gap
        ? twRect.right + gap
        : twRect.left - robotWidth - gap;
    targetLeft = Math.max(8, Math.min(initialLeft - 20, targetLeft));

    const targetX = Math.max(20, Math.round(initialLeft - targetLeft));

    this.startAnimation.active = true;
    this.patrol.x = Math.max(0, targetX - 200);
    this.patrol.y = 0;
    this.patrol.bouncePhase = 0;

    this.robot.dom.container.style.transform = `translate3d(${-this.patrol.x}px, 0px, 0)`;
    if (this.robot.dom.floatWrapper) {
      this.robot.dom.floatWrapper.style.transform = 'rotate(0deg)';
    }
    this.robot.dom.container.style.opacity = '1';
    this._startNaturalApproach(targetX);
  }

  /** Robot drops from above the viewport with a bounce landing */
  _entryDropIn() {
    const startY = -(globalThis.innerHeight || 800);
    this.patrol.x = 0;
    this.patrol.y = startY;
    this.patrol.direction = -1;
    this.patrol.bouncePhase = 0;

    this.startAnimation.active = true;
    this.startAnimation.phase = 'entryDropIn';
    this.startAnimation.startTime = performance.now();
    this.startAnimation.knockbackStartY = startY;
    this.startAnimation.duration = 900;

    this.robot.dom.container.style.transform = `translate3d(0px, ${startY}px, 0)`;
    if (this.robot.dom.floatWrapper) {
      this.robot.dom.floatWrapper.style.transform = 'rotate(0deg)';
    }
    // Show robot now that start position is off-screen
    this.robot.dom.container.style.opacity = '1';
    this.robot._requestAnimationFrame(this.updateStartAnimation);
  }

  /** Robot zooms in from tiny with a spin */
  _entryZoomSpin() {
    this.patrol.x = 0;
    this.patrol.y = 0;

    this.startAnimation.active = true;
    this.startAnimation.phase = 'entryZoomSpin';
    this.startAnimation.startTime = performance.now();
    this.startAnimation.duration = 1000;

    if (this.robot.dom.floatWrapper) {
      this.robot.dom.floatWrapper.style.transform = 'scale(0.05) rotate(0deg)';
      this.robot.dom.floatWrapper.style.opacity = '0';
    }
    this.robot.dom.container.style.transform = 'translate3d(0px, 0px, 0)';
    // Show container (floatWrapper handles fade-in via its own opacity)
    this.robot.dom.container.style.opacity = '1';
    this.robot._requestAnimationFrame(this.updateStartAnimation);
  }

  /** Robot slides in from the right edge */
  _entrySlideIn() {
    this.patrol.x = -300;
    this.patrol.y = 0;
    this.patrol.direction = 1;
    this.patrol.bouncePhase = 0;

    this.startAnimation.active = true;
    this.startAnimation.phase = 'entrySlideIn';
    this.startAnimation.startTime = performance.now();
    this.startAnimation.startX = -300;
    this.startAnimation.duration = 1200;

    this.robot.dom.container.style.transform = 'translate3d(300px, 0px, 0)';
    if (this.robot.dom.floatWrapper) {
      this.robot.dom.floatWrapper.style.transform = 'rotate(-15deg)';
    }
    // Show robot now that it's positioned off-screen right
    this.robot.dom.container.style.opacity = '1';
    this.robot._requestAnimationFrame(this.updateStartAnimation);
  }

  /** Robot appears with glitch/teleport effect */
  _entryGlitchIn() {
    this.patrol.x = 0;
    this.patrol.y = 0;

    this.startAnimation.active = true;
    this.startAnimation.phase = 'entryGlitchIn';
    this.startAnimation.startTime = performance.now();
    this.startAnimation.duration = 1400;

    this.robot.dom.container.style.transform = 'translate3d(0px, 0px, 0)';
    if (this.robot.dom.floatWrapper) {
      this.robot.dom.floatWrapper.style.opacity = '0';
    }
    // Show container (floatWrapper handles visibility via its own opacity)
    this.robot.dom.container.style.opacity = '1';
    this.robot._requestAnimationFrame(this.updateStartAnimation);
  }

  /** Clean up any entry animation state and transition to patrol */
  _finishEntry(bubble) {
    // Immediately mark phase as finishing so no phase handler re-fires
    this.startAnimation.phase = 'finishing';

    if (bubble) {
      this.robot.showBubble(bubble);
      this.robot._setTimeout(() => this.robot.hideBubble(), 2500);
    }
    const endX = this.startAnimation.knockbackEndX || 0;
    this.robot._setTimeout(() => {
      this.startAnimation.active = false;
      this.startAnimation.phase = 'idle';
      this.patrol.x = endX;
      this.patrol.y = 0;
      if (this.robot.dom.svg) {
        this.robot.dom.svg.style.transform = 'rotate(0deg)';
      }
      if (this.robot.dom.floatWrapper) {
        this.robot.dom.floatWrapper.style.transform = 'rotate(0deg)';
        this.robot.dom.floatWrapper.style.opacity = '';
      }
      this.robot.dom.container.style.transform = `translate3d(${-endX}px, 0px, 0)`;
      this.setAvatarState({ moving: false, dashing: false });
      this.startPatrol();
    }, 300);
  }

  /**
   * Transition from a completed entry variant into a natural patrol
   * that eventually collides with the typewriter text → knockback.
   * @param {string} [bubble] - Optional bubble message from the entry variant
   */
  _transitionToTextKnockback(bubble) {
    if (bubble) {
      this.robot.showBubble(bubble);
      this.robot._setTimeout(() => this.robot.hideBubble(), 1800);
    }

    // Reset variant-specific transforms
    this.patrol.y = 0;
    if (this.robot.dom.svg) {
      this.robot.dom.svg.style.transform = 'rotate(0deg)';
    }
    if (this.robot.dom.floatWrapper) {
      this.robot.dom.floatWrapper.style.transform = 'rotate(0deg)';
      this.robot.dom.floatWrapper.style.opacity = '';
    }
    this.setAvatarState({ moving: false, dashing: false });

    // Find typewriter text for collision target
    const typeWriter = document.querySelector('.typewriter-title');
    if (!typeWriter || !this.robot.dom.container) {
      this._finishEntry(null);
      return;
    }

    const twRect = typeWriter.getBoundingClientRect();
    const robotWidth = 80;
    const windowWidth = globalThis.innerWidth || 0;
    const initialLeft = windowWidth - 30 - robotWidth;
    const gap = 12;
    const spaceRight = windowWidth - twRect.right - 30;
    let targetLeft =
      spaceRight >= robotWidth + gap
        ? twRect.right + gap
        : twRect.left - robotWidth - gap;
    targetLeft = Math.max(8, Math.min(initialLeft - 20, targetLeft));

    const targetX = Math.max(20, Math.round(initialLeft - targetLeft));
    this._startNaturalApproach(targetX);
  }

  /**
   * Begin a natural patrol-like approach toward the text.
   * The robot walks left and right with random pauses and direction
   * changes, subtly biased toward the text. On contact → knockback.
   * @param {number} targetX - patrol.x value at which collision occurs
   */
  _startNaturalApproach(targetX) {
    const now = performance.now();

    this.startAnimation.phase = 'naturalApproach';
    this.startAnimation.targetX = targetX;
    this.startAnimation.startTime = now;
    // Pause scheduling
    this.startAnimation.naturalPauseUntil = 0;
    this.startAnimation.naturalNextPauseAt = now + 1000 + Math.random() * 1500;
    // Don't wander further right than ~80px behind start
    this.startAnimation.naturalMinX = Math.max(this.patrol.x - 80, -20);

    this.patrol.direction = 1; // start toward text (left)
    this.patrol.bouncePhase = this.patrol.bouncePhase || 0;

    this.robot.dom.container.style.transform = `translate3d(${-this.patrol.x}px, 0px, 0)`;
    this.robot._requestAnimationFrame(this.updateStartAnimation);
  }

  updateStartAnimation() {
    if (!this.startAnimation.active || !this.robot.dom.container) {
      return;
    }

    const now = performance.now();

    if (this.startAnimation.phase === 'naturalApproach') {
      // ── Pause handling ──
      if (now < this.startAnimation.naturalPauseUntil) {
        this.setAvatarState({ moving: false, dashing: false });
        if (this.robot.dom.legs) this.robot.dom.legs.classList.remove('wiggle');
        if (this.robot.dom.flame) this.robot.dom.flame.style.opacity = '0';
        this.robot._requestAnimationFrame(this.updateStartAnimation);
        return;
      }

      // ── Trigger random pauses ──
      if (now > this.startAnimation.naturalNextPauseAt) {
        const pauseDuration = 800 + Math.random() * 2200; // sehr lange Pausen
        this.startAnimation.naturalPauseUntil = now + pauseDuration;
        this.startAnimation.naturalNextPauseAt =
          now + pauseDuration + 1200 + Math.random() * 1800;
        // Öfter Richtung wechseln während Pause
        if (Math.random() < 0.45) this.patrol.direction *= -1;
        this.setAvatarState({ moving: false, dashing: false });
        if (this.robot.dom.legs) this.robot.dom.legs.classList.remove('wiggle');
        this.robot._requestAnimationFrame(this.updateStartAnimation);
        return;
      }

      // ── Random direction changes (biased toward text) ──
      const goingTowardText = this.patrol.direction > 0;
      if (goingTowardText) {
        // Gelegentlich kurz wegdrehen – sieht zufälliger aus
        if (Math.random() < 0.005) this.patrol.direction = -1;
      } else {
        // Langsamer zurückdrehen – wirkt natürlicher
        if (Math.random() < 0.018) this.patrol.direction = 1;
      }

      // Don't wander too far right past start
      const minX = this.startAnimation.naturalMinX || -20;
      if (this.patrol.x <= minX) {
        this.patrol.direction = 1;
      }

      // ── Movement with gentle randomised walking speed ──
      // Recalculate random component only every 25 frames to avoid
      // calling Math.random() 60× per second unnecessarily.
      this._naturalSpeedFrame = ((this._naturalSpeedFrame || 0) + 1) % 40;
      if (
        this._naturalSpeedFrame === 0 ||
        this._naturalSpeedCached === undefined
      ) {
        this._naturalSpeedCached = 0.12 + Math.random() * 0.13; // 0.12–0.25 px/frame
      }
      const baseSpeed = this._naturalSpeedCached + Math.sin(now / 1600) * 0.04;
      this.patrol.x += baseSpeed * this.patrol.direction;

      // Natural bounce – sehr subtil
      this.patrol.bouncePhase += 0.028;
      this.patrol.y = Math.sin(this.patrol.bouncePhase) * 1.5;

      // Walking state
      this.setAvatarState({ moving: true, dashing: false });
      if (this.robot.dom.legs) this.robot.dom.legs.classList.add('wiggle');

      // Flame – etwas sichtbarer, damit sie nicht komplett transparent wirkt
      if (this.robot.dom.flame) {
        this.robot.dom.flame.style.opacity = '0.6';
        this.robot.dom.flame.style.transform = 'scale(1)';
      }

      // Direction-dependent tilt – minimal
      const tilt = this.patrol.direction > 0 ? -1.5 : 1.5;
      if (this.robot.dom.svg) {
        this.robot.dom.svg.style.transform = `rotate(${tilt}deg)`;
      }

      this.robot.dom.container.style.transform = `translate3d(${-this.patrol.x}px, ${this.patrol.y}px, 0)`;
      if (this.robot.dom.floatWrapper) {
        const ft = this.patrol.direction > 0 ? -1 : 1;
        this.robot.dom.floatWrapper.style.transform = `rotate(${ft}deg)`;
      }

      // ── Collision check: use cached typewriter rect where possible ──
      const typeWriter = this.robot.getTypewriterElement();
      if (typeWriter && this.robot.dom.container) {
        const now2 = now; // alias for clarity
        const cache = this.cacheConfig;
        if (
          !cache.typeWriterRect ||
          now2 - cache.lastTypeWriterCheck > cache.typeWriterCheckInterval
        ) {
          cache.typeWriterRect = typeWriter.getBoundingClientRect();
          cache.lastTypeWriterCheck = now2;
        }
        if (this._robotIntersectsTypewriter(cache.typeWriterRect)) {
          // precise contact
          this.patrol.x = this.startAnimation.targetX;
          this.startAnimation.phase = 'pause';
          this.startAnimation.pauseUntil = now + 250;
          this.setAvatarState({ moving: false, dashing: false });
          if (this.robot.dom.legs)
            this.robot.dom.legs.classList.remove('wiggle');
        }
      }

      this.robot._requestAnimationFrame(this.updateStartAnimation);
      return;
    }

    if (this.startAnimation.phase === 'pause') {
      if (now >= this.startAnimation.pauseUntil) {
        const reactions = [
          'Autsch! 😵',
          'Ups! Das war hart! 💥',
          'Whoa! 😲',
          'Hey! Nicht schubsen! 😠',
        ];
        const reaction =
          reactions[Math.floor(Math.random() * reactions.length)];
        this.robot.showBubble(reaction);
        this.robot._setTimeout(() => this.robot.hideBubble(), 2500);

        this.spawnParticleBurst(18, { strength: 2.5, spread: 220 });

        this.startAnimation.phase = 'knockback';
        this.startAnimation.knockbackStartTime = now;
        this.startAnimation.knockbackDuration = 900;
        this.startAnimation.knockbackStartX = this.patrol.x;
        this.startAnimation.knockbackStartY = this.patrol.y;
        // Random landing position instead of always right edge
        this.startAnimation.knockbackEndX = Math.round(10 + Math.random() * 70);
      }

      this.robot._requestAnimationFrame(this.updateStartAnimation);
      return;
    }

    if (this.startAnimation.phase === 'knockback') {
      const elapsed = now - this.startAnimation.knockbackStartTime;
      const t = Math.min(1, elapsed / this.startAnimation.knockbackDuration);

      // Higher arc trajectory (more dramatic)
      const arc = Math.sin(t * Math.PI) * 70;
      this.patrol.y = this.startAnimation.knockbackStartY - arc;

      // Fly back from collision point to random landing position
      // Use elastic ease-out for bouncy dramatic effect
      const eased =
        t === 1 ? 1 : 1 - Math.pow(2, -10 * t) * Math.cos(t * Math.PI * 2.5);
      const endX = this.startAnimation.knockbackEndX || 0;
      this.patrol.x =
        this.startAnimation.knockbackStartX +
        (endX - this.startAnimation.knockbackStartX) * eased;

      // More dramatic tumble rotation
      const rotation = -25 + t * 50;
      if (this.robot.dom.svg) {
        this.robot.dom.svg.style.transform = `rotate(${rotation}deg)`;
      }

      const containerRot = 20 * Math.sin(t * Math.PI * 2.5);
      this.robot.dom.container.style.transform = `translate3d(${-this.patrol.x}px, ${this.patrol.y}px, 0)`;
      if (this.robot.dom.floatWrapper) {
        this.robot.dom.floatWrapper.style.transform = `rotate(${containerRot}deg)`;
      }

      // Flash effect on impact start
      if (t < 0.1 && this.robot.dom.svg) {
        this.robot.dom.svg.style.filter =
          'brightness(2) drop-shadow(0 0 8px #fff)';
      } else if (t >= 0.1 && t < 0.15 && this.robot.dom.svg) {
        this.robot.dom.svg.style.filter = '';
      }

      if (this.robot.dom.flame) {
        // flare up immediately after collision, then fade to a moderate glow
        let flameVal;
        if (t < 0.2) {
          flameVal = 1; // full intensity right after hit
        } else {
          flameVal = 0.5 + (1 - t) * 0.5; // settle back toward 0.5
        }
        this.robot.dom.flame.style.opacity = `${flameVal}`;
        // slight scale effect when at peak
        const scaleVal = 1 + (1 - t) * 0.5;
        this.robot.dom.flame.style.transform = `scale(${scaleVal})`;
      }

      if (t < 0.3 && this.robot.dom.particles) {
        this.robot.dom.particles.style.opacity = '1';
      }

      if (t >= 1) {
        this.startAnimation.phase = 'landing';
        this.spawnParticleBurst(8, { strength: 1.5 });

        const landX = this.startAnimation.knockbackEndX || 0;
        this.robot._setTimeout(() => {
          this.startAnimation.active = false;
          this.startAnimation.phase = 'idle';
          this.patrol.active = true;
          this.patrol.x = landX;
          this.patrol.y = 0;
          // Walk away from text after knockback
          this.patrol.direction = -1;
          if (this.robot.dom.svg) {
            this.robot.dom.svg.style.transform = 'rotate(0deg)';
          }
          if (this.robot.dom.floatWrapper) {
            this.robot.dom.floatWrapper.style.transform = 'rotate(0deg)';
          }
          this.robot.dom.container.style.transform = `translate3d(${-landX}px, 0px, 0)`;
          this.startPatrol();
        }, 300);
      }

      this.robot._requestAnimationFrame(this.updateStartAnimation);
      return;
    }

    if (this.startAnimation.phase === 'landing') {
      if (!this.startAnimation.active) return;
      this.robot._requestAnimationFrame(this.updateStartAnimation);
      return;
    }

    // ── Random entry animation phase handlers ────────────────────
    this._updateEntryPhases(now);
  }

  /**
   * Handle frame updates for the random entry animation variants.
   * @param {number} now - Current timestamp from performance.now()
   */
  _updateEntryPhases(now) {
    if (this.startAnimation.phase === 'entryDropIn') {
      const elapsed = now - this.startAnimation.startTime;
      const t = Math.min(1, elapsed / this.startAnimation.duration);

      // Gravity-like fall then bounce
      let eased;
      if (t < 0.6) {
        const ft = t / 0.6;
        eased = ft * ft; // Accelerating fall
      } else {
        const bt = (t - 0.6) / 0.4;
        eased = 1 - Math.abs(Math.sin(bt * Math.PI * 2)) * (1 - bt) * 0.25;
      }

      const startY = this.startAnimation.knockbackStartY;
      this.patrol.y = startY * (1 - eased);

      // Tilt during fall, stabilize on landing
      const tilt = t < 0.6 ? -12 * (t / 0.6) : -12 + 12 * ((t - 0.6) / 0.4);
      if (this.robot.dom.svg) {
        this.robot.dom.svg.style.transform = `rotate(${tilt}deg)`;
      }

      if (this.robot.dom.flame) {
        this.robot.dom.flame.style.opacity = `${t < 0.6 ? 0.3 + t : 1 - (t - 0.6) / 0.4}`;
      }

      this.setAvatarState({ moving: true, dashing: t < 0.6 });
      this.robot.dom.container.style.transform = `translate3d(0px, ${this.patrol.y}px, 0)`;

      if (t >= 1) {
        this.spawnParticleBurst(10, { strength: 1.5, spread: 180 });
        const msg = this._randomPick([
          'Gelandet! 🛬',
          'Touchdown! 🪂',
          'Hallo von oben! 🌤️',
          'Anflug beendet! ✈️',
        ]);
        this._transitionToTextKnockback(msg);
        return;
      }

      this.robot._requestAnimationFrame(this.updateStartAnimation);
      return;
    }

    if (this.startAnimation.phase === 'entryZoomSpin') {
      const elapsed = now - this.startAnimation.startTime;
      const t = Math.min(1, elapsed / this.startAnimation.duration);

      // Ease-out cubic with overshoot
      const eased = 1 - Math.pow(1 - t, 3);
      const scale = 0.05 + 0.95 * eased;
      const rotation = (1 - eased) * 720; // 2 full spins
      const opacity = Math.min(1, eased * 2);

      if (this.robot.dom.floatWrapper) {
        this.robot.dom.floatWrapper.style.transform = `scale(${scale}) rotate(${rotation}deg)`;
        this.robot.dom.floatWrapper.style.opacity = `${opacity}`;
      }

      if (t >= 1) {
        this.spawnParticleBurst(8, { strength: 1.2, spread: 360 });
        const msg = this._randomPick([
          'Tada! ✨',
          'Und da bin ich! 🌀',
          'Einmal Drehung bitte! 🎪',
          'Materialisation abgeschlossen! 🔮',
        ]);
        this._transitionToTextKnockback(msg);
        return;
      }

      this.robot._requestAnimationFrame(this.updateStartAnimation);
      return;
    }

    if (this.startAnimation.phase === 'entrySlideIn') {
      const elapsed = now - this.startAnimation.startTime;
      const t = Math.min(1, elapsed / this.startAnimation.duration);

      // Elastic ease-out
      const eased =
        t === 1 ? 1 : 1 - Math.pow(2, -10 * t) * Math.cos(t * Math.PI * 3);

      this.patrol.x = this.startAnimation.startX * (1 - eased);
      this.patrol.bouncePhase += 0.08;
      this.patrol.y = Math.sin(this.patrol.bouncePhase) * 4;

      const tilt = -15 * (1 - eased);
      if (this.robot.dom.floatWrapper) {
        this.robot.dom.floatWrapper.style.transform = `rotate(${tilt}deg)`;
      }

      this.setAvatarState({ moving: true, dashing: t < 0.5 });
      if (this.robot.dom.flame) {
        this.robot.dom.flame.style.opacity = `${1 - eased}`;
      }

      this.robot.dom.container.style.transform = `translate3d(${-this.patrol.x}px, ${this.patrol.y}px, 0)`;

      if (t >= 1) {
        this.spawnParticleBurst(6, { strength: 1, direction: 1 });
        const msg = this._randomPick([
          'Da bin ich! 👋',
          'Psst… Hey! 🤫',
          'Alles klar hier? 😊',
          'Bin eingetroffen! 🚀',
        ]);
        this._transitionToTextKnockback(msg);
        return;
      }

      this.robot._requestAnimationFrame(this.updateStartAnimation);
      return;
    }

    if (this.startAnimation.phase === 'entryGlitchIn') {
      const elapsed = now - this.startAnimation.startTime;
      const t = Math.min(1, elapsed / this.startAnimation.duration);

      // Glitch: rapid random visibility flickers + position jitter
      const flickerRate = t < 0.6 ? 0.45 : 0.85;
      const isVisible = Math.random() < flickerRate;

      if (this.robot.dom.floatWrapper) {
        this.robot.dom.floatWrapper.style.opacity = isVisible ? '1' : '0';

        if (t < 0.6 && isVisible) {
          const jX = (Math.random() - 0.5) * 50;
          const jY = (Math.random() - 0.5) * 50;
          this.robot.dom.floatWrapper.style.transform = `translate(${jX}px, ${jY}px)`;
        } else if (t >= 0.6) {
          const settle = (t - 0.6) / 0.4;
          const jScale = (1 - settle) * 12;
          const jX = (Math.random() - 0.5) * jScale;
          const jY = (Math.random() - 0.5) * jScale;
          this.robot.dom.floatWrapper.style.transform = `translate(${jX}px, ${jY}px)`;
        }
      }

      // Random glitch particles
      if (Math.random() < 0.12) {
        this.spawnParticleBurst(2, { strength: 0.8, spread: 360 });
      }

      if (t >= 1) {
        this.spawnParticleBurst(12, { strength: 1.5, spread: 360 });
        const msg = this._randomPick([
          '*bzzt* Online! ⚡',
          'System bereit! 🔌',
          'Verbindung hergestellt! 📡',
          'Initialisierung… fertig! 🤖',
        ]);
        this._transitionToTextKnockback(msg);
        return;
      }

      this.robot._requestAnimationFrame(this.updateStartAnimation);
    }
  }

  startPatrol() {
    this.patrol.active = true;
    if (this.robot.dom && this.robot.dom.container)
      this.robot.dom.container.style.opacity = '1';
    this.robot._requestAnimationFrame(this.updatePatrol);
  }

  updatePatrol() {
    if (document.hidden) {
      this.robot._setTimeout(
        () => this.robot._requestAnimationFrame(this.updatePatrol),
        500,
      );
      return;
    }

    if (
      !this.patrol.active ||
      this.startAnimation.active ||
      this.searchAnimation.active
    ) {
      return;
    }
    if (!this.robot.dom.container) {
      this.robot._requestAnimationFrame(this.updatePatrol);
      return;
    }

    const now = performance.now();
    const typeWriter = this.robot.getTypewriterElement();
    const twRect = typeWriter ? typeWriter.getBoundingClientRect() : null;

    const isHovering =
      this.robot.dom.avatar && this.robot.dom.avatar.matches(':hover');
    if (this.robot.chatModule.isOpen || this.patrol.isPaused || isHovering) {
      this.setAvatarState({ moving: false, dashing: false });
      if (this.robot.dom.flame) this.robot.dom.flame.style.opacity = '0';
      if (this.robot.dom.particles)
        this.robot.dom.particles.style.opacity = '0';
      this.robot._requestAnimationFrame(this.updatePatrol);
      return;
    }

    const robotWidth = 80;
    const initialLeft =
      (typeof globalThis !== 'undefined' ? globalThis.innerWidth : 0) -
      30 -
      robotWidth;
    let maxLeft = initialLeft - 20;
    if (maxLeft < 0) maxLeft = 0;

    if (
      Math.random() < 0.005 &&
      this.patrol.x > 50 &&
      this.patrol.x < maxLeft - 50
    ) {
      this.patrol.direction *= -1;
    }

    const approachingLimit =
      (this.patrol.direction > 0 && this.patrol.x + 10 >= maxLeft - 20) ||
      (this.patrol.direction < 0 && this.patrol.x - 10 <= 20);

    // Collision Check via Module
    this.robot.collisionModule.scanForCollisions();

    if (!typeWriter && approachingLimit) {
      this.patrol.direction *= -1;
      this.spawnParticleBurst(4, {
        direction: -this.patrol.direction,
        strength: 0.9,
      });
      this.pausePatrol(3000 + Math.random() * 3000);
    }

    if (typeWriter && twRect) {
      this.robot.collisionModule.checkForTypewriterCollision(twRect, maxLeft);
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

    this.patrol.bouncePhase += dashActive ? 0.08 : 0.05;
    this.patrol.y = Math.sin(this.patrol.bouncePhase) * (dashActive ? 4 : 3);
    this.robot.animationState = 'moving';

    this.setAvatarState({ moving: true, dashing: dashActive });

    if (this.robot.dom.svg) {
      const baseTilt = this.patrol.direction > 0 ? -5 : 5;
      const tiltIntensity =
        this.startAnimation && this.startAnimation.active
          ? 1.6
          : dashActive
            ? 1.2
            : 1;
      this.robot.dom.svg.style.transform = `rotate(${
        baseTilt * tiltIntensity
      }deg)`;
    }
    if (this.robot.dom.eyes) this.updateEyesTransform();
    if (this.robot.dom.flame) {
      const flameIntensity =
        this.startAnimation && this.startAnimation.active
          ? 0.9
          : dashActive
            ? 0.85
            : 0.75;
      this.robot.dom.flame.style.opacity = `${flameIntensity}`;
      this.robot.dom.flame.style.transform = `scale(${1 + (flameIntensity - 0.7) * 0.4})`;
    }
    if (this.robot.dom.particles) {
      this.robot.dom.particles.style.opacity =
        dashActive || (this.startAnimation && this.startAnimation.active)
          ? '0.9'
          : '0.5';
    }

    if (this.robot.dom.legs) {
      const shouldWiggle = dashActive || Math.abs(this.patrol.direction) === 1;
      if (this.robot.dom.legs.classList.contains('wiggle') !== shouldWiggle) {
        this.robot.dom.legs.classList.toggle('wiggle', shouldWiggle);
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

    this.robot.dom.container.style.transform = `translate3d(-${this.patrol.x}px, ${this.patrol.y}px, 0)`;
    if (this.robot.dom.floatWrapper) {
      this.robot.dom.floatWrapper.style.transform = `rotate(${containerRotation}deg)`;
    }

    this.robot._requestAnimationFrame(this.updatePatrol);
  }

  pausePatrol(ms) {
    this.patrol.isPaused = true;
    this.robot.animationState = 'idle';
    this.motion.dashUntil = 0;
    this.setAvatarState({ moving: false, dashing: false });
    if (this.robot.dom.flame) this.robot.dom.flame.style.opacity = '0';
    if (this.robot.dom.particles) this.robot.dom.particles.style.opacity = '0';

    this.triggerRandomIdleAnimation();

    if (this.robot.dom.thinking && Math.random() < 0.3) {
      this.robot.dom.thinking.style.opacity = '1';
      this.robot._setTimeout(() => {
        if (this.robot.dom.thinking)
          this.robot.dom.thinking.style.opacity = '0';
      }, ms * 0.6);
    }
    this.robot._setTimeout(() => {
      this.patrol.isPaused = false;
      this.resetIdleAnimations();
    }, ms);
  }

  triggerRandomIdleAnimation() {
    const r = Math.random();
    if (r < 0.3) {
      this.robot.dom.avatar.classList.add('waving');
    } else if (r < 0.6) {
      this.robot.dom.avatar.classList.add('check-watch');
      if (this.robot.dom.eyes) {
        this.robot.dom.eyes.style.transform = 'translate(-2px, 4px)';
      }
    } else {
      if (this.robot.dom.eyes) {
        this.robot.dom.eyes.style.transform = `translate(${
          Math.random() * 4 - 2
        }px, ${Math.random() * 2 - 1}px)`;
      }
    }
  }

  resetIdleAnimations() {
    if (this.robot.dom.avatar) {
      this.robot.dom.avatar.classList.remove('waving');
      this.robot.dom.avatar.classList.remove('check-watch');
    }
  }

  /**
   * @param {number} count
   * @param {{direction?: number, strength?: number, spread?: number | null}} options
   */
  spawnParticleBurst(
    count = 6,
    { direction = 0, strength = 1, spread = null } = {},
  ) {
    if (!this.robot.dom.container) return;
    const rect = this.robot.dom.avatar.getBoundingClientRect();
    const baseX = rect.left + rect.width / 2;
    const baseY = rect.top + rect.height * 0.75;
    const cRect = this.robot.dom.container.getBoundingClientRect();

    for (let i = 0; i < count; i++) {
      const el = document.createElement('div');
      el.className = 'robot-burst-particle';
      const size =
        4 + Math.round(3 + Math.random() * 4) * Math.min(1.2, strength);
      el.style.width = `${size}px`;
      el.style.height = `${size}px`;
      if (strength > 1.5 && Math.random() < 0.35) {
        el.style.filter = 'blur(0.9px)';
        el.style.opacity = '0.9';
      }
      this.robot.dom.container.appendChild(el);

      let angle;
      if (spread !== null) {
        const spreadRad = (spread * Math.PI) / 180;
        const baseAngle = -Math.PI / 2;
        angle = baseAngle + (Math.random() - 0.5) * spreadRad;
      } else {
        const angleSpread = Math.PI / 3;
        const baseAngle =
          direction === 0
            ? -Math.PI / 2
            : direction > 0
              ? -Math.PI / 4
              : (-3 * Math.PI) / 4;
        angle = baseAngle + (Math.random() - 0.5) * angleSpread;
      }

      const distance = 40 + Math.random() * 30;
      const dx = Math.cos(angle) * distance * strength;
      const dy = Math.sin(angle) * distance * strength - 10 * strength;

      el.style.left = baseX - cRect.left - size / 2 + 'px';
      el.style.top = baseY - cRect.top - size / 2 + 'px';

      this.robot._requestAnimationFrame(() => {
        el.style.transform = `translate(${dx}px, ${dy}px) scale(${
          0.5 + Math.random() * 0.6
        })`;
        el.style.opacity = '0';
        if (Math.random() < 0.15) el.style.filter = 'blur(1px)';
      });

      this.robot._setTimeout(() => el.remove(), 900 + Math.random() * 600);
    }
  }

  setAvatarState({ moving = false, dashing = false } = {}) {
    if (!this.robot.dom.avatar) return;
    this.robot.dom.avatar.classList.toggle('is-moving', moving);
    this.robot.dom.avatar.classList.toggle('is-dashing', dashing);
  }

  spawnFlameParticle() {
    if (!this.robot.dom.container || !this.robot.dom.avatar) return;
    const el = document.createElement('div');
    el.style.cssText = `
        position: absolute;
        width: 4px; height: 4px;
        background: #ff9900;
        border-radius: 50%;
        pointer-events: none;
        opacity: 0.7;
        mix-blend-mode: screen;
        transition: transform 0.6s ease-out, opacity 0.6s ease-out;
        will-change: transform, opacity;
    `;

    const rect = this.robot.dom.avatar.getBoundingClientRect();
    const cRect = this.robot.dom.container.getBoundingClientRect();
    // Center bottom of avatar
    const startX = rect.left + rect.width / 2 - cRect.left;
    const startY = rect.top + rect.height - 15 - cRect.top;

    el.style.left = startX - 2 + 'px';
    el.style.top = startY + 'px';

    this.robot.dom.container.appendChild(el);

    this.robot._requestAnimationFrame(() => {
      const dx = (Math.random() - 0.5) * 10;
      const dy = 15 + Math.random() * 15;
      el.style.transform = `translate(${dx}px, ${dy}px) scale(0)`;
      el.style.opacity = '0';
    });

    this.robot._setTimeout(() => el.remove(), 600);
  }

  async playPokeAnimation() {
    if (!this.robot.dom.avatar) {
      return;
    }

    const effects = ['jump', 'shake', 'flash'];
    const effect = effects[Math.floor(Math.random() * effects.length)];

    if (effect === 'jump') {
      this.robot.dom.avatar.style.transition =
        'transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
      this.robot.dom.avatar.style.transform = 'translateY(-20px) scale(1.1)';

      await new Promise((resolve) => {
        this.robot._setTimeout(() => {
          this.robot.dom.avatar.style.transform = '';
          this.robot._setTimeout(resolve, 200);
        }, 200);
      });
    } else if (effect === 'shake') {
      this.robot.dom.avatar.animate(
        [
          { transform: 'translateX(0)' },
          { transform: 'translateX(-5px) rotate(-5deg)' },
          { transform: 'translateX(5px) rotate(5deg)' },
          { transform: 'translateX(-5px) rotate(-5deg)' },
          { transform: 'translateX(0)' },
        ],
        { duration: 300 },
      );
      await this._wait(350);
    } else {
      if (this.robot.dom.svg) {
        this.robot.dom.svg.style.filter =
          'brightness(2) drop-shadow(0 0 10px #fff)';
      }
      await new Promise((resolve) => {
        this.robot._setTimeout(() => {
          if (this.robot.dom.svg) this.robot.dom.svg.style.filter = '';
          this.robot._setTimeout(resolve, 100);
        }, 150);
      });
    }
  }

  startIdleEyeMovement() {
    this.stopIdleEyeMovement();
    const cfg = this.eyeIdleConfig;
    const scheduleNext = () => {
      const delay =
        cfg.intervalMin + Math.random() * (cfg.intervalMax - cfg.intervalMin);
      this._eyeIdleTimer = this.robot._setTimeout(() => {
        const targetX = (Math.random() * 2 - 1) * cfg.amplitudeX;
        const targetY = (Math.random() * 2 - 1) * cfg.amplitudeY;
        this.eyeIdleOffset.x = targetX;
        this.eyeIdleOffset.y = targetY;
        this.updateEyesTransform();
        const t = this.robot._setTimeout(() => {
          this.eyeIdleOffset.x = 0;
          this.eyeIdleOffset.y = 0;
          this.updateEyesTransform();
          scheduleNext();
        }, cfg.moveDuration);
        // @ts-ignore - setTimeout return type compatibility
        this._eyeIdleTimer = t || this._eyeIdleTimer;
      }, delay);
    };
    scheduleNext();
  }

  stopIdleEyeMovement() {
    if (this._eyeIdleTimer) {
      this.robot._clearTimeout(this._eyeIdleTimer);
      this._eyeIdleTimer = null;
    }
    this.eyeIdleOffset.x = 0;
    this.eyeIdleOffset.y = 0;
    this.updateEyesTransform();
  }

  updateEyesTransform() {
    if (!this.robot.dom || !this.robot.dom.eyes) return;
    const eyeOffset =
      typeof this.patrol !== 'undefined' && this.patrol.direction > 0 ? -3 : 3;
    const eyeIntensity =
      (this.startAnimation && this.startAnimation.active) ||
      this.patrol.isPaused
        ? 1.4
        : this.motion && this.motion.dashUntil > performance.now()
          ? 1.2
          : 1;
    const baseX = eyeOffset * eyeIntensity;
    const totalX = baseX + (this.eyeIdleOffset.x || 0);
    const totalY = this.eyeIdleOffset.y || 0;
    this.robot.dom.eyes.style.transform = `translate(${totalX}px, ${totalY}px)`;
    this.robot.dom.eyes.style.transition = 'transform 0.6s ease';
  }

  startBlinkLoop() {
    this.stopBlinkLoop();
    const schedule = () => {
      const delay =
        this.blinkConfig.intervalMin +
        Math.random() *
          (this.blinkConfig.intervalMax - this.blinkConfig.intervalMin);
      this._blinkTimer = this.robot._setTimeout(() => {
        this.doBlink();
        schedule(); // Schedule next blink after current one completes
      }, delay);
    };
    schedule();
  }

  stopBlinkLoop() {
    if (this._blinkTimer) {
      this.robot._clearTimeout(this._blinkTimer);
      this._blinkTimer = null;
    }
  }

  doBlink() {
    if (!this.robot.dom || !this.robot.dom.eyes) return;
    const lids = this.robot.dom.lids;
    if (!lids.length) return;
    lids.forEach((l) => l.classList.add('is-blink'));
    this.robot._setTimeout(
      () => {
        lids.forEach((l) => l.classList.remove('is-blink'));
      },
      (this.blinkConfig.duration || 120) + 20,
    );
  }

  /**
   * Show excitement animation (jumping with particles)
   */
  async playExcitementAnimation() {
    if (!this.robot.dom.avatar) return;

    // Jump animation
    this.robot.dom.avatar.style.transition =
      'transform 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
    this.robot.dom.avatar.style.transform =
      'translateY(-30px) scale(1.15) rotate(5deg)';

    // Spawn particles
    this.spawnParticleBurst(12, { strength: 1.5, spread: 360 });

    // Flash antenna
    if (this.robot.dom.antenna) {
      const antenna = this.robot.dom.antenna;
      if (antenna) {
        antenna.style.fill = '#ffff00';
        antenna.style.filter = 'drop-shadow(0 0 8px #ffff00)';
      }
    }

    await this._wait(300);

    this.robot.dom.avatar.style.transform = 'translateY(0) scale(1) rotate(0)';

    await this._wait(200);

    // Reset antenna
    if (this.robot.dom.antenna) {
      const antenna = this.robot.dom.antenna;
      if (antenna) {
        antenna.style.fill = '';
        antenna.style.filter = '';
      }
    }
  }

  /**
   * Show surprise animation (eyes wide, jump back)
   */
  async playSurpriseAnimation() {
    if (!this.robot.dom.avatar) return;

    // Jump back
    this.robot.dom.avatar.style.transition = 'transform 0.2s ease-out';
    this.robot.dom.avatar.style.transform = 'translateX(-15px) scale(1.1)';

    // Wide eyes
    if (this.robot.dom.eyes) {
      const pupils = this.robot.dom.pupils;
      pupils.forEach((p) => {
        p.style.transform = 'scale(1.5)';
        p.style.transition = 'transform 0.2s';
      });
    }

    await this._wait(400);

    this.robot.dom.avatar.style.transform = '';

    // Reset eyes
    if (this.robot.dom.eyes) {
      const pupils = this.robot.dom.pupils;
      pupils.forEach((p) => {
        p.style.transform = '';
      });
    }
  }

  /**
   * Point to a specific element on the page
   * @param {HTMLElement} element - Element to point at
   */
  async pointAtElement(element) {
    if (!this.robot.dom.avatar || !element) return;

    const robotRect = this.robot.dom.avatar.getBoundingClientRect();
    const targetRect = element.getBoundingClientRect();

    // Calculate direction
    const isAbove = targetRect.top < robotRect.top;
    const isLeft = targetRect.left < robotRect.left;

    // Rotate towards target
    const angle = isAbove ? (isLeft ? -25 : -15) : isLeft ? 15 : 25;

    this.robot.dom.avatar.style.transition = 'transform 0.4s ease-out';
    this.robot.dom.avatar.style.transform = `rotate(${angle}deg) scale(1.05)`;

    // Move eyes towards target
    if (this.robot.dom.eyes) {
      const eyeX = isLeft ? -3 : 3;
      const eyeY = isAbove ? -2 : 2;
      this.robot.dom.eyes.style.transform = `translate(${eyeX}px, ${eyeY}px)`;
    }

    // Add pointing arm animation
    this.robot.dom.avatar.classList.add('pointing');

    await this._wait(2000);

    // Reset
    this.robot.dom.avatar.style.transform = '';
    this.robot.dom.avatar.classList.remove('pointing');

    if (this.robot.dom.eyes) {
      this.robot.dom.eyes.style.transform = '';
    }
  }

  /**
   * Dance animation (celebration)
   */
  async playDanceAnimation() {
    if (!this.robot.dom.avatar) return;

    const moves = [
      { transform: 'rotate(-10deg) translateY(-5px)', duration: 200 },
      { transform: 'rotate(10deg) translateY(-10px)', duration: 200 },
      { transform: 'rotate(-10deg) translateY(-5px)', duration: 200 },
      { transform: 'rotate(10deg) translateY(-10px)', duration: 200 },
      { transform: 'rotate(0deg) translateY(0)', duration: 200 },
    ];

    for (const move of moves) {
      this.robot.dom.avatar.style.transition = `transform ${move.duration}ms ease-in-out`;
      this.robot.dom.avatar.style.transform = move.transform;

      // Spawn particles during dance
      if (Math.random() > 0.5) {
        this.spawnParticleBurst(3, { strength: 0.8, spread: 180 });
      }

      await this._wait(move.duration);
    }
  }

  /**
   * Sad animation (head down)
   */
  async playSadAnimation() {
    if (!this.robot.dom.avatar) return;

    this.robot.dom.avatar.style.transition = 'transform 0.5s ease-out';
    this.robot.dom.avatar.style.transform = 'translateY(5px) rotate(0deg)';

    // Eyes look down
    if (this.robot.dom.eyes) {
      this.robot.dom.eyes.style.transform = 'translate(0, 3px)';
    }

    await this._wait(2000);

    this.robot.dom.avatar.style.transform = '';
    if (this.robot.dom.eyes) {
      this.robot.dom.eyes.style.transform = '';
    }
  }

  /**
   * Confused animation (head tilt with question mark)
   */
  async playConfusedAnimation() {
    if (!this.robot.dom.avatar) return;

    // Show thinking bubble
    if (this.robot.dom.thinking) {
      this.robot.dom.thinking.style.opacity = '1';
    }

    // Tilt head
    this.robot.dom.avatar.style.transition = 'transform 0.3s ease-in-out';
    this.robot.dom.avatar.style.transform = 'rotate(-15deg)';

    await this._wait(500);

    this.robot.dom.avatar.style.transform = 'rotate(15deg)';

    await this._wait(500);

    this.robot.dom.avatar.style.transform = '';

    // Hide thinking bubble
    if (this.robot.dom.thinking) {
      this.robot.dom.thinking.style.opacity = '0';
    }
  }

  startSearchAnimation() {
    if (!this.robot.dom.container) {
      return;
    }

    const targetEl = document.querySelector(
      '.site-header.search-mode .menu-search__bar, .menu-search[aria-hidden="false"] .menu-search__bar',
    );

    if (!targetEl || targetEl.getClientRects().length === 0) {
      this.stopSearchAnimation();
      return;
    }

    const targetRect = targetEl.getBoundingClientRect();
    const windowWidth =
      typeof globalThis !== 'undefined' ? globalThis.innerWidth : 0;
    const windowHeight =
      typeof globalThis !== 'undefined' ? globalThis.innerHeight : 0;

    // Robot base position (fixed css)
    const baseRight = 30;
    const baseBottom = 30;
    const robotSize = 80;

    // Keep robot away from the active search input area.
    const targetLeft = Math.min(
      targetRect.right - robotSize * 0.55,
      windowWidth - robotSize - 12,
    );
    const clampedTargetLeft = Math.max(12, targetLeft);

    const targetTop = Math.max(
      10,
      Math.max(
        12,
        Math.min(targetRect.bottom + 12, windowHeight - robotSize - 12),
      ),
    );

    // Convert to Patrol Coordinates (X from Right, Y from Bottom)
    // patrol.x (positive = left displacement from original right pos)
    // patrol.y (positive = up displacement from original bottom pos)
    // Since we use translate3d(-x, y, 0) and the element is bottom-aligned:
    // positive y moves DOWN. To move UP, we need negative y.

    // Target Right CSS Position
    const targetRightCSS = windowWidth - (clampedTargetLeft + robotSize);
    const targetBottomCSS = windowHeight - (targetTop + robotSize);

    const targetX = targetRightCSS - baseRight;
    const targetY = -(targetBottomCSS - baseBottom);

    this.cancelSearchAnimationFrame();
    this.searchAnimation.active = true;
    this.searchAnimation.phase = 'approach';
    this.searchAnimation.startTime = performance.now();
    this.searchAnimation.startX = this.patrol.x;
    this.searchAnimation.startY = this.patrol.y;
    this.searchAnimation.targetX = targetX;
    this.searchAnimation.targetY = targetY;
    this.searchAnimation.hoverPhase = 0;

    // Ensure robot is above search overlay
    this.robot.dom.container.style.zIndex = '10001';

    this.setMagnifyingGlassVisible(true);

    // Show excitement
    this.robot.showBubble('Ah! Ich helfe suchen! 🔍');
    this.robot._setTimeout(() => this.robot.hideBubble(), 2000);

    this.scheduleSearchAnimationFrame();
  }

  stopSearchAnimation() {
    this.cancelSearchAnimationFrame();
    this.setMagnifyingGlassVisible(false);

    const isNearOrigin =
      Math.abs(this.patrol.x) < 0.5 && Math.abs(this.patrol.y) < 0.5;

    if (!this.searchAnimation.active && isNearOrigin) {
      this.searchAnimation.active = false;
      this.searchAnimation.phase = 'idle';
      this.searchAnimation.hoverPhase = 0;
      if (this.robot.dom.container) {
        this.robot.dom.container.style.zIndex = '';
      }
      if (this.robot.dom.flame) {
        this.robot.dom.flame.style.opacity = '0';
      }
      if (this.robot.dom.svg) {
        this.robot.dom.svg.style.transform = 'rotate(0deg)';
      }
      if (!this.patrol.active && !this.startAnimation.active) {
        this.startPatrol();
      }
      return;
    }

    this.searchAnimation.active = true;
    this.searchAnimation.phase = 'returning';
    this.searchAnimation.startTime = performance.now();
    this.searchAnimation.startX = this.patrol.x;
    this.searchAnimation.startY = this.patrol.y;
    this.searchAnimation.targetX = 0; // Return to origin x=0
    this.searchAnimation.targetY = 0; // Return to origin y=0
    this.searchAnimation.hoverPhase = 0;

    // Ensure loop continues if it was stuck
    this.scheduleSearchAnimationFrame();

    // Keep loop running until returned
  }

  scheduleSearchAnimationFrame() {
    const schedule = () => {
      this.searchAnimationFrame = this.robot._requestAnimationFrame(() => {
        this.updateSearchAnimation();
        if (this.searchAnimation.active) {
          schedule();
        } else {
          this.searchAnimationFrame = null;
        }
      });
    };
    if (this.searchAnimationFrame === null) {
      schedule();
    }
  }

  cancelSearchAnimationFrame() {
    if (this.searchAnimationFrame !== null) {
      this.robot._cancelAnimationFrame(this.searchAnimationFrame);
      this.searchAnimationFrame = null;
    }
  }

  setMagnifyingGlassVisible(isVisible) {
    if (!this.robot.dom.magnifyingGlass) return;
    this.robot.dom.magnifyingGlass.style.opacity = isVisible ? '1' : '0';
    if (!isVisible) {
      this.robot.dom.magnifyingGlass.setAttribute(
        'transform',
        this.defaultMagnifyingGlassTransform,
      );
    }
  }

  updateSearchAnimation() {
    if (!this.searchAnimation.active) return;

    const now = performance.now();
    // Slower duration for more realistic flying
    const duration = 2000;

    if (
      this.searchAnimation.phase === 'approach' ||
      this.searchAnimation.phase === 'returning'
    ) {
      const elapsed = now - this.searchAnimation.startTime;
      const t = Math.min(1, elapsed / duration);

      // Use Ease In Out Cubic for realistic start/stop
      const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

      this.patrol.x =
        this.searchAnimation.startX +
        (this.searchAnimation.targetX - this.searchAnimation.startX) * ease;
      this.patrol.y =
        this.searchAnimation.startY +
        (this.searchAnimation.targetY - this.searchAnimation.startY) * ease;

      // Add bounce effect (hovering while flying)
      this.searchAnimation.hoverPhase += 0.05;
      const bounce = Math.sin(this.searchAnimation.hoverPhase) * 10;
      this.patrol.y += bounce;

      // Rotate towards target
      if (this.robot.dom.svg) {
        const isReturning = this.searchAnimation.phase === 'returning';
        // Gentle tilt
        const tilt = isReturning
          ? 0
          : 10 + Math.sin(this.searchAnimation.hoverPhase) * 2;
        this.robot.dom.svg.style.transform = `rotate(${tilt}deg)`;
      }

      // Activate flame animation during flight
      if (this.robot.dom.flame) {
        const flameScale =
          1 + Math.sin(this.searchAnimation.hoverPhase * 5) * 0.2;
        this.robot.dom.flame.style.opacity = '1';
        this.robot.dom.flame.style.transform = `scale(${flameScale})`;

        // Randomly spawn particles for effect
        if (Math.random() < 0.15) {
          this.spawnFlameParticle();
        }
      }

      this.updateRobotTransform();

      if (t >= 1) {
        if (this.searchAnimation.phase === 'returning') {
          this.searchAnimation.active = false;
          this.searchAnimation.phase = 'idle';
          this.robot.dom.container.style.zIndex = ''; // Reset Z-Index
          // Reset flame
          if (this.robot.dom.flame) {
            this.robot.dom.flame.style.opacity = '0';
          }
          if (this.robot.dom.svg) {
            this.robot.dom.svg.style.transform = 'rotate(0deg)';
          }
          this.setMagnifyingGlassVisible(false);
          this.startPatrol();
        } else {
          this.searchAnimation.phase = 'hover';
          this.scheduleSearchAnimationFrame();
        }
      } else {
        this.scheduleSearchAnimationFrame();
      }
    } else if (this.searchAnimation.phase === 'hover') {
      // Hovering state with "Scanning" motion
      this.searchAnimation.hoverPhase += 0.04;

      // Bobbing up and down
      const hoverY =
        this.searchAnimation.targetY +
        Math.sin(this.searchAnimation.hoverPhase) * 12;

      this.patrol.x = this.searchAnimation.targetX;
      this.patrol.y = hoverY;

      // Gentle flame flicker during hover
      if (this.robot.dom.flame) {
        const flameScale =
          0.8 + Math.sin(this.searchAnimation.hoverPhase * 3) * 0.15;
        this.robot.dom.flame.style.opacity = '0.8';
        this.robot.dom.flame.style.transform = `scale(${flameScale})`;
      }

      // Eyes following the scan
      if (this.robot.dom.eyes) {
        // Look Left (-3) and oscillate slightly
        const eyeX = -3 + Math.sin(this.searchAnimation.hoverPhase * 2) * 1.5;
        // Look Up (-2) towards search bar and oscillate
        const eyeY = -2 + Math.cos(this.searchAnimation.hoverPhase * 2) * 1;
        this.robot.dom.eyes.style.transform = `translate(${eyeX}px, ${eyeY}px)`;
      }

      this.updateRobotTransform();
      this.scheduleSearchAnimationFrame();
    }
  }

  updateRobotTransform() {
    if (!this.robot.dom.container) return;
    this.robot.dom.container.style.transform = `translate3d(${-this.patrol.x}px, ${this.patrol.y}px, 0)`;
    if (this.robot.dom.floatWrapper) {
      this.robot.dom.floatWrapper.style.transform = 'rotate(0deg)';
    }
    // Update eyes to look interesting
    // Only update if NOT in hover phase (which handles its own eye movement)
    if (this.robot.dom.eyes && this.searchAnimation.phase !== 'hover') {
      // Look slightly up-left towards search (assuming search is top-left)
      this.robot.dom.eyes.style.transform = 'translate(-3px, -1px)';
    }
  }

  destroy() {
    this.patrol.active = false;
    this.startAnimation.active = false;
    this.searchAnimation.active = false;
    this.speakingActive = false;
    this.thinkingActive = false;

    if (this._speakingTimer) {
      this.robot._clearTimeout(this._speakingTimer);
      this._speakingTimer = null;
    }

    this.stopIdleEyeMovement();
    this.stopBlinkLoop();

    if (this.searchAnimationFrame !== null) {
      this.robot._cancelAnimationFrame(this.searchAnimationFrame);
      this.searchAnimationFrame = null;
    }
  }
}
