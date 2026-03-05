import { createLogger } from '../../../core/logger.js';
import { uiStore } from '../../../core/ui-store.js';
import { ROBOT_EVENTS } from '../constants/events.js';
import { RobotIntelligence } from '../modules/robot-intelligence.js';

const log = createLogger('RobotCompanionHydration');

export function setupProgressiveHydration(robot) {
  if (!robot.dom.container || robot.isHydrated) return;

  robot.dom.container.dataset.hydrated = 'false';

  const hydrateNow = () => {
    if (robot.isHydrated) return;
    if (robot._hydrationObserver) {
      robot._hydrationObserver.disconnect();
      robot._hydrationObserver = null;
    }
    if (robot._hydrationFallbackTimer) {
      robot._clearTimeout(robot._hydrationFallbackTimer);
      robot._hydrationFallbackTimer = null;
    }
    hydrateInteractiveFeatures(robot);
  };

  if (
    typeof globalThis !== 'undefined' &&
    'IntersectionObserver' in globalThis
  ) {
    robot._hydrationObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            hydrateNow();
          }
        });
      },
      {
        rootMargin: '180px 0px',
        threshold: [0.01, 0.2],
      },
    );
    robot._hydrationObserver.observe(robot.dom.container);
    robot._hydrationFallbackTimer = robot._setTimeout(hydrateNow, 7000);
    return;
  }

  hydrateNow();
}

export function hydrateInteractiveFeatures(robot) {
  if (robot.isHydrated || !robot.dom.container) return;
  robot.isHydrated = true;
  robot.dom.container.dataset.hydrated = 'true';

  if (!robot.intelligenceModule) {
    robot.intelligenceModule = new RobotIntelligence(robot);
  }

  robot.attachEvents();
  robot.setupFooterOverlapCheck();
  robot.setupMobileViewportHandler();

  robot._setTimeout(() => {
    const ctx = robot.getPageContext();
    if (!robot.chatModule.isOpen && !robot.chatModule.lastGreetedContext) {
      robot.chatModule.lastGreetedContext = ctx;
    }
  }, 5000);

  robot.setupSectionChangeDetection();
  robot.setupPageContextMorphing();

  robot._setTimeout(() => {
    robot.contextReactionsModule.startMonitoring();
    robot.contextReactionsModule.setupIdleReaction(60000);
  }, 3000);

  robot._setTimeout(() => {
    robot.animationModule.startTypeWriterKnockbackAnimation();
  }, 50);

  robot._onHeroTypingEnd = () => {
    try {
      robot.checkTypewriterCollision();
    } catch (error) {
      log.warn('RobotCompanion: hero typing end handler failed', error);
    }
  };
  document.addEventListener(
    ROBOT_EVENTS.HERO_TYPING_END,
    robot._onHeroTypingEnd,
  );
  robot._eventListeners.heroTypingEnd = {
    target: document,
    handler: robot._onHeroTypingEnd,
  };

  uiStore.setState({ robotHydrated: true });
}
