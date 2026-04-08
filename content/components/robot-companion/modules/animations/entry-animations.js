/**
 * @typedef {import('../robot-animation.js').RobotAnimation} RobotAnimation
 */

/**
 * @param {readonly string[]} items
 * @returns {string}
 */
function randomPick(items) {
  return items[Math.floor(Math.random() * items.length)] || '';
}

/**
 * @param {RobotAnimation} animation
 */
function requestStartAnimationFrame(animation) {
  animation.robot._requestAnimationFrame(animation.updateStartAnimation);
}

/**
 * @param {RobotAnimation} animation
 * @param {string} key
 */
function beginTimedEntryVariant(animation, key) {
  const variant = ENTRY_VARIANTS[key];
  if (!variant || !animation.robot.dom.container) {
    return;
  }

  animation.startAnimation.active = true;
  animation.startAnimation.phase = key;
  animation.startAnimation.variantKey = key;
  animation.startAnimation.startTime = performance.now();
  animation.startAnimation.duration = variant.duration;

  variant.setup(animation);

  animation.robot.dom.container.style.opacity = '1';
  requestStartAnimationFrame(animation);
}

/**
 * @param {RobotAnimation} animation
 * @param {readonly string[]} messages
 * @param {(() => void) | undefined} onComplete
 */
function completeTimedEntryVariant(animation, messages, onComplete) {
  onComplete?.();
  animation._transitionToTextKnockback(randomPick(messages));
}

/**
 * @param {Element} typeWriter
 * @returns {number}
 */
export function resolveTypewriterApproachTargetX(typeWriter) {
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

  return Math.max(20, Math.round(initialLeft - targetLeft));
}

