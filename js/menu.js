fetch('seiten/Komponente/menu.html')
.then(response => response.text())
.then(data => {
  document.getElementById('main-menu').innerHTML = data;

  // Initialisiere den Hamburger-Toggle, nachdem das Menü geladen wurde
  const menuToggleBtn = document.querySelector(".site-menu__toggle");
  const menu = document.querySelector(".site-menu");

  if (menuToggleBtn && menu) {
    menuToggleBtn.addEventListener("click", () => {
      menuToggleBtn.classList.toggle("active");
      menu.classList.toggle("open");
    });
  }
})
.catch(error => console.error('Fehler beim Laden des Menüs:', error));
