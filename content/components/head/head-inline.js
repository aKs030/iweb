import { createLogger } from '/content/core/shared-utilities.js';
import { upsertHeadLink } from '/content/core/dom-helpers.js';

const log = createLogger('head-inline');

import { SITE_CONFIG } from '../../config/site-config.js';

const detectHostConfig = (host) => {
  const h = (host || globalThis?.location?.hostname || '').toLowerCase();
  const cfg = SITE_CONFIG || {};
  if (!h) return cfg.default || {};
  if (cfg[h]) return cfg[h];
  const stripped = h.replace(/^www\./, '');
  if (cfg[stripped]) return cfg[stripped];
  return cfg.default || {};
};

const { gtm: GTM_ID, ga4: GA4_MEASUREMENT_ID } = detectHostConfig();

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

(function () {
  try {
    const originalPush = dataLayer.push.bind(dataLayer);
    dataLayer.push = function () {
      try {
        for (let i = 0; i < arguments.length; i++) {
          const arg = arguments[i];
          if (
            arg &&
            typeof arg === 'object' &&
            arg.event === 'consentGranted'
          ) {
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
        }
      } catch {
        /* ignore */
      }
      return originalPush.apply(null, arguments);
    };
  } catch {
    /* ignore */
  }
})();
gtag('js', Date.now());

const hostCfg = detectHostConfig();
const ADS_CONVERSION_ID = hostCfg?.aw ?? null;
const ADS_CONVERSION_LABEL = hostCfg?.aw_label ?? null;
dataLayer.push({
  gtm_autoconfig: true,
  ads_conversion_id: ADS_CONVERSION_ID,
  ads_conversion_label: ADS_CONVERSION_LABEL,
  ga4_measurement_id: GA4_MEASUREMENT_ID,
  gtm_id: GTM_ID,
});

(function injectGA4Fallback() {
  try {
    if (!GA4_MEASUREMENT_ID || GA4_MEASUREMENT_ID.indexOf('G-') !== 0) return;
    if (GTM_ID && GTM_ID !== 'GTM-PLACEHOLDER') {
      log?.info?.(
        'GTM present — configure GA4 inside GTM instead of direct gtag load',
      );
      return;
    }

    // Load gtag.js if not already present
    if (
      !document.querySelector(`script[src*="gtag/js?id=${GA4_MEASUREMENT_ID}"]`)
    ) {
      const s = document.createElement('script');
      s.async = true;
      s.src =
        'https://www.googletagmanager.com/gtag/js?id=' + GA4_MEASUREMENT_ID;
      document.head.appendChild(s);
    }

    // Add font-display: swap to Google Fonts for instant text rendering
    const fontLinks = document.querySelectorAll(
      'link[href*="fonts.googleapis.com"]',
    );
    fontLinks.forEach((link) => {
      if (!link.href.includes('display=swap')) {
        link.href += (link.href.includes('?') ? '&' : '?') + 'display=swap';
      }
    });

    gtag('config', GA4_MEASUREMENT_ID);
  } catch (err) {
    log?.warn?.('head-inline: GA4 fallback failed', err);
  }
})();

// 1b) Google Tag Manager loader (recommended): inject gtm.js if GTM_ID is set.
//     Create a GTM Container at tagmanager.google.com and add your GA4 and other tags there.
(function injectGTM() {
  try {
    if (!GTM_ID || GTM_ID === 'GTM-PLACEHOLDER') {
      log?.info?.(
        'GTM not configured — set GTM_ID in content/config/site-config.js to enable',
      );
      return;
    }

    (function (w, d, s, l, i) {
      w[l] = w[l] || [];
      w[l].push({ 'gtm.start': Date.now(), event: 'gtm.js' });
      const f = d.getElementsByTagName(s)[0];
      const j = d.createElement(s);
      j.async = true;
      j.src = 'https://www.googletagmanager.com/gtm.js?id=' + i + '&l=' + l;
      f.parentNode.insertBefore(j, f);
    })(globalThis, document, 'script', 'dataLayer', GTM_ID);
  } catch (err) {
    log?.warn?.('head-inline: GTM injection failed', err);
  }
})();

// Ensure GTM noscript iframe is placed immediately after the opening <body> for non-JS environments
(function ensureGTMNoScript() {
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
})();

// 2) ensureTrigger helper: inject a footer trigger zone if missing
(function ensureFooterAndTrigger() {
  try {
    const run = function () {
      // Ensure menu container exists in a header - create header if missing
      let menuContainer = document.getElementById('menu-container');
      if (!menuContainer) {
        let headerEl = document.querySelector('header.site-header');
        if (!headerEl) {
          headerEl = document.createElement('header');
          headerEl.className = 'site-header';
          // Insert at top of body for consistent layout
          document.body.insertBefore(headerEl, document.body.firstChild);
        }
        menuContainer = document.createElement('div');
        menuContainer.id = 'menu-container';
        menuContainer.dataset.injectedBy = 'head-inline';
        headerEl.appendChild(menuContainer);
      }

      // If both footer trigger and container already present, nothing else to do
      if (
        document.getElementById('footer-trigger-zone') &&
        document.getElementById('footer-container')
      )
        return;

      // Ensure footer container exists so FooterLoader can attach
      let footerContainer = document.getElementById('footer-container');
      if (!footerContainer) {
        footerContainer = document.createElement('div');
        footerContainer.id = 'footer-container';
        footerContainer.dataset.footerSrc = '/content/components/footer/footer';
        // Not hidden: the loaded footer will control visibility
        footerContainer.setAttribute('aria-hidden', 'false');
        document.body.appendChild(footerContainer);
      }

      // Ensure trigger exists and is placed immediately before the footer container
      if (!document.getElementById('footer-trigger-zone')) {
        const trigger = document.createElement('div');
        trigger.id = 'footer-trigger-zone';
        trigger.className = 'footer-trigger-zone';

        // Make the trigger non-interactive but detectable by IntersectionObserver
        trigger.setAttribute('aria-hidden', 'true');
        trigger.setAttribute('role', 'presentation');
        trigger.style.pointerEvents = 'none';
        // Slightly larger minHeight to make intersection detection more robust on first scroll
        trigger.style.minHeight = '96px';
        trigger.style.width = '100%';

        // Default thresholds (can be overridden per page by setting data attributes)
        // Small numbers increase sensitivity so even the smallest scroll can trigger the footer on desktop
        // Further reduce thresholds to improve first-scroll reliability in headless/CI and real browsers
        trigger.dataset.expandThreshold =
          trigger.dataset.expandThreshold || '0.002';
        trigger.dataset.collapseThreshold =
          trigger.dataset.collapseThreshold || '0.0008';

        // Default lock and debounce (ms) — can be overridden per-page using data attributes
        // Keep desktop more forgiving by default
        trigger.dataset.expandLockMs = trigger.dataset.expandLockMs || '1000';
        trigger.dataset.collapseDebounceMs =
          trigger.dataset.collapseDebounceMs || '250';

        if (footerContainer?.parentNode) {
          footerContainer.parentNode.insertBefore(trigger, footerContainer);
        } else {
          document.body.appendChild(trigger);
        }
      }

      // Ensure the footer module is loaded (dynamic import) so it can initialize the injected container
      try {
        if (!globalThis.__footerModuleLoaded) {
          globalThis.__footerModuleLoaded = true;
          import('/content/components/footer/FooterApp.js')
            .then((m) => {
              if (typeof m.initFooter === 'function') m.initFooter();
            })
            .catch((err) =>
              log?.warn?.('head-inline: import footer module failed', err),
            );
        }
      } catch {
        /* ignore */
      }
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', run, { once: true });
    } else {
      // If DOMContentLoaded already fired, run immediately
      setTimeout(run, 0);
    }
  } catch (err) {
    log?.warn?.('head-inline: ensure footer/trigger setup failed', err);
  }
})();

// --- 3) Asset helper: non-blocking injection of core CSS/JS used across pages
(function injectCoreAssets() {
  try {
    const getStylesForPath = () => {
      const p =
        (globalThis.location?.pathname || '').replace(/\/+$/g, '') || '/';
      // Base styles always useful
      const base = ['/content/styles/root.css', '/content/styles/main.css'];
      // Page-specific additions (only for root to avoid extra blocking on subpages)
      if (p === '/') {
        return base.concat([
          '/pages/home/hero.css',
          '/content/components/typewriter/typewriter.css',
          '/content/components/particles/three-earth.css',
          '/pages/home/section3.css',
        ]);
      }
      return base;
    };

    const SCRIPTS = [
      { src: '/content/main.js', module: true, preload: false },
      { src: '/content/components/menu/menu.js', module: true },
    ];

    // Defer non-critical assets (loaded after idle to reduce blocking during LCP)
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
          // Existing deferred assets (loaded everywhere)
          upsertScript({
            src: '/content/components/robot-companion/robot-companion.js',
            module: true,
          });
        });
      } catch (err) {
        log?.warn?.('head-inline: deferNonCriticalAssets failed', err);
      }
    };

    const upsertPreconnect = (origin) => {
      try {
        upsertHeadLink({
          rel: 'preconnect',
          href: origin,
          crossOrigin: 'anonymous',
          dataset: { injectedBy: 'head-inline' },
        });
      } catch {
        /* ignore preconnect errors */
      }
    };

    const upsertStyle = (href, { critical = false } = {}) => {
      if (document.head.querySelector(`link[href="${href}"]`)) return;

      // Critical styles must be inserted as stylesheet synchronously
      if (critical) {
        upsertHeadLink({
          rel: 'stylesheet',
          href,
          dataset: { injectedBy: 'head-inline' },
        });
        return;
      }

      // Use preload/as=style then switch to stylesheet onload to avoid render-blocking
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

      // Add a small safety timeout to ensure stylesheet eventually applies in older browsers
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
      }, 3000);
    };

    const upsertModulePreload = (href) => {
      upsertHeadLink({
        rel: 'modulepreload',
        href,
        crossOrigin: 'anonymous',
        dataset: { injectedBy: 'head-inline' },
      });
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
      // Hint to connect to important third-party origins early (only when needed)
      const hasGtm = GTM_ID && GTM_ID !== 'GTM-PLACEHOLDER';
      if (hasGtm) {
        upsertPreconnect('https://www.googletagmanager.com');
        upsertPreconnect('https://static.cloudflareinsights.com');
      }
      // gtag fallback only when GA4 fallback is used; harmless otherwise but keep conditional
      if (GA4_MEASUREMENT_ID && GA4_MEASUREMENT_ID.indexOf('G-') === 0) {
        upsertPreconnect('https://www.gstatic.com');
      }

      // Insert styles (use critical flag only when strictly needed)
      const styles = getStylesForPath();
      const p =
        (globalThis.location?.pathname || '').replace(/\/+$/g, '') || '/';

      const criticalStyles = new Set([
        '/content/styles/root.css',
        '/content/styles/main.css',
      ]);
      const homeCritical = new Set([
        '/pages/home/hero.css',
        '/content/components/typewriter/typewriter.css',
        '/content/components/particles/three-earth.css',
        '/pages/home/section3.css',
      ]);

      styles.forEach((href) => {
        const isCritical =
          criticalStyles.has(href) || (p === '/' && homeCritical.has(href));
        upsertStyle(href, { critical: isCritical });
      });

      // Preload module scripts we want parsed early (main app bundle)
      SCRIPTS.filter((s) => s.preload).forEach((s) =>
        upsertModulePreload(s.src),
      );

      // Insert scripts (module scripts can be fetched/parsed in parallel when preloaded)
      SCRIPTS.forEach(upsertScript);

      // Schedule deferring of non-critical assets after core injection
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
})();

