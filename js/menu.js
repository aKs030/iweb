document.addEventListener('DOMContentLoaded', () => {
  const menuContainer = document.getElementById('menu-container');

  if (!menuContainer) {
    console.error('Fehler: menuContainer wurde nicht gefunden.');
    return;
  }

  // Menü-Komponente laden
  fetch('../pages/komponente/menu.html')
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