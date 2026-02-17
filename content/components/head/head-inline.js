import { createLogger } from '../../core/logger.js';
import { upsertHeadLink } from '../../core/utils.js';
import { ENV } from '../../config/env.config.js';
import { resourceHints } from '../../core/resource-hints.js';
import { stripBranding } from '../../core/utils.js';
import { headState } from './head-state.js';

const log = createLogger('head-inline');

const GTM_ID = ENV.GTM_ID;
const GA4_MEASUREMENT_ID = ENV.GA4_ID;
const ADS_CONVERSION_ID = ENV.AW_ID;
const ADS_CONVERSION_LABEL = ENV.AW_LABEL;

const dataLayer = (globalThis.dataLayer = globalThis.dataLayer || []);
function gtag() {
  dataLayer.push(arguments);
}

try {
  gtag('consent', 'default', {
    ad_storage: 'denied',
    analytics_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  });
} catch {
  /* ignore */
}

const setupDataLayerProxy = () => {
  try {
    const originalPush = dataLayer.push.bind(dataLayer);
    dataLayer.push = (...args) => {
      try {
        args.forEach((arg) => {
          if (arg?.event === 'consentGranted') {
            try {
              gtag('consent', 'update', {
                ad_storage: 'granted',
                analytics_storage: 'granted',
                ad_user_data: 'granted',
                ad_personalization: 'granted',
              });
            } catch {
              /* ignore */
            }
          }
        });
      } catch {
        /* ignore */
      }
      return originalPush(...args);
    };
  } catch {
    /* ignore */
  }
};

setupDataLayerProxy();

gtag('js', Date.now());

dataLayer.push({
  gtm_autoconfig: true,
  ads_conversion_id: ADS_CONVERSION_ID,
  ads_conversion_label: ADS_CONVERSION_LABEL,
  ga4_measurement_id: GA4_MEASUREMENT_ID,
  gtm_id: GTM_ID,
});

const injectGA4Fallback = () => {
  try {
    if (!GA4_MEASUREMENT_ID || GA4_MEASUREMENT_ID.indexOf('G-') !== 0) return;
    if (GTM_ID && GTM_ID !== 'GTM-PLACEHOLDER') {
      log?.info?.(
        'GTM present — configure GA4 inside GTM instead of direct gtag load',
      );
      return;
    }

    if (
      !document.querySelector(`script[src*="gtag/js?id=${GA4_MEASUREMENT_ID}"]`)
    ) {
      const s = document.createElement('script');
      s.async = true;
      s.src =
        'https://www.googletagmanager.com/gtag/js?id=' + GA4_MEASUREMENT_ID;
      document.head.appendChild(s);
    }

    gtag('config', GA4_MEASUREMENT_ID);
  } catch (err) {
    log?.warn?.('head-inline: GA4 fallback failed', err);
  }
};

injectGA4Fallback();

const injectGTM = () => {
  try {
    if (!GTM_ID || GTM_ID === 'GTM-PLACEHOLDER') {
      log?.info?.(
        'GTM not configured — set GTM_ID in content/config/site-config.js to enable',
      );
      return;
    }

    globalThis.dataLayer = globalThis.dataLayer || [];
    globalThis.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });

    const firstScript = document.getElementsByTagName('script')[0];
    const gtmScript = document.createElement('script');
    gtmScript.async = true;
    gtmScript.src = `https://www.googletagmanager.com/gtm.js?id=${GTM_ID}&l=dataLayer`;
    firstScript.parentNode.insertBefore(gtmScript, firstScript);
  } catch (err) {
    log?.warn?.('head-inline: GTM injection failed', err);
  }
};

injectGTM();

