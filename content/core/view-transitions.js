/**
 * View Transitions API - Progressive Enhancement
 * Provides smooth cross-fade transitions between page navigations.
 * Only activates in browsers that support `document.startViewTransition`.
 *
 * @version 1.0.0
 * @date 2026-02-20
 */

const SAME_ORIGIN = location.origin;

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

    // Update browser history
    history.pushState(null, pageData.title, url);
  } catch (err) {
    // Fallback: regular navigation
    console.warn(
      '[ViewTransitions] Fallback to regular navigation:',
      err.message,
    );
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

    // Only intercept same-origin, non-hash, non-download links
    if (url.origin !== SAME_ORIGIN) return;
    if (url.pathname === location.pathname && url.hash) return;

    // If the link points exactly to the current page (ignoring hashes), scroll to top instead of re-fetching
    if (url.pathname === location.pathname && url.search === location.search) {
      if (!url.hash) {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      return;
    }

    if (link.hasAttribute('download')) return;
    if (link.target === '_blank') return;
    if (e.ctrlKey || e.metaKey || e.shiftKey) return;

    // Skip gallery, projekte, blog, videos pages (they have their own SPA routing)
    const skipPaths = [
      '/gallery',
      '/projekte',
      '/videos',
      '/blog',
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

  // Handle back/forward navigation safely
  window.addEventListener('popstate', () => {
    // A soft popstate replacement breaks dynamic scripts (e.g. section loaders and specific page scripts).
    // The safest approach is to force a full reload on back/forward to ensure all scripts and styles re-initialize correctly.
    location.reload();
  });
}
