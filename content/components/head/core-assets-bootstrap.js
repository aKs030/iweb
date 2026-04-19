import { scheduleIdleTask } from '#core/async-utils.js';
import { applyCspNonce } from '#core/csp-nonce.js';
import { upsertHeadLink } from '#core/dom-utils.js';
import { createLogger } from '#core/logger.js';
import { resourceHints } from '#core/resource-hints.js';
import { EARTH_CRITICAL_TEXTURE_URL } from '#components/particles/earth/texture-paths.js';

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
  applyCspNonce(script);
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
    href: EARTH_CRITICAL_TEXTURE_URL,
    as: 'image',
    dataset: { injectedBy: 'head-inline', lcp: 'hero-earth' },
  });
}

function getStylesForPath() {
  const pageSpecific = [];

  if (getNormalizedPathname() === '/') {
    pageSpecific.push(
      '/pages/home/hero.css',
      '/pages/home/features.css',
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
        resourceHints.dnsPrefetch('https://www.googletagmanager.com');
        resourceHints.dnsPrefetch('https://static.cloudflareinsights.com');
      }
      if (hasGa4MeasurementId) {
        resourceHints.dnsPrefetch('https://www.gstatic.com');
      }

      getStylesForPath().forEach((href) => {
        upsertStyle(href);
      });

      injectHomeLcpHints();
      upsertScript({
        src: '/content/components/menu/index.js',
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
          /** @type {any} */ (img).dataset?.lcp === 'true';
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
            const el = /** @type {HTMLLinkElement} */ (link);
            if (!el.href.includes('display=swap')) {
              el.href += (el.href.includes('?') ? '&' : '?') + 'display=swap';
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

    // Check if already exists (from global-head.html inline style)
    if (document.head.querySelector('#hero-critical-inline')) {
      return; // Already inlined in global-head.html
    }

    // Fallback: inject if not found (shouldn't happen in production)
    if (document.head.querySelector('#hero-critical-css')) return;

    const css = `
  .hero{display:flex;align-items:flex-end;justify-content:flex-start;min-height:var(--viewport-height,100dvh);padding:clamp(5rem,10vw,7rem) clamp(1.25rem,4vw,3rem) clamp(4rem,8vw,6rem);box-sizing:border-box}
  .hero__title{font:700 clamp(3rem,8vw,7rem)/.93 'Space Grotesk',var(--font-inter);margin:0;max-width:11ch;color:var(--color-text-main,#fff);text-align:left;letter-spacing:-.05em}
  `;

    const style = document.createElement('style');
    style.id = 'hero-critical-css';
    style.dataset.injectedBy = 'head-inline';
    applyCspNonce(style);
    style.appendChild(document.createTextNode(css));
    document.head.appendChild(style);
  } catch (error) {
    log.warn('injectHeroCriticalCSS failed', error);
  }
}
