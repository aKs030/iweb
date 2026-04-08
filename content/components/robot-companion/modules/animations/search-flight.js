/**
 * @typedef {import('../robot-animation.js').RobotAnimation} RobotAnimation
 */

const SEARCH_BAR_SELECTOR =
  '.site-header.search-mode .menu-search__bar, .menu-search[aria-hidden="false"] .menu-search__bar';
const SEARCH_FLIGHT_DURATION = 2000;
const SEARCH_BASE_RIGHT = 30;
const SEARCH_BASE_BOTTOM = 30;
const ROBOT_SIZE = 80;
const MIN_EDGE_OFFSET = 12;

/**
 * @param {RobotAnimation} animation
 */
function resetSearchVisuals(animation) {
  if (animation.robot.dom.container) {
    animation.robot.dom.container.style.zIndex = '';
  }
  if (animation.robot.dom.flame) {
    animation.robot.dom.flame.style.opacity = '0';
  }
  if (animation.robot.dom.svg) {
    animation.robot.dom.svg.style.transform = 'rotate(0deg)';
  }
}

/**
 * @param {RobotAnimation} animation
 * @param {boolean} isVisible
 */
export function setMagnifyingGlassVisible(animation, isVisible) {
  if (!animation.robot.dom.magnifyingGlass) {
    return;
  }

  animation.robot.dom.magnifyingGlass.style.opacity = isVisible ? '1' : '0';
  if (!isVisible) {
    animation.robot.dom.magnifyingGlass.setAttribute(
      'transform',
      animation.defaultMagnifyingGlassTransform,
    );
  }
}

/**
 * @returns {Element | null}
 */
function getSearchTargetElement() {
  const targetEl = document.querySelector(SEARCH_BAR_SELECTOR);
  if (!targetEl || targetEl.getClientRects().length === 0) {
    return null;
  }
  return targetEl;
}

/**
 * @param {DOMRect} targetRect
 */
function resolveSearchFlightTarget(targetRect) {
  const windowWidth =
    typeof globalThis !== 'undefined' ? globalThis.innerWidth : 0;
  const windowHeight =
    typeof globalThis !== 'undefined' ? globalThis.innerHeight : 0;

  const targetLeft = Math.min(
    targetRect.right - ROBOT_SIZE * 0.55,
    windowWidth - ROBOT_SIZE - MIN_EDGE_OFFSET,
  );
  const clampedTargetLeft = Math.max(MIN_EDGE_OFFSET, targetLeft);

  const targetTop = Math.max(
    10,
    Math.max(
      MIN_EDGE_OFFSET,
      Math.min(
        targetRect.bottom + MIN_EDGE_OFFSET,
        windowHeight - ROBOT_SIZE - MIN_EDGE_OFFSET,
      ),
    ),
  );

  const targetRightCSS = windowWidth - (clampedTargetLeft + ROBOT_SIZE);
  const targetBottomCSS = windowHeight - (targetTop + ROBOT_SIZE);

  return {
    targetX: targetRightCSS - SEARCH_BASE_RIGHT,
    targetY: -(targetBottomCSS - SEARCH_BASE_BOTTOM),
  };
}

/**
 * @param {RobotAnimation} animation
 */
function finishSearchReturn(animation) {
  animation.searchAnimation.active = false;
  animation.searchAnimation.phase = 'idle';
  animation.searchAnimation.hoverPhase = 0;
  resetSearchVisuals(animation);
  setMagnifyingGlassVisible(animation, false);
  animation.startPatrol();
}

/**
 * @param {RobotAnimation} animation
 */
function updateRobotTransform(animation) {
  if (!animation.robot.dom.container) {
    return;
  }

  animation.robot.dom.container.style.transform = `translate3d(${-animation.patrol.x}px, ${animation.patrol.y}px, 0)`;
  if (animation.robot.dom.floatWrapper) {
    animation.robot.dom.floatWrapper.style.transform = 'rotate(0deg)';
  }
  if (animation.robot.dom.eyes && animation.searchAnimation.phase !== 'hover') {
    animation.robot.dom.eyes.style.transform = 'translate(-3px, -1px)';
  }
}

/**
 * @param {RobotAnimation} animation
 */
export function cancelSearchAnimationFrame(animation) {
  if (animation.searchAnimationFrame !== null) {
    animation.robot._cancelAnimationFrame(animation.searchAnimationFrame);
    animation.searchAnimationFrame = null;
  }
}

/**
 * @param {RobotAnimation} animation
 */
export function scheduleSearchAnimationFrame(animation) {
  if (animation.searchAnimationFrame !== null) {
    return;
  }

  animation.searchAnimationFrame = animation.robot._requestAnimationFrame(
    () => {
      animation.searchAnimationFrame = null;
      updateSearchAnimation(animation);
      if (animation.searchAnimation.active) {
        scheduleSearchAnimationFrame(animation);
      }
    },
  );
}

/**
 * @param {RobotAnimation} animation
 */