const ensureGTMNoScript = () => {
  try {
    if (!GTM_ID || GTM_ID === 'GTM-PLACEHOLDER') return;
    const insert = () => {
      try {
        if (document.getElementById('gtm-noscript')) return;
        const ns = document.createElement('noscript');
        ns.id = 'gtm-noscript';
        ns.innerHTML = `<iframe title="Google Tag Manager (noscript)" src="https://www.googletagmanager.com/ns.html?id=${GTM_ID}" height="0" width="0" style="display:none;visibility:hidden"></iframe>`;
        if (document.body?.firstChild) {
          document.body.insertBefore(ns, document.body.firstChild);
        } else if (document.body) {
          document.body.appendChild(ns);
        }
      } catch (err) {
        log?.warn?.('head-inline: insert noscript failed', err);
      }
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', insert, { once: true });
    } else {
      insert();
    }
  } catch (err) {
    log?.warn?.('head-inline: GTM noscript setup failed', err);
  }
};

ensureGTMNoScript();

const ensureFooterAndTrigger = () => {
  try {
    const run = () => {
      // Ensure <site-menu> exists
      let siteMenu = document.querySelector('site-menu');
      if (!siteMenu) {
        let headerEl = document.querySelector('header.site-header');
        if (!headerEl) {
          headerEl = document.createElement('header');
          headerEl.className = 'site-header';
          document.body.insertBefore(headerEl, document.body.firstChild);
        }

        // Remove old container if present
        const oldContainer = document.getElementById('menu-container');
        if (oldContainer) oldContainer.remove();

        siteMenu = document.createElement('site-menu');
        siteMenu.dataset.injectedBy = 'head-inline';
        headerEl.appendChild(siteMenu);
      }

      // Ensure <site-footer> exists
      let siteFooter = document.querySelector('site-footer');
      if (!siteFooter) {
        // Check for old container to upgrade
        const oldContainer = document.getElementById('footer-container');
        if (oldContainer) {
          oldContainer.remove();
        }

        siteFooter = document.createElement('site-footer');
        siteFooter.setAttribute('id', 'site-footer-component');
        document.body.appendChild(siteFooter);
      }

      // Component definitions werden durch SCRIPTS array geladen - nicht hier doppelt
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', run, { once: true });
    } else {
      globalThis.queueMicrotask(run);
    }
  } catch (err) {
    log?.warn?.('head-inline: ensure footer/trigger setup failed', err);
  }
};

ensureFooterAndTrigger();

