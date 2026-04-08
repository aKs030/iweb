import { createLogger } from '#core/logger.js';
import { createObserver } from '#core/dom-utils.js';
const log = createLogger('RobotCollision');

const OBSTACLE_SELECTOR =
  'img, .card, button.btn, h2, .project-card, [data-test="photo-card"]';
const DECORATIVE_IGNORE_SELECTORS = [
  '[data-decorative="true"]',
  '.hero__floating-icons',
  '.hero__spotlight-bg',
  '.blog-3d-background',
  '#blog-particles-canvas',
  '.menu-ripple',
  '.visually-hidden',
  '.sr-only',
  'figure[aria-hidden="true"]',
  '.robot-burst-particle',
];

export class RobotCollision {
  constructor(robot) {
    this.robot = robot;
    this._lastCollisionCheck = 0;
    this._lastObstacleUpdate = 0;
    this._lastDecorativeTagUpdate = 0;
    this._scanCursor = 0;
    this._recentCollisions = new WeakSet();
    this._obstacleMeta = new WeakMap();

    this.visibleObstacles = new Set();
    this._trackedObstacles = new Set();

    this.obstacleObserver = createObserver(
      (entries) => {
        entries.forEach((entry) => {
          this._obstacleMeta.set(entry.target, {
            rect: entry.boundingClientRect,
            ts: performance.now(),
          });
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
    }

    // Clear alle Sets
    this.visibleObstacles.clear();
    this._trackedObstacles.clear();
    this._recentCollisions = new WeakSet();
    this._obstacleMeta = new WeakMap();
  }

  shouldTrackObstacle(el) {
    if (!el || !el.isConnected) return false;
    if (el.hasAttribute('data-collision-ignore')) return false;
    if (el.closest?.('[data-collision-ignore]')) return false;
    if (this.robot.dom?.container?.contains(el)) return false;
    return true;
  }

  markDecorativeElements() {
    const now = performance.now();
    if (
      this._lastDecorativeTagUpdate &&
      now - this._lastDecorativeTagUpdate < 3000
    ) {
      return;
    }
    this._lastDecorativeTagUpdate = now;

    const nodes = document.querySelectorAll(
      DECORATIVE_IGNORE_SELECTORS.join(','),
    );
    nodes.forEach((el) => {
      if (!el.hasAttribute('data-collision-ignore')) {
        el.setAttribute('data-collision-ignore', '');
      }
    });
  }

  cleanupDetachedObstacles() {
    for (const obs of this.visibleObstacles) {
      if (!obs.isConnected) {
        this.visibleObstacles.delete(obs);
      }
    }

    for (const obs of this._trackedObstacles) {
      if (obs.isConnected) continue;
      try {
        this.obstacleObserver.unobserve(obs);
      } catch {
        /* ignore */
      }
      this._trackedObstacles.delete(obs);
      this.visibleObstacles.delete(obs);
    }
  }

  updateObstacleCache() {
    this.markDecorativeElements();

    // Update cache every 2 seconds or so
    const now = performance.now();
    if (this._lastObstacleUpdate && now - this._lastObstacleUpdate < 2000) {
      this.cleanupDetachedObstacles();
      return;
    }
    this._lastObstacleUpdate = now;

    this.cleanupDetachedObstacles();

    // Cache relevant elements
    const currentObstacles = document.querySelectorAll(OBSTACLE_SELECTOR);
    const nextObstacles = new Set();

    currentObstacles.forEach((el) => {
      if (!this.shouldTrackObstacle(el)) return;
      nextObstacles.add(el);
      if (!this._trackedObstacles.has(el)) {
        this.obstacleObserver.observe(el);
        this._trackedObstacles.add(el);
      }
    });

    for (const tracked of this._trackedObstacles) {
      if (nextObstacles.has(tracked)) continue;
      this.obstacleObserver.unobserve(tracked);
      this._trackedObstacles.delete(tracked);
      this.visibleObstacles.delete(tracked);
    }
  }

  getCandidatesForCollisionScan(robotRect) {
    const candidates = [];
    const proximityPadding = 260;

    for (const obs of this.visibleObstacles) {
      if (!obs?.isConnected) continue;
      if (obs.offsetParent === null) continue;
      if (this.robot.dom.container?.contains(obs)) continue;

      const meta = this._obstacleMeta.get(obs);
      const cachedRect = meta?.rect;

      // Coarse pruning before expensive rect reads.
      if (cachedRect) {
        if (
          cachedRect.right < robotRect.left - proximityPadding ||
          cachedRect.left > robotRect.right + proximityPadding ||
          cachedRect.bottom < robotRect.top - proximityPadding ||
          cachedRect.top > robotRect.bottom + proximityPadding
        ) {
          continue;
        }
      }

      candidates.push(obs);
    }

    return candidates;
  }

  getScannableCandidates(candidates) {
    if (candidates.length <= 28) {
      this._scanCursor = 0;
      return candidates;
    }

    const maxChecks =
      candidates.length > 100 ? 16 : candidates.length > 60 ? 22 : 28;
    const selected = [];
    const total = candidates.length;
    if (this._scanCursor >= total) {
      this._scanCursor = 0;
    }

    for (let i = 0; i < Math.min(maxChecks, total); i++) {
      const index = (this._scanCursor + i) % total;
      selected.push(candidates[index]);
    }

    this._scanCursor = (this._scanCursor + maxChecks) % total;
    return selected;
  }

  scanForCollisions() {
    if (
      !this.robot.dom.avatar ||
      this.robot.chatModule.isOpen ||
      (this.robot.animationModule.startAnimation &&
        this.robot.animationModule.startAnimation.active)
    )
      return;

    const obstacleCount = this.visibleObstacles.size;
    const minScanIntervalMs =
      obstacleCount > 100
        ? 95
        : obstacleCount > 60
          ? 70
          : obstacleCount > 30
            ? 50
            : 35;

    // Adaptive throttling based on current obstacle density.
    const now = performance.now();
    if (
      this._lastCollisionCheck &&
      now - this._lastCollisionCheck < minScanIntervalMs
    )
      return;
    this._lastCollisionCheck = now;

    // Update obstacle cache periodically
    this.updateObstacleCache();

    const robotRect = this.robot.dom.avatar.getBoundingClientRect();
    const candidates = this.getScannableCandidates(
      this.getCandidatesForCollisionScan(robotRect),
    );
    if (candidates.length === 0) return;

    for (const obs of candidates) {
      const obsRect = obs.getBoundingClientRect();
      this._obstacleMeta.set(obs, { rect: obsRect, ts: now });

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
        this.robot._setTimeout(() => {
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
    this.robot._setTimeout(() => this.robot.hideBubble(), 1500);

    const anim = this.robot.animationModule;

    if (type === 'dizzy') {
      anim.pausePatrol(2000);
      if (this.robot.dom.svg) {
        this.robot.dom.svg.style.transition = 'transform 1s ease';
        this.robot.dom.svg.style.transform = 'rotate(720deg)';
      }
      if (this.robot.dom.eyes) {
        // Temporarily hide original eyes
        if (this.robot.dom.pupils)
          this.robot.dom.pupils.forEach((p) => (p.style.display = 'none'));
        if (this.robot.dom.lids)
          this.robot.dom.lids.forEach((l) => (l.style.display = 'none'));

        const dizzyGroup = document.createElementNS(
          'http://www.w3.org/2000/svg',
          'g',
        );
        dizzyGroup.classList.add('dizzy-eyes-temp');
        dizzyGroup.innerHTML = `
            <path d="M35,38 L45,46 M45,38 L35,46" stroke="var(--robot-svg-stroke)" stroke-width="3" />
            <path d="M55,38 L65,46 M65,38 L55,46" stroke="var(--robot-svg-stroke)" stroke-width="3" />
        `;
        this.robot.dom.eyes.appendChild(dizzyGroup);

        this.robot._setTimeout(() => {
          // Restore eyes
          if (this.robot.dom.eyes) {
            const temp = this.robot.dom.eyes.querySelector('.dizzy-eyes-temp');
            if (temp) temp.remove();
          }
          if (this.robot.dom.pupils)
            this.robot.dom.pupils.forEach((p) => (p.style.display = ''));
          if (this.robot.dom.lids)
            this.robot.dom.lids.forEach((l) => (l.style.display = ''));

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

  // ── Text Collision Impact Effects ───────────────────────────

  /**
   * Play visual impact effects on the typewriter text when the robot collides.
   * Randomly picks 2-3 effects from: shake, glitch, scatter, flash.
   * Also spawns a shockwave ring and directional sparks at the impact point.
   * @param {Element} typeWriter - The typewriter DOM element
   * @param {DOMRect} twRect - Bounding rect of the typewriter
   */
  _playTextCollisionEffect(typeWriter, twRect) {
    if (!typeWriter || this._textCollisionCooldown) return;

    // Cooldown to prevent rapid-fire effects
    this._textCollisionCooldown = true;
    this.robot._setTimeout(() => {
      this._textCollisionCooldown = false;
    }, 800);

    // ── 1. Select random text effects (2-3 of 4) ──
    const effects = [
      'collision-shake',
      'collision-glitch',
      'collision-scatter',
      'collision-flash',
    ];
    // Shuffle and pick 2-3
    const shuffled = effects.sort(() => Math.random() - 0.5);
    const count = 2 + Math.floor(Math.random() * 2); // 2 or 3
    const chosen = shuffled.slice(0, count);

    // Apply CSS classes with staggered timing
    chosen.forEach((cls, i) => {
      this.robot._setTimeout(() => {
        typeWriter.classList.add(cls);
      }, i * 50);
    });

    // Remove all after the longest animation finishes
    this.robot._setTimeout(() => {
      effects.forEach((cls) => typeWriter.classList.remove(cls));
    }, 700);

    // ── 2. Calculate impact point ──
    const robotEl = this.robot.dom.svg || this.robot.dom.avatar;
    if (!robotEl) return;
    const rRect = robotEl.getBoundingClientRect();

    // Impact point is where robot and text overlap
    const impactX = Math.max(
      twRect.left,
      Math.min(twRect.right, rRect.left + rRect.width / 2),
    );
    const impactY = Math.max(
      twRect.top,
      Math.min(twRect.bottom, rRect.top + rRect.height / 2),
    );

    // ── 3. Shockwave ring ──
    const shockwave = document.createElement('div');
    shockwave.className = 'collision-shockwave';
    shockwave.style.left = `${impactX}px`;
    shockwave.style.top = `${impactY}px`;
    document.body.appendChild(shockwave);
    this.robot._setTimeout(() => shockwave.remove(), 650);

    // ── 4. Directional sparks ──
    const sparkCount = 6 + Math.floor(Math.random() * 5);
    for (let i = 0; i < sparkCount; i++) {
      const spark = document.createElement('div');
      spark.className = 'collision-spark';
      const angle = (360 / sparkCount) * i + (Math.random() - 0.5) * 30;
      spark.style.setProperty('--spark-angle', `${angle}deg`);
      spark.style.left = `${impactX + (Math.random() - 0.5) * 8}px`;
      spark.style.top = `${impactY + (Math.random() - 0.5) * 8}px`;
      // Vary spark size
      const len = 8 + Math.random() * 10;
      spark.style.height = `${len}px`;
      spark.style.animationDuration = `${0.3 + Math.random() * 0.2}s`;
      document.body.appendChild(spark);
      this.robot._setTimeout(() => spark.remove(), 550);
    }
  }

  /**
   * Check for collision with the typewriter title
   * @param {DOMRect} twRect - Bounding rect of typewriter
   * @returns {boolean} True if collision occurred
   */
  checkForTypewriterCollision(twRect) {
    if (!twRect) return false;

    // ── Immunity check: skip if recently knocked back by text ──
    if (this._textCollisionImmunity) return false;

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

      // ── Activate immunity: no more text collisions for 6 seconds ──
      this._textCollisionImmunity = true;
      this.robot._setTimeout(() => {
        this._textCollisionImmunity = false;
      }, 6000);

      // Collision reaction: show bubble and particle burst
      const reactions = [
        'Autsch! 😵',
        'Ups! Das war hart! 💥',
        'Whoa! 😲',
        'Hey! Nicht schubsen! 😠',
        'Au weia! 💢',
        'Das hätte nicht sein müssen! 😤',
      ];
      const reaction = reactions[Math.floor(Math.random() * reactions.length)];
      this.robot.showBubble(reaction);
      this.robot._setTimeout(() => this.robot.hideBubble(), 2500);
      this.robot.animationModule.spawnParticleBurst(18, {
        strength: 2.5,
        spread: 220,
      });

      // Play text impact effects
      const typeWriter = document.querySelector('.typewriter-title');
      if (typeWriter) {
        this._playTextCollisionEffect(typeWriter, twRect);
      }

      // Always trigger a full knockback that flings the robot far away
      const anim = this.robot.animationModule;
      anim.triggerKnockback();

      return true;
    } catch (err) {
      log.warn('checkForTypewriterCollision failed', err);
      return false;
    }
  }
}