export function startSearchAnimation(animation) {
  if (!animation.robot.dom.container) {
    return;
  }

  const targetEl = getSearchTargetElement();
  if (!targetEl) {
    stopSearchAnimation(animation);
    return;
  }

  const { targetX, targetY } = resolveSearchFlightTarget(
    targetEl.getBoundingClientRect(),
  );

  cancelSearchAnimationFrame(animation);
  animation.searchAnimation.active = true;
  animation.searchAnimation.phase = 'approach';
  animation.searchAnimation.startTime = performance.now();
  animation.searchAnimation.startX = animation.patrol.x;
  animation.searchAnimation.startY = animation.patrol.y;
  animation.searchAnimation.targetX = targetX;
  animation.searchAnimation.targetY = targetY;
  animation.searchAnimation.hoverPhase = 0;

  animation.robot.dom.container.style.zIndex = '10001';
  setMagnifyingGlassVisible(animation, true);

  animation.robot.showBubble('Ah! Ich helfe suchen! 🔍');
  animation.robot._setTimeout(() => animation.robot.hideBubble(), 2000);

  scheduleSearchAnimationFrame(animation);
}

/**
 * @param {RobotAnimation} animation
 */
export function stopSearchAnimation(animation) {
  cancelSearchAnimationFrame(animation);
  setMagnifyingGlassVisible(animation, false);

  const isNearOrigin =
    Math.abs(animation.patrol.x) < 0.5 && Math.abs(animation.patrol.y) < 0.5;

  if (!animation.searchAnimation.active && isNearOrigin) {
    animation.searchAnimation.active = false;
    animation.searchAnimation.phase = 'idle';
    animation.searchAnimation.hoverPhase = 0;
    resetSearchVisuals(animation);
    if (!animation.patrol.active && !animation.startAnimation.active) {
      animation.startPatrol();
    }
    return;
  }

  animation.searchAnimation.active = true;
  animation.searchAnimation.phase = 'returning';
  animation.searchAnimation.startTime = performance.now();
  animation.searchAnimation.startX = animation.patrol.x;
  animation.searchAnimation.startY = animation.patrol.y;
  animation.searchAnimation.targetX = 0;
  animation.searchAnimation.targetY = 0;
  animation.searchAnimation.hoverPhase = 0;

  scheduleSearchAnimationFrame(animation);
}

/**
 * @param {RobotAnimation} animation
 */
export function updateSearchAnimation(animation) {
  if (!animation.searchAnimation.active) {
    return;
  }

  const now = performance.now();

  if (
    animation.searchAnimation.phase === 'approach' ||
    animation.searchAnimation.phase === 'returning'
  ) {
    const elapsed = now - animation.searchAnimation.startTime;
    const t = Math.min(1, elapsed / SEARCH_FLIGHT_DURATION);
    const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    animation.patrol.x =
      animation.searchAnimation.startX +
      (animation.searchAnimation.targetX - animation.searchAnimation.startX) *
        ease;
    animation.patrol.y =
      animation.searchAnimation.startY +
      (animation.searchAnimation.targetY - animation.searchAnimation.startY) *
        ease;

    animation.searchAnimation.hoverPhase += 0.05;
    animation.patrol.y += Math.sin(animation.searchAnimation.hoverPhase) * 10;

    if (animation.robot.dom.svg) {
      const isReturning = animation.searchAnimation.phase === 'returning';
      const tilt = isReturning
        ? 0
        : 10 + Math.sin(animation.searchAnimation.hoverPhase) * 2;
      animation.robot.dom.svg.style.transform = `rotate(${tilt}deg)`;
    }

    if (animation.robot.dom.flame) {
      const flameScale =
        1 + Math.sin(animation.searchAnimation.hoverPhase * 5) * 0.2;
      animation.robot.dom.flame.style.opacity = '1';
      animation.robot.dom.flame.style.transform = `scale(${flameScale})`;
      if (Math.random() < 0.15) {
        animation.spawnFlameParticle();
      }
    }

    updateRobotTransform(animation);

    if (t < 1) {
      return;
    }

    if (animation.searchAnimation.phase === 'returning') {
      finishSearchReturn(animation);
      return;
    }

    animation.searchAnimation.phase = 'hover';
    return;
  }

  if (animation.searchAnimation.phase !== 'hover') {
    return;
  }

  animation.searchAnimation.hoverPhase += 0.04;
  animation.patrol.x = animation.searchAnimation.targetX;
  animation.patrol.y =
    animation.searchAnimation.targetY +
    Math.sin(animation.searchAnimation.hoverPhase) * 12;

  if (animation.robot.dom.flame) {
    const flameScale =
      0.8 + Math.sin(animation.searchAnimation.hoverPhase * 3) * 0.15;
    animation.robot.dom.flame.style.opacity = '0.8';
    animation.robot.dom.flame.style.transform = `scale(${flameScale})`;
  }

  if (animation.robot.dom.eyes) {
    const eyeX = -3 + Math.sin(animation.searchAnimation.hoverPhase * 2) * 1.5;
    const eyeY = -2 + Math.cos(animation.searchAnimation.hoverPhase * 2) * 1;
    animation.robot.dom.eyes.style.transform = `translate(${eyeX}px, ${eyeY}px)`;
  }

  updateRobotTransform(animation);
}
