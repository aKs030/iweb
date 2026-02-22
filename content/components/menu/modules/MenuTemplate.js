import { i18n } from '../../../core/i18n.js';

let menuTemplateInstanceCounter = 0;

export class MenuTemplate {
  constructor(config = {}) {
    this.config = config;
    this.ids = this.createDomIds();
  }

  createDomIds() {
    menuTemplateInstanceCounter += 1;
    const configuredPrefix = String(this.config?.DOM_ID_PREFIX || '').trim();
    const prefix =
      configuredPrefix || `site-menu-${menuTemplateInstanceCounter}`;

    return {
      navigation: `${prefix}-navigation`,
      title: `${prefix}-title`,
      subtitle: `${prefix}-subtitle`,
      searchInput: `${prefix}-search-input`,
      searchResults: `${prefix}-search-results`,
    };
  }

  getHTML() {
    return `
${this.getSkipLinks()}
${this.getSVGSprite()}
${this.getBrand()}
${this.getNavigation()}
${this.getSearchUI()}
${this.getToggleButton()}
`;
  }

  getSkipLinks() {
    return `
<div class="skip-links">
  <a href="#main-content" class="skip-link" data-i18n="menu.skip_main">${i18n.t('menu.skip_main')}</a>
  <a href="#${this.ids.navigation}" class="skip-link" data-i18n="menu.skip_nav">${i18n.t('menu.skip_nav')}</a>
</div>`;
  }

  getBrand() {
    return `
<div class="site-logo__container">
  <span id="${this.ids.title}" class="site-title"></span>
  <span id="${this.ids.subtitle}" class="site-subtitle"></span>
</div>`;
  }

