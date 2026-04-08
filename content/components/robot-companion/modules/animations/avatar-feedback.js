/**
 * @typedef {import('../robot-animation.js').RobotAnimation} RobotAnimation
 */

function setAntennaGlow(animation, colorToken = '') {
  const antenna = animation.robot.dom?.antenna;
  if (!antenna) return;

  if (!colorToken) {
    antenna.style.fill = '';
    antenna.style.filter = '';
    return;
  }

  antenna.style.fill = `var(${colorToken})`;
  antenna.style.filter = `drop-shadow(0 0 8px var(${colorToken}))`;
}

function setAvatarTransform(animation, transform = '', transition = '') {
  const avatar = animation.robot.dom?.avatar;
  if (!avatar) return;

  avatar.style.transition = transition;
  avatar.style.transform = transform;
}

/**
 * @param {RobotAnimation} animation
 */
export function ensureFlameColors(animation) {
  if (animation._flameInitDone) return;
  animation._flameInitDone = true;

  if (!animation.robot.dom?.flame) return;
  animation.robot.dom.flame.style.opacity = '0';
  animation.robot.dom.flame.style.transform = 'scale(1)';
}

/**
 * @param {RobotAnimation} animation
 */
export function startSpeaking(animation) {
  if (animation.speakingActive) return;
  animation.speakingActive = true;
  animation.startSpeakingLoop();
}

/**
 * @param {RobotAnimation} animation
 */
export function stopSpeaking(animation) {
  if (!animation.speakingActive) return;

  animation.speakingActive = false;
  if (animation._speakingTimer) {
    animation.robot._clearTimeout(animation._speakingTimer);
    animation._speakingTimer = null;
  }

  setAntennaGlow(animation);
}

/**
 * @param {RobotAnimation} animation
 */
export function startSpeakingLoop(animation) {
  if (!animation.speakingActive) return;

  const duration = 100 + Math.random() * 150;
  const isLit = Math.random() > 0.3;

  setAntennaGlow(animation, isLit ? '--robot-svg-antenna-speaking' : '');

  if (!animation.speakingActive) return;

  animation._speakingTimer = animation.robot._setTimeout(
    () => animation.startSpeakingLoop(),
    duration + 50,
  );
}

/**
 * @param {RobotAnimation} animation
 */
export function startThinking(animation) {
  if (animation.thinkingActive) return;
  animation.thinkingActive = true;

  animation.robot.dom?.antenna?.classList.add('is-thinking');

  if (animation.robot.dom?.eyes) {
    animation.stopIdleEyeMovement();
    animation.robot.dom.eyes.classList.add('is-thinking');
  }
}

/**
 * @param {RobotAnimation} animation
 */
export function stopThinking(animation) {
  if (!animation.thinkingActive) return;
  animation.thinkingActive = false;

  animation.robot.dom?.antenna?.classList.remove('is-thinking');

  if (animation.robot.dom?.eyes) {
    animation.robot.dom.eyes.classList.remove('is-thinking');
    animation.startIdleEyeMovement();
  }
}

/**
 * @param {RobotAnimation} animation
 * @param {number} [count]
 * @param {{direction?: number, strength?: number, spread?: number | null}} [options]
 */
