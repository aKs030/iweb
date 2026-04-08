const FOOTER_SHELL_ICON_SPRITE = `
  <svg class="footer-icon-sprite" aria-hidden="true" focusable="false">
    <symbol id="footer-icon-cookie" viewBox="0 0 24 24">
      <path
        d="M21 12.8A9 9 0 1 1 11.2 3a4.8 4.8 0 0 0 5.6 5.6A4.8 4.8 0 0 0 21 12.8Z"
      />
      <circle cx="9" cy="12" r="1" />
      <circle cx="15.5" cy="11" r="1" />
      <circle cx="12.5" cy="15" r="1" />
    </symbol>
    <symbol id="footer-icon-doc-check" viewBox="0 0 24 24">
      <path
        d="M7 3h8l5 5v13a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 21V4.5A1.5 1.5 0 0 1 7 3Z"
      />
      <path d="M15 3v5h5" />
      <path d="m9 15 2 2 4-4" />
    </symbol>
    <symbol id="footer-icon-shield" viewBox="0 0 24 24">
      <path d="M12 22s7-3.5 7-9V6.2L12 3 5 6.2V13c0 5.5 7 9 7 9Z" />
    </symbol>
  </svg>
`;

export const getFooterShellMarkup = () => `
<footer class="site-footer" role="contentinfo">
  ${FOOTER_SHELL_ICON_SPRITE}
  <div class="footer-min">
    <div class="footer-min-main">
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
        <button
          id="cookie-btn"
          class="nav-btn"
          type="button"
          data-cookie-trigger
          aria-label="Cookie-Einstellungen öffnen"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <use href="#footer-icon-cookie"></use>
          </svg>
          <span>Cookies</span>
        </button>
        <a href="/impressum/" class="nav-btn" aria-label="Impressum">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <use href="#footer-icon-doc-check"></use>
          </svg>
          <span>Impressum</span>
        </a>
        <a href="/datenschutz/" class="nav-btn" aria-label="Datenschutz">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <use href="#footer-icon-shield"></use>
          </svg>
          <span>Datenschutz</span>
        </a>
      </nav>
    </div>
    <button
      class="footer-expand-toggle"
      type="button"
      data-footer-trigger
      aria-expanded="false"
      aria-controls="footer-content"
      aria-label="Footer erweitern"
    >
      <span aria-hidden="true">+</span>
      <span class="visually-hidden">Footer erweitern</span>
    </button>
  </div>
</footer>
`;
