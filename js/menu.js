document.addEventListener('DOMContentLoaded', () => {
  // Menü-Komponente laden
  fetch('menu.html')
    .then(response => {
      if (!response.ok) {
        // Fehler behandeln, wenn die Datei nicht geladen werden kann
        throw new Error(`HTTP-Error! Status: ${response.status}`);
      }
      return response.text(); // Menü-HTML zurückgeben
    })
    .then(menuMarkup => {
      // Container suchen & Menü einfügen
      const menuContainer = document.getElementById('menuContainer');
      if (!menuContainer) {
        throw new Error('menuContainer nicht gefunden!');
      }
      menuContainer.innerHTML = menuMarkup;

      // Menü-Toggle-Logik hinzufügen
      const menuToggle = menuContainer.querySelector('.site-menu__toggle');
      const menu = menuContainer.querySelector('.site-menu');
      if (menuToggle && menu) {
        menuToggle.addEventListener('click', () => {
          menu.classList.toggle('open');
          menuToggle.classList.toggle('active');
        });
      } else {
        console.error('Menu-Toggle-Elemente fehlen.');
      }

      // Logo-Rechtsklick-Verhalten
      const logoContainer = menuContainer.querySelector('.site-logo__container');
      if (logoContainer) {
        logoContainer.addEventListener('contextmenu', (e) => {
          e.preventDefault(); // Kontextmenü verhindern
          window.location.href = '/index.html'; // Weiterleitung zur Startseite
        });
      } else {
        console.error('Logo-Container konnte nicht gefunden werden.');
      }
    })
    .catch(err => {
      // Fehler beim Laden oder Verarbeiten des Menüs
      console.error('Fehler beim Laden des Menüs:', err);
    });
});