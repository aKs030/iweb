import { subscribeFooterState } from '../../../core/footer-state.js';

export function getFooterElement(robot) {
  if (robot.dom.footer && document.contains(robot.dom.footer)) {
    return robot.dom.footer;
  }

  robot.dom.footer =
    document.querySelector('site-footer .site-footer') ||
    document.querySelector('footer.site-footer') ||
    document.querySelector('site-footer');
  return robot.dom.footer || null;
}

export function getTypewriterElement(robot) {
  if (robot._typeWriterEl && document.contains(robot._typeWriterEl)) {
    return robot._typeWriterEl;
  }

  robot._typeWriterEl = document.querySelector('.typewriter-title');
  return robot._typeWriterEl || null;
}

export function checkTypewriterCollision(robot) {
  const typeWriter = getTypewriterElement(robot);
  if (!typeWriter || !robot.dom?.container) return;

  const twRect = typeWriter.getBoundingClientRect();
  robot.collisionModule.checkForTypewriterCollision(twRect);
}

export function setupFooterOverlapCheck(robot) {
  let ticking = false;

  const ensureObservedFooter = () => {
    if (!robot._footerLayoutObserver) return;
    const footer = getFooterElement(robot);
    if (!footer || robot._observedFooterEl === footer) return;

    if (robot._observedFooterEl) {
      try {
        robot._footerLayoutObserver.unobserve(robot._observedFooterEl);
      } catch {
        /* ignore */
      }
    }

    robot._footerLayoutObserver.observe(footer);
    robot._observedFooterEl = footer;
  };

  const checkOverlap = () => {
    if (
      robot.animationModule.searchAnimation &&
      robot.animationModule.searchAnimation.active
    ) {
      if (robot.dom.container.style.bottom) {
        robot.dom.container.style.bottom = '';
      }
      ticking = false;
      return;
    }

    if (robot.isKeyboardAdjustmentActive) {
      ticking = false;
      return;
    }

    if (!robot.dom.container) {
      ticking = false;
      return;
    }

    const pageCtx = robot.dom.container.dataset.pageContext;
    if (pageCtx === 'gallery') {
      ticking = false;
      return;
    }

    const footerGap = 8;
    robot.dom.container.style.removeProperty('bottom');
    const computedBottom = parseFloat(
      getComputedStyle(robot.dom.container).bottom,
    );
    const baseBottom = Number.isFinite(computedBottom) ? computedBottom : 30;

    const footer = getFooterElement(robot);
    if (!footer) {
      robot.dom.container.style.bottom = `${Math.round(baseBottom)}px`;
      ticking = false;
      return;
    }

    const viewportHeight =
      globalThis.innerHeight || document.documentElement.clientHeight || 0;
    const footerRect = footer.getBoundingClientRect();
    const anchoredBottom = Math.max(
      baseBottom,
      viewportHeight - footerRect.top + footerGap,
    );

    robot.dom.container.style.bottom = `${Math.round(anchoredBottom)}px`;

    if (!robot.chatModule.isOpen) {
      robot.collisionModule.scanForCollisions();
    }
    ticking = false;
    ensureObservedFooter();
  };

  const requestTick = () => {
    if (ticking) return;
    robot._requestAnimationFrame(checkOverlap);
    ticking = true;
  };

  if (typeof globalThis !== 'undefined') {
    globalThis.addEventListener('scroll', requestTick, { passive: true });
    globalThis.addEventListener('resize', requestTick, { passive: true });
    robot._eventListeners.scroll.push({
      target: globalThis,
      handler: requestTick,
    });
    robot._eventListeners.resize.push({
      target: globalThis,
      handler: requestTick,
    });
  }

  if (robot._footerStateUnsubscribe) {
    robot._footerStateUnsubscribe();
  }
  robot._footerStateUnsubscribe = subscribeFooterState(() => {
    requestTick();
  });

  if (typeof ResizeObserver !== 'undefined') {
    if (robot._footerLayoutObserver) {
      robot._footerLayoutObserver.disconnect();
    }
    robot._footerLayoutObserver = new ResizeObserver(() => requestTick());
    robot._footerLayoutObserver.observe(document.documentElement);
    if (robot.dom.container) {
      robot._footerLayoutObserver.observe(robot.dom.container);
    }
    ensureObservedFooter();
  }

  requestTick();
}

