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
