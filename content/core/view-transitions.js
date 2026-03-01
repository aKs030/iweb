/**
 * View Transitions API - Progressive Enhancement
 * Provides smooth cross-fade transitions between page navigations.
 * Only activates in browsers that support `document.startViewTransition`.
 *
 * @version 1.1.0
 */

import { handleSamePageScroll } from './utils.js';
import { createLogger } from './logger.js';

const log = createLogger('ViewTransitions');

const SAME_ORIGIN = location.origin;

// Internes Flag: wurde die aktuelle History-Entry von uns per pushState gesetzt?
// Wichtig weil pushState(null, ...) immer state=null setzt — wir brauchen
// einen eigenen Mechanismus um "VT-navigierte" Einträge zu erkennen.
const vtManagedPaths = new Set();

/**
 * Check if the View Transitions API is supported
 */
const isSupported = () => typeof document.startViewTransition === 'function';

/**
 * Fetch a page and extract its <main> content + title
 * @param {string} url
 * @returns {Promise<{title: string, mainHtml: string, bodyClass: string}>}
 */
async function fetchPage(url) {
  const res = await fetch(url, { headers: { 'X-View-Transition': '1' } });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);

  const html = await res.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const main = doc.querySelector('#main-content') || doc.querySelector('main');
  const title = doc.querySelector('title')?.textContent || document.title;
  const bodyClass = doc.body.className || '';

  return { title, mainHtml: main?.innerHTML || '', bodyClass };
}

/**
 * Apply fetched page content to the current document
 */
function applyPage(url, { title, mainHtml, bodyClass }) {
  const main =
    document.querySelector('#main-content') || document.querySelector('main');
  if (main) main.innerHTML = mainHtml;

  document.title = title;
  if (bodyClass) document.body.className = bodyClass;

  // Update canonical URL
  const canonical = document.querySelector('link[rel="canonical"]');
  if (canonical) canonical.href = url;

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'instant' });

  // Notify other subsystems that the page content changed (e.g. theme manager)
  try {
    window.dispatchEvent(new CustomEvent('page:changed', { detail: { url } }));
  } catch {
    // ignore
  }

  // Safety: ensure a transparent theme-color meta exists after SPA swaps
  try {
    if (!document.querySelector('meta[name="theme-color"]')) {
      const meta = document.createElement('meta');
      meta.setAttribute('name', 'theme-color');
      meta.id = 'meta-theme-color-fallback';
      meta.setAttribute('content', '#00000000');
      document.head.appendChild(meta);
    }
  } catch {
    // ignore
  }
}

/**
 * Navigate to a URL with View Transition
 * @param {string} url
 */
async function navigateWithTransition(url) {
  try {
    const pageData = await fetchPage(url);

    if (isSupported()) {
      const transition = document.startViewTransition(() => {
        applyPage(url, pageData);
      });
      await transition.finished;
    } else {
      applyPage(url, pageData);
    }

    // Pfad als VT-verwaltet markieren, BEVOR pushState aufgerufen wird
    vtManagedPaths.add(new URL(url, SAME_ORIGIN).pathname);

    // Update browser history
    history.pushState(null, pageData.title, url);
  } catch (err) {
    // Fallback: regular navigation
    log.warn('Fallback to regular navigation:', err.message);
    location.href = url;
  }
}

/**
 * Initialize View Transitions
 */
export function initViewTransitions() {
  if (!isSupported()) return;

  // Intercept same-origin link clicks
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href]');
    if (!link) return;

    const url = new URL(link.href, SAME_ORIGIN);

    // Only intercept same-origin links
    if (url.origin !== SAME_ORIGIN) return;

    // Gleiche Seite: ggf. sanftes Scroll-to-top
    if (handleSamePageScroll(url.href)) {
      e.preventDefault();
      return;
    }

    // Reine Hash-URLs nicht abfangen (Anchor-Sprünge auf gleicher Seite)
    if (url.pathname === location.pathname && url.hash) return;

    if (link.hasAttribute('download')) return;
    if (link.target === '_blank') return;
    if (e.ctrlKey || e.metaKey || e.shiftKey) return;

    // Seiten mit eigenem SPA-Routing überspringen
    const skipPaths = [
      '/gallery',
      '/projekte',
      '/videos',
      '/blog',
      '/contact',
      '/about',
      '/datenschutz',
      '/impressum',
      '/abdul-sesli',
    ];
    if (skipPaths.some((p) => url.pathname.startsWith(p))) return;
    if (skipPaths.some((p) => location.pathname.startsWith(p))) return;

    e.preventDefault();
    navigateWithTransition(url.href);
  });

  // Back/Forward-Navigation:
  // Nur dann reloaden, wenn der Ziel-Pfad NICHT von uns per VT-Navigation
  // verwaltet wird. So werden Hash-Wechsel und unbekannte popstate-Events
  // nicht fälschlicherweise in einen Reload umgewandelt.
  window.addEventListener('popstate', () => {
    const targetPath = location.pathname;

    // Hash-Only-Änderungen auf der gleichen Seite: kein Reload
    if (location.hash && targetPath === location.pathname) return;

    // Wenn der Zielpfad ein VT-verwalteter Pfad ist, führen wir einen
    // vollständigen Reload durch, damit Scripts und Styles korrekt neu
    // initialisiert werden (SPA-State ist nach Back/Forward nicht zuverlässig).
    location.reload();
  });
}
