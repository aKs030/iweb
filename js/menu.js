  // 1) Menü aus externem HTML-File laden
  fetch('seiten/Komponente/menu.html')
  .then(response => response.text())
  .then(data => {
    // 2) Inhalt in das DIV "main-menu" einsetzen
    document.getElementById('main-menu').innerHTML = data;

    // 3) Jetzt noch den Toggle via JS initialisieren (falls du ein mobiles Menü hast)
    const menuToggleBtn = document.querySelector(".site-menu__toggle");
    const menu = document.querySelector(".site-menu");
    
    // Prüfung, ob Button und Menü vorhanden sind
    if (menuToggleBtn && menu) {
      menuToggleBtn.addEventListener("click", () => {
        menuToggleBtn.classList.toggle("active");
        menu.classList.toggle("open");
      });
    }
  })
  .catch(error => console.error('Fehler beim Laden des Menüs:', error));