const ENTRY_VARIANTS = {
  entryDropIn: {
    duration: 900,
    messages: [
      'Gelandet! 🛬',
      'Touchdown! 🪂',
      'Hallo von oben! 🌤️',
      'Anflug beendet! ✈️',
    ],
    /**
     * @param {RobotAnimation} animation
     */
    setup(animation) {
      const startY = -(globalThis.innerHeight || 800);
      animation.patrol.x = 0;
      animation.patrol.y = startY;
      animation.patrol.direction = -1;
      animation.patrol.bouncePhase = 0;
      animation.startAnimation.knockbackStartY = startY;

      animation.robot.dom.container.style.transform = `translate3d(0px, ${startY}px, 0)`;
      if (animation.robot.dom.floatWrapper) {
        animation.robot.dom.floatWrapper.style.transform = 'rotate(0deg)';
      }
    },
    /**
     * @param {RobotAnimation} animation
     * @param {{ t: number }} frameState
     */
    frame(animation, { t }) {
      let eased;
      if (t < 0.6) {
        const ft = t / 0.6;
        eased = ft * ft;
      } else {
        const bt = (t - 0.6) / 0.4;
        eased = 1 - Math.abs(Math.sin(bt * Math.PI * 2)) * (1 - bt) * 0.25;
      }

      const startY = animation.startAnimation.knockbackStartY;
      animation.patrol.y = startY * (1 - eased);

      const tilt = t < 0.6 ? -12 * (t / 0.6) : -12 + 12 * ((t - 0.6) / 0.4);
      if (animation.robot.dom.svg) {
        animation.robot.dom.svg.style.transform = `rotate(${tilt}deg)`;
      }

      if (animation.robot.dom.flame) {
        animation.robot.dom.flame.style.opacity = `${t < 0.6 ? 0.3 + t : 1 - (t - 0.6) / 0.4}`;
      }

      animation.setAvatarState({ moving: true, dashing: t < 0.6 });
      animation.robot.dom.container.style.transform = `translate3d(0px, ${animation.patrol.y}px, 0)`;
    },
    /**
     * @param {RobotAnimation} animation
     */
    complete(animation) {
      animation.spawnParticleBurst(10, { strength: 1.5, spread: 180 });
    },
  },
  entryZoomSpin: {
    duration: 1000,
    messages: [
      'Tada! ✨',
      'Und da bin ich! 🌀',
      'Einmal Drehung bitte! 🎪',
      'Materialisation abgeschlossen! 🔮',
    ],
    /**
     * @param {RobotAnimation} animation
     */
    setup(animation) {
      animation.patrol.x = 0;
      animation.patrol.y = 0;

      if (animation.robot.dom.floatWrapper) {
        animation.robot.dom.floatWrapper.style.transform =
          'scale(0.05) rotate(0deg)';
        animation.robot.dom.floatWrapper.style.opacity = '0';
      }
      animation.robot.dom.container.style.transform =
        'translate3d(0px, 0px, 0)';
    },
    /**
     * @param {RobotAnimation} animation
     * @param {{ t: number }} frameState
     */
    frame(animation, { t }) {
      const eased = 1 - Math.pow(1 - t, 3);
      const scale = 0.05 + 0.95 * eased;
      const rotation = (1 - eased) * 720;
      const opacity = Math.min(1, eased * 2);

      if (animation.robot.dom.floatWrapper) {
        animation.robot.dom.floatWrapper.style.transform = `scale(${scale}) rotate(${rotation}deg)`;
        animation.robot.dom.floatWrapper.style.opacity = `${opacity}`;
      }
    },
    /**
     * @param {RobotAnimation} animation
     */
    complete(animation) {
      animation.spawnParticleBurst(8, { strength: 1.2, spread: 360 });
    },
  },
  entrySlideIn: {
    duration: 1200,
    messages: [
      'Da bin ich! 👋',
      'Psst… Hey! 🤫',
      'Alles klar hier? 😊',
      'Bin eingetroffen! 🚀',
    ],
    /**
     * @param {RobotAnimation} animation
     */
    setup(animation) {
      animation.patrol.x = -300;
      animation.patrol.y = 0;
      animation.patrol.direction = 1;
      animation.patrol.bouncePhase = 0;
      animation.startAnimation.startX = -300;

      animation.robot.dom.container.style.transform =
        'translate3d(300px, 0px, 0)';
      if (animation.robot.dom.floatWrapper) {
        animation.robot.dom.floatWrapper.style.transform = 'rotate(-15deg)';
      }
    },
    /**
     * @param {RobotAnimation} animation
     * @param {{ t: number }} frameState
     */
    frame(animation, { t }) {
      const eased =
        t === 1 ? 1 : 1 - Math.pow(2, -10 * t) * Math.cos(t * Math.PI * 3);

      animation.patrol.x = animation.startAnimation.startX * (1 - eased);
      animation.patrol.bouncePhase += 0.08;
      animation.patrol.y = Math.sin(animation.patrol.bouncePhase) * 4;

      const tilt = -15 * (1 - eased);
      if (animation.robot.dom.floatWrapper) {
        animation.robot.dom.floatWrapper.style.transform = `rotate(${tilt}deg)`;
      }

      animation.setAvatarState({ moving: true, dashing: t < 0.5 });
      if (animation.robot.dom.flame) {
        animation.robot.dom.flame.style.opacity = `${1 - eased}`;
      }

      animation.robot.dom.container.style.transform = `translate3d(${-animation.patrol.x}px, ${animation.patrol.y}px, 0)`;
    },
    /**
     * @param {RobotAnimation} animation
     */
    complete(animation) {
      animation.spawnParticleBurst(6, { strength: 1, direction: 1 });
    },
  },
  entryGlitchIn: {
    duration: 1400,
    messages: [
      '*bzzt* Online! ⚡',
      'System bereit! 🔌',
      'Verbindung hergestellt! 📡',
      'Initialisierung… fertig! 🤖',
    ],
    /**
     * @param {RobotAnimation} animation
     */
    setup(animation) {
      animation.patrol.x = 0;
      animation.patrol.y = 0;
      animation.robot.dom.container.style.transform =
        'translate3d(0px, 0px, 0)';
      if (animation.robot.dom.floatWrapper) {
        animation.robot.dom.floatWrapper.style.opacity = '0';
      }
    },
    /**
     * @param {RobotAnimation} animation
     * @param {{ t: number }} frameState
     */
    frame(animation, { t }) {
      const flickerRate = t < 0.6 ? 0.45 : 0.85;
      const isVisible = Math.random() < flickerRate;

      if (animation.robot.dom.floatWrapper) {
        animation.robot.dom.floatWrapper.style.opacity = isVisible ? '1' : '0';

        if (t < 0.6 && isVisible) {
          const jX = (Math.random() - 0.5) * 50;
          const jY = (Math.random() - 0.5) * 50;
          animation.robot.dom.floatWrapper.style.transform = `translate(${jX}px, ${jY}px)`;
        } else if (t >= 0.6) {
          const settle = (t - 0.6) / 0.4;
          const jScale = (1 - settle) * 12;
          const jX = (Math.random() - 0.5) * jScale;
          const jY = (Math.random() - 0.5) * jScale;
          animation.robot.dom.floatWrapper.style.transform = `translate(${jX}px, ${jY}px)`;
        }
      }

      if (Math.random() < 0.12) {
        animation.spawnParticleBurst(2, { strength: 0.8, spread: 360 });
      }
    },
    /**
     * @param {RobotAnimation} animation
     */
    complete(animation) {
      animation.spawnParticleBurst(12, { strength: 1.5, spread: 360 });
    },
  },
  entryBounceAcross: {
    duration: 2000,
    messages: [
      'Boing! Boing! 🏀',
      'Was für ein Eingang! 🤸',
      'Hoppla, gute Landung! 🎯',
      'Boing! Hier bin ich! 🤖',
    ],
    /**
     * @param {RobotAnimation} animation
     */
    setup(animation) {
      const windowWidth = globalThis.innerWidth || 800;
      animation.patrol.x = -(windowWidth * 0.3);
      animation.patrol.y = 0;
      animation.patrol.direction = 1;
      animation.patrol.bouncePhase = 0;
      animation.startAnimation.startX = animation.patrol.x;

      animation.robot.dom.container.style.transform = `translate3d(${-animation.patrol.x}px, 0px, 0)`;
      if (animation.robot.dom.floatWrapper) {
        animation.robot.dom.floatWrapper.style.transform = 'rotate(0deg)';
      }
    },
    /**
     * @param {RobotAnimation} animation
     * @param {{ t: number }} frameState
     */
    frame(animation, { t }) {
      const easeX = 1 - Math.pow(1 - t, 2);
      const totalDist = Math.abs(animation.startAnimation.startX);
      animation.patrol.x = animation.startAnimation.startX + totalDist * easeX;

      const bounceFreq = 4;
      const bounceHeight = 120 * (1 - t);
      const bounceVal = Math.abs(Math.sin(t * Math.PI * bounceFreq));
      animation.patrol.y = -bounceVal * bounceHeight;

      const nearFloor = bounceVal < 0.15;
      if (animation.robot.dom.floatWrapper) {
        if (nearFloor && t < 0.9) {
          animation.robot.dom.floatWrapper.style.transform =
            'scaleX(1.15) scaleY(0.85)';
          if (
            !animation._lastBounceT ||
            Math.abs(t - animation._lastBounceT) > 0.08
          ) {
            animation.spawnParticleBurst(3, { strength: 0.6, spread: 120 });
            animation._lastBounceT = t;
          }
        } else {
          const rot = Math.sin(t * Math.PI * bounceFreq * 2) * 15 * (1 - t);
          animation.robot.dom.floatWrapper.style.transform = `scaleX(1) scaleY(1) rotate(${rot}deg)`;
        }
      }

      animation.setAvatarState({ moving: true, dashing: t < 0.3 });
      if (animation.robot.dom.flame) {
        animation.robot.dom.flame.style.opacity = `${0.4 + bounceVal * 0.5}`;
      }

      animation.robot.dom.container.style.transform = `translate3d(${-animation.patrol.x}px, ${animation.patrol.y}px, 0)`;
    },
    /**
     * @param {RobotAnimation} animation
     */
    complete(animation) {
      animation._lastBounceT = null;
      animation.spawnParticleBurst(8, { strength: 1.2, spread: 180 });
    },
  },
  entryPortalOpen: {
    duration: 1600,
    messages: [
      'Portal-Transfer komplett! 🌀',
      'Dimensionssprung! ✨',
      'Teleportation erfolgreich! 🔮',
      'Aus einer anderen Welt! 🌌',
    ],
    /**
     * @param {RobotAnimation} animation
     */
    setup(animation) {
      animation.patrol.x = 0;
      animation.patrol.y = 0;
      animation.robot.dom.container.style.transform =
        'translate3d(0px, 0px, 0)';
      if (animation.robot.dom.floatWrapper) {
        animation.robot.dom.floatWrapper.style.transform =
          'scale(0) rotate(0deg)';
        animation.robot.dom.floatWrapper.style.opacity = '0';
      }
      if (animation.robot.dom.avatar) {
        animation.robot.dom.avatar.classList.add('portal-glow');
      }
    },
    /**
     * @param {RobotAnimation} animation
     * @param {{ t: number }} frameState
     */
    frame(animation, { t }) {
      if (t < 0.5) {
        if (Math.random() < 0.15) {
          animation.spawnParticleBurst(2, { strength: 1, spread: 360 });
        }
        if (animation.robot.dom.floatWrapper) {
          const pulse = 0.02 + Math.sin(t * Math.PI * 6) * 0.03;
          animation.robot.dom.floatWrapper.style.transform = `scale(${pulse})`;
          animation.robot.dom.floatWrapper.style.opacity = '0';
        }
        return;
      }

      const pt = (t - 0.5) / 0.5;
      const elasticEase =
        pt === 1 ? 1 : 1 - Math.pow(2, -10 * pt) * Math.cos(pt * Math.PI * 3);
      const scale = Math.max(0, elasticEase);
      const rotation = (1 - pt) * 360;

      if (animation.robot.dom.floatWrapper) {
        animation.robot.dom.floatWrapper.style.transform = `scale(${scale}) rotate(${rotation}deg)`;
        animation.robot.dom.floatWrapper.style.opacity = `${Math.min(1, pt * 2.5)}`;
      }

      if (pt > 0.6 && animation.robot.dom.avatar) {
        animation.robot.dom.avatar.classList.remove('portal-glow');
      }
    },
    /**
     * @param {RobotAnimation} animation
     */
    complete(animation) {
      if (animation.robot.dom.avatar) {
        animation.robot.dom.avatar.classList.remove('portal-glow');
      }
      animation.spawnParticleBurst(15, { strength: 1.8, spread: 360 });
    },
  },
  entryRocketLaunch: {
    duration: 1200,
    messages: [
      'Houston, wir sind da! 🚀',
      '3… 2… 1… Hallo! 🛸',
      'Raketenstart geglückt! 🌟',
      'Abheben und landen! 💫',
    ],
    /**
     * @param {RobotAnimation} animation
     */
    setup(animation) {
      const startY = 300;
      animation.patrol.x = 0;
      animation.patrol.y = startY;
      animation.patrol.bouncePhase = 0;
      animation.startAnimation.knockbackStartY = startY;

      if (animation.robot.dom.avatar) {
        animation.robot.dom.avatar.classList.add('rocket-trail');
      }
      animation.robot.dom.container.style.transform = `translate3d(0px, ${startY}px, 0)`;
      if (animation.robot.dom.floatWrapper) {
        animation.robot.dom.floatWrapper.style.transform = 'rotate(0deg)';
      }
    },
    /**
     * @param {RobotAnimation} animation
     * @param {{ t: number }} frameState
     */
    frame(animation, { t }) {
      const startY = animation.startAnimation.knockbackStartY;

      if (t < 0.6) {
        const ft = t / 0.6;
        const eased = 1 - Math.pow(1 - ft, 3);
        animation.patrol.y = startY * (1 - eased);

        const wobble = Math.sin(ft * Math.PI * 8) * (3 * (1 - ft));
        if (animation.robot.dom.floatWrapper) {
          animation.robot.dom.floatWrapper.style.transform = `rotate(${wobble}deg)`;
        }

        if (animation.robot.dom.flame) {
          animation.robot.dom.flame.style.opacity = '1';
          animation.robot.dom.flame.style.transform = `scale(${1.2 + (1 - ft) * 0.5})`;
        }

        if (Math.random() < 0.3) {
          animation.spawnParticleBurst(2, {
            strength: 0.8,
            direction: 0,
            spread: 30,
          });
        }

        animation.setAvatarState({ moving: true, dashing: true });
      } else {
        const st = (t - 0.6) / 0.4;
        const overshoot = -40 * Math.sin(st * Math.PI) * (1 - st);
        animation.patrol.y = overshoot;

        if (animation.robot.dom.floatWrapper) {
          const settleRot = Math.sin(st * Math.PI * 2) * 8 * (1 - st);
          animation.robot.dom.floatWrapper.style.transform = `rotate(${settleRot}deg)`;
        }

        if (animation.robot.dom.flame) {
          animation.robot.dom.flame.style.opacity = `${0.8 * (1 - st)}`;
          animation.robot.dom.flame.style.transform = 'scale(1)';
        }

        animation.setAvatarState({ moving: true, dashing: false });
      }

      animation.robot.dom.container.style.transform = `translate3d(0px, ${animation.patrol.y}px, 0)`;
    },
    /**
     * @param {RobotAnimation} animation
     */
    complete(animation) {
      if (animation.robot.dom.avatar) {
        animation.robot.dom.avatar.classList.remove('rocket-trail');
      }
      animation.spawnParticleBurst(10, { strength: 1.5, spread: 360 });
    },
  },
};

