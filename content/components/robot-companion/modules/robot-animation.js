import {
  resolveTypewriterApproachTargetX,
  startRandomEntryAnimation,
  updateEntryVariant,
} from './animations/entry-animations.js';
import {
  doBlink,
  resetIdleAnimations,
  startBlinkLoop,
  startIdleEyeMovement,
  stopBlinkLoop,
  stopIdleEyeMovement,
  triggerRandomIdleAnimation,
  updateEyesTransform,
} from './animations/idle-behaviors.js';
import {
  cancelSearchAnimationFrame,
  scheduleSearchAnimationFrame,
  setMagnifyingGlassVisible,
  startSearchAnimation,
  stopSearchAnimation,
  updateSearchAnimation,
} from './animations/search-flight.js';
import {
  destroyFeedbackAnimations,
  ensureFlameColors,
  playPokeAnimation,
  spawnFlameParticle,
  spawnParticleBurst,
  startSpeaking,
  startSpeakingLoop,
  startThinking,
  stopSpeaking,
  stopThinking,
} from './animations/avatar-feedback.js';

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
      knockbackEndX: 0,
      naturalPauseUntil: 0,
      naturalNextPauseAt: 0,
      naturalMinX: 0,
      variantKey: '',
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

    this.entryConfig = {
      homeIntroFallbackMs: 2200,
      homeIntroDurationMs: 900,
      homeIntroPauseMs: 1600,
      homeTypewriterSafeGap: 32,
      mobileBreakpoint: 768,
    };
    this._typewriterIntroQueued = false;
    /** @type {ReturnType<typeof setTimeout> | null} */
    this._typewriterIntroFallbackTimer = null;

    this._prevDashActive = false;
    /** @type {number | null} */
    this._lastBounceT = null;

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
    this._flameInitDone = false;

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
    ensureFlameColors(this);
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
    startSpeaking(this);
  }

  stopSpeaking() {
    stopSpeaking(this);
  }

  startSpeakingLoop() {
    startSpeakingLoop(this);
  }

  startThinking() {
    startThinking(this);
  }

  stopThinking() {
    stopThinking(this);
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
    this.startAnimation.knockbackDuration = 1200; // longer flight
    this.startAnimation.knockbackStartX = this.patrol.x;
    this.startAnimation.knockbackStartY = this.patrol.y;
    // Land far away from text (near right edge, low x values)
    this.startAnimation.knockbackEndX = Math.round(Math.random() * 15);

    this.robot._requestAnimationFrame(this.updateStartAnimation);
  }

  _isHomeContext() {
    const pageContext = this.robot.dom?.container?.dataset?.pageContext || '';
    return pageContext === 'home';
  }

  _isCompactViewport() {
    return (
      (typeof globalThis !== 'undefined' ? globalThis.innerWidth : 0) <=
      this.entryConfig.mobileBreakpoint
    );
  }

  _clearQueuedTypewriterIntro() {
    this._typewriterIntroQueued = false;
    if (this._typewriterIntroFallbackTimer) {
      this.robot._clearTimeout(this._typewriterIntroFallbackTimer);
      this._typewriterIntroFallbackTimer = null;
    }
  }

  _startHomeIntroSequence() {
    if (!this.robot.dom.container || !this._isHomeContext()) {
      this._clearQueuedTypewriterIntro();
      return;
    }

    this._clearQueuedTypewriterIntro();

    const reducedMotion =
      typeof globalThis !== 'undefined' &&
      globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const compact = this._isCompactViewport();

    this.patrol.active = false;
    this.patrol.isPaused = false;
    this.motion.dashUntil = 0;

    if (reducedMotion) {
      this.startAnimation.active = false;
      this.startAnimation.phase = 'idle';
      this.patrol.x = 0;
      this.patrol.y = 0;
      this.robot.dom.container.style.opacity = '1';
      this.robot.dom.container.style.transform = 'translate3d(0px, 0px, 0)';
      if (this.robot.dom.floatWrapper) {
        this.robot.dom.floatWrapper.style.transform = 'rotate(0deg)';
        this.robot.dom.floatWrapper.style.opacity = '';
      }
      this.setAvatarState({ moving: false, dashing: false });
      this.pausePatrol(900);
      this.startPatrol();
      return;
    }

    const startOffsetX = compact ? -6 : -16;
    const startOffsetY = compact ? 12 : 24;
    const startTilt = compact ? -4 : -7;

    this.startAnimation.active = true;
    this.startAnimation.phase = 'settleIn';
    this.startAnimation.startTime = performance.now();
    this.startAnimation.duration = compact
      ? 720
      : this.entryConfig.homeIntroDurationMs;
    this.startAnimation.startX = startOffsetX;
    this.startAnimation.knockbackStartY = startOffsetY;
    this.patrol.x = startOffsetX;
    this.patrol.y = startOffsetY;
    this.patrol.bouncePhase = 0;

    this.robot.dom.container.style.opacity = '0';
    this.robot.dom.container.style.transform = `translate3d(${-startOffsetX}px, ${startOffsetY}px, 0)`;
    if (this.robot.dom.floatWrapper) {
      this.robot.dom.floatWrapper.style.transform = `rotate(${startTilt}deg) scale(0.94)`;
      this.robot.dom.floatWrapper.style.opacity = '0.2';
    }
    if (this.robot.dom.svg) {
      this.robot.dom.svg.style.transform = `rotate(${startTilt * 0.7}deg)`;
    }
    if (this.robot.dom.flame) {
      this.robot.dom.flame.style.opacity = '0.18';
      this.robot.dom.flame.style.transform = 'scale(0.92)';
    }

    this.robot._requestAnimationFrame(this.updateStartAnimation);
  }

  _maintainHomeTypewriterClearance(twRect, maxLeft) {
    if (!this._isHomeContext() || !twRect || !this.robot.dom?.container) {
      return false;
    }

    const sourceEl =
      this.robot.dom.svg || this.robot.dom.avatar || this.robot.dom.container;
    if (!sourceEl) return false;

    const safeGap = this.entryConfig.homeTypewriterSafeGap;
    const robotRect = sourceEl.getBoundingClientRect();
    const intrudesOnSafeZone = !(
      twRect.right + safeGap < robotRect.left ||
      twRect.left - safeGap > robotRect.right ||
      twRect.bottom + 10 < robotRect.top ||
      twRect.top - safeGap > robotRect.bottom
    );

    if (!intrudesOnSafeZone) return false;

    this.patrol.direction = -1;
    this.motion.dashUntil = 0;
    this.patrol.x = Math.max(0, Math.min(maxLeft, this.patrol.x - 18));
    this.patrol.y = Math.min(this.patrol.y, 0);
    this.setAvatarState({ moving: false, dashing: false });

    if (!this.patrol.isPaused) {
      this.pausePatrol(1400 + Math.random() * 900);
      this.spawnParticleBurst(3, { direction: -1, strength: 0.75 });
    }

    return true;
  }

  handleHeroTypingEnd() {
    const typeWriter = this.robot.getTypewriterElement();
    if (typeWriter) {
      this.cacheConfig.typeWriterRect = typeWriter.getBoundingClientRect();
      this.cacheConfig.lastTypeWriterCheck = performance.now();
    }

    if (!this._typewriterIntroQueued) return;
    if (!this._isHomeContext()) {
      this._clearQueuedTypewriterIntro();
      return;
    }

    this._startHomeIntroSequence();
  }

  /**
   * Entry animation dispatcher – randomly picks one of several
   * entry animations each time the page loads for variety.
   */
  startTypeWriterKnockbackAnimation() {
    if (!this.robot.dom.container || this.startAnimation.active) return;

    if (this._isHomeContext()) {
      this._clearQueuedTypewriterIntro();
      this._typewriterIntroQueued = true;
      const fallbackDelay = this._isCompactViewport()
        ? 1100
        : this.entryConfig.homeIntroFallbackMs;
      this._typewriterIntroFallbackTimer = this.robot._setTimeout(() => {
        if (!this._typewriterIntroQueued) return;
        this._startHomeIntroSequence();
      }, fallbackDelay);
      return;
    }

    startRandomEntryAnimation(this);
  }

  /** Clean up any entry animation state and transition to patrol */
  _finishEntry(bubble) {
    // Immediately mark phase as finishing so no phase handler re-fires
    this.startAnimation.phase = 'finishing';

    if (bubble) {
      this.robot.showBubble(bubble);
      this.robot._setTimeout(() => this.robot.hideBubble(), 2500);
    }

    // Clean up any entry-variant CSS helper classes
    if (this.robot.dom.avatar) {
      this.robot.dom.avatar.classList.remove('portal-glow', 'rocket-trail');
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

    this._startNaturalApproach(resolveTypewriterApproachTargetX(typeWriter));
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

    if (this.startAnimation.phase === 'settleIn') {
      const elapsed = now - this.startAnimation.startTime;
      const duration =
        this.startAnimation.duration || this.entryConfig.homeIntroDurationMs;
      const t = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const startX = this.startAnimation.startX || 0;
      const startY = this.startAnimation.knockbackStartY || 0;
      const compact = this._isCompactViewport();
      const startTilt = compact ? -4 : -7;

      this.patrol.x = startX * (1 - eased);
      this.patrol.y = startY * (1 - eased);

      this.robot.dom.container.style.opacity = `${0.12 + eased * 0.88}`;
      this.robot.dom.container.style.transform = `translate3d(${-this.patrol.x}px, ${this.patrol.y}px, 0)`;

      if (this.robot.dom.floatWrapper) {
        const scale = 0.94 + eased * 0.06;
        this.robot.dom.floatWrapper.style.transform = `rotate(${startTilt * (1 - eased)}deg) scale(${scale})`;
        this.robot.dom.floatWrapper.style.opacity = `${0.2 + eased * 0.8}`;
      }

      if (this.robot.dom.svg) {
        this.robot.dom.svg.style.transform = `rotate(${startTilt * 0.7 * (1 - eased)}deg)`;
      }

      if (this.robot.dom.flame) {
        const flameOpacity = 0.18 + eased * 0.28;
        this.robot.dom.flame.style.opacity = `${flameOpacity}`;
        this.robot.dom.flame.style.transform = `scale(${0.92 + eased * 0.12})`;
      }

      const moving = t < 0.7;
      this.setAvatarState({ moving, dashing: false });
      if (this.robot.dom.legs) {
        this.robot.dom.legs.classList.toggle('wiggle', moving);
      }

      if (t >= 1) {
        this.startAnimation.active = false;
        this.startAnimation.phase = 'idle';
        this.patrol.x = 0;
        this.patrol.y = 0;
        this.robot.dom.container.style.opacity = '1';
        this.robot.dom.container.style.transform = 'translate3d(0px, 0px, 0)';
        if (this.robot.dom.floatWrapper) {
          this.robot.dom.floatWrapper.style.transform = 'rotate(0deg) scale(1)';
          this.robot.dom.floatWrapper.style.opacity = '';
        }
        if (this.robot.dom.svg) {
          this.robot.dom.svg.style.transform = 'rotate(0deg)';
        }
        this.setAvatarState({ moving: false, dashing: false });
        this.pausePatrol(
          this.entryConfig.homeIntroPauseMs + Math.random() * 600,
        );
        this.startPatrol();
        return;
      }

      this.robot._requestAnimationFrame(this.updateStartAnimation);
      return;
    }

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

        // Play text collision impact effects
        const typeWriter = document.querySelector('.typewriter-title');
        if (typeWriter) {
          const twRect = typeWriter.getBoundingClientRect();
          this.robot.collisionModule._playTextCollisionEffect(
            typeWriter,
            twRect,
          );
        }

        this.startAnimation.phase = 'knockback';
        this.startAnimation.knockbackStartTime = now;
        this.startAnimation.knockbackDuration = 1200;
        this.startAnimation.knockbackStartX = this.patrol.x;
        this.startAnimation.knockbackStartY = this.patrol.y;
        // Land far away from text (near right edge)
        this.startAnimation.knockbackEndX = Math.round(Math.random() * 15);

        // Set text collision immunity to prevent loop
        if (this.robot.collisionModule) {
          this.robot.collisionModule._textCollisionImmunity = true;
          this.robot._setTimeout(() => {
            if (this.robot.collisionModule) {
              this.robot.collisionModule._textCollisionImmunity = false;
            }
          }, 6000);
        }
      }

      this.robot._requestAnimationFrame(this.updateStartAnimation);
      return;
    }

    if (this.startAnimation.phase === 'knockback') {
      const elapsed = now - this.startAnimation.knockbackStartTime;
      const t = Math.min(1, elapsed / this.startAnimation.knockbackDuration);

      // High arc trajectory for dramatic fling
      const arc = Math.sin(t * Math.PI) * 120;
      this.patrol.y = this.startAnimation.knockbackStartY - arc;

      // Fly back from collision point to landing position (far from text)
      // Use elastic ease-out for bouncy dramatic effect
      const eased =
        t === 1 ? 1 : 1 - Math.pow(2, -10 * t) * Math.cos(t * Math.PI * 2.5);
      const endX = this.startAnimation.knockbackEndX || 0;
      this.patrol.x =
        this.startAnimation.knockbackStartX +
        (endX - this.startAnimation.knockbackStartX) * eased;

      // More dramatic tumble rotation
      const rotation = -30 + t * 60;
      if (this.robot.dom.svg) {
        this.robot.dom.svg.style.transform = `rotate(${rotation}deg)`;
      }

      const containerRot = 25 * Math.sin(t * Math.PI * 2.5);
      this.robot.dom.container.style.transform = `translate3d(${-this.patrol.x}px, ${this.patrol.y}px, 0)`;
      if (this.robot.dom.floatWrapper) {
        this.robot.dom.floatWrapper.style.transform = `rotate(${containerRot}deg)`;
      }

      // Flash effect on impact start
      if (t < 0.1 && this.robot.dom.svg) {
        this.robot.dom.svg.style.filter =
          'brightness(2) drop-shadow(0 0 8px var(--robot-svg-flash-glow))';
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
        this.spawnParticleBurst(10, { strength: 1.8, spread: 180 });

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
          this.setAvatarState({ moving: false, dashing: false });

          // Pause longer after text collision to prevent immediate re-approach
          this.pausePatrol(4000 + Math.random() * 3000);
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
    updateEntryVariant(this, now);
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
      const avoidedTypewriter = this._maintainHomeTypewriterClearance(
        twRect,
        maxLeft,
      );
      if (avoidedTypewriter) {
        if (this.robot.dom.svg) {
          this.robot.dom.svg.style.transform = 'rotate(0deg)';
        }
        if (this.robot.dom.floatWrapper) {
          this.robot.dom.floatWrapper.style.transform = 'rotate(0deg)';
        }
        this.robot.dom.container.style.transform = `translate3d(-${this.patrol.x}px, ${this.patrol.y}px, 0)`;
        this.robot._requestAnimationFrame(this.updatePatrol);
        return;
      }

      this.robot.collisionModule.checkForTypewriterCollision(twRect);
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
    triggerRandomIdleAnimation(this);
  }

  resetIdleAnimations() {
    resetIdleAnimations(this);
  }

  /**
   * @param {number} count
   * @param {{direction?: number, strength?: number, spread?: number | null}} options
   */
  spawnParticleBurst(
    count = 6,
    { direction = 0, strength = 1, spread = null } = {},
  ) {
    spawnParticleBurst(this, count, { direction, strength, spread });
  }

  setAvatarState({ moving = false, dashing = false } = {}) {
    if (!this.robot.dom.avatar) return;
    this.robot.dom.avatar.classList.toggle('is-moving', moving);
    this.robot.dom.avatar.classList.toggle('is-dashing', dashing);
  }

  spawnFlameParticle() {
    spawnFlameParticle(this);
  }

  async playPokeAnimation() {
    await playPokeAnimation(this);
  }

  startIdleEyeMovement() {
    startIdleEyeMovement(this);
  }

  stopIdleEyeMovement() {
    stopIdleEyeMovement(this);
  }

  updateEyesTransform() {
    updateEyesTransform(this);
  }

  startBlinkLoop() {
    startBlinkLoop(this);
  }

  stopBlinkLoop() {
    stopBlinkLoop(this);
  }

  doBlink() {
    doBlink(this);
  }

  startSearchAnimation() {
    startSearchAnimation(this);
  }

  stopSearchAnimation() {
    stopSearchAnimation(this);
  }

  scheduleSearchAnimationFrame() {
    scheduleSearchAnimationFrame(this);
  }

  cancelSearchAnimationFrame() {
    cancelSearchAnimationFrame(this);
  }

  setMagnifyingGlassVisible(isVisible) {
    setMagnifyingGlassVisible(this, isVisible);
  }

  updateSearchAnimation() {
    updateSearchAnimation(this);
  }

  destroy() {
    this.patrol.active = false;
    this.startAnimation.active = false;
    this.searchAnimation.active = false;
    this._clearQueuedTypewriterIntro();
    destroyFeedbackAnimations(this);

    this.stopIdleEyeMovement();
    this.stopBlinkLoop();

    if (this.searchAnimationFrame !== null) {
      this.robot._cancelAnimationFrame(this.searchAnimationFrame);
      this.searchAnimationFrame = null;
    }
  }
}
