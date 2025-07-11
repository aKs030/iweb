document.addEventListener('DOMContentLoaded', () => {
  const menuContainer = document.getElementById('menu-container');

  // Footer laden
  const footerPlaceholder = document.getElementById('footer-placeholder');
  if (footerPlaceholder) {
    fetch('/pages/komponente/footer.html')
      .then(r => {
        if (!r.ok) throw new Error('Footer konnte nicht geladen werden');
        return r.text();
      })
      .then(html => {
        footerPlaceholder.innerHTML = html;
        const yearEl = document.getElementById('current-year');
        if (yearEl) yearEl.textContent = new Date().getFullYear();
        // Cookie-Banner wird statisch in index.html geladen, keine dynamische Nachladung nötig
      })
      .catch(() => {
        // Optional: Fallback oder Fehleranzeige
      });
  } else {
    console.error('Fehler: footer-placeholder wurde nicht gefunden.');
  }

  // Menü laden
  if (!menuContainer) {
    console.error('Fehler: menuContainer wurde nicht gefunden.');
    return;
  }
  fetch('/pages/komponente/menu.html')
    .then(response => {
      if (!response.ok) throw new Error(`HTTP-Error! Status: ${response.status}`);
      return response.text();
    })
    .then(menuMarkup => {
      menuContainer.innerHTML = menuMarkup;
      initializeMenu(menuContainer);
      initializeLogo(menuContainer);
      initializeSubmenuLinks(menuContainer);
      setSiteTitle();

      // Klick außerhalb schließt das Menü (nur für Desktop sinnvoll)
      document.addEventListener('click', (event) => {
        const isClickInside = menuContainer.contains(event.target);
        const isMenuToggle = event.target.closest('.site-menu__toggle');
        if (!isClickInside && !isMenuToggle) closeMenu(menuContainer);
      });
    })
    .catch(err => {
      console.error('Fehler beim Laden des Menüs:', err.message);
    });
});

/**
 * Initialisiert die Menü-Toggle-Logik inkl. Overlay
 * @param {HTMLElement} container - Der Container mit der Menü-Komponente
 */
function initializeMenu(container) {
  const menuToggle = container.querySelector('.site-menu__toggle');
  const menu = container.querySelector('.site-menu');
  const overlay = container.querySelector('.site-menu__overlay');
  if (menuToggle && menu) {
    const toggle = () => {
      menu.classList.toggle('open');
      menuToggle.classList.toggle('active');
      // Overlay wird jetzt nur noch durch CSS gesteuert – kein JS mehr nötig!
    };
    menuToggle.addEventListener('click', toggle);
    menuToggle.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') toggle();
    });
    // Overlay-Klick schließt Menü
    if (overlay) {
      overlay.addEventListener('click', () => {
        menu.classList.remove('open');
        menuToggle.classList.remove('active');
      });
    }
  } else {
    console.warn('Menu-Toggle-Elemente fehlen oder konnten nicht gefunden werden.');
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
      e.preventDefault();
      window.location.href = '/index.html';
    });
  } else {
    console.warn('Logo-Container konnte nicht gefunden werden.');
  }
}

/**
 * Initialisiert die Submenu-Links (nur ein Submenü offen – Mobile only)
 */
function initializeSubmenuLinks(container) {
  const submenuLinks = container.querySelectorAll('.has-submenu > a');
  submenuLinks.forEach(link => {
    link.addEventListener('click', (event) => {
      // Nur für Mobile: JS steuert Submenu!
      if (window.innerWidth > 768) return; // Auf Desktop keine Klick-Steuerung
      event.preventDefault();
      const parentLi = link.parentElement;
      const isOpen = parentLi.classList.contains('open');
      // Alle Submenüs schließen
      container.querySelectorAll('.has-submenu').forEach(li => li.classList.remove('open'));
      // Nur das angeklickte öffnen, falls es vorher zu war
      if (!isOpen) parentLi.classList.add('open');
    });
  });
}

/**
 * Schließt das Menü (inkl. Overlay)
 * @param {HTMLElement} container - Der Container mit der Menü-Komponente
 */
function closeMenu(container) {
  const menuToggle = container.querySelector('.site-menu__toggle');
  const menu = container.querySelector('.site-menu');
  if (menuToggle && menu) {
    menu.classList.remove('open');
    menuToggle.classList.remove('active');
    // Overlay wird jetzt nur noch durch CSS gesteuert
  }
}

/**
 * Setzt den Seitentitel im Logo anhand des aktuellen Pfads
 */
function setSiteTitle() {
  const titleMap = {
    '/index.html': 'Startseite',
    '/': 'Startseite',
    '/pages/album.html': 'Fotogalerie',
    '/pages/ubermich.html': 'Über mich',
    '/pages/index-game.html': 'Spiele-Übersicht',
    '/pages/features/wetter.html': 'Wetter',
  };
  const path = window.location.pathname;
  const pageTitle = titleMap[path] || document.title || 'Website';
  const siteTitleEl = document.getElementById('site-title');
  if (siteTitleEl) siteTitleEl.textContent = pageTitle;
}