const RANDOM_ENTRY_VARIANT_KEYS = ['knockback', ...Object.keys(ENTRY_VARIANTS)];

/**
 * @param {RobotAnimation} animation
 */
export function startRandomEntryAnimation(animation) {
  if (animation.startAnimation.active) {
    return;
  }

  const typeWriter = document.querySelector('.typewriter-title');
  if (!typeWriter || !animation.robot.dom.container) {
    if (animation.robot.dom.container) {
      animation.robot.dom.container.style.opacity = '1';
    }
    animation.startPatrol();
    return;
  }

  const variantKey =
    RANDOM_ENTRY_VARIANT_KEYS[
      Math.floor(Math.random() * RANDOM_ENTRY_VARIANT_KEYS.length)
    ];

  if (variantKey === 'knockback') {
    const targetX = resolveTypewriterApproachTargetX(typeWriter);
    animation.startAnimation.active = true;
    animation.startAnimation.phase = 'naturalApproach';
    animation.startAnimation.variantKey = '';
    animation.patrol.x = Math.max(0, targetX - 200);
    animation.patrol.y = 0;
    animation.patrol.bouncePhase = 0;

    animation.robot.dom.container.style.transform = `translate3d(${-animation.patrol.x}px, 0px, 0)`;
    if (animation.robot.dom.floatWrapper) {
      animation.robot.dom.floatWrapper.style.transform = 'rotate(0deg)';
    }
    animation.robot.dom.container.style.opacity = '1';
    animation._startNaturalApproach(targetX);
    return;
  }

  beginTimedEntryVariant(animation, variantKey);
}

/**
 * @param {RobotAnimation} animation
 * @param {number} now
 * @returns {boolean}
 */
export function updateEntryVariant(animation, now) {
  const variantKey =
    animation.startAnimation.variantKey || animation.startAnimation.phase;
  const variant = ENTRY_VARIANTS[variantKey];
  if (!variant) {
    return false;
  }

  const elapsed = now - animation.startAnimation.startTime;
  const duration = animation.startAnimation.duration || variant.duration;
  const t = Math.min(1, elapsed / duration);

  variant.frame(animation, { t });

  if (t >= 1) {
    completeTimedEntryVariant(animation, variant.messages, () =>
      variant.complete?.(animation),
    );
    return true;
  }

  requestStartAnimationFrame(animation);
  return true;
}
