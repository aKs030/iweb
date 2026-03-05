import { scheduleIdleTask } from '../../core/idle.js';
import { createLogger } from '../../core/logger.js';
import { resourceHints } from '../../core/resource-hints.js';
import { upsertHeadLink } from '../../core/utils.js';

const log = createLogger('head-assets');

function getNormalizedPathname() {
  return (globalThis.location?.pathname || '').replace(/\/+$/g, '') || '/';
}

function upsertScript({ src, module }) {
  if (document.head.querySelector(`script[src="${src}"]`)) return;

  const script = document.createElement('script');
  script.src = src;
  if (module) {
    script.type = 'module';
    script.crossOrigin = 'anonymous';
  } else {
    script.defer = true;
  }
  script.dataset.injectedBy = 'head-inline';
  document.head.appendChild(script);
}

function upsertStyle(href) {
  if (document.head.querySelector(`link[href="${href}"]`)) return;

  upsertHeadLink({
    rel: 'stylesheet',
    href,
    dataset: { injectedBy: 'head-inline' },
  });
}

function injectHomeLcpHints() {
  if (getNormalizedPathname() !== '/') return;

  upsertHeadLink({
    rel: 'prefetch',
    href: '/content/assets/img/earth/textures/earth_day.webp',
    as: 'image',
    dataset: { injectedBy: 'head-inline', lcp: 'hero-earth' },
  });
}

function getStylesForPath() {
  const pageSpecific = [];

  if (getNormalizedPathname() === '/') {
    pageSpecific.push(
      '/pages/home/hero.css',
      '/content/components/typewriter/typewriter.css',
      '/pages/home/section3.css',
    );
  }

  return pageSpecific;
}

function deferNonCriticalAssets() {
  try {
    scheduleIdleTask(
      () => {
        upsertScript({
          src: '/content/components/robot-companion/robot-companion.js',
          module: true,
        });
      },
      {
        timeout: 2000,
        fallbackDelay: 1500,
      },
    );
  } catch (error) {
    log.warn('deferNonCriticalAssets failed', error);
  }
}

export function injectCoreAssets({
  runWhenDomReady,
  hasGtmId = false,
  hasGa4MeasurementId = false,
}) {
  try {
    runWhenDomReady(() => {
      if (hasGtmId) {
        resourceHints.preconnect('https://www.googletagmanager.com');
        resourceHints.preconnect('https://static.cloudflareinsights.com');
      }
      if (hasGa4MeasurementId) {
        resourceHints.preconnect('https://www.gstatic.com');
      }

      getStylesForPath().forEach((href) => {
        upsertStyle(href);
      });

      injectHomeLcpHints();
      upsertScript({
        src: '/content/components/menu/SiteMenu.js',
        module: true,
      });
      deferNonCriticalAssets();
    });
  } catch (error) {
    log.warn('injectCoreAssets failed', error);
  }
}

export function addLazyLoadingDefaults({ runWhenDomReady }) {
  try {
    runWhenDomReady(() => {
      document.querySelectorAll('img:not([loading])').forEach((img) => {
        const isLcpCandidate =
          img.getAttribute('fetchpriority') === 'high' ||
          img.dataset?.lcp === 'true';
        img.setAttribute('loading', isLcpCandidate ? 'eager' : 'lazy');
      });

      document
        .querySelectorAll('img:not([decoding])')
        .forEach((img) => img.setAttribute('decoding', 'async'));
      document
        .querySelectorAll('iframe:not([loading])')
        .forEach((iframe) => iframe.setAttribute('loading', 'lazy'));
    });
  } catch (error) {
    log.warn('addLazyLoadingDefaults failed', error);
  }
}

export function ensureFontDisplaySwap({ runWhenDomReady }) {
  try {
    runWhenDomReady(() => {
      document
        .querySelectorAll('link[href*="fonts.googleapis.com"]')
        .forEach((link) => {
          try {
            if (!link.href.includes('display=swap')) {
              link.href +=
                (link.href.includes('?') ? '&' : '?') + 'display=swap';
            }
          } catch {
            /* ignore */
          }
        });
    });
  } catch (error) {
    log.warn('ensureFontDisplaySwap failed', error);
  }
}

export function injectHeroCriticalCSS() {
  try {
    if (getNormalizedPathname() !== '/') return;
    if (document.head.querySelector('#hero-critical-css')) return;

    const css = `
  .hero{display:flex;align-items:center;justify-content:center;min-height:var(--viewport-height,100dvh);padding:0 .5rem;box-sizing:border-box}
  .hero__title{font:800 clamp(3rem,6vw,4.5rem)/1.03 var(--font-inter);margin:0;padding:8px 12px;max-width:30ch;color:var(--color-text-main,#fff);text-align:center;white-space:normal}
  `;

    const style = document.createElement('style');
    style.id = 'hero-critical-css';
    style.dataset.injectedBy = 'head-inline';
    style.appendChild(document.createTextNode(css));
    document.head.appendChild(style);
  } catch (error) {
    log.warn('injectHeroCriticalCSS failed', error);
  }
}
