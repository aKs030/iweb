document.addEventListener('DOMContentLoaded', () => {
  const menuContainer = document.getElementById('menu-container');

  if (!menuContainer) {
    console.error('Fehler: menuContainer wurde nicht gefunden.');
    return;
  }

  // Menü-Komponente laden
  fetch('/pages/komponente/menu.html')
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP-Error! Status: ${response.status}`);
      }
      return response.text();
    })
    .then(menuMarkup => {
      menuContainer.innerHTML = menuMarkup;

      // Menü-Toggle initialisieren
      initializeMenu(menuContainer);

      // Logo-Verhalten initialisieren
      initializeLogo(menuContainer);

      // Submenu-Links initialisieren
      initializeSubmenuLinks();

      // Klick außerhalb des Menüs schließen
      document.addEventListener('click', (event) => {
        const isClickInside = menuContainer.contains(event.target);
        const isMenuToggle = event.target.closest('.site-menu__toggle');
        if (!isClickInside && !isMenuToggle) {
          closeMenu(menuContainer);
        }
      });
    })
    .catch(err => {
      console.error('Fehler beim Laden des Menüs:', err.message);
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
    menuToggle.addEventListener('click', () => {
      menu.classList.toggle('open');
      menuToggle.classList.toggle('active');
    });
    // Toggle auch per Enter-Taste aktivieren
    menuToggle.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        menu.classList.toggle('open');
        menuToggle.classList.toggle('active');
      }
    });
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
 * Initialisiert die Submenu-Links
 */
function initializeSubmenuLinks() {
  // Selektiere Submenü-Links anhand der neuen Benennung
  const submenuLinks = document.querySelectorAll('.has-submenu > a');
  submenuLinks.forEach(link => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      const submenu = link.nextElementSibling;
      // Schließe alle anderen offenen Submenüs (nur eines offen)
      document.querySelectorAll('.submenu').forEach(sm => {
        if (sm !== submenu) sm.style.display = 'none';
      });
      if (submenu.style.display === 'block') {
        submenu.style.display = 'none';
      } else {
        submenu.style.display = 'block';
      }
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