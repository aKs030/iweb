import { createLogger } from '#core/logger.js';
import {
  buildProjectDetailPath,
  extractProjectSlug,
} from '#core/project-paths.js';
import { stripBranding } from '#core/text-utils.js';
import { headState } from './head-state.js';
import {
  getAnalyticsBootstrapState,
  initAnalyticsBootstrap,
} from './analytics-bootstrap.js';
import { ensureFooterAndTrigger } from './footer-hydration.js';
import {
  addLazyLoadingDefaults,
  ensureFontDisplaySwap,
  injectCoreAssets,
  injectHeroCriticalCSS,
} from './core-assets-bootstrap.js';

const log = createLogger('head-inline');

/**
 * Run callback when DOM is ready.
 * @param {() => void} callback
 * @param {{ microtask?: boolean }} [options]
 */
const runWhenDomReady = (callback, options = {}) => {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', callback, { once: true });
    return;
  }
  if (options.microtask) {
    globalThis.queueMicrotask(callback);
    return;
  }
  callback();
};

initAnalyticsBootstrap({ runWhenDomReady });
ensureFooterAndTrigger();
const analyticsState = getAnalyticsBootstrapState();
injectCoreAssets({
  runWhenDomReady,
  hasGtmId: analyticsState.hasGtmId,
  hasGa4MeasurementId: analyticsState.hasGa4MeasurementId,
});
addLazyLoadingDefaults({ runWhenDomReady });
ensureFontDisplaySwap({ runWhenDomReady });

