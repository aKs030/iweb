/**
 * Shared HTML Shells for Edge-Side Includes (ESI) and Client Fallback
 *
 * This file contains the raw HTML strings used to construct the
 * initial paint (FCP) structural shells for the Site Menu and Footer.
 * It is consumed both by Cloudflare Workers (Edge Middleware) and
 * the client-side hydration logic to ensure perfect consistency.
 *
 * @version 1.0.0
 */

export const getMenuShellMarkup = () => `
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

export const getFooterShellMarkup = () => `
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
