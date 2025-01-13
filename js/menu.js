
document.addEventListener("DOMContentLoaded", function () {
  // Menü per fetch laden
  fetch('seiten/Komponente/menu.html')
    .then(response => {
      if (!response.ok) {
        throw new Error('Netzwerkantwort war nicht ok');
      }
      return response.text();
    })
    .then(data => {
      document.getElementById('main-menu').innerHTML = data;

      // Jetzt den Toggle initialisieren
      const menuToggleBtn = document.querySelector('.site-menu__toggle');
      const siteMenu = document.querySelector('.site-menu');
      const dropdownLinks = document.querySelectorAll('.dropdown-link');
      const submenuToggles = document.querySelectorAll('.submenu-toggle');

      if (menuToggleBtn && siteMenu) {
        menuToggleBtn.addEventListener('click', () => {
          menuToggleBtn.classList.toggle('active');
          siteMenu.classList.toggle('open');
        });
      }

      // Dropdown-Logik für jedes Submenü
      dropdownLinks.forEach((dropdownLink, index) => {
        dropdownLink.addEventListener('click', (e) => {
          // Standardlink unterbinden, wenn man nur das Submenü öffnen will
          e.preventDefault();

          // Das zugehörige Submenü finden
          const submenu = dropdownLink.nextElementSibling;
          const submenuToggleIcon = submenuToggles[index];

          if (submenu) {
            submenu.classList.toggle('open');
            submenuToggleIcon.classList.toggle('rotate');
          }
        });
      });
    })
    .catch(error => console.error('Fehler beim Laden des Menüs:', error));
});