import { createLogger } from '../utils/logger.js';
const logMenu = createLogger('menu');

document.addEventListener('DOMContentLoaded', () => {
  const menuContainer = document.getElementById('menu-container');
  const yearEl = document.getElementById('current-year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Footer: kein Remote-Fetch, um 404s zu vermeiden; optional minimaler Fallback
  const footerPlaceholder = document.getElementById('footer-placeholder');
  if (footerPlaceholder) {
    // Wenn du eine Footer-Datei hast, bitte Pfad hier eintragen und Fetch reaktivieren.
    // footerPlaceholder.innerHTML = '<footer class="footer">&copy; <span id="current-year"></span> Abdulkerim Sesli</footer>';
  }

  // Menü laden
  if (!menuContainer) {
    logMenu.error('Fehler: menuContainer wurde nicht gefunden.');
    return;
  }
  fetch('/content/webentwicklung/menu/menu.html')
    .then(response => {
      if (!response.ok) throw new Error(`HTTP-Error! Status: ${response.status}`);
      return response.text();
    })
    .then(menuMarkup => {
      menuContainer.innerHTML = menuMarkup;
      initializeMenu(menuContainer);
      initializeLogo(menuContainer);
      initializeSubmenuLinks();
      setSiteTitle();
      document.addEventListener('click', (event) => {
        const isClickInside = menuContainer.contains(event.target);
        const isMenuToggle = event.target.closest('.site-menu__toggle');
        if (!isClickInside && !isMenuToggle) closeMenu(menuContainer);
      });
    })
    .catch(err => {
      logMenu.error('Fehler beim Laden des Menüs:', err.message);
    });
});

/**
 * Initialisiert die Menü-Toggle-Logik
 * @param {HTMLElement} container - Der Container mit der Menü-Komponente
 */
function initializeMenu(container) {
  const menuToggle = container.querySelector('.site-menu__toggle');
  const menu = container.querySelector('.site-menu');
  if (menuToggle && menu) {
    // ARIA Grundattribute
    menu.setAttribute('role','navigation');
    menuToggle.setAttribute('aria-controls', menu.id || 'site-menu');
    menuToggle.setAttribute('aria-expanded','false');
    menu.setAttribute('aria-hidden','true');

    const setState = (open) => {
      menu.classList.toggle('open', open);
      menuToggle.classList.toggle('active', open);
      menuToggle.setAttribute('aria-expanded', String(!!open));
      menu.setAttribute('aria-hidden', String(!open));
    };
    const toggle = () => setState(!menu.classList.contains('open'));
    menuToggle.addEventListener('click', toggle);
    menuToggle.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') toggle();
    });
  } else {
    logMenu.warn('Menu-Toggle-Elemente fehlen oder konnten nicht gefunden werden.');
  }
}

/**
 * Initialisiert das Verhalten für den Logo-Rechtsklick
 * @param {HTMLElement} container - Der Container mit der Menü-Komponente
 */
function initializeLogo(container) {
  const logoContainer = container.querySelector('.site-logo__container');
  if (logoContainer) {
    logoContainer.addEventListener('contextmenu', (e) => {
      // e.preventDefault(); entfernt, um Scroll-Blockaden zu vermeiden
      window.location.href = '/index.html';
    });
  } else {
    logMenu.warn('Logo-Container konnte nicht gefunden werden.');
  }
}

/**
 * Initialisiert die Submenu-Links
 */
function initializeSubmenuLinks() {
  const submenuButtons = document.querySelectorAll('.has-submenu > .submenu-toggle');
  submenuButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const submenu = btn.nextElementSibling;
      const open = submenu.style.display === 'block';
      // Close others
      document.querySelectorAll('.submenu').forEach(sm => {
        if (sm !== submenu) sm.style.display = 'none';
      });
      submenu.style.display = open ? 'none' : 'block';
      btn.setAttribute('aria-expanded', String(!open));
    });
  });
}

/**
 * Schließt das Menü
 * @param {HTMLElement} container - Der Container mit der Menü-Komponente
 */
function closeMenu(container) {
  const menuToggle = container.querySelector('.site-menu__toggle');
  const menu = container.querySelector('.site-menu');
  if (menuToggle && menu) {
    menu.classList.remove('open');
    menuToggle.classList.remove('active');
  }
}

/**
 * Setzt den Seitentitel im Logo anhand des aktuellen Pfads
 */
function setSiteTitle() {
  const titleMap = {
    '/index.html': 'Startseite',
    '/': 'Startseite',
    '/pages/fotogalerie/urban.html': 'Album',
    '/pages/ueber-mich/': 'Über mich',
    '/pages/webentwicklung/project-1.html': 'E‑Commerce Platform',
    '/pages/spiele/space-defender.html': 'Space Defender',
    '/pages/card/wetter.html': 'Wetter',
  };
  const path = window.location.pathname;
  const pageTitle = titleMap[path] || document.title || 'Website';
  const siteTitleEl = document.getElementById('site-title');
  if (siteTitleEl) siteTitleEl.textContent = pageTitle;
}

// Aktiven Link im Menü markieren
function setActiveMenuLink() {
  try {
    const path = window.location.pathname.replace(/index\.html$/, '');
    document.querySelectorAll('.site-menu a[href]').forEach(a => {
      const href = a.getAttribute('href');
      if (!href) return;
      // Normalisieren (index.html entfernen)
      const norm = href.replace(/index\.html$/, '');
      if (norm === path) a.classList.add('active');
      else a.classList.remove('active');
    });
  } catch {}
}

document.addEventListener('DOMContentLoaded', () => {
  setActiveMenuLink();
});