const setEarlyCanonical = () => {
  try {
    const pathname = globalThis.location.pathname || '/';
    const canonicalBase = globalThis.location.href.split('#')[0].split('?')[0];
    const projectSlug = extractProjectSlug(
      pathname,
      globalThis.location.search || '',
    );
    const projectCanonicalPath = projectSlug
      ? buildProjectDetailPath(projectSlug)
      : '';
    const canonicalUrl = projectCanonicalPath
      ? `${globalThis.location.origin}${projectCanonicalPath}`
      : canonicalBase;

    const existing = document.head.querySelector('link[rel="canonical"]');
    if (existing) {
      if (existing.getAttribute('href') !== canonicalUrl) {
        existing.setAttribute('href', canonicalUrl);
      }
      return;
    }

    if (!existing) {
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

injectHeroCriticalCSS();

const hideBrandingFromUsers = () => {
  try {
    const ua = (navigator.userAgent || '').toLowerCase();
    const isBot =
      /(bot|googlebot|bingbot|slurp|duckduckgo|baiduspider|yandex|facebookexternalhit|embedly|twitterbot)/i.test(
        ua,
      );

    // Branding removal is handled centrally via `stripBranding()` in `content/core/text-utils.js`
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

        // Specific override for home page to prevent misidentification
        // Check for root path OR if the title matches the branding typical for the home page
        const p =
          (globalThis.location?.pathname || '').replace(/\/+$/g, '') || '/';
        const isHomeTitle =
          low.includes('portfolio') &&
          (low.includes('abdulkerim') || low.includes('abdul sesli'));

        if (p === '/' || isHomeTitle) return 'Startseite 🏠';

        for (const [key, value] of Object.entries(SHORT_MAP)) {
          if (low.includes(key)) return value;
        }
        return s;
      } catch {
        return s;
      }
    };

    if (!isBot) {
      const cleaned = sanitize(document.title);
      document.title = cleaned;
      const short = makeShortTitle(cleaned);
      if (short) document.title = short;
    }

    try {
      const titleEl = /** @type {any} */ (document.querySelector)('title');
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

    const HEADING_SELECTOR =
      'h1,h2,.section-title,.section-header,.page-title,.site-title';

    const sanitizeHeadingElement = (el) => {
      if (!el?.textContent) return;
      const cleaned = sanitize(el.textContent);
      if (cleaned !== el.textContent) el.textContent = cleaned;
    };

    const sanitizeNodeTree = (node) => {
      if (!node || node.nodeType !== Node.ELEMENT_NODE) return;
      const root = /** @type {Element} */ (node);
      if (root.matches?.(HEADING_SELECTOR)) {
        sanitizeHeadingElement(root);
      }
      root
        .querySelectorAll?.(HEADING_SELECTOR)
        .forEach((el) => sanitizeHeadingElement(el));
    };

    sanitizeNodeTree(document.body || document.documentElement);

    // Debounced full-tree sanitization to prevent infinite loops and CPU spikes
    let pendingSanitize = null;
    const requestSanitize = () => {
      if (pendingSanitize) cancelAnimationFrame(pendingSanitize);
      pendingSanitize = requestAnimationFrame(() => {
        sanitizeNodeTree(document.body || document.documentElement);
        pendingSanitize = null;
      });
    };

    const mo = new MutationObserver((mutations) => {
      let needsSanitize = false;
      for (let i = 0; i < mutations.length; i++) {
        const mutation = mutations[i];

        // Fast path for text changes: only care if parent is a heading
        if (mutation.type === 'characterData') {
          const parent = mutation.target?.parentElement;
          if (parent && parent.matches && parent.matches(HEADING_SELECTOR)) {
            needsSanitize = true;
            break;
          }
        }
        // Fast path for added nodes
        else if (mutation.addedNodes) {
          for (let j = 0; j < mutation.addedNodes.length; j++) {
            const node = /** @type {HTMLElement} */ (mutation.addedNodes[j]);
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Ignore typewriter animation nodes which change ~60 times a second
              if (node.classList && node.classList.contains('typed-line'))
                continue;

              if (node.matches && node.matches(HEADING_SELECTOR)) {
                needsSanitize = true;
                break;
              }
              if (node.querySelector && node.querySelector(HEADING_SELECTOR)) {
                needsSanitize = true;
                break;
              }
            }
          }
        }
        if (needsSanitize) break;
      }

      if (needsSanitize) {
        requestSanitize();
      }
    });
    mo.observe(document.body || document.documentElement, {
      childList: true,
      characterData: true, // Needed for text edits, but carefully filtered above
      subtree: true,
    });
  } catch {
    /* ignore */
  }
};

hideBrandingFromUsers();

function setupThemeObservers() {
  try {
    const root = document.documentElement;

    // Sync browser chrome on data-theme change
    if (typeof MutationObserver === 'function') {
      new MutationObserver(() => {
        const t = root.getAttribute('data-theme') || 'dark';
        const metas = /** @type {any} */ (document.querySelectorAll)(
          'meta[name="theme-color"]',
        );
        for (let i = 0; i < metas.length; i++) {
          const meta = metas[i];
          const content = (meta.getAttribute('content') || '').toLowerCase();
          if (meta.getAttribute('media')) {
            const isLight = content === '#ffffff' || content === '#fff';
            meta.setAttribute(
              'media',
              isLight
                ? t === 'light'
                  ? 'all'
                  : 'not all'
                : t === 'dark'
                  ? 'all'
                  : 'not all',
            );
          }
        }
      }).observe(root, {
        attributes: true,
        attributeFilter: ['data-theme', 'style'],
      });
    }

    const detectIos = () => {
      const ua = navigator.userAgent || navigator.vendor || '';
      return (
        /iphone|ipad|ipod/i.test(ua) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
      );
    };

    const syncDisplayMode = () => {
      let mode = 'browser';
      const modes = ['fullscreen', 'standalone', 'minimal-ui'];
      if (window.matchMedia) {
        for (let i = 0; i < modes.length; i++) {
          if (window.matchMedia(`(display-mode: ${modes[i]})`).matches) {
            mode = modes[i];
            break;
          }
        }
      } else if (/** @type {any} */ (navigator).standalone) {
        mode = 'standalone';
      }

      root.setAttribute('data-display-mode', mode);
      root.setAttribute(
        'data-standalone',
        mode !== 'browser' ? 'true' : 'false',
      );

      if (detectIos()) {
        root.setAttribute('data-platform', 'ios');
      } else {
        root.removeAttribute('data-platform');
      }
    };

    if (window.matchMedia) {
      ['fullscreen', 'standalone', 'minimal-ui'].forEach((mode) => {
        const mq = window.matchMedia(`(display-mode: ${mode})`);
        if (typeof mq.addEventListener === 'function') {
          mq.addEventListener('change', syncDisplayMode);
        }
      });
    }

    window.addEventListener('pageshow', syncDisplayMode, { passive: true });
    syncDisplayMode();
  } catch {
    // Ignore errors
  }
}

setupThemeObservers();

// Signal that head-inline is ready
headState.setInlineReady();

import('#components/head/head-manager.js').catch((err) => {
  log.error('[head-inline] Failed to load head-manager.js:', err);
});
