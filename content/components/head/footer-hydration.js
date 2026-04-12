import { getFooterShellMarkup } from '#footer/shell.js';
import { whenFooterReady } from '#footer/state.js';
import { getMenuShellMarkup } from '#menu/shell.js';
import { cancelIdleTask, scheduleIdleTask } from '#core/async-utils.js';
import { loadHeadStylesheet } from '#core/dom-utils.js';
import { createLogger } from '#core/logger.js';
import { resourceHints } from '#core/resource-hints.js';

const log = createLogger('head-footer');

const FOOTER_MODULE_HREF = '/content/components/footer/index.js';
const FOOTER_STYLES_HREF = '/content/components/footer/footer.css';
const FOOTER_TRIGGER_SELECTOR = '[data-footer-trigger], a[href="#footer"]';
const FOOTER_COOKIE_TRIGGER_SELECTOR = '[data-cookie-trigger]';
const FOOTER_CONSENT_ACTION_SELECTOR = '#accept-cookies, #reject-cookies';
const FOOTER_IDLE_HYDRATION_TIMEOUT_MS = 4000;

let footerModulePromise = null;
let footerStylesPromise = null;
let footerHydrationAttached = false;

const getFooterTrigger = (target) => {
  if (!(target instanceof Element)) return null;
  return target.closest(FOOTER_TRIGGER_SELECTOR);
};

const getCookieTrigger = (target) => {
  if (!(target instanceof Element)) return null;
  return target.closest(FOOTER_COOKIE_TRIGGER_SELECTOR);
};

const getConsentActionTrigger = (target) => {
  if (!(target instanceof Element)) return null;
  return target.closest(FOOTER_CONSENT_ACTION_SELECTOR);
};

const preloadFooterModule = () => {
  resourceHints.modulePreload(FOOTER_MODULE_HREF);
};

const loadFooterModule = async () => {
  if (customElements.get('site-footer')) return null;
  if (footerModulePromise) return footerModulePromise;

  preloadFooterModule();
  footerModulePromise = import('#footer/index.js').catch((error) => {
    footerModulePromise = null;
    log.warn('failed to load footer module', error);
    return null;
  });

  return footerModulePromise;
};

const loadFooterStyles = () => {
  if (footerStylesPromise) return footerStylesPromise;

  footerStylesPromise = loadHeadStylesheet(FOOTER_STYLES_HREF, {
    injectedBy: 'head-inline',
    dataset: { deferred: 'footer' },
  }).finally(() => {
    footerStylesPromise = null;
  });

  return footerStylesPromise;
};

const isFooterReady = () => {
  const footer = document.querySelector('site-footer');
  return Boolean(
    footer &&
    typeof (/** @type {any} */ (footer).open) === 'function' &&
    footer.querySelector('footer.site-footer'),
  );
};

const waitForFooterReady = () =>
  new Promise((resolve) => {
    if (isFooterReady()) {
      resolve(document.querySelector('site-footer'));
      return;
    }

    whenFooterReady({ timeout: 1500 })
      .catch(() => null)
      .finally(() => {
        resolve(document.querySelector('site-footer'));
      });
  });

