import { whenFooterReady } from '../../core/footer-state.js';
import { cancelIdleTask, scheduleIdleTask } from '../../core/idle.js';
import { createLogger } from '../../core/logger.js';
import { resourceHints } from '../../core/resource-hints.js';
import { upsertHeadLink } from '../../core/utils.js';

const log = createLogger('head-footer');

const FOOTER_MODULE_HREF = '/content/components/footer/footer.js';
const FOOTER_TRIGGER_SELECTOR = '[data-footer-trigger], a[href="#footer"]';
const FOOTER_IDLE_HYDRATION_TIMEOUT_MS = 4000;

let footerModulePromise = null;
let footerHydrationAttached = false;

const getMenuShellMarkup = () => `
<div class="site-logo__container">
  <span class="site-title">Abdulkerim Sesli</span>
  <span class="site-subtitle show">Portfolio</span>
</div>
<nav class="site-menu" aria-label="Hauptnavigation">
  <ul class="site-menu__list">
    <li><a href="/">Startseite</a></li>
    <li><a href="/projekte/">Projekte</a></li>
    <li><a href="/gallery/">Fotos</a></li>
    <li><a href="/videos/">Videos</a></li>
    <li><a href="/blog/">Blog</a></li>
    <li><a href="/about/">Über mich</a></li>
  </ul>
</nav>
<button
  type="button"
  class="site-menu__toggle"
  aria-label="Menü"
  aria-expanded="false"
>
  <div class="hamburger-container">
    <span class="hamburger-line hamburger-line--top"></span>
    <span class="hamburger-line hamburger-line--middle"></span>
    <span class="hamburger-line hamburger-line--bottom"></span>
  </div>
</button>
`;

const getFooterShellMarkup = () => `
<footer class="site-footer" role="contentinfo">
  <div class="footer-min" aria-expanded="false" aria-controls="footer-content">
    <span class="footer-copyright">
      © ${new Date().getFullYear()}
      <a href="/" class="brand-link" aria-label="Zur Startseite">Abdulkerim Sesli</a>
    </span>
    <div
      id="cookie-banner"
      class="cookie-inline"
      role="dialog"
      aria-label="Cookie-Einstellungen"
    >
      <span class="cookie-text">
        <span class="full">Wir nutzen Analytics</span>
      </span>
      <button id="accept-cookies" class="btn-accept" type="button">
        <span class="full">Akzeptieren</span>
        <span class="short">✓</span>
      </button>
      <button id="reject-cookies" class="btn-reject" type="button">
        <span class="full">Ablehnen</span>
        <span class="short">✗</span>
      </button>
    </div>
    <nav class="footer-nav" aria-label="Footer Navigation">
      <a href="/impressum/" class="nav-btn">Impressum</a>
      <a href="/datenschutz/" class="nav-btn">Datenschutz</a>
    </nav>
  </div>
</footer>
`;

const getFooterTrigger = (target) => {
  if (!(target instanceof Element)) return null;
  return target.closest(FOOTER_TRIGGER_SELECTOR);
};

const preloadFooterModule = () => {
  resourceHints.modulePreload(FOOTER_MODULE_HREF);
};

const loadFooterModule = async () => {
  if (customElements.get('site-footer')) return null;
  if (footerModulePromise) return footerModulePromise;

  preloadFooterModule();
  footerModulePromise = import('#components/footer/footer.js').catch(
    (error) => {
      footerModulePromise = null;
      log.warn('failed to load footer module', error);
      return null;
    },
  );

  return footerModulePromise;
};

const waitForFooterReady = () =>
  new Promise((resolve) => {
    const footer = document.querySelector('site-footer');
    if (
      footer &&
      typeof (/** @type {any} */ (footer).open) === 'function' &&
      footer.querySelector('footer.site-footer')
    ) {
      resolve(footer);
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
    cleanup();
    await loadFooterModule();
  };

  const handleTriggerIntent = (event) => {
    if (!getFooterTrigger(event.target)) return;
    preloadFooterModule();
  };

  const handleTriggerClick = async (event) => {
    if (customElements.get('site-footer')) return;
    const trigger = getFooterTrigger(event.target);
    if (!trigger) return;

    event.preventDefault();

    const footerModule = await loadFooterModule();
    const footer = await waitForFooterReady();

    try {
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
        siteMenu.dataset.injectedBy = 'head-inline';
        siteMenu.dataset.shell = 'true';
        siteMenu.innerHTML = getMenuShellMarkup();
        headerEl.appendChild(siteMenu);
      }

      let siteFooter = document.querySelector('site-footer');
      if (!siteFooter) {
        upsertHeadLink({
          rel: 'stylesheet',
          href: '/content/components/footer/footer.css',
          dataset: { injectedBy: 'head-inline' },
        });

        siteFooter = document.createElement('site-footer');
        siteFooter.setAttribute('src', '/content/components/footer/footer');
        siteFooter.dataset.shell = 'true';
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
