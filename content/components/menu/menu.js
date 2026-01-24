/**
 * Menü-System mit dynamischen Titeln
 *
 * Features:
 * - Dynamische Navigation mit Scroll-Detection
 * - Section-header Elemente werden auf Hauptseite ausgeblendet
 * - Responsive Hamburger-Menü
 * - FontAwesome Icons und Google Fonts Integration
 * - Accessibility-optimiert mit ARIA-Attributen
 *
 * OPTIMIZATIONS v2.2.0:
 * - Integration of EVENTS constants
 * - Optimized event listener handling (passive/once)
 * - Improved performance on scroll via RAF
 *
 * @author Abdulkerim Sesli
 * @version 2.2.0
 */

// ===== Shared Utilities Import =====
import {
  createLogger,
  getElementById,
  EVENTS,
  addListener,
} from '/content/utils/shared-utilities.js';
import { upsertHeadLink } from '/content/utils/dom-helpers.js';

const _log = createLogger('menu');
const MENU_CSS_URL = '/content/components/menu/menu.css';

// Load menu styles from the module so subpages don't need a separate link tag
function ensureMenuStyles() {
  if (typeof document === 'undefined') return null;
  const existing = document.head.querySelector(`link[href="${MENU_CSS_URL}"]`);
  if (existing) return existing;
  return upsertHeadLink({
    rel: 'stylesheet',
    href: MENU_CSS_URL,
    attrs: { media: 'all' },
    dataset: { injectedBy: 'menu-js' },
  });
}

ensureMenuStyles();