export function spawnParticleBurst(
  animation,
  count = 6,
  { direction = 0, strength = 1, spread = null } = {},
) {
  if (!animation.robot.dom?.container || !animation.robot.dom?.avatar) return;

  const rect = animation.robot.dom.avatar.getBoundingClientRect();
  const baseX = rect.left + rect.width / 2;
  const baseY = rect.top + rect.height * 0.75;
  const cRect = animation.robot.dom.container.getBoundingClientRect();

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

    animation.robot.dom.container.appendChild(el);

    let angle;
    if (spread !== null) {
      const spreadRad = (spread * Math.PI) / 180;
      angle = -Math.PI / 2 + (Math.random() - 0.5) * spreadRad;
    } else {
      const baseAngle =
        direction === 0
          ? -Math.PI / 2
          : direction > 0
            ? -Math.PI / 4
            : (-3 * Math.PI) / 4;
      angle = baseAngle + (Math.random() - 0.5) * (Math.PI / 3);
    }

    const distance = 40 + Math.random() * 30;
    const dx = Math.cos(angle) * distance * strength;
    const dy = Math.sin(angle) * distance * strength - 10 * strength;

    el.style.left = `${baseX - cRect.left - size / 2}px`;
    el.style.top = `${baseY - cRect.top - size / 2}px`;

    animation.robot._requestAnimationFrame(() => {
      el.style.transform = `translate(${dx}px, ${dy}px) scale(${
        0.5 + Math.random() * 0.6
      })`;
      el.style.opacity = '0';
      if (Math.random() < 0.15) {
        el.style.filter = 'blur(1px)';
      }
    });

    animation.robot._setTimeout(() => el.remove(), 900 + Math.random() * 600);
  }
}

/**
 * @param {RobotAnimation} animation
 */
export function spawnFlameParticle(animation) {
  if (!animation.robot.dom?.container || !animation.robot.dom?.avatar) return;

  const el = document.createElement('div');
  el.style.cssText = `
        position: absolute;
        width: 4px; height: 4px;
        background: var(--robot-flame-particle-color);
        border-radius: 50%;
        pointer-events: none;
        opacity: 0.7;
        mix-blend-mode: screen;
        transition: transform 0.6s ease-out, opacity 0.6s ease-out;
        will-change: transform, opacity;
    `;

  const rect = animation.robot.dom.avatar.getBoundingClientRect();
  const cRect = animation.robot.dom.container.getBoundingClientRect();
  const startX = rect.left + rect.width / 2 - cRect.left;
  const startY = rect.top + rect.height - 15 - cRect.top;

  el.style.left = `${startX - 2}px`;
  el.style.top = `${startY}px`;

  animation.robot.dom.container.appendChild(el);

  animation.robot._requestAnimationFrame(() => {
    const dx = (Math.random() - 0.5) * 10;
    const dy = 15 + Math.random() * 15;
    el.style.transform = `translate(${dx}px, ${dy}px) scale(0)`;
    el.style.opacity = '0';
  });

  animation.robot._setTimeout(() => el.remove(), 600);
}

/**
 * @param {RobotAnimation} animation
 */
export async function playPokeAnimation(animation) {
  if (!animation.robot.dom?.avatar) return;

  const effects = ['jump', 'shake', 'flash'];
  const effect = effects[Math.floor(Math.random() * effects.length)];

  if (effect === 'jump') {
    setAvatarTransform(
      animation,
      'translateY(-20px) scale(1.1)',
      'transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
    );
    await animation._wait(200);
    setAvatarTransform(animation);
    await animation._wait(200);
    return;
  }

  if (effect === 'shake') {
    animation.robot.dom.avatar.animate(
      [
        { transform: 'translateX(0)' },
        { transform: 'translateX(-5px) rotate(-5deg)' },
        { transform: 'translateX(5px) rotate(5deg)' },
        { transform: 'translateX(-5px) rotate(-5deg)' },
        { transform: 'translateX(0)' },
      ],
      { duration: 300 },
    );
    await animation._wait(350);
    return;
  }

  if (animation.robot.dom.svg) {
    animation.robot.dom.svg.style.filter =
      'brightness(2) drop-shadow(0 0 10px var(--robot-svg-flash-glow))';
  }
  await animation._wait(150);
  if (animation.robot.dom.svg) {
    animation.robot.dom.svg.style.filter = '';
  }
  await animation._wait(100);
}

/**
 * @param {RobotAnimation} animation
 */
export function destroyFeedbackAnimations(animation) {
  animation.speakingActive = false;
  animation.thinkingActive = false;

  if (animation._speakingTimer) {
    animation.robot._clearTimeout(animation._speakingTimer);
    animation._speakingTimer = null;
  }

  setAntennaGlow(animation);
  animation.robot.dom?.antenna?.classList.remove('is-thinking');
  animation.robot.dom?.eyes?.classList.remove('is-thinking');
}
