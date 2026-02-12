import { i18n } from '../../../core/i18n.js';

export class MenuTemplate {
  constructor(config = {}) {
    this.config = config;
  }

  getHTML() {
    return `
${this.getSkipLinks()}
${this.getSVGSprite()}
${this.getBrand()}
${this.getNavigation()}
${this.getToggleButton()}
`;
  }

  getSkipLinks() {
    return `
<div class="skip-links">
  <a href="#main-content" class="skip-link">${i18n.t('menu.skip_main')}</a>
  <a href="#navigation" class="skip-link">${i18n.t('menu.skip_nav')}</a>
</div>`;
  }

  getBrand() {
    return `
<div class="site-logo__container">
  <span class="site-subtitle">Abdulkerim</span>
</div>`;
  }

  getSVGSprite() {
    // Keeping existing SVG definitions but ensuring they are complete
    return `
<svg aria-hidden="true" style="position: absolute; width: 0; height: 0; overflow: hidden" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <symbol id="icon-house" viewBox="0 0 576 512">
      <path fill="currentColor" d="M541 229.16 512 205.26V64a32 32 0 0 0-32-32h-64a32 32 0 0 0-32 32v24.6L314.52 43a35.93 35.93 0 0 0-45 0L35 229.16a16 16 0 0 0-2 22.59l21.4 25.76a16 16 0 0 0 22.59 2L96 264.86V456a32 32 0 0 0 32 32h128V344a16 16 0 0 1 16-16h64a16 16 0 0 1 16 16v144h128a32 32 0 0 0 32-32V264.86l19 14.65a16 16 0 0 0 22.59-2l21.4-25.76a16 16 0 0 0-2-22.59Z"/>
    </symbol>
    <symbol id="icon-projects" viewBox="0 0 512 512">
      <path fill="currentColor" d="M184 48H328c4.4 0 8 3.6 8 8V96H176V56c0-4.4 3.6-8 8-8zm-56 8V96H64C28.7 96 0 124.7 0 160V416c0 35.3 28.7 64 64 64H448c35.3 0 64-28.7 64-64V160c0-35.3-28.7-64-64-64H384V56c0-30.9-25.1-56-56-56H184c-30.9 0-56 25.1-56 56zM64 160H448V416H64V160zm64 80v32H256V240H128zm0 80v32H384V320H128z"/>
    </symbol>
    <symbol id="icon-gallery" viewBox="0 0 512 512">
      <path fill="currentColor" d="M149.1 64.8L138.7 96H64C28.7 96 0 124.7 0 160V416c0 35.3 28.7 64 64 64H448c35.3 0 64-28.7 64-64V160c0-35.3-28.7-64-64-64H373.3L362.9 64.8C356.4 45.2 338.1 32 317.4 32H194.6c-20.7 0-39 13.2-45.5 32.8zM256 192a96 96 0 1 1 0 192 96 96 0 1 1 0-192z"/>
    </symbol>
    <symbol id="icon-video" viewBox="0 0 576 512">
      <path fill="currentColor" d="M336.2 64H47.8C21.4 64 0 85.4 0 111.8v288.4C0 426.6 21.4 448 47.8 448h288.4c26.4 0 47.8-21.4 47.8-47.8V111.8c0-26.4-21.4-47.8-47.8-47.8zm189.4 37.7L416 177.3v157.4l109.6 75.5c21.2 14.6 50.4-.3 50.4-25.8V127.5c0-25.4-29.1-40.4-50.4-25.8z"/>
    </symbol>
    <symbol id="icon-blog" viewBox="0 0 512 512">
      <path fill="currentColor" d="M471.6 21.7c-21.9-21.9-57.3-21.9-79.2 0L362.3 51.7l97.9 97.9 30.1-30.1c21.9-21.9 21.9-57.3 0-79.2L471.6 21.7zm-299.2 220c-6.1 6.1-10.8 13.6-13.5 21.9l-29.6 88.8c-2.9 8.6-.6 18.1 5.8 24.6s15.9 8.7 24.6 5.8l88.8-29.6c8.2-2.7 15.7-7.4 21.9-13.5L437.7 172.3 339.7 74.3 172.4 241.7zM96 64C43 64 0 107 0 160V416c0 53 43 96 96 96H352c53 0 96-43 96-96V320c0-17.7-14.3-32-32-32s-32 14.3-32 32v96c0 17.7-14.3 32-32 32H96c-17.7 0-32-14.3-32-32V160c0-17.7 14.3-32 32-32h96c17.7 0 32-14.3 32-32s-14.3-32-32-32H96z"/>
    </symbol>
    <symbol id="icon-user" viewBox="0 0 448 512">
      <path fill="currentColor" d="M224 256A128 128 0 1 0 96 128a128 128 0 0 0 128 128Zm89.6 32h-11.7a174.64 174.64 0 0 1-155.8 0h-11.7A134.4 134.4 0 0 0 0 422.4 57.6 57.6 0 0 0 57.6 480h332.8A57.6 57.6 0 0 0 448 422.4 134.4 134.4 0 0 0 313.6 288Z"/>
    </symbol>
    <symbol id="icon-mail" viewBox="0 0 512 512">
      <path fill="currentColor" d="M48 64C21.5 64 0 85.5 0 112v288c0 26.5 21.5 48 48 48h416c26.5 0 48-21.5 48-48V112c0-26.5-21.5-48-48-48H48zM48 96h416c8.8 0 16 7.2 16 16v41.4L288 264.4c-11.3 8.5-26.7 8.5-38 0L32 153.4V112c0-8.8 7.2-16 16-16zm0 320v-222l176 132c22.5 16.9 53.5 16.9 76 0l176-132v222c0 8.8-7.2 16-16 16H64c-8.8 0-16-7.2-16-16z"/>
    </symbol>
    <symbol id="icon-search" viewBox="0 0 24 24">
      <circle cx="11" cy="11" r="8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="m21 21-4.35-4.35" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </symbol>
    <symbol id="icon-globe" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="2" y1="12" x2="22" y2="12" stroke="currentColor" stroke-width="2"/>
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" fill="none" stroke="currentColor" stroke-width="2"/>
    </symbol>
  </defs>
</svg>`;
  }


