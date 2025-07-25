// Menüleiste automatisch laden
window.addEventListener('DOMContentLoaded', function() {
  // CSS für Menü dynamisch laden
  const menuCss = document.createElement('link');
  menuCss.rel = 'stylesheet';
  menuCss.href = '/css/menu.css';
  document.head.appendChild(menuCss);

  fetch('/menu.html')
    .then(response => response.text())
    .then(html => {
      const menuContainer = document.createElement('div');
      menuContainer.innerHTML = html;
      document.body.insertBefore(menuContainer, document.body.firstChild);

      // Burger-Menü Funktionalität
      const nav = document.querySelector('.main-menu');
      const toggle = nav.querySelector('.menu-toggle');
      toggle.addEventListener('click', function() {
        nav.classList.toggle('open');
      });
      // Menü schließt bei Klick auf Link (mobil)
      nav.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => nav.classList.remove('open'));
      });
    });
});
// ...Inhalt aus js/menu.js wird hier eingefügt...
