import { createLogger } from '../../../core/logger.js';
import { createObserver } from '../../../core/utils.js';

const log = createLogger('RobotCompanionContext');

export function maybeTriggerContextReaction(robot, currentContext = null) {
  if (robot.chatModule.isOpen) return;

  const nextContext = currentContext || getPageContext(robot);
  if (!nextContext) return;

  if (!robot._lastKnownContext) {
    robot._lastKnownContext = nextContext;
    return;
  }

  if (
    nextContext === robot._lastKnownContext ||
    nextContext === robot.chatModule.lastGreetedContext
  ) {
    return;
  }

  robot._lastKnownContext = nextContext;
  robot.contextReactionsModule?.reactToSection(nextContext);

  robot._setTimeout(() => {
    if (getPageContext(robot) === nextContext && !robot.chatModule.isOpen) {
      robot.chatModule.lastGreetedContext = nextContext;
    }
  }, 2000);
}

export function setupSectionChangeDetection(robot) {
  setupSectionObservers(robot);
  robot._lastKnownContext = getPageContext(robot);

  let rafPending = false;
  robot._scrollListener = () => {
    if (rafPending) return;
    rafPending = true;

    robot._requestAnimationFrame(() => {
      rafPending = false;
      if (robot._scrollTimeout) {
        robot._clearTimeout(robot._scrollTimeout);
      }
      robot._scrollTimeout = robot._setTimeout(() => {
        maybeTriggerContextReaction(robot);
        try {
          robot.checkTypewriterCollision();
        } catch (error) {
          log.warn(
            'RobotCompanion: scroll handler collision check failed',
            error,
          );
        }
      }, 220);
    });
  };

  if (typeof globalThis !== 'undefined') {
    globalThis.addEventListener('scroll', robot._scrollListener, {
      passive: true,
    });
    robot._eventListeners.scroll.push({
      target: globalThis,
      handler: robot._scrollListener,
    });
  }

  const onNavigationContextCheck = () => maybeTriggerContextReaction(robot);
  window.addEventListener('hashchange', onNavigationContextCheck, {
    passive: true,
  });
  window.addEventListener('popstate', onNavigationContextCheck, {
    passive: true,
  });
  robot._eventListeners.dom.push({
    target: window,
    event: 'hashchange',
    handler: onNavigationContextCheck,
  });
  robot._eventListeners.dom.push({
    target: window,
    event: 'popstate',
    handler: onNavigationContextCheck,
  });

  maybeTriggerContextReaction(robot, robot._lastKnownContext);
}

export function setupPageContextMorphing(robot) {
  updatePageContextAttribute(robot);

  const onPageChanged = () => updatePageContextAttribute(robot);

  window.addEventListener('page:changed', onPageChanged, { passive: true });
  robot._eventListeners.dom.push({
    target: window,
    event: 'page:changed',
    handler: onPageChanged,
  });
}

export function updatePageContextAttribute(robot) {
  const ctx = getPageContext(robot);
  const container = robot.dom?.container;
  if (!container) return;

  const contextMap = {
    hero: 'home',
    features: 'home',
    home: 'home',
    projects: 'projects',
    about: 'about',
    gallery: 'gallery',
    blog: 'blog',
    videos: 'videos',
    contact: 'contact',
    legal: 'legal',
    footer: 'home',
    default: 'home',
  };

  const mapped = contextMap[ctx] || 'home';
  const prev = container.dataset.pageContext;

  if (prev !== mapped) {
    container.dataset.pageContext = mapped;
    robot._typeWriterEl = null;

    if (robot.animationModule) {
      robot.animationModule.patrol.x = 0;
      robot.animationModule.patrol.y = 0;
      robot.animationModule.patrol.isPaused = false;
      container.style.transform = 'translate3d(0px, 0px, 0)';

      if (mapped === 'home' && prev !== undefined) {
        robot._setTimeout(() => {
          robot.animationModule.startTypeWriterKnockbackAnimation();
        }, 300);
      }
    }

    if (robot.collisionModule) {
      robot.collisionModule._lastCollisionCheck = 0;
      robot.collisionModule._lastObstacleUpdate = 0;
    }

    log.debug('Robot morph context →', mapped);
  }
}

export function getPageContext(robot) {
  try {
    if (robot.currentObservedContext) return robot.currentObservedContext;

    const path = (window.location && window.location.pathname) || '';
    const file = path.split('/').pop() || '';
    const lower = path.toLowerCase();
    const midY = (window.innerHeight || 0) / 2;

    const sectionCheck = (selector) => {
      try {
        const el = document.querySelector(selector);
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        return rect.top <= midY && rect.bottom >= midY;
      } catch {
        return false;
      }
    };

    let context = 'default';

    if (sectionCheck('#hero')) context = 'hero';
    else if (sectionCheck('#features')) context = 'features';
    else if (sectionCheck('#section3')) context = 'about';
    else if (sectionCheck('site-footer') || sectionCheck('footer'))
      context = 'footer';
    else if (lower.includes('projekte')) context = 'projects';
    else if (lower.includes('gallery') || lower.includes('fotos'))
      context = 'gallery';
    else if (lower.includes('videos')) context = 'videos';
    else if (lower.includes('blog')) context = 'blog';
    else if (lower.includes('contact') || lower.includes('kontakt'))
      context = 'contact';
    else if (lower.includes('datenschutz') || lower.includes('impressum'))
      context = 'legal';
    else if (lower.includes('about') || lower.includes('abdul-sesli')) {
      if (file !== 'index.html') context = 'about';
    } else if (lower === '/' || file === 'index.html' || file === '') {
      context = 'home';
    } else {
      const h1 = document.querySelector('h1');
      if (h1) {
        const h1Text = (h1.textContent || '').toLowerCase();
        if (h1Text.includes('projekt')) context = 'projects';
        else if (h1Text.includes('foto') || h1Text.includes('galerie'))
          context = 'gallery';
        else if (h1Text.includes('video')) context = 'videos';
      }
    }

    robot.trackSectionVisit(context);
    return context;
  } catch {
    return 'default';
  }
}

export function setupSectionObservers(robot) {
  if (robot._sectionObserver) return;

  const sectionMap = [
    { selector: '#hero', ctx: 'hero' },
    { selector: '#features', ctx: 'features' },
    { selector: '#section3', ctx: 'about' },
    { selector: 'site-footer', ctx: 'footer' },
    { selector: 'footer', ctx: 'footer' },
  ];

  robot._sectionObserver = createObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && entry.intersectionRatio > 0.35) {
          const match = sectionMap.find((section) =>
            entry.target.matches(section.selector),
          );
          if (!match) return;
          if (robot.currentObservedContext === match.ctx) return;
          robot.currentObservedContext = match.ctx;
          robot.stateManager.setState({ currentContext: match.ctx });
          maybeTriggerContextReaction(robot, match.ctx);
        }
      });
    },
    { threshold: [0.35, 0.5, 0.75] },
  );

  sectionMap.forEach((section) => {
    const el = document.querySelector(section.selector);
    if (el && robot._sectionObserver) {
      robot._sectionObserver.observe(el);
    }
  });
}
