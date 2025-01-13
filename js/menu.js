document.addEventListener('DOMContentLoaded', () => {
  // Pfad zum Menü anpassen
  fetch('/seiten/Komponente/menu.html')
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP-Error! Status: ${response.status}`);
      }
      return response.text();
    })
    .then(menuMarkup => {
      // Container suchen & Menü einfügen
      const menuContainer = document.getElementById('menuContainer');
      if (!menuContainer) {
        throw new Error('menuContainer nicht gefunden!');
      }
      menuContainer.innerHTML = menuMarkup;

      // Menü-Toggle Logik
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

      // Logo-Rechtsklick Logik
      const logoContainer = menuContainer.querySelector('.site-logo__container');
      if (logoContainer) {
        logoContainer.addEventListener('contextmenu', (e) => {
          e.preventDefault(); // Verhindert das Kontextmenü
          window.location.href = '/index.html'; // Weiterleitung zur Startseite
        });
      } else {
        console.error('Logo-Container konnte nicht gefunden werden.');
      }
    })
    .catch(err => console.error('Fehler beim Laden des Menüs:', err));
});