// === Progressive image defaults: lazy-load and async decode for content images ===
(function addLazyLoadingDefaults() {
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
})();

// === Ensure Google Fonts use display=swap globally (improves text rendering) ===
(function ensureFontDisplaySwap() {
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
})();

// === Early Canonical Link injection (SEO-critical: set before bots parse)
(function setEarlyCanonical() {
  try {
    // Set a basic canonical immediately to avoid SEO gaps before head-complete.js runs
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
})();

// === Inject minimal critical CSS for the Hero on the Startseite
(function injectHeroCriticalCSS() {
  try {
    const path =
      (globalThis.location?.pathname || '').replace(/\/+$|^$/, '') || '/';
    // Only inline on the root path to avoid extra payload on subpages
    if (path !== '/') return;
    if (document.head.querySelector('#hero-critical-css')) return;

    const css = `
  /***** Critical Hero CSS (inlined, minimal) *****/
  .hero{display:flex;align-items:center;justify-content:center;min-height:100dvh;padding:0 .5rem;box-sizing:border-box}
  .hero-title{font:800 clamp(3rem,6vw,4.5rem)/1.03 var(--font-inter);margin:0;padding:8px 12px;max-width:30ch;color:var(--color-text-main,#fff);text-align:center;white-space:normal}
  `;

    const s = document.createElement('style');
    s.id = 'hero-critical-css';
    s.dataset.injectedBy = 'head-inline';
    s.appendChild(document.createTextNode(css));
    document.head.appendChild(s);
  } catch (err) {
    log?.warn?.('head-inline: injectHeroCriticalCSS failed', err);
  }
})();

// === Hide branding (site name) from human users (keep it in server-rendered <title> for SEO/bots)
(function hideBrandingFromUsers() {
  try {
    const ua = (navigator.userAgent || '').toLowerCase();
    const isBot =
      /(bot|googlebot|bingbot|slurp|duckduckgo|baiduspider|yandex|facebookexternalhit|embedly|twitterbot)/i.test(
        ua,
      );

    const BRAND_REGEX =
      /\s*(?:[—–-]\s*Abdulkerim Sesli|\|\s*Abdulkerim Sesli|Abdulkerim\s*—\s*Digital Creator Portfolio)\s*$/i;
    const sanitize = (s) =>
      String(s || '')
        .replace(BRAND_REGEX, '')
        .trim();

    // Small page→emoji mapping for concise tab titles
    const SHORT_MAP = {
      videos: 'Videos 🎬',
      video: 'Videos 🎬',
      projekte: 'Projekte 💼',
      projekt: 'Projekte 💼',
      blog: 'Blog ✍️',
      start: 'Startseite 🏠',
      startseite: 'Startseite 🏠',
      kontakt: 'Kontakt ✉️',
      impressum: 'Impressum ℹ️',
      datenschutz: 'Datenschutz 🔒',
      home: 'Startseite 🏠',
    };

    const makeShortTitle = (s) => {
      try {
        if (!s) return '';
        const low = s.toLowerCase();
        // prefer exact/contains matches from mapping
        for (const k of Object.keys(SHORT_MAP)) {
          if (low.includes(k)) return SHORT_MAP[k];
        }
        // fallback: first word with globe emoji
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

    // Sanitize existing title immediately (if not bot)
    if (!isBot) {
      const cleaned = sanitize(document.title);
      document.title = cleaned;
      // Also set a short tab-friendly title (one word + emoji)
      const short = makeShortTitle(cleaned);
      if (short) document.title = short;
    }

    // Observe <title> changes and sanitize for humans; also map to short tab title
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

    // Sanitize visible headings on page and watch for added nodes
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

    // Watch for DOM additions and sanitize newly inserted headings
    const mo = new MutationObserver((mutations) => {
      let changed = false;
      for (const m of mutations) {
        if (m.addedNodes?.length) {
          changed = true;
          break;
        }
      }
      if (changed) sanitizeHeadings();
    });
    mo.observe(document.documentElement || document.body, {
      childList: true,
      subtree: true,
    });
  } catch {
    // ignore errors in hideBrandingFromUsers
  }
})();

// === Signal that head-inline.js initialization is complete
// This flag prevents race conditions with head-complete.js
globalThis.__HEAD_INLINE_READY = true;

// === Load head-complete.js dynamically after head-inline is ready
// This ensures head-complete.js never starts before head-inline.js is finished
// preventing the "timeout waiting for head-inline" warning
import('/content/components/head/head-complete.js').catch((err) => {
  log.error('[head-inline] Failed to load head-complete.js:', err);
});
