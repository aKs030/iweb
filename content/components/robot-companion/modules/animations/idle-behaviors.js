/**
 * @typedef {import('../robot-animation.js').RobotAnimation} RobotAnimation
 */

const IDLE_AVATAR_CLASSES = [
  'waving',
  'check-watch',
  'head-tilt',
  'yawning',
  'air-drumming',
  'stretching',
  'dozing',
  'looking-around',
  'wiggle-dance',
];

/**
 * @param {RobotAnimation} animation
 */
export function triggerRandomIdleAnimation(animation) {
  if (!animation.robot.dom.avatar) {
    return;
  }

  const r = Math.random();
  if (r < 0.1) {
    animation.robot.dom.avatar.classList.add('waving');
  } else if (r < 0.2) {
    animation.robot.dom.avatar.classList.add('check-watch');
    if (animation.robot.dom.eyes) {
      animation.robot.dom.eyes.style.transform = 'translate(-2px, 4px)';
    }
  } else if (r < 0.28) {
    animation.robot.dom.avatar.classList.add('head-tilt');
  } else if (r < 0.36) {
    animation.robot.dom.avatar.classList.add('yawning');
    if (animation.robot.dom.mouth) {
      animation.robot.dom.mouth.classList.add('surprised');
      animation.robot._setTimeout(() => {
        animation.robot.dom.mouth?.classList.remove('surprised');
      }, 2000);
    }
  } else if (r < 0.44) {
    animation.robot.dom.avatar.classList.add('air-drumming');
  } else if (r < 0.52) {
    animation.robot.dom.avatar.classList.add('stretching');
  } else if (r < 0.6) {
    animation.robot.dom.avatar.classList.add('dozing');
    animation.robot._setTimeout(() => {
      if (!animation.robot.dom.container) {
        return;
      }
      const rect = animation.robot.dom.container.getBoundingClientRect();
      const zzz = document.createElement('div');
      zzz.textContent = '💤';
      zzz.style.cssText = `position:fixed;left:${rect.left + rect.width / 2}px;top:${rect.top - 10}px;font-size:16px;pointer-events:none;z-index:9999;animation:particleHeart 1.5s ease-out forwards;`;
      document.body.appendChild(zzz);
      animation.robot._setTimeout(() => zzz.remove(), 1500);
    }, 800);
  } else if (r < 0.72) {
    animation.robot.dom.avatar.classList.add('looking-around');
    if (animation.robot.dom.eyes) {
      animation.robot.dom.eyes.style.transition = 'transform 0.3s ease';
      animation.robot._setTimeout(() => {
        if (animation.robot.dom.eyes) {
          animation.robot.dom.eyes.style.transform = 'translate(-3px, 0)';
        }
      }, 400);
      animation.robot._setTimeout(() => {
        if (animation.robot.dom.eyes) {
          animation.robot.dom.eyes.style.transform = 'translate(3px, 0)';
        }
      }, 1500);
      animation.robot._setTimeout(() => {
        if (animation.robot.dom.eyes) {
          animation.robot.dom.eyes.style.transform = '';
          animation.robot.dom.eyes.style.transition = '';
        }
      }, 2800);
    }
  } else if (r < 0.84) {
    animation.robot.dom.avatar.classList.add('wiggle-dance');
    if (animation.robot.dom.mouth) {
      animation.robot.dom.mouth.classList.add('happy');
      animation.robot._setTimeout(() => {
        animation.robot.dom.mouth?.classList.remove('happy');
      }, 1500);
    }
  } else if (animation.robot.dom.eyes) {
    animation.robot.dom.eyes.style.transform = `translate(${
      Math.random() * 4 - 2
    }px, ${Math.random() * 2 - 1}px)`;
  }
}

/**
 * @param {RobotAnimation} animation
 */
export function resetIdleAnimations(animation) {
  if (animation.robot.dom.avatar) {
    animation.robot.dom.avatar.classList.remove(...IDLE_AVATAR_CLASSES);
  }
  if (animation.robot.dom.mouth) {
    animation.robot.dom.mouth.classList.remove('surprised', 'happy');
  }
}

/**
 * @param {RobotAnimation} animation
 */
export function startIdleEyeMovement(animation) {
  stopIdleEyeMovement(animation);
  const cfg = animation.eyeIdleConfig;
  const scheduleNext = () => {
    const delay =
      cfg.intervalMin + Math.random() * (cfg.intervalMax - cfg.intervalMin);
    animation._eyeIdleTimer = animation.robot._setTimeout(() => {
      animation.eyeIdleOffset.x = (Math.random() * 2 - 1) * cfg.amplitudeX;
      animation.eyeIdleOffset.y = (Math.random() * 2 - 1) * cfg.amplitudeY;
      updateEyesTransform(animation);
      const timerId = animation.robot._setTimeout(() => {
        animation.eyeIdleOffset.x = 0;
        animation.eyeIdleOffset.y = 0;
        updateEyesTransform(animation);
        scheduleNext();
      }, cfg.moveDuration);
      animation._eyeIdleTimer = timerId || animation._eyeIdleTimer;
    }, delay);
  };
  scheduleNext();
}

/**
 * @param {RobotAnimation} animation
 */
export function stopIdleEyeMovement(animation) {
  if (animation._eyeIdleTimer) {
    animation.robot._clearTimeout(animation._eyeIdleTimer);
    animation._eyeIdleTimer = null;
  }
  animation.eyeIdleOffset.x = 0;
  animation.eyeIdleOffset.y = 0;
  updateEyesTransform(animation);
}

/**
 * @param {RobotAnimation} animation
 */
export function updateEyesTransform(animation) {
  if (!animation.robot.dom?.eyes) {
    return;
  }

  const eyeOffset = animation.patrol.direction > 0 ? -3 : 3;
  const eyeIntensity =
    animation.startAnimation.active || animation.patrol.isPaused
      ? 1.4
      : animation.motion.dashUntil > performance.now()
        ? 1.2
        : 1;

  const totalX = eyeOffset * eyeIntensity + (animation.eyeIdleOffset.x || 0);
  const totalY = animation.eyeIdleOffset.y || 0;
  animation.robot.dom.eyes.style.transform = `translate(${totalX}px, ${totalY}px)`;
  animation.robot.dom.eyes.style.transition = 'transform 0.6s ease';
}

/**
 * @param {RobotAnimation} animation
 */
export function startBlinkLoop(animation) {
  stopBlinkLoop(animation);
  const schedule = () => {
    const delay =
      animation.blinkConfig.intervalMin +
      Math.random() *
        (animation.blinkConfig.intervalMax - animation.blinkConfig.intervalMin);
    animation._blinkTimer = animation.robot._setTimeout(() => {
      doBlink(animation);
      schedule();
    }, delay);
  };
  schedule();
}

/**
 * @param {RobotAnimation} animation
 */
export function stopBlinkLoop(animation) {
  if (animation._blinkTimer) {
    animation.robot._clearTimeout(animation._blinkTimer);
    animation._blinkTimer = null;
  }
}

/**
 * @param {RobotAnimation} animation
 */
export function doBlink(animation) {
  if (!animation.robot.dom?.eyes) {
    return;
  }

  const lids = animation.robot.dom.lids;
  if (!lids.length) {
    return;
  }

  lids.forEach((lid) => lid.classList.add('is-blink'));
  animation.robot._setTimeout(
    () => {
      lids.forEach((lid) => lid.classList.remove('is-blink'));
    },
    (animation.blinkConfig.duration || 120) + 20,
  );
}