export function setupChatInputViewportHandlers(robot) {
  if (!robot.dom.input || !robot._handleViewportResize) return;

  const handleResize = robot._handleViewportResize;
  const blurHandler = () => robot._setTimeout(handleResize, 200);
  robot.dom.input.addEventListener('focus', handleResize);
  robot.dom.input.addEventListener('blur', blurHandler);
  robot._eventListeners.inputFocus = {
    target: robot.dom.input,
    handler: handleResize,
  };
  robot._eventListeners.inputBlur = {
    target: robot.dom.input,
    handler: blurHandler,
  };
}

export function setupMobileViewportHandler(robot) {
  if (typeof globalThis === 'undefined' || !globalThis.visualViewport) return;

  robot._handleViewportResize = () => {
    if (
      robot.animationModule.searchAnimation &&
      robot.animationModule.searchAnimation.active
    ) {
      return;
    }

    if (!robot.dom.window || !robot.dom.container) return;

    if (!robot.chatModule.isOpen) {
      if (robot.isKeyboardAdjustmentActive) {
        robot.isKeyboardAdjustmentActive = false;
        robot.dom.container.style.bottom = '';
        robot.dom.window.style.bottom = '';
        robot.dom.window.style.top = '';
        robot.dom.window.style.maxHeight = '';
        robot.dom.window.classList.remove('keyboard-open');
        document.body.classList.remove('robot-keyboard-open');
      }
      return;
    }

    const visualViewport = globalThis.visualViewport;
    if (!visualViewport) return;

    const visualHeight = visualViewport.height;
    const visualOffsetTop = visualViewport.offsetTop;
    const layoutHeight = globalThis.innerHeight;
    const isInputFocused = document.activeElement === robot.dom.input;
    const heightDiff = layoutHeight - visualHeight;
    const isKeyboardOverlay =
      heightDiff > 150 ||
      (isInputFocused && (heightDiff > 50 || visualOffsetTop > 0));

    if (isKeyboardOverlay) {
      robot.isKeyboardAdjustmentActive = true;
      robot.dom.window.classList.add('keyboard-open');
      document.body.classList.add('robot-keyboard-open');

      const safeMargin = 8;
      robot.dom.window.style.bottom = 'auto';
      robot.dom.window.style.top = `${visualOffsetTop + safeMargin}px`;

      const maxWindowHeight = visualHeight - safeMargin * 2;
      robot.dom.window.style.maxHeight = `${maxWindowHeight}px`;
      robot.dom.window.style.height = `${maxWindowHeight}px`;

      robot._setTimeout(() => robot.chatModule.scrollToBottom(), 10);
      return;
    }

    robot.isKeyboardAdjustmentActive = false;
    robot.dom.window.classList.remove('keyboard-open');
    document.body.classList.remove('robot-keyboard-open');
    robot.dom.container.style.bottom = '';
    robot.dom.window.style.bottom = '';
    robot.dom.window.style.top = '';
    robot.dom.window.style.maxHeight = '';
    robot.dom.window.style.height = '';
  };

  globalThis.visualViewport.addEventListener(
    'resize',
    robot._handleViewportResize,
  );
  globalThis.visualViewport.addEventListener(
    'scroll',
    robot._handleViewportResize,
  );
  robot._eventListeners.visualViewportResize.push({
    target: globalThis.visualViewport,
    handler: robot._handleViewportResize,
  });
  robot._eventListeners.visualViewportScroll.push({
    target: globalThis.visualViewport,
    handler: robot._handleViewportResize,
  });

  setupChatInputViewportHandlers(robot);
}
