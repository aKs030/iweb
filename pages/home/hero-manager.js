import { observeOnce } from '/content/core/utils.js';
import { createLogger } from '/content/core/logger.js';
import { getElementById } from '/content/core/utils.js';
import { i18n } from '/content/core/i18n.js';
import { TimerManager } from '/content/core/utils.js';
import { ROBOT_EVENTS } from '/content/components/robot-companion/constants/events.js';

let typeWriterModule = null;

const log = createLogger('HeroManager');

const heroTimers = new TimerManager('HeroTimers');

// ===== Hero Management Module =====
const HERO_LAZY_FALLBACK_MS = 6000;
const HERO_LOOKUP_MAX = 3;
const HERO_LOOKUP_DELAY_MS = 900;

const HeroManager = (() => {
  let heroData = null;
  let isInitialized = false;
  let clickHandler = null;
  let observer = null;
  let loaded = false;
  let triggerLoad = null;
  let heroLookupAttempts = 0;
  let languageChangeHandler = null;

  async function loadTyped(heroDataModule) {
    try {
      if (!typeWriterModule) {
        typeWriterModule =
          await import('../../content/components/typewriter/TypeWriter.js').catch(
            (err) => {
              log.warn('Failed to import TypeWriter module', err);
              return null;
            },
          );
      }

      if (!typeWriterModule?.initHeroSubtitle) return false;

      const tw = await typeWriterModule.initHeroSubtitle({ heroDataModule });
      if (tw) {
        return tw;
      }
    } catch (err) {
      log.warn('Failed to load TypeWriter modules', err);
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
      // Hero is visible, trigger immediately
      triggerLoad();
      return;
    }

    observer = observeOnce(heroEl, triggerLoad);
    heroTimers.setTimeout(triggerLoad, HERO_LAZY_FALLBACK_MS);
  }

  const ensureHeroData = async () =>
    heroData ||
    (heroData = await import('./GrussText.js').catch((err) => {
      log.warn('Failed to load GrussText.js', err);
      return {};
    }));

  async function setRandomGreetingHTML() {
    const delays = [0, 50, 120, 240, 480];
    let el = null;

    for (const d of delays) {
      if (d) {
        await new Promise((resolve) => heroTimers.setTimeout(resolve, d));
      }
      el = getElementById('greetingText');
      if (el) break;
    }
    if (!el) return;

    try {
      const mod = await ensureHeroData();
      const set = mod.getGreetingSet?.(new Date(), i18n.currentLang) ?? [];
      const next = mod.pickGreeting?.(el.dataset.last, set) ?? '';
      if (!next) return;

      el.dataset.last = next;
      el.textContent = next;
      el.dataset.text = next;
    } catch (e) {
      log.warn('Error setting greeting text', e);
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
    } catch (err) {
      log.warn('HeroManager: stopHeroSubtitle failed', err);
    }
    if (clickHandler) {
      document.removeEventListener('click', clickHandler);
      clickHandler = null;
    }
    if (languageChangeHandler) {
      i18n.removeEventListener('language-changed', languageChangeHandler);
      languageChangeHandler = null;
    }
    if (observer) {
      try {
        observer.disconnect();
      } catch (err) {
        log.warn('HeroManager: observer disconnect failed', err);
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
    setupLanguageListener: () => {
      if (languageChangeHandler) {
        i18n.removeEventListener('language-changed', languageChangeHandler);
      }
      languageChangeHandler = () => {
        // Update greeting when language changes
        setRandomGreetingHTML();
      };
      i18n.addEventListener('language-changed', languageChangeHandler);
    },
  };
})();

// ===== Public API =====
export const initHeroFeatureBundle = (sectionManager) => {
  HeroManager.cleanup();

  const onHeroLoaded = () => {
    const el = getElementById('greetingText');
    if (!el) return;
    if (!el.textContent.trim() || el.textContent.trim() === 'Willkommen') {
      HeroManager.setRandomGreetingHTML();
      window.announce?.('Hero Bereich bereit.');
    }
  };

  document.removeEventListener('hero:loaded', onHeroLoaded);
  document.addEventListener('hero:loaded', onHeroLoaded, { once: true });

  document.addEventListener(
    'hero:initReady',
    () => {
      const el = getElementById('greetingText');
      if (el?.textContent.trim()) return;
      HeroManager.setRandomGreetingHTML();
    },
    { once: true },
  );

  document.addEventListener(ROBOT_EVENTS.HERO_TYPING_END, (e) => {
    const detail = /** @type {CustomEvent} */ (e).detail;
    window.announce?.(`Zitat vollständig: ${detail?.text ?? 'Text'}`);
  });

  // Setup language change listener
  HeroManager.setupLanguageListener();

  HeroManager.initLazyHeroModules();

  const handleHeroClick = (event) => {
    const link = event.target.closest('.hero__buttons a[href^="#"]');
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
        log.warn('HeroManager: scrollIntoView failed, using fallback', err);
        const top = target.getBoundingClientRect().top + window.pageYOffset;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    };

    if (sectionManager?.loadSection) {
      sectionManager
        .loadSection(target)
        .finally(() => requestAnimationFrame(doScroll));
    } else {
      requestAnimationFrame(doScroll);
    }
  };

  HeroManager.setClickHandler(handleHeroClick);
};
