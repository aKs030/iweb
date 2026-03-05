/**
 * Edge Side Includes (ESI) - Shell Injector
 *
 * Injects the global Header (Site Menu) and Footer directly into
 * the HTML stream at the edge. The client-side logic in
 * `footer-hydration.js` detects these and skips client-side rendering.
 *
 * @version 1.0.0
 */

const getMenuShellMarkup = (shadowDom = false) => `
<header class="site-header">
  <site-menu data-injected-by="edge-middleware" data-shell="true" ${shadowDom ? 'data-shadow-dom="true"' : ''}>
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
    <button type="button" class="site-menu__toggle" aria-label="Menü" aria-expanded="false">
      <div class="hamburger-container">
        <span class="hamburger-line hamburger-line--top"></span>
        <span class="hamburger-line hamburger-line--middle"></span>
        <span class="hamburger-line hamburger-line--bottom"></span>
      </div>
    </button>
  </site-menu>
</header>
`;

const getFooterShellMarkup = () => `
<site-footer src="/content/components/footer/footer" data-shell="true" data-injected-by="edge-middleware">
  <footer class="site-footer" role="contentinfo">
    <div class="footer-min" aria-expanded="false" aria-controls="footer-content">
      <span class="footer-copyright">
        © ${new Date().getFullYear()}
        <a href="/" class="brand-link" aria-label="Zur Startseite">Abdulkerim Sesli</a>
      </span>
      <div id="cookie-banner" class="cookie-inline" role="dialog" aria-label="Cookie-Einstellungen">
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
</site-footer>
`;

/**
 * Handles injecting the header right after the skip-link.
 */
export class HeaderInjector {
  constructor(url) {
    // Some routes (e.g. ?menuShadow=1) need shadow dom marker
    let shadowDom = false;
    try {
      if (url.searchParams.get('menuShadow') === '1') {
        shadowDom = true;
      }
    } catch {
      /* ignore */
    }
    this.markup = getMenuShellMarkup(shadowDom);
    this.injected = false;
  }

  element(el) {
    if (this.injected) return;
    this.injected = true;
    el.after(this.markup, { html: true });
  }
}

/**
 * Handles injecting the footer right before </body>.
 * (If element matches body, we append it inside the body at the end).
 */
export class FooterInjector {
  constructor() {
    this.markup = getFooterShellMarkup();
  }

  element(el) {
    el.append(this.markup, { html: true });
  }
}