const injectCoreAssets = () => {
  try {
    const getStylesForPath = () => {
      const p =
        (globalThis.location?.pathname || '').replace(/\/+$/g, '') || '/';

      // Critical styles (root.css, main.css, animations.css) are in base-head.html template
      // Only return page-specific styles here
      const pageSpecific = [];

      if (p === '/') {
        pageSpecific.push(
          '/pages/home/hero.css',
          '/content/components/typewriter/typewriter.css',
          '/pages/home/section3.css',
          '/pages/home/section4.css',
        );
      }

      return pageSpecific;
    };

    const SCRIPTS = [
      { src: '/content/components/menu/SiteMenu.js', module: true },
      { src: '/content/components/footer/SiteFooter.js', module: true },
    ];

    const deferNonCriticalAssets = () => {
      try {
        const schedule = (cb) => {
          if (globalThis.requestIdleCallback) {
            requestIdleCallback(cb, { timeout: 2000 });
          } else {
            setTimeout(cb, 1500);
          }
        };

        schedule(() => {
          upsertScript({
            src: '/content/components/robot-companion/robot-companion.js',
            module: true,
          });
        });
      } catch (err) {
        log?.warn?.('head-inline: deferNonCriticalAssets failed', err);
      }
    };

    const upsertStyle = (href) => {
      if (document.head.querySelector(`link[href="${href}"]`)) return;

      // Load page-specific styles via preload for better performance
      upsertHeadLink({
        rel: 'preload',
        href,
        as: 'style',
        dataset: { injectedBy: 'head-inline' },
        onload() {
          try {
            this.onload = null;
            this.rel = 'stylesheet';
          } catch {
            /* ignore */
          }
        },
      });

      // Fallback
      setTimeout(() => {
        try {
          const existing = document.head.querySelector(`link[href="${href}"]`);
          if (!existing || existing.rel === 'preload') {
            upsertHeadLink({
              rel: 'stylesheet',
              href,
              dataset: { injectedBy: 'head-inline' },
            });
          }
        } catch {
          /* ignore */
        }
      }, 2000);
    };

    const upsertScript = ({ src, module }) => {
      if (!document.head.querySelector(`script[src="${src}"]`)) {
        const s = document.createElement('script');
        s.src = src;
        if (module) {
          s.type = 'module';
          s.crossOrigin = 'anonymous';
        } else s.defer = true;
        s.dataset.injectedBy = 'head-inline';
        document.head.appendChild(s);
      }
    };

    const performInjection = () => {
      const hasGtm = GTM_ID && GTM_ID !== 'GTM-PLACEHOLDER';
      if (hasGtm) {
        resourceHints.preconnect('https://www.googletagmanager.com');
        resourceHints.preconnect('https://static.cloudflareinsights.com');
      }
      if (GA4_MEASUREMENT_ID && GA4_MEASUREMENT_ID.indexOf('G-') === 0) {
        resourceHints.preconnect('https://www.gstatic.com');
      }

      // Preconnect to CDNs for analytics (dns-prefetch already in base-head.html)
      resourceHints.preconnect('https://cdn.jsdelivr.net');
      resourceHints.preconnect('https://esm.sh');

      const styles = getStylesForPath();

      // Inject page-specific styles only
      styles.forEach((href) => {
        upsertStyle(href);
      });

      // Batch inject scripts
      SCRIPTS.forEach(upsertScript);

      try {
        deferNonCriticalAssets();
      } catch (err) {
        log?.warn?.('head-inline: deferNonCriticalAssets call failed', err);
      }
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', performInjection, {
        once: true,
      });
    } else {
      performInjection();
    }
  } catch (err) {
    log?.warn?.('head-inline: injectCoreAssets failed', err);
  }
};

injectCoreAssets();

const addLazyLoadingDefaults = () => {
  try {
    const apply = () => {
      document
        .querySelectorAll('img:not([loading])')
        .forEach((img) => img.setAttribute('loading', 'lazy'));
      document
        .querySelectorAll('img:not([decoding])')
        .forEach((img) => img.setAttribute('decoding', 'async'));
      document
        .querySelectorAll('iframe:not([loading])')
        .forEach((ifr) => ifr.setAttribute('loading', 'lazy'));
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', apply, { once: true });
    } else {
      apply();
    }
  } catch (err) {
    log?.warn?.('head-inline: addLazyLoadingDefaults failed', err);
  }
};

addLazyLoadingDefaults();

const ensureFontDisplaySwap = () => {
  try {
    const update = () => {
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
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', update, { once: true });
    } else {
      update();
    }
  } catch (err) {
    log?.warn?.('head-inline: ensureFontDisplaySwap failed', err);
  }
};

ensureFontDisplaySwap();

const setEarlyCanonical = () => {
  try {
    const canonicalUrl = globalThis.location.href.split('#')[0].split('?')[0];
    if (!document.head.querySelector('link[rel="canonical"]')) {
      const link = document.createElement('link');
      link.rel = 'canonical';
      link.href = canonicalUrl;
      link.dataset.injectedBy = 'head-inline';
      link.dataset.early = 'true';
      document.head.appendChild(link);
    }
  } catch (err) {
    log?.warn?.('head-inline: setEarlyCanonical failed', err);
  }
};

setEarlyCanonical();