const setupFooterModuleHydration = (siteFooter) => {
  if (
    footerHydrationAttached ||
    !siteFooter ||
    customElements.get('site-footer')
  ) {
    return;
  }

  footerHydrationAttached = true;

  let observer = null;
  let idleHandle = null;

  const cleanup = () => {
    document.removeEventListener('pointerover', handleTriggerIntent);
    document.removeEventListener('focusin', handleTriggerIntent);
    document.removeEventListener('click', handleTriggerClick, true);

    if (observer) {
      observer.disconnect();
      observer = null;
    }

    cancelIdleTask(idleHandle);
    idleHandle = null;
  };

  const hydrateFooterModule = async () => {
    try {
      await loadFooterModule();
    } finally {
      cleanup();
    }
  };

  const handleTriggerIntent = (event) => {
    if (
      !getFooterTrigger(event.target) &&
      !getCookieTrigger(event.target) &&
      !getConsentActionTrigger(event.target)
    ) {
      return;
    }
    void loadFooterStyles();
    preloadFooterModule();
  };

  const handleTriggerClick = async (event) => {
    if (customElements.get('site-footer') && isFooterReady()) return;
    const footerTrigger = getFooterTrigger(event.target);
    const cookieTrigger = getCookieTrigger(event.target);
    const consentActionTrigger = getConsentActionTrigger(event.target);
    if (!footerTrigger && !cookieTrigger && !consentActionTrigger) return;

    event.preventDefault();

    await loadFooterStyles();
    const footerModule = await loadFooterModule();
    const footer = await waitForFooterReady();

    try {
      if (
        consentActionTrigger instanceof HTMLElement &&
        consentActionTrigger.id
      ) {
        const hydratedConsentTrigger = footer?.querySelector?.(
          `#${consentActionTrigger.id}`,
        );
        if (hydratedConsentTrigger instanceof HTMLButtonElement) {
          hydratedConsentTrigger.click();
          return;
        }
      }

      if (cookieTrigger) {
        const hydratedCookieTrigger = footer?.querySelector?.(
          FOOTER_COOKIE_TRIGGER_SELECTOR,
        );
        if (
          hydratedCookieTrigger instanceof HTMLButtonElement ||
          hydratedCookieTrigger instanceof HTMLAnchorElement
        ) {
          hydratedCookieTrigger.click();
          return;
        }
      }

      footerModule?.openFooter?.();
      /** @type {any} */ (footer)?.open?.();
    } catch (error) {
      log.warn('failed to open lazily hydrated footer', error);
    }
  };

  document.addEventListener('pointerover', handleTriggerIntent, {
    passive: true,
  });
  document.addEventListener('focusin', handleTriggerIntent);
  document.addEventListener('click', handleTriggerClick, true);

  if ('IntersectionObserver' in globalThis) {
    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            void loadFooterStyles();
            void hydrateFooterModule();
          }
        });
      },
      { rootMargin: '600px 0px' },
    );
    observer.observe(siteFooter);
  }

  idleHandle = scheduleIdleTask(
    () => {
      void hydrateFooterModule();
    },
    {
      timeout: FOOTER_IDLE_HYDRATION_TIMEOUT_MS,
      fallbackDelay: FOOTER_IDLE_HYDRATION_TIMEOUT_MS,
    },
  );
};

export function ensureFooterAndTrigger() {
  try {
    const run = () => {
      if (!document.body) return;

      let siteMenu = document.querySelector('site-menu');
      if (!siteMenu) {
        let headerEl = document.querySelector('header.site-header');
        if (!headerEl) {
          headerEl = document.createElement('header');
          headerEl.className = 'site-header';
          document.body.insertBefore(headerEl, document.body.firstChild);
        }

        const oldContainer = document.getElementById('menu-container');
        if (oldContainer) oldContainer.remove();

        siteMenu = document.createElement('site-menu');
        try {
          const params = new URLSearchParams(globalThis.location.search || '');
          if (params.get('menuShadow') === '1') {
            siteMenu.setAttribute('data-shadow-dom', 'true');
          }
        } catch {
          /* ignore */
        }
        /** @type {any} */ (siteMenu).dataset.injectedBy = 'head-inline';
        /** @type {any} */ (siteMenu).dataset.shell = 'true';
        siteMenu.innerHTML = getMenuShellMarkup();
        headerEl.appendChild(siteMenu);
      }

      let siteFooter = document.querySelector('site-footer');
      if (!siteFooter) {
        siteFooter = document.createElement('site-footer');
        /** @type {any} */ (siteFooter).dataset.shell = 'true';
        siteFooter.innerHTML = getFooterShellMarkup();
        document.body.appendChild(siteFooter);
      }

      setupFooterModuleHydration(siteFooter);
    };

    if (document.body) {
      run();
      return;
    }

    const observer = new MutationObserver(() => {
      if (!document.body) return;
      observer.disconnect();
      run();
    });
    observer.observe(document.documentElement, { childList: true });
  } catch (error) {
    log.warn('ensure footer/trigger setup failed', error);
  }
}
