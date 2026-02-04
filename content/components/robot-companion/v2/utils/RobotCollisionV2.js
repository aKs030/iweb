import { createObserver } from '/content/core/intersection-observer.js';

export class RobotCollisionV2 {
  constructor(api) {
    // api: { avatar, container, showBubble, hideBubble, triggerKnockback }
    this.api = api;
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
    if (this.obstacleObserver) {
      this.obstacleObserver.disconnect();
    }
    this.visibleObstacles.clear();
    this._recentCollisions = new WeakSet();
    this._trackedObstacles = new WeakSet();
  }

  updateObstacleCache() {
    const now = performance.now();
    if (this._lastObstacleUpdate && now - this._lastObstacleUpdate < 2000)
      return;
    this._lastObstacleUpdate = now;

    const currentObstacles = document.querySelectorAll(
      'img, .card, button.btn, h2, .project-card, [data-test="photo-card"]',
    );

    currentObstacles.forEach((el) => {
      if (!this._trackedObstacles.has(el)) {
        this.obstacleObserver.observe(el);
        this._trackedObstacles.add(el);
      }
    });
  }

  scanForCollisions(isChatOpen) {
    if (!this.api.avatar || isChatOpen) return;

    const now = performance.now();
    if (this._lastCollisionCheck && now - this._lastCollisionCheck < 30) return;
    this._lastCollisionCheck = now;

    this.updateObstacleCache();

    const robotRect = this.api.avatar.getBoundingClientRect();

    for (const obs of this.visibleObstacles) {
      if (obs.offsetParent === null) continue;
      if (this.api.container.contains(obs)) continue;

      const obsRect = obs.getBoundingClientRect();
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
        if (this._recentCollisions.has(obs)) continue;
        this.triggerCollisionReaction(obs, obsRect);
        this._recentCollisions.add(obs);
        setTimeout(() => {
          this._recentCollisions.delete(obs);
        }, 500);
        return;
      }
    }
  }

  triggerCollisionReaction(_obs, _obsRect) {
    const texts = ['Huch!', 'Oha!', 'Eng hier!', 'Platz da!'];
    this.api.showBubble(texts[Math.floor(Math.random() * texts.length)]);
    setTimeout(() => this.api.hideBubble(), 1500);

    // Simplification: Trigger generic knockback
    this.api.triggerKnockback();
  }

  checkForTypewriterCollision(twRect) {
    if (!twRect || !this.api.avatar) return false;

    const rRectRaw = this.api.avatar.getBoundingClientRect();
    const shrinkX = 10;
    const shrinkY = 6;
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

    const overlapX =
      Math.min(twRect.right, rRect.right) - Math.max(twRect.left, rRect.left);
    const overlapY =
      Math.min(twRect.bottom, rRect.bottom) - Math.max(twRect.top, rRect.top);

    if (overlapX < 6 || overlapY < 6) return false;

    const reactions = ['Autsch! 😵', 'Ups!', 'Whoa! 😲', 'Hey!'];
    const reaction = reactions[Math.floor(Math.random() * reactions.length)];

    this.api.showBubble(reaction);
    setTimeout(() => this.api.hideBubble(), 2500);
    this.api.triggerKnockback();

    return true;
  }
}