const injectHeroCriticalCSS = () => {
  try {
    const path =
      (globalThis.location?.pathname || '').replace(/\/+$|^$/, '') || '/';
    if (path !== '/') return;
    if (document.head.querySelector('#hero-critical-css')) return;

    const css = `
  .hero{display:flex;align-items:center;justify-content:center;min-height:100dvh;padding:0 .5rem;box-sizing:border-box}
  .hero__title{font:800 clamp(3rem,6vw,4.5rem)/1.03 var(--font-inter);margin:0;padding:8px 12px;max-width:30ch;color:var(--color-text-main,#fff);text-align:center;white-space:normal}
  `;

    const s = document.createElement('style');
    s.id = 'hero-critical-css';
    s.dataset.injectedBy = 'head-inline';
    s.appendChild(document.createTextNode(css));
    document.head.appendChild(s);
  } catch (err) {
    log?.warn?.('head-inline: injectHeroCriticalCSS failed', err);
  }
};

injectHeroCriticalCSS();

const hideBrandingFromUsers = () => {
  try {
    const ua = (navigator.userAgent || '').toLowerCase();
    const isBot =
      /(bot|googlebot|bingbot|slurp|duckduckgo|baiduspider|yandex|facebookexternalhit|embedly|twitterbot)/i.test(
        ua,
      );

    // Branding removal is handled centrally via `stripBranding()` in `content/core/utils.js`
    const sanitize = (s) => stripBranding(s);

    const SHORT_MAP = {
      videos: 'Videos 🎬',
      video: 'Videos 🎬',
      projekte: 'Projekte 💼',
      projekt: 'Projekte 💼',
      blog: 'Blog ✍️',
      start: 'Startseite 🏠',
      startseite: 'Startseite 🏠',
      'über mich': 'Über mich 👤',
      'ueber mich': 'Über mich 👤',
      profil: 'Über mich 👤',
      about: 'Über mich 👤',
      kontakt: 'Kontakt ✉️',
      impressum: 'Impressum ℹ️',
      datenschutz: 'Datenschutz 🔒',
      home: 'Startseite 🏠',
    };

    const makeShortTitle = (s) => {
      try {
        if (!s) return '';
        const low = s.toLowerCase();
        for (const [key, value] of Object.entries(SHORT_MAP)) {
          if (low.includes(key)) return value;
        }
        const first =
          String(s)
            .split(/[—–\-|:]/)[0]
            .trim()
            .split(/\s+/)[0] || '';
        if (!first) return '';
        return first.charAt(0).toUpperCase() + first.slice(1) + ' 🌐';
      } catch {
        return '';
      }
    };

    if (!isBot) {
      const cleaned = sanitize(document.title);
      document.title = cleaned;
      const short = makeShortTitle(cleaned);
      if (short) document.title = short;
    }

    try {
      const titleEl = document.querySelector('title');
      if (titleEl && !isBot) {
        new MutationObserver(() => {
          const t = document.title;
          const s = sanitize(t);
          const short = makeShortTitle(s);
          const newTitle = short || s;
          if (newTitle !== t) document.title = newTitle;
        }).observe(titleEl, {
          childList: true,
          characterData: true,
          subtree: true,
        });
      }
    } catch {
      // ignore errors in title observer
    }

    const sanitizeHeadings = () => {
      document
        .querySelectorAll(
          'h1,h2,.section-title,.section-header,.page-title,.site-title',
        )
        .forEach((el) => {
          if (!el?.textContent) return;
          const cleaned = sanitize(el.textContent);
          if (cleaned !== el.textContent) el.textContent = cleaned;
        });
    };

    sanitizeHeadings();

    let sanitizeTimeout = null;
    const mo = new MutationObserver((mutations) => {
      let changed = false;
      for (const m of mutations) {
        if (m.addedNodes?.length) {
          changed = true;
          break;
        }
      }
      if (changed) {
        clearTimeout(sanitizeTimeout);
        sanitizeTimeout = setTimeout(sanitizeHeadings, 150);
      }
    });
    mo.observe(document.documentElement || document.body, {
      childList: true,
      subtree: true,
    });
  } catch {
    /* ignore */
  }
};

hideBrandingFromUsers();

// Signal that head-inline is ready
headState.setInlineReady();

import('/content/components/head/head-manager.js').catch((err) => {
  log.error('[head-inline] Failed to load head-manager.js:', err);
});
