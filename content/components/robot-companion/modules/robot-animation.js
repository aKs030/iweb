import { sleep } from '../../../core/utils.js';

import { createObserver } from '../../../core/intersection-observer.js';

export class RobotAnimation {
  constructor(robot) {
    this.robot = robot;
    this.isVisible = true;

    // Patrol State
    this.patrol = {
      active: false,
      x: 0,
      y: 0,
      direction: 1,
      speed: 0.3,
      isPaused: false,
      bouncePhase: 0,
      noiseOffset: Math.random() * 1000,
      scrollVelocity: 0,
      scrollTilt: 0,
      verticalLag: 0,
    };

    // Squash & Stretch State
    this.visualState = {
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      targetScaleX: 1,
      targetScaleY: 1,
      lerpSpeed: 0.15,
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
      doubleBlinkChance: 0.15,
    };
    /** @type {ReturnType<typeof setTimeout> | null} */
    this._blinkTimer = null;

    // Bind loop
    this.updatePatrol = this.updatePatrol.bind(this);
    this.updateStartAnimation = this.updateStartAnimation.bind(this);

    this.thinkingActive = false;
    this.speakingActive = false;
    this.isSleeping = false;

    this._visibilityObserver = null;
    this._lastResizePanic = 0;

    /** @type {ReturnType<typeof setTimeout> | null} */
    this._speakingTimer = null;
  }

  startSpeaking() {
    if (this.speakingActive) return;
    this.speakingActive = true;

    if (this.robot.dom.svg) {
      const antenna = this.robot.dom.svg.querySelector('.robot-antenna-light');
      if (antenna && !this._speakingAnim) {
        this._speakingAnim = antenna.animate(
          [
            { fill: '#40e0d0', filter: 'drop-shadow(0 0 2px #40e0d0)' },
            { fill: '#fff', filter: 'drop-shadow(0 0 8px #40e0d0)' },
          ],
          { duration: 400, iterations: Infinity, direction: 'alternate' },
        );
      }
    }
  }

  stopSpeaking() {
    if (!this.speakingActive) return;
    this.speakingActive = false;

    if (this._speakingAnim) {
      this._speakingAnim.cancel();
      this._speakingAnim = null;
    }
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

    this.applyTransform();
    this.robot.dom.container.style.opacity = '1';
    requestAnimationFrame(this.updateStartAnimation);
  }

  /**
   * Simple multi-octave sine noise
   * @param {number} t - Time/Phase
   * @returns {number} Value between -1 and 1
   */
  getNoise(t) {
    return (
      Math.sin(t) * 0.5 + Math.sin(t * 2.1) * 0.3 + Math.sin(t * 0.7) * 0.2
    );
  }

  applyTransform() {
    if (!this.robot.dom.container) return;

    // Apply Squash & Stretch Lerp
    this.visualState.scaleX +=
      (this.visualState.targetScaleX - this.visualState.scaleX) *
      this.visualState.lerpSpeed;
    this.visualState.scaleY +=
      (this.visualState.targetScaleY - this.visualState.scaleY) *
      this.visualState.lerpSpeed;

    // Smoothly decay scroll velocity impact
    this.patrol.scrollVelocity *= 0.85; // Faster decay for snappier feel
    this.patrol.scrollTilt +=
      (this.patrol.scrollVelocity * 1.5 - this.patrol.scrollTilt) * 0.15;

    // Apply Vertical Lag (Physics)
    // The robot "lags" behind the scroll and then catches up
    this.patrol.verticalLag +=
      (this.patrol.scrollVelocity * 12 - this.patrol.verticalLag) * 0.1;
    this.patrol.verticalLag *= 0.92;

    const transform = `translate3d(-${this.patrol.x}px, ${this.patrol.y + this.patrol.verticalLag}px, 0)`;
    this.robot.dom.container.style.transform = transform;

    if (this.robot.dom.floatWrapper) {
      const totalRotation = this.visualState.rotation + this.patrol.scrollTilt;
      const visualTransform = `rotate(${totalRotation}deg) scale(${this.visualState.scaleX}, ${this.visualState.scaleY})`;
      this.robot.dom.floatWrapper.style.transform = visualTransform;
    }
  }

