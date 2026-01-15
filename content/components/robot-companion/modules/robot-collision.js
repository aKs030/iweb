import { createLogger } from '/content/utils/shared-utilities.js';
import { createObserver } from '/content/utils/intersection-observer.js';
const log = createLogger('RobotCollision');

export class RobotCollision {
  constructor(robot) {
    this.robot = robot;
    this._lastCollisionCheck = 0;
    this._lastObstacleUpdate = 0;
    this._recentCollisions = new WeakSet();

    this.visibleObstacles = new Set();
    this._trackedObstacles = new WeakSet();

    this.obstacleObserver = createObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            this.visibleObstacles.add(entry.target);
          } else {
            this.visibleObstacles.delete(entry.target);
          }
        });
      },
      { rootMargin: '50px' },
    );
  }

  destroy() {
    // Disconnect IntersectionObserver
    if (this.obstacleObserver) {
      this.obstacleObserver.disconnect();
      this.obstacleObserver = null;
    }

    // Clear alle Sets
    this.visibleObstacles.clear();
    this._recentCollisions = new WeakSet();
    this._trackedObstacles = new WeakSet();
  }

  updateObstacleCache() {
    // Update cache every 2 seconds or so
    const now = performance.now();
    if (this._lastObstacleUpdate && now - this._lastObstacleUpdate < 2000)
      return;
    this._lastObstacleUpdate = now;

    // Cache relevant elements
    const currentObstacles = document.querySelectorAll(
      'img, .card, button.btn, h2, .gallery-item',
    );

    currentObstacles.forEach((el) => {
      if (!this._trackedObstacles.has(el)) {
        this.obstacleObserver.observe(el);
        this._trackedObstacles.add(el);
      }
    });
  }

  scanForCollisions() {
    if (
      !this.robot.dom.avatar ||
      this.robot.chatModule.isOpen ||
      (this.robot.animationModule.startAnimation &&
        this.robot.animationModule.startAnimation.active)
    )
      return;

    // Throttling: check frequently (30ms ~ 33fps) for low latency
    const now = performance.now();
    if (this._lastCollisionCheck && now - this._lastCollisionCheck < 30) return;
    this._lastCollisionCheck = now;

    // Update obstacle cache periodically
    this.updateObstacleCache();

    const robotRect = this.robot.dom.avatar.getBoundingClientRect();

    // Iterate only over visible obstacles
    for (const obs of this.visibleObstacles) {
      // Skip hidden or tiny elements (re-check visibility as they might have changed)
      if (obs.offsetParent === null) continue;

      // Skip self (just in case) or children
      if (this.robot.dom.container.contains(obs)) continue;

      const obsRect = obs.getBoundingClientRect();

      // Intersection check
      // Robot is roughly 80x80. We use a smaller hitbox.
      const hitBox = {
        left: robotRect.left + 15,
        right: robotRect.right - 15,
        top: robotRect.top + 10,
        bottom: robotRect.bottom - 10,
      };

      const intersect = !(
        obsRect.right < hitBox.left ||
        obsRect.left > hitBox.right ||
        obsRect.bottom < hitBox.top ||
        obsRect.top > hitBox.bottom
      );

      if (intersect) {
        // Check if we already collided with this recently
        if (this._recentCollisions.has(obs)) continue;

        this.triggerCollisionReaction(obs, obsRect);

        // Cooldown for this specific object
        this._recentCollisions.add(obs);
        setTimeout(() => {
          this._recentCollisions.delete(obs);
        }, 500);

        // Only one collision at a time
        return;
      }
    }
  }

  triggerCollisionReaction(obs, obsRect) {
    // Reactions: Knockback, Dizzy, Short Circuit, Bounce
    const r = Math.random();
    let type = 'bounce';
    if (r < 0.2) type = 'dizzy';
    else if (r < 0.4) type = 'short_circuit';
    else if (r < 0.6) type = 'knockback';

    // Determine direction relative to object center
    const robotRect = this.robot.dom.avatar.getBoundingClientRect();
    const robotCX = robotRect.left + robotRect.width / 2;
    const obsCX = obsRect.left + obsRect.width / 2;

    const hitFromRight = robotCX > obsCX; // Robot is to the right of object center

    // Show bubble
    const texts = ['Huch!', 'Oha!', 'Eng hier!', 'Platz da!'];
    this.robot.showBubble(texts[Math.floor(Math.random() * texts.length)]);
    setTimeout(() => this.robot.hideBubble(), 1500);

    if (this.robot.soundModule) this.robot.soundModule.playError();

    const anim = this.robot.animationModule;

    if (type === 'dizzy') {
      anim.pausePatrol(2000);
      if (this.robot.dom.svg) {
        this.robot.dom.svg.style.transition = 'transform 1s ease';
        this.robot.dom.svg.style.transform = 'rotate(720deg)';
      }
      if (this.robot.dom.eyes) {
        // Temporarily change eyes to 'X'
        this.robot.dom.eyes.innerHTML = `
            <path d="M35,38 L45,46 M45,38 L35,46" stroke="#40e0d0" stroke-width="3" />
            <path d="M55,38 L65,46 M65,38 L55,46" stroke="#40e0d0" stroke-width="3" />
        `;
        setTimeout(() => {
          // Restore eyes
          if (this.robot.dom.eyes) {
            this.robot.dom.eyes.innerHTML = `
                <circle class="robot-pupil" cx="40" cy="42" r="4" fill="#40e0d0" filter="url(#glow)" />
                <path class="robot-lid" d="M34 36 C36 30 44 30 46 36 L46 44 C44 38 36 38 34 44 Z" fill="url(#lidGradient)" filter="url(#lidShadow)" />
                <circle class="robot-pupil" cx="60" cy="42" r="4" fill="#40e0d0" filter="url(#glow)" />
                <path class="robot-lid" d="M54 36 C56 30 64 30 66 36 L66 44 C64 38 56 38 54 44 Z" fill="url(#lidGradient)" filter="url(#lidShadow)" />
             `;
          }
          if (this.robot.dom.svg) this.robot.dom.svg.style.transform = '';
        }, 2000);
      }
    } else if (type === 'short_circuit') {
      anim.pausePatrol(1500);
      anim.spawnParticleBurst(10, { spread: 360, strength: 1.5 });
      this.robot.dom.avatar.style.animation = 'none'; // reset
      // Trigger CSS jitter
      this.robot.dom.avatar.animate(
        [
          { transform: 'translate(2px, 2px)' },
          { transform: 'translate(-2px, -2px)' },
          { transform: 'translate(2px, -2px)' },
          { transform: 'translate(-2px, 2px)' },
        ],
        { duration: 100, iterations: 10 },
      );
    } else if (type === 'knockback') {
      // Push away
      anim.patrol.direction = hitFromRight ? -1 : 1;
      anim.spawnParticleBurst(5, { direction: anim.patrol.direction });
      // Force move immediately
      anim.patrol.x += anim.patrol.direction * 50;
      anim.patrol.x = Math.max(0, anim.patrol.x); // Clamp
    } else {
      // Bounce
      anim.patrol.direction *= -1;
      anim.patrol.x += anim.patrol.direction * 20; // Clear collision
      anim.spawnParticleBurst(3);
    }
  }

  checkForTypewriterCollision(twRect, _maxLeft) {
    if (!twRect) return false;
    // Allow collisions even if the robot recently changed direction.
    // Previously this returned early when a startAnimation was active which
    // prevented showing the bubble/particles for subsequent quick collisions.
    // Instead: always show the reaction (bubble + particles) but only
    // trigger the knockback/startAnimation when it's not already active.
    if (!this.robot.dom || !this.robot.dom.container) return false;
    try {
      // Use the robot avatar or svg bounding box instead of the full container
      const sourceEl =
        this.robot.dom.svg || this.robot.dom.avatar || this.robot.dom.container;
      const rRectRaw = sourceEl.getBoundingClientRect();
      // Shrink the rect slightly so the collision triggers only when the visible robot
      // (not the container/bubble) is actually overlapping the text
      const shrinkX = 10; // px horizontally
      const shrinkY = 6; // px vertically
      const rRect = {
        left: rRectRaw.left + shrinkX,
        right: rRectRaw.right - shrinkX,
        top: rRectRaw.top + shrinkY,
        bottom: rRectRaw.bottom - shrinkY,
      };
      const intersects = !(
        twRect.right < rRect.left ||
        twRect.left > rRect.right ||
        twRect.bottom < rRect.top ||
        twRect.top > rRect.bottom
      );
      if (!intersects) return false;
      // Require a minimal overlap in px so the robot and text truly touch (prevents early triggers)
      const overlapX =
        Math.min(twRect.right, rRect.right) - Math.max(twRect.left, rRect.left);
      const overlapY =
        Math.min(twRect.bottom, rRect.bottom) - Math.max(twRect.top, rRect.top);
      if (overlapX < 6 || overlapY < 6) return false;
      // Clamp maxLeft fallback
      const robotWidth = 80;
      const initialLeft = window.innerWidth - 30 - robotWidth;
      _maxLeft = typeof _maxLeft === 'number' ? _maxLeft : initialLeft - 20;

      // Collision reaction: show bubble and particle burst. If there's no
      // existing startAnimation active, trigger the dedicated knockback.
      const reactions = [
        'Autsch! 😵',
        'Ups! Das war hart! 💥',
        'Whoa! 😲',
        'Hey! Nicht schubsen! 😠',
      ];
      const reaction = reactions[Math.floor(Math.random() * reactions.length)];
      this.robot.showBubble(reaction);
      setTimeout(() => this.robot.hideBubble(), 2500);
      this.robot.animationModule.spawnParticleBurst(18, {
        strength: 2.0,
        spread: 180,
      });

      const anim = this.robot.animationModule;
      if (!anim.startAnimation || !anim.startAnimation.active) {
        // Pass the actual typewriter rect so the response can compute safely
        this.startTypewriterCollisionResponse(twRect, _maxLeft);
      }

      return true;
    } catch (err) {
      log.warn('checkForTypewriterCollision failed', err);
      return false;
    }
  }

  startTypewriterCollisionResponse(_twRect, _maxLeft) {
    if (!this.robot.dom || !this.robot.dom.container) return;
    const anim = this.robot.animationModule;
    // Prevent overlapping animations
    if (anim.startAnimation && anim.startAnimation.active) return;
    const now = performance.now();

    // Setup knockback animation parameters (re-use existing startAnimation workflow)
    anim.startAnimation.active = true;
    anim.startAnimation.phase = 'knockback';
    anim.startAnimation.knockbackStartTime = now;
    anim.startAnimation.knockbackDuration = 700; // slightly longer for drama
    anim.startAnimation.knockbackStartX = anim.patrol.x;
    anim.startAnimation.knockbackStartY = anim.patrol.y;

    // Kick off the animation loop
    requestAnimationFrame(anim.updateStartAnimation);
  }
}