  getSVGSprite() {
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
    <symbol id="icon-sun" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="5" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="12" y1="1" x2="12" y2="3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <line x1="12" y1="21" x2="12" y2="23" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <line x1="1" y1="12" x2="3" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <line x1="21" y1="12" x2="23" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </symbol>
    <symbol id="icon-moon" viewBox="0 0 24 24">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </symbol>
  </defs>
</svg>`;
  }

  getToggleButton() {
    return `
<button
  type="button"
  class="site-menu__toggle"
  aria-label="${i18n.t('menu.toggle')}"
  data-i18n-aria="menu.toggle"
  aria-controls="${this.ids.navigation}"
  aria-expanded="false"
>
  <div class="hamburger-container">
    <span class="hamburger-line hamburger-line--top"></span>
    <span class="hamburger-line hamburger-line--middle"></span>
    <span class="hamburger-line hamburger-line--bottom"></span>
  </div>
  <div class="menu-ripple" data-collision-ignore></div>
</button>`;
  }

  getNavigation() {
    const menuItems = this.config?.MENU_ITEMS || [];

    const items = menuItems
      .map(
        (item, index) => `
    <li class="menu-nav-item" style="--menu-item-index: ${index}">
      <a href="${item.href}"${item.attrs ? ' ' + item.attrs : ''}>
        <span class="nav-icon-wrapper">
             <svg class="nav-icon" aria-hidden="true">
               <use href="#icon-${item.icon}"></use>
             </svg>
             <span class="icon-fallback icon-fallback--hidden">${item.fallback}</span>
        </span>
        <span data-i18n="${item.label}">${i18n.t(item.label)}</span>
      </a>
    </li>`,
      )
      .join('');

    return `
<nav
  id="${this.ids.navigation}"
  class="site-menu"
  aria-label="${i18n.t('menu.main_nav')}"
  data-i18n-aria="menu.main_nav"
>
  <ul class="site-menu__list">
    ${items}
    <li class="menu-utility-separator" style="--menu-item-index: ${menuItems.length}" aria-hidden="true">
      <span class="menu-utility-separator__line"></span>
    </li>
    <li class="menu-utility-item menu-utility-item--search" style="--menu-item-index: ${menuItems.length + 1}">
      <button
        type="button"
        class="search-trigger"
        aria-label="${i18n.t('menu.search_label')}"
        data-i18n-aria="menu.search_label"
        title="${i18n.t('menu.search_tooltip')}"
        data-i18n-title="menu.search_tooltip"
        aria-expanded="false"
        aria-controls="${this.ids.searchResults}"
      >
        <span class="icon-container">
            <span class="nav-icon ai-orb" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="ai-orb__icon">
                <path d="M12 2C7 2 2 7 2 12C2 17 7 22 12 22C17 22 22 17 22 12C22 7 17 2 12 2ZM12 4C14.5 4 16 6 16 8C16 10 14.5 11.5 12 11.5C9.5 11.5 8 10 8 8C8 6 9.5 4 12 4ZM12 20C9.5 20 8 18 8 16C8 14 9.5 12.5 12 12.5C14.5 12.5 16 14 16 16C16 18 14.5 20 12 20Z" opacity="0.8"></path>
                <path d="M12.0001 2.00004C10.2223 3.77782 10.2223 6.66671 12.0001 8.44449C13.7779 6.66671 16.6667 6.66671 18.4445 8.44449C16.6667 10.2223 16.6667 13.1111 18.4445 14.8889C16.6667 13.1111 13.7779 13.1111 12.0001 14.8889C13.7779 16.6667 13.7779 19.5556 12.0001 21.3334C10.2223 19.5556 7.33341 19.5556 5.55563 21.3334C7.33341 19.5556 7.33341 16.6667 5.55563 14.8889C7.33341 16.6667 10.2223 16.6667 12.0001 14.8889C10.2223 13.1111 10.2223 10.2223 12.0001 8.44449C10.2223 10.2223 7.33341 10.2223 5.55563 8.44449C7.33341 6.66671 7.33341 3.77782 5.55563 2.00004C7.33341 3.77782 10.2223 3.77782 12.0001 2.00004Z" fill="white" fill-opacity="0.2" stroke="white" stroke-width="1.2"></path>
              </svg>
            </span>
        </span>
        <span class="icon-fallback icon-fallback--hidden">🔍</span>
      </button>
    </li>
    <li class="menu-utility-item menu-utility-item--contact" style="--menu-item-index: ${menuItems.length + 2}">
      <button
        type="button"
        class="contact-trigger"
        data-footer-trigger
        aria-expanded="false"
        aria-label="${i18n.t('menu.contact')}"
        data-i18n-aria="menu.contact"
        title="${i18n.t('menu.contact')}"
        data-i18n-title="menu.contact"
      >
        <span class="icon-container">
          <svg class="nav-icon contact-icon" aria-hidden="true">
            <use href="#icon-mail"></use>
          </svg>
        </span>
        <span class="icon-fallback icon-fallback--hidden">✉️</span>
      </button>
    </li>
    <li class="menu-utility-item menu-utility-item--theme" style="--menu-item-index: ${menuItems.length + 3}">
      <button
        type="button"
        class="theme-toggle"
        aria-label="${i18n.t('menu.theme_toggle')}"
        data-i18n-aria="menu.theme_toggle"
        title="${i18n.t('menu.theme_toggle')}"
        data-i18n-title="menu.theme_toggle"
      >
        <svg class="nav-icon theme-icon theme-icon--sun" aria-hidden="true">
          <use href="#icon-sun"></use>
        </svg>
        <svg class="nav-icon theme-icon theme-icon--moon" aria-hidden="true">
          <use href="#icon-moon"></use>
        </svg>
      </button>
    </li>
    <li class="menu-utility-item menu-utility-item--lang" style="--menu-item-index: ${menuItems.length + 4}">
      <button
        type="button"
        class="lang-toggle"
        aria-label="${i18n.t('menu.lang_toggle')}"
        data-i18n-aria="menu.lang_toggle"
        title="${i18n.t('menu.lang_toggle')}"
        data-i18n-title="menu.lang_toggle"
      >
        <svg class="nav-icon" aria-hidden="true">
          <use href="#icon-globe"></use>
        </svg>
        <span class="lang-text">DE</span>
      </button>
    </li>
  </ul>
</nav>`;
  }

  getSearchUI() {
    const isMac =
      typeof navigator !== 'undefined' &&
      /Mac|iPhone|iPad/.test(navigator.userAgent || '');
    const shortcutHint = isMac ? '⌘K' : 'Ctrl+K';

    return `
<div class="menu-search" aria-hidden="true">
  <div class="menu-search__panel">
    <div
      class="menu-search__bar"
      role="combobox"
      aria-expanded="false"
      aria-haspopup="listbox"
      aria-controls="${this.ids.searchResults}"
    >
      <span class="menu-search__icon" aria-hidden="true">
        <svg class="nav-icon"><use href="#icon-search"></use></svg>
      </span>
      <input
        id="${this.ids.searchInput}"
        type="text"
        class="menu-search__input"
        aria-label="${i18n.t('menu.search_input_label')}"
        data-i18n-aria="menu.search_input_label"
        aria-autocomplete="list"
        aria-controls="${this.ids.searchResults}"
        aria-expanded="false"
        role="searchbox"
        placeholder="${i18n.t('menu.search_placeholder')} (${shortcutHint})"
        data-i18n-placeholder="menu.search_placeholder"
        autocomplete="off"
        autocorrect="off"
        autocapitalize="off"
        spellcheck="false"
      />
      <button type="button" class="menu-search__clear" aria-label="Suche leeren" tabindex="-1">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div id="${this.ids.searchResults}" class="menu-search__results" role="listbox" aria-live="polite"></div>
  </div>
</div>`;
  }
}