  handleScrollImpact(velocity) {
    // Limit impact
    const cappedVelocity = Math.max(-40, Math.min(40, velocity));
    this.patrol.scrollVelocity = cappedVelocity;

    // Tiny squash impact on scroll
    this.visualState.scaleY = 1 + Math.abs(cappedVelocity) * 0.008;
    this.visualState.scaleX = 1 - Math.abs(cappedVelocity) * 0.004;

    // Spawn wind particles if scrolling fast
    if (Math.abs(cappedVelocity) > 15) {
      this.spawnWindParticle(cappedVelocity);
    }
  }

  spawnWindParticle(velocity) {
    if (!this.robot.dom.container || !this.robot.dom.avatar) return;

    const rect = this.robot.dom.avatar.getBoundingClientRect();
    const cRect = this.robot.dom.container.getBoundingClientRect();

    const particle = document.createElement('div');
    particle.className = 'robot-wind-particle';

    const width = 10 + Math.random() * 30;
    particle.style.width = `${width}px`;

    // Horizontal spread
    const x = Math.random() * rect.width;
    // vertical position based on scroll direction
    const y = velocity > 0 ? 0 : rect.height;

    particle.style.left = rect.left - cRect.left + x + 'px';
    particle.style.top = rect.top - cRect.top + y + 'px';

    this.robot.dom.container.appendChild(particle);

    const duration = 400 + Math.random() * 300;
    const dy = -velocity * 2; // Move opposite to scroll direction

    particle.animate(
      [
        { transform: 'translateY(0) scaleX(1)', opacity: 0.6 },
        { transform: `translateY(${dy}px) scaleX(0.2)`, opacity: 0 },
      ],
      { duration, easing: 'ease-out' },
    ).onfinish = () => particle.remove();
  }

  handleResizePanic() {
    if (this.startAnimation.active) return;

    // Detect significant resize
    const now = performance.now();
    if (now - (this._lastResizePanic || 0) < 1000) return;
    this._lastResizePanic = now;

    this.visualState.targetScaleX = 1.3;
    this.visualState.targetScaleY = 0.7;
    this.robot.showBubble('Whoa! Alles ändert sich! 😱');
    this.spawnParticleBurst(5, { strength: 1.2 });

    setTimeout(() => {
      this.visualState.targetScaleX = 1;
      this.visualState.targetScaleY = 1;
      this.robot.hideBubble();
    }, 1500);
  }

