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
      const isOpen = menu.classList.toggle('open');
      menuToggle.classList.toggle('active');
      if (overlay) overlay.style.display = isOpen ? 'block' : 'none';
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
        overlay.style.display = 'none';
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
 * Initialisiert die Submenu-Links (nur ein Submenü offen)
 */
function initializeSubmenuLinks(container) {
  // Wichtig: Im geladenen Menü suchen, nicht im ganzen Dokument
  const submenuLinks = container.querySelectorAll('.has-submenu > a');
  submenuLinks.forEach(link => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      const submenu = link.nextElementSibling;
      const wasOpen = submenu && submenu.style.display === 'block';
      // Alle Submenüs schließen
      container.querySelectorAll('.submenu').forEach(sm => sm.style.display = 'none');
      // Nur das angeklickte öffnen, falls es vorher zu war
      if (submenu) submenu.style.display = wasOpen ? 'none' : 'block';
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
  const overlay = container.querySelector('.site-menu__overlay');
  if (menuToggle && menu) {
    menu.classList.remove('open');
    menuToggle.classList.remove('active');
    if (overlay) overlay.style.display = 'none';
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