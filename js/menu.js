/*************************************************************************
 * DYNAMISCHES LADEN DES MENÜS UND INTERAKTIONEN *
 *************************************************************************/
document.addEventListener('DOMContentLoaded', () => {
  fetch('menu.html')
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP-Error! Status: ${response.status}`);
      }
      return response.text();
    })
    .then(menuMarkup => {
      // Fügt das Menü in den Container ein
      const menuContainer = document.getElementById('menuContainer');
      if (!menuContainer) {
        throw new Error('menuContainer nicht gefunden!');
      }
      menuContainer.innerHTML = menuMarkup;

      // Menü-Toggle Logik
      const menuToggle = menuContainer.querySelector('.menu-toggle');
      const menu = menuContainer.querySelector('.menu');
      if (menuToggle && menu) {
        menuToggle.addEventListener('click', () => {
          menu.classList.toggle('open');
          menuToggle.classList.toggle('active');
        });
      } else {
        console.error('Menu-Toggle-Elemente fehlen.');
      }

      // Logo-Rechtsklick Logik
      const logoContainer = menuContainer.querySelector('.logo-container');
      if (logoContainer) {
        logoContainer.addEventListener('contextmenu', (e) => {
          e.preventDefault(); // Verhindert das Kontextmenü
          window.location.href = 'index.html'; // Weiterleitung zur Startseite
        });
      } else {
        console.error('Logo-Container konnte nicht gefunden werden.');
      }

      /*************************************************************************
       * NAVIGATION MIT SANFTEM SCROLLEN UND 'ACTIVE'-KLASSEN *
       *************************************************************************/
      const navItems = document.querySelectorAll(".nav-item");
      const navLinks = document.querySelectorAll(".nav-link");

      // Navigationselement anklicken
      navLinks.forEach((link) => {
        link.addEventListener("click", (e) => {
          e.preventDefault();

          // Entferne vorher aktive Klassen
          navItems.forEach((item) => item.classList.remove("active"));

          // Aktiviere den geklickten Navigationsbutton
          const clickedNavItem = link.closest(".nav-item");
          if (clickedNavItem) {
            clickedNavItem.classList.add("active");
          }

          // Ziel-Sektion sanft scrollen
          const targetId = link.getAttribute("href").substring(1);
          const targetSection = document.getElementById(targetId);
          if (targetSection) {
            targetSection.scrollIntoView({
              behavior: "smooth",
              block: "start",
            });
          }

          // Entferne die aktive Klasse nach kurzem Timeout (nur für mobile Ansicht)
          if (window.innerWidth <= 768) {
            setTimeout(() => {
              clickedNavItem.classList.remove("active");
            }, 1000); // Nach 1 Sekunde
          }
        });
      });
    })
    .catch(err => console.error('Fehler beim Laden des Menüs:', err));
});

/*************************************************************************
 * BACK TO TOP BUTTON *
 *************************************************************************/
function smoothScrollToSection(sectionId) {
  const target = document.getElementById(sectionId);
  if (target) {
    window.scrollTo({
      top: target.offsetTop,
      behavior: 'smooth',
    });
  }
}
$(document).ready(function () {
  // Back-to-Top Button erstellen
  const backToTopButton = $(
    `<a href="#top" class="back-to-top">
      <img src="img/top.png" alt="Back to top" style="max-width: 50px;">
    </a>`
  );

  // Button einfügen
  $("body").append(backToTopButton);

  // CSS für den Button setzen
  $(".back-to-top").css({
    position: "fixed",
    bottom: "20px",
    right: "20px",
    display: "none", // Button versteckt initial
    cursor: "pointer",
    zIndex: 9999, // Button immer im Vordergrund
  });

  // Scroll-Event-Listener hinzufügen
  $(window).on("scroll", function () {
    if ($(this).scrollTop() > 50) {
      // Zeige Button, wenn mehr als 50px gescrollt
      $(".back-to-top").fadeIn();
    } else {
      // Verstecke Button, wenn weniger als 50px gescrollt
      $(".back-to-top").fadeOut();
    }
  });

  // Smooth-Scroll nach oben beim Klick
  $(".back-to-top").on("click", function (e) {
    e.preventDefault();
    $("html, body").animate({ scrollTop: 0 }, 800);
  });

  // Button initial anzeigen, wenn bereits gescrollt
  if ($(window).scrollTop() > 50) {
    $(".back-to-top").show();
  }
});