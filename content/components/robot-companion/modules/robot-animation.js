import { sleep } from '../../../core/utils.js';

export class RobotAnimation {
  constructor(robot) {
    this.robot = robot;

    // Patrol State
    this.patrol = {
      active: false,
      x: 0,
      y: 0,
      direction: 1,
      speed: 0.3,
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

    // Bind loop
    this.updatePatrol = this.updatePatrol.bind(this);
    this.updateStartAnimation = this.updateStartAnimation.bind(this);
    this.updateSearchAnimation = this.updateSearchAnimation.bind(this);

    this.thinkingActive = false;
    this.speakingActive = false;
    /** @type {ReturnType<typeof setTimeout> | null} */
    this._speakingTimer = null;
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
      clearTimeout(this._speakingTimer);
      this._speakingTimer = null;
    }
    // Reset antenna color
    if (this.robot.dom.svg) {
      const antenna = this.robot.dom.svg.querySelector('.robot-antenna-light');
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

    if (this.robot.dom.svg) {
      const antenna = this.robot.dom.svg.querySelector('.robot-antenna-light');
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

    this._speakingTimer = setTimeout(
      () => this.startSpeakingLoop(),
      duration + 50,
    );
  }

  startThinking() {
    if (this.thinkingActive) return;
    this.thinkingActive = true;

    if (this.robot.dom.svg) {
      const antenna = this.robot.dom.svg.querySelector('.robot-antenna-light');
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

    if (this.robot.dom.svg) {
      const antenna = this.robot.dom.svg.querySelector('.robot-antenna-light');
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

    const now = performance.now();
    this.startAnimation.active = true;
    this.startAnimation.phase = 'knockback';
    this.startAnimation.knockbackStartTime = now;
    this.startAnimation.knockbackDuration = 700;
    this.startAnimation.knockbackStartX = this.patrol.x;
    this.startAnimation.knockbackStartY = this.patrol.y;

    requestAnimationFrame(this.updateStartAnimation);
  }

  startTypeWriterKnockbackAnimation() {
    const typeWriter = document.querySelector('.typewriter-title');
    if (!typeWriter || !this.robot.dom.container) {
      this.startPatrol();
      return;
    }

    const twRect = typeWriter.getBoundingClientRect();
    const robotWidth = 80;
    const windowWidth =
      typeof globalThis !== 'undefined' ? globalThis.innerWidth : 0;

    const initialLeft = windowWidth - 30 - robotWidth;
    const gap = 24;
    let targetLeft;
    const spaceRight = windowWidth - twRect.right - 30;
    if (spaceRight >= robotWidth + gap) {
      targetLeft = twRect.right + gap;
    } else {
      targetLeft = twRect.left - robotWidth - gap;
    }
    targetLeft = Math.max(8, Math.min(initialLeft - 20, targetLeft));

    const startOffset = 80;
    const startLeft = Math.min(initialLeft, targetLeft + startOffset);

    const startX = Math.max(0, Math.round(initialLeft - startLeft));
    const targetX = Math.max(0, Math.round(initialLeft - targetLeft));

    this.startAnimation.active = true;
    this.startAnimation.phase = 'approach';
    this.startAnimation.startTime = performance.now();
    this.startAnimation.startX = startX;
    this.startAnimation.targetX = targetX;
    this.startAnimation.duration = 1000;

    this.patrol.x = startX;
    this.patrol.direction = 1;
    this.patrol.bouncePhase = 0;

    this.robot.dom.container.style.transform = `translate3d(-${this.patrol.x}px, ${this.patrol.y}px, 0)`;
    if (this.robot.dom.floatWrapper) {
      this.robot.dom.floatWrapper.style.transform = 'rotate(0deg)';
    }
    this.robot.dom.container.style.opacity = '1';
    requestAnimationFrame(this.updateStartAnimation);
  }

  updateStartAnimation() {
    if (!this.startAnimation.active || !this.robot.dom.container) {
      requestAnimationFrame(this.updateStartAnimation);
      return;
    }

    const now = performance.now();

    if (this.startAnimation.phase === 'approach') {
      const elapsed = now - this.startAnimation.startTime;
      const t = Math.min(1, elapsed / this.startAnimation.duration);
      const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

      this.patrol.x =
        this.startAnimation.startX +
        (this.startAnimation.targetX - this.startAnimation.startX) * eased;

      this.patrol.bouncePhase += 0.08;
      this.patrol.y = Math.sin(this.patrol.bouncePhase) * 4;

      const flameIntensity = 0.8 + 0.6 * eased;
      if (this.robot.dom.flame) {
        this.robot.dom.flame.style.opacity = flameIntensity;
        this.robot.dom.flame.style.transform = `scale(${
          1 + flameIntensity * 0.3
        })`;
        if (Math.random() < 0.2) this.spawnFlameParticle();
      }

      const isDashing = t > 0.3;
      if (isDashing && this.robot.dom.particles) {
        this.robot.dom.particles.style.opacity = '0.9';
      }

      this.setAvatarState({ moving: true, dashing: isDashing });

      if (this.robot.dom.svg) {
        this.robot.dom.svg.style.transform = `rotate(-5deg)`;
      }

      this.robot.dom.container.style.transform = `translate3d(-${this.patrol.x}px, ${this.patrol.y}px, 0)`;
      if (this.robot.dom.floatWrapper) {
        this.robot.dom.floatWrapper.style.transform = 'rotate(-4deg)';
      }

      if (t >= 1) {
        this.startAnimation.phase = 'pause';
        this.startAnimation.pauseUntil = now + 200;
        this.setAvatarState({ moving: false, dashing: false });
      }

      requestAnimationFrame(this.updateStartAnimation);
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
        setTimeout(() => this.robot.hideBubble(), 2500);

        this.spawnParticleBurst(15, { strength: 2, spread: 180 });

        this.startAnimation.phase = 'knockback';
        this.startAnimation.knockbackStartTime = now;
        this.startAnimation.knockbackStartX = this.patrol.x;
        this.startAnimation.knockbackStartY = this.patrol.y;
      }

      requestAnimationFrame(this.updateStartAnimation);
      return;
    }

    if (this.startAnimation.phase === 'knockback') {
      const elapsed = now - this.startAnimation.knockbackStartTime;
      const t = Math.min(1, elapsed / this.startAnimation.knockbackDuration);

      const arc = Math.sin(t * Math.PI) * 50;
      this.patrol.y = this.startAnimation.knockbackStartY - arc;

      const eased = 1 - Math.pow(1 - t, 3);
      this.patrol.x = this.startAnimation.knockbackStartX - 200 * eased;

      const rotation = -20 + t * 40;
      if (this.robot.dom.svg) {
        this.robot.dom.svg.style.transform = `rotate(${rotation}deg)`;
      }

      const containerRot = 15 * Math.sin(t * Math.PI * 2);
      this.robot.dom.container.style.transform = `translate3d(-${this.patrol.x}px, ${this.patrol.y}px, 0)`;
      if (this.robot.dom.floatWrapper) {
        this.robot.dom.floatWrapper.style.transform = `rotate(${containerRot}deg)`;
      }

      if (this.robot.dom.flame) {
        this.robot.dom.flame.style.opacity = '0.2';
      }

      if (t < 0.3 && this.robot.dom.particles) {
        this.robot.dom.particles.style.opacity = '1';
      }

      if (t >= 1) {
        this.startAnimation.phase = 'landing';
        this.spawnParticleBurst(8, { strength: 1.5 });

        setTimeout(() => {
          this.startAnimation.active = false;
          this.patrol.active = true;
          this.patrol.y = 0;
          if (this.robot.dom.svg) {
            this.robot.dom.svg.style.transform = 'rotate(0deg)';
          }
          if (this.robot.dom.floatWrapper) {
            this.robot.dom.floatWrapper.style.transform = 'rotate(0deg)';
          }
          this.startPatrol();
        }, 300);
      }

      requestAnimationFrame(this.updateStartAnimation);
      return;
    }

    if (this.startAnimation.phase === 'landing') {
      if (!this.startAnimation.active) return;
      requestAnimationFrame(this.updateStartAnimation);
    }
  }

  startPatrol() {
    this.patrol.active = true;
    if (this.robot.dom && this.robot.dom.container)
      this.robot.dom.container.style.opacity = '1';
    requestAnimationFrame(this.updatePatrol);
  }

  updatePatrol() {
    if (document.hidden) {
      setTimeout(() => requestAnimationFrame(this.updatePatrol), 500);
      return;
    }

    if (
      !this.patrol.active ||
      this.startAnimation.active ||
      this.searchAnimation.active
    ) {
      if (!this.startAnimation.active && !this.searchAnimation.active) {
        requestAnimationFrame(this.updatePatrol);
      }
      return;
    }
    if (!this.robot.dom.container) {
      requestAnimationFrame(this.updatePatrol);
      return;
    }

    const now = performance.now();
    if (
      now - this.cacheConfig.lastTypeWriterCheck >
      this.cacheConfig.typeWriterCheckInterval
    ) {
      this.robot.dom.typeWriter = document.querySelector('.typewriter-title');
      this.cacheConfig.lastTypeWriterCheck = now;
    }

    const isHovering =
      this.robot.dom.avatar && this.robot.dom.avatar.matches(':hover');
    if (this.robot.chatModule.isOpen || this.patrol.isPaused || isHovering) {
      this.setAvatarState({ moving: false, dashing: false });
      if (this.robot.dom.flame) this.robot.dom.flame.style.opacity = '0';
      if (this.robot.dom.particles)
        this.robot.dom.particles.style.opacity = '0';
      requestAnimationFrame(this.updatePatrol);
      return;
    }

    const robotWidth = 80;
    const initialLeft =
      (typeof globalThis !== 'undefined' ? globalThis.innerWidth : 0) -
      30 -
      robotWidth;
    let maxLeft = initialLeft - 20;

    let twRect = null;
    if (this.robot.dom.typeWriter) {
      twRect = this.robot.dom.typeWriter.getBoundingClientRect();
      const limit = initialLeft - twRect.right - 50;
      if (limit < maxLeft) maxLeft = limit;
    }

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

    if (!this.robot.dom.typeWriter && approachingLimit) {
      this.patrol.direction *= -1;
      this.spawnParticleBurst(4, {
        direction: -this.patrol.direction,
        strength: 0.9,
      });
      this.pausePatrol(3000 + Math.random() * 3000);
    }

    if (this.robot.dom.typeWriter && twRect) {
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
          ? 1.4
          : dashActive
            ? 1.2
            : 0.85;
      this.robot.dom.flame.style.opacity = flameIntensity;
      this.robot.dom.flame.style.transform = `scale(${
        1 + (flameIntensity - 0.7) * 0.4
      })`;
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

    requestAnimationFrame(this.updatePatrol);
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
      setTimeout(() => {
        if (this.robot.dom.thinking)
          this.robot.dom.thinking.style.opacity = '0';
      }, ms * 0.6);
    }
    setTimeout(() => {
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

      requestAnimationFrame(() => {
        el.style.transform = `translate(${dx}px, ${dy}px) scale(${
          0.5 + Math.random() * 0.6
        })`;
        el.style.opacity = '0';
        if (Math.random() < 0.15) el.style.filter = 'blur(1px)';
      });

      setTimeout(() => el.remove(), 900 + Math.random() * 600);
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

    requestAnimationFrame(() => {
      const dx = (Math.random() - 0.5) * 10;
      const dy = 15 + Math.random() * 15;
      el.style.transform = `translate(${dx}px, ${dy}px) scale(0)`;
      el.style.opacity = '0';
    });

    setTimeout(() => el.remove(), 600);
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
        setTimeout(() => {
          this.robot.dom.avatar.style.transform = '';
          setTimeout(resolve, 200);
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
      await sleep(350);
    } else {
      if (this.robot.dom.svg) {
        this.robot.dom.svg.style.filter =
          'brightness(2) drop-shadow(0 0 10px #fff)';
      }
      await new Promise((resolve) => {
        setTimeout(() => {
          if (this.robot.dom.svg) this.robot.dom.svg.style.filter = '';
          setTimeout(resolve, 100);
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
        // @ts-ignore - setTimeout return type compatibility
        this._eyeIdleTimer = t || this._eyeIdleTimer;
      }, delay);
    };
    scheduleNext();
  }

  stopIdleEyeMovement() {
    if (this._eyeIdleTimer) {
      clearTimeout(this._eyeIdleTimer);
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
      this._blinkTimer = setTimeout(() => {
        this.doBlink();
        schedule();
      }, delay);
    };
    schedule();
  }

  stopBlinkLoop() {
    if (this._blinkTimer) {
      clearTimeout(this._blinkTimer);
      this._blinkTimer = null;
    }
  }

  doBlink() {
    if (!this.robot.dom || !this.robot.dom.eyes) return;
    const lids = this.robot.dom.eyes.querySelectorAll('.robot-lid');
    if (!lids.length) return;
    lids.forEach((l) => l.classList.add('is-blink'));
    setTimeout(
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
    if (this.robot.dom.svg) {
      const antenna = this.robot.dom.svg.querySelector('.robot-antenna-light');
      if (antenna) {
        antenna.style.fill = '#ffff00';
        antenna.style.filter = 'drop-shadow(0 0 8px #ffff00)';
      }
    }

    await sleep(300);

    this.robot.dom.avatar.style.transform = 'translateY(0) scale(1) rotate(0)';

    await sleep(200);

    // Reset antenna
    if (this.robot.dom.svg) {
      const antenna = this.robot.dom.svg.querySelector('.robot-antenna-light');
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
      const pupils = this.robot.dom.eyes.querySelectorAll('.robot-pupil');
      pupils.forEach((p) => {
        p.style.transform = 'scale(1.5)';
        p.style.transition = 'transform 0.2s';
      });
    }

    await sleep(400);

    this.robot.dom.avatar.style.transform = '';

    // Reset eyes
    if (this.robot.dom.eyes) {
      const pupils = this.robot.dom.eyes.querySelectorAll('.robot-pupil');
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

    await sleep(2000);

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

      await sleep(move.duration);
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

    await sleep(2000);

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

    await sleep(500);

    this.robot.dom.avatar.style.transform = 'rotate(15deg)';

    await sleep(500);

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

    // Try to find search modal or input
    const searchModal = document.querySelector('.search-modal');
    const searchInput = document.getElementById('search-input');
    const targetEl = searchModal || searchInput;

    if (!targetEl) {
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

    // Calculate target position (Top-Right of search modal area)
    // We want the robot to be slightly to the right of the modal
    let targetLeft = targetRect.right + 10;
    let targetTop = targetRect.top;

    // Adjust if off-screen
    if (targetLeft + robotSize > windowWidth) {
      // If no space on right, position above the search input field (centered)
      targetLeft = targetRect.left + targetRect.width / 2 - robotSize / 2;
      targetTop = targetRect.top - robotSize - 10;

      // Ensure it doesn't go off-screen left
      if (targetLeft < 10) targetLeft = 10;
      // Ensure it doesn't go off-screen right
      if (targetLeft + robotSize > windowWidth - 10) {
        targetLeft = windowWidth - robotSize - 10;
      }
    }

    if (targetTop < 10) targetTop = 10;

    // Convert to Patrol Coordinates (X from Right, Y from Bottom)
    // patrol.x (positive = left displacement from original right pos)
    // patrol.y (positive = up displacement from original bottom pos)
    // Since we use translate3d(-x, y, 0) and the element is bottom-aligned:
    // positive y moves DOWN. To move UP, we need negative y.

    // Target Right CSS Position
    const targetRightCSS = windowWidth - (targetLeft + robotSize);
    const targetBottomCSS = windowHeight - (targetTop + robotSize);

    const targetX = targetRightCSS - baseRight;
    const targetY = -(targetBottomCSS - baseBottom);

    this.searchAnimation.active = true;
    this.searchAnimation.phase = 'approach';
    this.searchAnimation.startTime = performance.now();
    this.searchAnimation.startX = this.patrol.x;
    this.searchAnimation.startY = this.patrol.y;
    this.searchAnimation.targetX = targetX;
    this.searchAnimation.targetY = targetY;

    // Ensure robot is above search overlay
    this.robot.dom.container.style.zIndex = '10001';

    // Show magnifying glass
    if (this.robot.dom.magnifyingGlass) {
      this.robot.dom.magnifyingGlass.style.opacity = '1';
    }

    // Show excitement
    this.robot.showBubble('Ah! Ich helfe suchen! 🔍');
    setTimeout(() => this.robot.hideBubble(), 2000);

    requestAnimationFrame(this.updateSearchAnimation);
  }

  stopSearchAnimation() {
    if (!this.searchAnimation.active) return;

    this.searchAnimation.phase = 'returning';
    this.searchAnimation.startTime = performance.now();
    this.searchAnimation.startX = this.patrol.x;
    this.searchAnimation.startY = this.patrol.y;
    this.searchAnimation.targetX = 0; // Return to origin x=0
    this.searchAnimation.targetY = 0; // Return to origin y=0

    // Ensure loop continues if it was stuck
    requestAnimationFrame(this.updateSearchAnimation);

    // Hide magnifying glass
    if (this.robot.dom.magnifyingGlass) {
      this.robot.dom.magnifyingGlass.style.opacity = '0';
      // Reset to default left-hand position
      this.robot.dom.magnifyingGlass.setAttribute(
        'transform',
        'translate(22, 82) rotate(-45) scale(0.9)',
      );
    }

    // Keep loop running until returned
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
          this.robot.dom.container.style.zIndex = ''; // Reset Z-Index
          // Reset flame
          if (this.robot.dom.flame) {
            this.robot.dom.flame.style.opacity = '0';
          }
          this.startPatrol();
        } else {
          this.searchAnimation.phase = 'hover';
          requestAnimationFrame(this.updateSearchAnimation);
        }
      } else {
        requestAnimationFrame(this.updateSearchAnimation);
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

      // Scanning with Magnifying Glass
      // Keep magnifying glass fixed relative to the robot; do NOT animate its transform here.
      // The magnifying glass will follow robot movement because it's part of the robot SVG group.
      // Opacity is still controlled elsewhere (show/hide on search start/stop).
      if (this.robot.dom.magnifyingGlass) {
        // intentionally left blank to keep the glass anchored to the robot's hand
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
      requestAnimationFrame(this.updateSearchAnimation);
    }
  }

  updateRobotTransform() {
    if (!this.robot.dom.container) return;
    this.robot.dom.container.style.transform = `translate3d(-${this.patrol.x}px, ${this.patrol.y}px, 0)`;
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
}