const initMenu = () => {
  const menuContainer = getElementById('menu-container');
  if (!menuContainer) {
    // Wait for #menu-container to be injected (race with head-inline.js)
    // Use a MutationObserver to retry initialization once the element appears.
    try {
      if (typeof MutationObserver !== 'undefined' && document.body) {
        const observer = new MutationObserver((mutations, obs) => {
          const el = getElementById('menu-container');
          if (el) {
            obs.disconnect();
            // retry initialization now that container exists
            initMenu();
          }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        // safety fallback: stop observing after 3s
        setTimeout(() => observer.disconnect(), 3000);
      }
    } catch {
      /* ignore observer failures */
    }
    return;
  }

  // Prevent double initialization
  if (menuContainer.dataset.initialized === 'true') return;
  menuContainer.dataset.initialized = 'true';

  menuContainer.innerHTML = getMenuHTML();
  _log.info('Menu: injected into #menu-container');

  const yearEl = getElementById('current-year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  initializeMenu(menuContainer);
  initializeLogo(menuContainer);
  initializeSubmenuLinks();
  fixSubpageLinks(menuContainer);
  setSiteTitle();
  setActiveMenuLink();

  // Keep menu active state in sync when hash or history changes
  window.addEventListener('hashchange', setActiveMenuLink);
  window.addEventListener('popstate', setActiveMenuLink);

  const _onMenuDocClick = (event) => {
    const isClickInside = menuContainer.contains(event.target);
    const isMenuToggle = event.target.closest('.site-menu__toggle');
    if (!isClickInside && !isMenuToggle) closeMenu(menuContainer);
  };

  const _removeDocClick = addListener(document, 'click', _onMenuDocClick);

  // Escape-Taste schließt das Menü
  const _onEscapeKey = (event) => {
    if (event.key === 'Escape') {
      closeMenu(menuContainer);
      const menuToggle = menuContainer.querySelector('.site-menu__toggle');
      if (menuToggle) menuToggle.focus();
    }
  };

  const _removeEscapeKey = addListener(document, 'keydown', _onEscapeKey);

  // store remover for potential cleanup
  menuContainer.__listenerRemovers = menuContainer.__listenerRemovers || [];
  menuContainer.__listenerRemovers.push(_removeDocClick, _removeEscapeKey);
};

// Use shared EVENTS.DOM_READY or fallback to DOMContentLoaded
if (document.readyState !== 'loading') {
  initMenu();
} else {
  document.addEventListener('DOMContentLoaded', initMenu, { once: true });
}

function getMenuHTML() {
  return `
<!-- Skip-Links für Accessibility (WCAG 2.1 Level AA) -->
<div class="skip-links">
  <a href="#main-content" class="skip-link">Zum Hauptinhalt springen</a>
  <a href="#navigation" class="skip-link">Zur Navigation springen</a>
</div>

<!-- SVG Icon Sprite für Navigation -->
<svg
  aria-hidden="true"
  style="position: absolute; width: 0; height: 0; overflow: hidden"
  xmlns="http://www.w3.org/2000/svg"
>
  <defs>
    <symbol id="icon-house" viewBox="0 0 576 512">
      <path
        fill="currentColor"
        d="M541 229.16 512 205.26V64a32 32 0 0 0-32-32h-64a32 32 0 0 0-32 32v24.6L314.52 43a35.93 35.93 0 0 0-45 0L35 229.16a16 16 0 0 0-2 22.59l21.4 25.76a16 16 0 0 0 22.59 2L96 264.86V456a32 32 0 0 0 32 32h128V344a16 16 0 0 1 16-16h64a16 16 0 0 1 16 16v144h128a32 32 0 0 0 32-32V264.86l19 14.65a16 16 0 0 0 22.59-2l21.4-25.76a16 16 0 0 0-2-22.59Z"
      />
    </symbol>
    <symbol id="icon-images" viewBox="0 0 576 512">
      <path
        fill="currentColor"
        d="M480 416V80a48 48 0 0 0-48-48H80a48 48 0 0 0-48 48v336H16a16 16 0 0 0 0 32h448a16 16 0 0 0 0-32ZM64 416V80a16 16 0 0 1 16-16h352a16 16 0 0 1 16 16v336Zm96-80 64-80 48 64 64-80 80 96H160Zm48-144a40 40 0 1 1-40-40 40 40 0 0 1 40 40Zm368-96v304a16 16 0 0 1-16 16h-16v-32h16V96H496V64h16a16 16 0 0 1 16 16Z"
      />
    </symbol>
    <symbol id="icon-video" viewBox="0 0 576 512">
      <path
        fill="currentColor"
        d="M336.2 64H47.8C21.4 64 0 85.4 0 111.8v288.4C0 426.6 21.4 448 47.8 448h288.4c26.4 0 47.8-21.4 47.8-47.8V111.8c0-26.4-21.4-47.8-47.8-47.8zm189.4 37.7L416 177.3v157.4l109.6 75.5c21.2 14.6 50.4-.3 50.4-25.8V127.5c0-25.4-29.1-40.4-50.4-25.8z"
      />
    </symbol>
    <symbol id="icon-blog" viewBox="0 0 512 512">
      <path
        fill="currentColor"
        d="M471.6 21.7c-21.9-21.9-57.3-21.9-79.2 0L362.3 51.7l97.9 97.9 30.1-30.1c21.9-21.9 21.9-57.3 0-79.2L471.6 21.7zm-299.2 220c-6.1 6.1-10.8 13.6-13.5 21.9l-29.6 88.8c-2.9 8.6-.6 18.1 5.8 24.6s15.9 8.7 24.6 5.8l88.8-29.6c8.2-2.7 15.7-7.4 21.9-13.5L437.7 172.3 339.7 74.3 172.4 241.7zM96 64C43 64 0 107 0 160V416c0 53 43 96 96 96H352c53 0 96-43 96-96V320c0-17.7-14.3-32-32-32s-32 14.3-32 32v96c0 17.7-14.3 32-32 32H96c-17.7 0-32-14.3-32-32V160c0-17.7 14.3-32 32-32h96c17.7 0 32-14.3 32-32s-14.3-32-32-32H96z"
      />
    </symbol>
    <symbol id="icon-user" viewBox="0 0 448 512">
      <path
        fill="currentColor"
        d="M224 256A128 128 0 1 0 96 128a128 128 0 0 0 128 128Zm89.6 32h-11.7a174.64 174.64 0 0 1-155.8 0h-11.7A134.4 134.4 0 0 0 0 422.4 57.6 57.6 0 0 0 57.6 480h332.8A57.6 57.6 0 0 0 448 422.4 134.4 134.4 0 0 0 313.6 288Z"
      />
    </symbol>
    <symbol id="icon-mail" viewBox="0 0 512 512">
      <path
        fill="currentColor"
        d="M48 64C21.5 64 0 85.5 0 112v288c0 26.5 21.5 48 48 48h416c26.5 0 48-21.5 48-48V112c0-26.5-21.5-48-48-48H48zM48 96h416c8.8 0 16 7.2 16 16v41.4L288 264.4c-11.3 8.5-26.7 8.5-38 0L32 153.4V112c0-8.8 7.2-16 16-16zm0 320v-222l176 132c22.5 16.9 53.5 16.9 76 0l176-132v222c0 8.8-7.2 16-16 16H64c-8.8 0-16-7.2-16-16z"
      />
    </symbol>
    <symbol id="icon-search" viewBox="0 0 512 512">
      <path
        fill="currentColor"
        d="M416 208c0 45.9-14.9 88.3-40 122.7L502.6 457.4c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L330.7 376c-34.4 25.2-76.8 40-122.7 40C93.1 416 0 322.9 0 208S93.1 0 208 0S416 93.1 416 208zM208 352a144 144 0 1 0 0-288 144 144 0 1 0 0 288z"
      />
    </symbol>
  </defs>
</svg>

<a href="/" class="site-logo-link">
  <span class="site-logo__container u-inline-center">
    <span class="site-logo elegant-logo" id="site-title"
      ><span class="visually-hidden">Startseite</span></span
    >
    <span class="site-subtitle" id="site-subtitle"></span>
  </span>
</a>

<button
  type="button"
  class="site-menu__toggle"
  aria-label="Menü"
  aria-controls="navigation"
  aria-expanded="false"
>
  <span class="site-menu__hamburger"></span>
</button>

<nav id="navigation" class="site-menu" aria-label="Hauptnavigation">
  <ul class="site-menu__list">
    <li>
      <a href="/">
        <svg class="nav-icon" aria-hidden="true">
          <use href="#icon-house"></use>
        </svg>
        <span class="icon-fallback" style="display: none">🏠</span>
        <span>Startseite</span>
      </a>
    </li>
    <li>
      <a href="/projekte/">
        <svg class="nav-icon" aria-hidden="true">
          <use href="#icon-images"></use>
        </svg>
        <span class="icon-fallback" style="display: none">🖼️</span>
        <span>Projekte</span>
      </a>
    </li>
    <li>
      <a href="/gallery/">
        <svg class="nav-icon" aria-hidden="true">
          <use href="#icon-images"></use>
        </svg>
        <span class="icon-fallback" style="display: none">📷</span>
        <span>Fotos</span>
      </a>
    </li>
    <li>
      <a href="/videos/">
        <svg class="nav-icon" aria-hidden="true">
          <use href="#icon-video"></use>
        </svg>
        <span class="icon-fallback" style="display: none">🎬</span>
        <span>Videos</span>
      </a>
    </li>
    <li>
      <a href="/blog/">
        <svg class="nav-icon" aria-hidden="true">
          <use href="#icon-blog"></use>
        </svg>
        <span class="icon-fallback" style="display: none">📝</span>
        <span>Blog</span>
      </a>
    </li>
    <li>
      <a href="/about/">
        <svg class="nav-icon" aria-hidden="true">
          <use href="#icon-user"></use>
        </svg>
        <span class="icon-fallback" style="display: none">🧑</span>
        <span>Über mich</span>
      </a>
    </li>
    <li>
      <button
        type="button"
        class="search-trigger"
        aria-label="Suche öffnen"
        title="Suche (⌘K / Ctrl+K)"
      >
        <svg class="nav-icon" aria-hidden="true">
          <use href="#icon-search"></use>
        </svg>
        <span class="icon-fallback" style="display: none">🔍</span>
        <span>Suche</span>
      </button>
    </li>
    <li>
      <a href="#site-footer" data-footer-trigger aria-expanded="false">
        <svg class="nav-icon" aria-hidden="true">
          <use href="#icon-mail"></use>
        </svg>
        <span class="icon-fallback" style="display: none">✉️</span>
        <span>Kontakt</span>
      </a>
    </li>
  </ul>
</nav>
`;
}

function fixSubpageLinks(container) {
  const path = window.location.pathname;
  const isHomePage = path === '/' || path === '/index.html';
  if (!isHomePage) {
    const links = container.querySelectorAll('.site-menu a[href^="#"]');
    links.forEach((link) => {
      const hash = link.getAttribute('href');
      link.setAttribute('href', `/${hash}`);
    });
  }
}

function initializeMenu(container) {
  const menuToggle = container.querySelector('.site-menu__toggle');
  const menu = container.querySelector('.site-menu');

  if (menuToggle && menu) {
    menu.setAttribute('role', 'navigation');
    menuToggle.setAttribute('aria-controls', menu.id || 'navigation');
    menuToggle.setAttribute('aria-expanded', 'false');
    menu.setAttribute('aria-hidden', 'true');

    const setState = (open) => {
      menu.classList.toggle('open', open);
      menuToggle.classList.toggle('active', open);
      menuToggle.setAttribute('aria-expanded', String(!!open));
      menu.setAttribute('aria-hidden', String(!open));
    };

    const toggle = () => setState(!menu.classList.contains('open'));

    const _removeToggleClick = addListener(menuToggle, 'click', toggle);
    const _onMenuToggleKeydown = (event) => {
      if (event.key === 'Enter') toggle();
    };
    const _removeToggleKeydown = addListener(
      menuToggle,
      'keydown',
      _onMenuToggleKeydown,
    );

    // store removers for potential cleanup
    menuToggle.__listenerRemovers = menuToggle.__listenerRemovers || [];
    menuToggle.__listenerRemovers.push(
      _removeToggleClick,
      _removeToggleKeydown,
    );
  }

  // Initialize Search Trigger
  const searchTrigger = container.querySelector('.search-trigger');
  if (searchTrigger) {
    const _onSearchClick = (e) => {
      e.preventDefault();
      closeMenu(container); // Close mobile menu
      // Dynamically import and open search
      import('/content/components/search/search.js')
        .then((module) => {
          if (module.openSearch) {
            module.openSearch();
          }
        })
        .catch((err) => _log.error('Failed to load search:', err));
    };

    const _removeSearchClick = addListener(
      searchTrigger,
      'click',
      _onSearchClick,
    );
    searchTrigger.__listenerRemovers = searchTrigger.__listenerRemovers || [];
    searchTrigger.__listenerRemovers.push(_removeSearchClick);
  }

  // Close the mobile menu when any navigation link is clicked
  container.querySelectorAll('.site-menu a[href]').forEach((a) => {
    const _onNavLinkClick = (e) => {
      // Close the menu on mobile/compact view and delay navigation slightly so the close animation is visible
      const href = a.getAttribute('href');
      const isExternal = /^https?:\/\//i.test(href);
      const isAnchor = href && href.startsWith('#');

      closeMenu(container);

      if (
        window.innerWidth <= 768 &&
        href &&
        !isExternal &&
        !a.hasAttribute('target')
      ) {
        // Prevent default to allow smooth close animation then navigate
        if (!isAnchor) {
          e.preventDefault();
          setTimeout(() => {
            window.location.href = href;
          }, 160);
        }
      }
    };

    const _removeNavClick = addListener(a, 'click', _onNavLinkClick);
    // store ref to allow cleanup later
    a.__listenerRemovers = a.__listenerRemovers || [];
    a.__listenerRemovers.push(_removeNavClick);
  });

  initializeIcons();
}

function initializeIcons() {
  const checkIcons = () => {
    const icons = document.querySelectorAll('.nav-icon use');
    icons.forEach((use) => {
      const href = use.getAttribute('href');
      if (!href) return;
      const targetId = href.substring(1);
      const target = document.getElementById(targetId);
      const svg = use.closest('svg');
      const fallback = svg?.nextElementSibling;
      if (!target && fallback?.classList.contains('icon-fallback')) {
        svg.style.display = 'none';
        fallback.style.display = 'inline-block';
      }
    });
  };

  checkIcons();
  setTimeout(checkIcons, 200);
}

function initializeLogo(container) {
  const logoContainer = container.querySelector('.site-logo__container');
  if (logoContainer) {
    const _onLogoContext = (e) => {
      e.preventDefault?.();
      window.location.href = '/';
    };
    const _removeLogoContext = addListener(
      logoContainer,
      'contextmenu',
      _onLogoContext,
    );
    logoContainer.__listenerRemovers = logoContainer.__listenerRemovers || [];
    logoContainer.__listenerRemovers.push(_removeLogoContext);
  }
}

function initializeSubmenuLinks() {
  const submenuButtons = document.querySelectorAll(
    '.has-submenu > .submenu-toggle',
  );

  submenuButtons.forEach((btn) => {
    const _onSubmenuToggle = () => {
      const submenu = btn.nextElementSibling;
      const open = submenu.style.display === 'block';

      document.querySelectorAll('.submenu').forEach((sm) => {
        if (sm !== submenu) sm.style.display = 'none';
      });
      submenu.style.display = open ? 'none' : 'block';
      btn.setAttribute('aria-expanded', String(!open));
    };

    const _removeToggle = addListener(btn, 'click', _onSubmenuToggle);

    // Keyboard support für Submenu
    const _onSubmenuKeydown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        _onSubmenuToggle();
      } else if (e.key === 'Escape') {
        const submenu = btn.nextElementSibling;
        submenu.style.display = 'none';
        btn.setAttribute('aria-expanded', 'false');
        btn.focus();
      }
    };

    const _removeKeydown = addListener(btn, 'keydown', _onSubmenuKeydown);
    btn.__listenerRemovers = btn.__listenerRemovers || [];
    btn.__listenerRemovers.push(_removeToggle, _removeKeydown);
  });

  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  if (isTouch) {
    document.querySelectorAll('.has-submenu > a').forEach((link) => {
      let tapped = false;
      link.addEventListener(
        'touchend',
        function (e) {
          const parent = link.parentElement;
          if (!parent.classList.contains('open')) {
            e.preventDefault();
            document.querySelectorAll('.has-submenu.open').forEach((el) => {
              if (el !== parent) el.classList.remove('open');
            });
            parent.classList.add('open');
            tapped = true;
            setTimeout(() => {
              tapped = false;
            }, 600);
          } else if (!tapped) {
            tapped = false;
          }
        },
        { passive: false },
      );
    });

    document.addEventListener('touchstart', function (e) {
      if (!e.target.closest('.site-menu')) {
        document
          .querySelectorAll('.has-submenu.open')
          .forEach((el) => el.classList.remove('open'));
      }
    });
  }
}

function closeMenu(container) {
  const menuToggle = container.querySelector('.site-menu__toggle');
  const menu = container.querySelector('.site-menu');
  if (menuToggle && menu) {
    menu.classList.remove('open');
    menuToggle.classList.remove('active');
  }
}

function setSiteTitle() {
  const titleMap = {
    '/index.html': 'Startseite',
    '/': 'Startseite',
    '/gallery/': 'Fotos',
    '/projekte/': 'Projekte',
    '/videos/': 'Videos',
  };

  const path = window.location.pathname;
  const pageTitle = titleMap[path] || document.title || 'Website';

  const siteTitleEl = getElementById('site-title');
  if (siteTitleEl) siteTitleEl.textContent = pageTitle;

  if (path === '/' || path === '/index.html') {
    initializeScrollDetection();
  }
}

function extractSectionInfo(sectionId) {
  const fallbackTitleMap = {
    hero: { title: 'Startseite', subtitle: '' },
    features: { title: 'Projekte', subtitle: 'Meine Arbeiten' },
    section3: { title: 'Über mich', subtitle: 'Lerne mich kennen' },
    contact: { title: 'Kontakt', subtitle: 'Schreiben Sie mir' },
  };

  const section = document.querySelector(`#${sectionId}`);
  if (!section) {
    return fallbackTitleMap[sectionId] || { title: 'Startseite', subtitle: '' };
  }

  if (['hero', 'features', 'section3', 'contact'].includes(sectionId)) {
    const sectionElement = document.querySelector(`#${sectionId}`);
    if (sectionElement) {
      const headers = sectionElement.querySelectorAll(
        '.section-header, .section-subtitle',
      );
      headers.forEach((header) => {
        header.style.display = 'none';
        header.style.visibility = 'hidden';
      });
    }

    return fallbackTitleMap[sectionId] || { title: 'Startseite', subtitle: '' };
  }

  const header = section.querySelector('.section-header');
  if (!header) {
    return fallbackTitleMap[sectionId] || { title: 'Startseite', subtitle: '' };
  }

  const titleEl = header.querySelector('.section-title, h1, h2, h3');
  const subtitleEl = header.querySelector('.section-subtitle');

  const title =
    titleEl?.textContent?.trim() ||
    fallbackTitleMap[sectionId]?.title ||
    'Startseite';
  const subtitle =
    subtitleEl?.textContent?.trim() ||
    fallbackTitleMap[sectionId]?.subtitle ||
    '';

  return { title, subtitle };
}

/**
 * Initialisiert die Scroll-Detection für dynamische Titel-Updates
 * OPTIMIZED: Verwendet Event-Listeners statt Polling und Events Constant
 */
function initializeScrollDetection() {
  let snapEventListener = null;
  let rafId = null;

  function updateTitleAndSubtitle(newTitle, newSubtitle = '') {
    const siteTitleEl = getElementById('site-title');
    const siteSubtitleEl = getElementById('site-subtitle');
    if (!siteTitleEl) return;

    const currentTitle = siteTitleEl.textContent;
    const currentSubtitle = siteSubtitleEl?.textContent || '';
    if (currentTitle === newTitle && currentSubtitle === newSubtitle) return;

    // Cancel any pending animation frame
    if (rafId) cancelAnimationFrame(rafId);

    rafId = requestAnimationFrame(() => {
      siteTitleEl.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
      siteTitleEl.style.opacity = '0.6';
      siteTitleEl.style.transform = 'scale(0.95)';
      if (siteSubtitleEl) {
        siteSubtitleEl.classList.remove('show');
      }

      setTimeout(() => {
        siteTitleEl.textContent = newTitle;
        siteTitleEl.style.opacity = '1';
        siteTitleEl.style.transform = 'scale(1)';

        if (siteSubtitleEl && newSubtitle) {
          siteSubtitleEl.textContent = newSubtitle;
          setTimeout(() => {
            siteSubtitleEl.classList.add('show');
          }, 100);
        }
      }, 200);
    });
  }

  function initSnapEventListener() {
    if (snapEventListener) {
      window.removeEventListener('snapSectionChange', snapEventListener);
    }

    snapEventListener = (event) => {
      const { index, id } = event.detail || {};
      let sectionId = id;

      if (sectionId === 'site-footer') {
        sectionId = 'contact';
      }

      if (!sectionId && typeof index === 'number') {
        const sections = Array.from(
          document.querySelectorAll(
            'main .section, .section, footer#site-footer',
          ),
        );
        const section = sections[index];
        sectionId = section?.id;
        if (sectionId === 'site-footer') {
          sectionId = 'contact';
        }
      }

      if (sectionId) {
        const { title, subtitle } = extractSectionInfo(sectionId);
        updateTitleAndSubtitle(title, subtitle);
      }
    };

    window.addEventListener('snapSectionChange', snapEventListener);
  }

  // Optimized: Wait for modules ready event instead of polling
  const start = () => {
    initSnapEventListener();
    const { title, subtitle } = extractSectionInfo('hero');
    updateTitleAndSubtitle(title, subtitle);
  };

  // Check if already ready
  if (
    document.querySelector('#hero') &&
    document.querySelector('#site-footer')
  ) {
    start();
  } else {
    // Listen for the ready event
    document.addEventListener(EVENTS.MODULES_READY, start, { once: true });
    // Backup listener in case footer loads late
    document.addEventListener('footer:loaded', start, { once: true });
  }
}

function setActiveMenuLink() {
  const path = window.location.pathname.replace(/index\.html$/, '');
  const hash = window.location.hash;

  document.querySelectorAll('.site-menu a[href]').forEach((a) => {
    const href = a.getAttribute('href');
    if (!href) return;

    if (href.startsWith('#')) {
      // Only consider in-page anchors active when we're on the index page (where those sections exist)
      // or when the href matches the current hash exactly.
      const isIndexPath = path === '/' || path === '/index.html' || path === '';
      if (href === hash || (isIndexPath && hash === '' && href === '#hero')) {
        a.classList.add('active');
      } else {
        a.classList.remove('active');
      }

      return;
    }

    const norm = href.replace(/index\.html$/, '');
    const linkPath = norm.split('#')[0];
    const linkHash = a.hash;

    if (norm === path || (linkPath === path && linkHash === hash)) {
      a.classList.add('active');
    } else {
      a.classList.remove('active');
    }
  });
}
