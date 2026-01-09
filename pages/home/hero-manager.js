import {
  createTriggerOnceObserver,
  EVENTS,
  getElementById,
  TimerManager,
  createLogger,
} from '../../content/utils/shared-utilities.js';

let typeWriterModule = null;

const logger = createLogger('HeroManager');
const heroTimers = new TimerManager();

// ===== Hero Management Module =====
const HERO_LAZY_FALLBACK_MS = 6000;
const HERO_LOOKUP_MAX = 3;
const HERO_LOOKUP_DELAY_MS = 900;

const HeroManager = (() => {
  let heroData = null;
  let isInitialized = false;
  let currentTypeWriter = null;
  let clickHandler = null;
  let observer = null;
  let loaded = false;
  let triggerLoad = null;
  let heroLookupAttempts = 0;

  async function loadTyped(heroDataModule) {
    try {
      if (!typeWriterModule) {
        typeWriterModule = await import(
          '../../content/components/typewriter/TypeWriter.js'
        ).catch((err) => {
          logger.warn('Failed to import TypeWriter module', err);
          return null;
        });
      }

      if (!typeWriterModule?.initHeroSubtitle) return false;

      const tw = await typeWriterModule.initHeroSubtitle({ heroDataModule });
      if (tw) {
        currentTypeWriter = tw;
        return tw;
      }
    } catch (err) {
      logger.warn('Failed to load TypeWriter modules', err);
    }
    return false;
  }

  function initLazyHeroModules() {
    if (isInitialized) return;

    if (!triggerLoad) {
      triggerLoad = async () => {
        if (loaded) return;
        loaded = true;

        const dataModule = await ensureHeroData().catch(() => ({}));
        await loadTyped(dataModule);
        setRandomGreetingHTML();
        isInitialized = true;
      };
    }

    const heroEl =
      getElementById('hero') || document.querySelector('section#hero');
    if (!heroEl) {
      if (heroLookupAttempts < HERO_LOOKUP_MAX) {
        heroLookupAttempts += 1;
        heroTimers.setTimeout(
          initLazyHeroModules,
          HERO_LOOKUP_DELAY_MS * heroLookupAttempts,
        );
      } else {
        heroTimers.setTimeout(triggerLoad, HERO_LAZY_FALLBACK_MS);
      }
      return;
    }

    heroLookupAttempts = 0;

    const rect = heroEl.getBoundingClientRect();
    if (rect.top < innerHeight && rect.bottom > 0) {
      triggerLoad();
      return;
    }

    observer = createTriggerOnceObserver(triggerLoad);
    observer.observe(heroEl);
    heroTimers.setTimeout(triggerLoad, HERO_LAZY_FALLBACK_MS);
  }

  const ensureHeroData = async () =>
    heroData ||
    (heroData = await import('./GrussText.js').catch((err) => {
      logger.warn('Failed to load GrussText.js', err);
      return {};
    }));

  async function setRandomGreetingHTML() {
    const delays = [0, 50, 120, 240, 480];
    let el = null;

    for (const d of delays) {
      if (d) await heroTimers.sleep(d);
      el = getElementById('greetingText');
      if (el) break;
    }
    if (!el) return;

    try {
      const mod = await ensureHeroData();
      const set = mod.getGreetingSet?.() ?? [];
      const next = mod.pickGreeting?.(el.dataset.last, set) ?? '';
      if (!next) return;

      el.dataset.last = next;
      el.textContent = next;
    } catch (e) {
      logger.warn('Error setting greeting text', e);
    }
  }

  function cleanup() {
    heroTimers.clearAll();
    isInitialized = false;
    loaded = false;
    triggerLoad = null;
    heroLookupAttempts = 0;
    try {
      typeWriterModule?.stopHeroSubtitle?.();
      currentTypeWriter = null;
    } catch (err) {
      logger.warn('HeroManager: stopHeroSubtitle failed', err);
    }
    if (clickHandler) {
      document.removeEventListener('click', clickHandler);
      clickHandler = null;
    }
    if (observer) {
      try {
        observer.disconnect();
      } catch (err) {
        logger.warn('HeroManager: observer disconnect failed', err);
      }
      observer = null;
    }
  }

  function setClickHandler(handler) {
    if (clickHandler) {
      document.removeEventListener('click', clickHandler);
    }
    clickHandler = handler;
    document.addEventListener('click', handler);
  }

  return {
    initLazyHeroModules,
    setRandomGreetingHTML,
    ensureHeroData,
    cleanup,
    setClickHandler,
  };
})();

// ===== Public API =====
export function initHeroFeatureBundle() {
  HeroManager.cleanup();

  const onHeroLoaded = () => {
    const el = getElementById('greetingText');
    if (!el) return;
    if (!el.textContent.trim() || el.textContent.trim() === 'Willkommen') {
      HeroManager.setRandomGreetingHTML();
      window.announce?.('Hero Bereich bereit.');
    }
  };

  document.removeEventListener(EVENTS.HERO_LOADED, onHeroLoaded);
  document.addEventListener(EVENTS.HERO_LOADED, onHeroLoaded, { once: true });

  document.addEventListener(
    EVENTS.HERO_INIT_READY,
    () => {
      const el = getElementById('greetingText');
      if (el?.textContent.trim()) return;
      HeroManager.setRandomGreetingHTML();
    },
    { once: true },
  );

  document.addEventListener(EVENTS.HERO_TYPING_END, (e) => {
    window.announce?.(`Zitat vollständig: ${e.detail?.text ?? 'Text'}`);
  });

  HeroManager.initLazyHeroModules();

  const handleHeroClick = (event) => {
    const link = event.target.closest('.hero-buttons a[href^="#"]');
    if (!link) return;

    const href = link.getAttribute('href') || '';
    if (!href.startsWith('#')) return;

    event.preventDefault();
    const targetId = href.slice(1);
    const target =
      getElementById(targetId) || document.getElementById(targetId);
    if (!target) return;

    const doScroll = () => {
      try {
        target.scrollIntoView({ behavior: 'smooth' });
      } catch (err) {
        logger.warn('HeroManager: scrollIntoView failed, using fallback', err);
        const top = target.getBoundingClientRect().top + window.pageYOffset;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    };

    if (window.SectionLoader?.loadSection) {
      window.SectionLoader.loadSection(target).finally(() =>
        requestAnimationFrame(doScroll),
      );
    } else {
      requestAnimationFrame(doScroll);
    }
  };

  HeroManager.setClickHandler(handleHeroClick);
}