  updateStartAnimation() {
    if (!this.startAnimation.active || !this.robot.dom.container) {
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
      this.patrol.y = this.getNoise(this.patrol.bouncePhase) * 5;

      // Squash & Stretch for approach
      this.visualState.targetScaleX = 0.85;
      this.visualState.targetScaleY = 1.15;
      this.visualState.rotation = -5;

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

      this.applyTransform();

      if (t >= 1) {
        this.startAnimation.phase = 'pause';
        this.startAnimation.pauseUntil = now + 200;
        this.setAvatarState({ moving: false, dashing: false });
        this.visualState.targetScaleX = 1.25; // Landing squash
        this.visualState.targetScaleY = 0.75;
        this.visualState.rotation = 0;
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

      // Squash & Stretch for knockback
      if (t < 0.2) {
        this.visualState.targetScaleX = 1.3;
        this.visualState.targetScaleY = 0.7;
      } else {
        this.visualState.targetScaleX = 0.8;
        this.visualState.targetScaleY = 1.2;
      }

      const rotation = -20 + t * 40;
      if (this.robot.dom.svg) {
        this.robot.dom.svg.style.transform = `rotate(${rotation}deg)`;
      }

      this.visualState.rotation = 15 * Math.sin(t * Math.PI * 2);
      this.applyTransform();

      if (this.robot.dom.flame) {
        this.robot.dom.flame.style.opacity = '0.2';
      }

      if (t < 0.3 && this.robot.dom.particles) {
        this.robot.dom.particles.style.opacity = '1';
      }

      if (t >= 1) {
        this.startAnimation.phase = 'landing';
        this.spawnParticleBurst(8, { strength: 1.5 });
        this.visualState.targetScaleX = 1.2;
        this.visualState.targetScaleY = 0.8;

        setTimeout(() => {
          this.startAnimation.active = false;
          this.patrol.active = true;
          this.patrol.y = 0;
          this.visualState.targetScaleX = 1;
          this.visualState.targetScaleY = 1;
          this.visualState.rotation = 0;
          if (this.robot.dom.svg) {
            this.robot.dom.svg.style.transform = 'rotate(0deg)';
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

  async playFlyInAnimation() {
    if (!this.robot.dom.container) return;

    this.robot.dom.container.style.opacity = '1';
    await this.robot.dom.container.animate(
      [
        { transform: 'translateY(100px) scale(0.5)', opacity: 0 },
        { transform: 'translateY(-20px) scale(1.1)', offset: 0.6 },
        { transform: 'translateY(0) scale(1)', opacity: 1 },
      ],
      { duration: 1000, easing: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)' },
    ).finished;
  }

  startPatrol() {
    this.patrol.active = true;
    if (this.robot.dom && this.robot.dom.container) {
      // Setup Visibility Observer
      this._visibilityObserver = createObserver((entries) => {
        this.isVisible = entries[0].isIntersecting;
      });
      this._visibilityObserver.observe(this.robot.dom.container);
    }

    // Modernize Core Light pulse with WAAPI
    if (this.robot.dom.coreLight) {
      this.robot.dom.coreLight.animate(
        [
          { opacity: 0.5, r: 4.5 },
          { opacity: 1, r: 5.5 },
        ],
        { duration: 1500, iterations: Infinity, direction: 'alternate' },
      );
    }

    // Modernize SVG Particles with WAAPI
    if (this.robot.dom.particleCircles) {
      this.robot.dom.particleCircles.forEach((circle, i) => {
        const baseCy = parseFloat(circle.getAttribute('cy'));
        circle.animate(
          [{ cy: baseCy }, { cy: baseCy - 20, offset: 0.5 }, { cy: baseCy }],
          {
            duration: 2000 + i * 500,
            iterations: Infinity,
            easing: 'ease-in-out',
          },
        );
      });
    }

    requestAnimationFrame(this.updatePatrol);
  }

  updatePatrol() {
    // If patrol is no longer active, stop the loop entirely
    if (!this.patrol.active) {
      return;
    }

    if (document.hidden || !this.isVisible) {
      setTimeout(() => requestAnimationFrame(this.updatePatrol), 1000);
      return;
    }

    if (this.startAnimation.active) {
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
    if (
      this.robot.chatModule.isOpen ||
      this.patrol.isPaused ||
      isHovering ||
      this.isSleeping
    ) {
      this.setAvatarState({ moving: false, dashing: false });
      if (this.robot.dom.flame) this.robot.dom.flame.style.opacity = '0';
      if (this.robot.dom.particles)
        this.robot.dom.particles.style.opacity = '0';

      if (this.isSleeping) {
        this.patrol.y = 20 + Math.sin(now / 1500) * 2;
        this.visualState.targetScaleX = 1.05;
        this.visualState.targetScaleY = 0.95;
      } else {
        // Still apply noise even when "paused" for a living feel
        this.patrol.bouncePhase += 0.02;
        this.patrol.y = this.getNoise(this.patrol.bouncePhase) * 3;
        this.visualState.targetScaleX = 1;
        this.visualState.targetScaleY = 1;
      }

      this.visualState.rotation = 0;

      this.applyTransform();
      if (this.robot.dom.eyes) this.updateEyesTransform();

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

    if (dashActive && Math.random() < 0.4) {
      this.spawnDashTrail();
    }

    const baseSpeed = this.motion.baseSpeed + Math.sin(now / 800) * 0.2;
    const currentSpeed = baseSpeed * (dashActive ? this.motion.dashSpeed : 1);

    this.patrol.x += currentSpeed * this.patrol.direction;

    this.patrol.bouncePhase += dashActive ? 0.08 : 0.04;
    this.patrol.y =
      this.getNoise(this.patrol.bouncePhase + this.patrol.noiseOffset) *
      (dashActive ? 6 : 4);
    this.robot.animationState = 'moving';

    this.setAvatarState({ moving: true, dashing: dashActive });

    // Squash & Stretch based on speed and direction
    if (dashActive) {
      this.visualState.targetScaleX = 1.1;
      this.visualState.targetScaleY = 0.9;
    } else {
      this.visualState.targetScaleX = 0.95;
      this.visualState.targetScaleY = 1.05;
    }

    if (this.robot.dom.svg) {
      const baseTilt = this.patrol.direction > 0 ? -5 : 5;
      const tiltIntensity = dashActive ? 1.5 : 1;
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

    this.visualState.rotation = dashActive
      ? this.patrol.direction > 0
        ? -4
        : 4
      : 0;

    this.applyTransform();

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

      const distance = (40 + Math.random() * 30) * strength;
      const dx = Math.cos(angle) * distance;
      const dy = Math.sin(angle) * distance;

      el.style.left = baseX - cRect.left - size / 2 + 'px';
      el.style.top = baseY - cRect.top - size / 2 + 'px';

      el.animate(
        [
          { transform: 'translate(0, 0) scale(1)', opacity: 1 },
          {
            transform: `translate(${dx}px, ${dy}px) scale(0)`,
            opacity: 0,
          },
        ],
        {
          duration: 600 + Math.random() * 400,
          easing: 'cubic-bezier(0.1, 0.8, 0.2, 1)',
        },
      ).onfinish = () => el.remove();
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
        background: #40e0d0;
        border-radius: 50%;
        pointer-events: none;
        opacity: 0.8;
        mix-blend-mode: screen;
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

    el.animate(
      [
        { transform: 'translate(0, 0) scale(1)', opacity: 0.8 },
        {
          transform: `translate(${(Math.random() - 0.5) * 15}px, ${
            15 + Math.random() * 15
          }px) scale(0)`,
          opacity: 0,
        },
      ],
      { duration: 600, easing: 'ease-out' },
    ).onfinish = () => el.remove();
  }

  spawnDashTrail() {
    if (!this.robot.dom.container || !this.robot.dom.avatar) return;

    const el = this.robot.dom.avatar.cloneNode(true);
    el.classList.remove('is-moving', 'is-dashing', 'waving', 'check-watch');
    el.classList.add('robot-dash-trail');
    el.style.position = 'absolute';
    el.style.pointerEvents = 'none';
    el.style.zIndex = '-1';
    el.style.opacity = '0.4';
    el.style.filter = 'brightness(1.5) blur(1px) saturate(2)';

    const rect = this.robot.dom.avatar.getBoundingClientRect();
    const cRect = this.robot.dom.container.getBoundingClientRect();

    el.style.left = rect.left - cRect.left + 'px';
    el.style.top = rect.top - cRect.top + 'px';
    el.style.width = rect.width + 'px';
    el.style.height = rect.height + 'px';

    this.robot.dom.container.appendChild(el);

    el.animate(
      [
        { opacity: 0.4, scale: 1 },
        { opacity: 0, scale: 0.8 },
      ],
      {
        duration: 500,
        easing: 'ease-out',
      },
    ).onfinish = () => el.remove();
  }

  async playPokeAnimation() {
    if (!this.robot.dom.avatar) {
      return;
    }

    const effects = [
      'jump',
      'shake',
      'flash',
      'short-circuit',
      'flip',
      'heart',
      'spin',
    ];
    const effect = effects[Math.floor(Math.random() * effects.length)];

    if (effect === 'jump') {
      await this.robot.dom.avatar.animate(
        [
          { transform: 'translateY(0) scale(1)' },
          { transform: 'translateY(-25px) scale(1.1)', offset: 0.4 },
          { transform: 'translateY(0) scale(1)' },
        ],
        { duration: 400, easing: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)' },
      ).finished;
    } else if (effect === 'shake') {
      await this.robot.dom.avatar.animate(
        [
          { transform: 'translateX(0)' },
          { transform: 'translateX(-6px) rotate(-6deg)' },
          { transform: 'translateX(6px) rotate(6deg)' },
          { transform: 'translateX(-6px) rotate(-6deg)' },
          { transform: 'translateX(0)' },
        ],
        { duration: 300 },
      ).finished;
    } else if (effect === 'short-circuit') {
      this.spawnShortCircuitEffect();
    } else if (effect === 'flip') {
      await this.robot.dom.avatar.animate(
        [
          { transform: 'rotate(0deg) scale(1)' },
          { transform: 'rotate(180deg) scale(0.8)', offset: 0.5 },
          { transform: 'rotate(360deg) scale(1)' },
        ],
        { duration: 600, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' },
      ).finished;
    } else if (effect === 'heart') {
      this.robot.showBubble('❤️');
      await this.robot.dom.avatar.animate(
        [
          { transform: 'scale(1)' },
          { transform: 'scale(1.3)', offset: 0.5 },
          { transform: 'scale(1)' },
        ],
        { duration: 400 },
      ).finished;
      setTimeout(() => this.robot.hideBubble(), 1500);
    } else if (effect === 'spin') {
      await this.robot.dom.avatar.animate(
        [
          { transform: 'rotateY(0)' },
          { transform: 'rotateY(360deg)', offset: 1 },
        ],
        { duration: 500, easing: 'ease-in-out' },
      ).finished;
    } else {
      if (this.robot.dom.svg) {
        await this.robot.dom.svg.animate(
          [
            { filter: 'brightness(1)' },
            {
              filter: 'brightness(2.5) drop-shadow(0 0 15px #fff)',
              offset: 0.2,
            },
            { filter: 'brightness(1)' },
          ],
          { duration: 400 },
        ).finished;
      }
    }
  }

  /**
   * Trigger the blue force field effect
   */
  triggerShieldEffect() {
    if (!this.robot.dom.container) return;

    let shield = this.robot.dom.container.querySelector('.robot-shield');
    if (!shield) {
      shield = document.createElement('div');
      shield.className = 'robot-shield';
      this.robot.dom.container.appendChild(shield);
    }

    shield.animate(
      [
        { transform: 'scale(0.8)', opacity: 0 },
        { transform: 'scale(1.1)', opacity: 1, offset: 0.2 },
        { transform: 'scale(1.25)', opacity: 0 },
      ],
      {
        duration: 600,
        easing: 'ease-out',
      },
    );
  }

  /**
   * Proactive behavior: points to search or contact
   */
  triggerProactiveHelp() {
    if (this.robot.chatModule.isOpen || this.isSleeping || this.patrol.isPaused)
      return;

    const targets = [
      { selector: '.search-trigger', message: 'Suchst du was? 🔍' },
      { selector: '[data-footer-trigger]', message: 'Sag Hallo! ✉️' },
    ];

    const target = targets[Math.floor(Math.random() * targets.length)];
    const el = document.querySelector(target.selector);

    if (el) {
      this.robot.showBubble(target.message);
      this.pointAtElement(el);
      setTimeout(() => this.robot.hideBubble(), 4000);
    }
  }

  /**
   * Modernized Spark Effect using WAAPI
   */
  spawnShortCircuitEffect() {
    if (!this.robot.dom.container || !this.robot.dom.avatar) return;

    this.robot.showBubble('Bzzt! ⚡');
    this.robot.dom.avatar.animate(
      [
        { filter: 'invert(0)' },
        {
          filter: 'invert(0.5) sepia(1) saturate(5) hue-rotate(180deg)',
          offset: 0.1,
        },
        { filter: 'invert(0)' },
      ],
      { duration: 100, iterations: 3 },
    );

    const rect = this.robot.dom.avatar.getBoundingClientRect();
    const cRect = this.robot.dom.container.getBoundingClientRect();

    for (let i = 0; i < 5; i++) {
      const spark = document.createElement('div');
      spark.className = 'robot-spark';
      spark.style.left =
        rect.left - cRect.left + Math.random() * rect.width + 'px';
      spark.style.top =
        rect.top - cRect.top + Math.random() * rect.height + 'px';
      this.robot.dom.container.appendChild(spark);

      spark.animate(
        [
          { transform: 'scale(1) rotate(0deg)', opacity: 1 },
          {
            transform: `scale(0) translate(${(Math.random() - 0.5) * 40}px, ${(Math.random() - 0.5) * 40}px) rotate(${
              Math.random() * 360
            }deg)`,
            opacity: 0,
          },
        ],
        { duration: 300 + Math.random() * 200, easing: 'ease-out' },
      ).onfinish = () => spark.remove();
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

    let totalX = 0;
    let totalY = 0;

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
    totalX = baseX + (this.eyeIdleOffset.x || 0);
    totalY = this.eyeIdleOffset.y || 0;

    this.robot.dom.eyes.style.transform = `translate(${totalX}px, ${totalY}px)`;
    this.robot.dom.eyes.style.transition = 'transform 0.2s ease-out';
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

  destroy() {
    this.stopIdleEyeMovement();
    this.stopBlinkLoop();
    if (this._visibilityObserver) {
      this._visibilityObserver.disconnect();
      this._visibilityObserver = null;
    }
    this.speakingActive = false;
    this.thinkingActive = false;
    this.patrol.active = false;
  }

  doBlink() {
    if (!this.robot.dom || !this.robot.dom.eyes) return;
    const lids = this.robot.dom.eyes.querySelectorAll('.robot-lid');
    if (!lids.length) return;

    const executeBlink = () => {
      lids.forEach((l) => {
        l.animate(
          [
            { transform: 'scaleY(0)', opacity: 0 },
            { transform: 'scaleY(1.1)', opacity: 1, offset: 0.1 },
            { transform: 'scaleY(1.1)', opacity: 1, offset: 0.9 },
            { transform: 'scaleY(0)', opacity: 0 },
          ],
          { duration: this.blinkConfig.duration || 150 },
        );
      });
    };

    executeBlink();

    // Occasional double blink
    if (Math.random() < this.blinkConfig.doubleBlinkChance) {
      setTimeout(() => executeBlink(), this.blinkConfig.duration + 150);
    }
  }

  setDizzy(active = true) {
    if (!this.robot.dom.avatar) return;
    this.robot.dom.avatar.classList.toggle('is-dizzy', active);

    if (this.robot.dom.eyes) {
      this.robot.dom.eyes.classList.toggle('is-dizzy', active);
    }

    if (active) {
      this.robot.showBubble('😵 Woah...');
      this.spawnParticleBurst(8, { strength: 1.2, spread: 360 });
      this.pausePatrol(2500);

      if (this.robot.dom.eyes) {
        this.robot.dom.eyes.style.transform = 'rotate(180deg) scale(0.8)';
      }

      setTimeout(() => {
        this.setDizzy(false);
        if (this.robot.dom.eyes) this.robot.dom.eyes.style.transform = '';
      }, 2500);
    }
  }

  /**
   * Activate or deactivate sleep mode
   * @param {boolean} active
   */
  setSleeping(active = true) {
    if (this.isSleeping === active) return;
    this.isSleeping = active;

    if (this.robot.dom.avatar) {
      this.robot.dom.avatar.classList.toggle('is-sleeping', active);
    }

    if (active) {
      // Sinking effect
      this.patrol.y = 20;
      this.visualState.targetScaleX = 1.05;
      this.visualState.targetScaleY = 0.95;

      // Start Zzz particles
      this._zzzTimer = setInterval(() => this.spawnZzzParticle(), 2500);

      // Start breathing animation
      if (this.robot.dom.avatar) {
        this._sleepAnim = this.robot.dom.avatar.animate(
          [
            { transform: 'scale(1) translateY(0)' },
            { transform: 'scale(1.03, 0.97) translateY(2px)', offset: 0.5 },
            { transform: 'scale(1) translateY(0)' },
          ],
          {
            duration: 3000,
            iterations: Infinity,
            easing: 'ease-in-out',
          },
        );
      }
    } else {
      if (this._zzzTimer) clearInterval(this._zzzTimer);
      if (this._sleepAnim) this._sleepAnim.cancel();

      this.patrol.y = 0;
      this.visualState.targetScaleX = 1;
      this.visualState.targetScaleY = 1;

      // Wake up jump effect
      this.playPokeAnimation();
    }
  }

  spawnZzzParticle() {
    if (
      !this.robot.dom.container ||
      !this.robot.dom.avatar ||
      !this.isSleeping
    ) {
      if (this._zzzTimer) clearInterval(this._zzzTimer);
      return;
    }

    const rect = this.robot.dom.avatar.getBoundingClientRect();
    const cRect = this.robot.dom.container.getBoundingClientRect();

    const zzz = document.createElement('div');
    zzz.className = 'robot-zzz-particle';
    const isCapital = Math.random() > 0.5;
    zzz.textContent = isCapital ? 'Z' : 'z';
    zzz.style.fontSize = `${isCapital ? 14 : 10}px`;

    const startX = rect.left - cRect.left + rect.width * 0.7;
    const startY = rect.top - cRect.top + rect.height * 0.2;

    zzz.style.left = startX + 'px';
    zzz.style.top = startY + 'px';

    this.robot.dom.container.appendChild(zzz);

    const driftX = 15 + Math.random() * 20;
    const driftY = -40 - Math.random() * 30;

    zzz.animate(
      [
        { transform: 'translate(0, 0) scale(0.5) rotate(0deg)', opacity: 0 },
        {
          transform: `translate(${driftX * 0.3}px, ${driftY * 0.3}px) scale(1) rotate(10deg)`,
          opacity: 1,
          offset: 0.2,
        },
        {
          transform: `translate(${driftX}px, ${driftY}px) scale(1.5) rotate(-10deg)`,
          opacity: 0,
        },
      ],
      {
        duration: 2500 + Math.random() * 1000,
        easing: 'ease-out',
      },
    ).onfinish = () => zzz.remove();
  }

  /**
   * Show excitement animation (jumping with particles)
   */
  async playExcitementAnimation() {
    if (!this.robot.dom.avatar) return;

    this.spawnParticleBurst(15, { strength: 1.6, spread: 360 });

    if (this.robot.dom.svg) {
      const antenna = this.robot.dom.svg.querySelector('.robot-antenna-light');
      if (antenna) {
        antenna.animate(
          [
            { fill: '#ffff00', filter: 'drop-shadow(0 0 10px #ffff00)' },
            { fill: '', filter: '' },
          ],
          { duration: 800 },
        );
      }
    }

    await this.robot.dom.avatar.animate(
      [
        { transform: 'translateY(0) scale(1) rotate(0)' },
        {
          transform: 'translateY(-40px) scale(1.2) rotate(10deg)',
          offset: 0.4,
        },
        { transform: 'translateY(0) scale(1) rotate(0)' },
      ],
      { duration: 600, easing: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)' },
    ).finished;
  }

  /**
   * Show surprise animation (eyes wide, jump back)
   */
  async playSurpriseAnimation() {
    if (!this.robot.dom.avatar) return;

    if (this.robot.dom.eyes) {
      const pupils = this.robot.dom.eyes.querySelectorAll('.robot-pupil');
      pupils.forEach((p) => {
        p.animate(
          [
            { transform: 'scale(1)' },
            { transform: 'scale(1.8)', offset: 0.2 },
            { transform: 'scale(1)' },
          ],
          { duration: 600 },
        );
      });
    }

    await this.robot.dom.avatar.animate(
      [
        { transform: 'translateX(0) scale(1)' },
        { transform: 'translateX(-20px) scale(1.15)', offset: 0.3 },
        { transform: 'translateX(0) scale(1)' },
      ],
      { duration: 500, easing: 'ease-out' },
    ).finished;
  }

  /**
   * Point to a specific element on the page
   * @param {HTMLElement} element - Element to point at
   */
  async pointAtElement(element) {
    if (!this.robot.dom.avatar || !element) return;

    const robotRect = this.robot.dom.avatar.getBoundingClientRect();
    const targetRect = element.getBoundingClientRect();

    const isAbove = targetRect.top < robotRect.top;
    const isLeft = targetRect.left < robotRect.left;
    const angle = isAbove ? (isLeft ? -25 : -15) : isLeft ? 15 : 25;

    if (this.robot.dom.eyes) {
      this.robot.dom.eyes.animate(
        [
          { transform: 'translate(0, 0)' },
          {
            transform: `translate(${isLeft ? -4 : 4}px, ${isAbove ? -3 : 3}px)`,
          },
        ],
        { duration: 400, fill: 'forwards' },
      );
    }

    this.robot.dom.avatar.classList.add('pointing');
    await this.robot.dom.avatar.animate(
      [
        { transform: 'rotate(0deg) scale(1)' },
        { transform: `rotate(${angle}deg) scale(1.08)` },
      ],
      { duration: 400, fill: 'forwards', easing: 'ease-out' },
    ).finished;

    await sleep(2000);

    this.robot.dom.avatar.classList.remove('pointing');
    this.robot.dom.avatar.animate([{ transform: 'rotate(0deg) scale(1)' }], {
      duration: 300,
    });
    if (this.robot.dom.eyes) {
      this.robot.dom.eyes.animate([{ transform: 'translate(0, 0)' }], {
        duration: 300,
      });
    }
  }

  /**
   * Dance animation (celebration)
   */
  async playDanceAnimation() {
    if (!this.robot.dom.avatar) return;

    const anim = this.robot.dom.avatar.animate(
      [
        { transform: 'rotate(0deg) translateY(0)' },
        { transform: 'rotate(-12deg) translateY(-8px)', offset: 0.25 },
        { transform: 'rotate(12deg) translateY(-12px)', offset: 0.5 },
        { transform: 'rotate(-12deg) translateY(-8px)', offset: 0.75 },
        { transform: 'rotate(0deg) translateY(0)' },
      ],
      { duration: 800, iterations: 2, easing: 'ease-in-out' },
    );

    const particleInterval = setInterval(() => {
      this.spawnParticleBurst(3, { strength: 0.8, spread: 180 });
    }, 200);

    await anim.finished;
    clearInterval(particleInterval);
  }

  /**
   * Sad animation (head down)
   */
  async playSadAnimation() {
    if (!this.robot.dom.avatar) return;

    if (this.robot.dom.eyes) {
      this.robot.dom.eyes.animate(
        [{ transform: 'translate(0, 0)' }, { transform: 'translate(0, 4px)' }],
        { duration: 600, fill: 'forwards' },
      );
    }

    await this.robot.dom.avatar.animate(
      [{ transform: 'translateY(0)' }, { transform: 'translateY(6px)' }],
      { duration: 800, fill: 'forwards', easing: 'ease-in-out' },
    ).finished;

    await sleep(1500);

    this.robot.dom.avatar.animate([{ transform: 'translateY(0)' }], {
      duration: 500,
    });
    if (this.robot.dom.eyes) {
      this.robot.dom.eyes.animate([{ transform: 'translate(0, 0)' }], {
        duration: 500,
      });
    }
  }

  /**
   * Confused animation (head tilt with question mark)
   */
  async playConfusedAnimation() {
    if (!this.robot.dom.avatar) return;

    if (this.robot.dom.thinking) {
      this.robot.dom.thinking.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: 300,
        fill: 'forwards',
      });
    }

    await this.robot.dom.avatar.animate(
      [
        { transform: 'rotate(0deg)' },
        { transform: 'rotate(-18deg)', offset: 0.3 },
        { transform: 'rotate(18deg)', offset: 0.7 },
        { transform: 'rotate(0deg)' },
      ],
      { duration: 1200, easing: 'ease-in-out' },
    ).finished;

    if (this.robot.dom.thinking) {
      this.robot.dom.thinking.animate([{ opacity: 0 }], { duration: 300 });
      this.robot.dom.thinking.style.opacity = '0';
    }
  }
}