  getToggleButton() {
    return `
<button type="button" class="site-menu__toggle" aria-label="${i18n.t('menu.toggle')}" aria-controls="navigation" aria-expanded="false">
  <div class="hamburger-container">
    <span class="hamburger-line hamburger-line--top"></span>
    <span class="hamburger-line hamburger-line--middle"></span>
    <span class="hamburger-line hamburger-line--bottom"></span>
  </div>
  <div class="menu-ripple"></div>
</button>`;
  }

  getNavigation() {
    // Generate menu items dynamically from config
    const menuItems = this.config?.MENU_ITEMS || [];

    const items = menuItems
      .map(
        (item) => `
    <li>
      <a href="${item.href}"${item.attrs ? ' ' + item.attrs : ''}>
        <span class="nav-icon-wrapper">
             <svg class="nav-icon" aria-hidden="true">
               <use href="#icon-${item.icon}"></use>
             </svg>
             <span class="icon-fallback" style="display: none">${item.fallback}</span>
        </span>
        <span data-i18n="${item.label}">${i18n.t(item.label)}</span>
      </a>
    </li>`,
      )
      .join('');

    return `
<nav id="navigation" class="site-menu" aria-label="${i18n.t('menu.main_nav')}">
  <ul class="site-menu__list">
    ${items}
    <li>
      <button type="button" class="search-trigger" aria-label="${i18n.t('menu.search_label')}" title="${i18n.t('menu.search_tooltip')}">
        <svg class="nav-icon" aria-hidden="true">
          <use href="#icon-search"></use>
        </svg>
        <span class="icon-fallback" style="display: none">🔍</span>
      </button>
    </li>
    <li>
      <button type="button" class="lang-toggle" aria-label="${i18n.t('menu.lang_toggle')}" title="DE / EN">
        <svg class="nav-icon" aria-hidden="true">
          <use href="#icon-globe"></use>
        </svg>
        <span class="lang-text" style="font-weight: 600; font-size: 0.9em; margin-left: 4px;">DE</span>
      </button>
    </li>
  </ul>
</nav>`;
  }
}
